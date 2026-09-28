"use client";

import { useEffect, useState } from "react";
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
  const [customBroken, setCustomBroken] = useState(false);
  const [broken, setBroken] = useState(false);
  const src = faviconUrl(url);
  const letter = (name?.trim()[0] || "?").toUpperCase();

  useEffect(() => {
    setCustomBroken(false);
  }, [iconUrl]);

  if (iconUrl && !customBroken) {
    return (
      <span className={`flex items-center justify-center ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={iconUrl}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setCustomBroken(true)}
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
          onError={() => setBroken(true)}
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
