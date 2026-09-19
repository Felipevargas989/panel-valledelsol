// Aplica db/esquema.sql a la base. Se corre una vez (y se puede repetir).
// Lee DATABASE_URL de .env.local sin mostrarla.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";

const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const url = process.env.DATABASE_URL ?? env.match(/^(?:DATABASE_URL|POSTGRES_URL)=(.*)$/m)?.[1]?.trim().replace(/^"|"$/g, "");
if (!url) { console.error("Falta DATABASE_URL en .env.local"); process.exit(1); }

const sql = neon(url);
const esquema = fs.readFileSync("db/esquema.sql", "utf8");
// Neon acepta una sentencia por llamada: se parte por punto y coma.
const sentencias = esquema.split(/;\s*\n/).map((s) => s.replace(/--[^\n]*/g, "").trim()).filter(Boolean);
for (const s of sentencias) await sql.query(s);
const tablas = await sql.query(`select table_name from information_schema.tables where table_schema = 'panel' order by 1`);
console.log("Tablas en el esquema panel:", tablas.map((t) => t.table_name).join(", "));
