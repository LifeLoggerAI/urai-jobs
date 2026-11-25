const SH0 = 0.28209479177387814;
const FIELD_SIZES = { float: 4, float32: 4, double: 8, float64: 8, uchar: 1, uint8: 1 };
const REQUIRED = ['x', 'y', 'z', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3'];
// Match Spatial's bounded streaming decoder; accepted producer bytes must be
// valid inputs to the consumer before private runtime admission is considered.
const MAX_ABS_POSITION = 1e7;
const MAX_GAUSSIAN_SCALE = 1e4;
const MIN_GAUSSIAN_SCALE = 1e-7;

function packageGaussian(input, { maxRecords = 2000000, maxBytes = 512 * 1024 * 1024 } = {}) {
  if (!Buffer.isBuffer(input) || input.length > maxBytes) throw new Error('GAUSSIAN_SIZE_LIMIT');
  const end = input.indexOf(Buffer.from('end_header\n'));
  if (end < 0 || end > 65536) throw new Error('GAUSSIAN_HEADER_INVALID');
  const header = input.subarray(0, end).toString('ascii').split('\n');
  if (header[0] !== 'ply' || !header.includes('format binary_little_endian 1.0')) throw new Error('GAUSSIAN_FORMAT_UNSUPPORTED');
  const fields = []; let count = 0, stride = 0, inVertices = false;
  for (const line of header) {
    if (line.startsWith('element ')) {
      const [, element, value] = line.split(' ');
      inVertices = element === 'vertex';
      if (inVertices) count = Number(value);
      else if (Number(value) > 0) throw new Error('GAUSSIAN_EXTRA_ELEMENT');
    } else if (line.startsWith('property ') && inVertices) {
      const [, type, name] = line.split(' '), size = FIELD_SIZES[type];
      if (!size || !name || fields.some((field) => field.name === name)) throw new Error('GAUSSIAN_PROPERTY_UNSUPPORTED');
      fields.push({ type, name, offset: stride }); stride += size;
    }
  }
  if (!Number.isSafeInteger(count) || count < 1 || count > maxRecords || !stride) throw new Error('GAUSSIAN_RECORD_LIMIT');
  const start = end + 'end_header\n'.length;
  if (input.length !== start + count * stride || REQUIRED.some((name) => !fields.some((field) => field.name === name))) throw new Error('GAUSSIAN_LAYOUT_INVALID');
  const output = Buffer.alloc(count * 32), min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let visible = 0;
  const byte = (value) => Math.max(0, Math.min(255, Math.round(value)));
  for (let i = 0; i < count; i++) {
    const values = {};
    for (const field of fields) {
      const offset = start + i * stride + field.offset;
      values[field.name] = FIELD_SIZES[field.type] === 8 ? input.readDoubleLE(offset)
        : FIELD_SIZES[field.type] === 4 ? input.readFloatLE(offset) : input.readUInt8(offset);
      if (!Number.isFinite(values[field.name])) throw new Error('GAUSSIAN_NONFINITE');
    }
    const base = i * 32;
    for (let axis = 0; axis < 3; axis++) {
      const position = values[['x', 'y', 'z'][axis]], scale = Math.fround(Math.exp(values[`scale_${axis}`]));
      if (!Number.isFinite(scale) || scale < MIN_GAUSSIAN_SCALE || scale > MAX_GAUSSIAN_SCALE
        || !Number.isFinite(Math.fround(scale * scale)) || Math.fround(scale * scale) === 0
        || Math.abs(position) > MAX_ABS_POSITION) throw new Error('GAUSSIAN_RANGE_INVALID');
      output.writeFloatLE(position, base + axis * 4); output.writeFloatLE(scale, base + 12 + axis * 4);
      output[base + 24 + axis] = byte((0.5 + SH0 * values[`f_dc_${axis}`]) * 255);
      min[axis] = Math.min(min[axis], position - 3 * scale); max[axis] = Math.max(max[axis], position + 3 * scale);
    }
    output[base + 27] = byte(255 / (1 + Math.exp(-values.opacity)));
    if (output[base + 27]) visible++;
    const rotation = [0, 1, 2, 3].map((axis) => values[`rot_${axis}`]);
    const length = Math.hypot(...rotation);
    if (!Number.isFinite(length) || length < 1e-12) throw new Error('GAUSSIAN_ROTATION_INVALID');
    rotation.forEach((value, axis) => { output[base + 28 + axis] = byte(128 + 128 * value / length); });
  }
  if (!visible) throw new Error('GAUSSIAN_HAS_NO_VISIBLE_POINTS');
  return { runtime: output, records: count, bounds: { min, max } };
}

// This deliberately blocks the entire measured visual envelope. It is a safe
// candidate collision proxy, never a traversable interior or accepted navmesh.
function conservativeCollisionGlb(bounds) {
  const { min, max } = bounds;
  if ([...min, ...max].some((value) => !Number.isFinite(value)) || min.some((value, axis) => value >= max[axis])) throw new Error('COLLISION_BOUNDS_INVALID');
  const points = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
  const triangles = [0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5];
  const binary = Buffer.alloc(8 * 12 + triangles.length * 2);
  points.forEach((point, i) => point.forEach((value, axis) => binary.writeFloatLE(value ? max[axis] : min[axis], i * 12 + axis * 4)));
  triangles.forEach((value, i) => binary.writeUInt16LE(value, 96 + i * 2));
  const document = { asset: { version: '2.0', generator: 'UrAi conservative collision proxy v1' }, scene: 0, scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binary.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 96, target: 34962 }, { buffer: 0, byteOffset: 96, byteLength: triangles.length * 2, target: 34963 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min, max }, { bufferView: 1, componentType: 5123, count: triangles.length, type: 'SCALAR' }],
    extras: { classification: 'CONSERVATIVE_VISUAL_ENVELOPE', navigationAccepted: false, metricScaleVerified: false, publicReleaseAuthorized: false } };
  const raw = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(raw.length / 4) * 4, 32); raw.copy(json);
  const glb = Buffer.alloc(12 + 8 + json.length + 8 + binary.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20);
  const offset = 20 + json.length; glb.writeUInt32LE(binary.length, offset); glb.writeUInt32LE(0x004e4942, offset + 4); binary.copy(glb, offset + 8);
  return glb;
}

module.exports = { packageGaussian, conservativeCollisionGlb };
