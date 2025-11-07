import { generateObject } from "ai";
import { z } from "zod";
import Track from "../models/Track.js";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

import {
  system_prompt_static,
  assistant_prompt,
} from "../utils//system_assistant_prompt.js";

// Complete Zod schema matching your Mongoose schema exactly
const QuizQuestionSchema = z.object({
  question: z.string().default(""),
  options: z.array(
    z.object({
      option_heading: z.string(),
      feedback_text: z.string(),
      isCorrect: z.boolean(),
    })
  ),
  type: z.string(), // 'radio' | 'checkbox' | 'textinput'
  explanation: z.string().default(""),
});

const ResourceSchema = z.object({
  type: z.enum(["video", "reading", "quiz", "activity", "ppt", "feedback"]),
  name: z.string(),
  description: z.string().default("").optional(),
  estimatedDuration: z.number().optional(),
  points: z.number().optional(),

  // Video fields
  video: z
    .object({
      videoLink: z.string().default(""),
      orientation: z.string().default("horizontal"),
    })
    .optional(),

  // Reading fields
  reading: z
    .object({
      fileUrl: z.string().default("").optional(),
      readingFormatedText: z.string().default(""),
      downloadable: z.boolean().optional(),
    })
    .optional(),

  // Quiz fields
  quiz: z
    .object({
      category: z.enum(["graded", "non-graded"]),

      questions: z.array(QuizQuestionSchema),
      estimatedDuration: z.number().optional(),
      gradedPassedText: z.string().default(""),
      gradedFailedText: z.string().default(""),
      gradedPassingCriteria: z.number().optional(),
      gradedReattemptCount: z.number().default(0),
      non_gradedResultText: z.string().default(""),
    })
    .optional(),

  // Activity fields
  activity: z
    .object({
      isEvaluationRequired: z.boolean().optional(),
      isFinalPresentationActivity: z.boolean().optional(),
      passing_criteria: z.number().optional(),
      evaluationInstToAI: z.string().default(""),
      submissionType: z.enum(["image", "doc", "video", "text"]),
      subbmissionSize: z.number().default(5),
      isTextFieldRequired: z.boolean().optional(),
      textFieldCharCount: z.number().default(200),
    })
    .optional(),

  // PPT fields
  ppt: z
    .object({
      fileUrl: z.string().optional(),
      downloadable: z.boolean().optional(),
    })
    .optional(),

  // Feedback fields
  feedback: z
    .object({
      visualType: z.string().default("star"),
    })
    .optional(),
});

const ModuleSchema = z.object({
  name: z.string(),
  description: z.string().default("").optional(),
  estimatedDuration: z.number().optional(),
  points: z.number().optional(),
  resources: z.array(ResourceSchema),
});

const CourseSchema = z.object({
  name: z.string(),
  description: z.string().default("").optional(),
  estimatedHours: z.number().optional(),
  coverImage: z.string().default("").optional(),
  points: z.number().optional(),
  courseCode: z.string().default(""),
  modules: z.array(ModuleSchema),
});

const TermSchema = z.object({
  name: z.string(),
  description: z.string().default("").optional(),
  durationWeeks: z.number().optional(),
  points: z.number(),
  startDate: z.string().optional(), // Will be converted to Date when saving to MongoDB
  endDate: z.string().optional(), // Will be converted to Date when saving to MongoDB
  revenueTargetAmount: z.number().default(0),
  trackProgress: z.number().default(60),
  revenue: z.number().default(20),
  finalPresentation: z.number().default(20),
  passingMarks: z.number().default(40),
  totalTasks: z.number().default(0),
  totalQuizzes: z.number().default(0),
  courses: z.array(CourseSchema),
});

const TrackSchema = z.object({
  isOnboardingTrack: z.boolean().default(false),
  name: z.string(),
  description: z.string().default("").optional(),
  coverImage: z.string().default("").optional(),
  earningPotential: z.string().default("").optional(),
  goodFor: z.string().default("").optional(),
  duration: z.number().int().min(1).max(8), // 1-8 as numbers, matching Mongoose enum
  status: z.enum(["DRAFT", "LIVE"]).default("DRAFT"),
  difficultyLevel: z.enum(["Low", "Medium", "High"]).default("Medium"),
  creditsPerTerm: z.number().optional(),
  trackCode: z.string(),
  points: z.number().optional(),
  isDeleted: z.boolean().default(false),
  trackType: z.enum(["semester", "year"]).default("semester"),
  trackIcon: z.string().default("").optional(),
  lock_track_after_no_of_milestones: z.number(),
  terms: z.array(TermSchema),
  learn_more_resources: z.array(ResourceSchema).default([]),
});

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});
export const vercelAi = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    console.log("Generating course for:", message);

    const result = await generateObject({
      model: google("gemini-2.0-flash"),
      schema: TrackSchema,
      messages: [
        {
          role: "system",
          content: system_prompt_static,
        },
        {
          role: "user",
          content: `Create a detailed educational track based on: "${message}"

Return ONLY valid JSON that strictly matches the schema.
Do not include explanations.
Do not include comments.
Do not include markdown formatting.
Do not include any surrounding quotes, triple quotes, or code fences.
If unsure about any field, leave it as an empty string instead of inventing extra text.

Requirements:
- Minimum 12 milestones across the track
- Each course must have at least 12 weeks of content
- Calculate points bottom-up from resources
- Follow schema strictly`,
        },
        {
          role: "assistant",
          content: assistant_prompt,
        },
      ],
    });
    const courseData = result.object || result.output;

    return res.status(200).json({
      success: true,
      message: "Course created successfully",
      courseData: courseData,
    });
  } catch (error) {
    console.error("AI Error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Something went wrong",
    });
  }
};

export default vercelAi;
