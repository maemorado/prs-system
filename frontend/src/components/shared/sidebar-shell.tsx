"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase/client";
import { useProfile } from "@/src/components/shared/profile-provider";
import { ThemeToggle } from "@/src/components/shared/theme-toggle";
import { friendlyError } from "@/src/lib/errors";
import { cn } from "cn";
import {
  ChevronRight,
  LogOut,
  Menu,
  Package,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

/**
 * The heading shown in the desktop top bar: the label of whichever nav item
 * owns the current URL, so a detail page reports the list it came from
 * (`/employee/requests/42` still reads "My Requests").
 */
function sectionTitle(sections: SidebarSection[], pathname: string) {
  const matches = sections
    .flatMap((section) => section.items)
    .filter((item) => pathname === item.href || pathname.startsWith(item.href))
    .sort((a, b) => b.href.length - a.href.length);

  return matches[0]?.name ?? "Purchase Request System";
}

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** One logout implementation shared by the sidebar footer and the header menu. */
function useLogout() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function handleLogout() {
    if (loggingOut) {
      return;
    }

    setLoggingOut(true);
    setLogoutError("");

    const supabase = createClient();

    // `scope: "global"` revokes the refresh tokens on the server and removes
    // the persisted session cookie, so a closed-and-reopened browser lands on
    // the login page instead of silently restoring the previous user.
    const { error } = await supabase.auth.signOut({ scope: "global" });

    if (error) {
      console.error("Logout error:", error);

      setLogoutError(
        friendlyError(error, "Unable to log out. Please try again.")
      );
      setLoggingOut(false);

      return;
    }

    router.replace("/auth/login");
    router.refresh();
  }

  return { handleLogout, loggingOut, logoutError };
}

function Brand({ variant = "onDark" }: { variant?: "onDark" | "onLight" }) {
  const onDark = variant === "onDark";

  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg">
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg shadow-sm",
          onDark
            ? "bg-sidebar-primary text-sidebar-primary-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        <Package className="size-4.5" />
      </span>

      <div className="leading-tight">
        <p
          className={cn(
            "text-sm font-semibold tracking-tight",
            onDark ? "text-sidebar-accent-foreground" : "text-foreground"
          )}
        >
          Purchase
        </p>
        <p
          className={cn(
            "text-[11px]",
            onDark ? "text-sidebar-foreground/70" : "text-muted-foreground"
          )}
        >
          Request System
        </p>
      </div>
    </Link>
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
    <nav className="flex flex-col gap-6">
      {sections.map((section, index) => (
        <div key={index} className="flex flex-col gap-1">
          {section.label && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-sidebar-foreground/60 uppercase">
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
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary font-semibold text-sidebar-primary-foreground shadow-sm"
                    : "font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-4.5 shrink-0" />
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
  const { profile } = useProfile();
  const { handleLogout, loggingOut, logoutError } = useLogout();

  const name = profile?.full_name || "User";

  return (
    <div className="border-t border-sidebar-border p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-sidebar-accent-foreground">
          {initialsOf(name)}
        </span>

        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
            {name}
          </p>
          <p className="truncate text-xs text-sidebar-foreground/70">
            {roleLabel}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          title="Log out"
          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="size-4" />
        </Button>
      </div>

      {logoutError && (
        <p role="alert" className="mt-2 text-xs font-medium text-destructive">
          {logoutError}
        </p>
      )}
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-header px-4 text-header-foreground lg:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" aria-label="Open menu" />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>

        <SheetContent
          side="left"
          className="w-[272px] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">
            {roleLabel} navigation menu
          </SheetTitle>

          <div className="flex h-full flex-col">
            <div className="flex h-16 items-center border-b border-sidebar-border px-5">
              <Brand />
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <SidebarNav
                sections={sections}
                onNavigate={() => setOpen(false)}
              />
            </div>

            <UserFooter roleLabel={roleLabel} />
          </div>
        </SheetContent>
      </Sheet>

      <Brand variant="onLight" />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  );
}

function UserMenu({
  roleLabel,
  href,
}: {
  roleLabel: string;
  href?: string;
}) {
  const { profile } = useProfile();
  const { handleLogout, loggingOut } = useLogout();

  const name = profile?.full_name || "User";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto gap-2.5 rounded-full border border-border bg-card py-1 pr-3 pl-1 hover:bg-accent"
            aria-label="Account menu"
          />
        }
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          {initialsOf(name)}
        </span>

        <span className="hidden max-w-40 text-left leading-tight sm:block">
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
          </span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {roleLabel}
          </span>
        </span>

        <ChevronRight
          aria-hidden="true"
          className="size-4 rotate-90 text-muted-foreground"
        />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-foreground">
            {name}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {roleLabel}
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {href && (
          <DropdownMenuItem
            render={<Link href={href} />}
            className="cursor-pointer gap-2 py-2"
          >
            <UserIcon className="size-4" />
            Profile
          </DropdownMenuItem>
        )}

        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          disabled={loggingOut}
          className="cursor-pointer gap-2 py-2"
        >
          <LogOut className="size-4" />
          {loggingOut ? "Logging out..." : "Log out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DesktopHeader({
  title,
  roleLabel,
  href,
}: {
  title: string;
  roleLabel: string;
  href?: string;
}) {
  return (
    <header className="sticky top-0 z-30 hidden h-16 items-center gap-4 border-b border-border bg-header/95 px-6 text-header-foreground backdrop-blur md:flex lg:px-8">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm">
          <li className="text-muted-foreground">PRS</li>
          <li aria-hidden="true">
            <ChevronRight className="size-3.5 text-muted-foreground/60" />
          </li>
          <li
            aria-current="page"
            className="truncate font-semibold text-foreground"
          >
            {title}
          </li>
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <UserMenu roleLabel={roleLabel} href={href} />
      </div>
    </header>
  );
}

export function SidebarShell({
  sections,
  roleLabel,
  profileHref,
  children,
}: {
  sections: SidebarSection[];
  roleLabel: string;
  /** Where the header account menu points. Defaults to the Profile item. */
  profileHref?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const title = sectionTitle(sections, pathname);
  const profileItem = sections
    .flatMap((section) => section.items)
    .find((item) => item.name.toLowerCase() === "profile");

  return (
    <div className="min-h-dvh bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-5">
          <Brand />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <SidebarNav sections={sections} />
        </div>

        <UserFooter roleLabel={roleLabel} />
      </aside>

      <div className="flex min-h-dvh flex-col lg:pl-[264px]">
        <MobileHeader sections={sections} roleLabel={roleLabel} />

        <DesktopHeader
          title={title}
          roleLabel={roleLabel}
          href={profileHref ?? profileItem?.href}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}