import { db } from '../config/db.js';

const LOG_RETENTION_RULES = {
    critical: "INTERVAL '1 year'",
    error: "INTERVAL '6 months'",
    alert: "INTERVAL '3 months'",
    info: "INTERVAL '1 month'",
};

let cleanupRunning = false;

function buildRetentionDeleteQuery() {
    const levelClauses = Object.entries(LOG_RETENTION_RULES)
        .map(([level, interval]) => {
            return `(LOWER(COALESCE(NULLIF(TRIM(nivel), ''), 'info')) = '${level}' AND created_at < NOW() - ${interval})`;
        })
        .join('\n        OR ');

    return `
      DELETE FROM public.logs
      WHERE ${levelClauses}
      RETURNING id_log, nivel, created_at
    `;
}

export async function runLogRetentionCleanup() {
    if (cleanupRunning) {
        return { deleted: 0, skipped: true };
    }

    cleanupRunning = true;

    try {
        const { rows } = await db.query(buildRetentionDeleteQuery());
        return { deleted: rows.length, skipped: false };
    } finally {
        cleanupRunning = false;
    }
}
