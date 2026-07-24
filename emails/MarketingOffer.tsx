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

interface MarketingOfferProps {
  username?: string | null;
  preheader: string;
  title: string;
  bodyText: string;
  ctaLabel: string;
  ctaUrl: string;
  unsubscribeUrl: string;
  userLanguage: string;
}

export const MarketingOffer = ({
  username,
  preheader,
  title,
  bodyText,
  ctaLabel,
  ctaUrl,
  unsubscribeUrl,
  userLanguage,
}: MarketingOfferProps) => {
  const copy =
    userLanguage === "id"
      ? {
          hello: "Halo",
          unsubscribe: "Berhenti berlangganan",
          footer:
            "Anda menerima Email ini karena berlangganan penawaran dari kami.",
        }
      : userLanguage === "en"
        ? {
            hello: "Hello",
            unsubscribe: "Unsubscribe",
            footer: "You received this email because you opted into our offers.",
          }
        : {
            hello: "Dobrý den",
            unsubscribe: "Odhlásit odběr",
            footer:
              "Tento e-mail jste obdrželi, protože jste se přihlásili k našim nabídkám.",
          };

  // bodyText is admin-authored plain text with {{variable}} placeholders already
  // substituted by renderTemplateBody. Rendered as plain text lines — never raw
  // HTML — to avoid XSS in email clients.
  const bodyLines = String(bodyText ?? "").split(/\r?\n/);

  return (
    <Html>
      <Head />
      <Preview>{preheader}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Heading className="text-black text-2xl font-normal text-center p-0 my-[30px] mx-0">
              {title}
            </Heading>
            <Text className="text-black text-sm leading-[24px]">
              {copy.hello}
              {username ? ` ${username}` : ""},
            </Text>
            <Section className="my-[16px]">
              {bodyLines.map((line, index) => (
                <Text
                  key={index}
                  className="text-black text-sm leading-[24px] my-[6px]"
                >
                  {line || "\u00A0"}
                </Text>
              ))}
            </Section>
            <Section className="text-center my-[24px]">
              <Button
                href={ctaUrl}
                className="bg-black text-white text-sm font-semibold rounded-md px-6 py-3 no-underline"
              >
                {ctaLabel}
              </Button>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-xs leading-[20px]">
              {copy.footer}
            </Text>
            <Text className="text-[#666666] text-xs leading-[20px]">
              <a href={unsubscribeUrl} className="text-blue-500 underline">
                {copy.unsubscribe}
              </a>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default MarketingOffer;
