"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";

import { Icons } from "@/components/ui/icons";
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
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { passwordReset } from "@/actions/auth/password-reset";

export function LoginComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  //State for dialog to be by opened and closed by DialogTrigger
  const [open, setOpen] = useState(false);

  const [email, setEmail] = useState("");

  const router = useRouter();
  const params = useParams<{ locale?: string }>();
  const searchParams = useSearchParams();
  const locale = params.locale || "en";
  const customerFlow = searchParams.get("customer") === "1";
  const initialIdentifier =
    searchParams.get("phone") || searchParams.get("email") || "";

  const formSchema = z.object({
    email: z.string().min(3).max(80),
    password: z.string().min(8).max(50),
  });

  type LoginFormValues = z.infer<typeof formSchema>;

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: initialIdentifier,
      password: "",
    },
  });

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      await signIn("google", {
        callbackUrl: process.env.NEXT_PUBLIC_APP_URL,
        //callbackUrl: "/",
      });
    } catch (error) {
      console.log(error, "error");
      toast.error("Something went wrong while logging with your Google account.");
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGitHub = async () => {
    setIsLoading(true);
    try {
      await signIn("github", {
        callbackUrl: process.env.NEXT_PUBLIC_APP_URL,
        //callbackUrl: "/",
      });
    } catch (error) {
      console.log(error, "error");
      toast.error("Something went wrong while logging with your Google account.");
    } finally {
      setIsLoading(false);
    }
  };
  //Login with username(email)/password
  async function onSubmit(data: LoginFormValues) {
    setIsLoading(true);
    try {
      const status = await signIn("credentials", {
        redirect: false,
        email: data.email,
        password: data.password,
        callbackUrl: `/${locale}/customer/profile`,
      });
      if (status?.error) {
        toast.error(status.error);
        return;
      }
      if (status?.ok) {
        toast.success("Login successful.");
        router.push(
          customerFlow || !data.email.includes("@")
            ? `/${locale}/customer/profile`
            : `/${locale}`
        );
        router.refresh();
      }
    } catch (error: any) {
      console.log(error);
      toast.error(error?.message || error?.toString() || "An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  }

  async function onPasswordReset(email: string) {
    try {
      setIsLoading(true);
      const result = await passwordReset(email);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Password reset email has been sent.");
    } catch (error: any) {
      toast.error(error?.message || "Something went wrong while resetting the password.");
    } finally {
      setIsLoading(false);
      setOpen(false);
    }
  }

  return (
    <Card className="my-5 w-full max-w-[520px] shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>Click here to login with: </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" onClick={loginWithGitHub}>
            <Icons.gitHub className="mr-2 h-4 w-4" />
            Github
          </Button>
          <Button
            variant="outline"
            onClick={loginWithGoogle}
            disabled={isLoading}
          >
            {isLoading ? (
              <Icons.google className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Icons.google className="mr-2 h-4 w-4" />
            )}{" "}
            Google
          </Button>
        </div>
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with
            </span>
          </div>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <div className="grid gap-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail or phone number</FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        placeholder="name@domain.com or +628123456789"
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
                  aria-label={show ? "Hide password" : "Show password"}
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
                <span className={isLoading ? " " : "hidden"}>Loading ...</span>
                <span className={isLoading ? "hidden" : ""}>Login</span>
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-5">
        <div className="text-sm text-gray-500">
          Need account? Register{" "}
          <Link
            href={{
              pathname: `/${locale}/register`,
              query: initialIdentifier
                ? { customer: "1", phone: initialIdentifier }
                : undefined,
            }}
            className="text-blue-500"
          >
            here
          </Link>
        </div>
        <div className="text-sm text-gray-500">
          Need password reset? Click
          {/* Dialog start */}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="text-blue-500">
              <span className="px-2">here</span>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="p-5">Password Reset</DialogTitle>
                <DialogDescription className="p-5">
                  Enter your email address and we will send new password to your
                  e-mail.
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
                    Reset
                  </Button>
                </div>
              )}
              <DialogTrigger className="w-full text-right pt-5 ">
                <Button variant={"destructive"}>Cancel</Button>
              </DialogTrigger>
            </DialogContent>
          </Dialog>
          {/* Dialog end */}
        </div>
      </CardFooter>
    </Card>
  );
}
