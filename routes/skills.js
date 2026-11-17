const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// 전체 조회
router.get('/', async (req, res) => {
  try {
    const skills = await db.allAsync('SELECT * FROM skills ORDER BY category, name');
    const result = await Promise.all(skills.map(async skill => {
      const histories = await db.allAsync(
        'SELECT * FROM skill_histories WHERE skill_id = ? ORDER BY created_at DESC LIMIT 5',
        [skill.id]
      );
      return { ...skill, histories };
    }));
    res.json(result);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 단건 조회
router.get('/:id', async (req, res) => {
  try {
    const skill = await db.getAsync('SELECT * FROM skills WHERE id = ?', [req.params.id]);
    if (!skill) return res.status(404).json({ error: '스킬을 찾을 수 없습니다.' });
    const histories = await db.allAsync(
      'SELECT * FROM skill_histories WHERE skill_id = ? ORDER BY created_at DESC',
      [skill.id]
    );
    res.json({ ...skill, histories });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 생성
router.post('/', async (req, res) => {
  try {
    const { name, category = 'etc', level = 1, note = '' } = req.body;
    if (!name) return res.status(400).json({ error: '스킬명은 필수입니다.' });
    const id = uuidv4();
    await db.runAsync(
      'INSERT INTO skills (id, name, category, level, note) VALUES (?, ?, ?, ?, ?)',
      [id, name.trim(), category, level, note]
    );
    const skill = await db.getAsync('SELECT * FROM skills WHERE id = ?', [id]);
    res.status(201).json(skill);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 수정
router.put('/:id', async (req, res) => {
  try {
    const { name, category, level, note } = req.body;
    const existing = await db.getAsync('SELECT * FROM skills WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '스킬을 찾을 수 없습니다.' });

    const newLevel = level ?? existing.level;
    if (newLevel !== existing.level) {
      await db.runAsync(
        'INSERT INTO skill_histories (id, skill_id, from_level, to_level, note) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), existing.id, existing.level, newLevel, `레벨 ${existing.level} → ${newLevel}`]
      );
    }

    await db.runAsync(
      `UPDATE skills SET name=?, category=?, level=?, note=?, updated_at=datetime('now','localtime') WHERE id=?`,
      [name ?? existing.name, category ?? existing.category, newLevel, note ?? existing.note, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM skills WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 삭제
router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM skills WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '스킬을 찾을 수 없습니다.' });
    await db.runAsync('DELETE FROM skills WHERE id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM skill_histories WHERE skill_id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

module.exports = router;
