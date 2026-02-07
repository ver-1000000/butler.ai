import type { Client } from 'discord.js';
import type { PluginManifest } from '../manifest.types';
import { NotifyVoiceChannelService } from './notify-voice-channel.service';

const manifest: PluginManifest = {
  id: 'notify-voice-channel',
  start: (client: Client) => {
    new NotifyVoiceChannelService(client).run();
  }
};

export default manifest;
