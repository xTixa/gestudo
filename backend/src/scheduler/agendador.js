import { db } from '../config/db.js';
import { hasModule } from '../config/plans.js';
import { dispatchAlert } from '../services/alertasDispatchService.js';
import { descreverAgenda, partesNoFuso, periodoEmDivida } from './tempo.js';

/**
 * ========================================
 * AGENDADOR DE TAREFAS
 * ========================================
 * Verifica a cada minuto que tarefas estão em dívida e corre-as. Cada
 * execução é reclamada na tabela tarefas_agendadas_execucoes com a chave
 * (tarefa, período), por isso:
 * - um período corre uma só vez, mesmo com várias instâncias da API;
 * - se o servidor estiver em baixo à hora marcada, a tarefa corre quando
 *   voltar (dentro do mesmo período);
 * - uma execução que falhou é repetida até MAX_TENTATIVAS vezes.
 * ========================================
 */

const INTERVALO_MS = 60 * 1000;
const MAX_TENTATIVAS = 3;

const tarefas = new Map();
// Períodos já tratados por esta instância, para não consultar a BD a cada minuto.
const periodosTratados = new Set();

let timer = null;
let tickEmCurso = false;

/**
 * Regista uma tarefa.
 * - nome: identificador estável (fica guardado na BD)
 * - agenda: ver periodoEmDivida()
 * - requerModulo: módulo do pacote necessário (também para execução manual)
 * - ativa(): condição extra só para execuções automáticas (ex.: feature flag)
 * - executar(contexto): devolve um objeto com o resultado (guardado em JSON)
 */
export function registarTarefa(definicao) {
    if (tarefas.has(definicao.nome)) {
        throw new Error(`Tarefa duplicada: ${definicao.nome}`);
    }
    tarefas.set(definicao.nome, definicao);
}

async function reclamarExecucao(nome, periodo, { manual, userId }) {
    const { rows } = await db.query(
        `
        INSERT INTO tarefas_agendadas_execucoes AS t (tarefa, periodo, manual, iniciado_por)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (tarefa, periodo) DO UPDATE
            SET estado = 'a_correr',
                tentativas = t.tentativas + 1,
                iniciado_em = NOW(),
                terminado_em = NULL,
                erro = NULL
            WHERE (
                t.estado = 'falhou'
                AND t.tentativas < $5
                AND t.terminado_em < NOW() - INTERVAL '15 minutes'
            ) OR (
                -- Execução que ficou presa (ex.: servidor reiniciado a meio).
                t.estado = 'a_correr'
                AND t.iniciado_em < NOW() - INTERVAL '1 hour'
            )
        RETURNING id_execucao, tentativas
        `,
        [nome, periodo, manual, userId, MAX_TENTATIVAS]
    );
    return rows[0] || null;
}

async function terminarExecucao(idExecucao, { estado, resultado = null, erro = null }) {
    await db.query(
        `
        UPDATE tarefas_agendadas_execucoes
        SET estado = $2, resultado = $3, erro = $4, terminado_em = NOW()
        WHERE id_execucao = $1
        `,
        [idExecucao, estado, resultado ? JSON.stringify(resultado) : null, erro]
    );
}

export async function idsGestoresAtivos() {
    const { rows } = await db.query(
        `SELECT id_user FROM users WHERE LOWER(role) = 'gestor' AND status = true`
    );
    return rows.map((row) => row.id_user);
}

async function avisarGestoresFalha(tarefa, erro) {
    const gestores = await idsGestoresAtivos();
    if (!gestores.length) return;

    await dispatchAlert({
        codigo: 'tarefas-automaticas',
        for_user_ids: gestores,
        titulo: `Falha na tarefa "${tarefa.titulo}"`,
        descricao: `A tarefa falhou ${MAX_TENTATIVAS} vezes e não volta a tentar hoje. Erro: ${erro}`,
        nivel: 'danger',
        payload: { tarefa: tarefa.nome },
        pushLink: '/gestor/configuracoes',
    });
}

/**
 * Corre uma tarefa para um período. Devolve { executada: false, motivo }
 * quando não corre (já corrida, módulo em falta, desativada).
 */
export async function executarTarefa(nome, { periodo, manual = false, userId = null, agora = new Date() } = {}) {
    const tarefa = tarefas.get(nome);
    if (!tarefa) {
        const error = new Error(`Tarefa desconhecida: ${nome}`);
        error.status = 404;
        throw error;
    }

    if (tarefa.requerModulo && !hasModule(tarefa.requerModulo)) {
        return { executada: false, motivo: 'modulo_indisponivel' };
    }

    if (!manual && tarefa.ativa && !(await tarefa.ativa())) {
        return { executada: false, motivo: 'desativada' };
    }

    const periodoFinal = manual ? `manual:${agora.toISOString()}` : periodo;
    const execucao = await reclamarExecucao(nome, periodoFinal, { manual, userId });
    if (!execucao) {
        return { executada: false, motivo: 'ja_executada' };
    }

    const contexto = {
        agora,
        hoje: partesNoFuso(agora).data,
        periodo,
        manual,
    };

    try {
        const resultado = (await tarefa.executar(contexto)) || {};
        await terminarExecucao(execucao.id_execucao, { estado: 'concluida', resultado });
        return { executada: true, resultado };
    } catch (error) {
        console.error(`[Agendador] ${nome} falhou:`, error.message);
        await terminarExecucao(execucao.id_execucao, {
            estado: 'falhou',
            erro: error.message,
        }).catch(() => {});

        if (!manual && execucao.tentativas >= MAX_TENTATIVAS) {
            await avisarGestoresFalha(tarefa, error.message).catch(() => {});
        }

        if (manual) throw error;
        return { executada: false, motivo: 'falhou', erro: error.message };
    }
}

async function tick() {
    if (tickEmCurso) return;
    tickEmCurso = true;

    try {
        const agora = new Date();
        for (const tarefa of tarefas.values()) {
            const periodo = periodoEmDivida(tarefa.agenda, agora);
            if (!periodo) continue;

            const chave = `${tarefa.nome}:${periodo}`;
            if (periodosTratados.has(chave)) continue;

            try {
                const resultado = await executarTarefa(tarefa.nome, { periodo, agora });
                // "desativada" e "falhou" voltam a ser verificadas no próximo minuto
                // (a flag pode ser ligada, e a falha pode ter nova tentativa).
                if (resultado.executada || resultado.motivo === 'ja_executada' || resultado.motivo === 'modulo_indisponivel') {
                    periodosTratados.add(chave);
                }
                if (resultado.executada) {
                    console.log(`[Agendador] ${tarefa.nome} (${periodo}) concluída.`);
                }
            } catch (error) {
                console.error(`[Agendador] Erro ao verificar ${tarefa.nome}:`, error.message);
            }
        }
    } finally {
        tickEmCurso = false;
    }
}

export function iniciarAgendador() {
    if (timer) return;

    if (process.env.NODE_ENV === 'test' || process.env.JOBS_ENABLED === 'false') {
        console.log('[Agendador] Desativado (JOBS_ENABLED=false ou ambiente de teste).');
        return;
    }

    // Primeira verificação pouco depois do arranque, depois a cada minuto.
    setTimeout(() => void tick(), 10 * 1000).unref?.();
    timer = setInterval(() => void tick(), INTERVALO_MS);
    timer.unref?.();

    console.log(`[Agendador] ${tarefas.size} tarefas registadas.`);
}

/**
 * Lista as tarefas com a última execução e o histórico recente (para o backoffice).
 */
export async function listarTarefas({ historico = 10 } = {}) {
    const nomes = [...tarefas.keys()];
    const { rows } = await db.query(
        `
        SELECT *
        FROM (
            SELECT
                e.*,
                ROW_NUMBER() OVER (PARTITION BY e.tarefa ORDER BY e.iniciado_em DESC) AS posicao
            FROM tarefas_agendadas_execucoes e
            WHERE e.tarefa = ANY($1::text[])
        ) x
        WHERE x.posicao <= $2
        ORDER BY x.tarefa, x.iniciado_em DESC
        `,
        [nomes, historico]
    );

    const porTarefa = new Map(nomes.map((nome) => [nome, []]));
    for (const row of rows) {
        porTarefa.get(row.tarefa)?.push({
            id: row.id_execucao,
            periodo: row.periodo,
            estado: row.estado,
            tentativas: row.tentativas,
            manual: row.manual,
            resultado: row.resultado,
            erro: row.erro,
            iniciadoEm: row.iniciado_em,
            terminadoEm: row.terminado_em,
        });
    }

    const lista = [];
    for (const tarefa of tarefas.values()) {
        const moduloDisponivel = !tarefa.requerModulo || hasModule(tarefa.requerModulo);
        lista.push({
            nome: tarefa.nome,
            titulo: tarefa.titulo,
            descricao: tarefa.descricao,
            agenda: descreverAgenda(tarefa.agenda),
            requerModulo: tarefa.requerModulo || null,
            moduloDisponivel,
            ativa: moduloDisponivel && (tarefa.ativa ? await tarefa.ativa() : true),
            notaAtivacao: tarefa.notaAtivacao || null,
            execucoes: porTarefa.get(tarefa.nome) || [],
        });
    }
    return lista;
}

// Só para testes.
export function _limparRegisto() {
    tarefas.clear();
    periodosTratados.clear();
}
