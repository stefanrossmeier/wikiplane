import { stat } from "node:fs/promises";
import type { AcquiredArtifact, WebConverter } from "@wikiplane/application";

export async function exerciseWebConverterContract(
  converter: WebConverter,
  artifact: AcquiredArtifact,
  outputDir: string,
): Promise<void> {
  const result = await converter.convert(artifact, outputDir);
  const info = await stat(result.markdownPath);
  if (!info.isFile())
    throw new Error("WebConverter markdownPath must point to a file");
  if (!result.adapter)
    throw new Error("WebConverter must identify the adapter");
}
