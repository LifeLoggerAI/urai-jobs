import { onRequest } from "firebase-functions/v2/https";

export const httphealth = onRequest((req, res) => {
  res.status(200).json({
    ok: true,
    service: "urai-jobs",
    time: new Date().toISOString(),
  });
});
