import { db } from '../config/db.js';
import { enviarPushParaUtilizadores } from './pushNotificationService.js';

/**
 * ========================================
 * MENSAGENS INTERNAS
 * ========================================
 * Quem pode falar com quem:
 * - toda a gente pode escrever à gestão;
 * - o gestor pode escrever a qualquer utilizador ativo;
 * - professor ↔ alunos dos seus serviços e respetivos encarregados;
 * - encarregado ↔ professores dos seus educandos.
 * As relações vêm de vw_relacoes_professor_aluno (inscrições ativas).
 * ========================================
 */

export const LIMITE_CORPO = 5000;
export const LIMITE_ASSUNTO = 150;
export const LIMITE_PARTICIPANTES = 50;

const PREFIXO_ROTA = {
    gestor: '/gestor',
    professor: '/professor',
    aluno: '/aluno',
    encarregado: '/encarregado',
};

export class MensagensError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

export async function obterUtilizador(userId, executor = db) {
    const { rows } = await executor.query(
        `SELECT id_user, papel, nome, status FROM vw_utilizadores_nome WHERE id_user = $1`,
        [userId]
    );
    return rows[0] || null;
}

// Uma linha por relação (contacto, contexto); agrupada em listarContactos.
const CONTACTOS_SQL = `
    SELECT c.id_user, c.contexto
    FROM (
        SELECT u.id_user, NULL::text AS contexto
        FROM users u
        WHERE LOWER(u.role) = 'gestor'

        UNION ALL
        SELECT u.id_user, NULL::text
        FROM users u
        WHERE $2 = 'gestor'

        UNION ALL
        SELECT a.id_user, 'Aluno · ' || r.servico
        FROM vw_relacoes_professor_aluno r
        INNER JOIN professores p ON p.id_professor = r.id_professor AND p.id_user = $1
        INNER JOIN alunos a ON a.id_aluno = r.id_aluno
        WHERE $2 = 'professor'

        UNION ALL
        SELECT e.id_user, 'Encarregado de ' || pa.nome
        FROM vw_relacoes_professor_aluno r
        INNER JOIN professores p ON p.id_professor = r.id_professor AND p.id_user = $1
        INNER JOIN alunos a ON a.id_aluno = r.id_aluno
        INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
        INNER JOIN encarregados e ON e.id_encarregado = a.id_encarregado
        WHERE $2 = 'professor'

        UNION ALL
        SELECT p.id_user, 'Professor · ' || r.servico
        FROM vw_relacoes_professor_aluno r
        INNER JOIN alunos a ON a.id_aluno = r.id_aluno AND a.id_user = $1
        INNER JOIN professores p ON p.id_professor = r.id_professor
        WHERE $2 = 'aluno'

        UNION ALL
        SELECT p.id_user, 'Professor de ' || pa.nome || ' · ' || r.servico
        FROM encarregados e
        INNER JOIN alunos a ON a.id_encarregado = e.id_encarregado
        INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
        INNER JOIN vw_relacoes_professor_aluno r ON r.id_aluno = a.id_aluno
        INNER JOIN professores p ON p.id_professor = r.id_professor
        WHERE e.id_user = $1 AND $2 = 'encarregado'
    ) c
    INNER JOIN users u ON u.id_user = c.id_user AND u.status = true
    WHERE c.id_user IS NOT NULL AND c.id_user <> $1
`;

const PAPEL_LABEL = {
    gestor: 'Gestão',
    professor: 'Professor',
    aluno: 'Aluno',
    encarregado: 'Encarregado de educação',
};

export async function listarContactos(utilizador, { q = '' } = {}) {
    const { rows } = await db.query(
        `
        SELECT
            n.id_user,
            n.nome,
            n.papel,
            string_agg(DISTINCT c.contexto, ' | ') AS contexto
        FROM (${CONTACTOS_SQL}) c
        INNER JOIN vw_utilizadores_nome n ON n.id_user = c.id_user
        WHERE $3 = '' OR n.nome ILIKE '%' || $3 || '%'
        GROUP BY n.id_user, n.nome, n.papel
        ORDER BY
            CASE n.papel WHEN 'gestor' THEN 0 WHEN 'professor' THEN 1 WHEN 'encarregado' THEN 2 ELSE 3 END,
            n.nome
        LIMIT 200
        `,
        [utilizador.id_user, utilizador.papel, String(q || '').trim()]
    );

    return rows.map((row) => ({
        id: row.id_user,
        nome: row.nome,
        papel: row.papel,
        contexto: row.contexto || PAPEL_LABEL[row.papel] || '',
    }));
}

async function idsContactaveis(utilizador, executor = db) {
    const { rows } = await executor.query(`SELECT DISTINCT id_user FROM (${CONTACTOS_SQL}) c`, [
        utilizador.id_user,
        utilizador.papel,
    ]);
    return new Set(rows.map((row) => row.id_user));
}

// ---------- validação (pura, testada) ----------

export function normalizarCorpo(corpo) {
    const texto = String(corpo ?? '').replace(/\r\n/g, '\n').trim();
    if (!texto) throw new MensagensError(400, 'A mensagem não pode estar vazia.');
    if (texto.length > LIMITE_CORPO) {
        throw new MensagensError(400, `A mensagem não pode ter mais de ${LIMITE_CORPO} caracteres.`);
    }
    return texto;
}

export function normalizarAssunto(assunto) {
    const texto = String(assunto ?? '').trim();
    if (texto.length > LIMITE_ASSUNTO) {
        throw new MensagensError(400, `O assunto não pode ter mais de ${LIMITE_ASSUNTO} caracteres.`);
    }
    return texto || null;
}

export function normalizarParticipantes(participantes, idAutor) {
    if (!Array.isArray(participantes)) {
        throw new MensagensError(400, 'Indique pelo menos um destinatário.');
    }
    const ids = [...new Set(participantes.map(Number))].filter(
        (id) => Number.isInteger(id) && id > 0 && id !== idAutor
    );
    if (!ids.length) throw new MensagensError(400, 'Indique pelo menos um destinatário.');
    if (ids.length > LIMITE_PARTICIPANTES) {
        throw new MensagensError(400, `Uma conversa pode ter no máximo ${LIMITE_PARTICIPANTES} destinatários.`);
    }
    return ids;
}

export function preview(corpo, max = 120) {
    const texto = String(corpo || '').replace(/\s+/g, ' ').trim();
    return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

// ---------- conversas ----------

async function assertParticipante(userId, idConversa, executor = db) {
    const { rows } = await executor.query(
        `SELECT 1 FROM conversa_participantes WHERE id_conversa = $1 AND id_user = $2`,
        [idConversa, userId]
    );
    if (!rows.length) throw new MensagensError(404, 'Conversa não encontrada.');
}

export async function listarConversas(userId, { arquivadas = false, limit = 50 } = {}) {
    const { rows } = await db.query(
        `
        SELECT
            c.id_conversa,
            c.assunto,
            c.ultima_mensagem_em,
            eu.arquivada,
            (
                SELECT COUNT(*)::int FROM mensagens m
                WHERE m.id_conversa = c.id_conversa
                  AND m.id_mensagem > eu.ultima_lida_id
                  AND m.id_autor IS DISTINCT FROM $1
            ) AS nao_lidas,
            ultima.corpo AS ultima_corpo,
            ultima.id_autor AS ultima_autor,
            (
                SELECT json_agg(json_build_object('id', n.id_user, 'nome', n.nome, 'papel', n.papel) ORDER BY n.nome)
                FROM conversa_participantes cp
                INNER JOIN vw_utilizadores_nome n ON n.id_user = cp.id_user
                WHERE cp.id_conversa = c.id_conversa AND cp.id_user <> $1
            ) AS participantes
        FROM conversa_participantes eu
        INNER JOIN conversas c ON c.id_conversa = eu.id_conversa
        LEFT JOIN LATERAL (
            SELECT m.corpo, m.id_autor
            FROM mensagens m
            WHERE m.id_conversa = c.id_conversa
            ORDER BY m.id_mensagem DESC
            LIMIT 1
        ) ultima ON true
        WHERE eu.id_user = $1 AND eu.arquivada = $2
        ORDER BY c.ultima_mensagem_em DESC
        LIMIT $3
        `,
        [userId, arquivadas, Math.min(Math.max(Number(limit) || 50, 1), 100)]
    );

    return rows.map((row) => ({
        id: row.id_conversa,
        assunto: row.assunto,
        participantes: row.participantes || [],
        ultimaMensagem: row.ultima_corpo
            ? { preview: preview(row.ultima_corpo), minha: row.ultima_autor === userId }
            : null,
        ultimaMensagemEm: row.ultima_mensagem_em,
        naoLidas: row.nao_lidas,
        arquivada: row.arquivada,
    }));
}

export async function contarNaoLidas(userId) {
    const { rows } = await db.query(
        `
        SELECT COUNT(*)::int AS total
        FROM conversa_participantes cp
        INNER JOIN mensagens m
            ON m.id_conversa = cp.id_conversa
           AND m.id_mensagem > cp.ultima_lida_id
           AND m.id_autor IS DISTINCT FROM cp.id_user
        WHERE cp.id_user = $1 AND cp.arquivada = false
        `,
        [userId]
    );
    return rows[0]?.total ?? 0;
}

async function encontrarConversaDireta(client, idA, idB) {
    const { rows } = await client.query(
        `
        SELECT c.id_conversa
        FROM conversas c
        WHERE c.assunto IS NULL
          AND EXISTS (SELECT 1 FROM conversa_participantes WHERE id_conversa = c.id_conversa AND id_user = $1)
          AND EXISTS (SELECT 1 FROM conversa_participantes WHERE id_conversa = c.id_conversa AND id_user = $2)
          AND (SELECT COUNT(*) FROM conversa_participantes WHERE id_conversa = c.id_conversa) = 2
        ORDER BY c.id_conversa
        LIMIT 1
        `,
        [idA, idB]
    );
    return rows[0]?.id_conversa ?? null;
}

async function inserirMensagem(client, { idConversa, idAutor, corpo }) {
    const { rows } = await client.query(
        `INSERT INTO mensagens (id_conversa, id_autor, corpo)
         VALUES ($1, $2, $3)
         RETURNING id_mensagem, created_at`,
        [idConversa, idAutor, corpo]
    );
    const mensagem = rows[0];

    await client.query(
        `UPDATE conversas SET ultima_mensagem_em = $2 WHERE id_conversa = $1`,
        [idConversa, mensagem.created_at]
    );
    // Uma mensagem nova tira a conversa do arquivo de toda a gente; o autor já a leu.
    await client.query(
        `UPDATE conversa_participantes
         SET arquivada = false,
             ultima_lida_id = CASE WHEN id_user = $2 THEN $3 ELSE ultima_lida_id END
         WHERE id_conversa = $1`,
        [idConversa, idAutor, mensagem.id_mensagem]
    );

    return mensagem;
}

/**
 * Inicia uma conversa (ou continua a conversa direta já existente entre as
 * mesmas duas pessoas, se não tiver assunto) e envia a primeira mensagem.
 */
export async function criarConversa(autor, { participantes, assunto, mensagem }) {
    const ids = normalizarParticipantes(participantes, autor.id_user);
    const corpo = normalizarCorpo(mensagem);
    const assuntoFinal = normalizarAssunto(assunto);

    const permitidos = await idsContactaveis(autor);
    const naoPermitidos = ids.filter((id) => !permitidos.has(id));
    if (naoPermitidos.length) {
        throw new MensagensError(403, 'Não pode enviar mensagens a um ou mais destinatários escolhidos.');
    }

    const client = await db.connect();
    try {
        await client.query('BEGIN');

        let idConversa =
            ids.length === 1 && !assuntoFinal
                ? await encontrarConversaDireta(client, autor.id_user, ids[0])
                : null;
        const reutilizada = Boolean(idConversa);

        if (!idConversa) {
            const { rows } = await client.query(
                `INSERT INTO conversas (assunto, criada_por) VALUES ($1, $2) RETURNING id_conversa`,
                [assuntoFinal, autor.id_user]
            );
            idConversa = rows[0].id_conversa;
            await client.query(
                `INSERT INTO conversa_participantes (id_conversa, id_user)
                 SELECT $1, unnest($2::int[])`,
                [idConversa, [autor.id_user, ...ids]]
            );
        }

        const inserida = await inserirMensagem(client, { idConversa, idAutor: autor.id_user, corpo });
        await client.query('COMMIT');

        await notificarNovaMensagem({ idConversa, autor, corpo, destinatarios: ids });
        return { idConversa: Number(idConversa), idMensagem: Number(inserida.id_mensagem), reutilizada };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function enviarMensagem(autor, idConversa, corpoBruto) {
    const corpo = normalizarCorpo(corpoBruto);
    await assertParticipante(autor.id_user, idConversa);

    const client = await db.connect();
    let inserida;
    try {
        await client.query('BEGIN');
        inserida = await inserirMensagem(client, { idConversa, idAutor: autor.id_user, corpo });
        await client.query('COMMIT');
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }

    const { rows } = await db.query(
        `SELECT id_user FROM conversa_participantes WHERE id_conversa = $1 AND id_user <> $2`,
        [idConversa, autor.id_user]
    );
    await notificarNovaMensagem({
        idConversa,
        autor,
        corpo,
        destinatarios: rows.map((row) => row.id_user),
    });

    return mapMensagem({ ...inserida, id_autor: autor.id_user, corpo, autor_nome: autor.nome }, autor.id_user);
}

function mapMensagem(row, userId) {
    return {
        id: Number(row.id_mensagem),
        autor: row.id_autor ? { id: row.id_autor, nome: row.autor_nome } : null,
        minha: row.id_autor === userId,
        corpo: row.corpo,
        criadaEm: row.created_at,
    };
}

/**
 * Mensagens de uma conversa, das mais recentes para trás. `antes` é o id da
 * mensagem mais antiga já carregada (paginação para cima).
 */
export async function listarMensagens(userId, idConversa, { antes = null, limit = 30 } = {}) {
    await assertParticipante(userId, idConversa);
    const limite = Math.min(Math.max(Number(limit) || 30, 1), 100);

    const [{ rows: conversaRows }, { rows }] = await Promise.all([
        db.query(
            `
            SELECT
                c.id_conversa,
                c.assunto,
                (
                    SELECT json_agg(json_build_object('id', n.id_user, 'nome', n.nome, 'papel', n.papel) ORDER BY n.nome)
                    FROM conversa_participantes cp
                    INNER JOIN vw_utilizadores_nome n ON n.id_user = cp.id_user
                    WHERE cp.id_conversa = c.id_conversa AND cp.id_user <> $2
                ) AS participantes
            FROM conversas c
            WHERE c.id_conversa = $1
            `,
            [idConversa, userId]
        ),
        db.query(
            `
            SELECT m.id_mensagem, m.id_autor, m.corpo, m.created_at, n.nome AS autor_nome
            FROM mensagens m
            LEFT JOIN vw_utilizadores_nome n ON n.id_user = m.id_autor
            WHERE m.id_conversa = $1
              AND ($2::bigint IS NULL OR m.id_mensagem < $2::bigint)
            ORDER BY m.id_mensagem DESC
            LIMIT $3
            `,
            [idConversa, antes ? Number(antes) : null, limite + 1]
        ),
    ]);

    const temMais = rows.length > limite;
    const mensagens = rows.slice(0, limite).reverse().map((row) => mapMensagem(row, userId));

    return {
        conversa: {
            id: Number(conversaRows[0].id_conversa),
            assunto: conversaRows[0].assunto,
            participantes: conversaRows[0].participantes || [],
        },
        mensagens,
        temMais,
    };
}

export async function marcarComoLida(userId, idConversa) {
    await assertParticipante(userId, idConversa);
    await db.query(
        `
        UPDATE conversa_participantes cp
        SET ultima_lida_id = GREATEST(
            cp.ultima_lida_id,
            COALESCE((SELECT MAX(id_mensagem) FROM mensagens WHERE id_conversa = $1), 0)
        )
        WHERE cp.id_conversa = $1 AND cp.id_user = $2
        `,
        [idConversa, userId]
    );
}

export async function definirArquivada(userId, idConversa, arquivada) {
    await assertParticipante(userId, idConversa);
    await db.query(
        `UPDATE conversa_participantes SET arquivada = $3 WHERE id_conversa = $1 AND id_user = $2`,
        [idConversa, userId, Boolean(arquivada)]
    );
}

// ---------- notificações ----------

async function notificarNovaMensagem({ idConversa, autor, corpo, destinatarios }) {
    if (!destinatarios.length) return;

    try {
        const { rows } = await db.query(
            `SELECT id_user, papel FROM vw_utilizadores_nome WHERE id_user = ANY($1::int[]) AND status = true`,
            [destinatarios]
        );

        // O link depende da área de cada destinatário.
        const porPapel = new Map();
        for (const row of rows) {
            const prefixo = PREFIXO_ROTA[row.papel];
            if (!prefixo) continue;
            if (!porPapel.has(prefixo)) porPapel.set(prefixo, []);
            porPapel.get(prefixo).push(row.id_user);
        }

        await Promise.all(
            [...porPapel.entries()].map(([prefixo, userIds]) =>
                enviarPushParaUtilizadores({
                    userIds,
                    tipo: 'mensagem',
                    titulo: `Nova mensagem de ${autor.nome}`,
                    descricao: preview(corpo),
                    nivel: 'info',
                    payload: { id_conversa: Number(idConversa) },
                    link: `${prefixo}/mensagens?conversa=${idConversa}`,
                })
            )
        );
    } catch (error) {
        // A mensagem já foi gravada; uma falha no push não deve falhar o envio.
        console.error('[mensagens] Falha ao enviar push:', error.message);
    }
}

/**
 * Utilizadores com mensagens por ler há mais de `horas` horas (só conta
 * mensagens dos últimos 7 dias, para não repetir avisos antigos para
 * sempre). Usado pelo resumo diário por email.
 */
export async function listarPendentesParaResumo({ horas = 2 } = {}) {
    const { rows } = await db.query(
        `
        SELECT
            cp.id_user,
            dest.papel,
            COUNT(*)::int AS total,
            array_agg(DISTINCT autor.nome) AS autores
        FROM conversa_participantes cp
        INNER JOIN vw_utilizadores_nome dest ON dest.id_user = cp.id_user AND dest.status = true
        INNER JOIN mensagens m
            ON m.id_conversa = cp.id_conversa
           AND m.id_mensagem > cp.ultima_lida_id
           AND m.id_autor IS DISTINCT FROM cp.id_user
           AND m.created_at > NOW() - INTERVAL '7 days'
        LEFT JOIN vw_utilizadores_nome autor ON autor.id_user = m.id_autor
        WHERE cp.arquivada = false
        GROUP BY cp.id_user, dest.papel
        HAVING MIN(m.created_at) < NOW() - make_interval(hours => $1)
        `,
        [horas]
    );
    return rows.map((row) => ({
        idUser: row.id_user,
        papel: row.papel,
        total: row.total,
        autores: (row.autores || []).filter(Boolean),
    }));
}

export function prefixoRota(papel) {
    return PREFIXO_ROTA[papel] || '';
}
