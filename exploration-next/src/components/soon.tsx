import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";

// Placeholder until the tab is ported (see the migration plan, phases 2 and 3).
export function Soon({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle><CardDescription>Tab ini belum dipindah ke aplikasi baru. Gunakan versi 2.0 untuk sementara.</CardDescription></CardHeader>
    </Card>
  );
}
