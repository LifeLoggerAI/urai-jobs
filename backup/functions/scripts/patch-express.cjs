const fs = require("fs");
const path = require("path");

function walk(dir, out) {
  if (!dir || !fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else if (ent.isFile() && p.endsWith(".js")) out.push(p);
  }
}

const cwd = process.cwd();

// firebase deploy runs "npm --prefix functions", so cwd is often ".../functions"
const candidates = [
  path.join(cwd, "dist"),
  path.join(cwd, "lib"),
  path.join(cwd, "functions", "dist"),
  path.join(cwd, "functions", "lib"),
];

let files = [];
for (const d of candidates) walk(d, files);
files = Array.from(new Set(files));

if (files.length === 0) {
  console.error("FATAL: no JS output files found in:", candidates);
  process.exit(2);
}

let touched = 0;
for (const fp of files) {
  let s = fs.readFileSync(fp, "utf8");
  const before = s;

  // Fix app creation
  s = s.replace(/\bconst\s+app\s*=\s*express\s*\(\s*\)\s*;/g, "const app = (express.default || express)();");

  // Fix any remaining direct calls
  s = s.replace(/\bexpress\s*\(\s*\)/g, "(express.default || express)()");

  // Avoid double-patching artifacts
  s = s.replace(/\(express\.default\s*\|\|\s*express\)\(\)\s*\(\s*\)/g, "(express.default || express)()");

  if (s !== before) {
    fs.writeFileSync(fp, s);
    touched++;
    console.log("PATCHED:", fp);
  }
}

console.log("Patched JS files:", touched);
if (touched === 0) {
  console.log("WARN: no changes made. Dumping any lines containing 'express' from likely entrypoints:");
  for (const fp of files.filter(f => /index\.js$/.test(f)).slice(0, 5)) {
    const lines = fs.readFileSync(fp, "utf8").split("\n");
    lines.forEach((ln,i)=>{ if (ln.includes("express")) console.log(fp+":"+String(i+1), ln); });
  }
}
