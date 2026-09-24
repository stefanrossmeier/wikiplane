import type {
  ModelProvider,
  ModelRequest,
  ModelResponse,
  ModelRole,
} from "@wikiplane/application";

export interface GatewayModelProviderOptions {
  endpoint: string;
  roles: Record<ModelRole, string | undefined>;
  apiKey?: string;
}

export class GatewayModelProvider implements ModelProvider {
  constructor(private readonly options: GatewayModelProviderOptions) {}

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = this.options.roles[request.role];
    if (!model)
      throw new Error(`No model alias configured for role: ${request.role}`);
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      request.timeoutMs ?? 120_000,
    );
    try {
      const response = await fetch(
        `${this.options.endpoint.replace(/\/$/, "")}/chat/completions`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.options.apiKey ?? "wikiplane-internal"}`,
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            response_format:
              request.responseFormat === "json_object"
                ? { type: "json_object" }
                : undefined,
            metadata: request.metadata,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          `Model gateway failed: ${response.status} ${await response.text()}`,
        );
      const data = (await response.json()) as any;
      const choice = data.choices?.[0];
      return {
        content: String(choice?.message?.content ?? ""),
        model:
          typeof data.actual_model === "string"
            ? data.actual_model
            : typeof data.model === "string"
              ? data.model
              : model,
        provider: typeof data.provider === "string" ? data.provider : undefined,
        usage:
          data.usage && typeof data.usage === "object" ? data.usage : undefined,
        finishReason:
          typeof choice?.finish_reason === "string"
            ? choice.finish_reason
            : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
