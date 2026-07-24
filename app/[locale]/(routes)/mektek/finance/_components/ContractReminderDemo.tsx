"use client";

import { BellRing, Clock3, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { ContractReminderDemo as ContractReminderDemoData } from "@/lib/mektek/finance-contract-reminder-demo";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(new Date(value));

export default function ContractReminderDemo({
  reminder,
}: {
  reminder: ContractReminderDemoData;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <section className="space-y-3" aria-label="Simulasi notifikasi kontrak">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => setVisible(true)}>
          <BellRing className="h-4 w-4" />
          Picu notifikasi demo
        </Button>
        <span className="text-xs text-muted-foreground">
          Hanya simulasi tampilan; tidak mengirim WhatsApp atau mengubah data.
        </span>
      </div>

      {visible ? (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">Pengingat periode kontrak</p>
                  <p className="text-sm">
                    Simulasi berhasil dipicu. Kontrak berikut akan berakhir dalam
                    tujuh hari.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-2 text-amber-950 hover:bg-amber-100"
                  onClick={() => setVisible(false)}
                  aria-label="Tutup notifikasi demo"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm">
                <span className="font-medium">{reminder.contractNumber}</span>
                {" · "}
                {reminder.customer}
                {" · "}
                berakhir {reminder.daysRemaining} hari lagi
                {" ("}
                {formatDate(reminder.endDate)}
                {")"}
              </p>
              <p className="text-xs text-amber-800">
                Tanggal sistem disimulasikan sebagai {formatDate(reminder.simulatedAt)}.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
