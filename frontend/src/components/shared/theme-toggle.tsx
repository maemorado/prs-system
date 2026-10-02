"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark theme toggle built on the app's existing `next-themes` provider
 * (`app/providers.tsx`, storage key `prs-theme`), so the selected theme is
 * persisted and restored across reloads by next-themes itself.
 *
 * This is deliberately a plain button rather than a dropdown menu:
 *
 * - A `DropdownMenu` renders through a portal inside a floating-ui
 *   `Positioner`. In the app shell that toggle is also rendered inside the
 *   mobile navigation `Sheet` (a modal dialog with focus trapping and
 *   `aria-hidden` management for everything outside it). A portalled menu
 *   opened from inside that dialog mounts *outside* the dialog subtree, which
 *   the two Base UI primitives disagree about. That surfaced to users as an
 *   uncaught client exception, which Next.js renders with its built-in
 *   "This page couldn't load" error boundary (this app has no `error.tsx` or
 *   `global-error.tsx` to catch it first).
 * - A button has no portal, no positioner, and no dialog interaction, so it
 *   cannot break rendering in any of those containers.
 *
 * The button reflects the currently *resolved* theme, so when the stored
 * preference is `system` it toggles relative to whatever the OS is actually
 * showing rather than jumping to the opposite of the raw setting.
 */

// Hydration-safe "am I mounted yet?" check.
//
// Returning false during server render and hydration, then true afterwards,
// keeps the first client render identical to the server markup so React never
// reports a hydration mismatch when the icon flips to match the stored theme.
// `subscribe` is a no-op because the value only ever flips once, after
// hydration.
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  // Before hydration the real theme is unknown, so render the same markup the
  // server produced and let the post-hydration update swap the icon.
  const isDark = mounted && resolvedTheme === "dark";
  const nextTheme = isDark ? "light" : "dark";
  const label = mounted ? `Switch to ${nextTheme} mode` : "Toggle theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(nextTheme)}
      title={label}
      aria-label={label}
      aria-pressed={mounted ? isDark : undefined}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}

      <span className="sr-only">{label}</span>
    </Button>
  );
}