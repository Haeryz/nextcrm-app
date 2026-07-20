import {
  createMektekTechnician,
  deleteMektekTechnician,
  updateMektekTechnician,
} from "@/actions/mektek/technicians";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth-guards";
import {
  MEKTEK_TECHNICIAN_ROLES,
  MEKTEK_TECHNICIAN_ROLE_LABELS,
} from "@/lib/mektek/technicians";
import { prismadb } from "@/lib/prisma";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default async function TechnicianManagementPage() {
  await requireAdmin();
  const technicians = await prismadb.mektekTechnician.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Technician</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Kelola daftar mekanik, helper, dan peserta OJT untuk penugasan service order.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-medium">Tambah technician</h2>
        <form action={createMektekTechnician} className="grid gap-3 sm:grid-cols-[1fr_220px_auto]">
          <Input name="name" placeholder="Nama technician" required maxLength={120} />
          <select name="role" className={selectClass} defaultValue="MECHANIC" required>
            {MEKTEK_TECHNICIAN_ROLES.map((role) => (
              <option key={role} value={role}>
                {MEKTEK_TECHNICIAN_ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          <Button type="submit">Tambah</Button>
        </form>
      </section>

      <section className="space-y-4">
        {technicians.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Belum ada data technician.
          </div>
        ) : (
          technicians.map((technician) => (
            <article key={technician.id} className="rounded-lg border bg-card p-5">
              <form action={updateMektekTechnician} className="grid gap-3 sm:grid-cols-[1fr_180px_150px_auto]">
                <input type="hidden" name="id" value={technician.id} />
                <Input name="name" defaultValue={technician.name} required maxLength={120} />
                <select name="role" className={selectClass} defaultValue={technician.role} required>
                  {MEKTEK_TECHNICIAN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {MEKTEK_TECHNICIAN_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
                <select name="isActive" className={selectClass} defaultValue={String(technician.isActive)}>
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
                <Button type="submit" variant="secondary">Simpan</Button>
              </form>
              <div className="mt-3 flex justify-end">
                <form action={deleteMektekTechnician}>
                  <input type="hidden" name="id" value={technician.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    Hapus
                  </Button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
