// src/utils/mailer.ts
import nodemailer from "nodemailer";

const hasEmailCreds = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS && process.env.EMAIL_FROM);

const transporter = hasEmailCreds
  ? nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  : null;

export const sendEmail = async (to: string, subject: string, text: string) => {
  if (!transporter) {
    console.warn("Email credentials missing. Skipping sendEmail.");
    return;
  }
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  });
};
