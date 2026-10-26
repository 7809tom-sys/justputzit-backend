import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import mysql from 'mysql2';

const outIndex = process.argv.indexOf('--out');
const outputDirectory = outIndex >= 0 ? process.argv[outIndex + 1] : undefined;

if (!outputDirectory) {
  throw new Error('Usage: node scripts/exportDatabaseToCsv.mjs --out <absolute-output-directory>');
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to export database tables.');
}

const safeTableName = (tableName) => {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) {
    throw new Error(`Refusing to export unexpected table name: ${tableName}`);
  }
  return tableName;
};

const toCsvCell = (value) => {
  if (value === null || value === undefined) return '""';

  let text;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (Buffer.isBuffer(value)) {
    text = value.toString('base64');
  } else if (typeof value === 'bigint') {
    text = value.toString();
  } else if (typeof value === 'object') {
    text = JSON.stringify(value);
  } else {
    text = String(value);
  }

  return `"${text.replaceAll('"', '""')}"`;
};

const writeChunk = (stream, chunk) => new Promise((resolveWrite, rejectWrite) => {
  if (stream.write(chunk)) {
    resolveWrite();
    return;
  }
  stream.once('drain', resolveWrite);
  stream.once('error', rejectWrite);
});

const closeStream = (stream) => new Promise((resolveClose, rejectClose) => {
  stream.once('error', rejectClose);
  stream.end(resolveClose);
});

const outputPath = resolve(outputDirectory);
await mkdir(outputPath, { recursive: true });

const connection = mysql.createConnection(process.env.DATABASE_URL);
await new Promise((resolveConnection, rejectConnection) => {
  connection.connect((error) => (error ? rejectConnection(error) : resolveConnection()));
});

try {
  const query = connection.promise();
  const [tableRows] = await query.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE' ORDER BY table_name",
  );

  const manifest = {
    exportedAtUtc: new Date().toISOString(),
    format: 'csv',
    tableCount: tableRows.length,
    tables: [],
  };

  for (const { table_name: rawTableName } of tableRows) {
    const tableName = safeTableName(rawTableName);
    const fileName = `${tableName}.csv`;
    const filePath = join(outputPath, fileName);
    const [columnRows] = await query.query(`SHOW COLUMNS FROM \`${tableName}\``);
    const columns = columnRows.map((column) => column.Field);
    const output = createWriteStream(filePath, { encoding: 'utf8' });
    const checksum = createHash('sha256');
    let rowCount = 0;
    let byteCount = 0;

    const writeCsv = async (line) => {
      checksum.update(line);
      byteCount += Buffer.byteLength(line);
      await writeChunk(output, line);
    };

    await writeCsv(`${columns.map(toCsvCell).join(',')}\n`);

    const rowStream = connection.query(`SELECT * FROM \`${tableName}\``).stream({ highWaterMark: 50 });
    for await (const row of rowStream) {
      await writeCsv(`${columns.map((column) => toCsvCell(row[column])).join(',')}\n`);
      rowCount += 1;
    }

    await closeStream(output);
    manifest.tables.push({
      table: tableName,
      file: fileName,
      rows: rowCount,
      bytes: byteCount,
      sha256: checksum.digest('hex'),
    });
    console.log(`Exported ${tableName}: ${rowCount} rows`);
  }

  await writeFile(join(outputPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await writeFile(
    join(outputPath, 'README.txt'),
    [
      'Just Putz It database CSV export',
      `Exported at UTC: ${manifest.exportedAtUtc}`,
      `Tables exported: ${manifest.tableCount}`,
      'Each CSV includes a header row. Binary values are base64 encoded; structured values are JSON encoded; all CSV fields are quoted.',
      'manifest.json provides the row count, size, and SHA-256 checksum for each CSV file.',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Complete CSV export written to ${outputPath}`);
} finally {
  connection.end();
}
