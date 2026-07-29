import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.join(__dirname, "..", "database", "seed.sql");
const seedMsgPath = path.join(__dirname, "..", "database", "seed_messages.sql");
const seed = await fs.readFile(seedPath, "utf8");
const seedMsg = await fs.readFile(seedMsgPath, "utf8");

await pool.query(seed);
await pool.query(seedMsg);
await pool.end();

console.log("演示数据写入完成");

