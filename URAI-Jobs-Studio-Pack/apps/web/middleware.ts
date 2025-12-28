// Optional: if hosting on Vercel, add middleware to redirect anonymous users away from /admin.
// This is a NO-OP placeholder since we verify on client and with Functions.
export const config = { matcher: ['/admin/:path*'] };
export default function middleware(){ /* Intentionally empty; rely on AdminGate + server checks */ }
