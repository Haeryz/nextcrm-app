"use client";

import React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  registerCustomerUser,
  registerUser,
} from "@/actions/auth/register-user";
import { requestCustomerPhoneOtp } from "@/actions/auth/phone-otp";
import { requestCustomerEmailOtp } from "@/actions/auth/email-otp";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Email is optional on purpose: walk-in customers who only have a phone must
// still be able to register. It is validated only when actually filled in, and
// marketing consent is a separate opt-in that is never pre-ticked.
const customerSchema = z
  .object({
    name: z.string().min(3).max(50),
    phone: z.string().min(6).max(30),
    email: z.string().trim().max(160).optional().or(z.literal("")),
    emailOtpCode: z.string().trim().optional().or(z.literal("")),
    password: z.string().min(8).max(50),
    confirmPassword: z.string().min(8).max(50),
    otpCode: z.string().length(6, "Masukkan kode WhatsApp 6 digit"),
    marketingConsent: z.boolean(),
  })
  .superRefine((values, ctx) => {
    const email = (values.email ?? "").trim();

    if (email && !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Format email tidak valid",
      });
    }

    if (email && (values.emailOtpCode ?? "").trim().length !== 6) {
      ctx.addIssue({
        code: "custom",
        path: ["emailOtpCode"],
        message: "Masukkan kode verifikasi email 6 digit",
      });
    }

    if (values.marketingConsent && !email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Isi email Anda untuk menerima promosi",
      });
    }
  });

const staffSchema = z.object({
  name: z.string().min(3).max(50),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  language: z.string().min(2).max(50),
  password: z.string().min(8).max(50),
  confirmPassword: z.string().min(8).max(50),
});

type CustomerFormValues = z.infer<typeof customerSchema>;
type StaffFormValues = z.infer<typeof staffSchema>;

function PasswordToggle({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}) {
  const Icon = show ? EyeOff : Eye;

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="mt-7 shrink-0"
      onClick={onClick}
      aria-label={show ? "Sembunyikan Password" : "Tampilkan Password"}
    >
      <Icon data-icon="inline-start" />
    </Button>
  );
}

export function RegisterComponent() {
  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const t = useTranslations("RegisterComponent");
  const locale = params.locale || "id";
  const initialPhone = searchParams.get("phone") || "";

  const [isLoading, setIsLoading] = React.useState(false);
  const [show, setShow] = React.useState(false);

  const customerForm = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: initialPhone,
      email: "",
      emailOtpCode: "",
      password: "",
      confirmPassword: "",
      otpCode: "",
      // Consent is never pre-ticked.
      marketingConsent: false,
    },
  });

  const [otpSending, setOtpSending] = React.useState(false);
  const [emailOtpSending, setEmailOtpSending] = React.useState(false);
  const customerEmail = customerForm.watch("email") ?? "";
  const hasCustomerEmail = customerEmail.trim().length > 0;

  const onSendCustomerOtp = async () => {
    const phone = customerForm.getValues("phone");
    if (!phone?.trim()) {
      toast.error("Masukkan nomor telepon terlebih dahulu.");
      return;
    }
    setOtpSending(true);
    try {
      const result = await requestCustomerPhoneOtp(phone);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Kode verifikasi dikirim via WhatsApp.");
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengirim kode");
    } finally {
      setOtpSending(false);
    }
  };

  const onSendCustomerEmailOtp = async () => {
    const email = (customerForm.getValues("email") ?? "").trim();
    if (!email) {
      toast.error("Masukkan email terlebih dahulu.");
      return;
    }
    setEmailOtpSending(true);
    try {
      const result = await requestCustomerEmailOtp(email);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Kode verifikasi dikirim ke email Anda.");
    } catch (error: any) {
      toast.error(error?.message || "Gagal mengirim kode email");
    } finally {
      setEmailOtpSending(false);
    }
  };

  const staffForm = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      username: "",
      email: "",
      language: "id",
      password: "",
      confirmPassword: "",
    },
  });

  const onCustomerSubmit = async (data: CustomerFormValues) => {
    setIsLoading(true);
    try {
      const email = (data.email ?? "").trim();
      const result = await registerCustomerUser({
        name: data.name,
        phone: data.phone,
        password: data.password,
        confirmPassword: data.confirmPassword,
        otpCode: data.otpCode,
        ...(email
          ? {
              email,
              emailOtpCode: (data.emailOtpCode ?? "").trim(),
              // Consent only travels when there is a real inbox behind it.
              marketingConsent: data.marketingConsent === true,
            }
          : {}),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const status = await signIn("credentials", {
        redirect: false,
        email: data.phone,
        password: data.password,
        callbackUrl: `/${locale}/customer/profile`,
      });

      if (status?.error) {
        toast.error("Akun berhasil dibuat. Silakan Login dengan nomor telepon Anda.");
        router.push(`/${locale}/sign-in?customer=1&phone=${encodeURIComponent(data.phone)}`);
        return;
      }

      toast.success("Akun pelanggan berhasil dibuat.");
      router.push(`/${locale}/customer/profile`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Pendaftaran pelanggan gagal");
    } finally {
      setIsLoading(false);
    }
  };

  const onStaffSubmit = async (data: StaffFormValues) => {
    setIsLoading(true);
    try {
      const result = await registerUser(data);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Pengguna berhasil dibuat. Silakan Login.");
      router.push(`/${locale}`);
    } catch (error: any) {
      toast.error(error?.message || "Pendaftaran gagal");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-[520px] shadow-lg">
      <CardHeader className="gap-1">
        <CardTitle className="text-2xl">{t("cardTitle")}</CardTitle>
        <CardDescription>{t("cardDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 overflow-auto">
        <Tabs defaultValue="customer" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="customer">Pelanggan</TabsTrigger>
            <TabsTrigger value="staff">Staf</TabsTrigger>
          </TabsList>

          <TabsContent value="customer" className="mt-4">
            <Form {...customerForm}>
              <form
                onSubmit={customerForm.handleSubmit(onCustomerSubmit)}
                className="grid gap-4"
              >
                <FormField
                  control={customerForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nama</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          placeholder="Budi Santoso"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={customerForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nomor telepon</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          inputMode="tel"
                          placeholder="+628123456789"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={customerForm.control}
                  name="otpCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kode verifikasi WhatsApp</FormLabel>
                      <div className="flex items-start gap-2">
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="Kode 6 digit"
                            {...field}
                            onChange={(event) =>
                              field.onChange(
                                event.target.value.replace(/\D/g, "").slice(0, 6)
                              )
                            }
                          />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 shrink-0 whitespace-nowrap"
                          disabled={isLoading || otpSending}
                          onClick={onSendCustomerOtp}
                        >
                          {otpSending ? "Mengirim..." : "Kirim kode"}
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={customerForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email (opsional)</FormLabel>
                      <FormControl>
                        <Input
                          disabled={isLoading}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="nama@domain.com"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        Isi email jika Anda ingin menerima informasi promosi dan
                        penawaran. Tanpa email, akun Anda tetap aktif dan kabar
                        servis tetap dikirim lewat WhatsApp.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {hasCustomerEmail && (
                  <FormField
                    control={customerForm.control}
                    name="emailOtpCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kode verifikasi email</FormLabel>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Input
                              disabled={isLoading}
                              inputMode="numeric"
                              autoComplete="one-time-code"
                              placeholder="Kode 6 digit"
                              {...field}
                              value={field.value ?? ""}
                              onChange={(event) =>
                                field.onChange(
                                  event.target.value.replace(/\D/g, "").slice(0, 6)
                                )
                              }
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="outline"
                            className="h-9 shrink-0 whitespace-nowrap"
                            disabled={isLoading || emailOtpSending}
                            onClick={onSendCustomerEmailOtp}
                          >
                            {emailOtpSending ? "Mengirim..." : "Kirim kode"}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Kami mengirim kode ke email tersebut untuk memastikan
                          alamatnya benar milik Anda.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={customerForm.control}
                  name="marketingConsent"
                  render={({ field }) => (
                    <FormItem>
                      <label className="flex cursor-pointer items-start gap-3 text-sm">
                        <FormControl>
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0"
                            checked={field.value === true}
                            onChange={(event) => field.onChange(event.target.checked)}
                            disabled={isLoading}
                          />
                        </FormControl>
                        <span className="text-muted-foreground">
                          Saya bersedia menerima email promosi dan penawaran dari
                          Mektek. Anda dapat berhenti berlangganan kapan saja lewat
                          halaman preferensi atau tautan di setiap email.
                        </span>
                      </label>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-start gap-2">
                  <FormField
                    control={customerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem className="w-full">
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
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
                  <PasswordToggle show={show} onClick={() => setShow(!show)} />
                </div>

                <FormField
                  control={customerForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Konfirmasi Password</FormLabel>
                      <FormControl>
                        <Input
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

                <Button disabled={isLoading} type="submit" className="h-11 w-full">
                  {isLoading ? "Membuat akun..." : "Buat akun pelanggan"}
                </Button>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
            <div className="grid gap-4">
              <Form {...staffForm}>
                <form
                  onSubmit={staffForm.handleSubmit(onStaffSubmit)}
                  className="grid gap-4"
                >
                  <FormField
                    control={staffForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama</FormLabel>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            placeholder="Budi Santoso"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={staffForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input disabled={isLoading} placeholder="jdoe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={staffForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            placeholder="name@domain.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={staffForm.control}
                    name="language"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pilih bahasa Anda</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih bahasa" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="flex h-56 overflow-y-auto">
                            {["id", "en", "de", "cz", "uk"].map((lng) => (
                              <SelectItem key={lng} value={lng}>
                                {t("locale", { locale: lng })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-start gap-2">
                    <FormField
                      control={staffForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem className="w-full">
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input
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
                    <PasswordToggle show={show} onClick={() => setShow(!show)} />
                  </div>
                  <FormField
                    control={staffForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Konfirmasi Password</FormLabel>
                        <FormControl>
                          <Input
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
                  <Button disabled={isLoading} type="submit" className="h-11 w-full">
                    {isLoading ? "Membuat akun..." : "Buat akun staf"}
                  </Button>
                </form>
              </Form>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col gap-5">
        <div className="text-sm text-gray-500">
          Sudah memiliki akun?{" "}
          <Link
            href={{
              pathname: `/${locale}/sign-in`,
              query: initialPhone ? { customer: "1", phone: initialPhone } : undefined,
            }}
            className="text-blue-500"
          >
            Login
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}
