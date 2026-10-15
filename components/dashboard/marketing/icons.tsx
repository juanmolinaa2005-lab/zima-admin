export function IconCalendar({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14.5" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 10h16M8.5 3.5v3.5M15.5 3.5v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="7.5" y="13" width="3" height="3" rx="0.8" fill="currentColor" />
    </svg>
  );
}

export function IconMegaphone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 10.2v3.6a1 1 0 0 0 1 1h2.5L15 19V5L7.5 9.2H5a1 1 0 0 0-1 1Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8 15l1.2 4.2a1 1 0 0 0 1 .8H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 9.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function IconSparkles({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M10 4.5 11.6 9a2 2 0 0 0 1.4 1.4l4.5 1.6-4.5 1.6a2 2 0 0 0-1.4 1.4L10 19.5 8.4 15a2 2 0 0 0-1.4-1.4L2.5 12 7 10.4A2 2 0 0 0 8.4 9L10 4.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M18 3v4M16 5h4M18.5 16v3M17 17.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
