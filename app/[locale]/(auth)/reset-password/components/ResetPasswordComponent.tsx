"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { resetPassword } from "@/actions/auth/password-reset";

const formSchema = z
  .object({
    password: z.string().min(8, "Password minimal 8 karakter").max(100),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Password tidak sama",
    path: ["confirm"],
  });

type ResetFormValues = z.infer<typeof formSchema>;

export function ResetPasswordComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const locale = params.locale || "id";
  const token = searchParams.get("token") || "";

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirm: "" },
  });

  async function onSubmit(data: ResetFormValues) {
    if (!token) {
      toast.error("Link Reset Password tidak valid atau kedaluwarsa.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await resetPassword(token, data.password);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message || "Password berhasil diperbarui.");
      router.push(`/${locale}/sign-in`);
    } catch (error: any) {
      toast.error(error?.message || "Terjadi kesalahan.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-[520px] shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>
          {token
            ? "Pilih Password baru untuk akun Anda."
            : "Link Reset Password tidak tersedia atau tidak valid. Minta Link baru dari halaman Login."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password baru</FormLabel>
                  <div className="flex items-start gap-2">
                    <FormControl>
                      <Input
                        disabled={isLoading || !token}
                        type={show ? "text" : "password"}
                        placeholder="Password baru"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => setShow(!show)}
                      aria-label={show ? "Sembunyikan Password" : "Tampilkan Password"}
                    >
                      {show ? <EyeOff /> : <Eye />}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Konfirmasi Password</FormLabel>
                  <FormControl>
                    <Input
                      disabled={isLoading || !token}
                      type={show ? "text" : "password"}
                      placeholder="Konfirmasi Password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading || !token} className="h-12">
              {isLoading ? "Menyimpan..." : "Reset Password"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
