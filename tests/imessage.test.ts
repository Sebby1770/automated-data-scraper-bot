import { describe, expect, it, vi } from "vitest";
import {
  IMESSAGE_OSASCRIPT_PATH,
  IMESSAGE_SEND_SCRIPT,
  IMessageNotifier,
  formatIMessageAlert
} from "../src/notifiers/imessage.js";
import type { IMessageCommandRunner } from "../src/notifiers/imessage.js";
import { createNotifiers, getIMessageReadiness } from "../src/notifiers/index.js";
import type { Alert } from "../src/types.js";

const alert: Alert = {
  id: "alert-1",
  ruleName: "price-drop",
  sourceId: "demo",
  sourceLabel: "Demo",
  title: "A useful result",
  message: 'Price changed: "; do shell script "touch /tmp/never"',
  url: "https://example.com/item",
  matchedAt: "2026-09-02T10:00:00.000Z",
  item: {
    id: "item-1",
    sourceId: "demo",
    sourceLabel: "Demo",
    title: "A useful result",
    observedAt: "2026-09-02T10:00:00.000Z",
    data: {}
  }
};

describe("iMessage notifier", () => {
  it("passes untrusted recipient and message as argv without a shell", async () => {
    const commandRunner = vi.fn<IMessageCommandRunner>(async () => ({ stdout: "", stderr: "" }));
    const notifier = new IMessageNotifier({
      recipient: "alerts@example.com",
      platform: "darwin",
      commandRunner
    });

    await notifier.send(alert);

    expect(commandRunner).toHaveBeenCalledOnce();
    const [executable, args, options] = commandRunner.mock.calls[0];
    expect(executable).toBe(IMESSAGE_OSASCRIPT_PATH);
    expect(args.slice(0, 3)).toEqual(["-e", IMESSAGE_SEND_SCRIPT, "--"]);
    expect(args[3]).toBe("alerts@example.com");
    expect(args[4]).toContain(alert.message);
    expect(args[4]).toContain(alert.url);
    expect(args[1]).not.toContain(alert.message);
    expect(args[1]).not.toContain("alerts@example.com");
    expect(options.shell).toBe(false);
  });

  it("refuses to invoke osascript away from macOS", async () => {
    const commandRunner = vi.fn<IMessageCommandRunner>(async () => ({ stdout: "", stderr: "" }));
    const notifier = new IMessageNotifier({
      recipient: "+61 400 000 000",
      platform: "linux",
      commandRunner
    });

    await expect(notifier.send(alert)).rejects.toThrow("only when the bot is running locally on macOS");
    expect(commandRunner).not.toHaveBeenCalled();
  });

  it("enforces a per-run message cap", async () => {
    const commandRunner = vi.fn<IMessageCommandRunner>(async () => ({ stdout: "", stderr: "" }));
    const notifier = new IMessageNotifier({
      recipient: "alerts@example.com",
      platform: "darwin",
      maxMessagesPerRun: 1,
      commandRunner
    });

    await notifier.send(alert);
    await expect(notifier.send(alert)).rejects.toThrow("safety limit reached");
    expect(commandRunner).toHaveBeenCalledTimes(1);
  });

  it("does not leak the recipient or alert text through command errors", async () => {
    const commandRunner = vi.fn<IMessageCommandRunner>(async () => {
      throw Object.assign(new Error(`failed for alerts@example.com: ${alert.message}`), {
        stderr: "execution error: Not authorized to send Apple events. (-1743)"
      });
    });
    const notifier = new IMessageNotifier({
      recipient: "alerts@example.com",
      platform: "darwin",
      commandRunner
    });

    const failure = (await notifier.send(alert).catch((error: unknown) => error as Error)) as Error;
    expect(failure.message).toContain("Automation permissions");
    expect(failure.message).not.toContain("alerts@example.com");
    expect(failure.message).not.toContain(alert.message);
  });

  it("formats and unicode-truncates an alert within the configured limit", () => {
    const formatted = formatIMessageAlert({ ...alert, message: "😀😀😀😀", url: undefined }, 3);
    expect(formatted).toBe("😀😀…");
    expect(Array.from(formatted)).toHaveLength(3);
  });

  it("rejects multiple or malformed recipients", () => {
    expect(() => new IMessageNotifier({ recipient: "one@example.com,two@example.com" })).toThrow(
      "one valid email address or phone number"
    );
  });
});

describe("iMessage readiness", () => {
  const config = { type: "imessage" as const, enabled: true };

  it("requires macOS, a recipient, and an exact live-send opt-in", () => {
    expect(
      getIMessageReadiness(config, {
        platform: "darwin",
        env: { IMESSAGE_RECIPIENT: "alerts@example.com", IMESSAGE_ALLOW_SEND: "false" }
      })
    ).toMatchObject({ ready: false, reason: "Set IMESSAGE_ALLOW_SEND=true to unlock live sends" });

    expect(
      getIMessageReadiness(config, {
        platform: "linux",
        env: { IMESSAGE_RECIPIENT: "alerts@example.com", IMESSAGE_ALLOW_SEND: "true" }
      })
    ).toMatchObject({ ready: false, reason: expect.stringContaining("macOS only") });

    expect(
      getIMessageReadiness(config, {
        platform: "darwin",
        env: { IMESSAGE_RECIPIENT: "alerts@example.com", IMESSAGE_ALLOW_SEND: "true" }
      })
    ).toEqual({ ready: true, missingEnv: [] });
  });

  it("constructs the notifier only after all safety checks pass", () => {
    const commandRunner = vi.fn<IMessageCommandRunner>(async () => ({ stdout: "", stderr: "" }));
    const notifiers = createNotifiers([config], {
      platform: "darwin",
      env: { IMESSAGE_RECIPIENT: "alerts@example.com", IMESSAGE_ALLOW_SEND: "true" },
      imessageCommandRunner: commandRunner
    });

    expect(notifiers).toHaveLength(1);
    expect(notifiers[0]).toBeInstanceOf(IMessageNotifier);
  });

  it("does not silently replace a disabled or unavailable external notifier with console", () => {
    const unavailable = createNotifiers([config], {
      platform: "linux",
      env: { IMESSAGE_RECIPIENT: "alerts@example.com", IMESSAGE_ALLOW_SEND: "true" }
    });
    expect(unavailable).toHaveLength(0);

    expect(createNotifiers([{ type: "console", enabled: false }])).toHaveLength(0);
    expect(createNotifiers([])[0]?.name).toBe("console");
  });
});
