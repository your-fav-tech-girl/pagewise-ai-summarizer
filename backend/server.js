import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GEMINI_API_KEY;

// Health check route (optional but useful)
app.get("/", (req, res) => {
  res.send("AI Summarizer Backend is running 🚀");
});

app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Summarize the following webpage content into clear bullet points:\n\n${text}`,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log("FULL GEMINI RESPONSE:", JSON.stringify(data, null, 2));

    // Safe extraction of response
    const summary =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ||
      null;

    if (!summary) {
      return res.json({
        summary:
          "No summary generated (check API key, quota, or response logs).",
      });
    }

    res.json({ summary });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
