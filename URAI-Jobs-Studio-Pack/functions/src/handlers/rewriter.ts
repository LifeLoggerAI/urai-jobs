export function rewriteHtmlForTracking(html: string, baseUrl: string, campaignId: string, email: string){
  if (!html) return html;
  const enc = (s:string)=> encodeURIComponent(s);
  const addUtm = (u:string)=>{
    try {
      const url = new URL(u);
      url.searchParams.set('utm_source','urai');
      url.searchParams.set('utm_medium','email');
      url.searchParams.set('utm_campaign', campaignId);
      url.searchParams.set('utm_content', email);
      return url.toString();
    } catch { return u; }
  };
  const click = (u:string)=> `${baseUrl}/trackRedirect?c=${enc(campaignId)}&r=${enc(email)}&u=${enc(addUtm(u))}`;
  return html.replace(/href=\"(https?:[^\"]+)\"/g, (_m, url)=> `href=\"${click(url)}\"`);
}
export function injectOpenPixel(html: string, baseUrl: string, campaignId: string, email: string){
  const enc = (s:string)=> encodeURIComponent(s);
  const src = `${baseUrl}/openPixel?c=${enc(campaignId)}&r=${enc(email)}`;
  const tag = `<img src="${src}" width="1" height="1" style="display:none" alt=""/>`;
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, tag + '</body>');
  return html + tag;
}
