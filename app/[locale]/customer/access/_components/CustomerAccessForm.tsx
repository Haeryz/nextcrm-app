"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock, Phone, UserRound } from "lucide-react";
import { toast } from "sonner";

import { registerCustomerUser } from "@/actions/auth/register-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CustomerAccessForm({ locale }: { locale: string }) {
  const router = useRouter();
  const [loginPhone, setLoginPhone] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPhone, setSignupPhone] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showSignupConfirmPassword, setShowSignupConfirmPassword] =
    useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function onLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);

    try {
      const status = await signIn("credentials", {
        redirect: false,
        email: loginPhone,
        password: loginPassword,
        callbackUrl: `/${locale}/customer/profile`,
      });

      if (status?.error) {
        toast.error(status.error);
        return;
      }

      toast.success("Login successful.");
      router.push(`/${locale}/customer/profile`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Login failed");
    } finally {
      setIsLoading(false);
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
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      const status = await signIn("credentials", {
        redirect: false,
        email: signupPhone,
        password: signupPassword,
        callbackUrl: `/${locale}/customer/profile`,
      });

      if (status?.error) {
        toast.success("Account created. Login with your phone and password.");
        setLoginPhone(signupPhone);
        return;
      }

      toast.success("Customer account created.");
      router.push(`/${locale}/customer/profile`);
      router.refresh();
    } catch (error: any) {
      toast.error(error?.message || "Signup failed");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-md border border-[#151a63]/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.06] md:p-6">
      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-[#eef1ff] dark:bg-[#070a18]">
          <TabsTrigger
            value="login"
            className="data-[state=active]:bg-[#151a63] data-[state=active]:text-[#fff200] dark:data-[state=active]:bg-[#fff200] dark:data-[state=active]:text-[#10164f]"
          >
            Login
          </TabsTrigger>
          <TabsTrigger
            value="signup"
            className="data-[state=active]:bg-[#151a63] data-[state=active]:text-[#fff200] dark:data-[state=active]:bg-[#fff200] dark:data-[state=active]:text-[#10164f]"
          >
            Sign up
          </TabsTrigger>
        </TabsList>

        <TabsContent value="login" className="mt-6">
          <form onSubmit={onLoginSubmit} className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="login-phone" className="text-[#10164f] dark:text-white">
                Phone number
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="login-phone"
                  value={loginPhone}
                  onChange={(event) => setLoginPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="+628123456789"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="login-password" className="text-[#10164f] dark:text-white">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="login-password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  type={showLoginPassword ? "text" : "password"}
                  placeholder="Password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f] dark:text-blue-50/70 dark:hover:bg-white/10 dark:hover:text-[#fff200]"
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

            <Button
              type="submit"
              className="h-12 bg-[#151a63] text-[#fff200] hover:bg-[#10164f] dark:bg-[#fff200] dark:text-[#10164f] dark:hover:bg-[#f5e900]"
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
              <Label htmlFor="signup-name" className="text-[#10164f] dark:text-white">
                Name
              </Label>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="signup-name"
                  value={signupName}
                  onChange={(event) => setSignupName(event.target.value)}
                  placeholder="Customer name"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-phone" className="text-[#10164f] dark:text-white">
                Phone number
              </Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="signup-phone"
                  value={signupPhone}
                  onChange={(event) => setSignupPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="+628123456789"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signup-password" className="text-[#10164f] dark:text-white">
                Password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="signup-password"
                  value={signupPassword}
                  onChange={(event) => setSignupPassword(event.target.value)}
                  type={showSignupPassword ? "text" : "password"}
                  placeholder="Password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f] dark:text-blue-50/70 dark:hover:bg-white/10 dark:hover:text-[#fff200]"
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
              <Label htmlFor="signup-confirm-password" className="text-[#10164f] dark:text-white">
                Confirm password
              </Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#151a63]/60 dark:text-[#fff200]" />
                <Input
                  id="signup-confirm-password"
                  value={signupConfirmPassword}
                  onChange={(event) =>
                    setSignupConfirmPassword(event.target.value)
                  }
                  type={showSignupConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  className="h-12 border-[#151a63]/20 bg-white pl-9 pr-12 text-[#10164f] placeholder:text-[#4b5577]/70 focus-visible:ring-[#151a63] dark:border-white/15 dark:bg-[#070a18] dark:text-white dark:placeholder:text-blue-50/45 dark:focus-visible:ring-[#fff200]"
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-10 -translate-y-1/2 text-[#151a63]/70 hover:bg-[#eef1ff] hover:text-[#10164f] dark:text-blue-50/70 dark:hover:bg-white/10 dark:hover:text-[#fff200]"
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
              className="h-12 bg-[#151a63] text-[#fff200] hover:bg-[#10164f] dark:bg-[#fff200] dark:text-[#10164f] dark:hover:bg-[#f5e900]"
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
