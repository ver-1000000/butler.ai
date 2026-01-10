import { Client, TextChannel, VoiceState } from 'discord.js';

import { NOTIFY_TEXT_CHANNEL_ID } from '@butler/core';

/** 音声チャンネルへの通知を目的とした機能を提供するサービスクラス。 */
export class NotifyVoiceChannelService {
  constructor(private client: Client) {}

  /** Clientからのイベント監視を開始する。 */
  run() {
    this.client.on('voiceStateUpdate', (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
    return this;
  }

  /**
   * `voiceStateUpdate`イベントの`oldState`と`newState`の状態から、「音声チャンネルに最初の一人が入室したとき」を検知し、
   * `DISCORD_NOTIFY_CHANNEL_ID`の通知用チャンネルに通知する。
   */
  private onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    if (oldState.channelId == null && newState.channelId && newState.member && newState.channel?.members.size === 1) {
      const notifyChannel = this.client.channels.cache.get(NOTIFY_TEXT_CHANNEL_ID || '') as TextChannel | undefined;
      const name          = newState.member.nickname || newState.member.displayName;
      const text          = `:loudspeaker: **${name}** が **${newState.channel.name}** でボイスチャンネルを開始しました`;
      notifyChannel?.send(text);
    }
  }
}
