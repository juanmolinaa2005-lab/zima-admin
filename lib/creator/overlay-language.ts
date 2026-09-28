export const OVERLAY_LANGUAGES = [
  { id: "es", label: "Español", flag: "🇪🇸", name: "Spanish" },
  { id: "en", label: "English", flag: "🇺🇸", name: "English" },
  { id: "pt", label: "Português", flag: "🇧🇷", name: "Portuguese" },
  { id: "fr", label: "Français", flag: "🇫🇷", name: "French" },
  { id: "de", label: "Deutsch", flag: "🇩🇪", name: "German" },
  { id: "it", label: "Italiano", flag: "🇮🇹", name: "Italian" },
  { id: "nl", label: "Nederlands", flag: "🇳🇱", name: "Dutch" },
  { id: "pl", label: "Polski", flag: "🇵🇱", name: "Polish" },
  { id: "tr", label: "Türkçe", flag: "🇹🇷", name: "Turkish" },
  { id: "ru", label: "Русский", flag: "🇷🇺", name: "Russian" },
  { id: "ar", label: "العربية", flag: "🇸🇦", name: "Arabic" },
  { id: "hi", label: "हिन्दी", flag: "🇮🇳", name: "Hindi" },
  { id: "ja", label: "日本語", flag: "🇯🇵", name: "Japanese" },
  { id: "ko", label: "한국어", flag: "🇰🇷", name: "Korean" },
  { id: "zh", label: "中文", flag: "🇨🇳", name: "Chinese" },
  { id: "id", label: "Indonesia", flag: "🇮🇩", name: "Indonesian" },
  { id: "vi", label: "Tiếng Việt", flag: "🇻🇳", name: "Vietnamese" },
  { id: "th", label: "ไทย", flag: "🇹🇭", name: "Thai" },
] as const;

export type OverlayLanguageId = (typeof OVERLAY_LANGUAGES)[number]["id"];

export function isOverlayLanguageId(value: unknown): value is OverlayLanguageId {
  return OVERLAY_LANGUAGES.some((item) => item.id === value);
}

export function normalizeOverlayLanguage(value: unknown): OverlayLanguageId {
  return isOverlayLanguageId(value) ? value : "es";
}

export function overlayLanguageName(value: unknown): string {
  const id = normalizeOverlayLanguage(value);
  return OVERLAY_LANGUAGES.find((item) => item.id === id)?.name || "Spanish";
}
