import type { ModelProvider } from "@wikiplane/application";

export async function exerciseModelProviderContract(
  provider: ModelProvider,
): Promise<void> {
  const response = await provider.complete({
    role: "query",
    messages: [{ role: "user", content: "contract probe" }],
    timeoutMs: 5_000,
  });
  if (typeof response.content !== "string")
    throw new Error("ModelProvider must return string content");
}
