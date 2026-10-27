import { createHash } from "node:crypto";

// Signed uploads use the Cloudinary REST API directly, so no extra package is needed.
// The secret key stays on the server and is never sent to the browser.

const UPLOAD_FOLDER = "cgd-pipeline/faults";

function getConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env."
    );
  }
  return { cloudName, apiKey, apiSecret };
}

// Cloudinary signature: sorted "key=value" pairs joined by "&", then the secret, hashed with SHA-1.
function createSignature(params: Record<string, string>, apiSecret: string) {
  const payload = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export type UploadedPhoto = {
  publicId: string;
  url: string;
  width: number | null;
  height: number | null;
};

export async function uploadFaultPhoto(photo: File): Promise<UploadedPhoto> {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));

  const body = new FormData();
  body.set("file", photo);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("folder", UPLOAD_FOLDER);
  body.set("signature", createSignature({ folder: UPLOAD_FOLDER, timestamp }, apiSecret));

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body }
  );
  const result = await response.json().catch(() => null);

  if (!response.ok || !result?.public_id) {
    throw new Error(
      result?.error?.message ?? `Cloudinary upload failed with status ${response.status}.`
    );
  }

  return {
    publicId: result.public_id,
    url: result.secure_url,
    width: typeof result.width === "number" ? result.width : null,
    height: typeof result.height === "number" ? result.height : null,
  };
}

// Used to clean up when the database write fails after a successful upload.
export async function deleteFaultPhoto(publicId: string) {
  const { cloudName, apiKey, apiSecret } = getConfig();
  const timestamp = String(Math.floor(Date.now() / 1000));

  const body = new FormData();
  body.set("public_id", publicId);
  body.set("api_key", apiKey);
  body.set("timestamp", timestamp);
  body.set("signature", createSignature({ public_id: publicId, timestamp }, apiSecret));

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body,
  });
}