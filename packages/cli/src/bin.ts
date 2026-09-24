#!/usr/bin/env node
import { createService } from "./composition.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configIndex = args.indexOf("--config");
  const configPath =
    configIndex >= 0
      ? takeOption(args, configIndex, "--config")
      : (process.env.WIKIPLANE_CONFIG ?? "./wikiplane.yaml");
  const service = await createService(configPath);
  const [command, subcommand, ...rest] = args;

  let result: unknown;
  if (command === "brain" && subcommand === "init")
    result = await service.brainInit();
  else if (command === "ingest" && subcommand)
    result = await service.ingest(subcommand);
  else if (command === "source" && subcommand === "refresh" && rest[0])
    result = await service.refresh(rest[0]);
  else if (command === "source" && subcommand === "remove" && rest[0])
    result = await service.removeSource(rest[0]);
  else if (command === "status") result = await service.status();
  else if (command === "lint") result = await service.lint();
  else if (command === "rebuild")
    result = await service.rebuild(args.includes("--check"));
  else if (command === "recompile") result = await service.recompile();
  else if (command === "query")
    result = await service.query(
      [subcommand, ...rest].filter(Boolean).join(" "),
    );
  else {
    process.stderr.write(usage());
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (isFailedCheck(result)) process.exitCode = 1;
}

function takeOption(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value) throw new Error(`${name} requires a value`);
  args.splice(index, 2);
  return value;
}
function isFailedCheck(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === "object" &&
    "errors" in value &&
    Number((value as { errors: unknown }).errors) > 0,
  );
}
function usage(): string {
  return `Wikiplane\n\nUsage:\n  wikiplane [--config PATH] brain init\n  wikiplane [--config PATH] ingest <url-or-file>\n  wikiplane [--config PATH] source refresh <source-id>\n  wikiplane [--config PATH] source remove <source-id>\n  wikiplane [--config PATH] status\n  wikiplane [--config PATH] lint\n  wikiplane [--config PATH] rebuild [--check]\n  wikiplane [--config PATH] recompile --all\n  wikiplane [--config PATH] query "<question>"\n`;
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  process.stderr.write(`wikiplane: ${message}\n`);
  process.exit(1);
});
