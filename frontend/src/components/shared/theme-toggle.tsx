"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Check, Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";

const options = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

// Hydration-safe "am I mounted yet?" check.
//
// Returning false on the server and true on the client avoids the
// server/client markup mismatch, without scheduling an extra render from an
// effect. `subscribe` is a no-op because the value only ever flips once,
// after hydration.
const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );

  const current = (mounted ? resolvedTheme ?? theme : "system") as
    | "light"
    | "dark"
    | "system";

  const CurrentIcon =
    options.find((option) => option.value === current)?.icon ?? Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            title="Toggle theme"
            aria-label="Toggle theme"
          />
        }
      >
        <CurrentIcon className="size-4" />

        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={6}>
        <DropdownMenuLabel>Theme</DropdownMenuLabel>

        <DropdownMenuSeparator />

        {options.map((option) => {
          const Icon = option.icon;

          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme(option.value)}
              className={cn(
                mounted && theme === option.value && "bg-accent text-accent-foreground"
              )}
            >
              <Icon className="size-4" />

              {option.label}

              {mounted && theme === option.value && (
                <Check className="ml-auto size-4" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
