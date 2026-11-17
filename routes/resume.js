const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

router.get('/', async (req, res) => {
  try {
    const resumes = await db.allAsync('SELECT * FROM resumes ORDER BY updated_at DESC');
    res.json(resumes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const resume = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (!resume) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });
    res.json(resume);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { title, version = '1.0', tags = '', content = '' } = req.body;
    if (!title) return res.status(400).json({ error: '제목은 필수입니다.' });
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO resumes (id, title, version, tags, content) VALUES (?, ?, ?, ?, ?)',
      [id, title.trim(), version, tags, content]
    );
    const resume = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [id]);
    res.status(201).json(resume);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, version, tags, content, is_active } = req.body;
    const existing = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });

    if (is_active === 1 || is_active === true) {
      await db.runAsync('UPDATE resumes SET is_active = 0');
    }

    await db.runAsync(
      `UPDATE resumes SET title=?, version=?, tags=?, content=?, is_active=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [title ?? existing.title, version ?? existing.version, tags ?? existing.tags,
       content ?? existing.content, is_active ?? existing.is_active, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });
    await db.runAsync('DELETE FROM resumes WHERE id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
