import { Request, Response } from "express";
import { getSqliteDb } from '@butler/core';
import { Sticker } from '@butler/worker/src/stores/stickers.store';

const db = getSqliteDb();
const handler = async (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT id, regexp FROM stickers ORDER BY id').all() as Sticker[];
  const data = rows.reduce<Record<string, Sticker>>((a, row) => ({ ...a, [row.id]: row }), {});
  res.status(200).json(data);
}
export default handler;
