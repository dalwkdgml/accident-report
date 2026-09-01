require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');

// SQLite 데이터베이스 초기화
const DB_PATH = process.env.DATABASE_PATH || './accident.db';
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 테이블 생성
function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      office_name TEXT DEFAULT '',
      status TEXT DEFAULT 'approved',
      approved_by TEXT DEFAULT '',
      approved_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accidents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datetime TEXT NOT NULL,
      location TEXT NOT NULL,
      reporter TEXT DEFAULT '',
      accident_type TEXT DEFAULT '기타',
      description TEXT NOT NULL,
      action_taken TEXT NOT NULL,
      photos TEXT DEFAULT '[]',
      status TEXT DEFAULT '사고접수',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      updated_by TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accident_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (accident_id) REFERENCES accidents(id)
    );

    CREATE TABLE IF NOT EXISTS action_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      accident_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      taken_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (accident_id) REFERENCES accidents(id)
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      FOREIGN KEY (branch_id) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS weekly_inspections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week TEXT NOT NULL,
      location TEXT NOT NULL,
      inspector TEXT NOT NULL,
      findings TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS safety_meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      location TEXT NOT NULL,
      attendees TEXT,
      topics TEXT,
      created_at TEXT NOT NULL
    );
  `);
}

initializeDatabase();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function signSession(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readSession(req) {
  const cookie = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('accident_session='));
  if (!cookie) return null;
  const value = cookie.slice('accident_session='.length);
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature || !SESSION_SECRET) return null;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    return session.expiresAt > Date.now() ? session : null;
  } catch (e) { return null; }
}

function requireAuth(req, res, next) {
  const session = readSession(req);
  if (session) { req.user = session; return next(); }
  res.status(401).json({ error: '로그인이 필요합니다.' });
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

app.post('/api/auth/signup', (req, res) => {
  const { username, password, office_name } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
  }
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    const created_at = new Date().toISOString();
    const stmt = db.prepare(
      'INSERT INTO users (username, password_hash, password_salt, office_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, hash, salt, office_name || '', 'approved', created_at);
    const session = signSession({ username, expiresAt: Date.now() + SESSION_TTL_MS });
    res.setHeader('Set-Cookie', `accident_session=${session}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}; Path=/`);
    res.json({ username, office_name });
  } catch (error) {
    if (error.message.includes('UNIQUE')) {
      return res.status(409).json({ error: '이미 존재하는 아이디입니다.' });
    }
    return res.status(500).json({ error: '회원가입에 실패했습니다.' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!SESSION_SECRET) {
    return res.status(503).json({ error: '로그인 설정이 완료되지 않았습니다.' });
  }
  let valid = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && username === ADMIN_USERNAME && password === ADMIN_PASSWORD);
  if (!valid) {
    try {
      const stmt = db.prepare('SELECT password_hash, password_salt, office_name FROM users WHERE username = ?');
      const user = stmt.get(username);
      if (user) {
        const actual = hashPassword(password || '', user.password_salt);
        valid = crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(user.password_hash));
      }
    } catch (e) {
      console.error('로그인 오류:', e);
    }
  }
  if (!valid) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  const session = signSession({ username, expiresAt: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `accident_session=${session}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}; Path=/`);
  res.json({ username });
});

app.get('/api/auth/pending-users', requireAuth, (req, res) => {
  return res.status(403).json({ error: '가입 승인 기능이 비활성화되었습니다.' });
});

app.patch('/api/auth/users/:id/status', requireAuth, (req, res) => {
  return res.status(403).json({ error: '가입 승인 기능이 비활성화되었습니다.' });
});

app.post('/api/auth/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'accident_session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/');
  res.status(204).end();
});

app.get('/api/auth/me', (req, res) => {
  const session = readSession(req);
  if (!session) return res.status(401).json({ error: '로그인이 필요합니다.' });
  res.json({ username: session.username });
});

app.get('/api/auth/offices', (req, res) => {
  try {
    const stmt = db.prepare(
      'SELECT b.name AS branch_name, o.name AS office_name FROM offices o JOIN branches b ON b.id = o.branch_id ORDER BY b.id, o.id'
    );
    const rows = stmt.all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

// multer 설정
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

// Cloudflare R2
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const R2_BUCKET = process.env.R2_BUCKET;
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

async function uploadPhotos(files) {
  return Promise.all((files || []).map(async (file) => {
    const ext = path.extname(file.originalname);
    const key = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    await r2.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }));
    return `${R2_PUBLIC_URL}/${key}`;
  }));
}

async function deletePhotos(urls) {
  await Promise.all((urls || []).map(async (url) => {
    const key = url.startsWith(R2_PUBLIC_URL) ? url.slice(R2_PUBLIC_URL.length + 1) : null;
    if (!key) return;
    try {
      await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    } catch (err) {
      console.error('R2 삭제 실패:', key, err.message);
    }
  }));
}

// 통계 API
app.get('/api/stats', (req, res) => {
  try {
    const accidentStmt = db.prepare('SELECT location, status, datetime, created_at FROM accidents');
    const accidents = accidentStmt.all();
    const commentStmt = db.prepare('SELECT COUNT(*) as count FROM comments');
    const totalComments = commentStmt.get().count;

    const byStatus = { 사고접수: 0, 검토중: 0, 완료: 0 };
    accidents.forEach(a => { if (byStatus[a.status] !== undefined) byStatus[a.status]++; });

    const monthMap = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      monthMap[key] = 0;
    }
    accidents.forEach(a => {
      const key = (a.datetime || a.created_at).slice(0, 7);
      if (monthMap[key] !== undefined) monthMap[key]++;
    });

    const locMap = {};
    accidents.forEach(a => { locMap[a.location] = (locMap[a.location] || 0) + 1; });
    const byLocation = Object.entries(locMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const dayMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dayMap[key] = 0;
    }
    accidents.forEach(a => {
      const key = a.created_at.slice(0, 10);
      if (dayMap[key] !== undefined) dayMap[key]++;
    });

    const avgComments = accidents.length ? (totalComments / accidents.length).toFixed(1) : 0;
    const doneRate = accidents.length ? Math.round((byStatus['완료'] / accidents.length) * 100) : 0;

    res.json({
      total: accidents.length,
      byStatus,
      byMonth: { labels: Object.keys(monthMap), data: Object.values(monthMap) },
      byDay:   { labels: Object.keys(dayMap),   data: Object.values(dayMap) },
      byLocation,
      avgComments: parseFloat(avgComments),
      doneRate,
      totalComments,
    });
  } catch (e) {
    res.json({ total: 0, byStatus: {}, byMonth: {}, byDay: {}, byLocation: [] });
  }
});

let sseClients = [];
function sendSSE(data) {
  sseClients.forEach(c => c.res.write(`data: ${JSON.stringify(data)}\n\n`));
}

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  const clientId = Date.now();
  sseClients.push({ id: clientId, res });
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  req.on('close', () => { sseClients = sseClients.filter(c => c.id !== clientId); });
});

// 사고 보고서 목록
app.get('/api/accidents', (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM comments WHERE accident_id = a.id) AS comment_count,
        (SELECT COUNT(*) FROM action_log WHERE accident_id = a.id) AS action_log_count
      FROM accidents a
      ORDER BY a.id DESC
    `);
    const rows = stmt.all();
    res.json(rows);
  } catch (e) {
    res.json([]);
  }
});

// 사고 보고서 상세
app.get('/api/accidents/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const stmt = db.prepare('SELECT * FROM accidents WHERE id = ?');
    const accident = stmt.get(id);
    if (!accident) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
    const commentStmt = db.prepare('SELECT * FROM comments WHERE accident_id = ? ORDER BY id');
    const comments = commentStmt.all(id);
    const logStmt = db.prepare('SELECT * FROM action_log WHERE accident_id = ? ORDER BY id');
    const action_log = logStmt.all(id);
    res.json({ ...accident, comments, action_log });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 사고 보고서 등록
app.post('/api/accidents', upload.array('photos', 10), async (req, res) => {
  try {
    const { datetime, location, reporter, description, action_taken, accident_type } = req.body;
    const photoUrls = await uploadPhotos(req.files);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO accidents (datetime, location, reporter, description, action_taken, accident_type, photos, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(datetime, location, reporter, description, action_taken, accident_type || '기타', JSON.stringify(photoUrls), '사고접수', now, now);
    sendSSE({ type: 'accident_added', id: result.lastInsertRowid });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 사고 보고서 업데이트
app.put('/api/accidents/:id', upload.array('photos', 10), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { datetime, location, reporter, description, action_taken, accident_type, status, updated_by } = req.body;
    const getStmt = db.prepare('SELECT photos FROM accidents WHERE id = ?');
    const existing = getStmt.get(id);
    const oldPhotos = existing ? JSON.parse(existing.photos) : [];
    const newPhotos = await uploadPhotos(req.files);
    const allPhotos = [...oldPhotos, ...newPhotos];
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE accidents SET datetime=?, location=?, reporter=?, description=?, action_taken=?, accident_type=?, photos=?, status=?, updated_at=?, updated_by=?
      WHERE id = ?
    `);
    stmt.run(datetime, location, reporter, description, action_taken, accident_type, JSON.stringify(allPhotos), status, now, updated_by, id);
    sendSSE({ type: 'accident_updated', id });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 사진 삭제
app.delete('/api/accidents/:id/photos/:index', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const index = parseInt(req.params.index);
    const stmt = db.prepare('SELECT photos FROM accidents WHERE id = ?');
    const result = stmt.get(id);
    if (!result) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
    const photos = JSON.parse(result.photos);
    if (index < 0 || index >= photos.length) return res.status(400).json({ error: '이미지 인덱스가 범위를 벗어났습니다.' });
    const removed = photos.splice(index, 1);
    await deletePhotos(removed);
    const updateStmt = db.prepare('UPDATE accidents SET photos = ? WHERE id = ?');
    updateStmt.run(JSON.stringify(photos), id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 댓글 추가
app.post('/api/accidents/:id/comments', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { text } = req.body;
    const session = readSession(req);
    const username = session?.username || 'anonymous';
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO comments (accident_id, username, text, created_at) VALUES (?, ?, ?, ?)');
    const result = stmt.run(id, username, text, now);
    sendSSE({ type: 'comment_added', accident_id: id });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 액션로그 추가
app.post('/api/accidents/:id/action-log', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { action } = req.body;
    const session = readSession(req);
    const username = session?.username || 'anonymous';
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO action_log (accident_id, action, taken_by, created_at) VALUES (?, ?, ?, ?)');
    const result = stmt.run(id, action, username, now);
    sendSSE({ type: 'action_log_added', accident_id: id });
    res.json({ id: result.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`✓ 서버 시작: http://localhost:${PORT}`);
});
