import Database from "better-sqlite3";

export interface Post {
  id: number;
  content: string;
  images: string[];
  likes: number;
  timestamp: string;
}

interface RawPostRow {
  id: number;
  content: string | null;
  images: string | null;
  likes: number | null;
  timestamp: string;
}

const db = new Database("class_circle.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    images TEXT,
    likes INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.prepare("SELECT likes FROM posts LIMIT 1").get();
} catch {
  db.exec("ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0");
}

const selectPostsStmt = db.prepare(
  "SELECT id, content, images, likes, timestamp FROM posts ORDER BY datetime(timestamp) DESC, id DESC",
);
const insertPostStmt = db.prepare(
  "INSERT INTO posts (content, images, likes, timestamp) VALUES (?, ?, ?, ?)",
);
const likePostStmt = db.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ?");
const selectPostLikesStmt = db.prepare("SELECT likes FROM posts WHERE id = ?");

const parseImages = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const toPost = (row: RawPostRow): Post => ({
  id: row.id,
  content: row.content ?? "",
  images: parseImages(row.images),
  likes: row.likes ?? 0,
  timestamp: row.timestamp,
});

export const listPosts = (): Post[] => {
  const rows = selectPostsStmt.all() as RawPostRow[];
  return rows.map(toPost);
};

export const createPost = (input: {
  content: string;
  images: string[];
  timestamp: string;
}): Post => {
  const result = insertPostStmt.run(
    input.content,
    JSON.stringify(input.images),
    0,
    input.timestamp,
  );

  return {
    id: Number(result.lastInsertRowid),
    content: input.content,
    images: input.images,
    likes: 0,
    timestamp: input.timestamp,
  };
};

export const likePost = (id: number): number | null => {
  const result = likePostStmt.run(id);
  if (result.changes === 0) {
    return null;
  }

  const row = selectPostLikesStmt.get(id) as { likes: number } | undefined;
  return row?.likes ?? 0;
};
