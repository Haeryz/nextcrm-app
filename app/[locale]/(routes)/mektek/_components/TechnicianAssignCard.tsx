"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wrench } from "lucide-react";

const MOCK_TECHNICIANS = [
  "Budi Santoso",
  "Ahmad Fauzi",
  "Rizki Pratama",
  "Deni Kurniawan",
  "Yusuf Hidayat",
];

export default function TechnicianAssignCard() {
  const [assigned, setAssigned] = useState<string>("");

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold tracking-widest uppercase text-muted-foreground">
          Teknisi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {assigned ? (
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="font-semibold text-foreground text-sm">{assigned}</p>
              <p className="text-xs text-muted-foreground">Teknisi ditugaskan</p>
            </div>
            <Badge variant="secondary">Aktif</Badge>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">Belum ada teknisi yang ditugaskan.</p>
        )}
        <Select value={assigned} onValueChange={setAssigned}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pilih teknisi..." />
          </SelectTrigger>
          <SelectContent>
            {MOCK_TECHNICIANS.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground italic">
          Daftar teknisi akan tersambung ke data pengguna saat backend aktif.
        </p>
      </CardContent>
    </Card>
  );
}
