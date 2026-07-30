"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type StaffSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  variant?: "default" | "secondary" | "destructive";
  size?: "default" | "sm";
  icon?: ReactNode;
  className?: string;
};

export default function StaffSubmitButton({
  idleLabel,
  pendingLabel,
  variant = "default",
  size = "default",
  icon,
  className,
}: StaffSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={cn("w-full", className)}
      disabled={pending}
      aria-live="polite"
    >
      {pending ? (
        <LoaderCircle className="animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
