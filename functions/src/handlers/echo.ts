
export const echoHandler = async (payload: any) => {
  console.log("ECHO PAYLOAD:", payload);
  return Promise.resolve();
};
