// Phone photos are often 5-10 MB. Shrinking them first makes the upload fast on mobile data.
export async function compressImage(file: File, maxSide = 1600, quality = 0.82) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("The image could not be compressed.");

  return new File([blob], "fault-photo.jpg", { type: "image/jpeg" });
}