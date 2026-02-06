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
      .setName("description")
      .setDescription("イベントの説明")
      .setRequired(false),
  )
  .addUserOption((option) =>
    option
      .setName("participant1")
      .setDescription("リマインド対象ユーザー1")
      .setRequired(false),
  )
  .addUserOption((option) =>
    option
      .setName("participant2")
      .setDescription("リマインド対象ユーザー2")
      .setRequired(false),
  )
  .addUserOption((option) =>
    option
      .setName("participant3")
      .setDescription("リマインド対象ユーザー3")
      .setRequired(false),
  )
  .addUserOption((option) =>
    option
      .setName("participant4")
      .setDescription("リマインド対象ユーザー4")
      .setRequired(false),
  )
  .addUserOption((option) =>
    option
      .setName("participant5")
      .setDescription("リマインド対象ユーザー5")
      .setRequired(false),
  )
  .addStringOption((option) =>
    option
      .setName("timings")
      .setDescription("リマインドタイミング (カンマ区切り: 7d,3d,1d,0d)")
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

/**
 * カンマ区切りのタイミング文字列をパースする。
 */
function parseTimings(input: string | null): ReminderTiming[] {
  if (!input) return VALID_TIMINGS;

  const timings = input
    .split(",")
    .map((t) => t.trim() as ReminderTiming)
    .filter((t) => VALID_TIMINGS.includes(t));

  return timings.length > 0 ? timings : VALID_TIMINGS;
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
  const description = interaction.options.getString("description") || "";
  const timingsInput = interaction.options.getString("timings");

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

  // 参加者の収集
  const participants: string[] = [];
  for (let i = 1; i <= 5; i++) {
    const user = interaction.options.getUser(`participant${i}`);
    if (user) {
      participants.push(user.id);
    }
  }

  // タイミングのパース
  const timings = parseTimings(timingsInput);

  // BotMetaの生成
  const botMeta = createDefaultBotMeta(
    interaction.user.id,
    participants,
    timings,
  );
  const fullDescription = updateDescriptionWithMeta(description, botMeta);

  try {
    // Discord予定イベントの作成
    const event = await guild.scheduledEvents.create({
      name,
      scheduledStartTime,
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
        `リマインド: ${timings.join(", ")}`,
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
