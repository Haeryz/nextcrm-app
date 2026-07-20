"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

type StaffSubmitButtonProps = {
  idleLabel: string;
  pendingLabel: string;
  variant?: "default" | "secondary" | "destructive";
  size?: "default" | "sm";
};

export default function StaffSubmitButton({
  idleLabel,
  pendingLabel,
  variant = "default",
  size = "default",
}: StaffSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className="w-full"
      disabled={pending}
      aria-live="polite"
    >
      {pending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
