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

const customerSchema = z.object({
  name: z.string().min(3).max(50),
  phone: z.string().min(6).max(30),
  password: z.string().min(8).max(50),
  confirmPassword: z.string().min(8).max(50),
  otpCode: z.string().length(6, "Masukkan kode WhatsApp 6 digit"),
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
      password: "",
      confirmPassword: "",
      otpCode: "",
    },
  });

  const [otpSending, setOtpSending] = React.useState(false);

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
      const result = await registerCustomerUser(data);

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
