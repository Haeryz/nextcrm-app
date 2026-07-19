"use client";

import { useState, useTransition } from "react";
import { Loader2, MessageSquare, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createMektekWhatsAppMessageTemplate,
  deleteMektekWhatsAppMessageTemplate,
  updateMektekWhatsAppMessageTemplate,
  type MektekWhatsAppMessageTemplateRow,
} from "@/actions/mektek/whatsapp-message-templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS,
  WHATSAPP_MESSAGE_TEMPLATE_PURPOSES,
  isWhatsAppMessageTemplatePurpose,
  type WhatsAppMessageTemplatePurpose,
} from "@/lib/mektek/whatsapp-message-templates";

type TemplateDraft = {
  name: string;
  body: string;
  purpose: WhatsAppMessageTemplatePurpose;
  isActive: boolean;
};

const EMPTY_DRAFT: TemplateDraft = {
  name: "",
  body: "",
  purpose: "ORDER_CREATED",
  isActive: true,
};

function sortTemplates(templates: MektekWhatsAppMessageTemplateRow[]) {
  return [...templates].sort((left, right) => {
    const purpose = left.purpose.localeCompare(right.purpose);
    if (purpose !== 0) return purpose;
    if (left.isActive !== right.isActive) return left.isActive ? -1 : 1;
    return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  });
}

function reconcileSavedTemplate(
  templates: MektekWhatsAppMessageTemplateRow[],
  saved: MektekWhatsAppMessageTemplateRow,
) {
  const next = templates.map((template) => {
    if (template.id === saved.id) return saved;
    if (saved.isActive && template.purpose === saved.purpose) {
      return { ...template, isActive: false };
    }
    return template;
  });
  if (!next.some((template) => template.id === saved.id)) next.push(saved);
  return sortTemplates(next);
}

function TemplateEditor({
  template,
  onSaved,
  onDeleted,
}: {
  template: MektekWhatsAppMessageTemplateRow;
  onSaved: (template: MektekWhatsAppMessageTemplateRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [draft, setDraft] = useState<TemplateDraft>(() => ({
    name: template.name,
    body: template.body,
    purpose: isWhatsAppMessageTemplatePurpose(template.purpose)
      ? template.purpose
      : "ORDER_CREATED",
    isActive: template.isActive,
  }));
  const [isSaving, startSaving] = useTransition();
  const [isDeleting, startDeleting] = useTransition();

  const save = () => {
    startSaving(async () => {
      const result = await updateMektekWhatsAppMessageTemplate(template.id, draft);
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal menyimpan template WhatsApp");
        return;
      }
      onSaved(result.data);
      toast.success("Template WhatsApp disimpan");
    });
  };

  const remove = () => {
    if (!window.confirm(`Hapus template “${template.name}”?`)) return;
    startDeleting(async () => {
      const result = await deleteMektekWhatsAppMessageTemplate(template.id);
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal menghapus template WhatsApp");
        return;
      }
      onDeleted(template.id);
      toast.success("Template WhatsApp dihapus");
    });
  };

  return (
    <div className="space-y-3 rounded-lg border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant={draft.isActive ? "default" : "outline"}>
          {draft.isActive ? "Aktif" : "Tidak aktif"}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS[draft.purpose]}
        </span>
      </div>
      <Input
        value={draft.name}
        onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
        placeholder="Nama template"
        maxLength={80}
        disabled={isSaving || isDeleting}
      />
      <Select
        value={draft.purpose}
        onValueChange={(purpose) => {
          if (isWhatsAppMessageTemplatePurpose(purpose)) {
            setDraft((current) => ({ ...current, purpose }));
          }
        }}
        disabled={isSaving || isDeleting}
      >
        <SelectTrigger aria-label="Digunakan saat">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {WHATSAPP_MESSAGE_TEMPLATE_PURPOSES.map((purpose) => (
            <SelectItem key={purpose} value={purpose}>
              {WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS[purpose]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Textarea
        value={draft.body}
        onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
        className="min-h-36 font-mono text-sm"
        maxLength={4_000}
        placeholder="Tulis isi pesan WhatsApp..."
        disabled={isSaving || isDeleting}
      />
      <label className="flex items-center gap-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(event) =>
            setDraft((current) => ({ ...current, isActive: event.target.checked }))
          }
          disabled={isSaving || isDeleting}
          className="size-4 accent-primary"
        />
        Gunakan otomatis untuk event ini
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={save} disabled={isSaving || isDeleting} className="flex-1">
          {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
          {isSaving ? "Menyimpan..." : "Simpan"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={remove}
          disabled={isSaving || isDeleting}
          className="text-destructive hover:text-destructive"
        >
          {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
          {isDeleting ? "Menghapus..." : "Hapus"}
        </Button>
      </div>
    </div>
  );
}

export default function WhatsAppTemplateManager({
  initialTemplates,
}: {
  initialTemplates: MektekWhatsAppMessageTemplateRow[];
}) {
  const [templates, setTemplates] = useState(() => sortTemplates(initialTemplates));
  const [draft, setDraft] = useState<TemplateDraft>(EMPTY_DRAFT);
  const [isCreating, startCreating] = useTransition();

  const create = () => {
    startCreating(async () => {
      const result = await createMektekWhatsAppMessageTemplate(draft);
      if (!result || "error" in result) {
        toast.error(result?.error || "Gagal membuat template WhatsApp");
        return;
      }
      setTemplates((current) => reconcileSavedTemplate(current, result.data));
      setDraft(EMPTY_DRAFT);
      toast.success("Template WhatsApp dibuat");
    });
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
          <MessageSquare className="size-4" />
          Template Pesan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-xs text-muted-foreground">
          Buat template sendiri dan pilih satu template aktif untuk setiap event. Variabel: {" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{customerName}"}</code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{vehicle}"}</code>{" "}
          <code className="rounded bg-muted px-1 py-0.5">{"{trackingLink}"}</code>
        </p>

        <div className="space-y-3 rounded-lg border border-dashed p-4">
          <div className="flex items-center gap-2">
            <Plus className="size-4" />
            <p className="text-sm font-semibold">Buat template baru</p>
          </div>
          <Input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Contoh: Pesan order baru Mektek"
            maxLength={80}
            disabled={isCreating}
          />
          <Select
            value={draft.purpose}
            onValueChange={(purpose) => {
              if (isWhatsAppMessageTemplatePurpose(purpose)) {
                setDraft((current) => ({ ...current, purpose }));
              }
            }}
            disabled={isCreating}
          >
            <SelectTrigger aria-label="Digunakan saat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WHATSAPP_MESSAGE_TEMPLATE_PURPOSES.map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {WHATSAPP_MESSAGE_TEMPLATE_PURPOSE_LABELS[purpose]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={draft.body}
            onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
            className="min-h-36 font-mono text-sm"
            maxLength={4_000}
            placeholder="Halo {customerName}, ..."
            disabled={isCreating}
          />
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(event) =>
                setDraft((current) => ({ ...current, isActive: event.target.checked }))
              }
              disabled={isCreating}
              className="size-4 accent-primary"
            />
            Langsung gunakan untuk event ini
          </label>
          <Button type="button" onClick={create} disabled={isCreating} className="w-full">
            {isCreating ? <Loader2 className="animate-spin" /> : <Plus />}
            {isCreating ? "Membuat..." : "Buat Template"}
          </Button>
        </div>

        {templates.length === 0 ? (
          <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
            Belum ada template buatan Anda. Notifikasi masih memakai pesan bawaan sampai template aktif dibuat.
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <TemplateEditor
                key={`${template.id}-${new Date(template.updatedAt).getTime()}-${template.isActive}`}
                template={template}
                onSaved={(saved) =>
                  setTemplates((current) => reconcileSavedTemplate(current, saved))
                }
                onDeleted={(id) =>
                  setTemplates((current) => current.filter((template) => template.id !== id))
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
