import {
  createMektekTechnician,
  deleteMektekTechnician,
  updateMektekTechnician,
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
import { Separator } from "@/components/ui/separator";
import { requireAdmin } from "@/lib/auth-guards";
import {
  MEKTEK_TECHNICIAN_ROLES,
  MEKTEK_TECHNICIAN_ROLE_LABELS,
} from "@/lib/mektek/technicians";
import { prismadb } from "@/lib/prisma";
import { Save, Trash2, UserPlus, UsersRound, Wrench } from "lucide-react";

export default async function TechnicianManagementPage() {
  await requireAdmin();
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
            Perbarui identitas, peran, atau status ketersediaan setiap anggota tim.
          </p>
        </div>

        {technicians.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
                <Wrench className="size-5 text-muted-foreground" aria-hidden="true" />
              </div>
              <p className="font-medium">Belum ada data technician</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Tambahkan technician pertama melalui form di atas agar dapat ditugaskan ke service order.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {technicians.map((technician) => {
              const nameId = `technician-${technician.id}-name`;
              const roleId = `technician-${technician.id}-role`;
              const statusId = `technician-${technician.id}-status`;

              return (
                  <article
                    key={technician.id}
                    className="rounded-lg border bg-card text-card-foreground shadow-sm"
                  >
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
                            {technician.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="truncate text-base">
                              {technician.name}
                            </CardTitle>
                            <CardDescription>
                              {MEKTEK_TECHNICIAN_ROLE_LABELS[technician.role]}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={technician.isActive ? "default" : "outline"}>
                          {technician.isActive ? "Aktif" : "Tidak aktif"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <form
                        action={updateMektekTechnician}
                        className="grid gap-4 sm:grid-cols-2"
                      >
                        <input type="hidden" name="id" value={technician.id} />
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor={nameId}>Nama technician</Label>
                          <Input
                            id={nameId}
                            name="name"
                            defaultValue={technician.name}
                            required
                            maxLength={120}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={roleId}>Peran</Label>
                          <Select name="role" defaultValue={technician.role} required>
                            <SelectTrigger id={roleId}>
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
                        <div className="space-y-2">
                          <Label htmlFor={statusId}>Status</Label>
                          <Select
                            name="isActive"
                            defaultValue={String(technician.isActive)}
                          >
                            <SelectTrigger id={statusId}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Aktif</SelectItem>
                              <SelectItem value="false">Tidak aktif</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end sm:col-span-2">
                          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
                            <Save data-icon="inline-start" />
                            Simpan perubahan
                          </Button>
                        </div>
                      </form>

                      <Separator />

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-medium">Hapus technician</p>
                          <p className="text-xs text-muted-foreground">
                            Gunakan hanya bila data ini tidak lagi diperlukan.
                          </p>
                        </div>
                        <form action={deleteMektekTechnician}>
                          <input type="hidden" name="id" value={technician.id} />
                          <Button
                            type="submit"
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 data-icon="inline-start" />
                            Hapus
                          </Button>
                        </form>
                      </div>
                    </CardContent>
                  </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
