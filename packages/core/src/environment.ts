import { config } from 'dotenv';
config({ path: '../../.env' });

/** `.env`ファイルから定数を読み取ってオブジェクトとして提供する環境変数。 */
export const {
  DISCORD_TOKEN,
  DISCORD_GUILD_ID,
  NOTIFY_TEXT_CHANNEL_ID,
  POMODORO_VOICE_CHANNEL_ID,
  DETECT_STICKER_RATE
} = process.env;
