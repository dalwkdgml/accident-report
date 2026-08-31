// 지사별 영업소 목록 시드 스크립트 (일회성, 재실행해도 안전 - 기존 offices를 비우고 다시 채움)
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const OFFICES_BY_BRANCH = {
  '전주': ['전주', '서전주', '김제', '금산사', '태인', '정읍', '새만금', '북김제'],
  '부안': ['동군산', '서김제', '부안', '줄포', '선운산', '고창'],
  '무주': ['남대전', '추부', '금산', '무주', '덕유산'],
  '논산': ['계룡', '논산', '익산', '완주', '삼례'],
  '진안': ['소양', '진안', '장수', '동전주', '상관', '남전주'],
  '보령': ['광천', '대천', '무창포', '춘장대', '서천', '군산'],
};

(async () => {
  await pool.query('DELETE FROM offices');
  for (const [branch, offices] of Object.entries(OFFICES_BY_BRANCH)) {
    const { rows } = await pool.query('SELECT id FROM branches WHERE name = $1', [branch]);
    if (!rows[0]) { console.error('지사 없음:', branch); continue; }
    const branchId = rows[0].id;
    for (const office of offices) {
      await pool.query('INSERT INTO offices (branch_id, name) VALUES ($1, $2)', [branchId, office]);
    }
  }
  const { rows: all } = await pool.query('SELECT COUNT(*)::int AS count FROM offices');
  console.log(`총 ${all[0].count}개 영업소 저장됨`);
  process.exit(0);
})();
