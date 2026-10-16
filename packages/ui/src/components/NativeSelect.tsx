import { ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** `<select>` bawaan browser bergaya platform — aksesibel & ringan untuk daftar panjang (mis. zona waktu). */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="native-select"
        className={cn(
          "h-9 w-full appearance-none rounded-md border border-input bg-background pr-8 pl-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
