"use client";

import { useCallback, useState, useTransition } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Megaphone,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

import {
  listWhatsAppSendActivity,
  type WhatsAppSendActivityData,
} from "@/actions/mektek/whatsapp-log";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  WHATSAPP_LOG_RANGE_OPTIONS,
  WHATSAPP_LOG_STATUS_OPTIONS,
  formatWhatsAppLogTime,
  whatsAppCategoryBadgeClass,
  whatsAppCategoryLabel,
  whatsAppPurposeLabel,
  whatsAppStatusBadgeClass,
  whatsAppStatusLabel,
} from "./whatsapp-log-view";

type Props = {
  initialData: WhatsAppSendActivityData | null;
  initialError?: string | null;
};

function percentage(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/**
 * Splits one number into transactional vs promotional. The workshop's number was
 * suspended without anyone being able to see how much promotion it was sending,
 * so every tile carries that split rather than a single opaque total.
 */
function SplitTile({
  label,
  total,
  transactional,
  promotional,
  hint,
}: {
  label: string;
  total: number;
  transactional: number;
  promotional: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{total}</p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <Badge
          variant="outline"
          className={cn("gap-1", whatsAppCategoryBadgeClass("transactional"))}
        >
          <Receipt className="size-3" />
          {transactional} transaksional
        </Badge>
        <Badge
          variant="outline"
          className={cn("gap-1", whatsAppCategoryBadgeClass("promotional"))}
        >
          <Megaphone className="size-3" />
          {promotional} promosi
        </Badge>
      </div>
      {hint ? (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export default function WhatsAppSendActivityPanel({
  initialData,
  initialError,
}: Props) {
  const [data, setData] = useState<WhatsAppSendActivityData | null>(initialData);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [pending, startTransition] = useTransition();

  const rangeDays = data?.rangeDays ?? 30;
  const purposeFilter = data?.purpose ?? "all";
  const statusFilter = data?.status ?? "all";

  const load = useCallback(
    (next: { days?: number; purpose?: string; status?: string; page?: number }) => {
      startTransition(async () => {
        const result = await listWhatsAppSendActivity({
          days: next.days ?? rangeDays,
          purpose: next.purpose ?? purposeFilter,
          status: next.status ?? statusFilter,
          page: next.page ?? 1,
        });
        if ("error" in result || !result.data) {
          const message =
            ("error" in result && result.error) ||
            "Gagal memuat aktivitas pengiriman WhatsApp";
          setError(message);
          toast.error(message);
          return;
        }
        setError(null);
        setData(result.data);
      });
    },
    [purposeFilter, rangeDays, statusFilter],
  );

  const promotionalShare = data
    ? percentage(data.range.promotional, data.range.total)
    : 0;
  const transactionalShare = data
    ? percentage(data.range.transactional, data.range.total)
    : 0;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="text-base">Aktivitas pengiriman WhatsApp</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Catatan setiap pesan yang keluar dari nomor bengkel: siapa penerimanya
            (disamarkan), untuk keperluan apa, dan apakah pesan itu transaksional
            atau promosi.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => load({ page: data?.page ?? 1 })}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          Muat ulang
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {!data ? (
          <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
            Data aktivitas belum tersedia.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SplitTile
                label="Hari ini"
                total={data.today.total}
                transactional={data.today.transactional}
                promotional={data.today.promotional}
                hint="Dihitung mengikuti hari kalender WIB."
              />
              <SplitTile
                label="7 hari terakhir"
                total={data.week.total}
                transactional={data.week.transactional}
                promotional={data.week.promotional}
              />
              <SplitTile
                label={`Rentang aktif (${rangeDays} hari)`}
                total={data.range.total}
                transactional={data.range.transactional}
                promotional={data.range.promotional}
                hint={`${data.range.sent} terkirim · ${data.range.suppressed} ditahan`}
              />
              <div
                className={cn(
                  "rounded-lg border bg-card p-4",
                  data.range.failed > 0 && "border-destructive/40 bg-destructive/5",
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Gagal terkirim
                </p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    data.range.failed > 0 && "text-destructive",
                  )}
                >
                  {data.range.failed}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  {data.range.failed > 0 ? (
                    <AlertTriangle className="size-3.5 text-destructive" />
                  ) : null}
                  Dalam {rangeDays} hari terakhir
                </p>
              </div>
            </div>

            {/* The promo/transaksional ratio, made unmissable. */}
            <div className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  Komposisi pesan {rangeDays} hari terakhir
                </p>
                <p className="text-xs text-muted-foreground">
                  {transactionalShare}% transaksional · {promotionalShare}% promosi
                </p>
              </div>
              <div
                className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`Komposisi pesan: ${transactionalShare} persen transaksional, ${promotionalShare} persen promosi`}
              >
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${transactionalShare}%` }}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${promotionalShare}%` }}
                />
              </div>
              {data.range.promotional > 0 ? (
                <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <Megaphone className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Ada {data.range.promotional} pesan promosi terkirim. Pesan
                    promosi ke pelanggan yang tidak meminta adalah penyebab paling
                    umum nomor WhatsApp diblokir.
                  </span>
                </p>
              ) : null}
              {data.purposes.length ? (
                <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                  {data.purposes.map((row) => (
                    <li
                      key={row.purpose}
                      className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-xs"
                    >
                      <span className="truncate font-medium capitalize">
                        {whatsAppPurposeLabel(row.purpose)}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {row.promotional > 0 ? (
                          <Badge
                            variant="outline"
                            className={whatsAppCategoryBadgeClass("promotional")}
                          >
                            {row.promotional} promosi
                          </Badge>
                        ) : null}
                        <span className="tabular-nums text-muted-foreground">
                          {row.total}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(rangeDays)}
                onValueChange={(value) => load({ days: Number(value), page: 1 })}
                disabled={pending}
              >
                <SelectTrigger className="h-9 w-36" aria-label="Rentang waktu">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_LOG_RANGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={purposeFilter}
                onValueChange={(value) => load({ purpose: value, page: 1 })}
                disabled={pending}
              >
                <SelectTrigger className="h-9 w-52" aria-label="Filter keperluan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua keperluan</SelectItem>
                  {data.purposes.map((row) => (
                    <SelectItem key={row.purpose} value={row.purpose}>
                      {whatsAppPurposeLabel(row.purpose)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={statusFilter}
                onValueChange={(value) => load({ status: value, page: 1 })}
                disabled={pending}
              >
                <SelectTrigger className="h-9 w-40" aria-label="Filter status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WHATSAPP_LOG_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {pending ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : null}
            </div>

            <div className="overflow-hidden rounded-lg border">
              {/*
                tabIndex + role="region" so the horizontal scroller is reachable
                by keyboard. The other tables in this app scroll with a mouse
                only; that gap is not repeated here.
              */}
              <div
                className="overflow-x-auto"
                tabIndex={0}
                role="region"
                aria-label="Tabel riwayat pengiriman WhatsApp"
              >
                <table className="w-full min-w-[880px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">Waktu</th>
                      <th className="px-3 py-3">Penerima</th>
                      <th className="px-3 py-3">Keperluan</th>
                      <th className="px-3 py-3">Kategori</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Dikirim oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.rows.map((row) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "align-top hover:bg-muted/30",
                          row.category === "promotional" &&
                            "bg-amber-50/60 dark:bg-amber-950/20",
                        )}
                      >
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {formatWhatsAppLogTime(row.sentAt)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 font-medium tabular-nums">
                          {row.recipientMasked}
                        </td>
                        <td className="px-3 py-3 capitalize">
                          {whatsAppPurposeLabel(row.purpose)}
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={whatsAppCategoryBadgeClass(row.category)}
                          >
                            {whatsAppCategoryLabel(row.category)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant="outline"
                            className={whatsAppStatusBadgeClass(row.status)}
                          >
                            {whatsAppStatusLabel(row.status)}
                          </Badge>
                          {row.error ? (
                            <p
                              className="mt-1 max-w-64 truncate text-xs text-muted-foreground"
                              title={row.error}
                            >
                              {row.error}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          {row.sentByLabel ?? (
                            <span className="text-muted-foreground">Sistem</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!data.rows.length && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-12 text-center text-muted-foreground"
                        >
                          Belum ada pesan WhatsApp yang tercatat pada rentang ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>
                {data.totalRows} baris · halaman {data.page} dari {data.pageCount}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || data.page <= 1}
                  onClick={() => load({ page: data.page - 1 })}
                >
                  <ChevronLeft className="size-4" />
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pending || data.page >= data.pageCount}
                  onClick={() => load({ page: data.page + 1 })}
                >
                  Berikutnya
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
