import { afterEach, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GitRepositoryProvider } from "../../packages/adapters/src/git-repository.js";

const exec = promisify(execFile);
const dirs: string[] = [];
afterEach(async () =>
  Promise.all(
    dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  ),
);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await exec("git", args, { cwd });
  return result.stdout.trim();
}

async function repositoryFixture() {
  const parent = await mkdtemp(join(tmpdir(), "wikiplane-git-"));
  dirs.push(parent);
  const repo = join(parent, "brain");
  await mkdir(repo);
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "Fixture");
  await git(repo, "config", "user.email", "fixture@example.invalid");
  await writeFile(join(repo, "README.md"), "# Brain\n");
  await git(repo, "add", "README.md");
  await git(repo, "commit", "-m", "initial");
  return { parent, repo, base: await git(repo, "rev-parse", "HEAD") };
}

describe("GitRepositoryProvider", () => {
  it("keeps writes isolated until an atomic fast-forward commit", async () => {
    const { parent, repo, base } = await repositoryFixture();
    const provider = new GitRepositoryProvider();
    const session = await provider.open({
      remote: repo,
      branch: "main",
      workspaceRoot: join(parent, "workspace"),
      authorName: "Wikiplane",
      authorEmail: "wikiplane@example.invalid",
      push: false,
    });
    const operation = await session.begin("op_test");
    await mkdir(join(operation.root, "wiki"), { recursive: true });
    await writeFile(join(operation.root, "wiki", "index.md"), "# Wiki Index\n");

    expect(await git(repo, "rev-parse", "HEAD")).toBe(base);
    await expect(
      readFile(join(repo, "wiki", "index.md"), "utf8"),
    ).rejects.toThrow();

    const commit = await operation.commit("feat(knowledge): test transaction");
    expect(commit).toBeTruthy();
    expect(await git(repo, "rev-parse", "HEAD")).toBe(commit);
    expect(await readFile(join(repo, "wiki", "index.md"), "utf8")).toBe(
      "# Wiki Index\n",
    );
    await operation.close();
    await session.close();
  });

  it("can initialize a new local brain repository path", async () => {
    const parent = await mkdtemp(join(tmpdir(), "wikiplane-git-new-"));
    dirs.push(parent);
    const repo = join(parent, "new-brain");
    const provider = new GitRepositoryProvider();
    const session = await provider.open({
      remote: repo,
      branch: "main",
      workspaceRoot: join(parent, "workspace"),
      authorName: "Wikiplane",
      authorEmail: "wikiplane@example.invalid",
      push: false,
    });
    const operation = await session.begin("op_init");
    await writeFile(join(operation.root, "README.md"), "# Brain\n");
    const commit = await operation.commit("chore(knowledge): initialize");
    await operation.close();
    await session.close();

    expect(commit).toBeTruthy();
    expect(await readFile(join(repo, "README.md"), "utf8")).toBe("# Brain\n");
    expect(await git(repo, "branch", "--show-current")).toBe("main");
  });

  it("discards a failed/uncommitted operation without changing the branch", async () => {
    const { parent, repo, base } = await repositoryFixture();
    const provider = new GitRepositoryProvider();
    const session = await provider.open({
      remote: repo,
      branch: "main",
      workspaceRoot: join(parent, "workspace"),
      authorName: "Wikiplane",
      authorEmail: "wikiplane@example.invalid",
      push: false,
    });
    const operation = await session.begin("op_failed");
    await mkdir(join(operation.root, "wiki"), { recursive: true });
    await writeFile(
      join(operation.root, "wiki", "should-not-survive.md"),
      "# transient\n",
    );
    await operation.close();
    await session.close();

    expect(await git(repo, "rev-parse", "HEAD")).toBe(base);
    await expect(
      readFile(join(repo, "wiki", "should-not-survive.md"), "utf8"),
    ).rejects.toThrow();
  });
});
