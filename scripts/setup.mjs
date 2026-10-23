#!/usr/bin/env node
/**
 * First-time setup checks (Windows, macOS, Linux):
 *   npm run setup        (also called by setup-windows.cmd)
 * - checks the Node.js version
 * - warns about OneDrive-synced or very long folder paths
 * - creates .env.local from .env.example if it does not exist (never overwrites)
 */
import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const warn = (s) => console.log(`  ⚠  ${s}`);
const ok = (s) => console.log(`  ✅ ${s}`);
const bad = (s) => console.log(`  ❌ ${s}`);

console.log("\nCareerSignal AI - setup checks\n");
console.log(`Folder: ${cwd}\n`);

// 1. Node.js version (Next.js 16 needs >= 20.9)
const [maj, min] = process.versions.node.split(".").map(Number);
if (maj < 20 || (maj === 20 && min < 9)) {
  bad(`Node.js ${process.versions.node} is too old. Install the LTS version from https://nodejs.org and run setup again.`);
  process.exit(1);
}
ok(`Node.js ${process.versions.node}`);

// 2. OneDrive / long path warnings (not blocking - the user decides)
const oneDriveRoots = [process.env.OneDrive, process.env.OneDriveCommercial, process.env.OneDriveConsumer].filter(Boolean);
const inOneDrive = /onedrive/i.test(cwd) || oneDriveRoots.some((r) => cwd.toLowerCase().startsWith(r.toLowerCase()));
if (inOneDrive) {
  warn("This folder is inside OneDrive. Expect slow installs and possible 'EPERM'/'EBUSY' errors while OneDrive syncs.");
  warn("OneDrive will also upload node_modules (~600 MB, ~23,000 files), your API key (.env.local) and your career data (.data).");
  warn("Recommended: move the project to a short local folder such as C:\\Dev\\CareerSignal-AI.");
} else ok("Folder is not inside OneDrive.");

// Deepest dependency path is ~132 characters below the project folder.
const projected = cwd.length + 133;
if (process.platform === "win32" && projected > 260) {
  warn(`Folder path is ${cwd.length} characters; dependency files would reach ~${projected} (Windows' classic limit is 260).`);
  warn("Some tools (Explorer, Git, antivirus, build tools) may fail on paths that long. A shorter folder avoids this.");
} else ok(`Folder path length ${cwd.length} characters.`);

// 3. Create the editable settings file
const env = path.join(cwd, ".env.local");
const example = path.join(cwd, ".env.example");
if (existsSync(env)) ok(".env.local already exists - left unchanged.");
else if (!existsSync(example)) {
  bad(".env.example is missing - are you in the project folder?");
  process.exit(1);
} else {
  copyFileSync(example, env);
  ok(`Created ${env}`);
}

console.log(`
Next:
  1. Open .env.local and set:  LLM_PROVIDER=gemini   and   GEMINI_API_KEY=<your key>
     (leave LLM_PROVIDER=mock to use demo mode without a key)
  2. npm run gemini:check      - verifies the key (optional but recommended)
  3. npm run dev               - then open http://localhost:3000
`);
