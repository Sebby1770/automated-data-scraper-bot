import { createHash } from "node:crypto";

export function stableHash(input: unknown): string {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  return createHash("sha256").update(serialized).digest("hex");
}
