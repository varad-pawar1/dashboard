// import { GoogleGenAI } from "@google/genai";
// import Track from "../models/Track.js";
// const genAI = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// export const getSystemPrompt = async (req, res) => {
//   try {
//     console.log(req.body);
//     const { message } = req.body;
//     const schemaStructure = Track;

//     const promptGenerationRequest = `Based on the following MongoDB schema structure for an educational track management system, generate a comprehensive system prompt that will be used by an AI assistant to help users understand and navigate the system.

// Schema Structure:
// ${JSON.stringify(schemaStructure)}

// Additional Context from User:
// ${message ? JSON.stringify(message) : "No additional context provided"}

// ---

// Generate a professional system prompt that includes the following sections:`;

//     const result = await genAI.models.generateContent({
//       model: "gemini-2.0-flash",
//       contents: [{ role: "user", parts: [{ text: promptGenerationRequest }] }],
//     });

//     console.log("System prompt generated successfully", result);

//     return res.status(200).json({
//       success: true,
//       systemPrompt: result,
//       schemaVersion: "1.0",
//       generatedAt: new Date().toISOString(),
//       schemaStructure: schemaStructure,
//     });
//   } catch (error) {
//     console.error("Error generating system prompt:", error);
//     return res.status(500).json({
//       success: false,
//       error: error.message,
//       timestamp: new Date().toISOString(),
//     });
//   }
// };

import { GoogleGenAI } from "@google/genai";
import Track from "../models/Track.js";
const genAI = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});
//  Converts Mongoose schema to a readable JSON structure

const schemaToJSON = (schema) => {
  const result = {};

  const extractSchemaInfo = (paths) => {
    const structure = {};

    for (const [path, schemaType] of Object.entries(paths)) {
      if (path === "_id" || path === "__v") continue;

      const fieldInfo = {
        type: schemaType.instance,
        required: schemaType.isRequired || false,
      };

      if (schemaType.defaultValue !== undefined) {
        fieldInfo.default = schemaType.defaultValue;
      }

      if (schemaType.enumValues && schemaType.enumValues.length > 0) {
        fieldInfo.enum = schemaType.enumValues;
      }

      if (schemaType.options) {
        if (schemaType.options.min !== undefined)
          fieldInfo.min = schemaType.options.min;
        if (schemaType.options.max !== undefined)
          fieldInfo.max = schemaType.options.max;
      }

      // Handle nested schemas (embedded documents)
      if (schemaType.schema) {
        fieldInfo.schema = extractSchemaInfo(schemaType.schema.paths);
      }

      // Handle arrays with schema
      if (schemaType.caster && schemaType.caster.schema) {
        fieldInfo.arrayItemSchema = extractSchemaInfo(
          schemaType.caster.schema.paths
        );
      }

      structure[path] = fieldInfo;
    }

    return structure;
  };

  return extractSchemaInfo(schema.paths);
};

//  Generate system prompt based on Track schema and user context

export const getSystemPrompt = async (req, res) => {
  try {
    const { message } = req.body;

    // Convert Mongoose schema to readable JSON
    const schemaStructure = schemaToJSON(Track.schema);

    // Create a comprehensive prompt for Gemini with the actual schema
    const promptGenerationRequest = `You are an AI system prompt architect. Generate a comprehensive, professional system prompt for an AI assistant that will help users interact with an educational track management system.

## ACTUAL MONGOOSE SCHEMA STRUCTURE

Below is the complete schema structure for the Track model that defines the entire educational system hierarchy:

\`\`\`json
${JSON.stringify(schemaStructure, null, 2)}
\`\`\`

## SCHEMA HIERARCHY EXPLANATION

The schema represents a nested structure:
1. **Track** (root level) - Contains:
   - Basic fields: name, description, coverImage, duration, status, etc.
   - Array of **Terms** (semesters/periods)
   - Array of **learn_more_resources** (additional learning materials)

2. **Term** (within Track) - Contains:
   - Academic period details: startDate, endDate, durationWeeks
   - Grading configuration: trackProgress, revenue, finalPresentation, passingMarks
   - Array of **Courses**

3. **Course** (within Term) - Contains:
   - Course details: name, description, estimatedHours, points
   - Array of **Modules**

4. **Module** (within Course) - Contains:
   - Module details: name, description, estimatedDuration, points
   - Array of **Resources** (learning materials)

5. **Resource** (within Module) - Can be one of several types:
   - video: with videoLink, orientation
   - reading: with fileUrl, readingFormattedText, downloadable
   - quiz: with questions, category (graded/non-graded), passing criteria
   - activity: with submission types, AI evaluation instructions
   - ppt: with fileUrl, downloadable
   - feedback: with visualType

6. **QuizQuestion** (within Quiz Resource) - Contains:
   - question text
   - Array of options (with option_heading, feedback_text, isCorrect)
   - type and explanation

${message ? `\n## ADDITIONAL USER CONTEXT\n${message}\n` : ""}

## YOUR TASK

Generate a professional system prompt that an AI assistant will use to help users work with this schema. The system prompt should include:

1. **Role & Purpose**: Define the AI assistant's role clearly
2. **System Architecture**: Explain the hierarchical structure (Track → Term → Course → Module → Resource)
3. **Schema Knowledge**: Show understanding of all field types, enums, required fields, defaults
4. **Capabilities**: What operations the AI can help with (explain structure, validate data, guide creation, etc.)
5. **Resource Type Details**: Explain each resource type (video, reading, quiz, activity, ppt, feedback) and their specific properties
6. **Special Features**:
   - Translation support (translations field in multiple entities)
   - Grading system (trackProgress: 60%, revenue: 20%, finalPresentation: 20%)
   - Quiz evaluation (graded vs non-graded)
   - Activity submissions with AI evaluation
   - Status management (DRAFT/LIVE)
   - Soft delete (isDeleted flag)
7. **Interaction Guidelines**: How to communicate effectively with users
8. **Data Validation**: Required fields, enum values, type constraints
9. **Response Format**: How to structure responses (clear, helpful, accurate)


## OUTPUT REQUIREMENTS

- Write the system prompt in a clear, structured format using markdown
- Make it comprehensive but not verbose
- Focus on practical utility for the AI assistant
- Ensure the AI will understand all schema constraints and relationships
- The prompt should be ready to use directly with an LLM
- Length: Aim for 800-1500 words

Generate the system prompt now:`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: promptGenerationRequest }] }],
    });

    console.log("System prompt generated successfully");

    const systemPrompt =
      result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({
      success: true,
      systemPrompt,
      metadata: {
        schemaVersion: "1.0",
        generatedAt: new Date().toISOString(),
        contextProvided: !!message,
        modelUsed: "gemini-2.0-flash",
        schemaFieldsCount: Object.keys(schemaStructure).length,
      },
    });
  } catch (error) {
    console.error("Error generating system prompt:", error);

    return res.status(500).json({
      success: false,
      timestamp: new Date().toISOString(),
    });
  }
};
