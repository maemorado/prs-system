"use client";

import { SidebarShell, type SidebarSection } from "@/src/components/shared/sidebar-shell";
import {
  ClipboardList,
  FilePlus2,
  LayoutDashboard,
  User,
} from "lucide-react";

const sections: SidebarSection[] = [
  {
    items: [
      { name: "Dashboard", href: "/employee/dashboard", icon: LayoutDashboard },
      { name: "My Requests", href: "/employee/requests", exact: true, icon: ClipboardList },
      { name: "Create Request", href: "/employee/requests/create", exact: true, icon: FilePlus2 },
    ],
  },
  {
    label: "Account",
    items: [{ name: "Profile", href: "/employee/profile", icon: User }],
  },
];

export default function Sidebar({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell sections={sections} roleLabel="Employee">
      {children}
    </SidebarShell>
  );
}