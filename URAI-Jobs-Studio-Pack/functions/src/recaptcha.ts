import fetch from 'node-fetch';
export async function verifyRecaptcha(token: string){
  const secret = process.env.RECAPTCHA_SECRET;
  if (!secret) return { ok: true, note: 'no secret configured' };
  const r = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method:'POST',
    headers:{ 'Content-Type':'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token })
  });
  const j = await r.json();
  return { ok: !!j.success, score: j.score, action: j.action, raw: j };
}
