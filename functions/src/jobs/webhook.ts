import * as admin from "firebase-admin";
import fetch from "node-fetch";

export async function dispatchWebhooks(type: string, body: any) {
  const db = admin.firestore();
  const hooks = await db.collection("webhooks").where("enabled", "==", true).get();
  await Promise.all(hooks.docs.map(async d => {
    const { url, secret, types = [] } = d.data() as any;
    if (types.length && !types.includes(type)) return;
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-urai-signature": secret || "" },
      body: JSON.stringify({ type, body, ts: Date.now() })
    });
  }));
}