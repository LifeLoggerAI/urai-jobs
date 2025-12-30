
import { z } from 'zod';

const PingPayload = z.object({
  message: z.string().optional(),
});

export const noopPing = async (payload: unknown) => {
  const validation = PingPayload.safeParse(payload);
  if (!validation.success) {
    throw new Error(`Invalid payload: ${validation.error.message}`);
  }

  return { pong: true, received: validation.data.message || 'pong' };
};
