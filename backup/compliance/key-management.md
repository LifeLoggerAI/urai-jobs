# URAI-JOBS Key Management Policy

## 1. Root Key Custody
- Generated offline
- Split using 2-of-3 Shamir
- Stored physically separate

## 2. Operational Keys
- Stored in KMS (GCP)
- Rotated annually
- No plaintext storage

## 3. Emergency Recovery
- Reconstruction requires 2 trustees
- Documented recovery protocol

---

Last Updated: 2024-07-29
Owner: Security Lead