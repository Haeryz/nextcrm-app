import nodemailer from "nodemailer";
import { areExternalApisDisabled } from "./external-apis";

interface EmailOptions {
  from: string | undefined;
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export default async function sendEmail(
  emailOptions: EmailOptions
): Promise<void> {
  if (areExternalApisDisabled()) {
    return;
  }

  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) {
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  try {
    await transporter.sendMail(emailOptions);
    console.log(`Email sent to ${emailOptions.to}`);
    return Promise.resolve(console.log(`Email sent to ${emailOptions.to}`));
  } catch (error: any | Error) {
    console.error(`Error occurred while sending email: ${error.message}`);
  }
}
