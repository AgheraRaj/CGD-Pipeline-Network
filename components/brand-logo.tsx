import Image from "next/image";
import { brandAssets } from "@/lib/brand";

// Full logo that switches with the theme.
export function BrandLogo({ className }: { className?: string }) {
  return (
    <>
      <Image
        src={brandAssets.logoForLightMode}
        alt="Altrex"
        width={140}
        height={32}
        loading="eager"
        className={`h-7 w-auto dark:hidden ${className ?? ""}`}
      />
      <Image
        src={brandAssets.logoForDarkMode}
        alt="Altrex"
        width={140}
        height={32}
        loading="eager"
        className={`hidden h-7 w-auto dark:block ${className ?? ""}`}
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