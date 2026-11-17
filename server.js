require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BODY_LIMIT = `${process.env.MAX_FILE_SIZE_MB || 500}mb`;

// 미들웨어
app.use(cors());
app.use(express.json({ limit: BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: BODY_LIMIT }));
app.use(express.static(path.join(__dirname, 'public')));

// API 라우트
app.use('/api/skills', require('./routes/skills'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/files', require('./routes/files'));

// 헬스체크 (OCI 유휴 방지용)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(PORT, () => {
  console.log(`🚀 Career PMS 서버 시작: http://localhost:${PORT}`);
  console.log(`📁 파일 업로드 한도: ${process.env.MAX_FILE_SIZE_MB || 50}MB / 파일`);
  console.log(`💾 전체 저장 한도: ${process.env.MAX_STORAGE_GB || 10}GB`);
});
