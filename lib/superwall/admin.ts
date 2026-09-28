const BASE = "https://api.superwall.com/v2";

export type SuperwallOrg = {
  id: string | number;
  name: string;
};

export type SuperwallApplication = {
  id: string;
  name: string;
  platform: string;
  projectId: string;
  projectName: string;
};

export type SuperwallMetricPoint = {
  date: string;
  value: number;
};

export type SuperwallBillingReport = {
  applicationId: string;
  applicationName: string | null;
  days: number;
  grossProceeds: number;
  netProceeds: number;
  newUsers: number;
  mrr: number;
  activeSubscriptions: number;
  series: SuperwallMetricPoint[];
  fetchedAt: string;
};

async function swFetch(
  path: string,
  apiKey: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
}

export async function verifySuperwallApiKey(apiKey: string): Promise<{
  orgs: SuperwallOrg[];
}> {
  const res = await swFetch("/me/organizations", apiKey);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      res.status === 401 || res.status === 403
        ? "Invalid Superwall API key or missing scopes."
        : `Superwall error (${res.status}): ${text.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as {
    data?: Array<{ id: string | number; name?: string }>;
  } & { id?: string | number; name?: string };

  // Response may be paginated `{ data: [...] }` or a bare list.
  const list = Array.isArray(json)
    ? (json as SuperwallOrg[])
    : Array.isArray(json.data)
      ? json.data.map((o) => ({ id: o.id, name: o.name || String(o.id) }))
      : json.id != null
        ? [{ id: json.id, name: json.name || String(json.id) }]
        : [];

  if (!list.length) {
    throw new Error("No organizations found for this Superwall API key.");
  }
  return { orgs: list };
}

export async function listSuperwallApplications(
  apiKey: string,
  orgId: string
): Promise<SuperwallApplication[]> {
  const res = await swFetch(
    `/projects?organization_id=${encodeURIComponent(orgId)}&limit=100`,
    apiKey
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Could not list projects: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as {
    data?: Array<{
      id: string;
      name?: string;
      applications?: Array<{
        id: string;
        name?: string;
        platform?: string;
        archived_at?: string | null;
      }>;
    }>;
  };

  const apps: SuperwallApplication[] = [];
  for (const project of json.data ?? []) {
    for (const app of project.applications ?? []) {
      if (app.archived_at) continue;
      apps.push({
        id: String(app.id),
        name: app.name || `App ${app.id}`,
        platform: app.platform || "unknown",
        projectId: String(project.id),
        projectName: project.name || project.id,
      });
    }
  }
  return apps;
}

type ChartDataResponse = {
  data?: Array<{
    x: string;
    values?: Record<string, { y?: number }>;
  }>;
  series?: Array<{ key: string | null }>;
};

function datePreset(days: number) {
  if (days <= 7) return "last_7_days" as const;
  if (days <= 30) return "last_30_days" as const;
  return "last_90_days" as const;
}

function axesForMetric(yAxis: string): {
  x_axis: string;
  dimension: "purchaseDate" | "installDate" | "mrrDate" | "tsDate";
} {
  if (yAxis === "mrr" || yAxis === "arr") {
    return { x_axis: "mrrDate", dimension: "mrrDate" };
  }
  if (yAxis === "newUsers") {
    return { x_axis: "installDate", dimension: "installDate" };
  }
  if (yAxis === "activeSubscriptions") {
    return { x_axis: "mrrDate", dimension: "mrrDate" };
  }
  return { x_axis: "purchaseDate", dimension: "purchaseDate" };
}

async function queryChartMetric(
  apiKey: string,
  applicationId: string,
  yAxis: string,
  days: number,
  dateInterval: "day" | "totals" = "totals"
): Promise<{ total: number; series: SuperwallMetricPoint[] }> {
  const { x_axis, dimension } = axesForMetric(yAxis);
  const body = {
    application_id: applicationId,
    x_axis,
    y_axis: yAxis,
    date_interval: dateInterval,
    date_filter: {
      dimension,
      preset: datePreset(days),
    },
    environment: ["PRODUCTION"],
    max_data_points: 400,
  };

  const res = await swFetch("/charts/data", apiKey, {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const retry = await swFetch("/charts/data", apiKey, {
      method: "POST",
      body: JSON.stringify({ ...body, environment: undefined }),
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Chart query failed (${yAxis}): ${text.slice(0, 180)}`);
    }
    return parseChart(await retry.json());
  }

  return parseChart(await res.json());
}

function parseChart(json: ChartDataResponse): {
  total: number;
  series: SuperwallMetricPoint[];
} {
  const seriesKey = json.series?.[0]?.key ?? null;
  const points: SuperwallMetricPoint[] = [];
  let total = 0;

  for (const row of json.data ?? []) {
    const values = row.values || {};
    const key =
      seriesKey != null && values[seriesKey]
        ? seriesKey
        : Object.keys(values)[0];
    const y = key != null ? Number(values[key]?.y ?? 0) : 0;
    points.push({ date: row.x, value: y });
    total += y;
  }

  return { total, series: points };
}

async function queryChartSafe(
  apiKey: string,
  applicationId: string,
  yAxis: string,
  days: number,
  dateInterval: "day" | "totals" = "totals"
): Promise<{ total: number; series: SuperwallMetricPoint[] }> {
  try {
    return await queryChartMetric(apiKey, applicationId, yAxis, days, dateInterval);
  } catch {
    return { total: 0, series: [] };
  }
}

export async function fetchSuperwallBillingReport(
  apiKey: string,
  applicationId: string,
  days = 7,
  applicationName: string | null = null
): Promise<SuperwallBillingReport> {
  const [gross, net, users, mrr, active, daily] = await Promise.all([
    queryChartSafe(apiKey, applicationId, "grossProceeds", days, "totals"),
    queryChartSafe(apiKey, applicationId, "netProceeds", days, "totals"),
    queryChartSafe(apiKey, applicationId, "newUsers", days, "totals"),
    queryChartSafe(apiKey, applicationId, "mrr", days, "totals"),
    queryChartSafe(apiKey, applicationId, "activeSubscriptions", days, "totals"),
    queryChartSafe(apiKey, applicationId, "netProceeds", days, "day"),
  ]);

  return {
    applicationId,
    applicationName,
    days,
    grossProceeds: gross.total,
    netProceeds: net.total,
    newUsers: users.total,
    mrr: mrr.total,
    activeSubscriptions: active.total,
    series: daily.series,
    fetchedAt: new Date().toISOString(),
  };
}
