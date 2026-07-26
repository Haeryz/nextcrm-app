import { Button } from "@/components/ui/button";
import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";
import Link from "next/link";
import { redirect } from "next/navigation";
import TryAgain from "./components/TryAgain";
import { Users } from "@prisma/client";
import { APP_NAME } from "@/lib/brand";

const PendingPage = async () => {
  const adminUsers: Users[] = await prismadb.users.findMany({
    where: {
      is_admin: true,
      userStatus: "ACTIVE",
    },
  });

  const session = await getServerSession(authOptions);

  if (session?.user.userStatus !== "PENDING") {
    return redirect("/");
  }

  return (
    <div className="flex flex-col space-y-5 justify-center items-center max-w-3xl border rounded-md p-10 shadow-md">
      {/*       <pre>
        <code>{JSON.stringify(session, null, 2)}</code>
      </pre> */}
      <div className="flex flex-col">
        <h1 className="text-3xl">
          {APP_NAME} - akun Anda harus disetujui Admin
        </h1>
        <p>
          Selamat datang di {APP_NAME}. Mintalah Admin di
          organisasi Anda untuk menyetujui akun ini. Jika Anda adalah pengguna
          pertama, hubungi dukungan teknis untuk mengaktifkan akun.
        </p>
      </div>
      <div className="flex flex-col justify-center ">
        <h2 className="flex justify-center text-xl">Daftar Admin</h2>
        {adminUsers &&
          adminUsers?.map((user: Users) => (
            <div
              key={user.id}
              className="flex flex-col p-5 m-2 gap-3 border rounded-md"
            >
              <div>
                <p className="font-bold">{user.name}</p>
                <p>{user.id}</p>
                <p>
                  <Link href={`mailto:  ${user.email}`}>{user.email}</Link>
                </p>
              </div>
            </div>
          ))}
      </div>
      <div className="flex flex-col md:flex-row space-x-2 justify-center items-center">
        <Button asChild>
          <Link href="/sign-in">Login dengan akun lain</Link>
        </Button>
        <p>atau</p>
        <TryAgain />
      </div>
    </div>
  );
};

export default PendingPage;
