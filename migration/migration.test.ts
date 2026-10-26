import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { planUploads } from "./upload-files";
import {
  countInsertRows,
  manifestFromDump,
  parseInsertRows,
  isBcryptHash,
  parseDump,
  parseManifest,
  planUsers,
  replacementPrefix,
  rewriteJsonDefaults,
  splitMigration,
  visibilityFor,
  withColumnList,
  type UserRow,
} from "./sql";
import { redact } from "./lib";

const DUMP = [
  "DROP TABLE IF EXISTS `users`;",
  "CREATE TABLE `users` (",
  "  `id` int NOT NULL AUTO_INCREMENT,",
  "  `openId` varchar(64) NOT NULL,",
  "  `name` text COLLATE utf8mb4_unicode_ci,",
  "  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,",
  "  UNIQUE KEY `openId` (`openId`)",
  ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  "INSERT INTO `users` VALUES (1,'a','O''Brien (x), y'),(2,'b','semi;colon ),(');",
  "CREATE TABLE `empty_table` (",
  "  `id` int NOT NULL",
  ");",
].join("\n");

describe("dump parsing", () => {
  const tables = parseDump(DUMP);

  it("finds tables, their columns in order, and ignores key lines", () => {
    expect([...tables.keys()]).toEqual(["users", "empty_table"]);
    expect(tables.get("users")!.columns).toEqual(["id", "openId", "name"]);
  });

  it("counts rows even when values contain quotes, brackets, commas and semicolons", () => {
    expect(tables.get("users")!.expectedRows).toBe(2);
    expect(tables.get("empty_table")!.expectedRows).toBe(0);
    expect(countInsertRows("INSERT INTO `t` VALUES (1,'a\\'),(2'),(3,NULL);")).toBe(2);
  });

  it("adds the dump's column list so extra target columns do not shift values", () => {
    const insert = tables.get("users")!.inserts[0];
    expect(withColumnList(insert, ["id", "openId", "name"]).startsWith("INSERT INTO `users` (`id`,`openId`,`name`) VALUES (1,")).toBe(true);
    expect(withColumnList("SET x=1;", ["a"])).toBe("SET x=1;");
  });
});

describe("migration SQL", () => {
  it("rewrites the JSON defaults TiDB rejects", () => {
    expect(rewriteJsonDefaults("`a` json DEFAULT ('[]'), `b` json DEFAULT ('{}'), `c` text DEFAULT ('x')")).toBe(
      "`a` json DEFAULT (JSON_ARRAY()), `b` json DEFAULT (JSON_OBJECT()), `c` text DEFAULT ('x')",
    );
  });

  it("splits on statement-breakpoint and drops empty or comment-only parts", () => {
    const sql = "-- header\nCREATE TABLE a (id int);\n--> statement-breakpoint\nALTER TABLE a ADD b int;\n--> statement-breakpoint\n-- trailing comment\n";
    expect(splitMigration(sql)).toEqual(["-- header\nCREATE TABLE a (id int);", "ALTER TABLE a ADD b int;"]);
  });
});

describe("manifest and buckets", () => {
  it("parses the quoted CSV", () => {
    const rows = parseManifest('table,column,row_id,key\n"profile_photos","url","30001","profile-photos/1/a.jpeg"\n');
    expect(rows).toEqual([{ table: "profile_photos", column: "url", rowId: "30001", key: "profile-photos/1/a.jpeg" }]);
  });

  it("keeps member content private and other files public", () => {
    expect(visibilityFor("profile_photos", "url", "profile-photos/1/a.jpeg")).toBe("private");
    expect(visibilityFor("voice_messages", "s3_url", "x/y.webm")).toBe("private");
    expect(visibilityFor("anything", "col", "voice/9/a.webm")).toBe("private");
    expect(visibilityFor("community_events", "imageUrl", "events/a.png")).toBe("public");
  });

  it("finds source files in the files dir first, then in the Manus archive", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "upl-"));
    fs.mkdirSync(path.join(dir, "files", "profile-photos", "1"), { recursive: true });
    fs.writeFileSync(path.join(dir, "files", "profile-photos", "1", "a.jpeg"), "x");
    fs.mkdirSync(path.join(dir, "archive", "profile-photos"), { recursive: true });
    fs.writeFileSync(path.join(dir, "archive", "profile-photos", "2_b.jpeg"), "y");
    fs.writeFileSync(
      path.join(dir, "archive", "STORAGE-MANIFEST.tsv"),
      "header\ntype\tid\tstorage_path\tarchive_file\tsize\tsha\nprofile_photo\t2\t/manus-storage/profile-photos/2/b.jpeg\tprofile-photos/2_b.jpeg\t1\tx\n",
    );
    const csv = [
      "table,column,row_id,key",
      '"profile_photos","url","1","profile-photos/1/a.jpeg"',
      '"profile_photos","url","2","profile-photos/2/b.jpeg"',
      '"profile_photos","url","3","profile-photos/3/missing.jpeg"',
      '"profile_photos","url","1","profile-photos/1/a.jpeg"',
    ].join("\n");
    const plan = planUploads(csv, path.join(dir, "files"), path.join(dir, "archive"));
    expect(plan.map(p => [p.key, p.visibility, p.source !== null])).toEqual([
      ["profile-photos/1/a.jpeg", "private", true],
      ["profile-photos/2/b.jpeg", "private", true],
      ["profile-photos/3/missing.jpeg", "private", false],
    ]);
  });
});

describe("user import plan", () => {
  const bcrypt = "$2a$10$" + "a".repeat(53);
  const user = (over: Partial<UserRow>): UserRow => ({ id: 1, openId: "legacy-1", legacyOpenId: null, email: "a@example.com", passwordHash: null, ...over });

  it("recognises bcrypt hashes only", () => {
    expect(isBcryptHash(bcrypt)).toBe(true);
    expect(isBcryptHash("plaintext")).toBe(false);
    expect(isBcryptHash("$argon2id$v=19$x")).toBe(false);
  });

  it("splits members into password / email-only / skipped groups by id", () => {
    const plan = planUsers([
      user({ id: 1, passwordHash: bcrypt }),
      user({ id: 2, email: "b@example.com" }),
      user({ id: 3, email: null }),
      user({ id: 4, email: "  " }),
      user({ id: 5, email: "B@Example.com" }),
      user({ id: 6, email: "f@example.com", passwordHash: "not-bcrypt" }),
      user({ id: 7, openId: "11111111-1111-1111-1111-111111111111", legacyOpenId: "legacy-7", email: "g@example.com" }),
    ]);
    expect(plan.withHash.map(u => u.id)).toEqual([1]);
    expect(plan.withoutHash.map(u => u.id)).toEqual([2, 6]);
    expect(plan.skippedNoEmail).toEqual([3, 4]);
    expect(plan.skippedDuplicateEmail).toEqual([5]);
    expect(plan.unusableHash).toEqual([6]);
    expect(plan.alreadyImported).toEqual([7]);
  });
});

describe("url rewrite prefixes", () => {
  const buckets = { public: "site-public", private: "member-private" };
  it("bare form removes the prefix", () => {
    expect(replacementPrefix("bare", "private", "https://x.supabase.co", buckets)).toBe("");
  });
  it("supabase form points at the right bucket and visibility", () => {
    expect(replacementPrefix("supabase", "public", "https://x.supabase.co/", buckets)).toBe("https://x.supabase.co/storage/v1/object/public/site-public/");
    expect(replacementPrefix("supabase", "private", "https://x.supabase.co", buckets)).toBe("https://x.supabase.co/storage/v1/object/member-private/");
  });
});

describe("log redaction", () => {
  it("scrubs connection strings, keys and password hashes", () => {
    const out = redact(`failed mysql://user:pw@host:4000/db and sb_secret_abc123 and ${"$2a$10$" + "b".repeat(53)} at https://x.supabase.co/y`);
    expect(out).not.toMatch(/user:pw|sb_secret_abc123|\$2a\$10|supabase\.co/);
  });
});

const BACKSLASH = String.fromCharCode(92);

describe("INSERT row parser and manifest from the export", () => {
  it("reads cells including quotes, escapes, commas, NULL and numbers", () => {
    const statement = "INSERT INTO `t` VALUES (1,'a, (b)','it''s',NULL,-2.5),(2,'x" + BACKSLASH + "'y','line" + BACKSLASH + "nbreak',NULL,3);";
    const rows = parseInsertRows(statement);
    expect(rows).toEqual([
      ["1", "a, (b)", "it's", "NULL", "-2.5"],
      ["2", "x'y", "line\nbreak", "NULL", "3"],
    ]);
  });

  it("finds /manus-storage/ keys with their table, column and row id", () => {
    const dump = [
      "CREATE TABLE `profile_photos` (",
      "  `id` int NOT NULL,",
      "  `userId` int NOT NULL,",
      "  `url` varchar(1024) NOT NULL,",
      "  PRIMARY KEY (`id`)",
      ");",
      "INSERT INTO `profile_photos` VALUES (30001,5,'/manus-storage/profile-photos/5/a.jpeg'),(30002,6,'https://elsewhere.example/b.jpg');",
      "CREATE TABLE `posts` (",
      "  `id` int NOT NULL,",
      "  `body` text,",
      ");",
      "INSERT INTO `posts` VALUES (7,'see </manus-storage/profile-photos/9/c.png> and \"/manus-storage/voice/1/d.webm\"');",
    ].join("\n");
    expect(manifestFromDump(parseDump(dump))).toEqual([
      { table: "profile_photos", column: "url", rowId: "30001", key: "profile-photos/5/a.jpeg" },
      { table: "posts", column: "body", rowId: "7", key: "profile-photos/9/c.png" },
      { table: "posts", column: "body", rowId: "7", key: "voice/1/d.webm" },
    ]);
  });
});
