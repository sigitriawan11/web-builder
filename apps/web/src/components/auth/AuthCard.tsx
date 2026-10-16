import { Card, CardContent, CardDescription, CardHeader } from "@platform/ui";
import type { ReactNode } from "react";

/** Kartu halaman auth: judul, deskripsi, isi. */
export function AuthCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <h1 className="text-lg font-semibold leading-none">{title}</h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}
