const MAX_ABS_POSITION = 1e7
const MAX_GAUSSIAN_SCALE = 1e4
const MIN_GAUSSIAN_SCALE = 1e-7

/** Streaming validation for the actual renderer GET, with bounded staging memory. */
export async function streamCapturedRealitySplat({
  url, maxBytes, chunkSize, signal, onHeader, onChunk, fetcher = fetch,
}: {
  url: string
  maxBytes: number
  chunkSize: number
  signal: AbortSignal
  onHeader: (bytes: number) => void
  onChunk: (chunk: Uint8Array, loadedBytes: number) => void | Promise<void>
  fetcher?: typeof fetch
}) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 32 || !Number.isSafeInteger(chunkSize) || chunkSize < 1 || chunkSize > 25_000) throw new Error('INVALID_SPLAT_BUDGET')
  signal.throwIfAborted()
  const response = await fetcher(url, { method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error', signal })
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let completed = false
  let staging: Uint8Array | undefined
  const cancel = () => { void reader?.cancel().catch(() => {}) }
  try {
    signal.throwIfAborted()
    const rawLength = response.headers.get('content-length')
    const bytes = rawLength && /^\d+$/.test(rawLength) ? Number(rawLength) : NaN
    const encoding = response.headers.get('content-encoding')
    if (response.status !== 200 || !response.body || !Number.isSafeInteger(bytes) || bytes < 32 || bytes % 32 || bytes > maxBytes || (encoding && encoding.toLowerCase() !== 'identity') || response.headers.has('content-range')) throw new Error('INVALID_SPLAT_RESPONSE')
    reader = response.body.getReader()
    signal.addEventListener('abort', cancel, { once: true })
    onHeader(bytes)
    signal.throwIfAborted()
    staging = new Uint8Array(Math.min(bytes, chunkSize * 32))
    let staged = 0
    let downloaded = 0
    let delivered = 0
    let visible = 0
    while (true) {
      const { value, done } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      downloaded += value.byteLength
      if (downloaded > bytes) throw new Error('SPLAT_BODY_EXCEEDS_DECLARED_LENGTH')
      let offset = 0
      while (offset < value.byteLength) {
        const count = Math.min(staging.length - staged, value.byteLength - offset)
        staging.set(value.subarray(offset, offset + count), staged)
        staged += count
        offset += count
        if (staged === staging.length) {
          visible += validateSplatRecords(staging)
          delivered += staged
          await onChunk(staging, delivered)
          signal.throwIfAborted()
          staged = 0
        }
      }
    }
    if (downloaded !== bytes || staged % 32) throw new Error('SPLAT_BODY_TRUNCATED')
    if (staged) {
      const tail = staging.subarray(0, staged)
      visible += validateSplatRecords(tail)
      await onChunk(tail, delivered + staged)
      signal.throwIfAborted()
    }
    if (!visible) throw new Error('SPLAT_HAS_NO_VISIBLE_POINTS')
    completed = true
    return { byteSize: bytes, pointCount: bytes / 32 }
  } finally {
    signal.removeEventListener('abort', cancel)
    staging?.fill(0)
    if (reader) {
      if (!completed) await reader.cancel().catch(() => {})
      reader.releaseLock()
    } else {
      await response.body?.cancel().catch(() => {})
    }
  }
}

/** Validate before any record reaches a GPU texture or sorting worker. */
export function validateSplatRecords(bytes: Uint8Array) {
  if (!bytes.byteLength || bytes.byteLength % 32) throw new Error('SPLAT_RECORD_INCOMPLETE')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let visible = 0
  for (let offset = 0; offset < bytes.byteLength; offset += 32) {
    for (let axis = 0; axis < 3; axis++) {
      const position = view.getFloat32(offset + axis * 4, true)
      const scale = view.getFloat32(offset + 12 + axis * 4, true)
      if (!Number.isFinite(position) || Math.abs(position) > MAX_ABS_POSITION) throw new Error('SPLAT_RECORD_INVALID_OR_EXTREME_POSITION')
      if (
        !Number.isFinite(scale) ||
        scale < MIN_GAUSSIAN_SCALE ||
        scale > MAX_GAUSSIAN_SCALE ||
        !Number.isFinite(Math.fround(scale * scale)) ||
        Math.fround(scale * scale) === 0
      ) throw new Error('SPLAT_RECORD_INVALID_OR_EXTREME_SCALE')
    }
    let norm = 0
    for (let axis = 0; axis < 4; axis++) norm += ((view.getUint8(offset + 28 + axis) - 128) / 128) ** 2
    if (norm < .9 ** 2 || norm > 1.1 ** 2) throw new Error('SPLAT_RECORD_INVALID_ROTATION')
    if (view.getUint8(offset + 27)) visible++
  }
  return visible
}

