"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginCatalogCustomer,
  signUpCatalogCustomer,
} from "@/actions/catalog/customer";

export default function CustomerSignUpForm() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result =
        mode === "login"
          ? await loginCatalogCustomer({ username, phone })
          : await signUpCatalogCustomer({ username, phone });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(mode === "login" ? "Logged in." : "Customer account created.");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">
            {mode === "login" ? "Customer login" : "Customer signup"}
          </CardTitle>
          <CardDescription>
            Login with a customer account already stored in the database, or create a new one.
            Security note: this lightweight flow should be upgraded with a PIN or phone OTP before production use.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "login" ? "default" : "outline"}
                onClick={() => setMode("login")}
              >
                <LogIn className="size-4" />
                Login
              </Button>
              <Button
                type="button"
                variant={mode === "signup" ? "default" : "outline"}
                onClick={() => setMode("signup")}
              >
                <UserPlus className="size-4" />
                Sign up
              </Button>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="customer-username">Username</Label>
              <Input
                id="customer-username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Your name"
                disabled={isPending}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="customer-phone">Phone number</Label>
              <Input
                id="customer-phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+62..."
                disabled={isPending}
                required
              />
            </div>
            <Button type="submit" disabled={isPending} className="h-11">
              {mode === "login" ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {isPending
                ? "Checking..."
                : mode === "login"
                  ? "Login"
                  : "Create account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
