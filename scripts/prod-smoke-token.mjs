const API_KEY = process.env.FIREBASE_WEB_API_KEY;
const EMAIL = process.env.SMOKE_EMAIL;
const PASSWORD = process.env.SMOKE_PASSWORD;

function fail(message) {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

if (!API_KEY || API_KEY.includes("REAL_") || API_KEY.includes("YOUR_")) {
  fail("FIREBASE_WEB_API_KEY must be set to the real Firebase Web API key.");
}

if (!EMAIL || EMAIL.includes("example.com") || EMAIL.includes("YOUR_")) {
  fail("SMOKE_EMAIL must be set to a real Firebase Auth email/password user.");
}

if (!PASSWORD || PASSWORD.includes("YOUR_") || PASSWORD.includes("password")) {
  fail("SMOKE_PASSWORD must be set to the real Firebase Auth password. Do not commit or paste it into chat.");
}

const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    returnSecureToken: true
  })
});

const body = await response.json().catch(() => ({}));

if (!response.ok || body.error) {
  fail(`Firebase Auth token request failed: ${body?.error?.message || response.status}`);
}

if (!body.idToken || typeof body.idToken !== "string") {
  fail(`Firebase Auth token response did not include idToken: ${JSON.stringify(body)}`);
}

console.log(body.idToken);
