"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";

export default function WhatsAppNotifyToggle() {
  const [checked, setChecked] = useState(false);

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none group">
      <div className="mt-0.5 relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        <div
          className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
            checked
              ? "bg-foreground border-foreground"
              : "bg-background border-muted-foreground"
          }`}
        >
          {checked && (
            <svg
              className="w-2.5 h-2.5 text-background"
              fill="none"
              viewBox="0 0 12 12"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Kirim notifikasi WhatsApp
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Backend integrasi belum aktif — notifikasi akan dikirim setelah WhatsApp-web.js terhubung.
        </p>
      </div>
    </label>
  );
}
