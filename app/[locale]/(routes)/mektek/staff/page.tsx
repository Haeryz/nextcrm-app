import {
  createSubAdmin,
  deleteSubAdmin,
  updateSubAdmin,
} from "@/actions/auth/sub-admins";
import { Input } from "@/components/ui/input";
import { requireAdmin } from "@/lib/auth-guards";
import { prismadb } from "@/lib/prisma";
import StaffActionForm from "./_components/StaffActionForm";
import StaffDivisionFields from "./_components/StaffDivisionFields";
import StaffSubmitButton from "./_components/StaffSubmitButton";

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export default async function StaffManagementPage() {
  await requireAdmin();
  const staff = await prismadb.users.findMany({
    where: { is_admin: false, staffDivision: { not: null } },
    orderBy: [{ staffDivision: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      staffDivision: true,
      logisticsStaffArea: true,
      userStatus: true,
      lastLoginAt: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Sub-admin &amp; Divisi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hanya main admin yang dapat membuat dan mengelola account ini.
          Akses Logistics dibatasi ke Catalog dan bagian yang ditetapkan; matriks
          pembatasan divisi lain masih dalam tahap penyusunan.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-medium">Tambah sub-admin</h2>
        <StaffActionForm
          action={createSubAdmin}
          successMessage="Sub-admin berhasil dibuat."
          resetOnSuccess
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"
        >
          <Input name="name" placeholder="Nama" required maxLength={120} />
          <Input name="email" type="email" placeholder="Email" required />
          <Input
            name="password"
            type="password"
            placeholder="Password (min. 12)"
            required
            minLength={12}
            maxLength={50}
          />
          <StaffDivisionFields />
          <StaffSubmitButton
            idleLabel="Buat sub-admin"
            pendingLabel="Membuat..."
          />
        </StaffActionForm>
      </section>

      <section className="space-y-4">
        {staff.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            Belum ada sub-admin.
          </div>
        ) : (
          staff.map((member) => (
            <article key={member.id} className="rounded-lg border bg-card p-5">
              <StaffActionForm
                action={updateSubAdmin}
                successMessage="Perubahan sub-admin berhasil disimpan."
                className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"
              >
                <input type="hidden" name="id" value={member.id} />
                <Input name="name" defaultValue={member.name ?? ""} required />
                <Input name="email" type="email" defaultValue={member.email} required />
                <StaffDivisionFields
                  defaultDivision={member.staffDivision}
                  defaultLogisticsArea={member.logisticsStaffArea}
                />
                <select
                  name="userStatus"
                  className={selectClass}
                  defaultValue={member.userStatus}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
                <StaffSubmitButton
                  idleLabel="Simpan perubahan"
                  pendingLabel="Menyimpan..."
                  variant="secondary"
                />
              </StaffActionForm>
              <div className="mt-3 flex items-center justify-between gap-4 text-xs text-muted-foreground">
                <span>
                  Login terakhir: {member.lastLoginAt?.toLocaleString("id-ID") ?? "Belum pernah"}
                </span>
                <StaffActionForm
                  action={deleteSubAdmin}
                  successMessage="Sub-admin berhasil dihapus."
                >
                  <input type="hidden" name="id" value={member.id} />
                  <StaffSubmitButton
                    idleLabel="Hapus"
                    pendingLabel="Menghapus..."
                    variant="destructive"
                    size="sm"
                  />
                </StaffActionForm>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
