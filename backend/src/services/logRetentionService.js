import { db } from '../config/db.js';

const LOG_RETENTION_RULES = {
    critical: "INTERVAL '1 year'",
    error: "INTERVAL '6 months'",
    alert: "INTERVAL '3 months'",
    info: "INTERVAL '1 month'",
};

let retentionTimer = null;
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

export function startLogRetentionScheduler() {
    if (retentionTimer) {
        return;
    }

    const scheduleCleanup = async () => {
        try {
            const result = await runLogRetentionCleanup();
            if (!result.skipped) {
                console.log(
                    `[Logs] Limpeza de retenção concluída: ${result.deleted} removidos.`
                );
            }
        } catch (error) {
            console.error(
                '[Logs] Falha na limpeza de retenção:',
                error.message
            );
        }
    };

    void scheduleCleanup();

    retentionTimer = setInterval(scheduleCleanup, 24 * 60 * 60 * 1000);
    retentionTimer.unref?.();
}
