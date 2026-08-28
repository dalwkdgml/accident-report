require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await client.query(schema);
  console.log('Schema created.');

  const db = JSON.parse(fs.readFileSync(path.join(__dirname, 'db.json'), 'utf8'));

  for (const a of db.accidents) {
    await client.query(
      `INSERT INTO accidents (id, datetime, location, accident_type, description, action_taken, photos, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.datetime, a.location, a.accident_type, a.description, a.action_taken, JSON.stringify(a.photos || []), a.status, a.created_at, a.updated_at]
    );
    for (const log of a.action_log || []) {
      await client.query(
        `INSERT INTO action_log (id, accident_id, type, content, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
        [log.id, a.id, log.type, log.content, log.created_at]
      );
    }
  }

  for (const c of db.comments) {
    await client.query(
      `INSERT INTO comments (id, accident_id, author, role, content, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [c.id, c.accident_id, c.author, c.role, c.content, c.created_at]
    );
  }

  // Sync sequences to match nextId counters so future SERIAL inserts don't collide
  await client.query(`SELECT setval('accidents_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM accidents), $1 - 1))`, [db.nextAccidentId]);
  await client.query(`SELECT setval('comments_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM comments), $1 - 1))`, [db.nextCommentId]);
  await client.query(`SELECT setval('action_log_id_seq', GREATEST((SELECT COALESCE(MAX(id),0) FROM action_log), $1 - 1))`, [db.nextActionLogId]);

  console.log(`Migrated ${db.accidents.length} accidents, ${db.comments.length} comments.`);
  await client.end();
}

main().catch(err => { console.error(err); process.exit(1); });
