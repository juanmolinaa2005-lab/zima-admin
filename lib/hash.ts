export function fingerprint(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return String(hash);
}
