import type { Client } from "discord.js";
import type { PluginManifest } from "../manifest.types";
import { createEventReminder } from "./create-event-reminder.usecase";
import { EventReminderService } from "./event-reminder.service";

const EVENT_REMINDER_TOOL_NAME = "event-reminder";

const manifest: PluginManifest = {
  id: "event-reminder",
  aiPolicy: [
    "event-reminderは不足情報を確認しすぎず、作成可能なら一度で作成する",
    "ユーザー発話に「Xのイベント」がある場合、nameはXとして扱う(例: 「パーティのイベント登録」→ name=「パーティ」)",
    "「明日19時」のような自然言語の日時はAIが具体日時へ変換してからstart/endへ渡す",
    "startの年が省略されている場合は今年として扱う",
    "endが未指定ならstartの2時間後を使う",
    "participantsが未指定なら対象なしとして扱う",
    "不確定な点は推測で補い、作成後に補完内容を結果メッセージで共有する",
  ].join("。"),
  tools: [
    {
      name: EVENT_REMINDER_TOOL_NAME,
      description:
        "イベントとリマインドを登録する(不足項目は可能な範囲で自動補完する)",
      arguments: [
        { name: "name", description: "イベント名", required: true },
        {
          name: "start",
          description:
            "開始日時 (例: 2026-12-25 19:00 / 12/25 19:00, 年省略時は今年として扱う)",
          required: true,
        },
        {
          name: "end",
          description:
            "終了日時 (例: 2026-12-25 21:00 / 12/25 21:00, 未指定時は開始の2時間後)",
          required: false,
        },
        { name: "description", description: "イベントの説明", required: false },
        {
          name: "participants",
          description:
            "リマインド対象のメンション文字列 (未指定なら対象なしで登録)",
          required: false,
        },
      ],
    },
  ],
  handlers: {
    [EVENT_REMINDER_TOOL_NAME]: async (args, context) => {
      if (!context.guildId) return "この機能はサーバー内でのみ利用できます。";
      const normalizeDateTimeLikeInput = (value: string): string => {
        return value
          .replace(/[　]/g, " ")
          .trim()
          .replace(/[０-９：]/g, (char) => {
            if (char === "：") return ":";
            return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
          })
          .replace(/\s+/g, " ");
      };
      const normalizeEventName = (value: string): string => {
        const trimmed = value.trim().replace(/[。！!？?]+$/g, "");
        const stripped = trimmed
          .replace(/(?:の)?イベント(?:登録)?$/g, "")
          .trim();
        return stripped || trimmed;
      };

      const name =
        typeof args.name === "string" ? normalizeEventName(args.name) : "";
      const start =
        typeof args.start === "string"
          ? normalizeDateTimeLikeInput(args.start)
          : "";
      const end =
        typeof args.end === "string"
          ? normalizeDateTimeLikeInput(args.end)
          : null;
      const description =
        typeof args.description === "string" ? args.description.trim() : "";
      const participants =
        typeof args.participants === "string" ? args.participants.trim() : null;
      const createdBy = context.userId ?? "unknown";

      try {
        const guild =
          context.client.guilds.cache.get(context.guildId) ??
          (await context.client.guilds.fetch(context.guildId));

        const result = await createEventReminder(guild, {
          name,
          start,
          end,
          description,
          participants,
          createdBy,
        });

        return result.message;
      } catch (error) {
        console.error("event-reminder tool execution failed:", error);
        return "イベント処理に失敗しました。時間をおいて再度お試しください。";
      }
    },
  },
  start: (client: Client) => {
    new EventReminderService(client).run();
  },
};

export default manifest;
