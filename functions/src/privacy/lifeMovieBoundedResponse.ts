/**
 * Read a provider-owned JSON response with a hard, streaming byte limit.
 *
 * Content-Length is advisory and may be omitted or dishonest. Never use
 * response.text(), since it buffers the entire response before size checks.
 * All callers convert these errors into their existing fail-closed code.
 */
export async function readLifeMovieBoundedJson(response: Response, maxBytes = 16_384): Promise<unknown> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 16_384) {
    throw new Error('life_movie_provider_response_invalid_limit');
  }
  const lengthHeader = response.headers.get('content-length');
  if (lengthHeader !== null &&
      (!/^[0-9]{1,6}$/.test(lengthHeader) || Number(lengthHeader) > maxBytes)) {
    throw new Error('life_movie_provider_response_invalid_length');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('life_movie_provider_response_missing_stream');
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!ArrayBuffer.isView(value) || value.BYTES_PER_ELEMENT !== 1) {
        throw new Error('life_movie_provider_response_invalid_chunk');
      }
      total += value.byteLength;
      if (total > maxBytes) throw new Error('life_movie_provider_response_oversize');
      chunks.push(Buffer.from(value));
    }
    if (total === 0) throw new Error('life_movie_provider_response_empty');
    return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
  } finally {
    try { await reader.cancel(); } catch { /* read failed or stream already completed */ }
    reader.releaseLock();
  }
}
