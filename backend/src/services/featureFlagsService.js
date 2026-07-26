import { db } from '../config/db.js';

export const DEFAULT_FEATURE_FLAGS = {
    reinscricao_ativa: {
        label: 'Aba de Reinscrição (alunos)',
        descricao:
            'Mostra ou esconde o item "Reinscrição" no menu dos alunos.',
        ativo: true,
    },
};

async function ensureDefaultFeatureFlags() {
    const query = `
        INSERT INTO feature_flags (flag_key, ativo)
        VALUES ($1, $2)
        ON CONFLICT (flag_key) DO NOTHING
    `;

    for (const [key, defaults] of Object.entries(DEFAULT_FEATURE_FLAGS)) {
        await db.query(query, [key, defaults.ativo]);
    }
}

function rowToFlag(row) {
    const defaults = DEFAULT_FEATURE_FLAGS[row.flag_key] || {};
    return {
        key: row.flag_key,
        label: defaults.label || row.flag_key,
        descricao: defaults.descricao || '',
        ativo: row.ativo,
        updatedAt: row.updated_at,
    };
}

export async function listFeatureFlags() {
    await ensureDefaultFeatureFlags();

    const { rows } = await db.query(`
        SELECT *
        FROM feature_flags
        ORDER BY flag_key ASC
    `);

    return rows.map(rowToFlag);
}

export async function getFeatureFlagsMap() {
    try {
        const flags = await listFeatureFlags();
        return Object.fromEntries(flags.map((item) => [item.key, item.ativo]));
    } catch (error) {
        console.warn(
            '[featureFlagsService] A usar valores default:',
            error.message
        );
        return Object.fromEntries(
            Object.entries(DEFAULT_FEATURE_FLAGS).map(([key, item]) => [
                key,
                item.ativo,
            ])
        );
    }
}

export async function setFeatureFlag(key, ativo, updatedBy) {
    if (!DEFAULT_FEATURE_FLAGS[key]) {
        const error = new Error(`Feature flag desconhecida: ${key}`);
        error.status = 400;
        throw error;
    }

    await ensureDefaultFeatureFlags();

    const { rows } = await db.query(
        `
            UPDATE feature_flags
            SET ativo = $2,
                updated_by = $3,
                updated_at = now()
            WHERE flag_key = $1
            RETURNING *
        `,
        [key, Boolean(ativo), updatedBy || null]
    );

    return rows[0] ? rowToFlag(rows[0]) : null;
}
