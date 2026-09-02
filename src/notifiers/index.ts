import type { Alert, NotifierConfig } from "../types.js";
import { ConsoleNotifier } from "./console.js";
import { DiscordNotifier } from "./discord.js";
import {
  IMessageNotifier,
  normalizeIMessageRecipient,
  type IMessageCommandRunner
} from "./imessage.js";
import { SlackNotifier } from "./slack.js";
import { TelegramNotifier } from "./telegram.js";
import { WebhookNotifier } from "./webhook.js";
import type { Notifier } from "./types.js";

export type TestableNotifierType = "discord" | "telegram" | "slack" | "webhook" | "imessage";

type IMessageNotifierConfig = Extract<NotifierConfig, { type: "imessage" }>;

export interface NotifierFactoryOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  imessageCommandRunner?: IMessageCommandRunner;
}

export interface IMessageReadiness {
  ready: boolean;
  missingEnv: string[];
  reason?: string;
}

export function createNotifiers(configs: NotifierConfig[], options: NotifierFactoryOptions = {}): Notifier[] {
  const notifiers: Notifier[] = [];
  const env = options.env ?? process.env;

  for (const config of configs) {
    if (config.enabled === false) {
      continue;
    }

    if (config.type === "console") {
      notifiers.push(new ConsoleNotifier());
      continue;
    }

    if (config.type === "discord") {
      const envName = config.webhookUrlEnv ?? "DISCORD_WEBHOOK_URL";
      const webhookUrl = env[envName];
      if (!webhookUrl) {
        console.warn(`Skipping Discord notifier because ${envName} is not set.`);
        continue;
      }
      notifiers.push(new DiscordNotifier(webhookUrl));
      continue;
    }

    if (config.type === "telegram") {
      const tokenEnv = config.botTokenEnv ?? "TELEGRAM_BOT_TOKEN";
      const chatEnv = config.chatIdEnv ?? "TELEGRAM_CHAT_ID";
      const token = env[tokenEnv];
      const chatId = env[chatEnv];
      if (!token || !chatId) {
        console.warn(`Skipping Telegram notifier because ${tokenEnv} or ${chatEnv} is not set.`);
        continue;
      }
      notifiers.push(new TelegramNotifier(token, chatId));
      continue;
    }

    if (config.type === "slack") {
      const envName = config.webhookUrlEnv ?? "SLACK_WEBHOOK_URL";
      const webhookUrl = env[envName];
      if (!webhookUrl) {
        console.warn(`Skipping Slack notifier because ${envName} is not set.`);
        continue;
      }
      notifiers.push(new SlackNotifier(webhookUrl));
      continue;
    }

    if (config.type === "webhook") {
      const envName = config.webhookUrlEnv ?? "WEBHOOK_URL";
      const webhookUrl = env[envName];
      if (!webhookUrl) {
        console.warn(`Skipping webhook notifier because ${envName} is not set.`);
        continue;
      }
      notifiers.push(new WebhookNotifier(webhookUrl));
      continue;
    }

    if (config.type === "imessage") {
      const readiness = getIMessageReadiness(config, options);
      if (!readiness.ready) {
        console.warn(`Skipping iMessage notifier: ${readiness.reason ?? "not ready"}.`);
        continue;
      }

      const recipientEnv = config.recipientEnv ?? "IMESSAGE_RECIPIENT";
      notifiers.push(
        new IMessageNotifier({
          recipient: env[recipientEnv]!,
          timeoutMs: config.timeoutMs,
          maxMessageLength: config.maxMessageLength,
          maxMessagesPerRun: config.maxMessagesPerRun,
          platform: options.platform,
          commandRunner: options.imessageCommandRunner
        })
      );
    }
  }

  if (notifiers.length > 0) {
    return notifiers;
  }

  // Console is an explicit, safe fallback only when the config asks for it or
  // when no notifier config was supplied at all. Never turn a missing/locked
  // external notifier into a successful console delivery: that would mark the
  // alert as delivered and prevent a retry on the next run.
  const consoleConfigured = configs.length === 0 || configs.some(
    (config) => config.type === "console" && config.enabled !== false
  );
  return consoleConfigured ? [new ConsoleNotifier()] : [];
}

export function createTestNotifier(type: TestableNotifierType, options: NotifierFactoryOptions = {}): Notifier {
  const env = options.env ?? process.env;

  if (type === "discord") {
    const webhookUrl = env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("DISCORD_WEBHOOK_URL is not set");
    }
    return new DiscordNotifier(webhookUrl);
  }

  if (type === "telegram") {
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set");
    }
    return new TelegramNotifier(token, chatId);
  }

  if (type === "webhook") {
    const webhookUrl = env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("WEBHOOK_URL is not set");
    }
    return new WebhookNotifier(webhookUrl);
  }

  if (type === "imessage") {
    const config: IMessageNotifierConfig = { type: "imessage", enabled: true };
    const readiness = getIMessageReadiness(config, options);
    if (!readiness.ready) {
      throw new Error(readiness.reason ?? "iMessage notifier is not ready");
    }

    return new IMessageNotifier({
      recipient: env.IMESSAGE_RECIPIENT!,
      platform: options.platform,
      commandRunner: options.imessageCommandRunner
    });
  }

  const webhookUrl = env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL is not set");
  }
  return new SlackNotifier(webhookUrl);
}

export function createTestAlert(): Alert {
  const matchedAt = new Date().toISOString();

  return {
    id: "test-alert",
    ruleName: "dashboard-test",
    sourceId: "dashboard",
    sourceLabel: "Dashboard",
    title: "Scraper Bot test alert",
    message: "This is a test notification from the Scraper Bot dashboard.",
    matchedAt,
    item: {
      id: "test-item",
      sourceId: "dashboard",
      sourceLabel: "Dashboard",
      title: "Scraper Bot test alert",
      observedAt: matchedAt,
      data: {
        kind: "test"
      }
    }
  };
}

export async function sendTestNotification(type: TestableNotifierType): Promise<void> {
  const notifier = createTestNotifier(type);
  await notifier.send(createTestAlert());
}

export function getIMessageReadiness(
  config: IMessageNotifierConfig,
  options: Pick<NotifierFactoryOptions, "env" | "platform"> = {}
): IMessageReadiness {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const recipientEnv = config.recipientEnv ?? "IMESSAGE_RECIPIENT";
  const allowSendEnv = config.allowSendEnv ?? "IMESSAGE_ALLOW_SEND";
  const missingEnv = [recipientEnv, allowSendEnv].filter((name) => !env[name]?.trim());

  if (config.enabled === false) {
    return { ready: false, missingEnv: [], reason: "Disabled" };
  }

  if (platform !== "darwin") {
    return {
      ready: false,
      missingEnv,
      reason: "macOS only; run the bot locally on a Mac"
    };
  }

  if (missingEnv.length > 0) {
    return {
      ready: false,
      missingEnv,
      reason: `${missingEnv.join(" and ")} ${missingEnv.length === 1 ? "is" : "are"} not set`
    };
  }

  if (env[allowSendEnv] !== "true") {
    return {
      ready: false,
      missingEnv: [],
      reason: `Set ${allowSendEnv}=true to unlock live sends`
    };
  }

  try {
    normalizeIMessageRecipient(env[recipientEnv]!);
  } catch {
    return {
      ready: false,
      missingEnv: [],
      reason: `${recipientEnv} is not one email address or phone number`
    };
  }

  return { ready: true, missingEnv: [] };
}
