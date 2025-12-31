
import {Request, Response} from "express";
import * as admin from "firebase-admin";
import {z} from "zod";
import {JobPayloadSchema} from "../types";

export const createJob = async (req: Request, res: Response) => {
  try {
    // 1. Authenticate the user
    const authToken = req.headers.authorization;
    if (!authToken) {
      res.status(401).send("Unauthorized");
      return;
    }

    const decodedToken = await admin.auth().verifyIdToken(authToken.split(" ")[1]);
    const userId = decodedToken.uid;

    // For now, we'll allow any authenticated user to create a job.
    // In a real-world scenario, you would want to check for specific roles or claims.

    const jobPayload = JobPayloadSchema.parse(req.body);

    // Create a new job document in Firestore
    const jobRef = await admin.firestore().collection("jobs").add({
      ...jobPayload,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "open",
      createdBy: userId,
    });

    res.status(201).json({id: jobRef.id, ...jobPayload});
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({error: error.errors});
    } else {
      console.error(error);
      res.status(500).json({error: "Internal Server Error"});
    }
  }
};
