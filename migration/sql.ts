// Pure helpers (no I/O) for the staging rehearsal scripts, so they can be unit tested.

/** TiDB rejects `DEFAULT ('[]')` / `DEFAULT ('{}')` on JSON columns; the function forms are equivalent. */
export function rewriteJsonDefaults(sql: string): string {
  return sql.split("DEFAULT ('[]')").join("DEFAULT (JSON_ARRAY())").split("DEFAULT ('{}')").join("DEFAULT (JSON_OBJECT())");
}

/** Splits a drizzle migration into statements (`--> statement-breakpoint`), dropping empty ones. */
export function splitMigration(sql: string): string[] {
  return sql
    .split(/-->\s*statement-breakpoint/)
    .map(part => part.trim())
    .filter(part => part.length > 0 && !/^(--[^\n]*\n?)+$/.test(part));
}

export type DumpTable = {
  name: string;
  /** CREATE TABLE statement exactly as dumped (TiDB-produced). */
  ddl: string;
  /** Column names in dump order. */
  columns: string[];
  /** INSERT statements, one per line in a mysqldump. */
  inserts: string[];
  /** Rows counted from the INSERT statements. */
  expectedRows: number;
};

/** Counts the top-level `(...)` tuples of an `INSERT ... VALUES (...),(...);` statement. */
export function countInsertRows(statement: string): number {
  const start = statement.indexOf(" VALUES ");
  if (start === -1) return 0;
  const s = statement.slice(start + 8);
  let depth = 0;
  let inString = false;
  let rows = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === "'") {
        if (s[i + 1] === "'") i++;
        else inString = false;
      }
    } else if (ch === "'") inString = true;
    else if (ch === "(") {
      if (depth === 0) rows++;
      depth++;
    } else if (ch === ")") depth--;
  }
  return rows;
}

function parseColumns(ddl: string): string[] {
  const columns: string[] = [];
  for (const line of ddl.split("\n").slice(1)) {
    const match = /^\s+`([^`]+)`\s+\S/.exec(line);
    if (match) columns.push(match[1]);
  }
  return columns;
}

/** Reads a mysqldump file into per-table DDL, column lists and INSERT statements. */
export function parseDump(text: string): Map<string, DumpTable> {
  const tables = new Map<string, DumpTable>();
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const create = /^CREATE TABLE `([^`]+)` \(/.exec(lines[i]);
    if (!create) continue;
    const block: string[] = [];
    let j = i;
    for (; j < lines.length; j++) {
      block.push(lines[j]);
      if (/;\s*$/.test(lines[j])) break;
    }
    const ddl = block.join("\n");
    tables.set(create[1], { name: create[1], ddl, columns: parseColumns(ddl), inserts: [], expectedRows: 0 });
    i = j;
  }

  for (const line of lines) {
    const insert = /^INSERT INTO `([^`]+)` VALUES /.exec(line);
    if (!insert) continue;
    const table = tables.get(insert[1]);
    if (!table) continue;
    table.inserts.push(line);
    table.expectedRows += countInsertRows(line);
  }
  return tables;
}

/**
 * mysqldump writes `INSERT INTO t VALUES (...)` with no column list, so values are positional.
 * Adding the dump's own column list keeps the load correct when the target has extra columns.
 */
export function withColumnList(insert: string, columns: string[]): string {
  const prefix = /^INSERT INTO `([^`]+)` VALUES /.exec(insert);
  if (!prefix) return insert;
  const list = columns.map(c => `\`${c}\``).join(",");
  return `INSERT INTO \`${prefix[1]}\` (${list}) VALUES ${insert.slice(prefix[0].length)}`;
}

/** Decodes the common MySQL string escapes (enough for URL matching; not a full unescape). */
function unescapeSql(value: string): string {
  const map: Record<string, string> = { n: "\n", r: "\r", t: "\t", "0": "\0", Z: "\x1a" };
  return value.replace(/\\(.)/g, (_match, c: string) => map[c] ?? c);
}

/**
 * Splits an `INSERT INTO t VALUES (...),(...);` statement into rows of raw cell text.
 * Strings are returned unquoted and unescaped; NULL, numbers and hex literals come back as written.
 */
export function parseInsertRows(statement: string): string[][] {
  const start = statement.indexOf(" VALUES ");
  if (start === -1) return [];
  const s = statement.slice(start + 8);
  const rows: string[][] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && s[i] !== "(") i++;
    if (i >= s.length) break;
    i++; // past "("
    const cells: string[] = [];
    while (i < s.length) {
      while (s[i] === " ") i++;
      if (s[i] === "'") {
        let raw = "";
        i++;
        while (i < s.length) {
          if (s[i] === "\\") {
            raw += s[i] + (s[i + 1] ?? "");
            i += 2;
          } else if (s[i] === "'") {
            if (s[i + 1] === "'") {
              raw += "''";
              i += 2;
            } else break;
          } else raw += s[i++];
        }
        i++; // closing quote
        cells.push(unescapeSql(raw.replace(/''/g, "'")));
      } else {
        let token = "";
        // "_binary '...'" style prefixes are kept as the prefix only; none of our columns use them.
        while (i < s.length && s[i] !== "," && s[i] !== ")") token += s[i++];
        cells.push(token.trim());
      }
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === ")") {
        i++;
        break;
      }
    }
    rows.push(cells);
  }
  return rows;
}

// ── manifest / buckets ───────────────────────────────────────────────────────

export type ManifestRow = { table: string; column: string; rowId: string; key: string };

export function parseManifest(csv: string): ManifestRow[] {
  const rows: ManifestRow[] = [];
  const lines = csv.split(/\r?\n/).filter(line => line.trim().length > 0);
  for (const line of lines.slice(1)) {
    const cells = [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)/g)].map(m => (m[1] ?? m[2] ?? "").replace(/""/g, '"'));
    if (cells.length < 4) continue;
    rows.push({ table: cells[0], column: cells[1], rowId: cells[2], key: cells[3] });
  }
  return rows;
}

const PRIVATE_COLUMNS = new Set(["profile_photos.url", "profile_photos.s3Key", "voice_messages.s3_url", "voice_messages.s3_key"]);
const PRIVATE_PREFIXES = ["profile-photos/", "voice/"];

/** Member content is private; everything else is public. Column mapping first, key prefix as a fallback. */
export function visibilityFor(table: string, column: string, key: string): "public" | "private" {
  if (PRIVATE_COLUMNS.has(`${table}.${column}`)) return "private";
  return PRIVATE_PREFIXES.some(prefix => key.startsWith(prefix)) ? "private" : "public";
}

// ── users ────────────────────────────────────────────────────────────────────

export type UserRow = {
  id: number;
  openId: string;
  legacyOpenId: string | null;
  email: string | null;
  passwordHash: string | null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isSupabaseId = (value: string) => UUID_RE.test(value);
export const isBcryptHash = (value: string) => /^\$2[abxy]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);

export type UserPlan = {
  /** To create: has an email; `withHash` ones keep their bcrypt password. */
  withHash: UserRow[];
  withoutHash: UserRow[];
  skippedNoEmail: number[];
  skippedDuplicateEmail: number[];
  alreadyImported: number[];
  /** Users that have a password hash which is not bcrypt (imported without a password). */
  unusableHash: number[];
};

export function planUsers(users: UserRow[]): UserPlan {
  const plan: UserPlan = {
    withHash: [],
    withoutHash: [],
    skippedNoEmail: [],
    skippedDuplicateEmail: [],
    alreadyImported: [],
    unusableHash: [],
  };
  const seen = new Set<string>();
  for (const user of users) {
    if (isSupabaseId(user.openId) && user.legacyOpenId) {
      plan.alreadyImported.push(user.id);
      continue;
    }
    const email = user.email?.trim().toLowerCase();
    if (!email) {
      plan.skippedNoEmail.push(user.id);
      continue;
    }
    if (seen.has(email)) {
      plan.skippedDuplicateEmail.push(user.id);
      continue;
    }
    seen.add(email);
    if (user.passwordHash && isBcryptHash(user.passwordHash)) plan.withHash.push(user);
    else {
      if (user.passwordHash) plan.unusableHash.push(user.id);
      plan.withoutHash.push(user);
    }
  }
  return plan;
}

// ── url rewrite ──────────────────────────────────────────────────────────────

export type UrlForm = "bare" | "supabase";

/** Replacement for the `/manus-storage/` prefix, applied with SQL REPLACE() on a whole column. */
export function replacementPrefix(form: UrlForm, visibility: "public" | "private", supabaseUrl: string, buckets: { public: string; private: string }): string {
  if (form === "bare") return "";
  const base = `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object`;
  return visibility === "public" ? `${base}/public/${buckets.public}/` : `${base}/${buckets.private}/`;
}

const STORAGE_KEY_RE = /\/manus-storage\/[^\s"'\\)<>]+/g;

/** Every '/manus-storage/<key>' value in the export, with its table, column and row id. */
export function manifestFromDump(tables: Map<string, DumpTable>): ManifestRow[] {
  const rows: ManifestRow[] = [];
  for (const table of tables.values()) {
    if (table.name === "__drizzle_migrations") continue;
    const idIndex = table.columns.indexOf("id");
    for (const insert of table.inserts) {
      if (!insert.includes("/manus-storage/")) continue;
      parseInsertRows(insert).forEach((cells, rowNumber) => {
        cells.forEach((cell, index) => {
          if (!cell.includes("/manus-storage/")) return;
          for (const match of cell.matchAll(STORAGE_KEY_RE)) {
            rows.push({ table: table.name, column: table.columns[index] ?? `#${index}`, rowId: idIndex >= 0 ? cells[idIndex] : String(rowNumber), key: match[0].slice("/manus-storage/".length) });
          }
        });
      });
    }
  }
  return rows;
}
