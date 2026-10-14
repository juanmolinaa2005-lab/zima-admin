"use client";

import { RequestsPage } from "./viewtracker/RequestsPage";
import { ResponsesPage } from "./viewtracker/ResponsesPage";
import { VideosPage } from "./viewtracker/VideosPage";
import { AccountsPage } from "./viewtracker/AccountsPage";
import { CreatorsPage } from "./viewtracker/CreatorsPage";
import { OverviewPage } from "./viewtracker/OverviewPage";
import { UploadPage } from "./viewtracker/UploadPage";

export type MarketingPageId = "overview" | "accounts" | "videos" | "creators" | "upload" | "requests" | "responses";

export const MARKETING_PAGES: MarketingPageId[] = ["overview", "accounts", "videos", "creators", "upload", "requests", "responses"];

const FULL_BLEED = new Set<MarketingPageId>(["accounts", "videos", "upload"]);

export function MarketingPage({ id, projectId }: { id: MarketingPageId; projectId: string }) {
  return (
    <div className={FULL_BLEED.has(id) ? "flex h-full min-h-0 min-w-0 flex-col overflow-hidden" : "h-full min-w-0 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6"}>
      {id === "overview" ? <OverviewPage projectId={projectId} /> : null}
      {id === "accounts" ? <AccountsPage projectId={projectId} /> : null}
      {id === "videos" ? <VideosPage projectId={projectId} /> : null}
      {id === "creators" ? <CreatorsPage projectId={projectId} /> : null}
      {id === "upload" ? <UploadPage projectId={projectId} /> : null}
      {id === "requests" ? <RequestsPage projectId={projectId} /> : null}
      {id === "responses" ? <ResponsesPage projectId={projectId} /> : null}
    </div>
  );
}

export function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5V4.5m0 0L7.75 8.75M12 4.5l4.25 4.25"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 14.5v3.25A1.75 1.75 0 0 0 6.25 19.5h11.5a1.75 1.75 0 0 0 1.75-1.75V14.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconOverview({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconCreators({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 18.5c.8-2.6 2.9-4 5.5-4s4.7 1.4 5.5 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M16.2 18.5c.4-1.6 1.5-2.7 3.3-3.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconAccounts({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M5 19c1.2-3.2 3.6-4.8 7-4.8s5.8 1.6 7 4.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconVideos({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3.5"
        y="6"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m16.5 10 4-2.2v8.4L16.5 14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconRequests({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m5.5 7.5 6.5 5 6.5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconChat({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 17.5 6.2 14A7 7 0 1 1 9 18.7L5 17.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
