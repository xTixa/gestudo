import { db } from '../config/db.js';
import { buscarAtividadesPorDia } from '../controllers/agendaController.js';
import { dispatchAlert } from '../services/alertasDispatchService.js';
import { getFeatureFlagsMap } from '../services/featureFlagsService.js';
import { runLogRetentionCleanup } from '../services/logRetentionService.js';
import { gerarMensalidadesDoMes } from '../services/mensalidadesService.js';
import { listarPendentesParaResumo, prefixoRota } from '../services/mensagensService.js';
import { idsGestoresAtivos, registarTarefa } from './agendador.js';
import { dataPt, euros, nomeMes, somarDias } from './tempo.js';

// Dias de antecedência do lembrete de mensalidade a vencer.
export const DIAS_AVISO_VENCIMENTO = 3;
// Dias depois do vencimento em que o encarregado é avisado (1.º e 2.º aviso).
export const DIAS_AVISO_VENCIDA = [1, 8];

export function diaVencimentoConfigurado() {
    const dia = Number(process.env.MENSALIDADES_DIA_VENCIMENTO || 8);
    return Number.isInteger(dia) && dia >= 1 && dia <= 28 ? dia : 8;
}

// ---------- funções puras (testadas em tests/unit/tarefas.test.js) ----------

/**
 * Agrupa linhas por utilizador destinatário. O encarregado recebe os avisos
 * dos seus educandos; um aluno sem encarregado ativo recebe os seus.
 */
export function agruparPorDestinatario(rows) {
    const grupos = new Map();
    for (const row of rows) {
        const idUser = row.id_user_encarregado || row.id_user_aluno;
        if (!idUser) continue;
        const papel = row.id_user_encarregado ? 'encarregado' : 'aluno';
        if (!grupos.has(idUser)) {
            grupos.set(idUser, { idUser, papel, itens: [] });
        }
        grupos.get(idUser).itens.push(row);
    }
    return [...grupos.values()];
}

function linhaMensalidade(item, papel) {
    const quem = papel === 'encarregado' ? `${item.aluno_nome}: ` : '';
    return `${quem}${nomeMes(item.mes_referencia)}, ${euros(item.valor_em_divida)} em dívida`;
}

export function mensagemAVencer(grupo) {
    const { itens, papel } = grupo;
    const data = dataPt(itens[0].data_vencimento);
    if (itens.length === 1) {
        const item = itens[0];
        const de = papel === 'encarregado' ? ` de ${item.aluno_nome}` : '';
        return {
            titulo: 'Mensalidade a vencer',
            descricao: `A mensalidade${de} de ${nomeMes(item.mes_referencia)} (${euros(item.valor_em_divida)}) vence a ${data}.`,
        };
    }
    return {
        titulo: `${itens.length} mensalidades a vencer`,
        descricao: `Vencem a ${data}: ${itens.map((item) => linhaMensalidade(item, papel)).join('; ')}.`,
    };
}

export function mensagemVencida(grupo) {
    const { itens, papel } = grupo;
    if (itens.length === 1) {
        const item = itens[0];
        const de = papel === 'encarregado' ? ` de ${item.aluno_nome}` : '';
        return {
            titulo: 'Mensalidade em atraso',
            descricao: `A mensalidade${de} de ${nomeMes(item.mes_referencia)} venceu a ${dataPt(item.data_vencimento)} e tem ${euros(item.valor_em_divida)} por pagar.`,
        };
    }
    return {
        titulo: `${itens.length} mensalidades em atraso`,
        descricao: `${itens.map((item) => `${linhaMensalidade(item, papel)} (venceu a ${dataPt(item.data_vencimento)})`).join('; ')}.`,
    };
}

/**
 * Remove as sessões que foram repostas noutro dia: a sessão original fica
 * com estado 'reposta' e a reposição tem `dataOriginal`.
 */
export function aulasEfetivas(atividades = []) {
    return atividades.filter(
        (aula) => !(String(aula.estado || '').toLowerCase() === 'reposta' && !aula.dataOriginal)
    );
}

export function formatarAula(aula) {
    const horas = aula.horaFim ? `${aula.hora}–${aula.horaFim}` : aula.hora;
    const local = aula.local && aula.local !== 'Sem sala' ? ` · ${aula.local}` : '';
    return `${horas} ${aula.titulo}${local}`;
}

export function mensagemLembreteAulas({ papel, nomeAluno, aulas }) {
    const lista = aulas.map(formatarAula).join('; ');
    const n = aulas.length;
    const plural = n === 1 ? 'aula' : 'aulas';

    if (papel === 'encarregado') {
        return {
            titulo: `Aulas de amanhã: ${nomeAluno}`,
            descricao: `${nomeAluno} tem ${n} ${plural} amanhã: ${lista}.`,
        };
    }
    if (papel === 'professor') {
        return {
            titulo: `Tem ${n} ${plural} amanhã`,
            descricao: lista,
        };
    }
    return {
        titulo: `Tens ${n} ${plural} amanhã`,
        descricao: lista,
    };
}

export function mensagemResumoMensagens({ total, autores }) {
    const plural = total === 1 ? 'mensagem' : 'mensagens';
    const lista = autores.slice(0, 3).join(', ');
    const outros = autores.length > 3 ? ` e mais ${autores.length - 3}` : '';
    return {
        titulo: `Tem ${total} ${plural} por ler`,
        descricao: lista ? `De: ${lista}${outros}.` : 'Abra a plataforma para as ler.',
    };
}

const LINK_PAGAMENTOS = { encarregado: '/encarregado/pagamentos', aluno: '/aluno/notificacoes' };
const LINK_AGENDA = {
    encarregado: '/encarregado/agenda',
    aluno: '/aluno/agenda',
    professor: '/professor/agenda',
};

// ---------- consultas ----------

async function mensalidadesEmDividaComVencimento(datas) {
    const { rows } = await db.query(
        `
        SELECT
            v.id_mensalidade,
            v.mes_referencia::text AS mes_referencia,
            v.data_vencimento::text AS data_vencimento,
            v.valor_em_divida,
            pa.nome AS aluno_nome,
            CASE WHEN ua.status THEN ua.id_user END AS id_user_aluno,
            ue.id_user AS id_user_encarregado
        FROM vw_mensalidades_estado v
        INNER JOIN alunos a ON a.id_aluno = v.id_aluno
        INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
        LEFT JOIN users ua ON ua.id_user = a.id_user
        LEFT JOIN encarregados e ON e.id_encarregado = COALESCE(v.id_encarregado, a.id_encarregado)
        LEFT JOIN users ue ON ue.id_user = e.id_user AND ue.status = true
        WHERE v.anulada = false
          AND v.valor_em_divida > 0
          AND v.data_vencimento = ANY($1::date[])
        ORDER BY v.data_vencimento, pa.nome
        `,
        [datas]
    );
    return rows;
}

async function enviarPorDestinatario(grupos, codigo, construirMensagem, nivel) {
    let enviados = 0;
    for (const grupo of grupos) {
        const { titulo, descricao } = construirMensagem(grupo);
        const resultado = await dispatchAlert({
            codigo,
            for_user_ids: [grupo.idUser],
            titulo,
            descricao,
            nivel,
            payload: { mensalidades: grupo.itens.map((item) => item.id_mensalidade) },
            pushLink: LINK_PAGAMENTOS[grupo.papel],
        });
        if (resultado.success) enviados += 1;
    }
    return enviados;
}

async function avisarGestores({ titulo, descricao, nivel = 'info', pushLink }) {
    const gestores = await idsGestoresAtivos();
    if (!gestores.length) return;
    await dispatchAlert({
        codigo: 'tarefas-automaticas',
        for_user_ids: gestores,
        titulo,
        descricao,
        nivel,
        pushLink,
    });
}

// ---------- tarefas ----------

registarTarefa({
    nome: 'limpeza-logs',
    titulo: 'Limpeza de logs antigos',
    descricao: 'Apaga registos de auditoria que passaram o prazo de retenção (1 mês a 1 ano, conforme o nível).',
    agenda: { tipo: 'diaria', hora: '03:30' },
    async executar() {
        const { deleted } = await runLogRetentionCleanup();
        return { removidos: deleted };
    },
});

registarTarefa({
    nome: 'mensalidades-a-vencer',
    titulo: 'Lembrete de mensalidades a vencer',
    descricao: `Avisa os encarregados (ou o aluno, se não tiver encarregado) ${DIAS_AVISO_VENCIMENTO} dias antes do vencimento de uma mensalidade por pagar.`,
    agenda: { tipo: 'diaria', hora: '09:00' },
    requerModulo: 'financeiro',
    async executar({ hoje }) {
        const rows = await mensalidadesEmDividaComVencimento([somarDias(hoje, DIAS_AVISO_VENCIMENTO)]);
        const grupos = agruparPorDestinatario(rows);
        const enviados = await enviarPorDestinatario(grupos, 'mensalidade-a-vencer', mensagemAVencer, 'info');
        return { mensalidades: rows.length, destinatarios: grupos.length, enviados };
    },
});

registarTarefa({
    nome: 'mensalidades-vencidas',
    titulo: 'Aviso de mensalidades em atraso',
    descricao: `Avisa os encarregados ${DIAS_AVISO_VENCIDA.map((d) => `${d}`).join(' e ')} dias depois do vencimento de uma mensalidade por pagar, e envia aos gestores o resumo das que venceram ontem.`,
    agenda: { tipo: 'diaria', hora: '09:05' },
    requerModulo: 'financeiro',
    async executar({ hoje }) {
        const ontem = somarDias(hoje, -1);
        const datas = DIAS_AVISO_VENCIDA.map((dias) => somarDias(hoje, -dias));
        const rows = await mensalidadesEmDividaComVencimento(datas);
        const grupos = agruparPorDestinatario(rows);
        const enviados = await enviarPorDestinatario(grupos, 'faturas-vencidas', mensagemVencida, 'warning');

        const novasVencidas = rows.filter((row) => row.data_vencimento === ontem);
        if (novasVencidas.length) {
            const total = novasVencidas.reduce((soma, row) => soma + Number(row.valor_em_divida), 0);
            await avisarGestores({
                titulo: `${novasVencidas.length} mensalidade${novasVencidas.length === 1 ? '' : 's'} em atraso`,
                descricao: `Venceram a ${dataPt(ontem)} sem pagamento completo, num total de ${euros(total)} em dívida.`,
                nivel: 'warning',
                pushLink: '/gestor/financeiro/mensalidades',
            });
        }

        return {
            mensalidades: rows.length,
            novasVencidas: novasVencidas.length,
            destinatarios: grupos.length,
            enviados,
        };
    },
});

registarTarefa({
    nome: 'lembrete-aulas',
    titulo: 'Lembrete das aulas de amanhã',
    descricao: 'Envia a alunos, encarregados e professores a lista das aulas do dia seguinte.',
    agenda: { tipo: 'diaria', hora: '18:00' },
    async executar({ hoje }) {
        const amanha = somarDias(hoje, 1);
        let enviados = 0;

        const aulasDoUtilizador = async (idUser) => {
            const { atividadesPorDia } = await buscarAtividadesPorDia(idUser, amanha, amanha);
            return aulasEfetivas(atividadesPorDia[amanha]);
        };

        const enviar = async (idUser, papel, mensagem) => {
            const resultado = await dispatchAlert({
                codigo: 'lembrete-aulas',
                for_user_ids: [idUser],
                ...mensagem,
                nivel: 'info',
                payload: { data: amanha },
                pushLink: LINK_AGENDA[papel],
            });
            if (resultado.success) enviados += 1;
        };

        const { rows: alunos } = await db.query(
            `
            SELECT
                a.id_user,
                pa.nome,
                ua.status AS aluno_ativo,
                ue.id_user AS id_user_encarregado
            FROM alunos a
            INNER JOIN users ua ON ua.id_user = a.id_user
            INNER JOIN pessoas pa ON pa.id_pessoa = a.id_pessoa
            LEFT JOIN encarregados e ON e.id_encarregado = a.id_encarregado
            LEFT JOIN users ue ON ue.id_user = e.id_user AND ue.status = true
            WHERE (ua.status = true OR ue.id_user IS NOT NULL)
              AND EXISTS (
                  SELECT 1 FROM inscricoes i
                  WHERE i.id_aluno = a.id_aluno
                    AND LOWER(COALESCE(i.estado, '')) = 'ativa'
              )
            `
        );

        let alunosComAulas = 0;
        for (const aluno of alunos) {
            const aulas = await aulasDoUtilizador(aluno.id_user);
            if (!aulas.length) continue;
            alunosComAulas += 1;

            if (aluno.aluno_ativo) {
                await enviar(aluno.id_user, 'aluno', mensagemLembreteAulas({ papel: 'aluno', aulas }));
            }
            if (aluno.id_user_encarregado) {
                await enviar(
                    aluno.id_user_encarregado,
                    'encarregado',
                    mensagemLembreteAulas({ papel: 'encarregado', nomeAluno: aluno.nome, aulas })
                );
            }
        }

        const { rows: professores } = await db.query(
            `
            SELECT p.id_user
            FROM professores p
            INNER JOIN users u ON u.id_user = p.id_user
            WHERE u.status = true
            `
        );

        let professoresComAulas = 0;
        for (const professor of professores) {
            const aulas = await aulasDoUtilizador(professor.id_user);
            if (!aulas.length) continue;
            professoresComAulas += 1;
            await enviar(professor.id_user, 'professor', mensagemLembreteAulas({ papel: 'professor', aulas }));
        }

        return { data: amanha, alunosComAulas, professoresComAulas, enviados };
    },
});

registarTarefa({
    nome: 'gerar-mensalidades',
    titulo: 'Geração automática de mensalidades',
    descricao: 'No dia 1 de cada mês gera as mensalidades do mês a partir das inscrições ativas e avisa os gestores. Alunos que já têm mensalidade nesse mês são ignorados.',
    notaAtivacao: 'Liga-se em Configurações → Funcionalidades ("Gerar mensalidades automaticamente"). O dia de vencimento vem de MENSALIDADES_DIA_VENCIMENTO (8 por omissão).',
    agenda: { tipo: 'mensal', dia: 1, hora: '07:00' },
    requerModulo: 'financeiro',
    async ativa() {
        const flags = await getFeatureFlagsMap();
        return Boolean(flags.gerar_mensalidades_auto);
    },
    async executar({ hoje, manual }) {
        const mes = hoje.slice(0, 7);
        const dia = String(diaVencimentoConfigurado()).padStart(2, '0');
        const resultado = await gerarMensalidadesDoMes({
            mesReferencia: `${mes}-01`,
            dataVencimento: `${mes}-${dia}`,
        });

        const partes = [`${resultado.criadas} criada${resultado.criadas === 1 ? '' : 's'} (${euros(resultado.total)})`];
        if (resultado.jaExistentes) partes.push(`${resultado.jaExistentes} já existiam`);
        if (resultado.semPreco.length) {
            partes.push(`${resultado.semPreco.length} inscrição(ões) sem preço ficaram de fora`);
        }

        // Numa execução manual o gestor já vê o resultado no ecrã; só avisa se criou algo.
        if (!manual || resultado.criadas > 0) {
            await avisarGestores({
                titulo: `Mensalidades de ${nomeMes(`${mes}-01`)}`,
                descricao: `${partes.join(', ')}. Vencimento a ${dataPt(`${mes}-${dia}`)}.`,
                nivel: resultado.semPreco.length ? 'warning' : 'success',
                pushLink: '/gestor/financeiro/mensalidades',
            });
        }

        return {
            mes,
            criadas: resultado.criadas,
            jaExistentes: resultado.jaExistentes,
            semPreco: resultado.semPreco.length,
            total: resultado.total,
        };
    },
});

registarTarefa({
    nome: 'mensagens-por-ler',
    titulo: 'Resumo de mensagens por ler',
    descricao: 'Envia por email a quem tem mensagens por ler há mais de 2 horas um resumo com o número de mensagens e quem as enviou.',
    agenda: { tipo: 'diaria', hora: '19:00' },
    requerModulo: 'mensagens',
    async executar() {
        const pendentes = await listarPendentesParaResumo({ horas: 2 });
        let enviados = 0;
        for (const pendente of pendentes) {
            const resultado = await dispatchAlert({
                codigo: 'mensagens-por-ler',
                for_user_ids: [pendente.idUser],
                ...mensagemResumoMensagens(pendente),
                nivel: 'info',
                pushLink: `${prefixoRota(pendente.papel)}/mensagens`,
            });
            if (resultado.success) enviados += 1;
        }
        return { destinatarios: pendentes.length, enviados };
    },
});
