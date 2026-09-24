import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const gateway = (
  process.env.MODEL_GATEWAY_URL ?? "http://127.0.0.1:8000/v1"
).replace(/\/$/, "");
const models = (process.env.WIKIPLANE_EVAL_MODELS ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
if (models.length === 0)
  throw new Error(
    "Set WIKIPLANE_EVAL_MODELS to comma-separated gateway/direct model IDs",
  );

const cases = [
  {
    name: "integration-structured-contradiction",
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Return only JSON with knowledge and contradictions. Extract durable concepts/entities and preserve explicit disagreement.",
      },
      {
        role: "user",
        content:
          "Source src_b says the retention period is 30 days. Existing source src_a says it is 90 days. Represent the durable concept and disagreement.",
      },
    ],
    check(text) {
      const value = JSON.parse(text);
      return (
        Array.isArray(value.knowledge) &&
        Array.isArray(value.contradictions) &&
        value.contradictions.length > 0
      );
    },
  },
  {
    name: "crosslink-precision",
    responseFormat: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          'Return only JSON {"links":[]}. Link only genuinely useful related pages and never invent paths.',
      },
      {
        role: "user",
        content:
          "Changed: concepts/git-native-knowledge.md. Available: entities/wikiplane.md (implements Git-native wiki compilation), entities/munich.md (a city).",
      },
    ],
    check(text) {
      const value = JSON.parse(text);
      return (
        Array.isArray(value.links) &&
        !value.links.some((x) => x?.to === "entities/munich.md")
      );
    },
  },
];

const results = [];
for (const model of models) {
  for (const testCase of cases) {
    const started = performance.now();
    let ok = false;
    let error = null;
    let usage = null;
    try {
      const response = await fetch(`${gateway}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model,
          messages: testCase.messages,
          response_format: testCase.responseFormat,
          temperature: 0,
        }),
      });
      if (!response.ok)
        throw new Error(`${response.status} ${await response.text()}`);
      const body = await response.json();
      const text = body?.choices?.[0]?.message?.content ?? "";
      ok = Boolean(testCase.check(text));
      usage = body?.usage ?? null;
    } catch (value) {
      error = value instanceof Error ? value.message : String(value);
    }
    results.push({
      model,
      case: testCase.name,
      ok,
      latency_ms: Math.round(performance.now() - started),
      usage,
      error,
    });
  }
}
await mkdir("evals/reports", { recursive: true });
const path = `evals/reports/model-eval-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
await writeFile(
  path,
  JSON.stringify(
    { generated_at: new Date().toISOString(), gateway, results },
    null,
    2,
  ),
);
console.log(JSON.stringify({ report: path, results }, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
