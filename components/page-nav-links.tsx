import { LayoutDashboard, Map as MapIcon, Route } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const PAGES = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Map view", icon: MapIcon },
  { href: "/pipelines", label: "Pipelines", icon: Route },
] as const;

// Quick links to the other main pages, shown in each page header.
export function PageNavLinks({ current }: { current: (typeof PAGES)[number]["href"] }) {
  return (
    <nav aria-label="Related pages" className="flex flex-wrap gap-2">
      {PAGES.filter((page) => page.href !== current).map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <page.icon className="size-4" />
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
