# URAI Jobs Custom Domain Runbook

## Goal

Move the public URAI Jobs web surface from the Firebase default domain to:

- `https://uraijobs.com`
- `https://www.uraijobs.com`

Current verified hosting URL:

- `https://urai-jobs.web.app`

## Prerequisites

- Firebase project: `urai-jobs`
- Firebase Hosting deploy already completed.
- DNS access for `uraijobs.com`.
- Firebase CLI authenticated with an owner/editor account.

## Firebase Console path

1. Open Firebase Console.
2. Select project `urai-jobs`.
3. Go to Hosting.
4. Open Custom domains.
5. Add `uraijobs.com`.
6. Add `www.uraijobs.com`.

Firebase will provide DNS records. Add exactly what Firebase provides at the domain registrar/DNS provider.

## Typical DNS records

Use Firebase-provided values as source of truth. Typical setup is:

### Apex domain

```text
Type: A
Name: @
Value: Firebase Hosting IPs shown in console
```

Firebase often provides two A records. Add both.

### WWW subdomain

```text
Type: CNAME
Name: www
Value: Firebase Hosting target shown in console
```

If the DNS provider does not support CNAME flattening for apex, use Firebase's A records for the apex and CNAME for `www`.

## Verification commands

After DNS propagates:

```bash
dig +short uraijobs.com
dig +short www.uraijobs.com
curl -I https://uraijobs.com
curl -I https://www.uraijobs.com
curl -s https://uraijobs.com | head
curl -s https://www.uraijobs.com | head
```

Expected:

- HTTP status `200` or Firebase-managed redirect to HTTPS followed by `200`.
- Valid TLS certificate.
- HTML contains the URAI Jobs app shell.

## Firebase Auth authorized domains

After custom domains are active, add these to Firebase Auth authorized domains:

- `uraijobs.com`
- `www.uraijobs.com`

Console path:

```text
Firebase Console -> Authentication -> Settings -> Authorized domains
```

## App config and smoke checks

The deployed web config currently targets project `urai-jobs`. Custom domains do not require changing the Firebase project config, but browser auth flows must allow the domains above.

Run public checks:

```bash
curl -I https://uraijobs.com
curl -I https://www.uraijobs.com
```

Run authenticated production smoke from a trusted terminal:

```bash
export FIREBASE_WEB_API_KEY=<real key>
export SMOKE_EMAIL=smoke@urailabs.com
read -s -p "Password: " SMOKE_PASSWORD
echo
export SMOKE_PASSWORD
export PROD_SMOKE_ID_TOKEN="$(pnpm run --silent prod:smoke-token)"
export FIREBASE_PROJECT_ID=urai-jobs
export GCLOUD_PROJECT=urai-jobs
export GCP_REGION=us-central1
pnpm run prod:smoke
```

## Completion checklist

- [ ] `uraijobs.com` added to Firebase Hosting custom domains.
- [ ] `www.uraijobs.com` added to Firebase Hosting custom domains.
- [ ] DNS records added at registrar/DNS provider.
- [ ] Firebase shows domain status connected.
- [ ] TLS certificate active for apex.
- [ ] TLS certificate active for `www`.
- [ ] `curl -I https://uraijobs.com` returns healthy response.
- [ ] `curl -I https://www.uraijobs.com` returns healthy response.
- [ ] Both domains added to Firebase Auth authorized domains.
- [ ] Browser sign-in tested from both domains.
- [ ] Production smoke passed after domain connection.
- [ ] Public launch docs updated with final canonical URL.

## Rollback

If custom domain routing breaks:

1. Keep `https://urai-jobs.web.app` as the fallback launch URL.
2. Remove or pause bad DNS records.
3. Remove failing custom domain mapping in Firebase Hosting if needed.
4. Re-run public smoke against `https://urai-jobs.web.app`.

## Notes

Do not remove the Firebase default domain. Keep it as an operational fallback even after custom domains are live.
