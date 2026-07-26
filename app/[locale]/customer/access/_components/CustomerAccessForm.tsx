"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
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
import { requestCustomerEmailOtp } from "@/actions/auth/email-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

// Email is the verification channel for signup, so it is REQUIRED: an address we
// were never given cannot be verified. Marketing consent stays a separate opt-in
// that is never pre-ticked.
const signupSchema = z
  .object({
    name: z.string().trim().min(3, "Nama minimal 3 karakter").max(120),
    phone: z.string().trim().min(6, "Nomor telepon tidak valid").max(64),
    email: z.string().trim().min(1, "Email wajib diisi").max(160),
    emailOtpCode: z
      .string()
      .trim()
      .length(6, "Masukkan kode verifikasi email 6 digit"),
    password: z.string().min(8, "Password minimal 8 karakter").max(100),
    confirmPassword: z.string().min(8, "Password minimal 8 karakter").max(100),
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
    if (!z.string().email().safeParse(values.email).success) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Format email tidak valid",
      });
    }
  });

// Field id per schema key, so a failed parse can focus the first offending input.
const SIGNUP_FIELD_IDS: Record<string, string> = {
  name: "signup-name",
  phone: "signup-phone",
  email: "signup-email",
  emailOtpCode: "signup-email-otp",
  password: "signup-password",
  confirmPassword: "signup-confirm-password",
};

const INPUT_CLASS =
  "h-12 border-primary/20 bg-card pl-10 text-[hsl(var(--brand-navy-ink))] aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive";
const INPUT_ICON_CLASS =
  "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-primary/60";
const TOGGLE_BUTTON_CLASS =
  "absolute right-1 top-1/2 size-11 -translate-y-1/2 text-primary/70 hover:text-primary";
const HINT_CLASS = "text-xs leading-5 text-muted-foreground";
const CHECKBOX_CLASS =
  "mt-0.5 size-5 shrink-0 rounded border-primary/30 accent-[hsl(var(--brand-navy))]";

/** Joins only the ids that are actually rendered — an empty list must stay undefined. */
function describedBy(...ids: Array<string | false | undefined>) {
  const list = ids.filter((id): id is string => Boolean(id));
  return list.length ? list.join(" ") : undefined;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-1.5 text-xs font-medium text-destructive"
    >
      <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** Numbered group so the multi-part signup reads as discrete steps, not one wall. */
function FormStep({
  step,
  title,
  description,
  children,
}: {
  step: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const headingId = `signup-step-${step}`;
  return (
    <section
      aria-labelledby={headingId}
      className="grid gap-4 rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
        >
          {step}
        </span>
        <div className="min-w-0">
          <h3
            id={headingId}
            className="text-sm font-semibold text-[hsl(var(--brand-navy-deep))]"
          >
            {title}
          </h3>
          <p className={`mt-1 ${HINT_CLASS}`}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export function CustomerAccessForm({
  locale,
  returnTo,
}: {
  locale: string;
  returnTo: string;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupEmailOtp, setSignupEmailOtp] = useState("");
  const [signupErrors, setSignupErrors] = useState<Record<string, string>>({});
  const [emailOtpSending, setEmailOtpSending] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  // Consent is never pre-ticked.
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);

  function clearSignupError(field: string) {
    setSignupErrors((previous) =>
      previous[field] ? { ...previous, [field]: "" } : previous
    );
  }

  async function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setLoginError("");

    try {
      const result = await loginCustomer({
        phone: loginPhone,
        password: loginPassword,
        rememberDevice,
        returnTo,
        locale,
      });

      if ("error" in result) {
        const message = result.error ?? "Login gagal";
        setLoginError(message);
        toast.error(message);
        return;
      }

      toast.success("Login berhasil.");
      window.location.assign(result.redirectTo);
    } catch (error: unknown) {
      const message = errorMessage(error, "Login gagal");
      setLoginError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }

  async function onSendEmailOtp() {
    if (!signupEmail.trim()) {
      setSignupErrors((previous) => ({
        ...previous,
        email: "Email wajib diisi",
      }));
      document.getElementById(SIGNUP_FIELD_IDS.email)?.focus();
      toast.error("Masukkan email terlebih dahulu.");
      return;
    }
    setEmailOtpSending(true);
    try {
      const result = await requestCustomerEmailOtp(signupEmail);
      const requestError = result.error;
      if (requestError) {
        setSignupErrors((previous) => ({ ...previous, email: requestError }));
        toast.error(requestError);
        return;
      }
      setEmailOtpSent(true);
      clearSignupError("email");
      document.getElementById(SIGNUP_FIELD_IDS.emailOtpCode)?.focus();
      toast.success(
        "Kode verifikasi dikirim ke email Anda. Cek juga folder spam/promosi."
      );
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
      marketingConsent,
    });

    if (!parsed.success) {
      // Same validation, just surfaced on the offending field instead of only in a toast.
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (typeof field === "string" && !nextErrors[field]) {
          nextErrors[field] = issue.message;
        }
      }
      setSignupErrors(nextErrors);
      const firstField = parsed.error.issues[0]?.path[0];
      if (typeof firstField === "string" && SIGNUP_FIELD_IDS[firstField]) {
        document.getElementById(SIGNUP_FIELD_IDS[firstField])?.focus();
      }
      toast.error(
        parsed.error.issues[0]?.message ?? "Data pendaftaran belum lengkap"
      );
      return;
    }

    setSignupErrors({});
    const values = parsed.data;
    setIsLoading(true);

    try {
      const result = await registerCustomerUser({
        name: values.name,
        phone: values.phone,
        email: values.email,
        emailOtpCode: values.emailOtpCode,
        password: values.password,
        confirmPassword: values.confirmPassword,
        marketingConsent: values.marketingConsent,
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
        setMode("login");
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
    <div className="w-full max-w-xl rounded-xl border border-primary/10 bg-card p-4 shadow-sm sm:p-6">
      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "login" | "signup")}
        className="w-full"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-secondary p-1">
          <TabsTrigger
            value="login"
            className="h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Masuk
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="h-11 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Daftar akun baru
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[hsl(var(--brand-navy-ink))]">
              Masuk ke akun Anda
            </h2>
            <p className={`mt-1 ${HINT_CLASS}`}>
              Gunakan nomor telepon dan password yang Anda buat saat mendaftar.
              Semua kolom wajib diisi.
            </p>
          </div>

          <form onSubmit={onLoginSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label
                htmlFor="login-phone"
                className="text-[hsl(var(--brand-navy-deep))]"
              >
                Nomor telepon
              </Label>
              <div className="relative">
                <Phone className={INPUT_ICON_CLASS} aria-hidden="true" />
                <Input
                  id="login-phone"
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  maxLength={64}
                  placeholder="+628123456789"
                  className={INPUT_CLASS}
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={describedBy(
                    "login-phone-hint",
                    Boolean(loginError) && "login-form-error"
                  )}
                  disabled={isLoading}
                />
              </div>
              <p id="login-phone-hint" className={HINT_CLASS}>
                Nomor yang terdaftar di Mektek, contoh 0812xxxxxxx.
              </p>
            </div>

            <div className="grid gap-2">
              <Label
                htmlFor="login-password"
                className="text-[hsl(var(--brand-navy-deep))]"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className={INPUT_ICON_CLASS} aria-hidden="true" />
                <Input
                  id="login-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={showLoginPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  maxLength={200}
                  placeholder="Masukkan password"
                  className={`${INPUT_CLASS} pr-14`}
                  aria-invalid={loginError ? true : undefined}
                  aria-describedby={describedBy(
                    Boolean(loginError) && "login-form-error"
                  )}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={TOGGLE_BUTTON_CLASS}
                  onClick={() => setShowLoginPassword((value) => !value)}
                  disabled={isLoading}
                  aria-label={
                    showLoginPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
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

            <FieldError id="login-form-error" message={loginError} />

            <div className="flex items-start gap-3 rounded-lg border border-primary/10 bg-[hsl(var(--brand-surface))] p-3">
              <input
                id="login-remember-device"
                type="checkbox"
                checked={rememberDevice}
                onChange={(event) => setRememberDevice(event.target.checked)}
                className={CHECKBOX_CLASS}
                aria-describedby="login-remember-device-hint"
                disabled={isLoading}
              />
              <div className="grid gap-1">
                <Label
                  htmlFor="login-remember-device"
                  className="cursor-pointer text-[hsl(var(--brand-navy-deep))]"
                >
                  Ingat perangkat ini hingga 14 hari
                </Label>
                <p id="login-remember-device-hint" className={HINT_CLASS}>
                  Jangan aktifkan pada perangkat bersama atau komputer umum.
                </p>
              </div>
            </div>

            <Button type="submit" className="h-12 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Sedang masuk...
                </>
              ) : (
                <>
                  Masuk
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>

            <p className={`text-center ${HINT_CLASS}`}>
              Belum punya akun? Pilih tab &quot;Daftar akun baru&quot; di atas.
            </p>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="mt-5">
          <div className="mb-5">
            <h2 className="text-lg font-semibold text-[hsl(var(--brand-navy-ink))]">
              Buat akun pelanggan
            </h2>
            <p className={`mt-1 ${HINT_CLASS}`}>
              Tiga langkah singkat: isi data diri, verifikasi email dengan kode 6
              digit, lalu buat password. Semua kolom wajib diisi kecuali yang
              ditandai opsional.
            </p>
          </div>

          <form onSubmit={onSignupSubmit} className="grid gap-4">
            <FormStep
              step={1}
              title="Data diri"
              description="Dipakai untuk mengenali Anda dan mengirim kabar servis."
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="signup-name"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Nama lengkap
                </Label>
                <div className="relative">
                  <UserRound className={INPUT_ICON_CLASS} aria-hidden="true" />
                  <Input
                    id="signup-name"
                    value={signupName}
                    onChange={(event) => {
                      setSignupName(event.target.value);
                      clearSignupError("name");
                    }}
                    placeholder="Contoh: Budi Santoso"
                    autoComplete="name"
                    required
                    maxLength={120}
                    className={INPUT_CLASS}
                    aria-invalid={signupErrors.name ? true : undefined}
                    aria-describedby={describedBy(
                      Boolean(signupErrors.name) && "signup-name-error"
                    )}
                    disabled={isLoading}
                  />
                </div>
                <FieldError
                  id="signup-name-error"
                  message={signupErrors.name}
                />
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="signup-phone"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Nomor telepon
                </Label>
                <div className="relative">
                  <Phone className={INPUT_ICON_CLASS} aria-hidden="true" />
                  <Input
                    id="signup-phone"
                    value={signupPhone}
                    onChange={(event) => {
                      setSignupPhone(event.target.value);
                      clearSignupError("phone");
                    }}
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    maxLength={64}
                    placeholder="+628123456789"
                    className={INPUT_CLASS}
                    aria-invalid={signupErrors.phone ? true : undefined}
                    aria-describedby={describedBy(
                      "signup-phone-hint",
                      Boolean(signupErrors.phone) && "signup-phone-error"
                    )}
                    disabled={isLoading}
                  />
                </div>
                <FieldError
                  id="signup-phone-error"
                  message={signupErrors.phone}
                />
                <p id="signup-phone-hint" className={HINT_CLASS}>
                  Nomor ini dipakai untuk masuk dan menerima kabar servis.
                  <span className="mt-1 block">
                    <span className="mr-1 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                      Opsional
                    </span>
                    Punya riwayat servis lama di Mektek? Riwayat itu bisa
                    ditautkan nanti dari halaman profil setelah nomor ini
                    diverifikasi lewat WhatsApp.
                  </span>
                </p>
              </div>
            </FormStep>

            <FormStep
              step={2}
              title="Verifikasi email"
              description="Kode 6 digit membuktikan email ini milik Anda dan memakai kode itu akun dibuat."
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="signup-email"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Email
                </Label>
                <div className="relative">
                  <Mail className={INPUT_ICON_CLASS} aria-hidden="true" />
                  <Input
                    id="signup-email"
                    value={signupEmail}
                    onChange={(event) => {
                      setSignupEmail(event.target.value);
                      clearSignupError("email");
                    }}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    required
                    maxLength={160}
                    placeholder="nama@domain.com"
                    className={INPUT_CLASS}
                    aria-invalid={signupErrors.email ? true : undefined}
                    aria-describedby={describedBy(
                      "signup-email-hint",
                      Boolean(signupErrors.email) && "signup-email-error"
                    )}
                    disabled={isLoading}
                  />
                </div>
                <FieldError
                  id="signup-email-error"
                  message={signupErrors.email}
                />
                <p id="signup-email-hint" className={HINT_CLASS}>
                  Pastikan alamat benar, kode verifikasi dikirim ke sini.
                </p>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="signup-email-otp"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Kode verifikasi email (6 digit)
                </Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <ShieldCheck
                      className={INPUT_ICON_CLASS}
                      aria-hidden="true"
                    />
                    <Input
                      id="signup-email-otp"
                      value={signupEmailOtp}
                      onChange={(event) => {
                        setSignupEmailOtp(
                          event.target.value.replace(/\D/g, "").slice(0, 6)
                        );
                        clearSignupError("emailOtpCode");
                      }}
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      placeholder="000000"
                      required
                      minLength={6}
                      maxLength={6}
                      className={`${INPUT_CLASS} tracking-[0.4em]`}
                      aria-invalid={
                        signupErrors.emailOtpCode ? true : undefined
                      }
                      aria-describedby={describedBy(
                        "signup-email-otp-hint",
                        Boolean(signupErrors.emailOtpCode) &&
                          "signup-email-otp-error"
                      )}
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onSendEmailOtp}
                    disabled={isLoading || emailOtpSending}
                    className="h-12 whitespace-nowrap border-primary/20 text-[hsl(var(--brand-navy-deep))] sm:w-40"
                  >
                    {emailOtpSending ? (
                      <>
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                        Mengirim...
                      </>
                    ) : emailOtpSent ? (
                      "Kirim ulang"
                    ) : (
                      "Kirim kode"
                    )}
                  </Button>
                </div>
                <FieldError
                  id="signup-email-otp-error"
                  message={signupErrors.emailOtpCode}
                />
                <p
                  id="signup-email-otp-hint"
                  aria-live="polite"
                  className={HINT_CLASS}
                >
                  {emailOtpSent
                    ? "Kode sudah dikirim dan berlaku 5 menit. Belum masuk? Cek folder spam atau promosi, pastikan alamat email di atas benar, lalu tekan “Kirim ulang”."
                    : "Tekan “Kirim kode”, lalu masukkan 6 digit yang kami kirim ke email Anda. Kode berlaku 5 menit dan kadang mendarat di folder spam atau promosi."}
                </p>
              </div>
            </FormStep>

            <FormStep
              step={3}
              title="Buat password"
              description="Password ini dipakai bersama nomor telepon Anda untuk masuk."
            >
              <div className="grid gap-2">
                <Label
                  htmlFor="signup-password"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Password
                </Label>
                <div className="relative">
                  <Lock className={INPUT_ICON_CLASS} aria-hidden="true" />
                  <Input
                    id="signup-password"
                    value={signupPassword}
                    onChange={(event) => {
                      setSignupPassword(event.target.value);
                      clearSignupError("password");
                    }}
                    type={showSignupPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={100}
                    placeholder="Minimal 8 karakter"
                    className={`${INPUT_CLASS} pr-14`}
                    aria-invalid={signupErrors.password ? true : undefined}
                    aria-describedby={describedBy(
                      "signup-password-hint",
                      Boolean(signupErrors.password) && "signup-password-error"
                    )}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={TOGGLE_BUTTON_CLASS}
                    onClick={() => setShowSignupPassword((value) => !value)}
                    disabled={isLoading}
                    aria-label={
                      showSignupPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  >
                    {showSignupPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
                <FieldError
                  id="signup-password-error"
                  message={signupErrors.password}
                />
                <p id="signup-password-hint" className={HINT_CLASS}>
                  Minimal 8 karakter. Gunakan kombinasi huruf dan angka.
                </p>
              </div>

              <div className="grid gap-2">
                <Label
                  htmlFor="signup-confirm-password"
                  className="text-[hsl(var(--brand-navy-deep))]"
                >
                  Ulangi password
                </Label>
                <div className="relative">
                  <Lock className={INPUT_ICON_CLASS} aria-hidden="true" />
                  <Input
                    id="signup-confirm-password"
                    value={signupConfirmPassword}
                    onChange={(event) => {
                      setSignupConfirmPassword(event.target.value);
                      clearSignupError("confirmPassword");
                    }}
                    type={showSignupConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={100}
                    placeholder="Ketik ulang password"
                    className={`${INPUT_CLASS} pr-14`}
                    aria-invalid={
                      signupErrors.confirmPassword ? true : undefined
                    }
                    aria-describedby={describedBy(
                      Boolean(signupErrors.confirmPassword) &&
                        "signup-confirm-password-error"
                    )}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={TOGGLE_BUTTON_CLASS}
                    onClick={() =>
                      setShowSignupConfirmPassword((value) => !value)
                    }
                    disabled={isLoading}
                    aria-label={
                      showSignupConfirmPassword
                        ? "Sembunyikan password"
                        : "Tampilkan password"
                    }
                  >
                    {showSignupConfirmPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                </div>
                <FieldError
                  id="signup-confirm-password-error"
                  message={signupErrors.confirmPassword}
                />
              </div>
            </FormStep>

            <div className="flex items-start gap-3 rounded-lg border border-primary/10 bg-card p-3">
              <input
                id="signup-marketing-consent"
                type="checkbox"
                checked={marketingConsent}
                onChange={(event) => setMarketingConsent(event.target.checked)}
                className={CHECKBOX_CLASS}
                aria-describedby="signup-marketing-consent-hint"
                disabled={isLoading}
              />
              <div className="grid gap-1">
                <Label
                  htmlFor="signup-marketing-consent"
                  className="cursor-pointer text-[hsl(var(--brand-navy-deep))]"
                >
                  Kirimi saya promo dan penawaran Mektek
                  <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    Opsional
                  </span>
                </Label>
                <p id="signup-marketing-consent-hint" className={HINT_CLASS}>
                  Tidak wajib dan tidak memengaruhi pendaftaran. Anda dapat
                  berhenti berlangganan kapan saja lewat halaman preferensi atau
                  tautan di setiap email.
                </p>
              </div>
            </div>

            <Button type="submit" className="h-12 w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Membuat akun...
                </>
              ) : (
                <>
                  Buat akun
                  <ArrowRight className="size-4" aria-hidden="true" />
                </>
              )}
            </Button>

            <p className={`text-center ${HINT_CLASS}`}>
              Setelah akun dibuat, Anda langsung masuk ke profil pelanggan.
            </p>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
