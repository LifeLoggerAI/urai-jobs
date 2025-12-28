import * as functions from "firebase-functions";
import express from "express";
import cors from "cors";
import { enqueue } from "./enqueue";

const app = express();

app.use(cors({ origin: true }));

app.post("/", async (req, res) => {
  try {
    const { type, payload, opts } = req.body;
    const id = await enqueue(type, payload, opts);
    res.status(201).send({ id });
  } catch (e: any) {
    res.status(500).send({ error: e.message });
  }
});

app.get("/health", (_req, res) => res.status(200).send("ok"));

export const jobApi = functions.https.onRequest(app);
