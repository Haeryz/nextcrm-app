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
  const previewText = `Password reset from ${process.env.NEXT_PUBLIC_APP_NAME}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
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
              Password reset for: <strong>{username}</strong>
            </Heading>
            <Text className="text-black text-sm leading-[24px]">
              Hello {username},
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {userLanguage === "en"
                ? "We received a request to reset the password for your account:"
                : "Obdrželi jsme žádost o obnovení hesla k vašemu účtu:"}{" "}
              <strong>{email}</strong>
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {userLanguage === "en"
                ? "Click the link below to choose a new password. This link expires in 1 hour and can be used only once. If you did not request this, you can safely ignore this email — your password will not change."
                : "Kliknutím na odkaz níže si zvolte nové heslo. Odkaz vyprší za 1 hodinu a lze jej použít pouze jednou. Pokud jste o to nežádali, tento e-mail ignorujte — vaše heslo se nezmění."}
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              <Link href={resetLink} className="text-blue-500 underline">
                {userLanguage === "en"
                  ? "Reset your password"
                  : "Obnovit heslo"}
              </Link>
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {userLanguage === "en" ? "Thank you, " : "Děkujeme, "}
              {process.env.NEXT_PUBLIC_APP_NAME}
            </Text>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default PasswordResetEmail;
