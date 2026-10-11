const ASPECT_OPTIONS = [
  { value: "9:16", label: "Vertical", hint: "Reels / TikTok / Stories" },
  { value: "16:9", label: "Horizontal", hint: "YouTube / landscape" },
  { value: "1:1", label: "Square", hint: "Feed" },
  { value: "4:3", label: "Classic", hint: "4:3" },
  { value: "3:4", label: "Portrait", hint: "3:4" },
] as const;

export type AspectRatio = (typeof ASPECT_OPTIONS)[number]["value"];

function AspectShape({
  ratio,
  active = false,
}: {
  ratio: string;
  active?: boolean;
}) {
  const dims: Record<string, { w: number; h: number }> = {
    "9:16": { w: 16, h: 28 },
    "16:9": { w: 28, h: 16 },
    "1:1": { w: 22, h: 22 },
    "4:3": { w: 26, h: 20 },
    "3:4": { w: 20, h: 26 },
  };
  const { w, h } = dims[ratio] ?? { w: 22, h: 22 };

  return (
    <span
      className={`inline-block rounded-[5px] border-2 transition ${
        active
          ? "border-[var(--accent)] bg-[var(--surface-alt)]"
          : "border-[#d6d3d1] bg-[#f5f5f4]"
      }`}
      style={{ width: w, height: h }}
      aria-hidden
    />
  );
}

export function AspectFormatPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: AspectRatio) => void;
}) {
  const current = ASPECT_OPTIONS.find((o) => o.value === value) ?? ASPECT_OPTIONS[0];

  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {ASPECT_OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              title={`${opt.label} · ${opt.hint}`}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border px-1 py-2.5 transition ${
                active
                  ? "border-[#8b85ff] bg-[var(--surface-alt)]"
                  : "border-[#ebe6df] bg-white text-[#78716c] hover:border-[var(--accent-border)]"
              }`}
            >
              <AspectShape ratio={opt.value} active={active} />
              <span
                className={`text-[10px] font-semibold ${
                  active ? "text-[var(--accent)]" : "text-[#78716c]"
                }`}
              >
                {opt.value}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-[#a8a29e]">
        {current.label} · {current.hint}
      </p>
    </div>
  );
}
