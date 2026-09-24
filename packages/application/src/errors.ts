export type FailureStage =
  | "ACQUIRE_FAILED"
  | "CONVERT_FAILED"
  | "OCR_FAILED"
  | "MODEL_FAILED"
  | "INTEGRATION_FAILED"
  | "CROSSLINK_FAILED"
  | "REBUILD_FAILED"
  | "LINT_FAILED"
  | "GIT_FAILED"
  | "PUSH_FAILED";

export class WikiplaneOperationError extends Error {
  constructor(
    readonly stage: FailureStage,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "WikiplaneOperationError";
  }
}

export async function atStage<T>(
  stage: FailureStage,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof WikiplaneOperationError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new WikiplaneOperationError(stage, message, { cause: error });
  }
}
