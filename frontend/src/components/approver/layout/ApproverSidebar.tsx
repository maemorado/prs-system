"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

const navigation = [
  {
    name: "Dashboard",
    href: "/approver/dashboard",
    exact: true,
  },
  {
    name: "Requests",
    href: "/approver/requests",
    exact: true,
  },
  {
    name: "Profile",
    href: "/approver/profile",
    exact: true,
  },
];

export default function ApproverSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      return;
    }

    router.push("/auth/login");
    router.refresh();
  }

  return (
    <aside
      style={{
        width: 240,
        minHeight: "100vh",
        borderRight: "1px solid #ddd",
        padding: 20,
      }}
    >
      <h2>Purchase System</h2>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 30,
        }}
      >
        {navigation.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "10px 12px",
                textDecoration: "none",
                borderRadius: 6,
                background: active ? "#e8f5e9" : "transparent",
                color: "#222",
              }}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={handleLogout}
        style={{
          marginTop: 40,
          width: "100%",
          padding: 10,
        }}
      >
        Logout
      </button>
    </aside>
  );
}
