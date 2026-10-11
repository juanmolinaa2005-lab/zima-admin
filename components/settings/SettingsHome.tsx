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
    description: "Claves de OpenAI, fal, Meta, YouTube y demás proveedores.",
    href: "api",
    Icon: ApiIcon,
  },
  {
    id: "password",
    name: "Contraseña",
    description: "Cambia la contraseña de tu cuenta con un código por email.",
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
      title="Ajustes"
      subtitle="Configuración del proyecto y de tu cuenta."
      backHref={`/projects/${projectId}`}
      backLabel="← Proyecto"
    >
      <ul className="ui-card divide-y divide-[var(--border)] overflow-hidden">
        {ITEMS.map(({ id, name, description, href, Icon }) => (
          <li key={id}>
            <Link
              href={`/projects/${projectId}/settings/${href}`}
              className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[var(--background)]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-[var(--foreground)]">
                  {name}
                </span>
                <span className="block text-[13px] text-[var(--muted)]">{description}</span>
              </span>
              <span className="text-[var(--muted-soft)] transition group-hover:translate-x-0.5 group-hover:text-[var(--accent)]">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </SettingsShell>
  );
}
