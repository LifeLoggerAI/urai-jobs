'use strict';

/**
 * R518 safety interlock for private Life Movie output writes.
 *
 * An old worker can pass a Firestore lease/consent read, pause, then
 * complete a GCS upload after revocation. Neither another read nor a
 * point-in-time Storage listing closes that race. Direct worker writes
 * MUST remain unavailable until a separately reviewed broker enforces
 * revocation epochs, active-attempt draining and scoped Storage IAM.
 *
 * There is intentionally no environment flag, test mode, caller receipt,
 * worker bearer token or job field that can turn this on. Enabling real
 * writes requires a new, reviewed implementation and IAM evidence.
 */
function privateOutputWriteAuthorityAvailable() {
  return false;
}

function assertPrivateOutputWriteAuthority() {
  if (!privateOutputWriteAuthorityAvailable()) {
    throw new Error('life_movie_storage_enforced_write_authority_unavailable');
  }
}

module.exports = {
  privateOutputWriteAuthorityAvailable,
  assertPrivateOutputWriteAuthority,
};
