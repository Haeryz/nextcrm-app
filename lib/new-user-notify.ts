import { Users } from "@prisma/client";

import { prismadb } from "./prisma";
import sendEmail from "./sendmail";

export async function newUserNotify(newUser: Users) {
  const admins = await prismadb.users.findMany({
    where: {
      is_admin: true,
    },
  });

  admins.forEach(async (admin) => {
    await sendEmail({
      from: process.env.EMAIL_FROM,
      to: admin.email,
      subject: `Registrasi User Baru dengan Status PENDING`,
      text: `User baru terdaftar: ${newUser.name} \n\n Silakan Login ke ${process.env.NEXT_PUBLIC_APP_URL}/admin/users dan aktifkan Account tersebut. \n\n Terima kasih \n\n ${process.env.NEXT_PUBLIC_APP_NAME}`,
    });

    console.log("Email berhasil dikirim ke Admin");
  });
}
