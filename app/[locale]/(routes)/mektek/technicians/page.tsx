import {
  createMektekTechnician,
} from "@/actions/mektek/technicians";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requireMektekCustomerServiceStaff } from "@/lib/auth-guards";
import {
  MEKTEK_TECHNICIAN_ROLES,
  MEKTEK_TECHNICIAN_ROLE_LABELS,
} from "@/lib/mektek/technicians";
import { prismadb } from "@/lib/prisma";
import { TechnicianDirectory } from "./_components/TechnicianDirectory";
import { UserPlus, UsersRound } from "lucide-react";

export default async function TechnicianManagementPage() {
  await requireMektekCustomerServiceStaff();
  const technicians = await prismadb.mektekTechnician.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
  const activeTechnicianCount = technicians.filter(
    (technician) => technician.isActive,
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Technician</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Kelola mekanik, helper, dan peserta OJT yang dapat dipilih saat membuat service order.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2" aria-label="Ringkasan technician">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5">
            <UsersRound className="size-3.5" aria-hidden="true" />
            {activeTechnicianCount} Technician aktif
          </Badge>
          <Badge variant="outline" className="px-3 py-1.5">
            {technicians.length} total
          </Badge>
        </div>
      </header>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle className="text-lg">Tambah technician</CardTitle>
              <CardDescription className="mt-1">
                Masukkan nama dan peran utama technician baru.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form
            action={createMektekTechnician}
            className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end"
          >
            <div className="space-y-2">
              <Label htmlFor="new-technician-name">Nama technician</Label>
              <Input
                id="new-technician-name"
                name="name"
                placeholder="Contoh: Ahmad Fauzan"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-technician-role">Peran</Label>
              <Select name="role" defaultValue="MECHANIC" required>
                <SelectTrigger id="new-technician-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEKTEK_TECHNICIAN_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {MEKTEK_TECHNICIAN_ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full md:w-auto">
              <UserPlus data-icon="inline-start" />
              Tambah technician
            </Button>
          </form>
        </CardContent>
      </Card>

      <section aria-labelledby="technician-directory-title" className="space-y-4">
        <div>
          <h2 id="technician-directory-title" className="text-lg font-semibold">
            Daftar Technician
          </h2>
          <p className="text-sm text-muted-foreground">
            Klik kartu technician untuk melihat detail dan mengubah data.
          </p>
        </div>

        <TechnicianDirectory technicians={technicians} />
      </section>
    </main>
  );
}
