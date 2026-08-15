import { Suspense } from "react";
import {
  createSubAdmin,
} from "@/actions/auth/sub-admins";
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
  STAFF_CAPABILITIES,
  STAFF_CAPABILITY_LABELS,
  type StaffCapability,
} from "@/lib/auth/staff-capabilities";
import {
  STAFF_DIVISION_LABELS,
  type StaffDivision,
} from "@/lib/auth/staff-divisions";
import type { LogisticsStaffArea } from "@/lib/auth/logistics-staff-areas";
import StaffActionForm from "./_components/StaffActionForm";
import StaffCapabilityFields from "./_components/StaffCapabilityFields";
import StaffPasswordField from "./_components/StaffPasswordField";
import StaffSubmitButton from "./_components/StaffSubmitButton";
import { OnlineStaffPanel } from "./_components/OnlineStaffPanel";
import { StaffListSection } from "./_components/StaffListSection";
import { ShieldCheck, UserPlus, Users } from "lucide-react";

const LOGISTICS_STAFF_AREA_LABELS: Record<LogisticsStaffArea, string> = {
  MONITORING_PO: "Monitoring PO",
  RECEIVING: "Receiving",
};

export default async function StaffManagementPage() {
  await requireAdmin();

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

      <Suspense fallback={
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
            <span className="relative flex size-2.5">
              <span className="relative inline-flex size-2.5 rounded-full bg-muted" />
            </span>
            <CardTitle className="text-base font-medium">Staf online</CardTitle>
            <Badge variant="secondary" className="text-xs">…</Badge>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Memuat staf online…</p>
          </CardContent>
        </Card>
      }>
        <OnlineStaffPanel />
      </Suspense>

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

      <Suspense fallback={
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          <Users className="mx-auto mb-2 size-6 opacity-60" />
          <p className="text-sm">Memuat daftar sub-admin…</p>
        </div>
      }>
        <StaffListSection />
      </Suspense>
    </main>
  );
}
