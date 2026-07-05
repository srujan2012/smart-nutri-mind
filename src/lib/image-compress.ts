// Compress an image File to a data URL suitable for AI vision APIs.
// Fixes mobile scanner failures caused by 5-15MB phone camera photos.

export async function fileToCompressedDataUrl(
  file: File,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<string> {
  const maxSize = opts.maxSize ?? 1280;
  const quality = opts.quality ?? 0.82;

  const bitmap = await loadImage(file);
  const { width, height } = fit(bitmap.width, bitmap.height, maxSize);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unsupported on this device");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}

function fit(w: number, h: number, max: number) {
  if (w <= max && h <= max) return { width: w, height: h };
  const r = w > h ? max / w : max / h;
  return { width: Math.round(w * r), height: Math.round(h * r) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
