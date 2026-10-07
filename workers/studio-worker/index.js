const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { setTimeout, clearTimeout } = require('node:timers');
const { Transform } = require('node:stream');
const { pipeline } = require('node:stream/promises');
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

// Kept in parity with Jobs admission by life-movies-dimensions-smoke.mjs.
const LIFE_MOVIE_EXECUTION_BUDGET = {
  maxDurationMs: 30_000,
  maxPixelFrames: 1920 * 1080 * 30 * 15,
  maxFramePixels: 3840 * 2160,
  maxSources: 12,
  maxTimelineItems: 12,
  maxAudioCues: 12,
};

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// The queue's cancellation endpoint revokes this lease. Check the same durable
// authority during rendering, not just when the dispatcher starts the request.
function createRenderControl(job) {
  const jobId = safeSegment(String(job.jobId || ''), 'job_id');
  const jobType = String(job.jobType || job.type || '');
  if (!new Set(['studio.render.video', 'studio.assemble.video']).has(jobType)) throw new Error('unsupported_job_type');
  if (typeof job.leaseToken !== 'string' || !job.leaseToken) throw new Error('lease_token_required');
  const controller = new AbortController();
  const assembly = jobType === 'studio.assemble.video';
  const defaultTimeout = assembly ? 450000 : 110000;
  const requestedTimeout = Number(
    assembly
      ? process.env.URAI_STUDIO_ASSEMBLY_TIMEOUT_MS || defaultTimeout
      : process.env.URAI_STUDIO_RENDER_TIMEOUT_MS || defaultTimeout
  );
  const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
    ? Math.min(requestedTimeout, defaultTimeout) : defaultTimeout;
  const pollMs = Math.max(25, Math.min(1000, Number(process.env.URAI_STUDIO_LEASE_POLL_MS) || 1000));
  let pollTimer;
  let stopped = false;
  let checking;
  const abort = (code) => {
    if (!controller.signal.aborted) controller.abort(new Error(code));
  };
  const deadlineTimer = setTimeout(() => abort('render_deadline_exceeded'), timeoutMs);
  const wait = (promise) => new Promise((resolve, reject) => {
    const onAbort = () => reject(controller.signal.reason);
    // Attach handlers even after cancellation so late network errors are consumed.
    Promise.resolve(promise).then(resolve, reject).finally(() => controller.signal.removeEventListener('abort', onAbort));
    if (controller.signal.aborted) return onAbort();
    controller.signal.addEventListener('abort', onAbort, { once: true });
  });
  const check = async () => {
    if (controller.signal.aborted) throw controller.signal.reason;
    if (!checking) {
      checking = (async () => {
        const snapshot = await wait(admin.firestore().collection('jobs').doc(jobId).get());
        const current = snapshot.exists ? snapshot.data() : null;
        if (!current || current.status !== 'RUNNING' || current.execution?.leaseToken !== job.leaseToken) {
          throw new Error('render_lease_revoked');
        }
        if (current.tenantId !== job.tenantId || current.ownerUid !== job.ownerUid
          || (current.jobType || current.type) !== jobType
          || canonicalJson(current.payload) !== canonicalJson(job.payload)) {
          throw new Error('render_job_binding_mismatch');
        }
        if (current.ownerUid && current.consent?.purpose) {
          const id = crypto.createHash('sha256').update(`${current.ownerUid}\n${current.consent.purpose}`).digest('hex');
          const block = await wait(admin.firestore().collection('jobConsentBlocks').doc(id).get());
          if (block.exists && block.data()?.active === true) throw new Error('render_consent_revoked');
        }
      })().catch((error) => {
        const allowed = ['render_lease_revoked', 'render_job_binding_mismatch', 'render_consent_revoked', 'render_deadline_exceeded'];
        abort(allowed.includes(error?.message) ? error.message : 'render_authority_unavailable');
        throw controller.signal.reason;
      }).finally(() => { checking = undefined; });
    }
    await checking;
    if (controller.signal.aborted) throw controller.signal.reason;
  };
  const poll = async () => {
    try { await check(); } catch { return; }
    if (!stopped) pollTimer = setTimeout(poll, pollMs);
  };
  return {
    signal: controller.signal, wait, check,
    async start() { await check(); pollTimer = setTimeout(poll, pollMs); },
    stop() { stopped = true; clearTimeout(pollTimer); clearTimeout(deadlineTimer); },
  };
}

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
  const sceneTruthReceiptRef = String(payload.sceneTruthReceiptRef || '');
  if (!/^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/.test(sceneTruthReceiptRef)) throw new Error('invalid_scene_truth_receipt_ref');
  const sceneTruthDigest = String(payload.sceneTruthDigest || '');
  if (!/^[a-f0-9]{64}$/.test(sceneTruthDigest)) throw new Error('invalid_scene_truth_digest');
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
  const audioCues = Array.isArray(payload.audioCues) ? payload.audioCues : [];
  if (!sources.length || !timeline.length) throw new Error('sources_and_timeline_required');
  if (sources.length > LIFE_MOVIE_EXECUTION_BUDGET.maxSources
    || timeline.length > LIFE_MOVIE_EXECUTION_BUDGET.maxTimelineItems
    || audioCues.length > LIFE_MOVIE_EXECUTION_BUDGET.maxAudioCues) throw new Error('life_movie_too_large');

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
  if (totalTimelineMs > LIFE_MOVIE_EXECUTION_BUDGET.maxDurationMs
    || width * height > LIFE_MOVIE_EXECUTION_BUDGET.maxFramePixels
    || width * height * fps * totalTimelineMs / 1000 > LIFE_MOVIE_EXECUTION_BUDGET.maxPixelFrames) {
    throw new Error('life_movie_exceeds_synchronous_render_budget');
  }

  const audioRoles = new Set(['narration', 'dialogue', 'music', 'ambience', 'foley', 'effects']);
  const normalizedAudioCues = audioCues.map((raw, index) => {
    const sourceId = safeSegment(String(raw.sourceId || ''), 'audio_cue_source_id');
    const source = sourceById.get(sourceId);
    if (!source) throw new Error(`unknown_audio_cue_source:${sourceId}`);
    if (!source.mimeType.startsWith('audio/') && !source.mimeType.startsWith('video/')) {
      throw new Error(`audio_cue_source_not_audio_capable:${sourceId}`);
    }
    const role = String(raw.role || '');
    if (!audioRoles.has(role)) throw new Error(`invalid_audio_cue_role:${index}`);
    const startMs = Number(raw.startMs);
    const endMs = Number(raw.endMs);
    const sourceStartMs = Number(raw.sourceStartMs || 0);
    const gainDb = Number(raw.gainDb ?? 0);
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < 0 || endMs <= startMs) {
      throw new Error(`invalid_audio_cue_range:${index}`);
    }
    if (!Number.isInteger(sourceStartMs) || sourceStartMs < 0) throw new Error(`invalid_audio_cue_source_start:${index}`);
    if (!Number.isFinite(gainDb) || gainDb < -60 || gainDb > 12) throw new Error(`invalid_audio_cue_gain:${index}`);
    if (endMs > totalTimelineMs) throw new Error(`audio_cue_outside_timeline:${index}`);
    return { sourceId, role, startMs, endMs, sourceStartMs, gainDb };
  });

  const subtitleText = typeof payload.subtitleText === 'string' ? payload.subtitleText : '';
  if (Buffer.byteLength(subtitleText, 'utf8') > 2 * 1024 * 1024) throw new Error('subtitles_too_large');

  return {
    tenantId,
    projectId,
    renderPlanDigest,
    sceneTruthReceiptRef,
    sceneTruthDigest,
    width,
    height,
    fps,
    sources: [...sourceById.values()],
    sourceById,
    timeline: normalizedTimeline,
    audioCues: normalizedAudioCues,
    subtitleText,
    outputPrefix: safeOutputPrefix(String(payload.outputPrefix || ''), tenantId, projectId),
  };
}

const LIFE_MOVIE_ASSEMBLY_BUDGET = {
  maxSegments: 180,
  maxSegmentDurationMs: 15_000,
  maxDurationMs: 45 * 60 * 1000,
  maxVideoBytes: 640 * 1024 * 1024,
  maxSubtitleBytes: 16 * 1024 * 1024,
};

function allowedStudioOutputBuckets() {
  return new Set([
    String(process.env.GCS_BUCKET_NAME || '').trim(),
    ...String(process.env.URAI_STUDIO_OUTPUT_BUCKETS || '').split(',').map((value) => value.trim()),
  ].filter(Boolean));
}

function parsePrivateGcsRef(value, field) {
  if (typeof value !== 'string') throw new Error(`invalid_${field}`);
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(value);
  if (!match) throw new Error(`invalid_${field}`);
  return { bucket: match[1], objectPath: safeObjectPath(match[2], field) };
}

function parseAssemblyPayload(job) {
  const payload = job && typeof job.payload === 'object' && job.payload ? job.payload : {};
  if (payload.schemaVersion !== 'urai-life-movie-assembly-v1') throw new Error('unsupported_life_movie_assembly_schema');
  if (job.type !== 'studio.assemble.video' && job.jobType !== 'studio.assemble.video') throw new Error('unsupported_job_type');

  const tenantId = safeSegment(String(job.tenantId || ''), 'tenant_id');
  const planId = safeSegment(String(payload.planId || ''), 'plan_id');
  const projectId = safeSegment(String(payload.projectId || ''), 'project_id');
  const renderPlanDigest = String(payload.renderPlanDigest || '');
  const sceneTruthDigest = String(payload.sceneTruthDigest || '');
  const sceneTruthReceiptRef = String(payload.sceneTruthReceiptRef || '');
  if (!/^[a-f0-9]{64}$/.test(renderPlanDigest)) throw new Error('invalid_render_plan_digest');
  if (!/^[a-f0-9]{64}$/.test(sceneTruthDigest)) throw new Error('invalid_scene_truth_digest');
  if (!/^str_[A-Za-z0-9_-]{16,64}_[a-z0-9]{8,16}_[A-Za-z0-9_-]{40,64}$/.test(sceneTruthReceiptRef)) {
    throw new Error('invalid_scene_truth_receipt_ref');
  }
  if (payload.publicReleaseAuthorized !== false) throw new Error('public_release_must_be_false');
  if (payload.providerGenerationAuthorized !== false) throw new Error('provider_generation_must_be_false');

  const width = Number(payload.width);
  const height = Number(payload.height);
  const fps = Number(payload.fps);
  if (!Number.isInteger(width) || width < 320 || width > 1920 || width % 2 !== 0) throw new Error('invalid_width');
  if (!Number.isInteger(height) || height < 320 || height > 1080 || height % 2 !== 0) throw new Error('invalid_height');
  if (![24, 25, 30].includes(fps)) throw new Error('invalid_fps');

  const outputPrefix = safeOutputPrefix(String(payload.outputPrefix || ''), tenantId, projectId);
  const requiredFinalPrefix = `tenants/${tenantId}/life-movies/${projectId}/final/`;
  if (outputPrefix !== requiredFinalPrefix.slice(0, -1)
    && !outputPrefix.startsWith(requiredFinalPrefix)) throw new Error('assembly_output_prefix_mismatch');

  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  if (!segments.length || segments.length > LIFE_MOVIE_ASSEMBLY_BUDGET.maxSegments) {
    throw new Error('assembly_segment_count_invalid');
  }
  const allowedBuckets = allowedStudioOutputBuckets();
  const requiredSegmentPrefix = `tenants/${tenantId}/life-movies/${projectId}/segments/`;
  let previousEnd = 0;
  const normalized = segments.map((segment, index) => {
    if (Number(segment.index) !== index) throw new Error('assembly_segment_index_mismatch');
    const startMs = Number(segment.startMs);
    const endMs = Number(segment.endMs);
    if (!Number.isInteger(startMs) || !Number.isInteger(endMs) || startMs < previousEnd || endMs <= startMs) {
      throw new Error('assembly_segment_timeline_invalid');
    }
    if (endMs - startMs > LIFE_MOVIE_ASSEMBLY_BUDGET.maxSegmentDurationMs
      || endMs > LIFE_MOVIE_ASSEMBLY_BUDGET.maxDurationMs) {
      throw new Error('assembly_duration_budget_exceeded');
    }
    previousEnd = endMs;
    const video = parsePrivateGcsRef(segment.videoRef, 'assembly_video_ref');
    const subtitle = parsePrivateGcsRef(segment.subtitleRef, 'assembly_subtitle_ref');
    if (!allowedBuckets.has(video.bucket) || !allowedBuckets.has(subtitle.bucket)
      || !video.objectPath.startsWith(requiredSegmentPrefix)
      || !subtitle.objectPath.startsWith(requiredSegmentPrefix)) {
      throw new Error('assembly_segment_boundary_mismatch');
    }
    const videoChecksum = String(segment.videoChecksum || '');
    const subtitleChecksum = String(segment.subtitleChecksum || '');
    if (!/^[a-f0-9]{64}$/.test(videoChecksum) || !/^[a-f0-9]{64}$/.test(subtitleChecksum)) {
      throw new Error('assembly_segment_checksum_invalid');
    }
    return { index, startMs, endMs, video, subtitle, videoChecksum, subtitleChecksum };
  });

  return {
    tenantId, planId, projectId, renderPlanDigest, sceneTruthReceiptRef, sceneTruthDigest,
    width, height, fps, outputPrefix, segments: normalized,
  };
}

function parseSrtTime(value) {
  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(String(value).trim());
  if (!match || Number(match[2]) > 59 || Number(match[3]) > 59) throw new Error('assembly_subtitle_invalid');
  return (((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000) + Number(match[4]);
}

function formatSrtTime(value) {
  const bounded = Math.max(0, Math.trunc(value));
  const hours = Math.floor(bounded / 3600000);
  const minutes = Math.floor((bounded % 3600000) / 60000);
  const seconds = Math.floor((bounded % 60000) / 1000);
  const millis = bounded % 1000;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`;
}

function shiftSrt(value, offsetMs, nextIndex, durationMs) {
  const normalized = String(value || '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return { text: '', nextIndex };
  const out = [];
  let cursor = nextIndex;
  for (const block of normalized.split(/\n{2,}/)) {
    const lines = block.split('\n');
    const timingIndex = lines[0]?.includes('-->') ? 0 : 1;
    const match = /^(\d{2}:\d{2}:\d{2},\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2},\d{3})(?:\s+.*)?$/.exec(String(lines[timingIndex] || '').trim());
    const text = lines.slice(timingIndex + 1).join('\n').trim();
    if (!match || !text) throw new Error('assembly_subtitle_invalid');
    const localStart = parseSrtTime(match[1]);
    const localEnd = parseSrtTime(match[2]);
    if (localEnd <= localStart) throw new Error('assembly_subtitle_invalid');
    if (localEnd > durationMs) throw new Error('assembly_subtitle_outside_segment');
    const start = localStart + offsetMs;
    const end = localEnd + offsetMs;
    out.push(`${cursor}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${text}`);
    cursor += 1;
  }
  return { text: out.join('\n\n'), nextIndex: cursor };
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
    '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', outputPath,
  ];
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const { signal, ...spawnOptions } = options;
    if (signal?.aborted) return reject(signal.reason);
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'], ...spawnOptions });
    let killTimer;
    const abort = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 1000);
    };
    signal?.addEventListener('abort', abort, { once: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 32000) stderr = stderr.slice(-32000);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      if (signal?.aborted) return reject(signal.reason);
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
  ], { encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) throw new Error(`ffprobe_failed:${String(result.stderr || '').slice(-1000)}`);
  const parsed = JSON.parse(result.stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  return {
    video: streams.some((stream) => stream.codec_type === 'video'),
    audio: streams.some((stream) => stream.codec_type === 'audio'),
  };
}

// Hash equality proves fixity, not that a child can safely be concatenated.
// Only admit the exact H.264/AAC profile produced by this bounded renderer.
function probeNormalizedMovie(filePath, input, durationMs, expectedProfile) {
  const result = spawnSync('ffprobe', [
    '-v', 'error', '-show_data_hash', 'sha256',
    '-show_entries', 'stream=codec_type,codec_name,width,height,pix_fmt,sample_aspect_ratio,r_frame_rate,avg_frame_rate,time_base,profile,level,extradata_hash,sample_rate,channels,channel_layout,start_time,duration,nb_frames:format=duration',
    '-of', 'json', filePath,
  ], { encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024 });
  if (result.status !== 0) throw new Error('assembly_media_probe_failed');
  const parsed = JSON.parse(result.stdout || '{}');
  const streams = Array.isArray(parsed.streams) ? parsed.streams : [];
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');
  const durationSeconds = durationMs / 1000;
  const [rateNumerator, rateDenominator] = String(video?.avg_frame_rate || '').split('/').map(Number);
  const averageFps = rateNumerator / rateDenominator;
  if (streams.length !== 2 || !video || !audio
    || video.codec_name !== 'h264' || video.pix_fmt !== 'yuv420p'
    || video.width !== input.width || video.height !== input.height
    || video.sample_aspect_ratio !== '1:1' || !Number.isFinite(averageFps)
    || Math.abs(averageFps - input.fps) * durationSeconds > 1.01
    || audio.codec_name !== 'aac' || audio.profile !== 'LC'
    || Number(audio.sample_rate) !== 48000 || audio.channels !== 2 || audio.channel_layout !== 'stereo') {
    throw new Error('assembly_media_profile_mismatch');
  }
  // CFR video rounds to a frame and AAC rounds to a 1024-sample packet.
  // This tolerance applies to one artifact; it must never accumulate per child.
  const tolerance = 1 / input.fps + 1024 / 48000 + 0.002;
  for (const actual of [parsed.format?.duration, video.duration, audio.duration]) {
    if (!Number.isFinite(Number(actual)) || Math.abs(Number(actual) - durationSeconds) > tolerance) {
      throw new Error('assembly_media_duration_mismatch');
    }
  }
  for (const stream of [video, audio]) {
    if (!Number.isFinite(Number(stream.start_time)) || Number(stream.start_time) < -0.002
      || Number(stream.start_time) > tolerance) throw new Error('assembly_media_start_mismatch');
  }
  if (!Number.isInteger(Number(video.nb_frames))
    || Math.abs(Number(video.nb_frames) - durationSeconds * input.fps) > 1.01) {
    throw new Error('assembly_media_frame_count_mismatch');
  }
  const profile = {
    video: { codec: video.codec_name, pixelFormat: video.pix_fmt, width: video.width, height: video.height,
      sampleAspectRatio: video.sample_aspect_ratio, expectedFps: input.fps, timeBase: video.time_base,
      profile: video.profile, level: video.level, configurationHash: video.extradata_hash },
    audio: { codec: audio.codec_name, profile: audio.profile, sampleRate: Number(audio.sample_rate),
      channels: audio.channels, channelLayout: audio.channel_layout, timeBase: audio.time_base,
      configurationHash: audio.extradata_hash },
  };
  if (![video.extradata_hash, audio.extradata_hash].every((value) => /^SHA256:[a-f0-9]{64}$/.test(String(value)))) {
    throw new Error('assembly_media_configuration_missing');
  }
  if (expectedProfile && canonicalJson(profile) !== canonicalJson(expectedProfile)) {
    throw new Error('assembly_media_configuration_mismatch');
  }
  // FFprobe's guessed r_frame_rate can increase at concat packet boundaries;
  // retain that measurement while admitting by actual frame count/average rate.
  return { profile, durationMs: Number(parsed.format.duration) * 1000, videoFrames: Number(video.nb_frames),
    averageFrameRate: video.avg_frame_rate, inferredFrameRate: video.r_frame_rate };
}

function clipArgs(inputPath, outputPath, mimeType, durationSeconds, width, height, fps) {
  const visualFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=${fps},format=yuv420p`;
  if (mimeType.startsWith('image/')) {
    return [
      '-y', '-loop', '1', '-framerate', String(fps), '-i', inputPath,
      '-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
      '-t', String(durationSeconds),
      '-vf', visualFilter,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-crf', '20',
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
      '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-crf', '20',
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
      '-c:v', 'libx264', '-threads', '1', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-shortest', '-movflags', '+faststart', outputPath,
    ];
  }

  throw new Error('source_has_no_supported_media_stream');
}

async function mixAudioCues(baseMoviePath, outputPath, audioCues, localBySource, sourceById, signal) {
  if (!audioCues.length) {
    fs.renameSync(baseMoviePath, outputPath);
    return;
  }
  const args = ['-y', '-i', baseMoviePath];
  for (const cue of audioCues) {
    const sourcePath = localBySource.get(cue.sourceId);
    if (!sourcePath) throw new Error(`audio_cue_source_not_downloaded:${cue.sourceId}`);
    const streams = probeStreams(sourcePath);
    if (!streams.audio) throw new Error(`audio_cue_source_missing_audio:${cue.sourceId}`);
    args.push('-i', sourcePath);
  }

  const filters = ['[0:a:0]aformat=sample_rates=48000:channel_layouts=stereo[baseaudio]'];
  const mixInputs = ['[baseaudio]'];
  for (let index = 0; index < audioCues.length; index += 1) {
    const cue = audioCues[index];
    const inputIndex = index + 1;
    const durationSeconds = (cue.endMs - cue.startMs) / 1000;
    const sourceStartSeconds = cue.sourceStartMs / 1000;
    const label = `cue${index}`;
    filters.push(
      `[${inputIndex}:a:0]atrim=start=${sourceStartSeconds}:duration=${durationSeconds},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=${cue.gainDb}dB,adelay=${cue.startMs}|${cue.startMs}[${label}]`,
    );
    mixInputs.push(`[${label}]`);
  }
  filters.push(`${mixInputs.join('')}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=0:normalize=0[mixedaudio]`);

  args.push(
    '-filter_complex', filters.join(';'),
    '-map', '0:v:0', '-map', '[mixedaudio]',
    '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart',
    outputPath,
  );
  await run('ffmpeg', args, { signal });
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

async function assembleLifeMovie(job) {
  const input = parseAssemblyPayload(job);
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error('GCS_BUCKET_NAME_not_configured');
  const bucket = admin.storage().bucket(bucketName);
  const control = createRenderControl(job);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-life-movie-assembly-'));
  const attemptPrefix = `${input.outputPrefix.replace(/\/+$/, '')}/attempt-${crypto.randomUUID()}`;
  const writtenObjects = [];
  let completed = false;

  async function downloadVerified(location, expectedChecksum, localPath, budget) {
    let bytes = 0;
    const hash = crypto.createHash('sha256');
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        bytes += chunk.length;
        budget.used += chunk.length;
        if (budget.used > budget.max) return callback(new Error(budget.code));
        hash.update(chunk);
        callback(null, chunk);
      },
    });
    await pipeline(
      admin.storage().bucket(location.bucket).file(location.objectPath).createReadStream(),
      meter,
      fs.createWriteStream(localPath, { mode: 0o600 }),
      { signal: control.signal },
    );
    const actual = hash.digest('hex');
    if (actual !== expectedChecksum) throw new Error('assembly_segment_checksum_mismatch');
    return bytes;
  }

  async function uploadPrivateFile(localPath, destination, contentType) {
    await control.check();
    writtenObjects.push(destination);
    await pipeline(fs.createReadStream(localPath), bucket.file(destination).createWriteStream({
      resumable: false, metadata: { contentType, cacheControl: 'private, no-store' },
    }), { signal: control.signal });
  }

  try {
    await control.start();
    const videoBudget = { used: 0, max: LIFE_MOVIE_ASSEMBLY_BUDGET.maxVideoBytes, code: 'assembly_video_byte_budget_exceeded' };
    const subtitleBudget = { used: 0, max: LIFE_MOVIE_ASSEMBLY_BUDGET.maxSubtitleBytes, code: 'assembly_subtitle_byte_budget_exceeded' };
    const concatEntries = [];
    const segmentAuthority = [];
    const subtitleBlocks = [];
    let subtitleIndex = 1;
    let previousEnd = 0;
    let mediaProfile;

    for (const segment of input.segments) {
      await control.check();
      if (segment.startMs > previousEnd) {
        const gapPath = path.join(workDir, `gap-${String(segment.index).padStart(4, '0')}.mp4`);
        const gapDurationMs = segment.startMs - previousEnd;
        await run('ffmpeg', gapArgs(gapPath, gapDurationMs / 1000, input.width, input.height, input.fps), { signal: control.signal });
        const gapMedia = probeNormalizedMovie(gapPath, input, gapDurationMs, mediaProfile);
        mediaProfile = gapMedia.profile;
        concatEntries.push({ filePath: gapPath, durationMs: gapDurationMs });
      }

      const videoPath = path.join(workDir, `segment-${String(segment.index).padStart(4, '0')}.mp4`);
      const subtitlePath = path.join(workDir, `segment-${String(segment.index).padStart(4, '0')}.srt`);
      const videoBytes = await downloadVerified(segment.video, segment.videoChecksum, videoPath, videoBudget);
      const subtitleBytes = await downloadVerified(segment.subtitle, segment.subtitleChecksum, subtitlePath, subtitleBudget);
      const durationMs = segment.endMs - segment.startMs;
      const media = probeNormalizedMovie(videoPath, input, durationMs, mediaProfile);
      // Container metadata can survive a damaged media packet. Decode each
      // bounded child with fatal-error handling before admitting its bytes.
      await run('ffmpeg', ['-v', 'error', '-xerror', '-i', videoPath,
        '-map', '0:v:0', '-map', '0:a:0', '-fps_mode', 'passthrough', '-f', 'null', '-'],
      { signal: control.signal });
      mediaProfile = media.profile;
      concatEntries.push({ filePath: videoPath, durationMs });

      const shifted = shiftSrt(fs.readFileSync(subtitlePath, 'utf8'), segment.startMs, subtitleIndex, durationMs);
      if (shifted.text) subtitleBlocks.push(shifted.text);
      subtitleIndex = shifted.nextIndex;
      segmentAuthority.push({
        index: segment.index,
        startMs: segment.startMs,
        endMs: segment.endMs,
        videoChecksum: segment.videoChecksum,
        subtitleChecksum: segment.subtitleChecksum,
        videoBytes,
        subtitleBytes,
        media,
      });
      previousEnd = segment.endMs;
    }

    const concatPath = path.join(workDir, 'assembly-concat.txt');
    // Position every segment by declared timeline duration instead of allowing
    // frame/container rounding to compound across up to 180 child artifacts.
    fs.writeFileSync(concatPath, concatEntries.map((entry) =>
      `file '${entry.filePath.replace(/'/g, "'\\''")}'\nduration ${entry.durationMs / 1000}`
    ).join('\n') + '\n');
    const moviePath = path.join(workDir, 'life-movie-final.mp4');
    await run('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-copyts',
      '-t', String(previousEnd / 1000),
      '-c', 'copy', '-movflags', '+faststart', moviePath,
    ], { signal: control.signal });
    await control.check();
    const finalMedia = probeNormalizedMovie(moviePath, input, previousEnd, mediaProfile);

    const subtitlePath = path.join(workDir, 'life-movie-final.srt');
    fs.writeFileSync(subtitlePath, subtitleBlocks.join('\n\n') + (subtitleBlocks.length ? '\n' : ''), 'utf8');

    const movieHash = await sha256File(moviePath);
    const subtitleHash = await sha256File(subtitlePath);
    const manifest = {
      schemaVersion: 'urai-life-movie-assembly-receipt-v1',
      jobId: job.jobId,
      planId: input.planId,
      tenantId: input.tenantId,
      projectId: input.projectId,
      renderPlanDigest: input.renderPlanDigest,
      sceneTruthReceiptRef: input.sceneTruthReceiptRef,
      sceneTruthDigest: input.sceneTruthDigest,
      renderEngine: 'ffmpeg-concat',
      providerCalled: false,
      providerSpendAuthorized: false,
      publicReleaseAuthorized: false,
      segmentCount: input.segments.length,
      segmentAuthority,
      mediaContract: 'urai-life-movie-normalized-media-v1',
      timelineDurationMs: previousEnd,
      finalMedia,
      literalMediaAccepted: false,
      identityAccepted: false,
      productionAccepted: false,
      outputs: {
        mp4: { sha256: movieHash, mimeType: 'video/mp4' },
        srt: { sha256: subtitleHash, mimeType: 'application/x-subrip' },
      },
      generatedAt: new Date().toISOString(),
    };
    const manifestPath = path.join(workDir, 'life-movie-final.assembly-manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    const manifestHash = await sha256File(manifestPath);

    const outputPaths = {
      mp4: `${attemptPrefix}/life-movie-final.mp4`,
      srt: `${attemptPrefix}/life-movie-final.srt`,
      manifest: `${attemptPrefix}/life-movie-final.assembly-manifest.json`,
    };
    await uploadPrivateFile(moviePath, outputPaths.mp4, 'video/mp4');
    await uploadPrivateFile(subtitlePath, outputPaths.srt, 'application/x-subrip');
    await uploadPrivateFile(manifestPath, outputPaths.manifest, 'application/json');
    await control.check();
    completed = true;

    return {
      ok: true,
      mode: 'life-movie-ffmpeg-assembly',
      jobId: job.jobId,
      planId: input.planId,
      projectId: input.projectId,
      providerCalled: false,
      providerSpendAuthorized: false,
      publicReleaseAuthorized: false,
      outputs: [
        { kind: 'mp4', ref: `gs://${bucketName}/${outputPaths.mp4}`, mimeType: 'video/mp4', checksum: movieHash },
        { kind: 'srt', ref: `gs://${bucketName}/${outputPaths.srt}`, mimeType: 'application/x-subrip', checksum: subtitleHash },
        { kind: 'manifest', ref: `gs://${bucketName}/${outputPaths.manifest}`, mimeType: 'application/json', checksum: manifestHash },
      ],
      renderPlanDigest: input.renderPlanDigest,
      sceneTruthReceiptRef: input.sceneTruthReceiptRef,
      sceneTruthDigest: input.sceneTruthDigest,
    };
  } catch (error) {
    throw control.signal.aborted ? control.signal.reason : error;
  } finally {
    control.stop();
    fs.rmSync(workDir, { recursive: true, force: true });
    if (!completed) {
      const cleanup = await Promise.allSettled(writtenObjects.map((destination) =>
        bucket.file(destination).delete({ ignoreNotFound: true })));
      if (cleanup.some((result) => result.status === 'rejected')) {
        throw new Error('assembly_cleanup_incomplete');
      }
    }
  }
}

async function renderLifeMovie(job) {
  const input = parsePayload(job);
  const bucketName = process.env.GCS_BUCKET_NAME;
  if (!bucketName) throw new Error('GCS_BUCKET_NAME_not_configured');
  const bucket = admin.storage().bucket(bucketName);
  const control = createRenderControl(job);
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-life-movie-'));
  // Isolate every execution attempt so cancelled/stale work cannot overwrite or
  // delete a newer attempt's objects, even when the requested prefix is reused.
  const attemptPrefix = `${input.outputPrefix}/attempt-${crypto.randomUUID()}`;
  const writtenObjects = [];
  let completed = false;
  try {
    await control.start();
    const localBySource = new Map();
    const sourceIntegrity = new Map();
    let totalSourceBytes = 0;
    const usedSourceIds = new Set([
      ...input.timeline.map((item) => item.sourceId),
      ...input.audioCues.map((cue) => cue.sourceId),
    ]);
    for (const source of input.sources) {
      if (!usedSourceIds.has(source.id)) continue;
      const ext = path.extname(source.objectPath).slice(0, 10) || '.bin';
      const localPath = path.join(workDir, `source-${crypto.createHash('sha256').update(source.id).digest('hex').slice(0, 12)}${ext}`);
      let sourceBytes = 0;
      const sourceHash = crypto.createHash('sha256');
      const meter = new Transform({
        transform(chunk, _encoding, callback) {
          sourceBytes += chunk.length;
          totalSourceBytes += chunk.length;
          if (sourceBytes > 32 * 1024 * 1024 || totalSourceBytes > 64 * 1024 * 1024) {
            callback(new Error('source_byte_budget_exceeded'));
            return;
          }
          sourceHash.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(
        admin.storage().bucket(source.bucket).file(source.objectPath).createReadStream(),
        meter, fs.createWriteStream(localPath, { mode: 0o600 }), { signal: control.signal },
      );
      await control.check();
      sourceIntegrity.set(source.id, { sha256: sourceHash.digest('hex'), bytes: sourceBytes });
      localBySource.set(source.id, localPath);
    }

    const clipPaths = [];
    const segments = renderSegments(input.timeline);
    for (let index = 0; index < segments.length; index += 1) {
      await control.check();
      const item = segments[index];
      const clipPath = path.join(workDir, `clip-${String(index).padStart(4, '0')}.mp4`);
      const durationSeconds = (item.endMs - item.startMs) / 1000;
      if (item.kind === 'gap') {
        await run('ffmpeg', gapArgs(clipPath, durationSeconds, input.width, input.height, input.fps), { signal: control.signal });
      } else {
        const source = input.sourceById.get(item.sourceId);
        const sourcePath = localBySource.get(item.sourceId);
        await run('ffmpeg', clipArgs(sourcePath, clipPath, source.mimeType, durationSeconds, input.width, input.height, input.fps), { signal: control.signal });
      }
      clipPaths.push({ filePath: clipPath, durationMs: item.endMs - item.startMs });
    }

    const concatPath = path.join(workDir, 'concat.txt');
    fs.writeFileSync(concatPath, clipPaths.map((clip) =>
      `file '${clip.filePath.replace(/'/g, "'\\''")}'\nduration ${clip.durationMs / 1000}`
    ).join('\n') + '\n');
    const timelineDurationMs = input.timeline[input.timeline.length - 1].endMs;
    const baseMoviePath = path.join(workDir, 'life-movie-base.mp4');
    await run('ffmpeg', [
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath,
      '-copyts', '-t', String(timelineDurationMs / 1000),
      // Every segment already has the same H.264/AAC output profile. Remux it;
      // encoding the full movie again doubles CPU work and loses quality.
      '-c', 'copy',
      '-movflags', '+faststart', baseMoviePath,
    ], { signal: control.signal });

    const moviePath = path.join(workDir, 'life-movie.mp4');
    await mixAudioCues(baseMoviePath, moviePath, input.audioCues, localBySource, input.sourceById, control.signal);
    await control.check();
    const media = probeNormalizedMovie(moviePath, input, timelineDurationMs);

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
      sceneTruthReceiptRef: input.sceneTruthReceiptRef,
      sceneTruthDigest: input.sceneTruthDigest,
      renderEngine: 'ffmpeg',
      providerCalled: false,
      providerSpendAuthorized: false,
      spatialRequired: false,
      publicReleaseAuthorized: false,
      sourceCount: input.sources.length,
      timelineItemCount: input.timeline.length,
      timeline: input.timeline,
      audioCueCount: input.audioCues.length,
      audioCues: input.audioCues,
      gapTreatment: 'black-video-silent-audio',
      shortSourceTreatment: 'hold-last-video-frame-and-pad-silent-audio-to-declared-duration',
      mediaContract: 'urai-life-movie-normalized-media-v1',
      timelineDurationMs,
      media,
      literalMediaAccepted: false,
      identityAccepted: false,
      productionAccepted: false,
      sources: input.sources.map((source) => ({
        id: source.id,
        bucket: source.bucket,
        objectPath: source.objectPath,
        mimeType: source.mimeType,
        provenance: source.provenance,
        sourceRefs: source.sourceRefs,
        consentRef: source.consentRef,
        ownerOrRightsRef: source.ownerOrRightsRef,
        ...(sourceIntegrity.has(source.id) ? { downloadedBytes: sourceIntegrity.get(source.id) } : { usedInRender: false }),
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
      mp4: `${attemptPrefix}/life-movie.mp4`,
      srt: `${attemptPrefix}/life-movie.srt`,
      manifest: `${attemptPrefix}/life-movie.render-manifest.json`,
    };
    async function uploadPrivateFile(localPath, destination, contentType) {
      await control.check();
      writtenObjects.push(destination);
      await pipeline(fs.createReadStream(localPath), bucket.file(destination).createWriteStream({
        resumable: false, metadata: { contentType, cacheControl: 'private, no-store' },
      }), { signal: control.signal });
    }
    await uploadPrivateFile(moviePath, outputPaths.mp4, 'video/mp4');
    await uploadPrivateFile(subtitlePath, outputPaths.srt, 'application/x-subrip');
    await uploadPrivateFile(manifestPath, outputPaths.manifest, 'application/json');
    await control.check();
    completed = true;

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
      sceneTruthReceiptRef: input.sceneTruthReceiptRef,
      sceneTruthDigest: input.sceneTruthDigest,
    };
  } catch (error) {
    throw control.signal.aborted ? control.signal.reason : error;
  } finally {
    control.stop();
    fs.rmSync(workDir, { recursive: true, force: true });
    if (!completed) {
      const cleanup = await Promise.allSettled(writtenObjects.map((destination) =>
        bucket.file(destination).delete({ ignoreNotFound: true })));
      if (cleanup.some((result) => result.status === 'rejected')) {
        throw new Error('render_cleanup_incomplete');
      }
    }
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
    const jobType = String(req.body?.jobType || req.body?.type || '');
    const result = jobType === 'studio.assemble.video'
      ? await assembleLifeMovie(req.body)
      : await renderLifeMovie(req.body);
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
