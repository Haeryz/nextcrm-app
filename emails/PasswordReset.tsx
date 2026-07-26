import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";
import { APP_NAME } from "\@/lib/brand";

interface VercelInviteUserEmailProps {
  username?: string;
  avatar?: string | null;
  email: string;
  resetLink: string;
  userLanguage: string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

export const PasswordResetEmail = ({
  username,
  avatar,
  email,
  resetLink,
  userLanguage,
}: VercelInviteUserEmailProps) => {
  const copy = userLanguage === "id"
    ? {
        preview: `Reset Password dari ${APP_NAME}`,
        heading: "Reset Password untuk:",
        hello: "Halo",
        request: "Kami menerima Request Reset Password untuk Account Anda:",
        instructions:
          "Klik Link di bawah untuk memilih Password baru. Link ini kedaluwarsa dalam 1 jam dan hanya dapat digunakan satu kali. Jika Anda tidak meminta Reset Password, abaikan Email ini—Password Anda tidak akan berubah.",
        action: "Reset Password",
        thanks: "Terima kasih,",
      }
    : userLanguage === "en"
      ? {
          preview: `Password reset from ${APP_NAME}`,
          heading: "Password reset for:",
          hello: "Hello",
          request: "We received a request to reset the password for your account:",
          instructions:
            "Click the link below to choose a new password. This link expires in 1 hour and can be used only once. If you did not request this, you can safely ignore this email—your password will not change.",
          action: "Reset your password",
          thanks: "Thank you,",
        }
      : {
          preview: `Obnovení hesla od ${APP_NAME}`,
          heading: "Obnovení hesla pro:",
          hello: "Dobrý den",
          request: "Obdrželi jsme žádost o obnovení hesla k vašemu účtu:",
          instructions:
            "Kliknutím na odkaz níže si zvolte nové heslo. Odkaz vyprší za 1 hodinu a lze jej použít pouze jednou. Pokud jste o to nežádali, tento e-mail ignorujte—vaše heslo se nezmění.",
          action: "Obnovit heslo",
          thanks: "Děkujeme,",
        };

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Section className="mt-[32px]">
              <Img
                src={avatar || `${baseUrl}/images/nouser.png`}
                width="50"
                height="50"
                alt="User Avatar"
                className="my-0 mx-auto rounded-full"
              />
            </Section>
            <Heading className="text-black text-2xl font-normal text-center p-0 my-[30px] mx-0">
              {copy.heading} <strong>{username}</strong>
            </Heading>
            <Text className="text-black text-sm leading-[24px]">
              {copy.hello} {username},
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.request}{" "}
              <strong>{email}</strong>
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.instructions}
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              <Link href={resetLink} className="text-blue-500 underline">
                {copy.action}
              </Link>
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.thanks}{" "}
              {APP_NAME}
            </Text>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default PasswordResetEmail;
