"use client";

import { useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MobileFabMenu, type MobileNavSection } from "./MobileFabMenu";
import { MonetizationIcon } from "./icons";
import { Svg, type IconComp } from "./market/shared";

const ACCENT = "#f2545b";

type PageId = "overview" | "charts" | "customers" | "products" | "paywalls" | "experiments";
const PAGES = new Set<PageId>(["overview", "charts", "customers", "products", "paywalls", "experiments"]);

function pageFrom(raw: string | null): PageId {
  return raw && PAGES.has(raw as PageId) ? (raw as PageId) : "overview";
}

/* ---------------- icons ---------------- */

const IconOverview: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="4" y="4" width="7" height="7" rx="1.5" />
    <rect x="13" y="4" width="7" height="4" rx="1.5" />
    <rect x="13" y="10" width="7" height="10" rx="1.5" />
    <rect x="4" y="13" width="7" height="7" rx="1.5" />
  </Svg>
);
const IconCharts: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M4 19.5h16" />
    <path d="m5 15 4.5-4.5 3.5 3 6-6.5" />
  </Svg>
);
const IconCustomers: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3.5 19c.6-3 2.8-4.75 5.5-4.75S13.9 16 14.5 19" />
    <path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.6c1.6.6 2.6 2.1 3 4.4" />
  </Svg>
);
const IconProducts: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="m12 3.75 7.5 4v8.5l-7.5 4-7.5-4v-8.5z" />
    <path d="m4.75 8 7.25 4 7.25-4M12 12v8" />
  </Svg>
);
const IconPaywalls: IconComp = ({ className }) => (
  <Svg className={className}>
    <rect x="6.5" y="3" width="11" height="18" rx="2.5" />
    <path d="M9.5 15.5h5M10.5 18h3" />
    <rect x="9" y="6.5" width="6" height="5" rx="1" />
  </Svg>
);
const IconExperiments: IconComp = ({ className }) => (
  <Svg className={className}>
    <path d="M9.5 3.75h5M10.5 3.75v5.5L5.4 18a1.75 1.75 0 0 0 1.5 2.6h10.2a1.75 1.75 0 0 0 1.5-2.6l-5.1-8.75v-5.5" />
    <path d="M7.5 14.5h9" />
  </Svg>
);
const IconSearch: IconComp = ({ className }) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.25" />
    <path d="m20 20-4.5-4.5" />
  </Svg>
);

/* ---------------- ui ---------------- */

function NavButton({ label, icon: Icon, active, onClick }: { label: string; icon: IconComp; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition ${
        active ? "bg-[#fff1f1] text-[#d63a42]" : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </button>
  );
}

function Header({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        <p className="mt-0.5 text-[13px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function Select<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-9 appearance-none rounded-lg border border-[var(--border)] bg-white pl-3 pr-8 text-[13px] font-medium text-[var(--foreground)] outline-none focus:border-black/25"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" fill="none" aria-hidden>
        <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}

function Card({ title, subtitle, action, children, className = "" }: { title?: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-[var(--border)] bg-white shadow-[0_1px_2px_rgba(22,24,29,0.04)] ${className}`}>
      {title ? (
        <header className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-[var(--foreground)]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] text-[var(--muted)]">{subtitle}</p> : null}
          </div>
          {action}
        </header>
      ) : null}
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: IconComp; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#fff1f1] text-[#d63a42]">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-3 text-[14px] font-semibold text-[var(--foreground)]">{title}</p>
      <p className="mt-1 max-w-sm text-[13px] text-[var(--muted)]">{text}</p>
    </div>
  );
}

const NO_DATA = "Aún no hay una fuente de ingresos conectada. Cuando la conectes, verás aquí los datos reales.";

/** Empty chart frame: gridlines and axis labels without invented values. */
function ChartFrame({ height = 240, label }: { height?: number; label: string }) {
  return (
    <div className="relative px-5 pb-5 pt-4" style={{ height }}>
      <div className="absolute inset-x-5 bottom-10 top-4 flex flex-col justify-between">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="block border-t border-dashed border-[var(--border)]" />
        ))}
      </div>
      <div className="relative flex h-full items-center justify-center pb-6">
        <p className="rounded-full bg-white px-3 py-1 text-[12px] text-[var(--muted)] ring-1 ring-[var(--border)]">{label}</p>
      </div>
    </div>
  );
}

function Table({ columns, empty }: { columns: string[]; empty: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-[12px]">
        <thead>
          <tr className="border-b border-[var(--border)] text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {columns.map((c) => (
              <th key={c} className="px-5 py-2.5 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={columns.length}>{empty}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- pages ---------------- */

const PERIODS = [
  { value: "7", label: "Últimos 7 días" },
  { value: "28", label: "Últimos 28 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Últimos 12 meses" },
];

const OVERVIEW_METRICS: { label: string; hint: string }[] = [
  { label: "Active Trials", hint: "Pruebas en curso" },
  { label: "Active Subscriptions", hint: "Suscripciones de pago activas" },
  { label: "MRR", hint: "Ingresos recurrentes mensuales" },
  { label: "Revenue", hint: "En el periodo" },
  { label: "New Customers", hint: "En el periodo" },
  { label: "Active Customers", hint: "En el periodo" },
];

function OverviewPage() {
  const [period, setPeriod] = useState("28");
  const periodLabel = PERIODS.find((p) => p.value === period)?.label.toLowerCase() ?? "";
  return (
    <div className="space-y-5">
      <Header title="Overview" subtitle="El estado de tus ingresos y suscripciones de un vistazo">
        <Select label="Periodo" value={period} options={PERIODS} onChange={setPeriod} />
      </Header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] shadow-[0_1px_2px_rgba(22,24,29,0.04)] md:grid-cols-3 xl:grid-cols-6">
        {OVERVIEW_METRICS.map((metric) => (
          <div key={metric.label} className="bg-white px-5 py-4">
            <p className="text-[12px] font-medium text-[var(--muted)]">{metric.label}</p>
            <p className="mt-1.5 text-[24px] font-semibold tabular-nums tracking-tight text-[var(--muted-soft)]">—</p>
            <p className="mt-0.5 text-[11px] text-[var(--muted-soft)]">{metric.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Revenue" subtitle={`Ingresos brutos · ${periodLabel}`}>
          <ChartFrame label="Sin datos de ingresos" />
        </Card>
        <Card title="MRR" subtitle={`Ingresos recurrentes mensuales · ${periodLabel}`}>
          <ChartFrame label="Sin datos de MRR" />
        </Card>
      </div>

      <Card title="Recent transactions" subtitle="Compras, renovaciones y reembolsos más recientes">
        <Table
          columns={["Cliente", "Producto", "Tipo", "Tienda", "País", "Importe", "Fecha"]}
          empty={<EmptyState icon={IconCustomers} title="Sin transacciones" text={NO_DATA} />}
        />
      </Card>
    </div>
  );
}

const CHART_GROUPS: { label: string; charts: { id: string; name: string; description: string }[] }[] = [
  {
    label: "Revenue",
    charts: [
      { id: "revenue", name: "Revenue", description: "Ingresos brutos de todas las compras en el periodo." },
      { id: "mrr", name: "MRR", description: "Ingresos recurrentes mensuales normalizados de las suscripciones activas." },
      { id: "arr", name: "ARR", description: "MRR anualizado." },
      { id: "mrr-movement", name: "MRR Movement", description: "MRR nuevo, expansión, contracción y churn." },
      { id: "ltv", name: "Realized LTV per Customer", description: "Ingresos acumulados por cliente según su cohorte." },
    ],
  },
  {
    label: "Subscriptions",
    charts: [
      { id: "active-subscriptions", name: "Active Subscriptions", description: "Suscripciones de pago activas al final de cada periodo." },
      { id: "active-trials", name: "Active Trials", description: "Pruebas gratuitas en curso." },
      { id: "new-trials", name: "New Trials", description: "Pruebas gratuitas iniciadas." },
      { id: "trial-conversion", name: "Trial Conversion", description: "Porcentaje de pruebas que pasan a pago." },
      { id: "churn", name: "Churn", description: "Porcentaje de suscripciones que se cancelan o expiran." },
      { id: "retention", name: "Subscription Retention", description: "Suscripciones que siguen activas en cada renovación." },
    ],
  },
  {
    label: "Customers",
    charts: [
      { id: "new-customers", name: "New Customers", description: "Clientes vistos por primera vez." },
      { id: "active-customers", name: "Active Customers", description: "Clientes con actividad en el periodo." },
      { id: "conversion", name: "Conversion to Paying", description: "Clientes nuevos que acaban pagando." },
      { id: "refund-rate", name: "Refund Rate", description: "Porcentaje de transacciones reembolsadas." },
    ],
  },
];

function ChartsPage() {
  const [selected, setSelected] = useState("revenue");
  const [period, setPeriod] = useState("28");
  const [interval, setIntervalKey] = useState("day");
  const [segment, setSegment] = useState("none");
  const chart = CHART_GROUPS.flatMap((g) => g.charts).find((c) => c.id === selected) ?? CHART_GROUPS[0].charts[0];

  return (
    <div className="space-y-5">
      <Header title="Charts" subtitle="Analiza cada métrica de monetización en detalle" />
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <Card className="h-fit p-2">
          {CHART_GROUPS.map((group) => (
            <div key={group.label} className="mb-1">
              <p className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">{group.label}</p>
              {group.charts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c.id)}
                  className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] transition ${
                    c.id === selected ? "bg-[#fff1f1] font-semibold text-[#d63a42]" : "text-[var(--foreground-soft)] hover:bg-[var(--surface-alt)]"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ))}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--foreground)]">{chart.name}</h2>
                <p className="mt-0.5 max-w-xl text-[12px] text-[var(--muted)]">{chart.description}</p>
                <p className="mt-2 text-[26px] font-semibold tabular-nums text-[var(--muted-soft)]">—</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Select label="Periodo" value={period} options={PERIODS} onChange={setPeriod} />
                <Select
                  label="Intervalo"
                  value={interval}
                  onChange={setIntervalKey}
                  options={[
                    { value: "day", label: "Diario" },
                    { value: "week", label: "Semanal" },
                    { value: "month", label: "Mensual" },
                  ]}
                />
                <Select
                  label="Segmento"
                  value={segment}
                  onChange={setSegment}
                  options={[
                    { value: "none", label: "Sin segmentar" },
                    { value: "store", label: "Por tienda" },
                    { value: "country", label: "Por país" },
                    { value: "product", label: "Por producto" },
                    { value: "platform", label: "Por plataforma" },
                  ]}
                />
              </div>
            </div>
            <ChartFrame height={320} label={`Sin datos de ${chart.name}`} />
          </Card>
          <Card title="Datos" subtitle="Valores por periodo">
            <Table columns={["Periodo", chart.name, "Cambio"]} empty={<EmptyState icon={IconCharts} title="Sin datos" text={NO_DATA} />} />
          </Card>
        </div>
      </div>
    </div>
  );
}

function CustomersPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  return (
    <div className="space-y-5">
      <Header title="Customers" subtitle="Busca cualquier cliente y revisa su historial de compras" />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[260px] flex-1 items-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 focus-within:border-black/25">
          <IconSearch className="h-4 w-4 shrink-0 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="App User ID, alias o email…"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
        <Select
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Todos los clientes" },
            { value: "active", label: "Suscripción activa" },
            { value: "trial", label: "En prueba" },
            { value: "expired", label: "Expirados" },
            { value: "refunded", label: "Con reembolso" },
          ]}
        />
      </div>
      <Card>
        <Table
          columns={["App User ID", "Estado", "Producto", "Tienda", "País", "Gastado", "Última vez"]}
          empty={<EmptyState icon={IconCustomers} title={query ? `Ningún cliente coincide con “${query}”` : "Sin clientes"} text={NO_DATA} />}
        />
      </Card>
    </div>
  );
}

type CatalogTab = "products" | "entitlements" | "offerings";

function ProductsPage() {
  const [tab, setTab] = useState<CatalogTab>("products");
  const tabs: { id: CatalogTab; label: string; text: string; columns: string[] }[] = [
    { id: "products", label: "Products", text: "Los productos de App Store, Google Play o web que vendes.", columns: ["Identificador", "Nombre", "Tienda", "Tipo", "Duración", "Prueba", "Precio"] },
    { id: "entitlements", label: "Entitlements", text: "Los niveles de acceso (por ejemplo “pro”) que desbloquean tus productos.", columns: ["Identificador", "Descripción", "Productos", "Clientes activos"] },
    { id: "offerings", label: "Offerings", text: "Los grupos de productos que muestras en cada paywall.", columns: ["Identificador", "Descripción", "Paquetes", "Por defecto"] },
  ];
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <div className="space-y-5">
      <Header title="Product catalog" subtitle="Productos, entitlements y offerings de tu app" />
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition ${
              t.id === tab ? "text-[var(--foreground)]" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
            style={t.id === tab ? { borderColor: ACCENT } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Card>
        <Table columns={current.columns} empty={<EmptyState icon={IconProducts} title={`Sin ${current.label.toLowerCase()}`} text={current.text} />} />
      </Card>
    </div>
  );
}

function PaywallsPage() {
  return (
    <div className="space-y-5">
      <Header title="Paywalls" subtitle="Las pantallas de compra de tu app y cómo convierten" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["Impresiones", "Conversiones", "Tasa de conversión", "Ingresos"].map((label) => (
          <Card key={label} className="px-5 py-4">
            <p className="text-[12px] font-medium text-[var(--muted)]">{label}</p>
            <p className="mt-1.5 text-[24px] font-semibold tabular-nums text-[var(--muted-soft)]">—</p>
          </Card>
        ))}
      </div>
      <Card title="Paywalls" subtitle="Cada paywall con su offering y rendimiento">
        <Table
          columns={["Paywall", "Offering", "Impresiones", "Conversión", "Ingresos", "Actualizado"]}
          empty={<EmptyState icon={IconPaywalls} title="Sin paywalls" text={NO_DATA} />}
        />
      </Card>
    </div>
  );
}

function ExperimentsPage() {
  return (
    <div className="space-y-5">
      <Header title="Experiments" subtitle="Tests A/B de precios y paywalls" />
      <Card>
        <Table
          columns={["Experimento", "Estado", "Variantes", "Clientes", "Conversión", "Ingresos por cliente", "Inicio"]}
          empty={<EmptyState icon={IconExperiments} title="Sin experimentos" text="Cuando lances un test de precios o paywalls, verás aquí cada variante y cuál gana." />}
        />
      </Card>
    </div>
  );
}

/* ---------------- shell ---------------- */

const NAV: { section?: string; items: { id: PageId; label: string; icon: IconComp }[] }[] = [
  {
    items: [
      { id: "overview", label: "Overview", icon: IconOverview },
      { id: "charts", label: "Charts", icon: IconCharts },
      { id: "customers", label: "Customers", icon: IconCustomers },
    ],
  },
  {
    section: "Monetización",
    items: [
      { id: "products", label: "Product catalog", icon: IconProducts },
      { id: "paywalls", label: "Paywalls", icon: IconPaywalls },
      { id: "experiments", label: "Experiments", icon: IconExperiments },
    ],
  },
];

export function MonetizationView({ projectName }: { projectName?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const page = pageFrom(searchParams.get("mn"));
  const [mobileOpen, setMobileOpen] = useState(false);

  function go(next: PageId) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "monetization");
    if (next === "overview") params.delete("mn");
    else params.set("mn", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const mobileSections: MobileNavSection[] = NAV.map((group) => ({
    label: group.section,
    items: group.items.map((item) => ({
      id: item.id,
      label: item.label,
      icon: item.icon,
      active: page === item.id,
      onClick: () => {
        go(item.id);
        setMobileOpen(false);
      },
    })),
  }));

  return (
    <div className="relative flex h-full overflow-hidden bg-[var(--background)]">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-[var(--border)] bg-white md:flex">
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: ACCENT }}>
            <MonetizationIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">{projectName || "Proyecto"}</p>
            <p className="text-[11px] text-[var(--muted)]">Monetization</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {NAV.map((group, i) => (
            <div key={group.section ?? i} className={i > 0 ? "mt-3" : ""}>
              {group.section ? (
                <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-soft)]">{group.section}</p>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavButton key={item.id} label={item.label} icon={item.icon} active={page === item.id} onClick={() => go(item.id)} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="shrink-0 border-t border-[var(--border)] px-4 py-3 text-[11px] leading-snug text-[var(--muted-soft)]">
          Sin fuente de ingresos conectada todavía.
        </p>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto p-4 pb-28 sm:p-6 md:pb-6">
        <div className="mx-auto max-w-[1400px]">
          {page === "charts" ? (
            <ChartsPage />
          ) : page === "customers" ? (
            <CustomersPage />
          ) : page === "products" ? (
            <ProductsPage />
          ) : page === "paywalls" ? (
            <PaywallsPage />
          ) : page === "experiments" ? (
            <ExperimentsPage />
          ) : (
            <OverviewPage />
          )}
        </div>
      </div>

      <MobileFabMenu
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Monetization"
        subtitle={projectName || "Workspace"}
        fabLabel="Menú de Monetization"
        fabClassName="bottom-[5.25rem] right-4"
        accent="dark"
        fabIcon={<MonetizationIcon className="h-5 w-5" />}
        sections={mobileSections}
      />
    </div>
  );
}
