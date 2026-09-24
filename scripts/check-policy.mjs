import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { promisify } from "node:util";

const root = process.cwd();
const errors = [];
const execFileAsync = promisify(execFile);

for (const required of [
  ".dockerignore",
  "README.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/adr/README.md",
  "docs/BACKLOG.md",
  "docs/release-checklist.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
  "third_party/llmwiki/LICENSE",
  "third_party/llmwiki/UPSTREAM.md",
  "third_party/safeplane/LICENSE",
  "third_party/safeplane/UPSTREAM.md",
]) {
  try {
    await access(join(root, required));
  } catch {
    errors.push(`missing required publication file: ${required}`);
  }
}

async function listPublishableFiles() {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      {
        cwd: root,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
      },
    );
    return stdout
      .split("\0")
      .filter(Boolean)
      .map((path) => join(root, path));
  } catch (error) {
    errors.push(
      `unable to enumerate publishable files with git: ${error instanceof Error ? error.message : String(error)}`,
    );
    return [];
  }
}

const files = await listPublishableFiles();

for (const path of files) {
  const rel = relative(root, path).replaceAll("\\", "/");
  if (rel.endsWith("/.DS_Store") || rel === ".DS_Store")
    errors.push(`forbidden OS metadata file: ${rel}`);
  if (/\.(?:pem|key|p12|pfx)$/i.test(rel))
    errors.push(`possible credential file is not allowed: ${rel}`);
  if ((rel === ".env" || rel.endsWith("/.env")) && rel !== ".env.example")
    errors.push(`runtime .env file must not be committed: ${rel}`);
}

const textualExtensions = new Set([
  ".ts",
  ".js",
  ".mjs",
  ".py",
  ".yaml",
  ".yml",
  ".json",
  ".md",
  ".toml",
  ".example",
  "",
]);
const secretPatterns = [
  /sk-or-v1-[A-Za-z0-9_-]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /ghp_[A-Za-z0-9]{30,}/,
];
for (const path of files) {
  const rel = relative(root, path).replaceAll("\\", "/");
  if (rel.startsWith("third_party/")) continue;
  if (!textualExtensions.has(extname(path))) continue;
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch {
    continue;
  }
  for (const pattern of secretPatterns) {
    if (pattern.test(text))
      errors.push(`possible secret pattern found in ${rel}: ${pattern}`);
  }
}

const coreRoot = join(root, "packages/core/src");
const providerNames =
  /\b(?:openrouter|markitdown|firecrawl|crawl4ai|jina reader)\b/i;
for (const path of files.filter((candidate) =>
  candidate.startsWith(coreRoot),
)) {
  const text = await readFile(path, "utf8");
  if (providerNames.test(text)) {
    errors.push(
      `provider-specific dependency/name leaked into core: ${relative(root, path)}`,
    );
  }
}

if (errors.length) {
  for (const error of errors) console.error(`policy: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`policy: ok (${files.length} publishable files checked)`);
}
