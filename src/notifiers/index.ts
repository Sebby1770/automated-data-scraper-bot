import type { NotifierConfig } from "../types.js";
import { ConsoleNotifier } from "./console.js";
import { DiscordNotifier } from "./discord.js";
import { TelegramNotifier } from "./telegram.js";
import type { Notifier } from "./types.js";

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
    }
  }

  return notifiers.length > 0 ? notifiers : [new ConsoleNotifier()];
}
