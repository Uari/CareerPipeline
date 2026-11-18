const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || './uploads');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '50') * 1024 * 1024;
const MAX_STORAGE = parseFloat(process.env.MAX_STORAGE_GB || '10') * 1024 * 1024 * 1024;

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function getCurrentStorageUsage() {
  const files = await db.allAsync('SELECT size FROM files');
  return files.reduce((sum, f) => sum + f.size, 0);
}

// multer는 multipart 헤더의 파일명을 Latin-1로 디코딩하므로
// 브라우저가 UTF-8로 보낸 한글이 깨집니다.
// Buffer를 사용해 Latin-1 → UTF-8로 재해석합니다.
function fixEncoding(name) {
  try {
    return Buffer.from(name, 'latin1').toString('utf8');
  } catch {
    return name;
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    // 확장자도 올바르게 디코딩된 이름에서 추출
    const fixedName = fixEncoding(file.originalname);
    const ext = path.extname(fixedName);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE }
});

// 파일 목록
router.get('/', async (req, res) => {
  try {
    const files = await db.allAsync('SELECT * FROM files ORDER BY created_at DESC');
    const currentUsage = await getCurrentStorageUsage();
    res.json({
      files,
      storage: {
        used: currentUsage,
        max: MAX_STORAGE,
        usedGB: (currentUsage / 1024 / 1024 / 1024).toFixed(3),
        maxGB: parseFloat(process.env.MAX_STORAGE_GB || '10'),
        percent: Math.round((currentUsage / MAX_STORAGE) * 100)
      }
    });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 스토리지 사용량
router.get('/storage', async (req, res) => {
  try {
    const currentUsage = await getCurrentStorageUsage();
    res.json({
      used: currentUsage,
      max: MAX_STORAGE,
      usedGB: (currentUsage / 1024 / 1024 / 1024).toFixed(3),
      maxGB: parseFloat(process.env.MAX_STORAGE_GB || '10'),
      percent: Math.round((currentUsage / MAX_STORAGE) * 100)
    });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 파일 업로드
router.post('/upload', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ error: `파일 크기 한도(${process.env.MAX_FILE_SIZE_MB || 50}MB)를 초과했습니다.` });
      return res.status(400).json({ error: err.message });
    } else if (err) {
      console.error(err);
      return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
    if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

    try {
      // 용량 초과 체크
      const currentUsage = await getCurrentStorageUsage();
      if (currentUsage + req.file.size > MAX_STORAGE) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: `저장 공간 한도(${process.env.MAX_STORAGE_GB || 10}GB)를 초과했습니다.` });
      }

      const { category = 'general', note = '' } = req.body;
      const id = uuidv4();
      const originalName = fixEncoding(req.file.originalname); // 한글 파일명 복원
      await db.runAsync(
        'INSERT INTO files (id, original_name, stored_name, mime_type, size, category, note) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, originalName, req.file.filename, req.file.mimetype, req.file.size, category, note]
      );
      const fileRecord = await db.getAsync('SELECT * FROM files WHERE id = ?', [id]);
      res.status(201).json(fileRecord);
    } catch (e) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error(e);
      res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
  });
});

// 파일 다운로드
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
router.get('/download/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: '잘못된 파일 ID입니다.' });
  try {
    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일이 서버에 없습니다.' });
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.original_name)}`);
    res.setHeader('Content-Type', 'application/octet-stream'); // 저장된 mime 신뢰하지 않음
    res.sendFile(filePath);
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 공개(포트폴리오) 여부 / 제목 수정 — 공개는 명시적으로 켠 파일만
router.put('/:id', async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: '잘못된 파일 ID입니다.' });
  const { is_public, title } = req.body || {};
  if (is_public !== undefined && ![true, false, 0, 1].includes(is_public))
    return res.status(400).json({ error: '공개 여부 값이 올바르지 않습니다.' });
  if (title !== undefined && title !== null && typeof title !== 'string')
    return res.status(400).json({ error: '제목 형식이 올바르지 않습니다.' });
  try {
    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    await db.runAsync('UPDATE files SET is_public = ?, title = ? WHERE id = ?', [
      is_public === undefined ? file.is_public : (is_public ? 1 : 0),
      title === undefined ? file.title : (title || '').trim().slice(0, 200),
      req.params.id,
    ]);
    res.json(await db.getAsync('SELECT * FROM files WHERE id = ?', [req.params.id]));
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

// 파일 삭제
router.delete('/:id', async (req, res) => {
  try {
    const file = await db.getAsync('SELECT * FROM files WHERE id = ?', [req.params.id]);
    if (!file) return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    const filePath = path.join(UPLOAD_DIR, file.stored_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.runAsync('DELETE FROM files WHERE id = ?', [req.params.id]);
    res.json({ message: '삭제되었습니다.' });
  } catch (e) { console.error(e); res.status(500).json({ error: '서버 오류가 발생했습니다.' }); }
});

module.exports = router;
