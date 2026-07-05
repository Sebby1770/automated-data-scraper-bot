import type { Alert, NotifierConfig } from "../types.js";
import { ConsoleNotifier } from "./console.js";
import { DiscordNotifier } from "./discord.js";
import { SlackNotifier } from "./slack.js";
import { TelegramNotifier } from "./telegram.js";
import { WebhookNotifier } from "./webhook.js";
import type { Notifier } from "./types.js";

export type TestableNotifierType = "discord" | "telegram" | "slack" | "webhook";

export function createNotifiers(configs: NotifierConfig[]): Notifier[] {
  const notifiers: Notifier[] = [];

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
      const webhookUrl = process.env[envName];
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
      const token = process.env[tokenEnv];
      const chatId = process.env[chatEnv];
      if (!token || !chatId) {
        console.warn(`Skipping Telegram notifier because ${tokenEnv} or ${chatEnv} is not set.`);
        continue;
      }
      notifiers.push(new TelegramNotifier(token, chatId));
      continue;
    }

    if (config.type === "slack") {
      const envName = config.webhookUrlEnv ?? "SLACK_WEBHOOK_URL";
      const webhookUrl = process.env[envName];
      if (!webhookUrl) {
        console.warn(`Skipping Slack notifier because ${envName} is not set.`);
        continue;
      }
      notifiers.push(new SlackNotifier(webhookUrl));
      continue;
    }

    if (config.type === "webhook") {
      const envName = config.webhookUrlEnv ?? "WEBHOOK_URL";
      const webhookUrl = process.env[envName];
      if (!webhookUrl) {
        console.warn(`Skipping webhook notifier because ${envName} is not set.`);
        continue;
      }
      notifiers.push(new WebhookNotifier(webhookUrl));
    }
  }

  return notifiers.length > 0 ? notifiers : [new ConsoleNotifier()];
}

export function createTestNotifier(type: TestableNotifierType): Notifier {
  if (type === "discord") {
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("DISCORD_WEBHOOK_URL is not set");
    }
    return new DiscordNotifier(webhookUrl);
  }

  if (type === "telegram") {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      throw new Error("TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set");
    }
    return new TelegramNotifier(token, chatId);
  }

  if (type === "webhook") {
    const webhookUrl = process.env.WEBHOOK_URL;
    if (!webhookUrl) {
      throw new Error("WEBHOOK_URL is not set");
    }
    return new WebhookNotifier(webhookUrl);
  }

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
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