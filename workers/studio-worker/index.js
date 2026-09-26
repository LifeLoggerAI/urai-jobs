const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const express = require('express');
const admin = require('firebase-admin');

admin.initializeApp();
const app = express();
app.use(express.json({ limit: '1mb' }));

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
]);

function timingSafeTokenMatch(actualHeader, expectedToken) {
  const actualHash = crypto.createHash('sha256').update(actualHeader).digest();
  const expectedHash = crypto.createHash('sha256').update(`Bearer ${expectedToken}`).digest();
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

function requireWorkerAuth(req, res, next) {
  const expectedToken = process.env.URAI_JOBS_WORKER_TOKEN;
  const env = String(process.env.URAI_ENV || process.env.NODE_ENV || 'local').toLowerCase();
  const localBypass = env === 'local' || env === 'test' || process.env.FUNCTIONS_EMULATOR === 'true';

  if (!expectedToken && localBypass) return next();
  if (!expectedToken) return res.status(503).send({ ok: false, error: 'worker auth is not configured' });
  if (!timingSafeTokenMatch(req.get('authorization') || '', expectedToken)) {
    return res.status(401).send({ ok: false, error: 'unauthorized' });
  }
  return next();
}

function safeSegment(value, field) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new Error(`invalid_${field}`);
  }
  return value;
}

function safeObjectPath(value, field) {
  if (typeof value !== 'string' || !value || value.startsWith('/') || value.includes('..') || value.includes('\\')) {
    throw new Error(`invalid_${field}`);
  }
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith('../')) throw new Error(`invalid_${field}`);
  return normalized;
}

function safeOutputPrefix(value, tenantId, projectId) {
  const prefix = safeObjectPath(value, 'output_prefix').replace(/\/+$/, '');
  const required = `tenants/${tenantId}/life-movies/${projectId}/`;
  if (!prefix.startsWith(required)) throw new Error('output_prefix_outside_tenant_project');
  return prefix;
}

function parsePayload(job) {
  const payload = job && typeof job.payload === 'object' && job.payload ? job.payload : {};
  if (payload.schemaVersion !== 'urai-life-movie-render-v1') throw new Error('unsupported_life_movie_schema');
  if (job.type !== 'studio.render.video' && job.jobType !== 'studio.render.video') throw new Error('unsupported_job_type');

  const tenantId = safeSegment(String(job.tenantId || ''), 'tenant_id');
  const projectId = safeSegment(String(payload.projectId || ''), 'project_id');
  const renderPlanDigest = String(payload.renderPlanDigest || '');
  if (!/^[a-f0-9]{64}$/.test(renderPlanDigest)) throw new Error('invalid_render_plan_digest');
  if (payload.publicReleaseAuthorized !== false) throw new Error('public_release_must_be_false');
  if (payload.providerGenerationAuthorized !== false) throw new Error('provider_generation_must_be_false');
  if (payload.spatialRequired !== false) throw new Error('spatial_required_must_be_false');

  const width = Number(payload.width || 1920);
  const height = Number(payload.height || 1080);
  const fps = Number(payload.fps || 30);
  if (!Number.isInteger(width) || width < 320 || width > 3840 || width % 2 !== 0) throw new Error('invalid_width');
  if (!Number.isInteger(height) || height < 320 || height > 3840 || height % 2 !== 0) throw new Error('invalid_height');
  if (![24, 25, 30, 50, 60].includes(fps)) throw new Error('invalid_fps');

  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  if (!sources.length || !timeline.length) throw new Error('sources_and_timeline_required');
  if (sources.length > 100 || timeline.length > 250) throw new Error('life_movie_too_large');

  const sourceById = new Map();
  for (const raw of sources) {
    const id = safeSegment(String(raw.id || ''), 'source_id');
    const bucket = safeSegment(String(raw.bucket || ''), 'source_bucket');
    const objectPath = safeObjectPath(raw.objectPath, 'source_object_path');
    const mimeType = String(raw.mimeType || '');
    if (!ALLOWED_MIME.has(mimeType)) throw new Error(`unsupported_source_mime:${mimeType}`);
    const allowedBuckets = new Set([
      String(process.env.GCS_BUCKET_NAME || '').trim(),
      ...String(process.env.URAI_STUDIO_SOURCE_BUCKETS || '').split(',').map((value) => value.trim()).filter(Boolean),
    ].filter(Boolean));
    if (!allowedBuckets.has(bucket)) throw new Error('source_bucket_not_allowed');
    if (![ `studios/${tenantId}/`, `tenants/${tenantId}/` ].some((prefix) => objectPath.startsWith(prefix))) throw new Error('source_outside_tenant');
    if (sourceById.has(id)) throw new Error(`duplicate_source:${id}`);
    sourceById.set(id, {
      id,
      bucket,
      objectPath,
      mimeType,
      provenance: String(raw.provenance || 'unknown'),
      sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs.map(String).slice(0, 32) : [],
      consentRef: safeSegment(String(raw.consentRef || ''), 'consent_ref'),
      ownerOrRightsRef: safeSegment(String(raw.ownerOrRightsRef || ''), 'rights_ref'),
    });
  }

  const normalizedTimeline = timeline.map((raw, index) => {
    const sourceId = safeSegment(String(raw.sourceId || ''), 'timeline_source_id');
    if (!sourceById.has(sourceId)) throw new Error(`unknown_timeline_source:${sourceId}`);
    const startMs = Number(raw.startMs);
    const endMs = Number(raw.endMs);
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) {
      throw new Error(`invalid_timeline_range:${index}`);
    }
    if (endMs - startMs > 30 * 60 * 1000) throw new Error(`timeline_item_too_long:${index}`);
    return { sourceId, startMs, endMs };
  }).sort((left, right) => left.startMs - right.startMs);

  for (let i = 1; i < normalizedTimeline.length; i += 1) {
    if (normalizedTimeline[i].startMs < normalizedTimeline[i - 1].endMs) {
      throw new Error('overlapping_timeline_not_supported');
    }
  }
  const totalTimelineMs = normalizedTimeline.reduce((max, item) => Math.max(max, item.endMs), 0);
  if (totalTimelineMs > 45 * 60 * 1000) throw new Error('life_movie_exceeds_launch_render_window');

  const subtitleText = typeof payload.subtitleText === 'string' ? payload.subtitleText : '';
  if (Buffer.byteLength(subtitleText, 'utf8') > 2 * 1024 * 1024) throw new Error('subtitles_too_large');

  return {
    tenantId,
    projectId,
    renderPlanDigest,
    width,
    height,
    fps,
    sources: [...sourceById.values()],
    sourceById,
    timeline: normalizedTimeline,
    subtitleText,
    outputPrefix: safeOutputPrefix(String(payload.outputPrefix || ''), tenantId, projectId),
  };
}

// Timeline coordinates describe output positions; preserve leading/inter-clip gaps.
function renderSegments(timeline) {
  const segments = [];
  let cursorMs = 0;
  for (const item of timeline) {
    if (item.startMs > cursorMs) segments.push({ kind: 'gap', startMs: cursorMs, endMs: item.startMs });
    segments.push({ kind: 'source', ...item });
    cursorMs = item.endMs;
  }
  return segments;
}

function gapArgs(outputPath, durationSeconds, width, height, fps) {
  return [
    '-y', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=${fps}`,
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-t', String(durationSeconds), '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', outputPath,
  ];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`${command}_failed_${code}:${stderr.slice(-4000)}`));
    });
  });
}

function probeStreams(filePath) {
  const result = spawnSync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'stream=codec_type',
    '-of', 'json',
    filePath,
  ], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`ffprobe_failed:${String(result.stderr || '').slice(-1000)}`);
  const parsed = JSON.parse(result.stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  return {
    video: streams.some((stream) => stream.codec_type === 'video'),
    audio: streams.some((stream) => stream.codec_type === 'audio'),
  };
}

function clipArgs(inputPath, outputPath, mimeType, durationSeconds, width, height, fps) {
  const visualFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,fps=${fps},format=yuv420p`;
  if (mimeType.startsWith('image/')) {
    return [
      '-y', '-loop', '1', '-framerate', String(fps), '-i', inputPath,
      '-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-t', String(durationSeconds),
      '-vf', visualFilter,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', outputPath,
    ];
  }

  const streams = probeStreams(inputPath);
  if (streams.video) {
    const args = ['-y', '-i', inputPath];
    if (!streams.audio) {
      args.push('-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
    }
    args.push('-t', String(durationSeconds), '-vf', `${visualFilter},tpad=stop_mode=clone:stop_duration=${durationSeconds}`, '-af', 'apad', '-map', '0:v:0');
    args.push(...(streams.audio ? ['-map', '0:a:0'] : ['-map', '1:a:0']));
    args.push(
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', outputPath,
    );
    return args;
  }

  if (streams.audio) {
    return [
      '-y', '-f', 'lavfi', '-i', `color=c=black:s=${width}x${height}:r=${fps}`,
      '-i', inputPath, '-t', String(durationSeconds), '-af', 'apad',
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', outputPath,
    ];
  }

  throw new Error('source_has_no_supported_media_stream');
}

async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(filePath);
    input.on('error', reject);
    input.on('data', (chunk) => hash.update(chunk));
    input.on('end', () => resolve(hash.digest('hex')));
  });
}

async function renderLifeMovie(job) {
  const input = parsePayload(job);
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error('GCS_BUCKET_NAME_not_configured');
  const bucket = admin.storage().bucket(bucketName);

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-life-movie-'));
  try {
    const localBySource = new Map();
    const usedSourceIds = new Set(input.timeline.map((item) => item.sourceId));
    for (const source of input.sources) {
      if (!usedSourceIds.has(source.id)) continue;
      const ext = path.extname(source.objectPath).slice(0, 10) || '.bin';
      const localPath = path.join(workDir, `source-${crypto.createHash('sha256').update(source.id).digest('hex').slice(0, 12)}${ext}`);
      await admin.storage().bucket(source.bucket).file(source.objectPath).download({ destination: localPath });
      localBySource.set(source.id, localPath);
    }

    const clipPaths = [];
    const segments = renderSegments(input.timeline);
    for (let index = 0; index < segments.length; index += 1) {
      const item = segments[index];
      const clipPath = path.join(workDir, `clip-${String(index).padStart(4, '0')}.mp4`);
      const durationSeconds = (item.endMs - item.startMs) / 1000;
      if (item.kind === 'gap') {
        await run('ffmpeg', gapArgs(clipPath, durationSeconds, input.width, input.height, input.fps));
      } else {
        const source = input.sourceById.get(item.sourceId);
        const sourcePath = localBySource.get(item.sourceId);
        await run('ffmpeg', clipArgs(sourcePath, clipPath, source.mimeType, durationSeconds, input.width, input.height, input.fps));
      }
      clipPaths.push(clipPath);
    }

    const concatPath = path.join(workDir, 'concat.txt');
    fs.writeFileSync(concatPath, clipPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const moviePath = path.join(workDir, 'life-movie.mp4');
    await run('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-movflags', '+faststart', moviePath,
    ]);

    const subtitlePath = path.join(workDir, 'life-movie.srt');
    fs.writeFileSync(subtitlePath, input.subtitleText, 'utf8');

    const movieHash = await sha256File(moviePath);
    const subtitleHash = await sha256File(subtitlePath);
    const manifest = {
      schemaVersion: 'urai-life-movie-render-receipt-v1',
      jobId: job.jobId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      renderPlanDigest: input.renderPlanDigest,
      renderEngine: 'ffmpeg',
      providerCalled: false,
      providerSpendAuthorized: false,
      spatialRequired: false,
      publicReleaseAuthorized: false,
      sourceCount: input.sources.length,
      timelineItemCount: input.timeline.length,
      timeline: input.timeline,
      gapTreatment: 'black-video-silent-audio',
      shortSourceTreatment: 'hold-last-video-frame-and-pad-silent-audio-to-declared-duration',
      sources: input.sources.map((source) => ({
        id: source.id,
        bucket: source.bucket,
        objectPath: source.objectPath,
        mimeType: source.mimeType,
        provenance: source.provenance,
        sourceRefs: source.sourceRefs,
        consentRef: source.consentRef,
        ownerOrRightsRef: source.ownerOrRightsRef,
      })),
      outputs: {
        mp4: { sha256: movieHash, mimeType: 'video/mp4' },
        srt: { sha256: subtitleHash, mimeType: 'application/x-subrip' },
      },
      generatedAt: new Date().toISOString(),
    };
    const manifestPath = path.join(workDir, 'life-movie.render-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const manifestHash = await sha256File(manifestPath);

    const outputPaths = {
      mp4: `${input.outputPrefix}/life-movie.mp4`,
      srt: `${input.outputPrefix}/life-movie.srt`,
      manifest: `${input.outputPrefix}/life-movie.render-manifest.json`,
    };
    await Promise.all([
      bucket.upload(moviePath, { destination: outputPaths.mp4, metadata: { contentType: 'video/mp4' } }),
      bucket.upload(subtitlePath, { destination: outputPaths.srt, metadata: { contentType: 'application/x-subrip' } }),
      bucket.upload(manifestPath, { destination: outputPaths.manifest, metadata: { contentType: 'application/json' } }),
    ]);

    return {
      ok: true,
      mode: 'life-movie-ffmpeg',
      jobId: job.jobId,
      projectId: input.projectId,
      providerCalled: false,
      providerSpendAuthorized: false,
      publicReleaseAuthorized: false,
      spatialRequired: false,
      outputs: [
        { kind: 'mp4', ref: `gs://${bucketName}/${outputPaths.mp4}`, mimeType: 'video/mp4', checksum: movieHash },
        { kind: 'srt', ref: `gs://${bucketName}/${outputPaths.srt}`, mimeType: 'application/x-subrip', checksum: subtitleHash },
        { kind: 'manifest', ref: `gs://${bucketName}/${outputPaths.manifest}`, mimeType: 'application/json', checksum: manifestHash },
      ],
      renderPlanDigest: input.renderPlanDigest,
    };
  } finally {
    fs.rmSync(workDir, { recursive: true, force: true });
  }
}

app.get('/', (_req, res) => {
  res.status(200).send({ service: 'studio-worker', ok: true, implementation: 'life-movie-ffmpeg-v1' });
});

function readiness() {
  const ffmpeg = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  const ffprobe = spawnSync('ffprobe', ['-version'], { encoding: 'utf8' });
  const sourceSha = String(process.env.URAI_SOURCE_SHA || '');
  const checks = {
    ffmpeg: ffmpeg.status === 0,
    ffprobe: ffprobe.status === 0,
    storageConfigured: Boolean(process.env.GCS_BUCKET_NAME),
    sourceBucketsConfigured: Boolean(process.env.URAI_STUDIO_SOURCE_BUCKETS || process.env.GCS_BUCKET_NAME),
    sourceShaExact: /^[0-9a-f]{40}$/.test(sourceSha),
    revisionPresent: Boolean(process.env.K_REVISION) || ['local', 'test'].includes(String(process.env.URAI_ENV || '').toLowerCase()),
  };
  return { ok: Object.values(checks).every(Boolean), checks, sourceSha };
}

app.get('/healthz', (_req, res) => {
  const state = readiness();
  res.status(state.ok ? 200 : 503).send({
    ok: state.ok,
    service: 'studio-worker',
    implementation: 'life-movie-ffmpeg-v1',
    sourceSha: state.sourceSha,
  });
});

app.get('/readyz', (_req, res) => {
  const state = readiness();
  res.status(state.ok ? 200 : 503).send({
    ok: state.ok,
    service: 'studio-worker',
    implementation: 'life-movie-ffmpeg-v1',
    sourceSha: state.sourceSha,
    revision: process.env.K_REVISION || null,
    checks: state.checks,
  });
});

app.get('/authz', requireWorkerAuth, (_req, res) => {
  res.status(200).send({ ok: true, service: 'studio-worker', authorized: true });
});

function publicErrorCode(error) {
  const message = error instanceof Error ? error.message : 'render_failed';
  const code = message.split(':', 1)[0].replace(/[^A-Za-z0-9_.-]+/g, '_').slice(0, 120);
  return code || 'render_failed';
}

app.post('/', requireWorkerAuth, async (req, res) => {
  const jobId = req.body?.jobId;
  const leaseToken = req.body?.leaseToken;
  if (!jobId || !leaseToken) return res.status(400).send({ ok: false, error: 'jobId and leaseToken are required' });

  try {
    const result = await renderLifeMovie(req.body);
    return res.status(200).send(result);
  } catch (error) {
    const errorCode = publicErrorCode(error);
    console.error('studio-worker render failed', { jobId, code: errorCode });
    return res.status(422).send({
      ok: false,
      code: 'STUDIO_RENDER_REJECTED',
      errorCode,
      jobId,
    });
  }
});

const port = Number(process.env.PORT) || 8080;
const host = process.env.HOST || '0.0.0.0';
app.listen(port, host, () => console.log(`studio-worker listening on ${host}:${port}`));
