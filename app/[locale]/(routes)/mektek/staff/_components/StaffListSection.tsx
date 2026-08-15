import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  STAFF_CAPABILITIES,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import {
  STAFF_DIVISION_LABELS,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import { prismadb } from "@/lib/prisma";
import {
  deleteSubAdmin,
  updateSubAdmin,
} from "@/actions/auth/sub-admins";
import StaffActionForm from "./StaffActionForm";
import StaffCapabilityFields from "./StaffCapabilityFields";
import StaffMemberCard from "./StaffMemberCard";
import StaffSubmitButton from "./StaffSubmitButton";
import { Trash2, UserCheck, Users } from "lucide-react";

const LOGISTICS_STAFF_AREA_LABELS: Record<LogisticsStaffArea, string> = {
  MONITORING_PO: "Monitoring PO",
  RECEIVING: "Receiving",
};

const ONLINE_THRESHOLD_MS = 10 * 60_000;
const isOnline = (lastLoginAt: Date | null) =>
  !!lastLoginAt && Date.now() - lastLoginAt.getTime() < ONLINE_THRESHOLD_MS;

const initialsOf = (name: string | null) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
};

async function StaffList() {
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

  return (
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
  );
}

export function StaffListSection() {
  return (
    <StaffList />
  );
}
