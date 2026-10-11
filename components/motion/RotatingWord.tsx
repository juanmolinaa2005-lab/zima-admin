"use client";

import { useEffect, useState } from "react";

export function RotatingWord({ words, interval = 2200, className }: { words: string[]; interval?: number; className?: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), interval);
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  return (
    <span className={className} aria-live="off">
      <span key={index} className="ui-word">
        {words[index]}
      </span>
    </span>
  );
}
