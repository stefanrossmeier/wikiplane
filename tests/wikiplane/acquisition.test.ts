import { describe, expect, it } from "vitest";
import { assertSafeRemoteUrl } from "../../packages/adapters/src/source-acquirer.js";

describe("safe acquisition", () => {
  it("blocks localhost and private addresses", async () => {
    await expect(
      assertSafeRemoteUrl(new URL("http://127.0.0.1/secret")),
    ).rejects.toThrow(/blocked/i);
    await expect(
      assertSafeRemoteUrl(new URL("http://10.0.0.1/secret")),
    ).rejects.toThrow(/blocked/i);
    await expect(
      assertSafeRemoteUrl(new URL("http://[::1]/secret")),
    ).rejects.toThrow(/blocked/i);
  });

  it("rejects URL credentials and unsupported schemes", async () => {
    await expect(
      assertSafeRemoteUrl(new URL("http://user:pass@example.com/")),
    ).rejects.toThrow(/credentials/i);
    await expect(
      assertSafeRemoteUrl(new URL("ftp://example.com/file")),
    ).rejects.toThrow(/scheme/i);
  });
});
