import { https } from "firebase-functions";

export const httpHealth = https.onRequest((req, res) => {
    res.status(200).json({
        ok: true,
        service: "urai-jobs",
        time: new Date().toISOString(),
    });
});
