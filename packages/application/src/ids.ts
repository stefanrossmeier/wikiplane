import { randomUUID } from "node:crypto";

export function operationId(): string {
  return `op_${randomUUID().replaceAll("-", "")}`;
}

export function sourceId(): string {
  return `src_${randomUUID().replaceAll("-", "")}`;
}

export function isSourceId(value: string): boolean {
  return /^src_[A-Za-z0-9_-]+$/.test(value);
}

export function assertSourceId(value: string): void {
  if (!isSourceId(value)) throw new Error(`Invalid source id: ${value}`);
}
