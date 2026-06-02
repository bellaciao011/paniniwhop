import { readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

const OWNER = 'bellaciao011';
const REPO = process.argv[2] || 'paniniwhop';
const BRANCH = 'main';
const TOKEN = process.env.GITHUB_TOKEN;
const ROOT = process.cwd();

if (!TOKEN) { console.error('GITHUB_TOKEN not set'); process.exit(1); }

const h = {
  Authorization: `token ${TOKEN}`,
  'Content-Type': 'application/json',
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'replit-push',
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const api = async (method, path, body, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
      method, headers: h,
      body: body ? JSON.stringify(body) : undefined,
    });
    const txt = await res.text();
    if (res.status === 403 || res.status === 429) {
      await sleep(3000 * (i + 1));
      continue;
    }
    if (!res.ok) throw new Error(`GitHub ${method} ${path} → ${res.status}: ${txt.slice(0,300)}`);
    return JSON.parse(txt);
  }
  throw new Error(`Rate limited after ${retries} retries`);
};

const makeBlob = async (filePath) => {
  const content = readFileSync(join(ROOT, filePath));
  const isText = ['.ts','.tsx','.js','.mjs','.cjs','.json','.yaml','.yml','.toml','.md','.html','.css','.sh','.lock','.txt','.prettierrc','.eslintrc','.gitignore','.npmrc','.replitignore','.gitattributes'].some(e => filePath.endsWith(e)) || !filePath.includes('.');
  const r = await api('POST', '/git/blobs', {
    content: content.toString(isText ? 'utf8' : 'base64'),
    encoding: isText ? 'utf-8' : 'base64',
  });
  return r.sha;
};

console.log(`Pushing all files to ${OWNER}/${REPO} (sequential, throttled)…`);

const ref = await api('GET', `/git/ref/heads/${BRANCH}`);
const currentSha = ref.object.sha;
const currentCommit = await api('GET', `/git/commits/${currentSha}`);
const baseTreeSha = currentCommit.tree.sha;
console.log(`Base: ${currentSha.slice(0,7)}, tree: ${baseTreeSha.slice(0,7)}`);

const allFiles = execSync('git ls-files', { cwd: ROOT }).toString().trim().split('\n').filter(Boolean);
const files = allFiles.filter(f =>
  !f.startsWith('attached_assets/') &&
  !f.startsWith('.canvas/assets/') &&
  !f.includes('.zip') &&
  !f.includes('"')
);
console.log(`${files.length} files to push`);

// Sequential with 300ms delay between each
const entries = [];
let ok = 0, fail = 0;

for (let i = 0; i < files.length; i++) {
  const p = files[i];
  try {
    const sha = await makeBlob(p);
    entries.push({ path: p, mode: '100644', type: 'blob', sha });
    ok++;
    if (i % 20 === 0) process.stdout.write(`  ${i + 1}/${files.length} (✓${ok} ✗${fail})\r`);
  } catch (e) {
    fail++;
    process.stdout.write(`  ✗ ${p}: ${e.message.slice(0,60)}\n`);
  }
  await sleep(100); // 100ms between blobs → ~10 per second → under rate limit
}

console.log(`\n✓ ${ok} blobs, ${fail} failed. Building tree…`);

const newTree = await api('POST', '/git/trees', {
  base_tree: baseTreeSha,
  tree: entries,
});

const localMsg = execSync('git log -1 --pretty=%s', { cwd: ROOT }).toString().trim();
const newCommit = await api('POST', '/git/commits', {
  message: `Full sync — ${ok} files\n\n${localMsg}`,
  tree: newTree.sha,
  parents: [currentSha],
});

await api('PATCH', `/git/refs/heads/${BRANCH}`, { sha: newCommit.sha, force: true });

console.log(`\n✓ ${OWNER}/${REPO}: ${newCommit.sha.slice(0,7)}`);
console.log(`  https://github.com/${OWNER}/${REPO}/commit/${newCommit.sha}`);
