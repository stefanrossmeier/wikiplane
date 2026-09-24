import { stat } from "node:fs/promises";
import type {
  AcquiredArtifact,
  DocumentConverter,
} from "@wikiplane/application";

export async function exerciseDocumentConverterContract(
  converter: DocumentConverter,
  artifact: AcquiredArtifact,
  outputDir: string,
): Promise<void> {
  if (!converter.supports(artifact))
    throw new Error("Fixture must be supported by the converter");
  const result = await converter.convert(artifact, outputDir);
  const info = await stat(result.markdownPath);
  if (!info.isFile())
    throw new Error("DocumentConverter markdownPath must point to a file");
  if (!result.adapter)
    throw new Error("DocumentConverter must identify the adapter");
}
