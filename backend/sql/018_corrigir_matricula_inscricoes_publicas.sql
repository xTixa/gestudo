-- Até agora, aprovar uma inscrição pública só marcava a matrícula como
-- renovada (ano_letivo_renovacao) quando o pedido vinha do fluxo interno de
-- reinscrição (dados.origem = 'reinscricao_aluno'). Alunos criados a partir
-- do formulário público normal ficavam sem essa data preenchida, e a
-- plataforma trata isso como matrícula expirada (ver matriculaMiddleware.js)
-- — foi isto que causou pais sem acesso aos horários dos filhos, apesar da
-- inscrição já ter sido aprovada. O código já foi corrigido para preencher
-- sempre este campo na aprovação; esta migração regulariza os alunos já
-- afetados por essa lacuna.
--
-- Só atualiza alunos cuja matrícula nunca foi renovada para o ano letivo
-- atual (ano_letivo_renovacao distinto ou nulo) — não toca em alunos que já
-- estão corretos, nem nos que legitimamente ainda não renovaram por não
-- terem sido aprovados este ano.
-- Nota: não reativa contas (users.status) aqui de propósito — não há forma
-- fiável de distinguir, para uma conta já suspensa, se foi por causa desta
-- falha de matrícula ou por outro motivo (ex: gestor suspendeu manualmente).
-- Reativação de contas suspensas fica para revisão manual do gestor.
UPDATE public.alunos a
SET data_renovacao_ultima = NOW(),
    ano_letivo_renovacao = public.fn_current_academic_year(CURRENT_DATE)
WHERE (a.ano_letivo_renovacao IS DISTINCT FROM public.fn_current_academic_year(CURRENT_DATE));
