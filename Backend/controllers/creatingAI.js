import { GoogleGenAI } from "@google/genai";
import Track from "../models/Track.js";
import system_prompt_static from "../utils/system_prompt_static.js";
import { jsonrepair } from "jsonrepair";

const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export const createCourseWithAI = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course description message is required",
      });
    }

    const promptGenerationRequest = `${system_prompt_static} ${Track} 
    USER REQUEST: "${message}"

CRITICAL INSTRUCTIONS:
1. Based on the user's request, YOU MUST INTELLIGENTLY DECIDE:
   - Appropriate track name and description
   - Duration (1-8 years) based on content complexity
   - Difficulty level (Low/Medium/High) based on the subject
   - Number of terms/semesters needed
   - Number of courses per term
   - Number of modules per course
   - Mix and number of resources (videos, readings, quizzes, activities, etc.)
   - Realistic time estimates for each resource
   - Appropriate point allocation
   - Target audience and prerequisites

2. CREATE A COMPLETE, PRODUCTION-READY COURSE STRUCTURE:
   - Make it comprehensive and professional
   - Include detailed, engaging content descriptions
   - Create meaningful quiz questions with proper feedback
   - Write detailed evaluation instructions for activities
   - Ensure logical progression from basics to advanced
   - Balance theory (videos/readings) with practice (quizzes/activities)

3. RETURN FORMAT:
   - Return ONLY valid JSON matching the Track schema above
   - NO markdown formatting, code blocks, or explanatory text
   - Ensure all required fields are included
   - Use realistic, professional content

4. SMART DEFAULTS:
   - Set lock_track_after_no_of_milestones: 3
   - Set status: "DRAFT"
   - Set isOnboardingTrack: false
   - For quiz activities, include 5-10 questions minimum
   - For activities, write detailed evaluationInstToAI instructions
   - Include at least one final presentation activity per course

Generate the complete course structure now in valid JSON format:`;

    // --- Call Gemini ---
    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: promptGenerationRequest }] }],
    });

    // --- Extract text response ---
    let data = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // --- Clean up markdown or bad characters ---
    data = data
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/\n/g, " ")
      .replace(/\t/g, " ")
      .trim();

    // --- Attempt to parse JSON safely ---
    //  npm install jsonrepair
    let courseData;
    try {
      courseData = JSON.parse(data);
    } catch (parseError) {
      console.warn(" Invalid JSON — trying to repair...");
      try {
        const repaired = jsonrepair(data);
        courseData = JSON.parse(repaired);
      } catch (repairError) {
        console.error(" Failed even after repair:", repairError);
        return res.status(500).json({
          success: false,
          message: "AI returned invalid JSON, even after repair.",
          rawSnippet: data.slice(0, 1000) + "...", // short preview for debugging
        });
      }
    }

    // --- Success response ---
    return res.status(200).json({
      success: true,
      message: "Course created successfully with AI",
      courseData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error during AI course generation",
      timestamp: new Date().toISOString(),
    });
  }
};
