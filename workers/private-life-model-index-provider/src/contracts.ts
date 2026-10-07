// Validate provider output before it reaches the private canonical evidence store.
// This validates structure and source bindings; it cannot certify testimony truth.
const IDS = /^[A-Za-z0-9_:-]{1,160}$/;
const EVIDENCE = new Set(['SOURCE_CAPTURED', 'SOURCE_DERIVED', 'DIRECT_SUBJECT_TESTIMONY', 'ATTRIBUTED_TESTIMONY', 'CORROBORATED_INFERENCE', 'CONTEXTUAL_RESEARCH']);
const PRECISION = new Set(['country', 'region', 'city', 'place', 'room', 'unknown']);

function fail(): never { throw new Error('invalid private extraction contract'); }
function object(value: any, keys?: string[]) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  if (keys && Object.keys(value).some(key => !keys.includes(key))) fail();
  return value;
}
function text(value: any, max = 4096, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) fail();
  return value;
}
function id(value: any): string { if (!IDS.test(text(value, 160))) fail(); return value; }
function list(value: any, max = 512): any[] { if (!Array.isArray(value) || value.length > max) fail(); return value; }
function confidence(value: any) { if (!Number.isFinite(value) || value < 0 || value > 1) fail(); }
function texts(value: any, max = 256): string[] { return list(value, max).map(item => text(item)); }
function uniqueIds(items: any[], key: string): Set<string> {
  const result = new Set<string>();
  for (const item of items) { object(item); const value = id(item[key]); if (result.has(value)) fail(); result.add(value); }
  return result;
}
function refs(value: any, known: Set<string>, min = 0) {
  const items = list(value);
  if (items.length < min || new Set(items).size !== items.length) fail();
  for (const item of items) if (!known.has(id(item))) fail();
  return items;
}
function date(value: any): number | undefined {
  if (value === undefined || value === '') return undefined;
  const input = text(value, 64);
  if (!/^\d{4}(?:-\d{2}(?:-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?)?)?$/.test(input)) fail();
  const day = input.slice(0, 10);
  const parsedDay = Date.parse(day.length === 4 ? day + '-01-01' : day.length === 7 ? day + '-01' : day);
  if (!Number.isFinite(parsedDay) || new Date(parsedDay).toISOString().slice(0, day.length) !== day) fail();
  const result = input.includes('T') ? Date.parse(input) : parsedDay;
  if (!Number.isFinite(result)) fail();
  return result;
}
function interval(start: any, end: any) {
  const from = date(start); const to = date(end);
  if (from !== undefined && to !== undefined && from > to) fail();
}
function attributes(value: any, depth = 0) {
  if (depth > 6) fail();
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') { if (!Number.isFinite(value)) fail(); return; }
  if (typeof value === 'string') { text(value, 4096, true); return; }
  if (Array.isArray(value)) { for (const item of list(value, 64)) attributes(item, depth + 1); return; }
  const entries = Object.entries(object(value));
  if (entries.length > 64) fail();
  for (const [key, item] of entries) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) fail();
    text(key, 160); attributes(item, depth + 1);
  }
}

export function validateExtraction(value: any, sourceEvidenceClass: string, transcriptLength: number): any {
  object(value, ['entities', 'claims', 'relationships', 'temporalStates', 'places', 'conflicts', 'negativeConstraints', 'sceneTruth']);
  if (!EVIDENCE.has(sourceEvidenceClass) || !Number.isSafeInteger(transcriptLength) || transcriptLength < 1 || JSON.stringify(value).length > 240000) fail();
  for (const key of ['entities', 'claims', 'relationships', 'temporalStates', 'places', 'conflicts', 'negativeConstraints']) list(value[key]);
  const entities = uniqueIds(value.entities, 'entityId');
  const claims = uniqueIds(value.claims, 'claimId');
  uniqueIds(value.places, 'placeId'); uniqueIds(value.conflicts, 'conflictId'); uniqueIds(value.negativeConstraints, 'constraintId');
  for (const entity of value.entities) {
    object(entity, ['entityId', 'type', 'label', 'aliases']);
    if (!['person', 'place', 'object', 'event', 'organization', 'animal', 'other'].includes(entity.type)) fail();
    text(entity.label); if (entity.aliases !== undefined) texts(entity.aliases, 64);
  }
  for (const claim of value.claims) {
    object(claim, ['claimId', 'subject', 'predicate', 'object', 'evidenceClass', 'confidence', 'time', 'place', 'sourceSpan', 'contradictedBy']);
    if (!entities.has(id(claim.subject))) fail();
    text(claim.predicate, 256); text(claim.object, 4096, true); confidence(claim.confidence);
    if (!EVIDENCE.has(claim.evidenceClass) || (claim.evidenceClass !== sourceEvidenceClass && claim.evidenceClass !== 'CORROBORATED_INFERENCE')) fail();
    const span = object(claim.sourceSpan, ['startChar', 'endChar']);
    if (!Number.isSafeInteger(span.startChar) || !Number.isSafeInteger(span.endChar) || span.startChar < 0 || span.startChar >= span.endChar || span.endChar > transcriptLength) fail();
    if (claim.time !== undefined) {
      object(claim.time, ['start', 'end', 'uncertainty']); interval(claim.time.start, claim.time.end);
      if (claim.time.uncertainty !== undefined) text(claim.time.uncertainty, 4096, true);
    }
    if (claim.place !== undefined) {
      object(claim.place, ['label', 'precision']);
      if (claim.place.label !== undefined) text(claim.place.label, 4096, true);
      if (claim.place.precision !== undefined && !PRECISION.has(claim.place.precision)) fail();
    }
    if (claim.contradictedBy !== undefined) {
      if (refs(claim.contradictedBy, claims).includes(claim.claimId)) fail();
    }
  }
  for (const relationship of value.relationships) {
    object(relationship, ['from', 'to', 'type', 'confidence']);
    if (!entities.has(id(relationship.from)) || !entities.has(id(relationship.to))) fail();
    text(relationship.type, 256); confidence(relationship.confidence);
  }
  for (const state of value.temporalStates) {
    object(state, ['entityId', 'validFrom', 'validTo', 'attributes']);
    if (!entities.has(id(state.entityId))) fail();
    interval(state.validFrom, state.validTo); object(state.attributes); attributes(state.attributes);
  }
  for (const place of value.places) {
    object(place, ['placeId', 'label', 'precision', 'attributes']);
    text(place.label); if (!PRECISION.has(place.precision)) fail();
    if (place.attributes !== undefined) { object(place.attributes); attributes(place.attributes); }
  }
  for (const conflict of value.conflicts) {
    object(conflict, ['conflictId', 'claimIds', 'reason']); refs(conflict.claimIds, claims, 2); text(conflict.reason);
  }
  for (const constraint of value.negativeConstraints) {
    object(constraint, ['constraintId', 'text', 'sourceClaimIds']); text(constraint.text); refs(constraint.sourceClaimIds, claims, 1);
  }
  const scene = object(value.sceneTruth, ['decision', 'reasons', 'requiredOcclusions']);
  if (!['READY', 'READY_WITH_OCCLUSION', 'READY_INTERPRETIVE', 'BLOCKED'].includes(scene.decision)) fail();
  texts(scene.reasons); if (scene.requiredOcclusions !== undefined) texts(scene.requiredOcclusions);
  if (scene.decision === 'READY_WITH_OCCLUSION' && !scene.requiredOcclusions?.length) fail();
  if (value.conflicts.length || value.claims.some((claim: any) => claim.contradictedBy?.length)) {
    scene.decision = 'BLOCKED';
    scene.reasons = [...new Set([...scene.reasons, 'Unresolved source contradictions require review.'])];
  }
  if (scene.decision !== 'BLOCKED' && !value.claims.length) {
    scene.decision = 'BLOCKED'; scene.reasons = [...scene.reasons, 'No provenance-bound claims are available.'];
  }
  return value;
}
