import Link from "next/link";

export const metadata = {
  title: "Privacy Policy · Zima Admin",
  description: "Privacy policy for Zima Admin and Meta / Instagram integrations.",
};

export default function PrivacyPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto min-h-dvh max-w-2xl p-5 text-[var(--foreground)] outline-none">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
        Zima Admin
      </p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        Privacy Policy
      </h1>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Last updated: August 10, 2026
      </p>

      <div className="mt-8 space-y-5 text-[14px] leading-relaxed text-[var(--foreground-soft)]">
        <p>
          Zima Admin (“we”, “our”) is a project administration tool. This policy
          explains how we handle data when you use the service, including Meta /
          Instagram connections.
        </p>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Data we process
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Account email and authentication data (via Supabase Auth).</li>
            <li>
              Project configuration you create (tools, settings, media gallery
              files).
            </li>
            <li>
              Social connection data when you connect Instagram via Meta: access
              tokens, Instagram Business account id, username, and related
              profile fields needed to publish content.
            </li>
            <li>
              Content you choose to publish (captions, public media URLs).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            How we use Meta / Instagram data
          </h2>
          <p className="mt-2">
            We use Meta permissions only to list your connected Instagram
            Business/Creator account and to publish content you explicitly
            request from Zima Admin. We do not sell this data or use it for
            advertising.
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Storage and security
          </h2>
          <p className="mt-2">
            Tokens and secrets are stored encrypted in our database. Access is
            limited to your authenticated account and the projects you own.
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Sharing
          </h2>
          <p className="mt-2">
            We share data with Meta/Instagram only as needed to authenticate and
            publish on your behalf, and with infrastructure providers that host
            the app (e.g. Vercel, Supabase).
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Retention and deletion
          </h2>
          <p className="mt-2">
            You can disconnect Instagram and remove API credentials from
            Settings at any time. To request full account/data deletion, see{" "}
            <Link
              href="/data-deletion"
              className="font-semibold text-[var(--accent)] underline"
            >
              Data deletion instructions
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Contact</h2>
          <p className="mt-2">
            Questions:{" "}
            <a
              href="mailto:zimaai.net@gmail.com"
              className="font-semibold text-[var(--accent)] underline"
            >
              zimaai.net@gmail.com
            </a>
          </p>
        </section>
      </div>
    </main>
  );
}
