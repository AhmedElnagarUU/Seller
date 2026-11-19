import { Schema, model, models, type InferSchemaType, type Model, type Types } from "mongoose";
import {
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  FEEDBACK_REPLY_MAX,
  FEEDBACK_REPLY_MIN,
  FEEDBACK_STATUSES,
  FEEDBACK_SUBJECT_MAX,
  FEEDBACK_SUBJECT_MIN,
} from "@/features/feedback/feedback.constants";

// One message from a customer to the owner, with at most one reply (docs/03-data-model.md section 14).
const feedbackSchema = new Schema(
  {
    // The customer who wrote the message.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    subject: {
      type: String,
      required: true,
      trim: true,
      minlength: FEEDBACK_SUBJECT_MIN,
      maxlength: FEEDBACK_SUBJECT_MAX,
    },
    // `trim: true` removes only the ends; line breaks inside stay.
    message: {
      type: String,
      required: true,
      trim: true,
      minlength: FEEDBACK_MESSAGE_MIN,
      maxlength: FEEDBACK_MESSAGE_MAX,
    },
    status: { type: String, required: true, enum: FEEDBACK_STATUSES, default: "new" },
    // The owner's answer. Null until the owner replies.
    reply: { type: String, default: null, trim: true, minlength: FEEDBACK_REPLY_MIN, maxlength: FEEDBACK_REPLY_MAX },
    repliedAt: { type: Date, default: null },
    repliedByUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { collection: "feedback", timestamps: true },
);

// The admin inbox: one tab per status, newest first.
feedbackSchema.index({ status: 1, createdAt: -1 });
// The customer's own list and the 24-hour limit.
feedbackSchema.index({ userId: 1, createdAt: -1 });

export type FeedbackRecord = InferSchemaType<typeof feedbackSchema> & { _id: Types.ObjectId };

// `models.Feedback ||` stops hot reload from defining the model twice.
export const FeedbackModel =
  (models.Feedback as Model<FeedbackRecord>) || model<FeedbackRecord>("Feedback", feedbackSchema);
