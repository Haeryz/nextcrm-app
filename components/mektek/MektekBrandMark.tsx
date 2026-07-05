import Image from "next/image";

import { cn } from "@/lib/utils";

type MektekBrandMarkProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  priority?: boolean;
  showText?: boolean;
};

export function MektekBrandMark({
  className,
  markClassName,
  textClassName,
  priority = false,
  showText = true,
}: MektekBrandMarkProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-12 shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-sm ring-1 ring-[#151a63]/15",
          markClassName
        )}
      >
        <Image
          src="/images/logo-pt-mektek-tanjung-lestari.jpg"
          alt="PT Mektek Tanjung Lestari logo"
          width={350}
          height={350}
          priority={priority}
          className="h-full w-full rounded-[4px] object-contain"
        />
      </span>
      {showText && (
        <span
          className={cn(
            "min-w-0 text-sm font-semibold leading-tight",
            textClassName
          )}
        >
          PT Mektek Tanjung Lestari
        </span>
      )}
    </div>
  );
}
