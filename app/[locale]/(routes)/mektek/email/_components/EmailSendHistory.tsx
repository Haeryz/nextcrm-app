import { History } from "lucide-react";

import type { MektekEmailHistoryRow } from "@/actions/mektek/email-campaigns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EMAIL_TEMPLATE_PURPOSE_LABELS } from "@/lib/mektek/email-templates";

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

const timeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Jakarta",
});

function purposeLabel(purpose: string) {
  if (purpose === "marketing" || purpose === "offers") {
    return EMAIL_TEMPLATE_PURPOSE_LABELS[purpose];
  }
  return purpose;
}

export default function EmailSendHistory({
  rows,
}: {
  rows: MektekEmailHistoryRow[];
}) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <History className="size-4" />
          Riwayat Pengiriman
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Rekap dari catatan pengiriman email, dikelompokkan per jenis email dan
          per hari. Catatan pengiriman tidak menyimpan identitas kampanye, jadi
          beberapa kampanye pada jenis dan hari yang sama akan tergabung dalam
          satu baris.
        </p>

        {rows.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Belum ada email marketing atau penawaran yang pernah dikirim.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Tanggal</th>
                  <th className="py-2 pr-3 font-medium">Jenis</th>
                  <th className="py-2 pr-3 text-right font-medium">Penerima</th>
                  <th className="py-2 pr-3 text-right font-medium">Terkirim</th>
                  <th className="py-2 pr-3 text-right font-medium">Gagal</th>
                  <th className="py-2 font-medium">Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.purpose}-${row.day}`} className="border-b last:border-0">
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {dateFormatter.format(new Date(row.day))}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{purposeLabel(row.purpose)}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.recipients}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.sent}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {row.failed > 0 ? (
                        <span className="font-semibold text-destructive">
                          {row.failed}
                        </span>
                      ) : (
                        row.failed
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {timeFormatter.format(new Date(row.lastSentAt))} WIB
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
