"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { bootstrapFirstAdmin } from "@/actions/auth/bootstrap-admin";

const formSchema = z
  .object({
    name: z.string().min(2, "Please enter your name").max(120),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(8, "Use at least 8 characters").max(100),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SetupFormValues = z.infer<typeof formSchema>;

const checklist = [
  "Manage service orders, customers, and payments",
  "Invite your staff and set what each person can do",
  "Connect WhatsApp and the sparepart catalogue",
];

export function SetupComponent({ locale }: { locale: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<SetupFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  async function onSubmit(values: SetupFormValues) {
    setIsLoading(true);
    try {
      const result = await bootstrapFirstAdmin(values);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setDone(true);
      toast.success("Owner account created.");
      // Give the success screen a beat, then move to sign-in.
      setTimeout(() => router.push(`/${locale}/sign-in`), 1600);
    } catch (error: any) {
      toast.error(error?.message || "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen w-full bg-background lg:grid-cols-2">
      {/* Left: welcome / explanation */}
      <section className="flex flex-col justify-between gap-10 bg-zinc-950 px-6 py-10 text-white sm:px-10 lg:px-14 lg:py-14">
        <div className="flex items-center gap-3 text-sm font-medium text-zinc-300">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-zinc-950">
            <Wrench className="size-5" />
          </span>
          PT. Mektek Tanjung Lestari
        </div>

        <div className="max-w-md space-y-5">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-xs font-medium text-zinc-200">
            <Sparkles className="size-3.5" />
            One-time setup
          </span>
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
            Welcome — let&apos;s create your owner account
          </h1>
          <p className="text-sm leading-6 text-zinc-300">
            This is the very first account for your Mektek system. It becomes the{" "}
            <strong className="text-white">owner (admin)</strong> and can do
            everything. You only do this once.
          </p>

          <ul className="space-y-3 pt-2">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-zinc-200">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-400" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 text-xs leading-5 text-zinc-300">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <span>
            For your security, this page turns itself off automatically after the
            owner account is created. Keep these login details private.
          </span>
        </div>
      </section>

      {/* Right: the form */}
      <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          {done ? (
            <div className="flex flex-col items-center gap-5 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="size-9" />
              </span>
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold">You&apos;re all set!</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Your owner account is ready. Taking you to the sign-in page…
                </p>
              </div>
              <Button asChild className="w-full">
                <Link href={`/${locale}/sign-in`}>
                  Go to sign in
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <div className="mb-8 space-y-1.5">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Create owner account
                </h2>
                <p className="text-sm text-muted-foreground">
                  Fill in your details below. It only takes a minute.
                </p>
              </div>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Budi Santoso"
                            autoComplete="name"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email address</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@business.com"
                            autoComplete="email"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <div className="flex items-start gap-2">
                          <FormControl>
                            <Input
                              type={show ? "text" : "password"}
                              placeholder="At least 8 characters"
                              autoComplete="new-password"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={() => setShow(!show)}
                            aria-label={show ? "Hide password" : "Show password"}
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
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm password</FormLabel>
                        <FormControl>
                          <Input
                            type={show ? "text" : "password"}
                            placeholder="Type your password again"
                            autoComplete="new-password"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="h-12 w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <>
                        Create owner account
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
                </form>
              </Form>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already set up?{" "}
                <Link
                  href={`/${locale}/sign-in`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
