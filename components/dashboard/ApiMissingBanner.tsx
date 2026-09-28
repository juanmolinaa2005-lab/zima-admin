"use client";

import Link from "next/link";

type ApiMissingBannerProps = {
  projectId: string;
  providerName: string;
  message?: string;
};

/** Small floating yellow alert when a page needs an API that isn’t connected. */
export function ApiMissingBanner({
  projectId,
  providerName,
  message,
}: ApiMissingBannerProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 sm:top-4">
      <div className="pointer-events-auto flex max-w-xl items-center gap-3 rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3.5 py-2.5 shadow-[0_8px_24px_rgba(120,53,15,0.12)]">
        <span
          className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-[#f59e0b]"
          aria-hidden
        />
        <p className="min-w-0 flex-1 text-[12px] leading-snug text-[#92400e]">
          {message || (
            <>
              <span className="font-semibold">{providerName}</span> API is not
              connected.
            </>
          )}
        </p>
        <Link
          href={`/projects/${projectId}/settings/api`}
          className="shrink-0 rounded-lg bg-[#f59e0b] px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-[#d97706]"
        >
          Configure
        </Link>
      </div>
    </div>
  );
}
