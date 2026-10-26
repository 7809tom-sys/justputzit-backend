import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

const campuses = [
  { name: "Carroll University", shortName: "Carroll", city: "Waukesha", state: "WI", emailDomains: "carrollu.edu,pio.carrollu.edu", colorHex: "#c8102e", mascot: "Pioneers", launchThreshold: 50 },
  { name: "UW-Waukesha", shortName: "UWW", city: "Waukesha", state: "WI", emailDomains: "uwc.edu", colorHex: "#c5050c", mascot: "Wildcats", launchThreshold: 50 },
  { name: "Marquette University", shortName: "Marquette", city: "Milwaukee", state: "WI", emailDomains: "marquette.edu,mu.edu", colorHex: "#003366", mascot: "Golden Eagles", launchThreshold: 100 },
  { name: "University of Wisconsin-Milwaukee", shortName: "UWM", city: "Milwaukee", state: "WI", emailDomains: "uwm.edu", colorHex: "#ffc72c", mascot: "Panthers", launchThreshold: 100 },
  { name: "Milwaukee School of Engineering", shortName: "MSOE", city: "Milwaukee", state: "WI", emailDomains: "msoe.edu", colorHex: "#e31837", mascot: "Raiders", launchThreshold: 50 },
  { name: "Wisconsin Lutheran College", shortName: "WLC", city: "Milwaukee", state: "WI", emailDomains: "wlc.edu", colorHex: "#003087", mascot: "Warriors", launchThreshold: 30 },
  { name: "Concordia University Wisconsin", shortName: "Concordia", city: "Mequon", state: "WI", emailDomains: "cuw.edu", colorHex: "#00205b", mascot: "Falcons", launchThreshold: 50 },
  { name: "University of Wisconsin-Whitewater", shortName: "UW-Whitewater", city: "Whitewater", state: "WI", emailDomains: "uww.edu", colorHex: "#4b0082", mascot: "Warhawks", launchThreshold: 100 },
  { name: "Waukesha County Technical College", shortName: "WCTC", city: "Pewaukee", state: "WI", emailDomains: "wctc.edu", colorHex: "#0066cc", mascot: "Wolverines", launchThreshold: 30 },
];

for (const c of campuses) {
  const [existing] = await conn.execute("SELECT id FROM campuses WHERE name = ?", [c.name]);
  if (existing.length > 0) {
    console.log(`Skipping existing: ${c.name}`);
    continue;
  }
  await conn.execute(
    `INSERT INTO campuses (name, shortName, city, state, emailDomains, colorHex, mascot, launchThreshold, isLive, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
    [c.name, c.shortName, c.city, c.state, c.emailDomains, c.colorHex, c.mascot, c.launchThreshold]
  );
  console.log(`Inserted: ${c.name}`);
}

await conn.end();
console.log("Done seeding campuses.");
