// 프로필(단일 행) + 구조화 이력서 항목 CRUD — /api 하위에 마운트
const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { cleanItem, cleanProfile, parseJSON, wrap } = require('../resume-schema');

const profileOut = p => ({ ...p, links: parseJSON(p.links, []) });
const itemOut = i => ({ id: i.id, type: i.type, sort_order: i.sort_order, data: parseJSON(i.data, {}), created_at: i.created_at, updated_at: i.updated_at });

// ── 프로필 ──
router.get('/profile', wrap(async (req, res) => {
  res.json(profileOut(await db.getAsync('SELECT * FROM profile WHERE id = 1')));
}));

router.put('/profile', wrap(async (req, res) => {
  const p = cleanProfile(req.body);
  if ('links' in p) p.links = JSON.stringify(p.links);
  const keys = Object.keys(p);
  if (keys.length) {
    await db.runAsync(
      `UPDATE profile SET ${keys.map(k => `${k}=?`).join(', ')}, updated_at=datetime('now','localtime') WHERE id = 1`,
      keys.map(k => p[k])
    );
  }
  res.json(profileOut(await db.getAsync('SELECT * FROM profile WHERE id = 1')));
}));

// ── 이력서 항목 ──
router.get('/resume-items', wrap(async (req, res) => {
  const { type } = req.query;
  const rows = type
    ? await db.allAsync('SELECT * FROM resume_items WHERE type = ? ORDER BY sort_order, created_at', [String(type)])
    : await db.allAsync('SELECT * FROM resume_items ORDER BY type, sort_order, created_at');
  res.json(rows.map(itemOut));
}));

router.post('/resume-items', wrap(async (req, res) => {
  const { type, data } = req.body || {};
  const clean = cleanItem(type, data);
  const id = uuidv4();
  const max = await db.getAsync('SELECT MAX(sort_order) AS m FROM resume_items WHERE type = ?', [type]);
  await db.runAsync('INSERT INTO resume_items (id, type, sort_order, data) VALUES (?, ?, ?, ?)',
    [id, type, (max.m ?? -1) + 1, JSON.stringify(clean)]);
  res.status(201).json(itemOut(await db.getAsync('SELECT * FROM resume_items WHERE id = ?', [id])));
}));

router.put('/resume-items/:id', wrap(async (req, res) => {
  const existing = await db.getAsync('SELECT * FROM resume_items WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  const { data, sort_order } = req.body || {};
  const clean = data === undefined ? existing.data : JSON.stringify(cleanItem(existing.type, data));
  const order = Number.isInteger(sort_order) ? sort_order : existing.sort_order;
  await db.runAsync(`UPDATE resume_items SET data=?, sort_order=?, updated_at=datetime('now','localtime') WHERE id=?`,
    [clean, order, req.params.id]);
  res.json(itemOut(await db.getAsync('SELECT * FROM resume_items WHERE id = ?', [req.params.id])));
}));

// 같은 유형 안에서 위/아래로 한 칸 이동 (순서 0..n-1로 재정렬)
router.post('/resume-items/:id/move', wrap(async (req, res) => {
  const item = await db.getAsync('SELECT * FROM resume_items WHERE id = ?', [req.params.id]);
  if (!item) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  const dir = req.body?.dir === 'up' ? -1 : req.body?.dir === 'down' ? 1 : 0;
  if (!dir) return res.status(400).json({ error: '이동 방향(up/down)이 올바르지 않습니다.' });
  const rows = await db.allAsync('SELECT id FROM resume_items WHERE type = ? ORDER BY sort_order, created_at', [item.type]);
  const ids = rows.map(r => r.id);
  const i = ids.indexOf(item.id), j = i + dir;
  if (j >= 0 && j < ids.length) [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [n, id] of ids.entries()) await db.runAsync('UPDATE resume_items SET sort_order = ? WHERE id = ?', [n, id]);
  res.json({ ok: true });
}));

router.delete('/resume-items/:id', wrap(async (req, res) => {
  const r = await db.runAsync('DELETE FROM resume_items WHERE id = ?', [req.params.id]);
  if (!r.changes) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
  res.json({ message: '삭제되었습니다.' });
}));

module.exports = router;
