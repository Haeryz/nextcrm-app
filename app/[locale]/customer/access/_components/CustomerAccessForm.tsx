"use client";

import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { registerCustomerUser } from "@/actions/auth/register-user";
import { loginCustomer } from "@/actions/auth/customer-session";
import { requestCustomerPhoneOtp } from "@/actions/auth/phone-otp";
import { requestCustomerEmailOtp } from "@/actions/auth/email-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Email stays optional so walk-in customers with only a phone can still sign up.
// It is validated only when filled, and marketing consent is a separate opt-in
// that is never pre-ticked.
const signupSchema = z
  .object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
    phone: z.string().trim().min(6, "Nomor telepon tidak valid").max(64),
    email: z.string().trim().max(160),
    emailOtpCode: z.string().trim(),
    password: z.string().min(8, "Password minimal 8 karakter").max(100),
    confirmPassword: z.string().min(8, "Password minimal 8 karakter").max(100),
    otpCode: z.string().trim().length(6, "Masukkan kode WhatsApp 6 digit"),
    marketingConsent: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.password !== values.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "Password tidak sama",
      });
    }
    if (values.email && !z.string().email().safeParse(values.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Format email tidak valid",
      });
    }
    if (values.email && values.emailOtpCode.length !== 6) {
      ctx.addIssue({
        code: "custom",
        path: ["emailOtpCode"],
        message: "Masukkan kode verifikasi email 6 digit",
      });
    }
    if (values.marketingConsent && !values.email) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Isi email Anda untuk menerima promosi",
      });
    }
  });

export function CustomerAccessForm({
  locale,
  returnTo,
}: {
  locale: string;
  returnTo: string;
}) {
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupOtp, setSignupOtp] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupEmailOtp, setSignupEmailOtp] = useState("");
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  // Consent is never pre-ticked.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  async function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await loginCustomer({
        phone: loginPhone,
        password: loginPassword,
        rememberDevice,
        returnTo,
        locale,
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success("Login berhasil.");
      window.location.assign(result.redirectTo);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Login gagal"));
    } finally {
      setIsLoading(false);
    }
  }

  async function onSendOtp() {
    if (!signupPhone.trim()) {
      toast.error("Masukkan nomor telepon terlebih dahulu.");
      return;
    }
    setOtpSending(true);
    try {
      const result = await requestCustomerPhoneOtp(signupPhone);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setOtpSent(true);
      toast.success("Kode verifikasi dikirim via WhatsApp.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Gagal mengirim kode"));
    } finally {
      setOtpSending(false);
    }
  }

  async function onSendEmailOtp() {
    if (!signupEmail.trim()) {
      toast.error("Masukkan email terlebih dahulu.");
      return;
    }
    setEmailOtpSending(true);
    try {
      const result = await requestCustomerEmailOtp(signupEmail);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEmailOtpSent(true);
      toast.success("Kode verifikasi dikirim ke email Anda.");
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Gagal mengirim kode email"));
    } finally {
      setEmailOtpSending(false);
    }
  }

  async function onSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsed = signupSchema.safeParse({
      name: signupName,
      phone: signupPhone,
      email: signupEmail,
      emailOtpCode: signupEmailOtp,
      password: signupPassword,
      confirmPassword: signupConfirmPassword,
      otpCode: signupOtp,
      marketingConsent,
    });

    if (!parsed.success) {
      toast.error(
        parsed.error.issues[0]?.message ?? "Data pendaftaran belum lengkap"
      );
      return;
    }

    const values = parsed.data;
    setIsLoading(true);

    try {
      const result = await registerCustomerUser({
        name: values.name,
        phone: values.phone,
        password: values.password,
        confirmPassword: values.confirmPassword,
        otpCode: values.otpCode,
        ...(values.email
          ? {
              email: values.email,
              emailOtpCode: values.emailOtpCode,
              // Consent only travels when there is a real inbox behind it.
              marketingConsent: values.marketingConsent,
            }
          : {}),
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const loginResult = await loginCustomer({
        phone: signupPhone,
        password: signupPassword,
        returnTo,
        locale,
      });

      if ("error" in loginResult) {
        toast.success("Akun berhasil dibuat. Silakan Login dengan nomor telepon dan Password Anda.");
        setLoginPhone(signupPhone);
        return;
      }

      toast.success("Akun pelanggan berhasil dibuat.");
      window.location.assign(loginResult.redirectTo);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Pendaftaran gagal"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-md border border-[#151a63]/10 bg-white p-5 shadow-sm md:p-6">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#eef1ff]">
          <TabsTrigger
            value="login"
            className="data-[state=active]:bg-[#151a63] data-[state=active]:text-[#fff200]"
          >
            Login
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="data-[state=active]:bg-[#151a63] data-[state=active]:text-[#fff200]"
          >
            Daftar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={onLoginSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="login-phone" className="text-[#10164f]">
                Nomor telepon
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="login-phone"
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={64}
                  placeholder="+628123456789"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="login-password" className="text-[#10164f]">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="login-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={200}
                  placeholder="Password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f]"
                  onClick={() => setShowLoginPassword((value) => !value)}
                  disabled={isLoading}
                  aria-label={
                    showLoginPassword ? "Sembunyikan Password" : "Tampilkan Password"
                  }
                >
                  {showLoginPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 text-sm text-[#4b5577]">
              <input
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className="mt-0.5 size-4 rounded border-[#151a63]/30 accent-[#151a63]"
                disabled={isLoading}
              />
              <span>
                Ingat perangkat ini hingga 14 hari. Jangan gunakan pilihan ini pada perangkat bersama.
              </span>
            </label>

            <Button
              type="submit"
              className="h-12 bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
              disabled={isLoading}
            >
              {isLoading ? "Sedang Login..." : "Login"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="mt-6">
          <form onSubmit={onSignupSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="signup-name" className="text-[#10164f]">
                Nama
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  placeholder="Nama pelanggan"
                  autoComplete="name"
                  required
                  maxLength={120}
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-phone" className="text-[#10164f]">
                Nomor telepon
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-phone"
                  value={signupPhone}
                  onChange={(event) => setSignupPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={64}
                  placeholder="+628123456789"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-otp" className="text-[#10164f]">
                Kode verifikasi WhatsApp
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                  <Input
                    id="signup-otp"
                    value={signupOtp}
                    onChange={(event) =>
                      setSignupOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="Kode 6 digit"
                    required
                    minLength={6}
                    className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                    disabled={isLoading}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSendOtp}
                  disabled={isLoading || otpSending}
                  className="h-12 whitespace-nowrap border-[#151a63]/20 text-[#10164f] hover:bg-[#eef1ff]"
                >
                  {otpSending ? "Mengirim..." : otpSent ? "Kirim ulang" : "Kirim kode"}
                </Button>
              </div>
              <p className="text-xs text-[#4b5577]/80">
                Kami mengirim kode ke WhatsApp untuk memastikan nomor ini milik Anda.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-email" className="text-[#10164f]">
                Email (opsional)
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-email"
                  value={signupEmail}
                  onChange={(event) => setSignupEmail(event.target.value)}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  maxLength={160}
                  placeholder="nama@domain.com"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
              </div>
              <p className="text-xs text-[#4b5577]/80">
                Isi email jika Anda ingin menerima informasi promosi dan penawaran.
                Tanpa email, akun Anda tetap aktif dan kabar servis tetap dikirim
                lewat WhatsApp.
              </p>
            </div>

            {signupEmail.trim().length > 0 && (
              <div className="grid gap-2">
                <Label htmlFor="signup-email-otp" className="text-[#10164f]">
                  Kode verifikasi email
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                    <Input
                      id="signup-email-otp"
                      value={signupEmailOtp}
                      onChange={(event) =>
                        setSignupEmailOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6)
                        )
                      }
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Kode 6 digit"
                      className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onSendEmailOtp}
                    disabled={isLoading || emailOtpSending}
                    className="h-12 whitespace-nowrap border-[#151a63]/20 text-[#10164f] hover:bg-[#eef1ff]"
                  >
                    {emailOtpSending
                      ? "Mengirim..."
                      : emailOtpSent
                        ? "Kirim ulang"
                        : "Kirim kode"}
                  </Button>
                </div>
                <p className="text-xs text-[#4b5577]/80">
                  Kami mengirim kode ke email tersebut untuk memastikan alamatnya
                  benar milik Anda.
                </p>
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 text-sm text-[#4b5577]">
              <input
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className="mt-0.5 size-4 rounded border-[#151a63]/30 accent-[#151a63]"
                disabled={isLoading}
              />
              <span>
                Saya bersedia menerima email promosi dan penawaran dari Mektek.
                Anda dapat berhenti berlangganan kapan saja lewat halaman
                preferensi atau tautan di setiap email.
              </span>
            </label>

            <div className="grid gap-2">
              <Label htmlFor="signup-password" className="text-[#10164f]">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  type={showSignupPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  placeholder="Password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f]"
                  onClick={() => setShowSignupPassword((value) => !value)}
                  disabled={isLoading}
                  aria-label={
                    showSignupPassword ? "Sembunyikan Password" : "Tampilkan Password"
                  }
                >
                  {showSignupPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-confirm-password" className="text-[#10164f]">
                Konfirmasi Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-confirm-password"
                  value={signupConfirmPassword}
                  onChange={(event) =>
                    setSignupConfirmPassword(event.target.value)
                  }
                  type={showSignupConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={100}
                  placeholder="Konfirmasi Password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f]"
                  onClick={() =>
                    setShowSignupConfirmPassword((value) => !value)
                  }
                  disabled={isLoading}
                  aria-label={
                    showSignupConfirmPassword
                      ? "Sembunyikan Password"
                      : "Tampilkan Password"
                  }
                >
                  {showSignupConfirmPassword ? (
                    <EyeOff className="size-4" />
                  ) : (
                    <Eye className="size-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
              disabled={isLoading}
            >
              {isLoading ? "Membuat akun..." : "Buat akun"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
