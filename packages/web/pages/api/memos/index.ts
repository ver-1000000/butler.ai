import { Request, Response } from "express";
import { getSqliteDb } from '@butler/core';

const db = getSqliteDb();
const handler = async (_req: Request, res: Response) => {
  const rows = db.prepare('SELECT key, value FROM memos ORDER BY key').all() as { key: string; value: string }[];
  const data = Object.fromEntries(rows.map(row => [row.key, row.value]));
  res.status(200).json(data);
}
export default handler;
