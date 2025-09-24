import { Router } from "express";
import { pool } from "./db.js";
import { DateTime } from "luxon";
const router = Router();
/** PST suspicious rules */
function computeSuspicious(action, nowUtcISO) {
    const nowPst = DateTime.fromISO(nowUtcISO ?? DateTime.utc().toISO(), { zone: "utc" })
        .setZone("America/Los_Angeles");
    const isWeekend = nowPst.weekday === 6 || nowPst.weekday === 7; // Sat=6, Sun=7
    const hour = nowPst.hour;
    if (isWeekend)
        return true;
    if (action === "out" && hour >= 18)
        return true;
    if (action === "in" && hour < 8)
        return true;
    return false;
}
// POST /api/time/punch  { employee: string, action: "in"|"out", note?: string }
router.post("/punch", async (req, res) => {
    try {
        const { employee, action, note } = req.body || {};
        if (!employee || typeof employee !== "string")
            return res.status(400).json({ ok: false, error: "employee required" });
        if (action !== "in" && action !== "out")
            return res.status(400).json({ ok: false, error: "action must be 'in' or 'out'" });
        const suspicious = computeSuspicious(action);
        const { rows } = await pool.query(`INSERT INTO timeclock_entries (employee_name, action, note, suspicious)
       VALUES ($1,$2,$3,$4)
       RETURNING id, employee_name, action, note, suspicious, created_at`, [employee.trim(), action, note ?? null, suspicious]);
        res.json({ ok: true, entry: rows[0] });
    }
    catch (e) {
        console.error("POST /time/punch", e);
        res.status(500).json({ ok: false, error: "internal_error" });
    }
});
// GET /api/time/entries?employee=NAME&limit=10
router.get("/entries", async (req, res) => {
    try {
        const employee = String(req.query.employee || "").trim();
        const limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit || "10"), 10)));
        if (!employee)
            return res.status(400).json({ ok: false, error: "employee required" });
        const { rows } = await pool.query(`SELECT id, employee_name, action, note, suspicious, created_at
       FROM timeclock_entries
       WHERE employee_name = $1
       ORDER BY created_at DESC
       LIMIT $2`, [employee, limit]);
        res.json({ ok: true, total: rows.length, limit, offset: 0, data: rows });
    }
    catch (e) {
        console.error("GET /time/entries", e);
        res.status(500).json({ ok: false, error: "internal_error" });
    }
});
// GET /api/time/status?employee=NAME
router.get("/status", async (req, res) => {
    try {
        const employee = String(req.query.employee || "").trim();
        if (!employee)
            return res.status(400).json({ ok: false, error: "employee required" });
        const { rows } = await pool.query(`SELECT action, created_at
       FROM timeclock_entries
       WHERE employee_name = $1
       ORDER BY created_at DESC
       LIMIT 1`, [employee]);
        const last = rows[0];
        const clocked_in = last ? last.action === "in" : false;
        res.json({ ok: true, clocked_in, last_punch_at: last?.created_at ?? null });
    }
    catch (e) {
        console.error("GET /time/status", e);
        res.status(500).json({ ok: false, error: "internal_error" });
    }
});
export default router;
