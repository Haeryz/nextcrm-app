"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  MessageCircle,
} from "lucide-react";

const tabs = [
  { key: "orders",   href: "/mektek",          label: "Orders",   icon: ClipboardList },
  { key: "whatsapp", href: "/mektek/whatsapp", label: "WhatsApp", icon: MessageCircle },
];

interface MektekSubNavProps {
  activeTab?: string;
}

export default function MektekSubNav({ activeTab }: MektekSubNavProps) {
  const pathname = usePathname();

  const isActive = (tab: (typeof tabs)[number]) => {
    if (activeTab) return tab.key === activeTab;
    const stripped = pathname.replace(/^\/[a-z]{2}/, "");
    if (tab.href === "/mektek") return stripped === "/mektek";
    return stripped.startsWith(tab.href);
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 border-b">
      {tabs.map((tab) => {
        const active = isActive(tab);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t whitespace-nowrap transition-colors ${
              active
                ? "border-b-2 border-foreground font-semibold text-foreground -mb-[1px]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
