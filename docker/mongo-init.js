// MongoDB initialisation script
// Runs once on first container startup (docker-entrypoint-initdb.d)
// Creates the champlens database with required collections and indexes

db = db.getSiblingDB('champlens');

// ── Collections ────────────────────────────────────────────────────────────

db.createCollection('users');
db.createCollection('cards');
db.createCollection('scans');

// ── Indexes ────────────────────────────────────────────────────────────────

db.users.createIndex({ email: 1 }, { unique: true });

db.cards.createIndex({ userId: 1 });
db.cards.createIndex({ slug: 1 }, { unique: true });
db.cards.createIndex({ userId: 1, createdAt: -1 });

db.scans.createIndex({ cardId: 1 });
db.scans.createIndex({ slug: 1 });
db.scans.createIndex({ timestamp: -1 });
db.scans.createIndex({ cardId: 1, timestamp: -1 });

print('ChampLens: MongoDB initialised with collections and indexes.');
