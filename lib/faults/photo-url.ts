// Cloudinary resizes images on the fly when the transformation is placed in the URL.
export function getResizedPhotoUrl(url: string, width: number) {
  return url.replace("/upload/", `/upload/c_limit,w_${width},q_auto,f_auto/`);
}