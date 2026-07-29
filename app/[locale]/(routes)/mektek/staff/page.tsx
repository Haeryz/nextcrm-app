import {
  createSubAdmin,
  deleteSubAdmin,
  updateSubAdmin,
} from "@/actions/auth/sub-admins";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth-guards";
import {
  STAFF_DIVISION_LABELS,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";
import {
  STAFF_CAPABILITY_LABELS,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { prismadb } from "@/lib/prisma";
import StaffActionForm from "./_components/StaffActionForm";
import StaffCapabilityFields from "./_components/StaffCapabilityFields";
import StaffPasswordField from "./_components/StaffPasswordField";
import StaffSubmitButton from "./_components/StaffSubmitButton";

const LOGISTICS_STAFF_AREA_LABELS: Record<LogisticsStaffArea, string> = {
  MONITORING_PO: "Monitoring PO",
  RECEIVING: "Receiving",
};

// A user counts as "online" while their session is actively touching the server.
// The session callback (lib/auth.ts) refreshes `lastLoginAt` roughly every 5
// minutes, so a 10-minute window tolerates that granularity without showing
// stale users as online.
const ONLINE_THRESHOLD_MS = 10 * 60_000;
const isOnline = (lastLoginAt: Date | null) =>
  !!lastLoginAt && Date.now() - lastLoginAt.getTime() < ONLINE_THRESHOLD_MS;
const onlineCutoff = () => new Date(Date.now() - ONLINE_THRESHOLD_MS);

export default async function StaffManagementPage() {
  await requireAdmin();
  const staff = await prismadb.users.findMany({
    where: {
      is_admin: false,
      OR: [
        { staffDivision: { not: null } },
        { staffCapabilities: { isEmpty: false } },
      ],
    },
    orderBy: [{ staffDivision: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      staffDivision: true,
      logisticsStaffArea: true,
      staffCapabilities: true,
      userStatus: true,
      lastLoginAt: true,
    },
  });

  const onlineStaff = await prismadb.users.findMany({
    where: {
      lastLoginAt: { gte: onlineCutoff() },
      userStatus: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
      is_admin: true,
      mektekRole: true,
      staffDivision: true,
      lastLoginAt: true,
    },
    orderBy: { lastLoginAt: "desc" },
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">Sub-admin & Divisi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Hanya main admin yang dapat membuat dan mengelola account ini. Pilih
          kapabilitas akses sub-admin — main admin selalu memiliki akses penuh.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-5">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <h2 className="text-lg font-medium">Staf online</h2>
          <Badge variant="secondary" className="text-xs">
            {onlineStaff.length}
          </Badge>
        </div>
        {onlineStaff.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Tidak ada staf online saat ini.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {onlineStaff.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="inline-flex size-2 rounded-full bg-emerald-500" />
                <span className="font-medium">{member.name ?? member.email}</span>
                {member.is_admin && (
                  <Badge variant="default" className="text-xs">
                    Main admin
                  </Badge>
                )}
                <span className="text-muted-foreground">{member.email}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="mb-4 text-lg font-medium">Tambah sub-admin</h2>
        <StaffActionForm
          action={createSubAdmin}
          successMessage="Sub-admin berhasil dibuat."
          resetOnSuccess
          className="grid gap-3 md:grid-cols-2 lg:grid-cols-6"
        >
          {/* Labels, not placeholders: a placeholder disappears the moment the user
              types, which for the password field took the "min. 8" rule with it. */}
          <div className="space-y-1.5">
            <Label htmlFor="new-subadmin-name">Nama</Label>
            <Input
              id="new-subadmin-name"
              name="name"
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-subadmin-email">Email</Label>
            <Input
              id="new-subadmin-email"
              name="email"
              type="email"
              required
            />
          </div>
          <StaffPasswordField />
          <StaffCapabilityFields />
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
                {/* Inline edit row: aria-label rather than a visible Label, so the
                    6-column grid stays aligned across every staff card. */}
                <Input
                  name="name"
                  defaultValue={member.name ?? ""}
                  required
                  aria-label={`Nama sub-admin ${member.email}`}
                />
                <Input
                  name="email"
                  type="email"
                  defaultValue={member.email}
                  required
                  aria-label={`Email sub-admin ${member.email}`}
                />
                <StaffCapabilityFields
                  defaultCapabilities={member.staffCapabilities}
                />
                <StaffSubmitButton
                  idleLabel="Simpan perubahan"
                  pendingLabel="Menyimpan..."
                  variant="secondary"
                />
              </StaffActionForm>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-2">
                  {isOnline(member.lastLoginAt) && (
                    <Badge className="gap-1 text-xs">
                      <span className="inline-flex size-1.5 rounded-full bg-emerald-400" />
                      Online
                    </Badge>
                  )}
                  <span>
                    Login terakhir: {member.lastLoginAt?.toLocaleString("id-ID") ?? "Belum pernah"}
                  </span>
                  {member.staffDivision && (
                    <Badge variant="outline" className="text-xs">
                      Divisi: {STAFF_DIVISION_LABELS[member.staffDivision]}
                      {member.logisticsStaffArea
                        ? ` · ${LOGISTICS_STAFF_AREA_LABELS[member.logisticsStaffArea]}`
                        : ""}
                    </Badge>
                  )}
                  <Badge
                    variant={member.userStatus === "ACTIVE" ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {member.userStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>
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
