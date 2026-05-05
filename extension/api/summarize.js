export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({
        error: "No content provided",
      });
    }

    //
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
                  text: `
Summarize this webpage into:
- 3 bullet points
- key insights
- estimated reading time

Content:
${content}
                  `,
                },
              ],
            },
          ],
        }),
      },
    );

    const data = await response.json();

    console.log("Gemini response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      return res.status(500).json({
        error: data.error?.message || "Gemini API error",
      });
    }

    const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!summary) {
      return res.status(500).json({
        error: "No summary generated.",
      });
    }

    const points = summary
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    return res.status(200).json({
      points,
      readingTime: `${Math.ceil(content.split(" ").length / 200)} min read`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Failed to summarize content.",
    });
  }
}
