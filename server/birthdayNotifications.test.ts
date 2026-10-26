import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, or } from "drizzle-orm";
import { createBirthdayMatchNotifications, getDb } from "./db";
import { birthdayNotifications, blocks, matches, notifications, userProfiles, users } from "../drizzle/schema";

const BIRTHDAY_MEMBER_ID = 990041;
const RECIPIENT_ID = 990042;
const BLOCKED_RECIPIENT_ID = 990043;
const now = new Date();
const birthdayDate = `${now.getUTCFullYear() - 35}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

describe("private matched-member birthday reminders", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) return;
    const userIds = [BIRTHDAY_MEMBER_ID, RECIPIENT_ID, BLOCKED_RECIPIENT_ID];

    for (const userId of userIds) {
      await db.insert(users).values({
        id: userId,
        openId: `birthday-reminder-test-${userId}`,
        email: `birthday-reminder-test-${userId}@example.com`,
        name: "Birthday Reminder Test Member",
        loginMethod: "manus",
        role: "user",
      }).onDuplicateKeyUpdate({ set: { name: "Birthday Reminder Test Member" } });
    }
    await db.delete(birthdayNotifications).where(or(
      eq(birthdayNotifications.recipientUserId, RECIPIENT_ID),
      eq(birthdayNotifications.recipientUserId, BLOCKED_RECIPIENT_ID),
    ));
    await db.delete(notifications).where(or(
      eq(notifications.userId, RECIPIENT_ID),
      eq(notifications.userId, BLOCKED_RECIPIENT_ID),
    ));
    await db.delete(blocks).where(or(
      eq(blocks.blockerId, BLOCKED_RECIPIENT_ID),
      eq(blocks.blockedUserId, BIRTHDAY_MEMBER_ID),
    ));
    await db.delete(matches).where(or(
      eq(matches.user1Id, BIRTHDAY_MEMBER_ID),
      eq(matches.user2Id, BIRTHDAY_MEMBER_ID),
    ));
    await db.delete(userProfiles).where(or(
      eq(userProfiles.userId, BIRTHDAY_MEMBER_ID),
      eq(userProfiles.userId, RECIPIENT_ID),
      eq(userProfiles.userId, BLOCKED_RECIPIENT_ID),
    ));

    await db.insert(userProfiles).values([
      { userId: BIRTHDAY_MEMBER_ID, displayName: "Birthday Friend", birthDate: birthdayDate },
      { userId: RECIPIENT_ID, displayName: "Recipient Friend" },
      { userId: BLOCKED_RECIPIENT_ID, displayName: "Blocked Friend" },
    ]);
    await db.insert(matches).values([
      { user1Id: BIRTHDAY_MEMBER_ID, user2Id: RECIPIENT_ID, compatibilityScore: 70, status: "active" },
      { user1Id: BIRTHDAY_MEMBER_ID, user2Id: BLOCKED_RECIPIENT_ID, compatibilityScore: 70, status: "active" },
    ]);
    await db.insert(blocks).values({ blockerId: BLOCKED_RECIPIENT_ID, blockedUserId: BIRTHDAY_MEMBER_ID });
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;
    const userIds = [BIRTHDAY_MEMBER_ID, RECIPIENT_ID, BLOCKED_RECIPIENT_ID];
    await db.delete(birthdayNotifications).where(or(
      eq(birthdayNotifications.recipientUserId, RECIPIENT_ID),
      eq(birthdayNotifications.recipientUserId, BLOCKED_RECIPIENT_ID),
    ));
    await db.delete(notifications).where(or(
      eq(notifications.userId, RECIPIENT_ID),
      eq(notifications.userId, BLOCKED_RECIPIENT_ID),
    ));
    await db.delete(blocks).where(or(
      eq(blocks.blockerId, BLOCKED_RECIPIENT_ID),
      eq(blocks.blockedUserId, BIRTHDAY_MEMBER_ID),
    ));
    await db.delete(matches).where(or(eq(matches.user1Id, BIRTHDAY_MEMBER_ID), eq(matches.user2Id, BIRTHDAY_MEMBER_ID)));
    await db.delete(userProfiles).where(or(
      eq(userProfiles.userId, BIRTHDAY_MEMBER_ID),
      eq(userProfiles.userId, RECIPIENT_ID),
      eq(userProfiles.userId, BLOCKED_RECIPIENT_ID),
    ));
    for (const userId of userIds) {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("notifies active, unblocked matches without disclosing the birth date", async () => {
    const result = await createBirthdayMatchNotifications(now);
    expect(result).toMatchObject({ birthdayMembers: 1, created: 1, skipped: 1 });

    const db = await getDb();
    if (!db) return;
    const created = await db.select().from(notifications).where(and(
      eq(notifications.userId, RECIPIENT_ID),
      eq(notifications.type, "birthday_reminder"),
    ));
    expect(created).toHaveLength(1);
    expect(created[0]?.title).toBe("A match has a birthday today");
    expect(created[0]?.body).toContain("Birthday Friend");
    expect(created[0]?.body).not.toContain(birthdayDate);

    const blockedNotifications = await db.select().from(notifications).where(and(
      eq(notifications.userId, BLOCKED_RECIPIENT_ID),
      eq(notifications.type, "birthday_reminder"),
    ));
    expect(blockedNotifications).toHaveLength(0);
  });

  it("is safe to retry without creating duplicate reminders", async () => {
    const retry = await createBirthdayMatchNotifications(now);
    expect(retry).toMatchObject({ birthdayMembers: 1, created: 0, skipped: 2 });

    const db = await getDb();
    if (!db) return;
    const deliveryRecords = await db.select().from(birthdayNotifications).where(and(
      eq(birthdayNotifications.recipientUserId, RECIPIENT_ID),
      eq(birthdayNotifications.birthdayUserId, BIRTHDAY_MEMBER_ID),
    ));
    expect(deliveryRecords).toHaveLength(1);
  });
});
