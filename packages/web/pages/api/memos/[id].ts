import { Request, Response } from "express";
import { getSqliteDb } from '@butler/core';

const db = getSqliteDb();
const selectMemoStmt = db.prepare('SELECT value FROM memos WHERE key = ?');
const handler = (req: Request, res: Response) => {
  const { id } = req.query;
  const row  = selectMemoStmt.get(String(id)) as { value: string } | undefined;
  if (row) {
    res.status(200).json(row.value);
  } else {
    res.status(404).json({ message: 'Not Found.' });
  }
}
export default handler;
