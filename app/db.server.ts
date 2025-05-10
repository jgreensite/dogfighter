// app/db.server.ts
import initSqlJs, { type Database } from 'sql.js';
import fs from 'node:fs/promises';
import path from 'node:path';

let db: Database | null = null;
const dbFilePath = path.resolve(process.cwd(), 'database.sqlite');

async function initializeDatabase(): Promise<Database> {
  if (db) {
    return db;
  }

  const SQL = await initSqlJs({
    locateFile: (file) => `/${file}`, // Path to sql-wasm.wasm, served from root
  });

  let fileBuffer: Uint8Array | undefined;
  try {
    fileBuffer = await fs.readFile(dbFilePath);
    console.log('Loaded database from file.');
  } catch (error) {
    console.log('No existing database file found. Creating a new one.');
    // If the file doesn't exist, SQL.js will create an empty database
  }

  db = new SQL.Database(fileBuffer);

  // Initial schema setup if the database is new (e.g., check if tables exist)
  db.exec(`
    CREATE TABLE IF NOT EXISTS HighScores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        score INTEGER NOT NULL,
        gameMode TEXT NOT NULL,
        achievedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS GameSessions (
        id TEXT PRIMARY KEY,
        hostUsername TEXT NOT NULL, -- Simplified for now, could be hostId
        status TEXT NOT NULL DEFAULT 'lobby',
        playerCount INTEGER NOT NULL DEFAULT 0,
        maxPlayers INTEGER NOT NULL DEFAULT 8,
        gameMode TEXT NOT NULL DEFAULT 'deathmatch',
        gameSettings TEXT, 
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('Database schema ensured.');
  await saveDatabase(); // Save immediately after ensuring schema
  return db;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    return await initializeDatabase();
  }
  return db;
}

export async function saveDatabase() {
  if (!db) {
    console.warn('Database not initialized, cannot save.');
    return;
  }
  try {
    const data = db.export();
    await fs.writeFile(dbFilePath, data);
    console.log('Database saved to file.');
  } catch (error) {
    console.error('Failed to save database:', error);
  }
}

// Example usage (can be in loaders/actions)
export async function getHighScores(limit = 10, gameMode?: string) {
  const currentDb = await getDb();
  let query = 'SELECT username, score, gameMode, achievedAt FROM HighScores ORDER BY score DESC LIMIT ?';
  const params: (string | number)[] = [limit];

  if (gameMode) {
    query = 'SELECT username, score, gameMode, achievedAt FROM HighScores WHERE gameMode = ? ORDER BY score DESC LIMIT ?';
    params.unshift(gameMode);
  }
  
  const stmt = currentDb.prepare(query);
  stmt.bind(params);
  const scores = [];
  while (stmt.step()) {
    scores.push(stmt.getAsObject());
  }
  stmt.free();
  return scores;
}

export async function addHighScore(username: string, score: number, gameMode: string) {
  const currentDb = await getDb();
  currentDb.run('INSERT INTO HighScores (username, score, gameMode) VALUES (?, ?, ?)', [username, score, gameMode]);
  await saveDatabase();
}
