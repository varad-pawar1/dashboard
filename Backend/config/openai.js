import { GoogleGenAI } from "@google/genai";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const chatbot = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    // console.log("User message:", message);
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: message }] }],
    });
    const reply =
      result.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No reply generated.";
    console.log("Gemini reply:", reply);
    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini error:", error);
    return res.status(500).json({ error: error.message });
  }
};

// export const chatbot = async (req, res) => {
//   try {
//     const { message } = req.body;
//     if (!message) {
//       return res.status(400).json({ error: "Message is required" });
//     }
//     // console.log("User message:", message);
//     const result = await genAI.models.generateContent({
//       model: "gemini-2.0-flash",
//       contents: [{ role: "user", parts: [{ text: message }] }],
//     });
//     const reply =
//       result.candidates?.[0]?.content?.parts?.[0]?.text ||
//       "No reply generated.";
//     console.log("Gemini reply:", reply);
//     return res.status(200).json({ reply });
//   } catch (error) {
//     console.error("Gemini error:", error);
//     return res.status(500).json({ error: error.message });
//   }
// };
