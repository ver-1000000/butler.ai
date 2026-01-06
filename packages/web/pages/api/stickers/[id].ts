import { Request, Response } from "express";
import { getSqliteDb } from '@butler/core';
import { Sticker } from '@butler/worker/src/stores/stickers.store';

const db = getSqliteDb();
const selectStickerStmt = db.prepare('SELECT id, regexp FROM stickers WHERE id = ?');
const handler = (req: Request, res: Response) => {
  const { id } = req.query;
  const data = selectStickerStmt.get(String(id)) as Sticker | undefined;
  if (data) {
    res.status(200).json(data);
  } else {
    res.status(404).json({ message: 'Not Found.' });
  }
}
export default handler;
