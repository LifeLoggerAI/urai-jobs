import { z } from 'zod';

export const handlers = {
  'example.job': {
    payload: z.object({
      message: z.string(),
    }),
    handler: async (payload: z.infer<typeof handlers['example.job']['payload']>) => {
      console.log(`Hello, ${payload.message}!`);
    },
  },
};
