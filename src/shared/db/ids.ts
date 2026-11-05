import { Types } from "mongoose";
import { AppError } from "@/shared/errors";

// Converts an id from outside input into an ObjectId, or throws NOT_FOUND.
export function toObjectId(id: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id) || new Types.ObjectId(id).toString() !== id.toLowerCase()) {
    throw new AppError("NOT_FOUND", "Not found.");
  }
  return new Types.ObjectId(id);
}
