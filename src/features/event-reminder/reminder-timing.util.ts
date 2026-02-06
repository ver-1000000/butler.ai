import { ReminderTiming } from './bot-meta.model';

/** 各タイミングの判定範囲（ミリ秒）。 */
const TIMING_RANGES: Record<ReminderTiming, { min: number; max: number }> = {
  '7d': { min: 6.5 * 24 * 60 * 60 * 1000, max: 7.5 * 24 * 60 * 60 * 1000 },
  '3d': { min: 2.5 * 24 * 60 * 60 * 1000, max: 3.5 * 24 * 60 * 60 * 1000 },
  '1d': { min: 0.5 * 24 * 60 * 60 * 1000, max: 1.5 * 24 * 60 * 60 * 1000 },
  '0d': { min: 0, max: 0 } // 0dは特別処理
};

/** タイミングの表示名。 */
export const TIMING_LABELS: Record<ReminderTiming, string> = {
  '7d': '1週間前',
  '3d': '3日前',
  '1d': '前日',
  '0d': '当日'
};

/**
 * 指定日時が同じカレンダー日かどうかを判定する。
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * 0d（当日）タイミングが発火すべきかを判定する。
 * 条件: 同じカレンダー日かつイベント開始前
 */
function shouldTrigger0d(scheduledStartAt: Date, now: Date): boolean {
  return isSameDay(scheduledStartAt, now) && now < scheduledStartAt;
}

/**
 * イベント開始時刻と現在時刻から、発火すべきリマインドタイミングを返す。
 * @param scheduledStartAt イベント開始時刻
 * @param now 現在時刻
 * @param notified 既に通知済みのタイミング
 * @returns 発火すべきタイミングの配列
 */
export function getTriggeredTimings(
  scheduledStartAt: Date,
  now: Date,
  notified: Record<ReminderTiming, boolean>
): ReminderTiming[] {
  const triggered: ReminderTiming[] = [];
  const diff = scheduledStartAt.getTime() - now.getTime();

  // イベントが既に過ぎている場合は何もしない
  if (diff < 0) return triggered;

  // 7d, 3d, 1d の判定
  for (const timing of ['7d', '3d', '1d'] as ReminderTiming[]) {
    if (notified[timing]) continue;

    const range = TIMING_RANGES[timing];
    if (diff >= range.min && diff < range.max) {
      triggered.push(timing);
    }
  }

  // 0d の判定（当日の0:00〜開始時刻）
  if (!notified['0d'] && shouldTrigger0d(scheduledStartAt, now)) {
    triggered.push('0d');
  }

  return triggered;
}
