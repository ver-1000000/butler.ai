import Redis from 'ioredis';
import { ScheduledTask } from 'node-cron';
import { REDIS_URL } from '@butler/core';

/** Redisで利用するトップキー。 */
const HKEY = 'POMODORO';

/** ポモドーロの現在の状態を表すモデル。 */
export class PomodoroStatus {
  private redis: Redis;
  private inmemory = { startAt: null as Date | null, spent: 0, wave: 0, rest: true };
  /** `node-cron`のスケジュール。 jsonに書き込まずオンメモリで管理するため、強制終了で揮発する。 */
  private scheduleTask: ScheduledTask | null = null;

  constructor() {
    if (!REDIS_URL) {
      throw new Error('REDIS_URLが設定されていません');
    }
    this.redis = new Redis(REDIS_URL);
    this.restore();
  }

  /** redisの値をinmemoryにコピー(キャッシュ)/復元する。 */
  private async restore() {
    const inmemory = await this.redis.hgetall(HKEY);
    Object.entries(inmemory).forEach(([k, v]) => Object.assign(this.inmemory, { [k]: JSON.parse(v) }));
  }

  /** ポモドーロタイマーが始動した時間。 */
  get startAt() {
    const startAt = this.inmemory.startAt;
    return startAt ? new Date(startAt) : null;
  }

  set startAt(startAt: Date | null) {
    this.inmemory.startAt = startAt;
    this.redis.hset(HKEY, 'startAt', JSON.stringify(startAt));
  }

  /** ポモドーロタイマーが始動してから経過した時間(分)。 */
  get spent() {
    return this.inmemory.spent;
  }

  set spent(spent: number) {
    this.inmemory.spent = spent;
    this.redis.hset(HKEY, 'spent', spent);
  }

  /** 何度目のポモドーロかの回数。 */
  get wave() {
    return this.inmemory.wave;
  }

  set wave(wave: number) {
    this.inmemory.wave = wave;
    this.redis.hset(HKEY, 'wave', wave);
  }

  /** 現在休憩中のときtrueになる。 */
  get rest() {
    return this.inmemory.rest;
  }

  set rest(rest: boolean) {
    this.inmemory.rest = rest;
    this.redis.hset(HKEY, 'rest', JSON.stringify(rest));
  }

  /** 設定されているcronのスケジュール。 */
  get task() {
    return this.scheduleTask;
  }

  set task(task: ScheduledTask | null) {
    this.scheduleTask = task;
  }

  /** デフォルト値に戻す。 */
  reset() {
    this.startAt = null;
    this.spent   = 0;
    this.wave    = 0;
    this.rest    = true;
    this.scheduleTask?.destroy();
  }
}
