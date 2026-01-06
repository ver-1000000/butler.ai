import { ScheduledTask } from 'node-cron';
import { getSqliteDb } from '@butler/core';

/** ポモドーロの現在の状態を表すモデル。 */
export class PomodoroStatus {
  private db = getSqliteDb();
  private inmemory = { startAt: null as Date | null, spent: 0, wave: 0, rest: true };
  private statementRestore = this.db.prepare('SELECT start_at, spent, wave, rest FROM pomodoro_status WHERE id = 1');
  private statementSetStartAt = this.db.prepare('UPDATE pomodoro_status SET start_at = ? WHERE id = 1');
  private statementSetSpent = this.db.prepare('UPDATE pomodoro_status SET spent = ? WHERE id = 1');
  private statementSetWave = this.db.prepare('UPDATE pomodoro_status SET wave = ? WHERE id = 1');
  private statementSetRest = this.db.prepare('UPDATE pomodoro_status SET rest = ? WHERE id = 1');
  /** `node-cron`のスケジュール。 jsonに書き込まずオンメモリで管理するため、強制終了で揮発する。 */
  private scheduleTask: ScheduledTask | null = null;

  constructor() {
    this.restore();
  }

  /** sqliteの値をinmemoryにコピー(キャッシュ)/復元する。 */
  private restore() {
    const row = this.statementRestore.get() as {
      start_at: string | null;
      spent: number;
      wave: number;
      rest: number;
    } | undefined;
    if (!row) { return; }
    this.inmemory = {
      startAt: row.start_at ? new Date(row.start_at) : null,
      spent: row.spent,
      wave: row.wave,
      rest: !!row.rest
    };
  }

  /** ポモドーロタイマーが始動した時間。 */
  get startAt() {
    const startAt = this.inmemory.startAt;
    return startAt ? new Date(startAt) : null;
  }

  set startAt(startAt: Date | null) {
    this.inmemory.startAt = startAt;
    this.statementSetStartAt.run(startAt ? startAt.toISOString() : null);
  }

  /** ポモドーロタイマーが始動してから経過した時間(分)。 */
  get spent() {
    return this.inmemory.spent;
  }

  set spent(spent: number) {
    this.inmemory.spent = spent;
    this.statementSetSpent.run(spent);
  }

  /** 何度目のポモドーロかの回数。 */
  get wave() {
    return this.inmemory.wave;
  }

  set wave(wave: number) {
    this.inmemory.wave = wave;
    this.statementSetWave.run(wave);
  }

  /** 現在休憩中のときtrueになる。 */
  get rest() {
    return this.inmemory.rest;
  }

  set rest(rest: boolean) {
    this.inmemory.rest = rest;
    this.statementSetRest.run(rest ? 1 : 0);
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
