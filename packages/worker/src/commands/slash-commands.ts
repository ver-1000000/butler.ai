import { SlashCommandBuilder } from 'discord.js';

export const SLASH_COMMANDS = [
  new SlashCommandBuilder()
    .setName('butler')
    .setDescription('butlerの機能を呼び出す')
    .addSubcommandGroup(group =>
      group
        .setName('memo')
        .setDescription('メモを登録/読取り/更新/削除する')
        .addSubcommand(subcommand =>
          subcommand
            .setName('get')
            .setDescription('メモを取得する')
            .addStringOption(option => option.setName('key').setDescription('メモのキー').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('set')
            .setDescription('メモを登録/更新する')
            .addStringOption(option => option.setName('key').setDescription('メモのキー').setRequired(true))
            .addStringOption(option => option.setName('value').setDescription('メモの本文').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('メモを削除する')
            .addStringOption(option => option.setName('key').setDescription('メモのキー').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('メモを一覧する')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('help')
            .setDescription('ヘルプを表示する')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('pomodoro')
        .setDescription('ポモドーロタイマーを操作する')
        .addSubcommand(subcommand =>
          subcommand
            .setName('start')
            .setDescription('ポモドーロを開始する')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('stop')
            .setDescription('ポモドーロを停止する')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('status')
            .setDescription('現在の状態を表示する')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('help')
            .setDescription('ヘルプを表示する')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('wiki')
        .setDescription('Wikipediaの概要を取得する')
        .addSubcommand(subcommand =>
          subcommand
            .setName('summary')
            .setDescription('指定した言葉の概要を取得する')
            .addStringOption(option => option.setName('word').setDescription('検索する単語').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('help')
            .setDescription('ヘルプを表示する')
        )
    )
    .addSubcommandGroup(group =>
      group
        .setName('sticker')
        .setDescription('スタンプの登録/削除/一覧を操作する')
        .addSubcommand(subcommand =>
          subcommand
            .setName('set')
            .setDescription('スタンプを登録/更新する')
            .addStringOption(option => option.setName('url').setDescription('スタンプのURL').setRequired(true))
            .addStringOption(option => option.setName('regexp').setDescription('マッチする正規表現').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('remove')
            .setDescription('スタンプを削除する')
            .addStringOption(option => option.setName('url').setDescription('スタンプのURL').setRequired(true))
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('list')
            .setDescription('スタンプを一覧する')
        )
        .addSubcommand(subcommand =>
          subcommand
            .setName('help')
            .setDescription('ヘルプを表示する')
        )
    )
].map(command => command.toJSON());
