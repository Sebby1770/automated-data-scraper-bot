import { execFile } from "node:child_process";
import type { Alert } from "../types.js";
import type { Notifier } from "./types.js";

export const IMESSAGE_OSASCRIPT_PATH = "/usr/bin/osascript";
export const DEFAULT_IMESSAGE_TIMEOUT_MS = 15_000;
export const DEFAULT_IMESSAGE_MAX_MESSAGE_LENGTH = 1_500;
export const DEFAULT_IMESSAGE_MAX_MESSAGES_PER_RUN = 20;

export const IMESSAGE_SEND_SCRIPT = `on run argv
  if (count of argv) is not 2 then error "Expected one recipient and one message."
  set recipientHandle to item 1 of argv
  set messageBody to item 2 of argv

  tell application "Messages"
    set targetService to first service whose service type = iMessage
    set targetBuddy to buddy recipientHandle of targetService
    send messageBody to targetBuddy
  end tell
end run`;

export interface IMessageCommandOptions {
  timeout: number;
  maxBuffer: number;
  shell: false;
  windowsHide: true;
}

export interface IMessageCommandResult {
  stdout: string;
  stderr: string;
}

export type IMessageCommandRunner = (
  executable: string,
  args: readonly string[],
  options: IMessageCommandOptions
) => Promise<IMessageCommandResult>;

export interface IMessageNotifierOptions {
  recipient: string;
  timeoutMs?: number;
  maxMessageLength?: number;
  maxMessagesPerRun?: number;
  platform?: NodeJS.Platform;
  commandRunner?: IMessageCommandRunner;
}

/**
 * Sends an alert through the signed-in macOS Messages app.
 *
 * Recipient and alert text are passed as argv values to `osascript`; neither is
 * interpolated into AppleScript or a shell command.
 */
export class IMessageNotifier implements Notifier {
  readonly name = "imessage";

  private readonly recipient: string;
  private readonly timeoutMs: number;
  private readonly maxMessageLength: number;
  private readonly maxMessagesPerRun: number;
  private readonly platform: NodeJS.Platform;
  private readonly commandRunner: IMessageCommandRunner;
  private sentCount = 0;

  constructor(options: IMessageNotifierOptions) {
    this.recipient = normalizeIMessageRecipient(options.recipient);
    this.timeoutMs = positiveInteger(options.timeoutMs ?? DEFAULT_IMESSAGE_TIMEOUT_MS, "timeoutMs", 60_000);
    this.maxMessageLength = positiveInteger(
      options.maxMessageLength ?? DEFAULT_IMESSAGE_MAX_MESSAGE_LENGTH,
      "maxMessageLength",
      5_000
    );
    this.maxMessagesPerRun = positiveInteger(
      options.maxMessagesPerRun ?? DEFAULT_IMESSAGE_MAX_MESSAGES_PER_RUN,
      "maxMessagesPerRun",
      100
    );
    this.platform = options.platform ?? process.platform;
    this.commandRunner = options.commandRunner ?? runExecFile;
  }

  async send(alert: Alert): Promise<void> {
    if (this.platform !== "darwin") {
      throw new Error("iMessage notifications are available only when the bot is running locally on macOS.");
    }

    if (this.sentCount >= this.maxMessagesPerRun) {
      throw new Error(
        `iMessage safety limit reached (${this.maxMessagesPerRun} messages in this run); remaining messages were not sent.`
      );
    }

    const message = formatIMessageAlert(alert, this.maxMessageLength);

    try {
      await this.commandRunner(
        IMESSAGE_OSASCRIPT_PATH,
        ["-e", IMESSAGE_SEND_SCRIPT, "--", this.recipient, message],
        {
          timeout: this.timeoutMs,
          maxBuffer: 16 * 1024,
          shell: false,
          windowsHide: true
        }
      );
      this.sentCount += 1;
    } catch (error) {
      throw new Error(describeIMessageFailure(error, this.timeoutMs));
    }
  }
}

export function formatIMessageAlert(alert: Alert, maxLength = DEFAULT_IMESSAGE_MAX_MESSAGE_LENGTH): string {
  const limit = positiveInteger(maxLength, "maxMessageLength", 5_000);
  const message = alert.message.trim() || alert.title.trim() || "Scraper Bot alert";
  const withUrl = alert.url && !message.includes(alert.url) ? `${message}\n${alert.url}` : message;
  return truncateUnicode(withUrl, limit);
}

export function normalizeIMessageRecipient(value: string): string {
  const recipient = value.trim();
  const looksLikeEmail = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(recipient);
  const looksLikePhone = /^\+?[0-9][0-9().\s-]{2,31}$/.test(recipient);

  if (!looksLikeEmail && !looksLikePhone) {
    throw new Error("IMESSAGE_RECIPIENT must contain one valid email address or phone number.");
  }

  if (
    Array.from(recipient).some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 0x1f || codePoint === 0x7f;
    })
  ) {
    throw new Error("IMESSAGE_RECIPIENT cannot contain control characters.");
  }

  return recipient;
}

function truncateUnicode(value: string, maxLength: number): string {
  const characters = Array.from(value);
  if (characters.length <= maxLength) {
    return value;
  }

  if (maxLength === 1) {
    return "…";
  }

  return `${characters.slice(0, maxLength - 1).join("")}…`;
}

function positiveInteger(value: number, name: string, maximum: number): number {
  if (!Number.isInteger(value) || value <= 0 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}.`);
  }
  return value;
}

function describeIMessageFailure(error: unknown, timeoutMs: number): string {
  const details = error as { code?: string | number; killed?: boolean; signal?: string; stderr?: string };
  const errorNumber = typeof details.stderr === "string" ? details.stderr.match(/\((-?\d+)\)\s*$/)?.[1] : undefined;

  if (details.killed || details.signal === "SIGTERM" || details.code === "ETIMEDOUT") {
    return `iMessage delivery timed out after ${timeoutMs} ms. Open Messages and check macOS Automation permission.`;
  }

  if (details.code === "ENOENT") {
    return "iMessage delivery failed because /usr/bin/osascript is unavailable; this notifier requires macOS.";
  }

  if (errorNumber === "-1743") {
    return "iMessage delivery was denied by macOS Automation permissions. Allow your terminal or Node process to control Messages in System Settings.";
  }

  if (errorNumber === "-1728") {
    return "iMessage could not resolve the configured recipient. Confirm the email or phone number is reachable in Messages.";
  }

  return "iMessage delivery failed. Confirm Messages is signed in, the recipient is valid, and macOS Automation permission is enabled.";
}

const runExecFile: IMessageCommandRunner = (executable, args, options) =>
  new Promise((resolve, reject) => {
    execFile(executable, [...args], options, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stderr });
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
