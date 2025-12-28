import { dispatchWebhooks } from "./webhook";
const mailgunKey = process.env.MAILGUN_KEY;
const mailgunDomain = process.env.MAILGUN_DOMAIN;

export async function sendEmail(payload: { to: string, subject: string, text: string }) {
  if (!mailgunKey || !mailgunDomain) throw new Error("Mailgun not configured");

  const res = await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${Buffer.from(`api:${mailgunKey}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ from: `URAI <noreply@${mailgunDomain}>`, ...payload })
  });

  if (res.status >= 300) throw new Error(`Mailgun error: ${await res.text()}`);

  await dispatchWebhooks("email.sent", payload);
}