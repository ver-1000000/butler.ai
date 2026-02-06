import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  GuildScheduledEventEntityType,
  GuildScheduledEventPrivacyLevel,
} from "discord.js";
import {
  ReminderTiming,
  createDefaultBotMeta,
  updateDescriptionWithMeta,
} from "./bot-meta.model";

/** 有効なリマインドタイミング。 */
const VALID_TIMINGS: ReminderTiming[] = ["7d", "3d", "1d", "0d"];

/** /add-event スラッシュコマンド定義。 */
export const ADD_EVENT_COMMAND = new SlashCommandBuilder()
  .setName("add-event")
  .setDescription("リマインド付きのスケジュールイベントを作成する")
  .addStringOption((option) =>
    option.setName("name").setDescription("イベント名").setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("start")
      .setDescription("開始日時 (例: 2024-12-25 19:00)")
      .setRequired(true),
  )
  .addStringOption((option) =>
    option
      .setName("end")
      .setDescription("終了日時 (例: 2024-12-25 21:00) 省略時は開始から2時間後")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("description")
      .setDescription("イベントの説明")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("participants")
      .setDescription("リマインド対象 (例: @user1 @user2) 最大10人")
      .setRequired(false),
  );

/**
 * 日時文字列をDateオブジェクトにパースする。
 * 対応フォーマット: "YYYY-MM-DD HH:mm" または "YYYY/MM/DD HH:mm"
 */
function parseDateTime(input: string): Date | null {
  const normalized = input.trim().replace(/\//g, "-");
  const match = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/,
  );
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
  );

  if (isNaN(date.getTime())) return null;
  return date;
}

/** メンション最大人数。 */
const MAX_PARTICIPANTS = 10;

/**
 * メンション文字列からユーザーIDを抽出する。
 * @param input メンション文字列 (例: "<@123> <@!456>")
 * @returns ユーザーIDの配列（重複除去済み）
 */
function parseParticipants(input: string | null): string[] {
  if (!input) return [];

  const mentionRegex = /<@!?(\d+)>/g;
  const ids: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(input)) !== null) {
    if (!ids.includes(match[1])) {
      ids.push(match[1]);
    }
  }

  return ids;
}

/**
 * /add-event コマンドを処理する。
 */
export async function handleAddEventCommand(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const guild = interaction.guild;
  if (!guild) {
    await interaction.reply({
      content: "このコマンドはサーバー内でのみ使用できます。",
      ephemeral: true,
    });
    return;
  }

  const name = interaction.options.getString("name", true);
  const startInput = interaction.options.getString("start", true);
  const endInput = interaction.options.getString("end");
  const description = interaction.options.getString("description") || "";

  // 開始日時のパース
  const scheduledStartTime = parseDateTime(startInput);
  if (!scheduledStartTime) {
    await interaction.reply({
      content: "日時の形式が正しくありません。例: `2024-12-25 19:00`",
      ephemeral: true,
    });
    return;
  }

  // 過去の日時チェック
  if (scheduledStartTime <= new Date()) {
    await interaction.reply({
      content: "開始日時は未来の日時を指定してください。",
      ephemeral: true,
    });
    return;
  }

  // 終了日時のパース（省略時は開始から2時間後）
  let scheduledEndTime: Date;
  if (endInput) {
    const parsedEnd = parseDateTime(endInput);
    if (!parsedEnd) {
      await interaction.reply({
        content: "終了日時の形式が正しくありません。例: `2024-12-25 21:00`",
        ephemeral: true,
      });
      return;
    }
    if (parsedEnd <= scheduledStartTime) {
      await interaction.reply({
        content: "終了日時は開始日時より後を指定してください。",
        ephemeral: true,
      });
      return;
    }
    scheduledEndTime = parsedEnd;
  } else {
    scheduledEndTime = new Date(
      scheduledStartTime.getTime() + 2 * 60 * 60 * 1000,
    );
  }

  // 参加者の収集
  const participantsInput = interaction.options.getString("participants");
  const participants = parseParticipants(participantsInput);

  if (participants.length > MAX_PARTICIPANTS) {
    await interaction.reply({
      content: `リマインド対象は最大${MAX_PARTICIPANTS}人までです。`,
      ephemeral: true,
    });
    return;
  }

  // BotMetaの生成（タイミングは固定: 7d, 3d, 1d, 0d）
  const botMeta = createDefaultBotMeta(
    interaction.user.id,
    participants,
    VALID_TIMINGS,
  );
  const fullDescription = updateDescriptionWithMeta(description, botMeta);

  try {
    // Discord予定イベントの作成
    const event = await guild.scheduledEvents.create({
      name,
      scheduledStartTime,
      scheduledEndTime,
      privacyLevel: GuildScheduledEventPrivacyLevel.GuildOnly,
      entityType: GuildScheduledEventEntityType.External,
      entityMetadata: { location: "Discord" },
      description: fullDescription,
    });

    const startTimeStr = scheduledStartTime.toLocaleString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const participantMentions =
      participants.length > 0
        ? participants.map((id) => `<@${id}>`).join(" ")
        : "(未設定)";

    await interaction.reply({
      content: [
        `:calendar: **イベントを作成しました**`,
        ``,
        `**${event.name}**`,
        `開始: ${startTimeStr}`,
        `対象: ${participantMentions}`,
      ].join("\n"),
    });
  } catch (error) {
    console.error("イベント作成エラー:", error);
    await interaction.reply({
      content: "イベントの作成に失敗しました。",
      ephemeral: true,
    });
  }
}
