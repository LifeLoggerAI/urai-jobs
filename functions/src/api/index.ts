
import * as express from "express";
import * as cors from "cors";
import {createJob} from "./create-job";

export const api = express();

api.use(cors({origin: true}));
api.use(express.json());

api.post("/jobs", createJob);
