import express from 'express';
// --- Config (env) -----------------------------------------------------------
const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:3000';
const QBO_CRON_SECRET = process.env.QBO_CRON_SECRET ?? '';
const PORT = Number(process.env.REFRESHER_PORT ?? 8090);
const INTERVAL_MS = Number(process.env.REFRESH_INTERVAL_MS ?? 45 * 60 * 1000); // 45m default
// --- In-memory metrics/state ------------------------------------------------
const metrics = {
    booted_at: Date.now(),
    ticks: 0,
    last_run_at: 0,
    last_ok_at: 0,
    last_error_at: 0,
    success_count: 0,
    error_count: 0,
    last_status: 'idle',
    last_code: 0,
    last_duration_ms: 0,
    last_message: '',
};
// --- Core refresh function --------------------------------------------------
async function refreshNow(source = 'interval') {
    const started = Date.now();
    metrics.last_run_at = started;
    metrics.last_status = 'running';
    try {
        const res = await fetch(`${API_BASE}/api/qbo/refresh`, {
            method: 'POST',
            headers: {
                'X-Cron-Secret': QBO_CRON_SECRET,
            },
        });
        metrics.last_code = res.status;
        const text = await res.text();
        metrics.last_message = text;
        metrics.last_duration_ms = Date.now() - started;
        if (res.ok) {
            metrics.success_count += 1;
            metrics.last_ok_at = Date.now();
            metrics.last_status = 'ok';
        }
        else {
            metrics.error_count += 1;
            metrics.last_error_at = Date.now();
            metrics.last_status = 'error';
        }
    }
    catch (err) {
        metrics.error_count += 1;
        metrics.last_error_at = Date.now();
        metrics.last_status = 'error';
        metrics.last_message = String(err?.message ?? err);
        metrics.last_duration_ms = Date.now() - started;
    }
}
// --- HTTP server ------------------------------------------------------------
const app = express();
app.get('/healthz', (_req, res) => {
    // "ok" if we had a success in the last ~62 minutes
    const okRecently = metrics.last_ok_at > 0 && (Date.now() - metrics.last_ok_at) < (62 * 60 * 1000);
    res.json({
        ok: okRecently,
        live: true,
        api_base: API_BASE,
        last_ok_at: metrics.last_ok_at,
        last_error_at: metrics.last_error_at,
    });
});
app.get('/metrics', (_req, res) => {
    res.json(metrics);
});
app.post('/run', async (_req, res) => {
    await refreshNow('manual');
    res.json({ ok: metrics.last_status === 'ok', ...metrics });
});
// Try to bind; if port in use, log and exit (so PM2 can restart on a new port if you change env)
app
    .listen(PORT, () => {
    console.log(`[refresher] listening on :${PORT} (API_BASE=${API_BASE}, every ${INTERVAL_MS}ms)`);
})
    .on('error', (e) => {
    if (e?.code === 'EADDRINUSE') {
        console.error(`[refresher] port ${PORT} in use, exiting`);
        process.exit(1);
    }
    throw e;
});
// --- Scheduler --------------------------------------------------------------
const jitter = Math.round(Math.random() * 8000) + 2000; // 2–10s
setTimeout(() => {
    refreshNow('startup').catch(() => { });
    setInterval(() => {
        metrics.ticks += 1;
        refreshNow('interval').catch(() => { });
    }, INTERVAL_MS);
}, jitter);
