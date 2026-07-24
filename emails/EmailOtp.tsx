import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

interface EmailOtpProps {
  code: string;
  email: string;
  userLanguage: string;
}

export const EmailOtp = ({ code, email, userLanguage }: EmailOtpProps) => {
  const copy =
    userLanguage === "id"
      ? {
          preview: `Kode Verifikasi dari ${process.env.NEXT_PUBLIC_APP_NAME}`,
          heading: "Kode Verifikasi Anda",
          hello: "Halo",
          request: "Berikut adalah kode verifikasi untuk Email Anda:",
          instructions:
            "Kode ini berlaku selama 5 menit. Jangan bagikan kode ini kepada siada pun. Permintaan ini tidak berasal dari Anda? Abaikan Email ini.",
          thanks: "Terima kasih,",
        }
      : userLanguage === "en"
        ? {
            preview: `Verification code from ${process.env.NEXT_PUBLIC_APP_NAME}`,
            heading: "Your verification code",
            hello: "Hello",
            request: "Here is the verification code for your email:",
            instructions:
              "This code expires in 5 minutes. Do not share it with anyone. If you did not request this, you can safely ignore this email.",
            thanks: "Thank you,",
          }
        : {
            preview: `Verifikační kód od ${process.env.NEXT_PUBLIC_APP_NAME}`,
            heading: "Váš verifikační kód",
            hello: "Dobrý den",
            request: "Zde je verifikační kód pro váš e-mail:",
            instructions:
              "Kód vyprší za 5 minut. Nesdílejte jej s nikým. Pokud jste o to nežádali, tento e-mail ignorujte.",
            thanks: "Děkujeme,",
          };

  return (
    <Html>
      <Head />
      <Preview>{copy.preview}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Heading className="text-black text-2xl font-normal text-center p-0 my-[30px] mx-0">
              {copy.heading}
            </Heading>
            <Text className="text-black text-sm leading-[24px]">
              {copy.hello},
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.request} <strong>{email}</strong>
            </Text>
            <Section className="text-center my-[24px]">
              <Text className="text-black text-3xl font-bold tracking-[8px] my-0">
                {code}
              </Text>
            </Section>
            <Text className="text-black text-sm leading-[24px]">
              {copy.instructions}
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.thanks} {process.env.NEXT_PUBLIC_APP_NAME}
            </Text>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default EmailOtp;
