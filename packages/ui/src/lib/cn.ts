import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Gabung kelas Tailwind; kelas yang bentrok, yang terakhir menang (pola shadcn/ui). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
