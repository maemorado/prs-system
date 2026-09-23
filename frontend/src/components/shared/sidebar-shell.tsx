"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { cn } from "cn";
import {
  LogOut,
  Menu,
  Package,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

export type SidebarItem = {
  name: string;
  href: string;
  exact?: boolean;
  icon: LucideIcon;
};

export type SidebarSection = {
  label?: string;
  items: SidebarItem[];
};

function isActive(pathname: string, item: SidebarItem) {
  return item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Package className="size-4" />
      </span>

      <div className="leading-tight">
        <p className="text-sm font-semibold text-foreground">Purchase</p>
        <p className="text-xs text-muted-foreground">Request System</p>
      </div>
    </div>
  );
}

function SidebarNav({
  sections,
  onNavigate,
}: {
  sections: SidebarSection[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5">
      {sections.map((section, index) => (
        <div key={index} className="flex flex-col gap-1">
          {section.label && (
            <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground/80 uppercase">
              {section.label}
            </p>
          )}

          {section.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.name}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserFooter({ roleLabel }: { roleLabel: string }) {
  const router = useRouter();

  const [label, setLabel] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled || !user) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      setLabel({
        name: profile?.full_name ?? "User",
        email: user.email ?? "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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

  const name = label?.name ?? "User";
  const initials = name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3 border-t border-border p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
        {initials}
      </span>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{roleLabel}</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={handleLogout}
        aria-label="Log out"
        title="Log out"
      >
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}

function MobileHeader({
  sections,
  roleLabel,
}: {
  sections: SidebarSection[];
  roleLabel: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={<Button variant="ghost" size="icon" aria-label="Open menu" />}
        >
          <Menu className="size-5" />
        </SheetTrigger>

        <SheetContent side="left" className="w-72 gap-4 p-0">
          <SheetTitle className="sr-only">
            {roleLabel} navigation menu
          </SheetTitle>

          <div className="flex h-full flex-col">
            <div className="border-b border-border p-4">
              <Brand />
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              <SidebarNav sections={sections} onNavigate={() => setOpen(false)} />
            </div>

            <UserFooter roleLabel={roleLabel} />
          </div>
        </SheetContent>
      </Sheet>

      <Brand />
    </header>
  );
}

export function SidebarShell({
  sections,
  roleLabel,
  children,
}: {
  sections: SidebarSection[];
  roleLabel: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-sidebar lg:flex">
        <div className="p-4">
          <Brand />
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav sections={sections} />
        </div>

        <UserFooter roleLabel={roleLabel} />
      </aside>

      <div className="min-h-dvh">
        <MobileHeader sections={sections} roleLabel={roleLabel} />

        <main className="px-4 py-6 sm:px-6 lg:pl-[272px] lg:pr-8 lg:py-8">
          {children}
        </main>
      </div>
    </>
  );
}