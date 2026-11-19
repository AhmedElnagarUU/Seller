import { Types } from "mongoose";
import { beforeEach, describe, expect, it } from "vitest";
import { setTestNow } from "@/shared/lib/clock";
import { fakeEmailSender } from "@/shared/test/fakes/fake-email-sender";
import { createAdmin, createFeedback, createUser } from "@/shared/test/factories";
import { ActivityLogModel } from "@/features/activity/activity-log.model";
import { FeedbackModel } from "@/features/feedback/feedback.model";
import {
  countNewFeedback,
  listFeedbackForAdmin,
  listFeedbackForUser,
  openFeedbackForAdmin,
  reopenFeedback,
  replyToFeedback,
  resolveFeedback,
  sendFeedback,
} from "@/features/feedback/feedback.service";
import { NotificationModel } from "@/features/notifications/notification.model";

const NOW = new Date("2026-11-10T10:00:00Z");
const HOUR_MS = 60 * 60 * 1000;
const RATE_LIMIT_TEXT = "You have sent a lot of feedback today. Please try again tomorrow.";
const NOT_FOUND = "Feedback not found.";
const ALREADY_REPLIED = "This feedback already has a reply.";

beforeEach(() => {
  setTestNow(NOW);
});

describe("sendFeedback", () => {
  it("saves a new message → row: userId, subject, status new, reply null; the ends are trimmed, an inner line break is kept", async () => {
    const user = await createUser();

    const { id } = await sendFeedback(user._id.toString(), {
      subject: "  Question about updates  ",
      message: "  First line\nSecond line  ",
    });

    const rows = await FeedbackModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0]?._id.toString()).toBe(id);
    expect(rows[0]?.userId.toString()).toBe(user._id.toString());
    expect(rows[0]?.subject).toBe("Question about updates");
    expect(rows[0]?.message).toBe("First line\nSecond line");
    expect(rows[0]?.status).toBe("new");
    expect(rows[0]?.reply).toBeNull();
  });

  it("writes one feedback_sent activity row → actorRole customer, actorUserId = subjectUserId = the user, targetType feedback, targetId = the feedback id", async () => {
    const user = await createUser();

    const { id } = await sendFeedback(user._id.toString(), { subject: "Hello there", message: "A message of ten+" });

    const logs = await ActivityLogModel.find().lean();
    expect(logs).toHaveLength(1);
    expect(logs[0]?.action).toBe("feedback_sent");
    expect(logs[0]?.actorRole).toBe("customer");
    expect(logs[0]?.actorUserId?.toString()).toBe(user._id.toString());
    expect(logs[0]?.subjectUserId?.toString()).toBe(user._id.toString());
    expect(logs[0]?.targetType).toBe("feedback");
    expect(logs[0]?.targetId?.toString()).toBe(id);
    expect(logs[0]?.summary).toBe("Feedback sent: Hello there");
  });

  it("refuses the 6th message within 24 hours → RATE_LIMITED with the message; 5 rows; still 5 activity rows", async () => {
    const user = await createUser();
    for (let index = 0; index < 5; index += 1) {
      await sendFeedback(user._id.toString(), { subject: `Subject ${index}`, message: "A message of ten+" });
    }

    await expect(
      sendFeedback(user._id.toString(), { subject: "Sixth", message: "A message of ten+" }),
    ).rejects.toMatchObject({ code: "RATE_LIMITED", message: RATE_LIMIT_TEXT });

    expect(await FeedbackModel.countDocuments()).toBe(5);
    expect(await ActivityLogModel.countDocuments()).toBe(5);
  });

  it("does not count messages older than 24 hours → the next message is saved", async () => {
    const user = await createUser();
    const rows = [];
    for (let index = 0; index < 5; index += 1) {
      rows.push(await createFeedback(user._id.toString()));
    }
    await FeedbackModel.collection.updateOne(
      { _id: rows[0]?._id },
      { $set: { createdAt: new Date(NOW.getTime() - 25 * HOUR_MS) } },
    );

    await sendFeedback(user._id.toString(), { subject: "Again", message: "A message of ten+" });

    expect(await FeedbackModel.countDocuments()).toBe(6);
    const windowStart = new Date(NOW.getTime() - 24 * HOUR_MS);
    expect(await FeedbackModel.countDocuments({ createdAt: { $gte: windowStart } })).toBe(5);
  });

  it("counts per user → 5 rows of another user do not block this user", async () => {
    const other = await createUser();
    const user = await createUser();
    for (let index = 0; index < 5; index += 1) {
      await createFeedback(other._id.toString());
    }

    const { id } = await sendFeedback(user._id.toString(), { subject: "Mine", message: "A message of ten+" });

    expect(await FeedbackModel.countDocuments({ userId: user._id })).toBe(1);
    expect(await FeedbackModel.countDocuments({ _id: id })).toBe(1);
  });
});

describe("listFeedbackForUser", () => {
  it("returns only the user's messages, newest first, with the reply when present", async () => {
    const user = await createUser();
    const other = await createUser();
    const admin = await createAdmin();
    const older = await createFeedback(user._id.toString(), {
      subject: "Older one",
      createdAt: new Date("2026-11-01T10:00:00Z"),
    });
    const newer = await createFeedback(user._id.toString(), {
      subject: "Newer one",
      createdAt: new Date("2026-11-02T10:00:00Z"),
      reply: "Thanks for writing",
      repliedAt: new Date("2026-11-03T10:00:00Z"),
      repliedByUserId: admin._id,
    });
    await createFeedback(other._id.toString(), { subject: "Not mine" });

    const list = await listFeedbackForUser(user._id.toString());

    expect(list.map((item) => item.id)).toEqual([newer._id.toString(), older._id.toString()]);
    expect(list[0]).toMatchObject({
      subject: "Newer one",
      status: "new",
      reply: "Thanks for writing",
      repliedAt: new Date("2026-11-03T10:00:00Z"),
    });
    expect(list[1]).toMatchObject({ subject: "Older one", reply: null, repliedAt: null });
  });
});

describe("listFeedbackForAdmin", () => {
  it("returns only the tab's status, newest first, with customer name and email", async () => {
    const ann = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const bob = await createUser({ name: "Bob Ray", email: "bob@example.com" });
    const first = await createFeedback(ann._id.toString(), { createdAt: new Date("2026-11-01T10:00:00Z") });
    const second = await createFeedback(bob._id.toString(), { createdAt: new Date("2026-11-02T10:00:00Z") });
    await createFeedback(ann._id.toString(), { status: "read" });

    const result = await listFeedbackForAdmin({ status: "new", page: 1 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([second._id.toString(), first._id.toString()]);
    expect(result.items[0]).toMatchObject({ customerName: "Bob Ray", customerEmail: "bob@example.com" });
    expect(result.items[1]).toMatchObject({ customerName: "Ann Lee", customerEmail: "ann@example.com" });
  });

  it("shows a dash for a customer that no longer exists", async () => {
    await createFeedback(new Types.ObjectId().toString());

    const result = await listFeedbackForAdmin({ status: "new", page: 1 });

    expect(result.items[0]).toMatchObject({ customerName: "—", customerEmail: "—" });
  });

  it("paginates 20 per page → 25 rows: page 1 has 20, page 2 has 5, totalPages 2", async () => {
    const user = await createUser();
    for (let index = 0; index < 25; index += 1) {
      await createFeedback(user._id.toString());
    }

    const pageOne = await listFeedbackForAdmin({ status: "new", page: 1 });
    const pageTwo = await listFeedbackForAdmin({ status: "new", page: 2 });

    expect(pageOne.items).toHaveLength(20);
    expect(pageTwo.items).toHaveLength(5);
    expect(pageOne.totalPages).toBe(2);
    expect(pageTwo.page).toBe(2);
    expect(pageOne.total).toBe(25);
  });
});

describe("openFeedbackForAdmin", () => {
  it("sets a new message to read and returns it → DB status read, DTO status read, customer filled", async () => {
    const user = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const feedback = await createFeedback(user._id.toString(), { subject: "Open me" });

    const dto = await openFeedbackForAdmin(feedback._id.toString());

    expect((await FeedbackModel.findById(feedback._id).lean())?.status).toBe("read");
    expect(dto).toMatchObject({
      id: feedback._id.toString(),
      subject: "Open me",
      status: "read",
      customer: { id: user._id.toString(), name: "Ann Lee", email: "ann@example.com" },
    });
  });

  it("leaves a resolved message resolved → DB status still resolved", async () => {
    const user = await createUser();
    const feedback = await createFeedback(user._id.toString(), { status: "resolved" });

    const dto = await openFeedbackForAdmin(feedback._id.toString());

    expect(dto?.status).toBe("resolved");
    expect((await FeedbackModel.findById(feedback._id).lean())?.status).toBe("resolved");
  });

  it("returns null for an unknown and an invalid id", async () => {
    expect(await openFeedbackForAdmin(new Types.ObjectId().toString())).toBeNull();
    expect(await openFeedbackForAdmin("not-an-id")).toBeNull();
  });
});

describe("replyToFeedback", () => {
  it("saves the reply, notifies and emails the customer", async () => {
    const user = await createUser({ name: "Ann Lee", email: "ann@example.com" });
    const admin = await createAdmin();
    const feedback = await createFeedback(user._id.toString(), { subject: "Question about updates", status: "read" });

    await replyToFeedback(feedback._id.toString(), "Updates are free.\nForever.", admin._id.toString());

    const row = await FeedbackModel.findById(feedback._id).lean();
    expect(row?.reply).toBe("Updates are free.\nForever.");
    expect(row?.repliedAt).toEqual(NOW);
    expect(row?.repliedByUserId?.toString()).toBe(admin._id.toString());
    expect(row?.status).toBe("read");
    const notifications = await NotificationModel.find().lean();
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      type: "feedback_reply",
      title: "Reply to your feedback",
      body: "Question about updates",
      link: "/account/feedback",
      readAt: null,
      jobId: null,
    });
    expect(notifications[0]?.userId.toString()).toBe(user._id.toString());
    expect(fakeEmailSender.sent).toHaveLength(1);
    const email = fakeEmailSender.sent[0];
    expect(email?.to).toBe("ann@example.com");
    expect(email?.subject).toBe("Reply to your feedback: Question about updates");
    expect(email?.templateName).toBe("FeedbackReplyEmail");
    expect(email?.text).toContain("Updates are free.");
    expect(email?.text).toContain("Forever.");
    expect(email?.text).toContain("http://localhost:3000/account/feedback");
  });

  it("still succeeds when the email fails → the call resolves; reply and notification are saved", async () => {
    const user = await createUser();
    const admin = await createAdmin();
    const feedback = await createFeedback(user._id.toString());
    fakeEmailSender.failNext(new Error("boom"));

    await expect(replyToFeedback(feedback._id.toString(), "A reply", admin._id.toString())).resolves.toBeUndefined();

    expect((await FeedbackModel.findById(feedback._id).lean())?.reply).toBe("A reply");
    expect(await NotificationModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("refuses an unknown id → NOT_FOUND 'Feedback not found.'; 0 notifications; 0 emails", async () => {
    const admin = await createAdmin();

    for (const id of [new Types.ObjectId().toString(), "not-an-id"]) {
      await expect(replyToFeedback(id, "A reply", admin._id.toString())).rejects.toMatchObject({
        code: "NOT_FOUND",
        message: NOT_FOUND,
      });
    }

    expect(await NotificationModel.countDocuments()).toBe(0);
    expect(fakeEmailSender.sent).toHaveLength(0);
  });

  it("second reply → CONFLICT 'This feedback already has a reply.'; first reply unchanged, 1 notification, 1 email", async () => {
    const user = await createUser();
    const admin = await createAdmin();
    const feedback = await createFeedback(user._id.toString());
    await replyToFeedback(feedback._id.toString(), "First reply", admin._id.toString());

    await expect(replyToFeedback(feedback._id.toString(), "Second reply", admin._id.toString())).rejects.toMatchObject({
      code: "CONFLICT",
      message: ALREADY_REPLIED,
    });

    expect((await FeedbackModel.findById(feedback._id).lean())?.reply).toBe("First reply");
    expect(await NotificationModel.countDocuments()).toBe(1);
    expect(fakeEmailSender.sent).toHaveLength(1);
  });
});

describe("resolveFeedback / reopenFeedback", () => {
  it("resolve sets resolved; reopen sets a resolved row to read and leaves a new row new", async () => {
    const user = await createUser();
    const fresh = await createFeedback(user._id.toString());
    const read = await createFeedback(user._id.toString(), { status: "read" });

    await resolveFeedback(fresh._id.toString());
    await resolveFeedback(read._id.toString());
    expect((await FeedbackModel.findById(fresh._id).lean())?.status).toBe("resolved");
    expect((await FeedbackModel.findById(read._id).lean())?.status).toBe("resolved");

    await reopenFeedback(fresh._id.toString());
    expect((await FeedbackModel.findById(fresh._id).lean())?.status).toBe("read");

    const untouched = await createFeedback(user._id.toString());
    await reopenFeedback(untouched._id.toString());
    expect((await FeedbackModel.findById(untouched._id).lean())?.status).toBe("new");
  });

  it("both refuse an unknown id with 'Feedback not found.'", async () => {
    const unknown = new Types.ObjectId().toString();

    await expect(resolveFeedback(unknown)).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
    await expect(reopenFeedback(unknown)).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
    await expect(resolveFeedback("not-an-id")).rejects.toMatchObject({ code: "NOT_FOUND", message: NOT_FOUND });
  });
});

describe("countNewFeedback", () => {
  it("counts only new rows → 2 new + 1 read + 1 resolved gives 2", async () => {
    const user = await createUser();
    await createFeedback(user._id.toString());
    await createFeedback(user._id.toString());
    await createFeedback(user._id.toString(), { status: "read" });
    await createFeedback(user._id.toString(), { status: "resolved" });

    expect(await countNewFeedback()).toBe(2);
  });
});
