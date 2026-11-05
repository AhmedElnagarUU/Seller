import { Types } from "mongoose";
import { AppError } from "@/shared/errors";

// Converts an id from outside input into an ObjectId, or null when it is not a valid id.
// Pages use it to show "not found" instead of an error.
export function parseObjectId(id: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(id) || new Types.ObjectId(id).toString() !== id.toLowerCase()) return null;
  return new Types.ObjectId(id);
}

// Converts an id from outside input into an ObjectId, or throws NOT_FOUND. Actions use it.
export function toObjectId(id: string): Types.ObjectId {
  const objectId = parseObjectId(id);
  if (!objectId) throw new AppError("NOT_FOUND", "Not found.");
  return objectId;
}
