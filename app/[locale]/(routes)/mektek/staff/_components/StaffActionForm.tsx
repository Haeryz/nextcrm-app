"use client";

import { useRef, type ReactNode } from "react";
import { toast } from "sonner";

type StaffActionFormProps = {
  action: (formData: FormData) => Promise<void>;
  children: ReactNode;
  className?: string;
  successMessage: string;
  resetOnSuccess?: boolean;
};

export default function StaffActionForm({
  action,
  children,
  className,
  successMessage,
  resetOnSuccess = false,
}: StaffActionFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  const submitAction = async (formData: FormData) => {
    try {
      await action(formData);
      if (resetOnSuccess) formRef.current?.reset();
      toast.success(successMessage);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Perubahan sub-admin gagal disimpan.",
      );
    }
  };

  return (
    <form ref={formRef} action={submitAction} className={className}>
      {children}
    </form>
  );
}
