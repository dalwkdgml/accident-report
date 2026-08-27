CREATE TABLE IF NOT EXISTS accidents (
  id SERIAL PRIMARY KEY,
  datetime TEXT NOT NULL,
  location TEXT NOT NULL,
  reporter TEXT NOT NULL DEFAULT '',
  accident_type TEXT NOT NULL DEFAULT '기타',
  description TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  photos JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT '사고접수',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT NOT NULL DEFAULT '',
  approved_at TEXT,
  created_at TEXT NOT NULL
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

CREATE TABLE IF NOT EXISTS action_log (
  id SERIAL PRIMARY KEY,
  accident_id INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  accident_id INTEGER NOT NULL REFERENCES accidents(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_action_log_accident_id ON action_log(accident_id);
CREATE INDEX IF NOT EXISTS idx_comments_accident_id ON comments(accident_id);

-- 지사 / 영업소
CREATE TABLE IF NOT EXISTS branches (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS offices (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_offices_branch_id ON offices(branch_id);

-- 주간 점검 (지사가 담당 영업소를 매주 점검)
CREATE TABLE IF NOT EXISTS weekly_inspections (
  id SERIAL PRIMARY KEY,
  branch_name TEXT NOT NULL,
  office_name TEXT NOT NULL,
  inspection_date TEXT NOT NULL,
  inspector TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]',
  overall_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_weekly_inspections_branch ON weekly_inspections(branch_name);

-- 안전보건협의체 (월례 회의록)
CREATE TABLE IF NOT EXISTS safety_meetings (
  id SERIAL PRIMARY KEY,
  meeting_no TEXT NOT NULL,
  meeting_date TEXT NOT NULL,
  location TEXT NOT NULL,
  worker_reps JSONB NOT NULL DEFAULT '[]',
  employer_reps JSONB NOT NULL DEFAULT '[]',
  agenda TEXT NOT NULL,
  discussion TEXT NOT NULL,
  decisions TEXT NOT NULL,
  next_meeting_date TEXT,
  author TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
