require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const APPROVER_USERNAME = process.env.APPROVER_USERNAME || ADMIN_USERNAME;
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

function requireApprover(req, res, next) {
  if (req.user && req.user.username === APPROVER_USERNAME) return next();
  res.status(403).json({ error: '가입 승인 권한이 없습니다.' });
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

app.post('/api/auth/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[a-zA-Z0-9._-]{4,30}$/.test(username || '')) {
    return res.status(400).json({ error: '아이디는 영문, 숫자, ., _, -를 사용해 4~30자로 입력해주세요.' });
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 100) {
    return res.status(400).json({ error: '비밀번호는 8~100자로 입력해주세요.' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash, password_salt, status, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, status, created_at',
      [username, passwordHash, salt, 'pending', nowKST()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: '이미 사용 중인 아이디입니다.' });
    throw err;
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!SESSION_SECRET) {
    return res.status(503).json({ error: '로그인 설정이 완료되지 않았습니다.' });
  }
  let valid = Boolean(ADMIN_USERNAME && ADMIN_PASSWORD && username === ADMIN_USERNAME && password === ADMIN_PASSWORD);
  if (!valid) {
    const { rows } = await pool.query('SELECT password_hash, password_salt, status FROM users WHERE username = $1', [username]);
    if (rows[0]) {
      const actual = hashPassword(password || '', rows[0].password_salt);
      valid = crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(rows[0].password_hash));
      if (valid && rows[0].status !== 'approved') {
        return res.status(403).json({ error: '가입 승인 대기 중입니다. 승인 담당자에게 확인해주세요.' });
      }
    }
  }
  if (!valid) {
    return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  }
  const session = signSession({ username, expiresAt: Date.now() + SESSION_TTL_MS });
  res.setHeader('Set-Cookie', `accident_session=${session}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}; Path=/`);
  res.json({ username });
});

app.get('/api/auth/pending-users', requireAuth, requireApprover, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, username, created_at FROM users WHERE status = 'pending' ORDER BY id ASC"
  );
  res.json(rows);
});

app.patch('/api/auth/users/:id/status', requireAuth, requireApprover, async (req, res) => {
  const status = req.body && req.body.status;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 승인 상태입니다.' });
  }
  const { rows } = await pool.query(
    'UPDATE users SET status=$1, approved_by=$2, approved_at=$3 WHERE id=$4 AND status=$5 RETURNING id, username, status',
    [status, req.user.username, nowKST(), parseInt(req.params.id), 'pending']
  );
  if (!rows[0]) return res.status(404).json({ error: '승인 대기 계정을 찾을 수 없습니다.' });
  res.json(rows[0]);
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

app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/')) return next();
  return requireAuth(req, res, next);
});

// multer 설정 (메모리에 버퍼로 받아 R2에 업로드)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('이미지 파일만 업로드 가능합니다.'));
  }
});

// Cloudflare R2 (S3 호환) 사진 저장소
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

function nowKST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

// 통계 API
app.get('/api/stats', async (req, res) => {
  const { rows: accidents } = await pool.query('SELECT location, status, datetime, created_at FROM accidents');
  const { rows: commentCountRows } = await pool.query('SELECT COUNT(*)::int AS count FROM comments');
  const totalComments = commentCountRows[0].count;

  // 상태별
  const byStatus = { 사고접수: 0, 검토중: 0, 완료: 0 };
  accidents.forEach(a => { if (byStatus[a.status] !== undefined) byStatus[a.status]++; });

  // 최근 12개월 월별 건수
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

  // 장소별 건수 (상위 10)
  const locMap = {};
  accidents.forEach(a => { locMap[a.location] = (locMap[a.location] || 0) + 1; });
  const byLocation = Object.entries(locMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // 일별 건수 (최근 30일)
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

  // 평균 댓글 수
  const avgComments = accidents.length
    ? (totalComments / accidents.length).toFixed(1)
    : 0;

  // 완료율
  const doneRate = accidents.length
    ? Math.round((byStatus['완료'] / accidents.length) * 100)
    : 0;

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
});

// SSE clients
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
app.get('/api/accidents', async (req, res) => {
  const { rows } = await pool.query(`
    SELECT a.*, COUNT(DISTINCT c.id)::int AS comment_count, COUNT(DISTINCT al.id)::int AS action_log_count
    FROM accidents a
    LEFT JOIN comments c ON c.accident_id = a.id
    LEFT JOIN action_log al ON al.accident_id = a.id
    GROUP BY a.id
    ORDER BY a.id DESC
  `);
  res.json(rows);
});

// 사고 보고서 상세
app.get('/api/accidents/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT * FROM accidents WHERE id = $1', [id]);
  const accident = rows[0];
  if (!accident) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });
  const { rows: comments } = await pool.query('SELECT * FROM comments WHERE accident_id = $1 ORDER BY id', [id]);
  const { rows: actionLog } = await pool.query('SELECT * FROM action_log WHERE accident_id = $1 ORDER BY id', [id]);
  res.json({ ...accident, comments, action_log: actionLog });
});

// 사고 보고서 등록 (사진 포함)
app.post('/api/accidents', upload.array('photos', 10), async (req, res) => {
  const { datetime, location, reporter, description, action_taken, accident_type } = req.body;
  if (!datetime || !location || !reporter || !description) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }

  const photos = await uploadPhotos(req.files);
  const now = nowKST();

  const { rows } = await pool.query(
    `INSERT INTO accidents (datetime, location, reporter, accident_type, description, action_taken, photos, status, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'사고접수',$8,$8) RETURNING *`,
    [datetime, location, reporter, accident_type || '기타', description, action_taken || '', JSON.stringify(photos), now]
  );
  const newAccident = rows[0];

  sendSSE({ type: 'new_accident', accident: newAccident });
  res.status(201).json(newAccident);
});

// 사진 추가 업로드 (기존 보고서에 추가)
app.post('/api/accidents/:id/photos', upload.array('photos', 10), async (req, res) => {
  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT photos FROM accidents WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });

  const newPhotos = await uploadPhotos(req.files);
  const photos = [...(rows[0].photos || []), ...newPhotos];
  await pool.query('UPDATE accidents SET photos = $1, updated_at = $2 WHERE id = $3', [JSON.stringify(photos), nowKST(), id]);

  sendSSE({ type: 'photos_added', accident_id: id, photos });
  res.json({ photos });
});

// 보고서 수정
app.put('/api/accidents/:id', upload.array('photos', 10), async (req, res) => {
  const { datetime, location, reporter, description, action_taken, accident_type, keep_photos, updated_by } = req.body;
  if (!datetime || !location || !reporter || !description || !updated_by) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }

  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT * FROM accidents WHERE id = $1', [id]);
  const accident = rows[0];
  if (!accident) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });

  // 유지할 기존 사진 + 새로 업로드한 사진
  const kept = keep_photos ? (Array.isArray(keep_photos) ? keep_photos : [keep_photos]) : [];
  // 제거된 기존 사진은 R2에서 삭제
  const removed = (accident.photos || []).filter(p => !kept.includes(p));
  await deletePhotos(removed);
  const newPhotos = await uploadPhotos(req.files);
  const photos = [...kept, ...newPhotos];
  const now = nowKST();

  const { rows: updatedRows } = await pool.query(
    `UPDATE accidents SET datetime=$1, location=$2, reporter=$3, accident_type=$4, description=$5, action_taken=$6, photos=$7, updated_at=$8, updated_by=$9
     WHERE id=$10 RETURNING *`,
    [datetime, location, reporter, accident_type || accident.accident_type || '기타', description, action_taken || accident.action_taken || '', JSON.stringify(photos), now, updated_by, id]
  );

  const updated = updatedRows[0];
  sendSSE({ type: 'accident_updated', accident: updated });
  res.json(updated);
});

// 보고서 삭제
app.delete('/api/accidents/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT photos FROM accidents WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });

  // 첨부 사진 R2에서 삭제
  await deletePhotos(rows[0].photos);

  await pool.query('DELETE FROM accidents WHERE id = $1', [id]); // comments/action_log은 CASCADE로 함께 삭제

  sendSSE({ type: 'accident_deleted', accident_id: id });
  res.json({ success: true });
});

// 상태 변경
app.patch('/api/accidents/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!['사고접수', '검토중', '완료'].includes(status)) {
    return res.status(400).json({ error: '유효하지 않은 상태입니다.' });
  }
  const id = parseInt(req.params.id);
  const { rows } = await pool.query(
    'UPDATE accidents SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *',
    [status, nowKST(), id]
  );
  if (!rows[0]) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });

  const accident = rows[0];
  sendSSE({ type: 'status_changed', accident });
  res.json(accident);
});

// 조치 내용 추가
app.post('/api/accidents/:id/action-log', async (req, res) => {
  const { type, content } = req.body;
  if (!content) return res.status(400).json({ error: '내용을 입력해주세요.' });

  const id = parseInt(req.params.id);
  const { rows: accRows } = await pool.query('SELECT id FROM accidents WHERE id = $1', [id]);
  if (!accRows[0]) return res.status(404).json({ error: '보고서를 찾을 수 없습니다.' });

  const now = nowKST();
  const { rows } = await pool.query(
    'INSERT INTO action_log (accident_id, type, content, created_at) VALUES ($1,$2,$3,$4) RETURNING *',
    [id, type || '조치 내용', content, now]
  );
  await pool.query('UPDATE accidents SET updated_at = $1 WHERE id = $2', [now, id]);

  const entry = rows[0];
  sendSSE({ type: 'action_log_added', accident_id: id, entry });
  res.status(201).json(entry);
});

// 조치 타임라인 삭제
app.delete('/api/accidents/:id/action-log/:logId', async (req, res) => {
  const id = parseInt(req.params.id);
  const logId = parseInt(req.params.logId);

  const { rowCount } = await pool.query('DELETE FROM action_log WHERE id = $1 AND accident_id = $2', [logId, id]);
  if (!rowCount) return res.status(404).json({ error: '항목을 찾을 수 없습니다.' });

  await pool.query('UPDATE accidents SET updated_at = $1 WHERE id = $2', [nowKST(), id]);
  sendSSE({ type: 'action_log_deleted', accident_id: id, log_id: logId });
  res.json({ success: true });
});

// 댓글 등록
app.post('/api/accidents/:id/comments', async (req, res) => {
  const { author, role, content } = req.body;
  if (!author || !role || !content) {
    return res.status(400).json({ error: '작성자, 직책, 내용을 입력해주세요.' });
  }
  const accidentId = parseInt(req.params.id);
  const { rows } = await pool.query(
    'INSERT INTO comments (accident_id, author, role, content, created_at) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [accidentId, author, role, content, nowKST()]
  );

  const comment = rows[0];
  sendSSE({ type: 'new_comment', comment, accident_id: accidentId });
  res.status(201).json(comment);
});

// ---------- 지사 / 영업소 ----------
app.get('/api/branches', async (req, res) => {
  const { rows: branches } = await pool.query('SELECT * FROM branches ORDER BY id');
  const { rows: offices } = await pool.query('SELECT * FROM offices ORDER BY id');
  res.json(branches.map(b => ({ ...b, offices: offices.filter(o => o.branch_id === b.id) })));
});

// ---------- 주간 점검 ----------
app.get('/api/inspections', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM weekly_inspections ORDER BY id DESC');
  res.json(rows);
});

app.get('/api/inspections/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { rows } = await pool.query('SELECT * FROM weekly_inspections WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: '점검 기록을 찾을 수 없습니다.' });
  res.json(rows[0]);
});

app.post('/api/inspections', async (req, res) => {
  const { branch_name, office_name, inspection_date, inspector, items, overall_note } = req.body;
  if (!branch_name || !office_name || !inspection_date || !inspector || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }
  const now = nowKST();
  const { rows } = await pool.query(
    `INSERT INTO weekly_inspections (branch_name, office_name, inspection_date, inspector, items, overall_note, created_at, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
    [branch_name, office_name, inspection_date, inspector, JSON.stringify(items), overall_note || '', now]
  );
  const entry = rows[0];
  sendSSE({ type: 'new_inspection', inspection: entry });
  res.status(201).json(entry);
});

app.put('/api/inspections/:id', async (req, res) => {
  const { branch_name, office_name, inspection_date, inspector, items, overall_note } = req.body;
  if (!branch_name || !office_name || !inspection_date || !inspector || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: '모든 항목을 입력해주세요.' });
  }
  const id = parseInt(req.params.id);
  const { rows } = await pool.query(
    `UPDATE weekly_inspections SET branch_name=$1, office_name=$2, inspection_date=$3, inspector=$4, items=$5, overall_note=$6, updated_at=$7
     WHERE id=$8 RETURNING *`,
    [branch_name, office_name, inspection_date, inspector, JSON.stringify(items), overall_note || '', nowKST(), id]
  );
  if (!rows[0]) return res.status(404).json({ error: '점검 기록을 찾을 수 없습니다.' });
  const entry = rows[0];
  sendSSE({ type: 'inspection_updated', inspection: entry });
  res.json(entry);
});

app.delete('/api/inspections/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { rowCount } = await pool.query('DELETE FROM weekly_inspections WHERE id = $1', [id]);
  if (!rowCount) return res.status(404).json({ error: '점검 기록을 찾을 수 없습니다.' });
  sendSSE({ type: 'inspection_deleted', inspection_id: id });
  res.json({ success: true });
});

// 공통 에러 핸들러 (JSON으로 응답)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || '서버 오류가 발생했습니다.' });
});

app.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  const ips = Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address);

  console.log(`\n====================================`);
  console.log(` Toll-Pass 365 실행 중`);
  console.log(`====================================`);
  console.log(` 로컬:    http://localhost:${PORT}`);
  ips.forEach(ip => console.log(` 네트워크: http://${ip}:${PORT}`));
  console.log(`====================================\n`);
});
