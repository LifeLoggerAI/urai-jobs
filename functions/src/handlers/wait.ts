
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const waitHandler = async (payload: any) => {
  const ms = payload.ms || 1000;
  if (ms > 10000) {
    throw new Error("Wait time cannot exceed 10 seconds.");
  }
  console.log(`Waiting for ${ms}ms...`);
  await sleep(ms);
  console.log("Wait complete.");
};
