"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";

const navigation = [
  {
    name: "Dashboard",
    href: "employee/dashboard",
  },
  {
    name: "My Requests",
    href: "/requests",
  },
  {
    name: "Create Request",
    href: "/employee/requests/create",
  },
  {
    name: "Profile",
    href: "/employee/profile",
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    await supabase.auth.signOut();

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
          const active = pathname === item.href;

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