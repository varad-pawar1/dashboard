import mongoose, { Schema } from "mongoose";

// schema start
const QuizQuestionSchema = new Schema(
  {
    question: { type: String, default: "" },
    options: [
      {
        option_heading: { type: String },
        feedback_text: { type: String },
        isCorrect: { type: Boolean },
        translations: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    type: { type: String },
    explanation: { type: String, default: "" },
    translations: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: true }
);

const ResourceSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["video", "reading", "quiz", "activity", "ppt", "feedback"],
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    estimatedDuration: { type: Number },
    points: { type: Number },
    translations: { type: Schema.Types.Mixed, default: {} },
    video: {
      videoLink: { type: String, default: "" },
      orientation: { type: String, default: "horizontal" },
      translations: { type: Schema.Types.Mixed, default: {} },
    },
    reading: {
      fileUrl: { type: String, default: "" },
      readingFormatedText: { type: String, default: "" },
      downloadable: { type: Boolean },
      translations: { type: Schema.Types.Mixed, default: {} },
    },
    quiz: {
      category: { type: String, enum: ["graded", "non-graded"] },
      translations: { type: Schema.Types.Mixed, default: {} },
      questions: [QuizQuestionSchema],
      gradedPassedText: { type: String, default: "" },
      gradedFailedText: { type: String, default: "" },
      gradedPassingCriteria: { type: Number },
      gradedReattemptCount: { type: Number, default: 0 },
      non_gradedResultText: { type: String, default: "" },
    },
    activity: {
      isFinalPresentationActivity: { type: Boolean },
      passing_criteria: { type: Number },
      evaluationInstToAI: { type: String, default: "" },
      submissionType: { type: String, enum: ["image", "doc", "video", "text"] },
      subbmissionSize: { type: Number, default: 5 },
      isTextFieldRequired: { type: Boolean },
      textFieldCharCount: { type: Number, default: 200 },
    },
    ppt: {
      fileUrl: { type: String },
      downloadable: { type: Boolean },
      translations: { type: Schema.Types.Mixed, default: {} },
    },
    feedback: {
      visualType: { type: String, default: "Star" },
    },
  },
  { _id: true }
);

const ModuleSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    estimatedDuration: { type: Number },
    points: { type: Number },
    translations: { type: Schema.Types.Mixed, default: {} },
    resources: [ResourceSchema],
  },
  { _id: true }
);

const CourseSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    estimatedHours: { type: Number },
    coverImage: { type: String, default: "" },
    points: { type: Number },
    courseCode: { type: String, default: "" },
    translations: { type: Schema.Types.Mixed, default: {} },
    modules: [ModuleSchema],
  },
  { _id: true }
);

const TermSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    durationWeeks: { type: Number },
    points: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    revenueTargetAmount: { type: Number, default: 0 },
    translations: { type: Schema.Types.Mixed, default: {} },
    trackProgress: { type: Number, default: 60 },
    revenue: { type: Number, default: 20 },
    finalPresentation: { type: Number, default: 20 },
    passingMarks: { type: Number, default: 40 },
    totalTasks: { type: Number, default: 0 },
    totalQuizzes: { type: Number, default: 0 },
    courses: [CourseSchema],
  },
  { _id: true }
);

const TrackSchema = new Schema(
  {
    isOnboardingTrack: { type: Boolean, default: false },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    earningPotential: { type: String, default: "" },
    goodFor: { type: String, default: "" },
    duration: {
      type: Number,
      enum: [1, 2, 3, 4, 5, 6, 7, 8], // in years like '1 year', '2 years', '3 years', '4 years'
      required: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "LIVE"],
      default: "DRAFT",
      required: true,
    },
    difficultyLevel: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
      required: true,
    },
    creditsPerTerm: { type: Number },
    trackCode: { type: String },
    points: { type: Number },
    isDeleted: { type: Boolean, default: false },
    lock_track_after_no_of_milestones: { type: Number, required: true },
    translations: { type: Schema.Types.Mixed, default: {} },
    trackType: { type: String, default: "semester" },
    trackIcon: { type: String, default: "" },
    terms: [TermSchema],
    learn_more_resources: [ResourceSchema],
  },
  { timestamps: true }
);
// schema end

TrackSchema.index({ name: 1 });
TrackSchema.index({ trackCode: 1 });
TrackSchema.index({ isDeleted: 1, status: 1 });

export default mongoose.model("Track", TrackSchema);
