
import {z} from "zod";
import {Handler} from "../../../types";

const PingPayloadSchema = z.object({});

export const ping: Handler = async (payload) => {
  PingPayloadSchema.parse(payload);
  return {pong: true, received: payload};
};
