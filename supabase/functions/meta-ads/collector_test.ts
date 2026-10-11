import { collectAds, CollectionError, mediaUrl, normalizePublicAd, parsePublicPage, readBounded } from "./collector.ts";
import { authorizeServiceRole, isServiceRole } from "./service-auth.ts";

function assert(value: unknown, message = "Assertion failed"): asserts value { if (!value) throw new Error(message); }
async function rejects(fn: () => unknown, code: string) {
  try { await fn(); } catch (error) { assert(error instanceof CollectionError && error.code === code); return; }
  throw new Error(`Expected ${code}`);
}
// Synthetic fixtures exercise parsing contracts; they do not prove live Meta availability.
const raw = { ad_archive_id: "123", page_id: "456", is_active: true, end_date: 1700000000,
  start_date: 1690000000, publisher_platform: ["FACEBOOK", "INSTAGRAM"], snapshot: {
    page_name: "Test app", body: { text: "Test creative" }, title: "{{product.name}}",
    page_profile_picture_url: "https://scontent.test.fbcdn.net/avatar.jpg",
    cards: [{ title: "A real title", video_sd_url: "https://video.test.fbcdn.net/video.mp4",
      video_preview_image_url: "https://scontent.test.fbcdn.net/poster.jpg" }],
  } };
const html = (edges: unknown[], more = false) => `<script type="application/json">${JSON.stringify({ payload: {
  search_results_connection: { edges, page_info: { has_next_page: more } },
} })}</script>`;
const params = { q: "Test app", countries: ["US"], active: true };
const mock = (fn: (input: string | URL | Request, init?: RequestInit) => Response | Promise<Response>) => fn as typeof fetch;

Deno.test("public creatives normalize carousel media and active dates without inventing reach", () => {
  const ad = normalizePublicAd(raw);
  assert(ad?.id === "123" && ad.active && ad.stoppedAt === null && ad.reach === null);
  assert(ad.titles.join() === "A real title" && ad.bodies[0] === "Test creative");
  assert(ad.media?.video?.endsWith("video.mp4") && ad.media.image?.endsWith("poster.jpg"));
});
Deno.test("media accepts only HTTPS Meta hosts", () => {
  for (const url of ["http://fbcdn.net/a", "https://fbcdn.net.evil.test/a", "https://user:pass@fbcdn.net/a", "file:///tmp/a", "javascript:alert(1)"]) assert(mediaUrl(url) === null);
  assert(mediaUrl("https://scontent.fbcdn.net/a") !== null);
});
Deno.test("public snapshots deduplicate ads and flag incomplete pagination", () => {
  const result = parsePublicPage(html([{ node: { collated_results: [raw, raw] } }], true));
  assert(result.ads.length === 1 && result.partial && result.after === null);
});
Deno.test("genuine empty search is distinguishable from verification or unknown markup", async () => {
  assert(parsePublicPage(html([])).ads.length === 0);
  await rejects(() => parsePublicPage("<script>executeChallenge()</script>"), "PUBLIC_BLOCKED");
  await rejects(() => parsePublicPage("<html>loading</html>"), "PUBLIC_UNAVAILABLE");
  await rejects(() => parsePublicPage(html([{ node: { new_schema: true } }])), "PUBLIC_UNAVAILABLE");
});
Deno.test("word captcha in an ad does not look like a verification challenge", () => {
  assert(parsePublicPage(html([{ ...raw, snapshot: { body: "Build a captcha app" } }])).ads.length === 1);
});
Deno.test("USA commercial search never queries Graph API or leaks its token", async () => {
  let calls = 0;
  const result = await collectAds(params, "private-test-token", mock((input, init) => {
    calls++;
    const url = new URL(String(input));
    assert(url.hostname === "www.facebook.com" && url.searchParams.get("country") === "US");
    assert(!new Headers(init?.headers).has("Authorization") && !url.href.includes("private-test-token"));
    return new Response(html([{ node: raw }]));
  }));
  assert(calls === 1 && result.source === "meta_public");
});
Deno.test("official search uses Authorization header and returns only an opaque cursor", async () => {
  const result = await collectAds({ ...params, countries: ["ES"], after: "cursor-in" }, "private-test-token", mock((input, init) => {
    const url = new URL(String(input));
    assert(url.hostname === "graph.facebook.com" && url.searchParams.get("after") === "cursor-in");
    assert(!url.href.includes("private-test-token") && new Headers(init?.headers).get("Authorization") === "Bearer private-test-token");
    return Response.json({ data: [{ id: "123", page_name: "Test app", eu_total_reach: 100 }],
      paging: { next: "https://graph.facebook.com/?access_token=private-test-token", cursors: { after: "cursor-out" } } });
  }));
  assert(result.source === "meta_api" && result.after === "cursor-out" && !JSON.stringify(result).includes("private-test-token"));
});
Deno.test("official permission failure survives a blocked public fallback", async () => {
  let calls = 0;
  await rejects(() => collectAds({ ...params, countries: ["ES"] }, "test", mock(() => {
    calls++;
    return calls === 1 ? Response.json({ error: { code: 10 } }, { status: 400 }) : new Response("blocked", { status: 403 });
  })), "META_PERMISSION");
  assert(calls === 2);
});
Deno.test("unsupported public cursors are rejected without a network call", async () => {
  await rejects(() => collectAds({ ...params, after: "cursor" }, "", mock(() => { throw new Error("Must not fetch"); })), "CURSOR_EXPIRED");
});
Deno.test("blocked public requests are errors, not zero results", async () => {
  await rejects(() => collectAds(params, "", mock(() => new Response("blocked", { status: 403 }))), "PUBLIC_BLOCKED");
});
Deno.test("stream reader bounds response size and preserves split UTF-8", async () => {
  const bytes = new TextEncoder().encode("España");
  const response = new Response(new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, 5)); c.enqueue(bytes.slice(5)); c.close(); } }));
  assert(await readBounded(response) === "España");
  await rejects(() => readBounded(new Response("12345"), 4), "RESPONSE_TOO_LARGE");
});
Deno.test("service authorization rejects forged role claims, missing and incorrect keys", () => {
  const request = (key: string) => new Request("https://example.test", { headers: { Authorization: `Bearer ${key}` } });
  assert(isServiceRole(request("actual-server-key"), "actual-server-key"));
  assert(!isServiceRole(request("wrong--server-key"), "actual-server-key"));
  assert(!isServiceRole(request(""), ""));
  assert(!isServiceRole(request(`x.${btoa(JSON.stringify({ role: "service_role" }))}.x`), "actual-server-key"));
});
Deno.test("alternate service keys must pass server-side signature and database privilege validation", async () => {
  const token = `x.${btoa(JSON.stringify({ role: "service_role" }))}.x`;
  const request = new Request("https://example.test", { headers: { Authorization: `Bearer ${token}` } });
  assert(!await authorizeServiceRole(request, "actual-server-key", "https://project.supabase.co", "anon", mock(() => new Response(null, { status: 401 }))));
  assert(await authorizeServiceRole(request, "actual-server-key", "https://project.supabase.co", "anon", mock((url, init) => {
    assert(String(url).endsWith("?select=id&limit=0") && init?.method === "HEAD");
    assert(new Headers(init.headers).get("Authorization") === `Bearer ${token}`);
    return new Response(null, { status: 200 });
  })));
});
