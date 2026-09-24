import { stat } from "node:fs/promises";
import type { SourceAcquirer } from "@wikiplane/application";

export async function exerciseSourceAcquirerContract(
  acquirer: SourceAcquirer,
  source: string,
  workspaceDir: string,
): Promise<void> {
  const artifact = await acquirer.acquire({
    source,
    workspaceDir,
    operationId: "contract",
  });
  if (artifact.suppliedReference !== source)
    throw new Error(
      "SourceAcquirer must preserve the supplied reference exactly",
    );
  const info = await stat(artifact.localPath);
  if (!info.isFile())
    throw new Error("SourceAcquirer localPath must point to a file");
}
