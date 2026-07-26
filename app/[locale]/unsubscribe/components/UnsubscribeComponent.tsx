"use client";

import React, { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { unsubscribeByToken } from "@/actions/email/preferences";

type Channel = "marketing" | "offers" | "all";

const channelLabel = (channel: Channel): string => {
  switch (channel) {
    case "offers":
      return "penawaran";
    case "marketing":
      return "email pemasaran";
    case "all":
      return "semua email marketing & penawaran";
  }
};

export function UnsubscribeComponent({
  status,
  token,
  channel,
  username,
}: {
  status: "valid" | "invalid";
  token?: string;
  channel?: Channel;
  username?: string | null;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (status === "invalid" || !token || !channel) {
    return (
      <Card className="w-full max-w-[520px] shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Berhenti Berlangganan</CardTitle>
          <CardDescription>
            Link berhenti berlangganan tidak valid atau sudah kedaluwarsa.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  async function onConfirm() {
    if (!token || !channel) return;
    setIsLoading(true);
    try {
      const result = await unsubscribeByToken(token, channel);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Anda telah berhenti berlangganan.");
    } catch (error: any) {
      toast.error(error?.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  if (done) {
    return (
      <Card className="w-full max-w-[520px] shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Berhenti Berlangganan</CardTitle>
          <CardDescription>
            Anda telah berhenti berlangganan {channelLabel(channel)} dari kami.
            Anda dapat berlangganan kembali kapan saja melalui pengaturan Account
            Anda.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-[520px] shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Berhenti Berlangganan</CardTitle>
        <CardDescription>
          {username ? `Halo ${username}, ` : ""}
          apakah Anda yakin ingin berhenti berlangganan{" "}
          {channelLabel(channel)} dari kami?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className="h-12"
          >
            {isLoading ? "Memproses..." : "Ya, berhenti berlangganan"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Jika Anda tidak meminta ini, abaikan halaman ini — preferensi Anda
            tidak akan berubah.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
