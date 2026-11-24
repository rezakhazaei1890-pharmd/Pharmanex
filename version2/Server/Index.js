
import express from "express";
import dotenv from "dotenv";
import { routeAIRequest } from "./ai/router.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));

// Server health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    application: "PHARMANEX",
    version: "2.0.0"
  });
});

// AI assistant endpoint
app.post("/api/ai/chat", async (req, res) => {
  try {
    const { message, preferredProvider = "auto" } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 10000
    ) {
      return res.status(400).json({
        error: "پیام نامعتبر است."
      });
    }

    const allowedProviders = [
      "auto",
      "provider_a",
      "provider_b"
    ];

    if (!allowedProviders.includes(preferredProvider)) {
      return res.status(400).json({
        error: "ارائه‌دهنده نامعتبر است."
      });
    }

    const result = await routeAIRequest(
      message.trim(),
      preferredProvider
    );

    return res.json({
      success: true,
      answer: result.answer,
      provider: result.provider,
      model: result.model
    });

  } catch (error) {
    console.error("PHARMANEX AI error:", error.message);

    return res.status(503).json({
      error: "دستیار هوشمند موقتاً در دسترس نیست."
    });
  }
});

// Not found
app.use((req, res) => {
  res.status(404).json({
    error: "مسیر مورد نظر پیدا نشد."
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PHARMANEX server running on port ${PORT}`);
});
