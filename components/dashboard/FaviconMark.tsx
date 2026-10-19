"use client";

import { useState } from "react";
import { faviconUrl } from "@/lib/favicon";

export function FaviconMark({
  url,
  iconUrl,
  name,
  className = "h-full w-full",
  imgClassName = "h-full w-full object-contain p-1.5",
}: {
  url?: string;
  iconUrl?: string | null;
  name?: string;
  className?: string;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = faviconUrl(url);
  const letter = (name?.trim()[0] || "?").toUpperCase();
  const customBroken = Boolean(iconUrl && failed.includes(iconUrl));
  const broken = Boolean(src && failed.includes(src));
  const fail = (u: string) => setFailed((prev) => [...prev, u]);

  if (iconUrl && !customBroken) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => fail(iconUrl)}
        />
      </span>
    );
  }

  if (src && !broken) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          className={imgClassName}
          onError={() => fail(src)}
        />
      </span>
    );
  }

  return (
    <span
      className={`flex items-center justify-center bg-[var(--surface-alt)] text-[12px] font-bold text-[var(--muted)] ${className}`}
    >
      {letter}
    </span>
  );
}
