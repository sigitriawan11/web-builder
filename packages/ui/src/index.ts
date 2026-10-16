// @platform/ui: komponen UI platform (shadcn/ui + Radix + Tailwind, ikon Lucide) — chrome dashboard/admin/editor,
// bukan UI situs user (ARCHITECTURE §4.2, ED-012). Gaya & token: `@platform/ui/styles.css`.
export { Alert, AlertDescription, AlertTitle } from "./components/Alert";
export { Avatar, AvatarFallback, AvatarImage, initials } from "./components/Avatar";
export { Badge } from "./components/Badge";
export { Button, type ButtonProps, buttonVariants } from "./components/Button";
export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./components/Card";
export { Checkbox } from "./components/Checkbox";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/Dialog";
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./components/DropdownMenu";
export { Input } from "./components/Input";
export { Label } from "./components/Label";
export { Separator } from "./components/Separator";
export { ThemeSwitcher, type ThemeSwitcherProps } from "./components/ThemeSwitcher";
export { cn } from "./lib/cn";
export {
  applyThemePreference,
  isThemePreference,
  THEME_COOKIE,
  THEME_PREFERENCES,
  type ThemePreference,
  themeClassName,
} from "./theme";
