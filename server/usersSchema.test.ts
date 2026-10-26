import { getTableConfig } from "drizzle-orm/mysql-core";
import { describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";

describe("users table schema", () => {
  it("does not declare columns that only a pending migration adds", () => {
    // Drizzle selects every declared column. A column that the live database might not have yet turns every
    // sign-in into ER_BAD_FIELD_ERROR. users.legacyOpenId (drizzle/0063) is used only by migration scripts via raw SQL.
    const columns = getTableConfig(users).columns.map(column => column.name);
    expect(columns).not.toContain("legacyOpenId");
    expect(columns).toEqual(expect.arrayContaining(["id", "openId", "email", "role", "passwordHash"]));
  });
});
