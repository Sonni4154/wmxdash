import { Router } from "express";
import { Pool } from "pg";
import { DateTime } from "luxon";

const router = Router();

// Reuse your existing pool if you export it from db.ts; otherwise make one here.
// Here we make a pool that reads DATABASE_URL from env (same as the rest of the API).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

/**
 * Suspicious rules (PST):
 *  - OUT after 6pm
 *  - IN before 8am
 *  - Any weekend clock (Sat/Sun)
 * NOTE: users never see this flag; it's for admin review.
 */
function computeSuspicious(action: "in" | "out", nowUtcISO?: string) {
  const nowPst = DateTime.fromISO(nowUtcISO ?? DateTime.utc().toISO(), { zone: "utc" }).setZone("America/Los_Angeles");
  const isWeekend = nowPst.weekday === 6 || nowPst.weekday === 7; // Sat=6, Sun=7
  const hour = nowPst.hour;

  if (isWeekend) return true;
  if (action === "out" && hour >= 18) return true;      // after 6pm
  if (action === "in" && hour < 8) return true;          // before 8am
  return false;
}

// POST /api/time/punch { employee: string, action: "in" | "out", note?: string }
router.post("/punch", async (req, res) => {
  try {
    const { employee, action, note } = req.body || {};
    if (!employee || typeof employee !== "string") return res.status(400).json({ ok: false, error: "employee required" });
    if (action !== "in" && action !== "out") return res.status(400).json({ ok: false, error: "action must be 'in' or 'out'" });

    const suspicious = computeSuspicious(action);
    const { rows } = await pool.query(
      `
        INSERT INTO timeclock_entries (employee_name, action, note, suspicious)
        VALUES ($1, $2, $3, $4)
        RETURNING id, employee_name, action, note, suspicious, created_at
      `,
      [employee.trim(), action, note ?? null, suspicious]
    );
    return res.json({ ok: true, entry: rows[0] });
  } catch (err: any) {
    console.error("punch error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/time/entries?employee=NAME&limit=10
router.get("/entries", async (req, res) => {
  try {
    const employee = String(req.query.employee || "").trim();
    const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "10"), 10)));
    if (!employee) return res.status(400).json({ ok: false, error: "employee required" });

    const { rows, rowCount } = await pool.query(
      `
        SELECT id, employee_name, action, note, suspicious, created_at
        FROM timeclock_entries
        WHERE employee_name = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [employee, limit]
    );
    // Do not expose suspicious in UI (you can still return it; the client won't display it).
    return res.json({ ok: true, total: rowCount, limit, offset: 0, data: rows });
  } catch (err: any) {
    console.error("entries error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

// GET /api/time/status?employee=NAME
// Returns whether the employee is currently clocked in (based on last punch)
router.get("/status", async (req, res) => {
  try {
    const employee = String(req.query.employee || "").trim();
    if (!employee) return res.status(400).json({ ok: false, error: "employee required" });

    const { rows } = await pool.query(
      `
        SELECT action, created_at
        FROM timeclock_entries
        WHERE employee_name = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [employee]
    );

    const last = rows[0];
    const clocked_in = last ? last.action === "in" : false;
    return res.json({ ok: true, clocked_in, last_punch_at: last?.created_at || null });
  } catch (err: any) {
    console.error("status error", err);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
});

export default router;

