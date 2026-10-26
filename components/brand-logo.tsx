import Image from "next/image";
import { brandAssets } from "@/lib/brand";

// Full logo that switches with the theme.
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src={brandAssets.logoForLightMode}
        alt="Altrex"
        width={1920}
        height={338}
        className={`h-7 w-auto self-start dark:hidden ${className ?? ""}`}
      />
      <Image
        src={brandAssets.logoForDarkMode}
        alt="Altrex"
        width={1920}
        height={338}
        className={`hidden h-7 w-auto self-start dark:block ${className ?? ""}`}
      />
    </>
  );
}

// Small icon, shown when the sidebar is collapsed.
export function BrandMark() {
  return (
    <Image
      src={brandAssets.favicon}
      alt="Altrex"
      width={32}
      height={32}
      className="size-7"
    />
  );
}