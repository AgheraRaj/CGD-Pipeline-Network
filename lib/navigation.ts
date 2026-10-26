import { LayoutDashboard, type LucideIcon } from "lucide-react";

export type NavigationItem = {
  title: string;
  href: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

// Add Map view, Fault reports and Notifications here as those pages are built.
export const navigation: NavigationGroup[] = [
  {
    label: "Monitoring",
    items: [{ title: "Overview", href: "/overview", icon: LayoutDashboard }],
  },
];

export function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function findNavigationItem(pathname: string) {
  return navigation
    .flatMap((group) => group.items)
    .find((item) => isActivePath(pathname, item.href));
}