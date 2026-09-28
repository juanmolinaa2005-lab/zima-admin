import type { ReactNode } from "react";

export function StudioPage({
  kicker,
  title,
  description,
  actions,
  children,
  narrow,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className={`studio-page ${narrow ? "studio-page-narrow" : ""}`}>
      <header className="studio-page-head">
        <div className="min-w-0">
          {kicker ? <p className="studio-kicker">{kicker}</p> : null}
          <h2 className="studio-title">{title}</h2>
          {description ? <p className="studio-lead">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
