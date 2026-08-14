import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

// Handle payload size & JSON parsing errors gracefully
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    res.status(413).json({ error: "Payload too large. Please reduce dataset size." });
    return;
  }
  next(err);
});

// Lazy-initialize Gemini AI client to prevent crash on startup if GEMINI_API_KEY is not defined yet
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// API endpoint for Divine AI Assistant
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, erpState } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: "Messages array is required." });
      return;
    }

    const ai = getAiClient();
    
    // Construct rich system prompt with ERP contextual data
    const systemInstruction = `You are "Divine AI", the virtual Chief Financial Officer & Intelligent Operations Assistant for Divine Traders.
You are embedded directly inside the Divine Traders ERP system.
Your goal is to help users manage, analyze, and optimize business operations including sales, purchase orders, goods receipts, outstanding bills, vendor outstanding payments, stock management, ledger balances, and GST reporting.

The user's current ERP data state is provided below for accurate real-time analysis. Do not mention that this raw data is passed as JSON unless asked, but use it to provide precise, mathematical, and business-focused answers:

--- CURRENT ERP STATE CONTEXT ---
${JSON.stringify(erpState, null, 2)}
---------------------------------

Capabilities and tone guidelines:
1. Provide concrete operations support (e.g., draft emails to vendors requesting payment extension, calculate exactly which vendor has the highest outstanding balance and suggest paying them first, or audit stock levels for any items below their minimum thresholds).
2. Answer queries with direct reference to the stocks, invoices, ledgers, or purchase orders. Always verify the numbers using the context.
3. Be professional, highly competent, analytical, and supportive of Divine Traders' growth. Keep answers concise, actionable, and formatted in clear Markdown with bullet points or tables where appropriate.`;

    // Process chat history
    const geminiMessages = messages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    // Generate content using gemini-3.5-flash for fast and competent analysis
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: geminiMessages,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    res.json({ content: response.text });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error?.message || "Internal server error" });
  }
});

// Setup Vite Dev Server / Production Static Serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
  });
}

startServer();
