// 일회성 마이그레이션: accidents 테이블에 updated_by 컬럼 추가 (재실행해도 안전)
require('dotenv').config();
const { Client } = require('pg');

(async () => {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query(`ALTER TABLE accidents ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT ''`);
  console.log('updated_by 컬럼 추가 완료(또는 이미 존재).');
  await client.end();
})().catch(err => { console.error(err); process.exit(1); });
