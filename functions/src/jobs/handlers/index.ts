import { buildLifeMapSnapshotHandler } from './build_life_map_snapshot';
import { exportScrollHandler } from './export_scroll';
import { generateClipsHandler } from './generate_clips';
import { maintenanceCompactLogsHandler } from './maintenance_compact_logs';
import { renderCinematicHandler } from './render_cinematic';
import { sendDigestEmailHandler } from './send_digest_email';
import { tagEntitiesHandler } from './tag_entities';
import { transcribeAudioHandler } from './transcribe_audio';

export const jobHandlers = {
  render_cinematic: renderCinematicHandler,
  generate_clips: generateClipsHandler,
  transcribe_audio: transcribeAudioHandler,
  tag_entities: tagEntitiesHandler,
  build_life_map_snapshot: buildLifeMapSnapshotHandler,
  send_digest_email: sendDigestEmailHandler,
  export_scroll: exportScrollHandler,
  maintenance_compact_logs: maintenanceCompactLogsHandler,
};