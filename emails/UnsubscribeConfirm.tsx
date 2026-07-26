import {
  Body,
  Button,
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
import { APP_NAME } from "\@/lib/brand";

interface UnsubscribeConfirmProps {
  username?: string | null;
  channel: "marketing" | "offers" | "all";
  confirmUrl: string;
  keepUrl: string;
  userLanguage: string;
}

export const UnsubscribeConfirm = ({
  username,
  channel,
  confirmUrl,
  keepUrl,
  userLanguage,
}: UnsubscribeConfirmProps) => {
  const copy =
    userLanguage === "id"
      ? {
          preview: `Konfirmasi berhenti berlangganan dari ${APP_NAME}`,
          heading: "Konfirmasi Berhenti Berlangganan",
          hello: "Halo",
          channelLabel:
            channel === "offers"
              ? "penawaran"
              : channel === "marketing"
                ? "email pemasaran"
                : "semua email",
          ask: (c: string) =>
            `Apakah Anda yakin ingin berhenti berlangganan ${c} dari kami?`,
          instructions:
            "Anda tidak akan menerima email ini lagi dari kami. Anda dapat berlangganan kembali kapan saja melalui pengaturan Account Anda.",
          confirm: "Ya, berhenti berlangganan",
          keep: "Tidak, tetap berlangganan",
          mistaken:
            "Jika Anda tidak meminta ini, abaikan Email ini — preferensi Anda tidak akan berubah.",
          thanks: "Terima kasih,",
        }
      : userLanguage === "en"
        ? {
            preview: `Unsubscribe confirmation from ${APP_NAME}`,
            heading: "Unsubscribe Confirmation",
            hello: "Hello",
            channelLabel:
              channel === "offers"
                ? "offer emails"
                : channel === "marketing"
                  ? "marketing emails"
                  : "all emails",
            ask: (c: string) =>
              `Are you sure you want to unsubscribe from ${c}?`,
            instructions:
              "You will stop receiving these emails from us. You can opt back in any time from your account settings.",
            confirm: "Yes, unsubscribe",
            keep: "No, keep me subscribed",
            mistaken:
              "If you did not request this, you can safely ignore this email — your preferences will not change.",
            thanks: "Thank you,",
          }
        : {
            preview: `Potvrzení odhlášení od ${APP_NAME}`,
            heading: "Potvrzení odhlášení",
            hello: "Dobrý den",
            channelLabel:
              channel === "offers"
                ? "nabídkové e-maily"
                : channel === "marketing"
                  ? "marketingové e-maily"
                  : "všechny e-maily",
            ask: (c: string) =>
              `Opravdu se chcete odhlásit z odběru ${c}?`,
            instructions:
              "Přestanete od nás tyto e-maily dostávat. Můžete se kdykoli znovu přihlásit v nastavení účtu.",
            confirm: "Ano, odhlásit",
            keep: "Ne, ponechat odběr",
            mistaken:
              "Pokud jste o to nežádali, tento e-mail ignorujte — vaše předvolby se nezmění.",
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
              {copy.hello}
              {username ? ` ${username}` : ""},
            </Text>
            <Text className="text-black text-sm leading-[24px]">
              {copy.ask(copy.channelLabel)}
            </Text>
            <Text className="text-[#666666] text-sm leading-[24px]">
              {copy.instructions}
            </Text>
            <Section className="text-center my-[24px]">
              <Button
                href={confirmUrl}
                className="bg-black text-white text-sm font-semibold rounded-md px-6 py-3 no-underline"
              >
                {copy.confirm}
              </Button>
            </Section>
            <Section className="text-center my-[8px]">
              <Button
                href={keepUrl}
                className="text-black text-sm font-medium underline"
              >
                {copy.keep}
              </Button>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-xs leading-[20px]">
              {copy.mistaken}
            </Text>
            <Text className="text-[#666666] text-xs leading-[20px]">
              {copy.thanks} {APP_NAME}
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default UnsubscribeConfirm;
