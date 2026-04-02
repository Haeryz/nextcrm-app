import { authOptions } from "@/lib/auth";
import { prismadb } from "@/lib/prisma";
import { getServerSession } from "@/lib/session";

export const getUser = async () => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id && !session?.user?.email) {
    return null;
  }

  let data = null;

  if (session?.user?.id) {
    data = await prismadb.users.findUnique({
      where: {
        id: session.user.id,
      },
    });
  }

  if (!data && session?.user?.email) {
    data = await prismadb.users.findUnique({
      where: {
        email: session.user.email,
      },
    });
  }

  return data;
};
