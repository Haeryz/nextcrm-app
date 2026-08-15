"use client";

import { useState } from "react";
import {
  createMektekTechnician,
  deleteMektekTechnician,
  updateMektekTechnician,
} from "@/actions/mektek/technicians";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  MEKTEK_TECHNICIAN_ROLES,
  MEKTEK_TECHNICIAN_ROLE_LABELS,
  type MektekTechnicianRole,
} from "@/lib/mektek/technicians";
import { Save, Trash2, Wrench } from "lucide-react";

type Technician = {
  id: string;
  name: string;
  role: MektekTechnicianRole;
  isActive: boolean;
};

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function TechnicianCard({
  technician,
}: {
  technician: Technician;
}) {
  const nameId = `technician-${technician.id}-name`;
  const roleId = `technician-${technician.id}-role`;
  const statusId = `technician-${technician.id}-status`;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full flex-col gap-3 rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase">
              {initialsOf(technician.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{technician.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {MEKTEK_TECHNICIAN_ROLE_LABELS[technician.role]}
              </p>
            </div>
          </div>
          <Badge
            variant={technician.isActive ? "default" : "outline"}
            className="w-fit"
          >
            {technician.isActive ? "Aktif" : "Tidak aktif"}
          </Badge>
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detail Technician</DialogTitle>
          <DialogDescription>
            Perbarui identitas, peran, atau status ketersediaan technician.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold uppercase">
            {initialsOf(technician.name)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{technician.name}</p>
            <p className="truncate text-sm text-muted-foreground">
              {MEKTEK_TECHNICIAN_ROLE_LABELS[technician.role]}
            </p>
          </div>
        </div>
        <form
          action={updateMektekTechnician}
          className="space-y-4"
        >
          <input type="hidden" name="id" value={technician.id} />
          <div className="space-y-2">
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
          <Button type="submit" variant="secondary" className="w-full">
            <Save data-icon="inline-start" />
            Simpan perubahan
          </Button>
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
      </DialogContent>
    </Dialog>
  );
}

export function TechnicianDirectory({
  technicians,
}: {
  technicians: Technician[];
}) {
  if (technicians.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-12 text-center">
        <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted">
          <Wrench className="size-5 text-muted-foreground" aria-hidden="true" />
        </div>
        <p className="font-medium">Belum ada data technician</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Tambahkan technician pertama melalui form di atas agar dapat ditugaskan ke service order.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {technicians.map((technician) => (
        <TechnicianCard key={technician.id} technician={technician} />
      ))}
    </div>
  );
}
