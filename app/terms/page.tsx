import Link from "next/link";

export const metadata = {
  title: "Terms of Service · Zima Admin",
  description: "Terms of service for Zima Admin.",
};

export default function TermsPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto min-h-dvh max-w-2xl p-5 text-[var(--foreground)] outline-none">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
        Zima Admin
      </p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        Terms of Service
      </h1>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Last updated: August 10, 2026
      </p>

      <div className="mt-8 space-y-5 text-[14px] leading-relaxed text-[var(--foreground-soft)]">
        <p>
          By using Zima Admin you agree to these terms. The service helps you
          manage projects and publish content to platforms such as Instagram
          through official APIs.
        </p>
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Your responsibilities
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>You must have rights to the content you upload or publish.</li>
            <li>
              You must comply with Meta/Instagram and other platform policies.
            </li>
            <li>
              You are responsible for the accounts you connect and the actions
              taken with your credentials.
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">
            Service availability
          </h2>
          <p className="mt-2">
            We provide the service as-is. Platform APIs (Meta, Blotato, etc.)
            may change or rate-limit requests outside our control.
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Privacy</h2>
          <p className="mt-2">
            See our{" "}
            <Link
              href="/privacy"
              className="font-semibold text-[var(--accent)] underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-semibold text-[var(--foreground)]">Contact</h2>
          <p className="mt-2">
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
