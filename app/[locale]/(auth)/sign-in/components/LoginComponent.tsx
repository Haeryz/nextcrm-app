"use client";

import React, { useEffect, useState } from "react";
import { getSession, signIn } from "next-auth/react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useParams, useSearchParams } from "next/navigation";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { Skeleton } from "@/components/ui/skeleton";
import { requestPasswordReset } from "@/actions/auth/password-reset";
import { getPostLoginDestination } from "@/lib/mektek/post-login-destination";

export function LoginComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  //State for dialog to be by opened and closed by DialogTrigger
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");

  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const locale = params.locale || "id";
  const initialIdentifier =
    searchParams.get("phone") || searchParams.get("email") || "";
  const adminDashboardPath = `/${locale}/mektek/dashboard`;

  useEffect(() => {
    const reason = searchParams.get("reason");
    if (reason === "session_invalidated") {
      toast.error(
        "Sesi Anda telah berakhir karena akses Anda diperbarui oleh Admin. Silakan masuk kembali.",
      );
    } else if (reason === "account_inactive") {
      toast.error("Akun Anda telah dinonaktifkan oleh Admin.");
    }
  }, [searchParams]);

  const formSchema = z.object({
    email: z.string().min(3, "Isi Email atau nomor telepon").max(80),
    // max(100) to match /setup and reset-password. At max(50) an owner who set a
    // longer password during setup was rejected here before the request was even
    // sent — locked out of their own account with no server-side reason given.
    password: z
      .string()
      .min(8, "Kata sandi minimal 8 karakter")
      .max(100, "Kata sandi maksimal 100 karakter"),
  });

  type LoginFormValues = z.infer<typeof formSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialIdentifier,
      password: "",
    },
  });

  //Login with username(email)/password
  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const status = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
        staffOnly: "true",
        callbackUrl: adminDashboardPath,
      });
      if (status?.error) {
        toast.error(status.error);
        return;
      }
      if (status?.ok) {
        toast.success("Login berhasil.");
        const session = await getSession();
        const destination = session?.user
          ? getPostLoginDestination(locale, session.user)
          : status.url || adminDashboardPath;
        window.location.assign(destination);
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.message || error?.toString() || "Terjadi kesalahan saat Login");
    } finally {
      setIsLoading(false);
    }
  }

  async function onPasswordReset(email: string) {
    try {
      setIsLoading(true);
      const result = await requestPasswordReset(email);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      // Generic message regardless of whether the account exists (no enumeration).
      toast.success(
        result.message ||
          "Jika Account dengan Email tersebut tersedia, Link Reset Password telah dikirim."
      );
    } catch (error: any) {
      toast.error(error?.message || "Terjadi kesalahan saat Reset Password.");
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  }

  return (
    <Card className="my-5 w-full max-w-[520px] shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Admin Login</CardTitle>
        <CardDescription>Login menggunakan Email dan Password.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email atau nomor telepon</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="nama@domain.com atau +628123456789"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex w-full items-start gap-2">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input
                          className="w-full"
                          disabled={isLoading}
                          placeholder="Password"
                          type={show ? "text" : "password"}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-7 shrink-0"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Sembunyikan Password" : "Tampilkan Password"}
                >
                  {show ? <EyeOff /> : <Eye />}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 py-8">
              <Button
                disabled={isLoading}
                type="submit"
                className="flex gap-2 h-12"
              >
                <span
                  className={
                    isLoading
                      ? " border rounded-full px-3 py-2 animate-spin"
                      : "hidden"
                  }
                >
                  N
                </span>
                <span className={isLoading ? " " : "hidden"}>Memuat...</span>
                <span className={isLoading ? "hidden" : ""}>Login</span>
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-5">
        <div className="text-sm text-gray-500">
          Perlu Reset Password? Klik
          {/* Dialog start */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="text-blue-500">
              <span className="px-2">di sini</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="p-5">Reset Password</DialogTitle>
                <DialogDescription className="p-5">
                  Masukkan alamat Email Anda. Kami akan mengirimkan Link untuk
                  Reset Password.
                </DialogDescription>
              </DialogHeader>
              {isLoading ? (
                <div className="flex flex-col gap-2 py-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <div className="flex flex-col gap-3 px-2 py-5 sm:flex-row">
                  <Input
                    type="email"
                    placeholder="name@domain.com"
                    onChange={(e) => setEmail(e.target.value)}
                  />
                  <Button
                    disabled={email === ""}
                    onClick={() => {
                      onPasswordReset(email);
                    }}
                    className="sm:w-auto"
                  >
                    Reset Password
                  </Button>
                </div>
              )}
              <DialogTrigger className="w-full text-right pt-5 ">
                <Button variant={"destructive"}>Batal</Button>
              </DialogTrigger>
            </DialogContent>
          </Dialog>
          {/* Dialog end */}
        </div>
      </CardFooter>
    </Card>
  );
}
