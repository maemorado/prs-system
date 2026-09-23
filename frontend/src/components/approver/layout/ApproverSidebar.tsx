"use client";

import { SidebarShell, type SidebarSection } from "@/src/components/shared/sidebar-shell";
import {
  Building2,
  ClipboardCheck,
  History,
  LayoutDashboard,
  Tags,
  User,
  Users,
} from "lucide-react";

const sections: SidebarSection[] = [
  {
    items: [
      { name: "Dashboard", href: "/approver/dashboard", exact: true, icon: LayoutDashboard },
      { name: "Purchase Requests", href: "/approver/requests", exact: true, icon: ClipboardCheck },
    ],
  },
  {
    label: "Administration",
    items: [
      { name: "Users", href: "/approver/users", exact: true, icon: Users },
      { name: "Departments", href: "/approver/departments", exact: true, icon: Building2 },
      { name: "Categories", href: "/approver/categories", exact: true, icon: Tags },
      { name: "History Logs", href: "/approver/logs", exact: true, icon: History },
    ],
  },
  {
    label: "Account",
    items: [{ name: "Profile", href: "/approver/profile", exact: true, icon: User }],
  },
];

export default function ApproverSidebar({ children }: { children: React.ReactNode }) {
  return (
    <SidebarShell sections={sections} roleLabel="Approver">
      {children}
    </SidebarShell>
  );
}