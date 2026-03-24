import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes can be added here if needed
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    
    // Inject Firebase Config in Dev
    app.use(async (req, res, next) => {
      if (req.url === '/index.html' || req.url === '/') {
        try {
          let html = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8');
          html = await vite.transformIndexHtml(req.url, html);
          
          let firebaseConfig: any = {};
          try {
            const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
            if (fs.existsSync(configPath)) {
              firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            }
          } catch (e) {
            console.error("Error reading local firebase config:", e);
          }

          // Override apiKey with environment variable if it exists
          if (process.env.FIREBASE_API_KEY) {
            firebaseConfig.apiKey = process.env.FIREBASE_API_KEY;
          }

          html = html.replace(
            '<!-- FIREBASE_CONFIG -->',
            `<script>window.FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};</script>`
          );
          
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) {
          vite.ssrFixStacktrace(e as Error);
          next(e);
        }
      } else {
        next();
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      try {
        let html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        
        let firebaseConfig: any = {};
        try {
          const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
          if (fs.existsSync(configPath)) {
            firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          }
        } catch (e) {
          console.error("Error reading firebase config in production:", e);
        }

        // Override apiKey with environment variable if it exists
        if (process.env.FIREBASE_API_KEY) {
          firebaseConfig.apiKey = process.env.FIREBASE_API_KEY;
        }

        html = html.replace(
          '<!-- FIREBASE_CONFIG -->',
          `<script>window.FIREBASE_CONFIG = ${JSON.stringify(firebaseConfig)};</script>`
        );
        
        res.send(html);
      } catch (e) {
        res.status(500).send("Error loading index.html");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
