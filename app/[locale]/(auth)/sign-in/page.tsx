import { LoginComponent } from "./components/LoginComponent";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { getServerSession } from "@/lib/session";
import {
  getPostLoginDestination,
  shouldRedirectFromStaffLogin,
} from "@/lib/mektek/post-login-destination";
import { Button } from "@/components/ui/button";
import { MektekBrandMark } from "@/components/mektek/MektekBrandMark";

const SignInPage = async ({
  params,
}: {
  params: Promise<{ locale: string }>;
}) => {
  const { locale } = await params;
  const session = await getServerSession(authOptions);

  if (session?.user && shouldRedirectFromStaffLogin(session.user)) {
    redirect(getPostLoginDestination(locale, session.user));
  }

  return (
    <div className="w-full max-w-[560px] py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <MektekBrandMark textClassName="text-foreground" />
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/customer`}>
            <ArrowLeft className="size-4" />
            Customer site
          </Link>
        </Button>
      </div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <ShieldCheck className="size-4" />
        Secure staff access
      </div>
      <LoginComponent />
    </div>
  );
};

export default SignInPage;
