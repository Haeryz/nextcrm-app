"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Eye, Loader2, Search, Send, Users } from "lucide-react";
import { toast } from "sonner";

import {
  countMektekEmailCampaignAudience,
  previewMektekEmailCampaign,
  sendMektekEmailCampaign,
  sendMektekEmailCampaignTest,
  type MektekEmailAudiencePreview,
  type MektekEmailCampaignPreview,
  type MektekEmailCampaignSendResult,
} from "@/actions/mektek/email-campaigns";
import type { MektekEmailTemplateRow } from "@/actions/mektek/email-templates";
import {
  listMektekVoucherCustomerOptions,
  type MektekVoucherCustomerOption,
} from "@/actions/mektek/vouchers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_TEMPLATE_PURPOSE_LABELS } from "@/lib/mektek/email-templates";

type Scope = "ALL" | "CUSTOMER_TYPE" | "CUSTOMER";
type CustomerType = "STANDARD" | "B2B";
type Channel = "marketing" | "offers";
type ContentSource = "template" | "adhoc";

const SCOPE_LABELS: Record<Scope, string> = {
  ALL: "Semua Customer",
  CUSTOMER_TYPE: "Berdasarkan tipe Customer",
  CUSTOMER: "Satu Customer",
};

const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  STANDARD: "Customer standard",
  B2B: "Customer perusahaan (B2B)",
};

function isScope(value: string): value is Scope {
  return value === "ALL" || value === "CUSTOMER_TYPE" || value === "CUSTOMER";
}

function isCustomerType(value: string): value is CustomerType {
  return value === "STANDARD" || value === "B2B";
}

function isChannel(value: string): value is Channel {
  return value === "marketing" || value === "offers";
}

export default function EmailCampaignComposer({
  templates,
}: {
  templates: MektekEmailTemplateRow[];
}) {
  const [scope, setScope] = useState<Scope>("ALL");
  const [customerType, setCustomerType] = useState<CustomerType>("STANDARD");
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerOptions, setCustomerOptions] = useState<
    MektekVoucherCustomerOption[]
  >([]);
  const [isSearchingCustomer, startCustomerSearch] = useTransition();

  const [source, setSource] = useState<ContentSource>(
    templates.length > 0 ? "template" : "adhoc",
  );
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [adhocChannel, setAdhocChannel] = useState<Channel>("marketing");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");

  // Keyed by the targeting inputs so a stale count can never be shown next to a
  // changed audience — the confirmation dialog reads this number.
  const [audienceState, setAudienceState] = useState<{
    key: string;
    data: MektekEmailAudiencePreview | null;
    error: string | null;
  } | null>(null);

  const [preview, setPreview] = useState<MektekEmailCampaignPreview | null>(null);
  const [isPreviewing, startPreview] = useTransition();
  const [isTesting, startTest] = useTransition();
  const [isSending, startSending] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<MektekEmailCampaignSendResult | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === templateId) ?? null,
    [templates, templateId],
  );

  const channel: Channel = useMemo(() => {
    if (source === "template") {
      const purpose = selectedTemplate?.purpose;
      return purpose && isChannel(purpose) ? purpose : "marketing";
    }
    return adhocChannel;
  }, [source, selectedTemplate, adhocChannel]);

  const selectedCustomer = useMemo(
    () => customerOptions.find((option) => option.id === customerId) ?? null,
    [customerOptions, customerId],
  );

  const buildPayload = useCallback(
    () => ({
      audience: {
        scope,
        customerType: scope === "CUSTOMER_TYPE" ? customerType : undefined,
        customerId: scope === "CUSTOMER" ? customerId : undefined,
      },
      channel,
      templateId: source === "template" ? templateId : undefined,
      subject: source === "adhoc" ? subject : undefined,
      title: source === "adhoc" ? title : undefined,
      body: source === "adhoc" ? body : undefined,
      ctaLabel,
      ctaUrl,
      customerLabel: selectedCustomer?.label ?? null,
    }),
    [
      scope,
      customerType,
      customerId,
      channel,
      source,
      templateId,
      subject,
      title,
      body,
      ctaLabel,
      ctaUrl,
      selectedCustomer,
    ],
  );

  const needsCustomer = scope === "CUSTOMER" && !customerId;
  const targetKey = `${scope}|${customerType}|${customerId}|${channel}`;

  const audience = audienceState?.key === targetKey ? audienceState.data : null;
  const countError = audienceState?.key === targetKey ? audienceState.error : null;
  const isCounting = !needsCustomer && audienceState?.key !== targetKey;

  const countFor = useCallback(async (key: string) => {
    const [scopeValue, typeValue, idValue, channelValue] = key.split("|");
    return countMektekEmailCampaignAudience({
      audience: {
        scope: scopeValue,
        customerType: scopeValue === "CUSTOMER_TYPE" ? typeValue : undefined,
        customerId: scopeValue === "CUSTOMER" ? idValue : undefined,
      },
      channel: channelValue,
      customerLabel: null,
    });
  }, []);

  // Live recipient count. Re-runs whenever targeting changes — this preview is
  // the safety net before an irreversible send, so it must never go stale.
  useEffect(() => {
    if (needsCustomer) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const response = await countFor(targetKey);
      if (cancelled) return;
      setAudienceState(
        "error" in response
          ? { key: targetKey, data: null, error: response.error }
          : { key: targetKey, data: response.data, error: null },
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [needsCustomer, targetKey, countFor]);

  const searchCustomers = useCallback((query: string) => {
    startCustomerSearch(async () => {
      const response = await listMektekVoucherCustomerOptions({ query });
      if ("error" in response) {
        toast.error(response.error || "Gagal memuat daftar Customer");
        return;
      }
      setCustomerOptions(response.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (scope === "CUSTOMER" && customerOptions.length === 0) {
      searchCustomers("");
    }
  }, [scope, customerOptions.length, searchCustomers]);

  const runPreview = () => {
    startPreview(async () => {
      const response = await previewMektekEmailCampaign(buildPayload());
      if ("error" in response) {
        toast.error(response.error);
        return;
      }
      setPreview(response.data);
    });
  };

  const runTest = () => {
    startTest(async () => {
      const response = await sendMektekEmailCampaignTest(buildPayload());
      if ("error" in response) {
        toast.error(response.error);
        return;
      }
      toast.success(`Email uji dikirim ke ${response.data.email}`);
    });
  };

  const sendableNow = audience?.sendableNow ?? 0;
  const canSend = sendableNow > 0 && !isSending;

  const runSend = () => {
    setConfirmOpen(false);
    startSending(async () => {
      const response = await sendMektekEmailCampaign({
        ...buildPayload(),
        expectedRecipientCount: sendableNow,
      });
      if ("error" in response) {
        toast.error(response.error);
        return;
      }
      setResult(response.data);
      toast.success(`Kampanye terkirim ke ${response.data.sent} penerima`);
      // Re-count: the recipients just sent to are now inside their frequency cap.
      const refreshed = await countFor(targetKey);
      setAudienceState(
        "error" in refreshed
          ? { key: targetKey, data: null, error: refreshed.error }
          : { key: targetKey, data: refreshed.data, error: null },
      );
    });
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <Send className="size-4" />
          Kirim Kampanye Email
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground">
          Pengiriman bersifat permanen dan tidak bisa dibatalkan. Periksa jumlah
          penerima dan pratinjau sebelum mengirim.
        </p>

        {/* ---------------- Target penerima ---------------- */}
        <section className="space-y-3 rounded-lg border p-4">
          <div className="flex items-center gap-2">
            <Users className="size-4" />
            <p className="text-sm font-semibold">1. Target penerima</p>
          </div>

          <Select
            value={scope}
            onValueChange={(value) => {
              if (isScope(value)) setScope(value);
            }}
            disabled={isSending}
          >
            <SelectTrigger aria-label="Target penerima">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SCOPE_LABELS) as Scope[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SCOPE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {scope === "CUSTOMER_TYPE" ? (
            <Select
              value={customerType}
              onValueChange={(value) => {
                if (isCustomerType(value)) setCustomerType(value);
              }}
              disabled={isSending}
            >
              <SelectTrigger aria-label="Tipe Customer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {CUSTOMER_TYPE_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {scope === "CUSTOMER" ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={customerQuery}
                  onChange={(event) => setCustomerQuery(event.target.value)}
                  placeholder="Cari nama, nomor HP, atau email Customer"
                  disabled={isSending}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => searchCustomers(customerQuery)}
                  disabled={isSearchingCustomer || isSending}
                >
                  {isSearchingCustomer ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Search />
                  )}
                  Cari
                </Button>
              </div>
              <Select
                value={customerId}
                onValueChange={setCustomerId}
                disabled={isSending || customerOptions.length === 0}
              >
                <SelectTrigger aria-label="Customer tujuan">
                  <SelectValue placeholder="Pilih Customer tujuan" />
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.label} — {option.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customerOptions.length === 0 && !isSearchingCustomer ? (
                <p className="text-xs text-muted-foreground">
                  Tidak ada Customer yang cocok dengan pencarian.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ---------------- Konten ---------------- */}
        <section className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">2. Isi email</p>

          <Select
            value={source}
            onValueChange={(value) =>
              setSource(value === "adhoc" ? "adhoc" : "template")
            }
            disabled={isSending}
          >
            <SelectTrigger aria-label="Sumber isi email">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="template" disabled={templates.length === 0}>
                Pakai template tersimpan
              </SelectItem>
              <SelectItem value="adhoc">Tulis langsung (sekali pakai)</SelectItem>
            </SelectContent>
          </Select>

          {source === "template" ? (
            templates.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Belum ada template. Buat template di bawah atau pilih “Tulis
                langsung”.
              </p>
            ) : (
              <Select value={templateId} onValueChange={setTemplateId} disabled={isSending}>
                <SelectTrigger aria-label="Template email">
                  <SelectValue placeholder="Pilih template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.isActive ? " (aktif)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <>
              <Select
                value={adhocChannel}
                onValueChange={(value) => {
                  if (isChannel(value)) setAdhocChannel(value);
                }}
                disabled={isSending}
              >
                <SelectTrigger aria-label="Jenis email">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketing">
                    {EMAIL_TEMPLATE_PURPOSE_LABELS.marketing}
                  </SelectItem>
                  <SelectItem value="offers">
                    {EMAIL_TEMPLATE_PURPOSE_LABELS.offers}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subjek email"
                maxLength={200}
                disabled={isSending}
              />
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Judul di dalam email (opsional, default = subjek)"
                maxLength={200}
                disabled={isSending}
              />
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="min-h-40 font-mono text-sm"
                maxLength={5_000}
                placeholder={
                  "Halo {{username}}, ...\n\nPlain text saja. Variabel: {{username}}, {{ctaLabel}}, {{ctaUrl}}."
                }
                disabled={isSending}
              />
            </>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={ctaLabel}
              onChange={(event) => setCtaLabel(event.target.value)}
              placeholder="Teks tombol (default: Selengkapnya)"
              maxLength={40}
              disabled={isSending}
            />
            <Input
              value={ctaUrl}
              onChange={(event) => setCtaUrl(event.target.value)}
              placeholder="Tautan tombol (https://...)"
              disabled={isSending}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            Nilai di atas juga mengisi variabel{" "}
            <code className="rounded bg-muted px-1 py-0.5">{"{{ctaLabel}}"}</code>{" "}
            dan <code className="rounded bg-muted px-1 py-0.5">{"{{ctaUrl}}"}</code>{" "}
            di dalam isi email.
          </p>
        </section>

        {/* ---------------- Jumlah penerima ---------------- */}
        <section className="space-y-2 rounded-lg border p-4">
          <p className="text-sm font-semibold">3. Jumlah penerima</p>
          {needsCustomer ? (
            <p className="text-sm text-muted-foreground">
              Pilih Customer tujuan terlebih dahulu.
            </p>
          ) : countError ? (
            <p className="text-sm text-destructive">{countError}</p>
          ) : isCounting || !audience ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Menghitung penerima...
            </p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm">
                Email ini akan dikirim ke{" "}
                <span className="font-bold">{audience.sendableNow} orang</span>{" "}
                <span className="text-muted-foreground">
                  ({audience.audienceLabel})
                </span>
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <Badge variant="outline">Cocok target: {audience.matched}</Badge>
                <Badge variant="outline">Lolos saringan: {audience.eligible}</Badge>
                <Badge variant="outline">Tersaring: {audience.skipped}</Badge>
                <Badge variant="outline">
                  Batas frekuensi: {audience.reasons.frequencyCap}
                </Badge>
                <Badge variant="outline">
                  Domain diblokir: {audience.reasons.blockedDomain}
                </Badge>
                <Badge variant="outline">
                  Email tidak valid: {audience.reasons.invalidEmail}
                </Badge>
              </div>
              {audience.remaining > 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-500">
                  Maksimal {audience.limit} penerima per pengiriman. Sisa{" "}
                  {audience.remaining} penerima perlu pengiriman ulang.
                </p>
              ) : null}
              {audience.emptyReason ? (
                <p className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  {audience.emptyReason}
                </p>
              ) : null}
            </div>
          )}
        </section>

        {/* ---------------- Aksi ---------------- */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            onClick={runPreview}
            disabled={isPreviewing || isSending}
            className="flex-1"
          >
            {isPreviewing ? <Loader2 className="animate-spin" /> : <Eye />}
            Pratinjau
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={runTest}
            disabled={isTesting || isSending}
            className="flex-1"
          >
            {isTesting ? <Loader2 className="animate-spin" /> : <Send />}
            Kirim uji ke saya
          </Button>
          <Button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canSend}
            className="flex-1"
          >
            {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            {isSending ? "Mengirim..." : "Kirim kampanye"}
          </Button>
        </div>

        {preview ? (
          <section className="space-y-2 rounded-lg border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Pratinjau</p>
            <p className="text-xs text-muted-foreground">
              Jenis: {EMAIL_TEMPLATE_PURPOSE_LABELS[preview.channel]}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Subjek:</span>{" "}
              {preview.subject}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Judul:</span> {preview.title}
            </p>
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background p-3 text-xs">
              {preview.bodyText}
            </pre>
            <p className="text-xs text-muted-foreground">
              Tombol: {preview.ctaLabel} → {preview.ctaUrl}
            </p>
          </section>
        ) : null}

        {result ? (
          <section className="space-y-2 rounded-lg border p-4">
            <p className="text-sm font-semibold">Hasil pengiriman terakhir</p>
            <p className="text-xs text-muted-foreground">{result.audienceLabel}</p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              <Badge>Terkirim: {result.sent}</Badge>
              <Badge variant="outline">Dilewati: {result.skipped}</Badge>
              <Badge variant="outline">Gagal: {result.failed}</Badge>
            </div>
            {result.note ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {result.note}
              </p>
            ) : null}
          </section>
        ) : null}
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Konfirmasi pengiriman</DialogTitle>
            <DialogDescription>
              Email akan dikirim ke {sendableNow} penerima (
              {audience?.audienceLabel ?? "-"}). Pengiriman tidak bisa
              dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Batal
            </Button>
            <Button type="button" onClick={runSend} disabled={!canSend}>
              Ya, kirim ke {sendableNow} penerima
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
