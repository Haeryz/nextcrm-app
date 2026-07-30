import {
  createSubAdmin,
  deleteSubAdmin,
  updateSubAdmin,
} from "@/actions/auth/sub-admins";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdmin } from "@/lib/auth-guards";
import {
  STAFF_DIVISION_LABELS,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";
import {
  STAFF_CAPABILITIES,
  STAFF_CAPABILITY_LABELS,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { prismadb } from "@/lib/prisma";
import StaffActionForm from "./_components/StaffActionForm";
import StaffCapabilityFields from "./_components/StaffCapabilityFields";
import StaffMemberCard from "./_components/StaffMemberCard";
import StaffPasswordField from "./_components/StaffPasswordField";
import StaffSubmitButton from "./_components/StaffSubmitButton";
import { ShieldCheck, Trash2, UserCheck, UserPlus, Users } from "lucide-react";

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

const initialsOf = (name: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

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
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-card text-primary shadow-sm">
          <ShieldCheck className="size-5" />
        </span>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Sub-admin & Divisi
          </h1>
          <p className="text-sm text-muted-foreground">
            Hanya main admin yang dapat membuat dan mengelola account ini.
            Pilih kapabilitas akses sub-admin — main admin selalu memiliki akses
            penuh.
          </p>
        </div>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
          </span>
          <CardTitle className="text-base font-medium">Staf online</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {onlineStaff.length}
          </Badge>
        </CardHeader>
        <CardContent>
          {onlineStaff.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Tidak ada staf online saat ini.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {onlineStaff.map((member) => (
                <li
                  key={member.id}
                  title={member.email}
                  className="flex items-center gap-2 rounded-full border bg-muted/40 py-1 pl-1 pr-3 text-sm"
                >
                  <Avatar className="size-7 text-xs">
                    <AvatarFallback className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      {initialsOf(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">
                    {member.name ?? member.email}
                  </span>
                  {member.is_admin && (
                    <Badge variant="default" className="px-1.5 py-0 text-[10px]">
                      Main admin
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-primary/[0.03]">
        <CardHeader className="flex flex-row items-center gap-2.5 space-y-0">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-4" />
          </span>
          <div className="space-y-0.5">
            <CardTitle className="text-base font-medium">
              Tambah sub-admin
            </CardTitle>
            <CardDescription className="text-xs">
              Lengkapi data, pilih kapabilitas, lalu buat akun.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <StaffActionForm
            action={createSubAdmin}
            successMessage="Sub-admin berhasil dibuat."
            resetOnSuccess
            className="grid gap-4 sm:grid-cols-2"
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
            <div className="flex justify-end sm:col-span-2">
              <StaffSubmitButton
                idleLabel="Buat sub-admin"
                pendingLabel="Membuat..."
                icon={<UserPlus className="size-4" aria-hidden="true" />}
                className="w-full sm:w-auto"
              />
            </div>
          </StaffActionForm>
        </CardContent>
      </Card>

      <section className="space-y-3">
        {staff.length === 0 ? (
          <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 size-6 opacity-60" />
            <p className="text-sm">Belum ada sub-admin.</p>
          </div>
        ) : (
          staff.map((member) => {
            const hasAllAccess =
              member.staffCapabilities != null &&
              STAFF_CAPABILITIES.every((cap) =>
                member.staffCapabilities!.includes(cap),
              );
            const divisionText = hasAllAccess
              ? "Semua divisi"
              : member.staffDivision
                ? `Divisi: ${STAFF_DIVISION_LABELS[member.staffDivision]}${
                    member.logisticsStaffArea
                      ? ` · ${LOGISTICS_STAFF_AREA_LABELS[member.logisticsStaffArea]}`
                      : ""
                  }`
                : null;

            return (
              <StaffMemberCard
                key={member.id}
                name={member.name ?? ""}
                email={member.email}
                initials={initialsOf(member.name)}
                divisionText={divisionText}
                isOnline={isOnline(member.lastLoginAt)}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={
                        member.userStatus === "ACTIVE" ? "default" : "secondary"
                      }
                      className="text-xs"
                    >
                      {member.userStatus === "ACTIVE" ? "Aktif" : "Nonaktif"}
                    </Badge>
                    <span>
                      Login terakhir:{" "}
                      {member.lastLoginAt?.toLocaleString("id-ID") ??
                        "Belum pernah"}
                    </span>
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
                      icon={<Trash2 className="size-4" aria-hidden="true" />}
                      className="w-auto"
                    />
                  </StaffActionForm>
                </div>
                <div className="mt-4 border-t pt-4">
                  <StaffActionForm
                    action={updateSubAdmin}
                    successMessage="Perubahan sub-admin berhasil disimpan."
                    className="grid gap-3 sm:grid-cols-2"
                  >
                    <input type="hidden" name="id" value={member.id} />
                    {/* Inline edit row: aria-label rather than a visible Label, so the
                        grid stays aligned across every staff card. */}
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
                    <div className="flex justify-end sm:col-span-2">
                      <StaffSubmitButton
                        idleLabel="Simpan perubahan"
                        pendingLabel="Menyimpan..."
                        variant="secondary"
                        icon={
                          <UserCheck className="size-4" aria-hidden="true" />
                        }
                        className="w-full sm:w-auto"
                      />
                    </div>
                  </StaffActionForm>
                </div>
              </StaffMemberCard>
            );
          })
        )}
      </section>
    </main>
  );
}
