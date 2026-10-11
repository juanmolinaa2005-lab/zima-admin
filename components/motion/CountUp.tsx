"use client";

import { useEffect, useRef, useState } from "react";

export type CountFormat = "int" | "compact" | "money";

const int = new Intl.NumberFormat("es", { maximumFractionDigits: 0, useGrouping: "always" });
const compact = new Intl.NumberFormat("es", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(n: number, format: CountFormat): string {
  if (format === "compact") return compact.format(n);
  const whole = int.format(Math.round(n));
  return format === "money" ? `$${whole}` : whole;
}

export function CountUp({
  value,
  format = "int",
  duration = 1100,
  delay = 0,
}: {
  value: number;
  format?: CountFormat;
  duration?: number;
  delay?: number;
}) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    let raf = 0;
    let t0 = 0;
    const tick = (t: number) => {
      if (!t0) t0 = t + delay;
      const p = reduce ? 1 : Math.min(1, Math.max(0, (t - t0) / duration));
      const eased = 1 - Math.pow(1 - p, 4);
      setShown(start + (value - start) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  return <span className="tabular-nums">{formatCount(shown, format)}</span>;
}
