const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const goals = await db.allAsync('SELECT * FROM goals ORDER BY created_at DESC');
    const result = await Promise.all(goals.map(async g => {
      const logs = await db.allAsync(
        'SELECT * FROM learning_logs WHERE goal_id = ? ORDER BY date DESC', [g.id]
      );
      return { ...g, logs };
    }));
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const goal = await db.getAsync('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: '목표를 찾을 수 없습니다.' });
    const logs = await db.allAsync(
      'SELECT * FROM learning_logs WHERE goal_id = ? ORDER BY date DESC', [goal.id]
    );
    res.json({ ...goal, logs });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, description = '', type = 'monthly', period = '', status = 'in_progress', target_date = null, progress = 0 } = req.body;
    if (!title) return res.status(400).json({ error: '목표명은 필수입니다.' });
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO goals (id, title, description, type, period, status, target_date, progress) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title.trim(), description, type, period, status, target_date, progress]
    );
    const goal = await db.getAsync('SELECT * FROM goals WHERE id = ?', [id]);
    res.status(201).json(goal);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, description, type, period, status, target_date, progress } = req.body;
    const existing = await db.getAsync('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '목표를 찾을 수 없습니다.' });

    await db.runAsync(
      `UPDATE goals SET title=?, description=?, type=?, period=?, status=?, target_date=?, progress=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [title ?? existing.title, description ?? existing.description, type ?? existing.type,
       period ?? existing.period, status ?? existing.status, target_date ?? existing.target_date,
       progress ?? existing.progress, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '목표를 찾을 수 없습니다.' });
    await db.runAsync('DELETE FROM learning_logs WHERE goal_id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM goals WHERE id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 학습 로그 추가
router.post('/:id/logs', async (req, res) => {
  try {
    const goal = await db.getAsync('SELECT * FROM goals WHERE id = ?', [req.params.id]);
    if (!goal) return res.status(404).json({ error: '목표를 찾을 수 없습니다.' });
    const { date, content, duration = 0 } = req.body;
    if (!content) return res.status(400).json({ error: '내용은 필수입니다.' });
    const id = uuidv4();
    const logDate = date || new Date().toISOString().split('T')[0];
    await db.runAsync(
      'INSERT INTO learning_logs (id, goal_id, date, content, duration) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, logDate, content, duration]
    );
    const log = await db.getAsync('SELECT * FROM learning_logs WHERE id = ?', [id]);
    res.status(201).json(log);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 학습 로그 삭제
router.delete('/:id/logs/:logId', async (req, res) => {
  try {
    await db.runAsync('DELETE FROM learning_logs WHERE id = ? AND goal_id = ?',
      [req.params.logId, req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

module.exports = router;
