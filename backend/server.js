import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/summarize", async (req, res) => {
  try {
    const { text } = req.body;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Summarize this clearly in bullet points:\n\n${text}`,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log("FULL RESPONSE:", JSON.stringify(data, null, 2));

    const candidate = data?.candidates?.[0];

    const summary =
      candidate?.content?.parts?.map((p) => p.text).join("") || null;

    if (!summary) {
      return res.json({
        summary: "No summary generated (check logs for Gemini response).",
      });
    }

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
