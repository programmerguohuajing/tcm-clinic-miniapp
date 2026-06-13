import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { pool } from "../src/config/db.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
const commentsPath = path.join(__dirname, "..", "database", "comments.sql");
const schema = await fs.readFile(schemaPath, "utf8");
const comments = await fs.readFile(commentsPath, "utf8");

await pool.query(schema);
await pool.query(comments);
await pool.end();

console.log("数据库结构与备注初始化完成");
