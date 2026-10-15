import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { spawn } from 'node:child_process';
import { Readable, Writable } from 'node:stream';

const require = createRequire(import.meta.url);
const app = { use() {}, get() {}, post() {}, listen() {} };
const worker = {};
const code = fs.readFileSync(new URL('../workers/studio-worker/index.js', import.meta.url), 'utf8');
vm.runInNewContext(code
  + '\nmodule.exports = { clipArgs, probeNormalizedMovie };', {
  module: worker, Buffer, console, process: { env: { URAI_ENV: 'test' } },
  require(name) {
    if (name === 'express') return Object.assign(() => app, { json: () => () => {} });
    if (name === 'firebase-admin') return { initializeApp() {} };
    return require(name);
  },
});
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'urai-delayed-source-audio-'));
try {
  const source = path.join(root, 'synthetic-delayed-aac.mp4');
  const output = path.join(root, 'bounded-output.mp4');
  const make = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=320x320:rate=30',
    '-itsoffset', '0.184', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000', '-t', '1.4',
    '-c:v', 'libx264', '-threads', '1', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-ar', '48000', '-ac', '2', source], { encoding: 'utf8' });
  assert.equal(make.status, 0, make.stderr);
  const render = spawnSync('ffmpeg', worker.exports.clipArgs(source, output, 'video/mp4', 5, 320, 320, 30), { encoding: 'utf8' });
  assert.equal(render.status, 0, render.stderr);
  if (process.argv.includes('--reproduce')) {
    assert.throws(() => worker.exports.probeNormalizedMovie(output, { width: 320, height: 320, fps: 30 }, 5000), /assembly_media_(duration|start)_mismatch/);
    console.log('[REPRODUCED] actual delayed-AAC source produces a child outside the unchanged duration/start media contract');
  } else {
    const media = worker.exports.probeNormalizedMovie(output, { width: 320, height: 320, fps: 30 }, 5000);
    assert.equal(media.videoFrames, 150);
    const decode = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', output, '-f', 'null', '-'], { encoding: 'utf8' });
    assert.equal(decode.status, 0, decode.stderr);
    const pcm = spawnSync('ffmpeg', ['-v', 'error', '-i', output, '-map', '0:a:0', '-f', 's16le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 2 * 1024 * 1024 });
    assert.equal(pcm.status, 0, pcm.stderr.toString());
    const max = (start, end) => {
      let peak = 0;
      for (let n = start * 48000; n < end * 48000; n++) peak = Math.max(peak, Math.abs(pcm.stdout.readInt16LE(n * 2)));
      return peak;
    };
    assert.ok(max(0, 0.05) < 100, 'source initial audio offset must remain silence rather than advancing dialogue');
    assert.ok(max(0.4, 0.5) > 500, 'actual delayed dialogue must remain present');
    assert.ok(max(4, 4.1) < 100, 'short source must pad silence through declared output duration');
    console.log('[PASS] actual delayed-AAC input renders5s/150frames within unchanged media contract; initial silence, dialogue timing and trailing silence retained; full decode passes');

    // Reuse the explicit existing in-memory authority/Storage adapter while
    // executing the actual entire ordinary producer, not a mirrored renderer.
    const testCode = fs.readFileSync(new URL('./life-movies-assembly-media-smoke.mjs', import.meta.url), 'utf8');
    const harnessCode = testCode.slice(testCode.indexOf('function harness(job, options = {})'), testCode.indexOf('\nfunction test(name)'));
    const bucketName = 'private-fixture-bucket';
    const sourceObject = 'tenants/tenant-fixture-1/delayed-audio.mp4';
    const dialoguePath = path.join(root, 'longer-recorder-dialogue.mp3');
    const dialogueObject = 'tenants/tenant-fixture-1/longer-recorder-dialogue.mp3';
    const makeDialogue = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=880:sample_rate=44100',
      '-t', '8', '-c:a', 'libmp3lame', '-ac', '1', dialoguePath], { encoding: 'utf8' });
    assert.equal(makeDialogue.status, 0, makeDialogue.stderr);
    const objects = new Map([[sourceObject, fs.readFileSync(source)], [dialogueObject, fs.readFileSync(dialoguePath)]]);
    const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
    const context = { module: {}, assert, structuredClone, Buffer, crypto, code, require, vm, Readable, Writable, spawn, spawnSync,
      objects, bucketName, sha256, console, AbortController };
    vm.runInNewContext(harnessCode + '\nmodule.exports = harness;', context);
    for (const dialogue of ['none', 'camera-aac', 'camera-aac-offset', 'camera-aac-trimmed', 'recorder-mp3']) {
      const cameraCue = dialogue.startsWith('camera-aac');
      const sourceStartMs = dialogue === 'camera-aac-offset' ? 100 : dialogue === 'camera-aac-trimmed' ? 400 : 0;
      const job = { jobId: 'delayed-audio-fixture', ownerUid: 'owner-fixture-1', tenantId: 'tenant-fixture-1',
        type: 'studio.render.video', leaseToken: 'lease-fixture', payload: {
          schemaVersion: 'urai-life-movie-render-v1', projectId: 'project-fixture-1', renderPlanDigest: 'a'.repeat(64),
          sceneTruthReceiptRef: `str_fixturefixture1234_zzzzzzzz_${'A'.repeat(40)}`, sceneTruthDigest: 'b'.repeat(64),
          width: 320, height: 320, fps: 30, sources: [{ id: 'source', bucket: bucketName, objectPath: sourceObject,
            mimeType: 'video/mp4', provenance: 'original-source', sourceRefs: ['synthetic-delay-fixture'], consentRef: 'fixture-consent', ownerOrRightsRef: 'fixture-rights' },
            { id: 'recorder', bucket: bucketName, objectPath: dialogueObject, mimeType: 'audio/mpeg', provenance: 'original-source',
              sourceRefs: ['synthetic-recorder-fixture'], consentRef: 'fixture-consent', ownerOrRightsRef: 'fixture-rights' }],
          timeline: [{ sourceId: 'source', startMs: 0, endMs: 5000 }],
          audioCues: dialogue === 'none' ? [] : [{ sourceId: cameraCue ? 'source' : 'recorder', role: 'dialogue', startMs: 0, endMs: 5000, sourceStartMs, gainDb: 0 }],
          subtitleText: '', outputPrefix: 'tenants/tenant-fixture-1/life-movies/project-fixture-1/render',
          spatialRequired: false, publicReleaseAuthorized: false, providerGenerationAuthorized: false,
        } };
      const h = context.module.exports(job);
      if (process.argv.includes('--reproduce-mixed') && dialogue === 'recorder-mp3') {
        await assert.rejects(h.worker.renderLifeMovie(job), /assembly_media_duration_mismatch/);
        assert.equal(h.state.children.size, 0);
        assert.equal(h.state.uploads.length, 0);
        console.log('[REPRODUCED] entire ordinary producer with longer44.1kHz mono MP3 dialogue truncates audio below unchanged timeline duration gate; no output admitted');
        continue;
      }
      const result = await h.worker.renderLifeMovie(job);
      assert.equal(result.ok, true); assert.equal(h.state.children.size, 0);
      const movie = result.outputs.find(item => item.kind === 'mp4');
      const bytes = objects.get(movie.ref.slice(`gs://${bucketName}/`.length));
      assert.equal(sha256(bytes), movie.checksum);
      const wholeOutput = path.join(root, `whole-${dialogue}.mp4`); fs.writeFileSync(wholeOutput, bytes);
      const verified = worker.exports.probeNormalizedMovie(wholeOutput, { width: 320, height: 320, fps: 30 }, 5000);
      assert.equal(verified.videoFrames, 150);
      if (cameraCue) {
        const cameraPcm = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', wholeOutput, '-map', '0:a:0', '-f', 's16le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 2 * 1024 * 1024 });
        assert.equal(cameraPcm.status, 0, cameraPcm.stderr.toString());
        let initialPeak = 0;
        for (let frame = 0.01 * 48000; frame < 0.05 * 48000; frame++) {
          initialPeak = Math.max(initialPeak, Math.abs(cameraPcm.stdout.readInt16LE(frame * 2)));
        }
        if (sourceStartMs < 184) {
          assert.ok(initialPeak < 100, 'camera audio cue must preserve initial track silence rather than advance dialogue ahead of its source clock');
        } else {
          assert.ok(initialPeak > 500, 'trimming beyond the camera track delay must select audible dialogue at the beginning of the cue');
        }
        let dialoguePeak = 0;
        for (let frame = 0.3 * 48000; frame < 0.35 * 48000; frame++) {
          dialoguePeak = Math.max(dialoguePeak, Math.abs(cameraPcm.stdout.readInt16LE(frame * 2)));
        }
        assert.ok(dialoguePeak > 500, 'camera dialogue must remain audible after its selected track delay');
      }
      if (dialogue === 'recorder-mp3') {
        const finalPcm = spawnSync('ffmpeg', ['-v', 'error', '-xerror', '-i', wholeOutput, '-map', '0:a:0', '-f', 's16le', '-ac', '1', '-ar', '48000', '-'], { maxBuffer: 2 * 1024 * 1024 });
        assert.equal(finalPcm.status, 0, finalPcm.stderr.toString());
        let finalPeak = 0;
        for (let frame = 4.95 * 48000; frame < 4.99 * 48000; frame++) {
          finalPeak = Math.max(finalPeak, Math.abs(finalPcm.stdout.readInt16LE(frame * 2)));
        }
        assert.ok(finalPeak > 500, 'recorder dialogue must remain present through its declared final packet, not be replaced by silence');
      }
      console.log(`[PASS] entire actual ordinary producer with delayed AAC and ${dialogue} dialogue preserves5s/150frames and exact output hash; local adapters only`);
    }

    // Actual ordinary private worker, with a locally synthesized audible
    // spoken track and timed subtitles, using the existing Storage adapter.
    // This never contacts a voice provider, real user account or cloud bucket.
    const words = 'This is a synthetic UrAi narration. Your private memories stay yours.';
    const voice = spawnSync('espeak', ['-v', 'en-us', '-s', '175', '--stdout', words], {
      timeout: 15000, maxBuffer: 8 * 1024 * 1024,
    });
    assert.equal(voice.status, 0, voice.stderr.toString());
    assert.ok(voice.stdout.length > 10000, 'espeak must produce nonempty WAV');
    const quietPath = path.join(root, 'synthetic-quiet-video.mp4');
    const quiet = spawnSync('ffmpeg', [
      '-v','error','-y','-f','lavfi','-i','color=c=black:s=320x320:r=30',
      '-f','lavfi','-i','anullsrc=channel_layout=stereo:sample_rate=48000',
      '-t','5','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',
      '-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',quietPath,
    ], { encoding:'utf8', timeout:30000 });
    assert.equal(quiet.status,0,quiet.stderr);
    const quietObject = 'tenants/tenant-fixture-1/synthetic-quiet-video.mp4';
    const speechObject = 'tenants/tenant-fixture-1/synthetic-spoken-narration.wav';
    objects.set(quietObject, fs.readFileSync(quietPath));
    objects.set(speechObject, Buffer.from(voice.stdout));
    const timedCaptions = '1\n00:00:00,400 --> 00:00:02,300\nThis is a synthetic UrAi narration.\n\n' +
      '2\n00:00:02,300 --> 00:00:04,400\nYour private memories stay yours.\n';
    const spokenJob = {
      jobId:'spoken-synthetic-worker',ownerUid:'owner-fixture-1',tenantId:'tenant-fixture-1',
      type:'studio.render.video',leaseToken:'spoken-synthetic-lease',
      payload:{
        schemaVersion:'urai-life-movie-render-v1',projectId:'project-fixture-1',
        renderPlanDigest:'f'.repeat(64),
        sceneTruthReceiptRef:'str_fixturefixture1234_zzzzzzzz_' + 'A'.repeat(40),
        sceneTruthDigest:'b'.repeat(64),width:320,height:320,fps:30,
        sources:[
          {id:'quiet-camera',bucket:bucketName,objectPath:quietObject,mimeType:'video/mp4',
            provenance:'generated',sourceRefs:['synthetic-black-video'],consentRef:'synthetic-only',
            ownerOrRightsRef:'synthetic-only'},
          {id:'synthetic-narrator',bucket:bucketName,objectPath:speechObject,mimeType:'audio/wav',
            provenance:'generated',sourceRefs:['local-espeak-not-a-person'],consentRef:'synthetic-only',
            ownerOrRightsRef:'synthetic-only'},
        ],
        timeline:[{sourceId:'quiet-camera',startMs:0,endMs:5000}],
        audioCues:[{sourceId:'synthetic-narrator',role:'narration',startMs:400,endMs:4400,
          sourceStartMs:0,gainDb:0}],
        subtitleText:timedCaptions,
        outputPrefix:'tenants/tenant-fixture-1/life-movies/project-fixture-1/spoken-test',
        spatialRequired:false,publicReleaseAuthorized:false,providerGenerationAuthorized:false,
      },
    };
    const spokenHarness = context.module.exports(spokenJob);
    const spokenResult = await spokenHarness.worker.renderLifeMovie(spokenJob);
    assert.equal(spokenResult.ok,true);
    assert.equal(spokenResult.providerCalled,false);
    assert.equal(spokenResult.providerSpendAuthorized,false);
    assert.equal(spokenHarness.state.children.size,0);
    assert.equal(spokenHarness.state.uploads.length,3);
    assert.ok(spokenHarness.state.uploads.every(name =>
      name.startsWith('tenants/tenant-fixture-1/life-movies/project-fixture-1/spoken-test/attempt-')));
    const outputBytes = kind => {
      const artifact = spokenResult.outputs.find(item => item.kind === kind);
      assert.ok(artifact,'missing worker artifact: '+kind);
      const bytes = objects.get(artifact.ref.slice(('gs://' + bucketName + '/').length));
      assert.ok(bytes && bytes.length,'missing private worker object: '+kind);
      assert.equal(sha256(bytes),artifact.checksum);
      return bytes;
    };
    const actualMovie = path.join(root,'synthetic-worker-spoken-narration-5s.mp4');
    fs.writeFileSync(actualMovie,outputBytes('mp4'));
    assert.equal(outputBytes('srt').toString('utf8'),timedCaptions);
    const manifest = JSON.parse(outputBytes('manifest').toString('utf8'));
    assert.equal(manifest.timelineDurationMs,5000);
    assert.equal(manifest.audioCueCount,1);
    assert.equal(manifest.audioCues[0].role,'narration');
    assert.equal(manifest.audioCues[0].startMs,400);
    assert.equal(manifest.audioCues[0].endMs,4400);
    assert.equal(manifest.sources.find(s=>s.id==='synthetic-narrator').downloadedBytes.sha256,
      sha256(voice.stdout));
    for (const key of ['providerCalled','providerSpendAuthorized',
      'literalMediaAccepted','identityAccepted','productionAccepted']) {
      assert.equal(manifest[key],false,key+' must remain false');
    }
    const normalized = worker.exports.probeNormalizedMovie(actualMovie,
      {width:320,height:320,fps:30},5000);
    assert.equal(normalized.videoFrames,150);
    const decoded = spawnSync('ffmpeg',['-v','error','-xerror','-i',actualMovie,
      '-map','0:v:0','-map','0:a:0','-f','null','-'],
      {encoding:'utf8',timeout:30000});
    assert.equal(decoded.status,0,decoded.stderr);
    assert.equal(decoded.stderr.trim(),'');
    const probe = spawnSync('ffprobe',['-v','error',
      '-show_entries','stream=codec_name,sample_rate,channels','-of','json',actualMovie],
      {encoding:'utf8',timeout:15000});
    assert.equal(probe.status,0,probe.stderr);
    const streams = JSON.parse(probe.stdout).streams;
    assert.ok(streams.some(s=>s.codec_name==='h264'));
    assert.ok(streams.some(s=>s.codec_name==='aac' && s.sample_rate==='48000' && s.channels===2));
    const spokenPcm = spawnSync('ffmpeg',['-v','error','-xerror','-i',actualMovie,'-map','0:a:0',
      '-f','s16le','-ac','1','-ar','48000','-'],{maxBuffer:2*1024*1024,timeout:15000});
    assert.equal(spokenPcm.status,0,spokenPcm.stderr.toString());
    const peak = (first,last) => {
      let maximum=0;
      for(let i=Math.trunc(first*48000);i<Math.trunc(last*48000);i++){
        maximum=Math.max(maximum,Math.abs(spokenPcm.stdout.readInt16LE(i*2)));
      }
      return maximum;
    };
    assert.ok(peak(.05,.2)<150,'spoken cue may not start before 400ms');
    assert.ok(peak(.7,3.4)>500,'speech audible inside declared cue window');
    assert.ok(peak(4.7,4.9)<150,'speech must stop after 4400ms');
    console.log('[PASS] ACTUAL Jobs worker: local synthetic spoken narration + timed SRT + H264/AAC stereo, all hashes, full decode, private create-only outputs, no provider');

    const evidenceIndex=process.argv.indexOf('--evidence-dir');
    if(evidenceIndex>=0){
      assert.ok(process.argv[evidenceIndex+1],'evidence path required');
      const dir=path.resolve(process.argv[evidenceIndex+1]);
      fs.mkdirSync(dir,{recursive:true});
      fs.copyFileSync(actualMovie,path.join(dir,'synthetic-worker-spoken-narration-5s.mp4'));
      fs.writeFileSync(path.join(dir,'synthetic-worker-spoken-narration-5s.srt'),outputBytes('srt'));
      fs.writeFileSync(path.join(dir,'synthetic-worker-spoken-narration-5s.manifest.json'),outputBytes('manifest'));
      const evidence={
        schemaVersion:'urai-jobs-spoken-narration-original-worker-evidence-v1',
        exactJobsSourceSha:process.env.URAI_SOURCE_SHA||'unbound-local',
        execution:'original Jobs renderLifeMovie, synthetic in-memory private Storage authority adapter',
        originalJobsWorkerExecuted:true,authenticatedCloudStagingExecuted:false,
        realJobsBridgeAndSceneTruthHmacExecuted:false,protectedPlaybackExecuted:false,
        spokenSyntheticSource:true,words,paidProviderCalled:false,realFamilyVoiceUsed:false,
        jobId:spokenJob.jobId,sceneTruthReceiptRef:spokenJob.payload.sceneTruthReceiptRef,
        renderPlanDigest:spokenJob.payload.renderPlanDigest,
        sourceVideoSha256:sha256(objects.get(quietObject)),
        sourceNarrationWavSha256:sha256(voice.stdout),
        movieSha256:sha256(outputBytes('mp4')),subtitleSha256:sha256(outputBytes('srt')),
        manifestSha256:sha256(outputBytes('manifest')),
        videoFrames:150,durationMs:5000,codec:'H264/AAC 48000Hz stereo',
        narrationCueMs:[400,4400],subtitleCues:2,fullDecodePassed:true,
        outputObjectCount:spokenHarness.state.uploads.length,
        privateOutputCreateOnly:true,productionAcceptance:false,
      };
      fs.writeFileSync(path.join(dir,'synthetic-worker-spoken-narration-5s.proof.json'),
        JSON.stringify(evidence,null,2)+'\n');
    }
  }
} finally { fs.rmSync(root, { recursive: true, force: true }); }
