'use strict';

/**
 * R1061: immutable fail-closed crossing point for future exclusive GCS writer.
 *
 * A worker cannot safely authorize private writes by reading consent or by
 * flipping a configuration flag. Its runtime identity must NOT be a Storage
 * writer. Actual IAM isolation, durable owner/purpose epochs, server-verified
 * signed authorization, active upload draining, object generation receipts
 * and independent GCS post-revocation denial are still unimplemented.
 *
 * This module deliberately has NO Storage client, HTTP upload, credentials,
 * environment override, dependency injection or success branch. Every call
 * rejects until a separately reviewed server/broker implementation replaces
 * this boundary and provider IAM has been independently verified.
 */
function privateOutputBrokerCertified() {
  return false;
}

async function submitPrivateOutputToExclusiveBroker(_intent) {
  throw new Error('life_movie_exclusive_storage_broker_unavailable');
}

module.exports = { privateOutputBrokerCertified, submitPrivateOutputToExclusiveBroker };
