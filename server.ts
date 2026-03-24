import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("class_circle.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT,
    images TEXT, -- JSON array of base64 strings
    likes INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Check if likes column exists (for existing databases)
try {
  db.prepare("SELECT likes FROM posts LIMIT 1").get();
} catch (e) {
  db.exec("ALTER TABLE posts ADD COLUMN likes INTEGER DEFAULT 0");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/posts", (req, res) => {
    try {
      const posts = db.prepare("SELECT * FROM posts ORDER BY timestamp DESC").all();
      res.json(posts.map((post: any) => ({
        ...post,
        images: JSON.parse(post.images || '[]')
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch posts" });
    }
  });

  app.post("/api/posts", (req, res) => {
    const { content, images, timestamp } = req.body;
    try {
      const stmt = db.prepare("INSERT INTO posts (content, images, likes, timestamp) VALUES (?, ?, ?, ?)");
      const result = stmt.run(
        content, 
        JSON.stringify(images || []), 
        0, 
        timestamp || new Date().toISOString()
      );
      res.json({ id: result.lastInsertRowid, content, images, likes: 0, timestamp });
    } catch (error) {
      res.status(500).json({ error: "Failed to create post" });
    }
  });

  app.post("/api/posts/:id/like", (req, res) => {
    const { id } = req.params;
    try {
      const stmt = db.prepare("UPDATE posts SET likes = likes + 1 WHERE id = ?");
      stmt.run(id);
      const post = db.prepare("SELECT likes FROM posts WHERE id = ?").get() as { likes: number };
      res.json({ id, likes: post.likes });
    } catch (error) {
      res.status(500).json({ error: "Failed to like post" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
