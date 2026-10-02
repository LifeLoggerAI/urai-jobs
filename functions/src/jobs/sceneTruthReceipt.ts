import { createHmac, timingSafeEqual } from 'node:crypto';

export type SceneTruthReceiptVerification =
  | { ok: true; expiresAt: number; receiptId: string }
  | { ok: false; code:
      | 'scene_truth_receipt_authority_unavailable'
      | 'invalid_scene_truth_receipt_ref'
      | 'scene_truth_receipt_expired'
      | 'invalid_scene_truth_receipt_signature' };

const RECEIPT_PATTERN = /^str_([A-Za-z0-9_-]{16,64})_([a-z0-9]{8,16})_([A-Za-z0-9_-]{40,64})$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const PROJECT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export function verifySceneTruthReceiptValue(
  projectId: string,
  digest: string,
  receiptRef: string,
  secret: string,
  nowMs = Date.now(),
): SceneTruthReceiptVerification {
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    return { ok: false, code: 'scene_truth_receipt_authority_unavailable' };
  }
  if (!PROJECT_PATTERN.test(projectId) || !DIGEST_PATTERN.test(digest)) {
    return { ok: false, code: 'invalid_scene_truth_receipt_ref' };
  }

  const match = RECEIPT_PATTERN.exec(receiptRef);
  if (!match) return { ok: false, code: 'invalid_scene_truth_receipt_ref' };

  const [, receiptId, expiryToken, suppliedSignature] = match;
  const expiresAt = Number.parseInt(expiryToken, 36);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    return { ok: false, code: 'scene_truth_receipt_expired' };
  }

  const message = `${receiptId}\n${projectId}\n${digest}\n${expiryToken}`;
  const expected = createHmac('sha256', secret).update(message).digest();
  let supplied: Buffer;
  try {
    supplied = Buffer.from(suppliedSignature, 'base64url');
  } catch {
    return { ok: false, code: 'invalid_scene_truth_receipt_signature' };
  }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return { ok: false, code: 'invalid_scene_truth_receipt_signature' };
  }

  return { ok: true, expiresAt, receiptId };
}

export function assertSceneTruthReceiptValue(
  projectId: string,
  digest: string,
  receiptRef: string,
  secret: string,
  nowMs = Date.now(),
) {
  const result = verifySceneTruthReceiptValue(projectId, digest, receiptRef, secret, nowMs);
  if (!result.ok) throw new Error(result.code);
  return result;
}
