export const metadata = {
  title: "Data Deletion · Zima Admin",
  description: "How to request deletion of your Zima Admin data.",
};

export default function DataDeletionPage() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto min-h-dvh max-w-2xl p-5 text-[var(--foreground)] outline-none">
      <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">
        Zima Admin
      </p>
      <h1 className="mt-2 text-[28px] font-semibold tracking-tight">
        User data deletion
      </h1>
      <p className="mt-2 text-[13px] text-[var(--muted)]">
        Instructions for Meta / Instagram app compliance
      </p>

      <div className="mt-8 space-y-5 text-[14px] leading-relaxed text-[var(--foreground-soft)]">
        <p>
          If you connected Instagram (or other providers) through Zima Admin and
          want your data removed, follow these steps:
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Sign in to Zima Admin and open the project where you connected
            Instagram.
          </li>
          <li>
            Go to <strong>Redes → Instagram</strong> and disconnect the account
            if shown, or remove connected social accounts.
          </li>
          <li>
            Go to <strong>Settings → API</strong> and disconnect Meta / other
            API keys you no longer need.
          </li>
          <li>
            To delete your full Zima Admin account and remaining stored data,
            email{" "}
            <a
              href="mailto:zimaai.net@gmail.com?subject=Data%20deletion%20request"
              className="font-semibold text-[var(--accent)] underline"
            >
              zimaai.net@gmail.com
            </a>{" "}
            with the subject “Data deletion request” and the email you use to
            sign in.
          </li>
        </ol>
        <p>
          We will confirm deletion of account data, stored tokens, and project
          media associated with your user within a reasonable period (typically
          within 30 days), except where retention is required by law.
        </p>
      </div>
    </main>
  );
}
