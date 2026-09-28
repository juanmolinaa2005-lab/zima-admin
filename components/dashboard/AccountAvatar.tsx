"use client";

import { useState } from "react";

export function AccountAvatar({
  src,
  label,
  color,
  size = 28,
}: {
  src?: string | null;
  label: string;
  color?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const letter = (label.replace(/^@/, "").trim().slice(0, 1) || "?").toUpperCase();
  const showImg = Boolean(src) && !broken;
  return (
    <span
      className="relative shrink-0 overflow-hidden rounded-full"
      style={{
        width: size,
        height: size,
        background: showImg ? "#e5e7eb" : color || "#6b7280",
      }}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-bold text-white"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {letter}
        </span>
      )}
    </span>
  );
}
