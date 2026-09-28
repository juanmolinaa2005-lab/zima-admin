export async function fileToAppDemoImageValue(file: File): Promise<string> {
  const type = (file.type || "").toLowerCase();
  if (!type.startsWith("image/")) {
    throw new Error("Elige una imagen (PNG, JPG o WebP).");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("La foto es demasiado pesada (máx. 12 MB).");
  }

  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("No se pudo leer la imagen.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.86;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 520_000 && quality > 0.48) {
    quality -= 0.08;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  return data;
}
