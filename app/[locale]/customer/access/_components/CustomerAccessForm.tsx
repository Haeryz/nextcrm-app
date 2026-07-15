"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Phone, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";

import { registerCustomerUser } from "@/actions/auth/register-user";
import { loginCustomer } from "@/actions/auth/customer-session";
import { requestCustomerPhoneOtp } from "@/actions/auth/phone-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

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

      toast.success("Login successful.");
      window.location.assign(result.redirectTo);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function onSendOtp() {
    if (!signupPhone.trim()) {
      toast.error("Enter your phone number first.");
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
      toast.error(errorMessage(error, "Failed to send code"));
    } finally {
      setOtpSending(false);
    }
  }

  async function onSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const result = await registerCustomerUser({
        name: signupName,
        phone: signupPhone,
        password: signupPassword,
        confirmPassword: signupConfirmPassword,
        otpCode: signupOtp,
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
        toast.success("Account created. Login with your phone and password.");
        setLoginPhone(signupPhone);
        return;
      }

      toast.success("Customer account created.");
      window.location.assign(loginResult.redirectTo);
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Signup failed"));
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
            Sign up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={onLoginSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="login-phone" className="text-[#10164f]">
                Phone number
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
                    showLoginPassword ? "Hide password" : "Show password"
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
                Remember this device for up to 14 days. Avoid this on shared devices.
              </span>
            </label>

            <Button
              type="submit"
              className="h-12 bg-[#151a63] text-[#fff200] hover:bg-[#10164f]"
              disabled={isLoading}
            >
              {isLoading ? "Logging in..." : "Login"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="signup" className="mt-6">
          <form onSubmit={onSignupSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="signup-name" className="text-[#10164f]">
                Name
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60" />
                <Input
                  id="signup-name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  placeholder="Customer name"
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
                Phone number
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
                WhatsApp verification code
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
                    placeholder="6-digit code"
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
                We send a code to your WhatsApp to confirm the number is yours.
              </p>
            </div>

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
                    showSignupPassword ? "Hide password" : "Show password"
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
                Confirm password
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
                  placeholder="Confirm password"
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
                      ? "Hide password"
                      : "Show password"
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
              {isLoading ? "Creating account..." : "Create account"}
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
