import Link from "next/link";
import { SettingsShell } from "@/components/settings/SettingsShell";

type SettingsHomeProps = {
  projectId: string;
  projectName: string;
  userEmail: string | null;
};

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="5"
        y="10"
        width="14"
        height="10"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M8 10V8a4 4 0 0 1 8 0v2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ApiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 8H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M16 8h2a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M9 12h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const ITEMS = [
  {
    id: "api",
    name: "API",
    href: "api",
    Icon: ApiIcon,
  },
  {
    id: "password",
    name: "Password",
    href: "password",
    Icon: LockIcon,
  },
] as const;

export function SettingsHome({
  projectId,
  projectName,
  userEmail,
}: SettingsHomeProps) {
  return (
    <SettingsShell
      projectId={projectId}
      projectName={projectName}
      userEmail={userEmail}
      title="Settings"
      subtitle="Ajustes del proyecto."
      backHref={`/projects/${projectId}`}
      backLabel="← Proyecto"
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ITEMS.map(({ id, name, href, Icon }) => (
          <Link
            key={id}
            href={`/projects/${projectId}/settings/${href}`}
            className="ui-card flex flex-col items-center gap-3 p-5 text-center transition hover:bg-[var(--accent-soft)]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-[14px] font-semibold tracking-tight">
              {name}
            </span>
          </Link>
        ))}
      </div>
    </SettingsShell>
  );
}
