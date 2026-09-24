import { mkdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type {
  RepositoryOperation,
  RepositoryProvider,
  RepositorySession,
  RepositoryTarget,
} from '@wikiplane/application';

export class GitRepositoryProvider implements RepositoryProvider {
  async open(target: RepositoryTarget): Promise<RepositorySession> {
    await mkdir(target.workspaceRoot, { recursive: true });
    await ensureLocalRepositoryIfNeeded(target);
    const localWorkingRoot = await localWorkingRepository(target.remote);
    if (localWorkingRoot) {
      ensureClean(await git(localWorkingRoot, ['status', '--porcelain']));
      return new LocalWorkingRepositorySession(target, localWorkingRoot);
    }
    const repoKey = safeKey(target.remote);
    const controlRoot = join(target.workspaceRoot, 'repositories', repoKey);
    await mkdir(join(target.workspaceRoot, 'repositories'), { recursive: true });
    const branchExists = await remoteBranchExists(target.remote, target.branch);

    if (!branchExists) {
      return new EmptyRemoteSession(target);
    }

    if (!(await exists(join(controlRoot, '.git')))) {
      await rm(controlRoot, { recursive: true, force: true });
      await git(target.workspaceRoot, ['clone', '--no-tags', target.remote, controlRoot]);
    }
    await git(controlRoot, ['fetch', '--prune', 'origin', target.branch]);
    await git(controlRoot, ['checkout', '-B', target.branch, `origin/${target.branch}`]);
    await git(controlRoot, ['reset', '--hard', `origin/${target.branch}`]);
    ensureClean(await git(controlRoot, ['status', '--porcelain']));
    return new ExistingRemoteSession(target, controlRoot);
  }
}


class LocalWorkingRepositorySession implements RepositorySession {
  constructor(
    private readonly target: RepositoryTarget,
    private readonly repositoryRoot: string,
  ) {}

  async begin(operationId: string): Promise<RepositoryOperation> {
    const operationRoot = join(this.target.workspaceRoot, 'operations', operationId);
    await mkdir(join(this.target.workspaceRoot, 'operations'), { recursive: true });
    await rm(operationRoot, { recursive: true, force: true });
    const currentBranch = (await git(this.repositoryRoot, ['branch', '--show-current'])).trim();
    if (currentBranch !== this.target.branch) {
      await git(this.repositoryRoot, ['checkout', this.target.branch]);
    }
    ensureClean(await git(this.repositoryRoot, ['status', '--porcelain']));
    const baseSha = (await git(this.repositoryRoot, ['rev-parse', 'HEAD'])).trim();
    await git(this.repositoryRoot, ['worktree', 'add', '--detach', operationRoot, baseSha]);
    await configureAuthor(operationRoot, this.target);
    return new LocalWorkingGitOperation(
      operationId,
      operationRoot,
      this.target,
      this.repositoryRoot,
      baseSha,
      async () => {
        await git(this.repositoryRoot, ['worktree', 'remove', '--force', operationRoot]).catch(() => undefined);
        await rm(operationRoot, { recursive: true, force: true });
      },
    );
  }

  async close(): Promise<void> {}
}

class LocalWorkingGitOperation implements RepositoryOperation {
  private closed = false;
  constructor(
    readonly operationId: string,
    readonly root: string,
    private readonly target: RepositoryTarget,
    private readonly repositoryRoot: string,
    private readonly baseSha: string,
    private readonly closer: () => Promise<void>,
  ) {}

  async commit(message: string): Promise<string | null> {
    await stageManagedBrainState(this.root);
    const changed = (await git(this.root, ['status', '--porcelain'])).trim();
    if (!changed) return null;
    await git(this.root, ['commit', '-m', message]);
    const sha = (await git(this.root, ['rev-parse', 'HEAD'])).trim();
    const current = (await git(this.repositoryRoot, ['rev-parse', 'HEAD'])).trim();
    if (current !== this.baseSha) {
      throw new Error(`Brain branch moved during operation ${this.operationId}; refusing non-atomic update`);
    }
    ensureClean(await git(this.repositoryRoot, ['status', '--porcelain']));
    await git(this.repositoryRoot, ['merge', '--ff-only', sha]);
    return sha;
  }

  async push(): Promise<void> {
    const remotes = (await git(this.repositoryRoot, ['remote'])).trim().split(/\s+/).filter(Boolean);
    if (!remotes.includes('origin')) return;
    try {
      await git(this.repositoryRoot, ['push', 'origin', this.target.branch]);
    } catch (error) {
      await git(this.repositoryRoot, ['reset', '--hard', this.baseSha]).catch(() => undefined);
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.closer();
  }
}

class ExistingRemoteSession implements RepositorySession {
  constructor(
    private readonly target: RepositoryTarget,
    private readonly controlRoot: string,
  ) {}

  async begin(operationId: string): Promise<RepositoryOperation> {
    const operationRoot = join(this.target.workspaceRoot, 'operations', operationId);
    await mkdir(join(this.target.workspaceRoot, 'operations'), { recursive: true });
    await rm(operationRoot, { recursive: true, force: true });
    const baseRef = this.target.push ? `origin/${this.target.branch}` : this.target.branch;
    await git(this.controlRoot, ['worktree', 'add', '--detach', operationRoot, baseRef]);
    await configureAuthor(operationRoot, this.target);
    return new GitOperation(
      operationId,
      operationRoot,
      this.target,
      async (sha) => {
        if (!this.target.push) await git(this.controlRoot, ['reset', '--hard', sha]);
      },
      async () => {
        await git(this.controlRoot, ['worktree', 'remove', '--force', operationRoot]).catch(() => undefined);
        await rm(operationRoot, { recursive: true, force: true });
      },
    );
  }

  async close(): Promise<void> {}
}

class EmptyRemoteSession implements RepositorySession {
  constructor(private readonly target: RepositoryTarget) {}

  async begin(operationId: string): Promise<RepositoryOperation> {
    const operationRoot = join(this.target.workspaceRoot, 'operations', operationId);
    await mkdir(join(this.target.workspaceRoot, 'operations'), { recursive: true });
    await rm(operationRoot, { recursive: true, force: true });
    await mkdir(operationRoot, { recursive: true });
    await git(operationRoot, ['init']);
    await git(operationRoot, ['checkout', '-b', this.target.branch]);
    await git(operationRoot, ['remote', 'add', 'origin', this.target.remote]);
    await configureAuthor(operationRoot, this.target);
    return new GitOperation(
      operationId,
      operationRoot,
      this.target,
      async () => {},
      async () => { await rm(operationRoot, { recursive: true, force: true }); },
    );
  }

  async close(): Promise<void> {}
}

class GitOperation implements RepositoryOperation {
  private closed = false;

  constructor(
    readonly operationId: string,
    readonly root: string,
    private readonly target: RepositoryTarget,
    private readonly onCommit: (sha: string) => Promise<void>,
    private readonly closer: () => Promise<void>,
  ) {}

  async commit(message: string): Promise<string | null> {
    ensureInside(this.target.workspaceRoot, this.root);
    await stageManagedBrainState(this.root);
    const changed = (await git(this.root, ['status', '--porcelain'])).trim();
    if (!changed) return null;
    await git(this.root, ['commit', '-m', message]);
    const sha = (await git(this.root, ['rev-parse', 'HEAD'])).trim();
    await this.onCommit(sha);
    return sha;
  }

  async push(): Promise<void> {
    await git(this.root, ['push', 'origin', `HEAD:${this.target.branch}`]);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await this.closer();
  }
}

const MANAGED_BRAIN_PATHS = ['README.md', 'AGENTS.md', 'raw', 'wiki'] as const;

async function stageManagedBrainState(root: string): Promise<void> {
  const stageable: string[] = [];
  for (const path of MANAGED_BRAIN_PATHS) {
    if ((await exists(join(root, path))) || (await isTracked(root, path))) {
      stageable.push(path);
    }
  }
  if (stageable.length === 0) return;
  await git(root, ['add', '-A', '--', ...stageable]);
}

async function isTracked(root: string, path: string): Promise<boolean> {
  const output = await git(root, ['ls-files', '--', path]);
  return Boolean(output.trim());
}

async function configureAuthor(root: string, target: RepositoryTarget): Promise<void> {
  await git(root, ['config', 'user.name', target.authorName]);
  await git(root, ['config', 'user.email', target.authorEmail]);
}



async function ensureLocalRepositoryIfNeeded(target: RepositoryTarget): Promise<void> {
  const path = localRemotePath(target.remote);
  if (!path) return;
  await mkdir(path, { recursive: true });
  if (!(await exists(join(path, '.git')))) {
    await git(path, ['init', '-b', target.branch]);
    await configureAuthor(path, target);
  }
  try {
    await git(path, ['rev-parse', 'HEAD']);
  } catch {
    await configureAuthor(path, target);
    await git(path, ['add', '-A']);
    await git(path, ['commit', '--allow-empty', '-m', 'chore: initialize brain repository']);
  }
}

async function localWorkingRepository(remote: string): Promise<string | null> {
  const path = localRemotePath(remote);
  if (!path || !(await exists(path))) return null;
  if (await exists(join(path, '.git'))) return path;
  return null;
}

function localRemotePath(remote: string): string | null {
  if (remote.startsWith('file://')) return resolve(fileURLToPath(remote));
  if (remote.startsWith('/') || remote.startsWith('./') || remote.startsWith('../') || /^[A-Za-z]:[\\/]/.test(remote)) {
    return resolve(remote);
  }
  return null;
}

async function remoteBranchExists(remote: string, branch: string): Promise<boolean> {
  try {
    const output = await git(process.cwd(), ['ls-remote', '--heads', remote, `refs/heads/${branch}`]);
    return Boolean(output.trim());
  } catch {
    const local = localRemotePath(remote);
    if (local && await exists(local)) return false;
    throw new Error(`Unable to inspect repository remote: ${remote}`);
  }
}

function git(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolvePromise(stdout);
      else reject(new Error(`git ${args.join(' ')} failed (${code}): ${stderr.trim()}`));
    });
  });
}
function safeKey(remote: string): string {
  const tail = basename(remote.replace(/\.git$/, '')) || 'brain';
  const suffix = Buffer.from(remote).toString('base64url').slice(0, 12);
  return `${tail.replace(/[^A-Za-z0-9._-]+/g, '-')}-${suffix}`;
}
function ensureClean(output: string): void {
  if (output.trim()) throw new Error(`Repository control checkout is not clean:\n${output}`);
}
function ensureInside(root: string, candidate: string): void {
  const a = resolve(root);
  const b = resolve(candidate);
  if (b !== a && !b.startsWith(`${a}/`)) throw new Error('Repository operation escaped workspace root');
}
async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch { return false; }
}
