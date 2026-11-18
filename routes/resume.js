const express = require('express');
const router = express.Router();
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const { str, wrap, fail } = require('../resume-schema');

// include: null(전체) 또는 {item_ids:[...]} → 저장용 JSON 문자열 / NULL
function cleanInclude(v) {
  if (v == null) return null;
  if (typeof v !== 'object' || !Array.isArray(v.item_ids)) fail('포함 항목 형식이 올바르지 않습니다.');
  return JSON.stringify({ item_ids: v.item_ids.filter(x => typeof x === 'string' && x.length <= 64).slice(0, 1000) });
}

router.get('/', async (req, res) => {
  try {
    const resumes = await db.allAsync('SELECT * FROM resumes ORDER BY updated_at DESC');
    res.json(resumes);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const resume = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (!resume) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });
    res.json(resume);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

router.post('/', wrap(async (req, res) => {
  const { title, version = '1.0', tags = '', content = '', headline, intro, include } = req.body;
  if (!title || typeof title !== 'string') return res.status(400).json({ error: '제목은 필수입니다.' });
  const id = uuidv4();
  await db.runAsync(
    'INSERT INTO resumes (id, title, version, tags, content, headline, intro, include) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, title.trim(), version, tags, content, str(headline, 200), str(intro, 5000), cleanInclude(include)]
  );
  const resume = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [id]);
  res.status(201).json(resume);
}));

router.put('/:id', wrap(async (req, res) => {
  const { title, version, tags, content, is_active, headline, intro } = req.body;
  const existing = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });

  if (is_active === 1 || is_active === true) {
    await db.runAsync('UPDATE resumes SET is_active = 0');
  }

  await db.runAsync(
    `UPDATE resumes SET title=?, version=?, tags=?, content=?, is_active=?, headline=?, intro=?, include=?, updated_at=datetime('now','localtime') WHERE id=?`,
    [title ?? existing.title, version ?? existing.version, tags ?? existing.tags,
     content ?? existing.content, is_active ?? existing.is_active,
     headline === undefined ? existing.headline : str(headline, 200),
     intro === undefined ? existing.intro : str(intro, 5000),
     'include' in req.body ? cleanInclude(req.body.include) : existing.include,
     req.params.id]
  );
  const updated = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
  res.json(updated);
}));

router.delete('/:id', async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM resumes WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: '이력서를 찾을 수 없습니다.' });
    // 이 버전의 공유 링크와 열람 기록도 함께 정리
    await db.runAsync('DELETE FROM share_views WHERE link_id IN (SELECT id FROM share_links WHERE resume_id = ?)', [req.params.id]);
    await db.runAsync('DELETE FROM share_links WHERE resume_id = ?', [req.params.id]);
    await db.runAsync('DELETE FROM resumes WHERE id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

module.exports = router;
