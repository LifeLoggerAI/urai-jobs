import { Resend } from 'resend';
import sg from '@sendgrid/mail';

const provider = (process.env.EMAIL_PROVIDER||'resend').toLowerCase();
const from = process.env.JOB_EMAIL_FROM || 'no-reply@urai.app';

const resendApiKey = process.env.RESEND_API_KEY;
const sendgridKey = process.env.SENDGRID_API_KEY;

const resend = resendApiKey ? new Resend(resendApiKey) : null;
if (sendgridKey) sg.setApiKey(sendgridKey);

export async function sendEmail(to: string, subject: string, html: string){
  if (provider === 'sendgrid' && sendgridKey){
    await sg.send({ to, from, subject, html });
    return { provider:'sendgrid' };
  }
  if (provider === 'resend' && resend){
    const r = await (resend as any).emails.send({ to, from, subject, html });
    return { provider:'resend', id: (r as any).id };
  }
  return { provider:'simulated' };
}
