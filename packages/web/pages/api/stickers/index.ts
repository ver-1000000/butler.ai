import { Request, Response } from "express";
import { getSqliteDb } from '@butler/core';
import { Sticker } from '@butler/worker/src/features/sticker/sticker.store';

const db = getSqliteDb();
const selectStickersStmt = db.prepare('SELECT id, regexp FROM stickers ORDER BY id');
const handler = (_req: Request, res: Response) => {
  const rows = selectStickersStmt.all() as Sticker[];
  const data = rows.reduce<Record<string, Sticker>>((a, row) => ({ ...a, [row.id]: row }), {});
  res.status(200).json(data);
}
export default handler;
