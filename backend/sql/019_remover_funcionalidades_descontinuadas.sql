-- Remove as estruturas de funcionalidades descontinuadas:
-- pedidos de reagendamento, alterações pendentes de perfil e avisos de manutenção.
-- Idempotente: as migrações correm em cada arranque.

DROP VIEW IF EXISTS public.vw_pedidos_reagendamento_detalhe;
DROP TABLE IF EXISTS public.pedidos_reagendamento_professor;
DROP TABLE IF EXISTS public.alteracoes_pendentes_perfil;

DELETE FROM public.alertas_definicoes
WHERE codigo IN (
    'reagendamento-pendente',
    'reagendamento-decisao',
    'alteracao-perfil-pendente',
    'manutencao-sistema'
);

DELETE FROM public.email_templates
WHERE template_key = 'reschedule_decision';

DELETE FROM public.logs
WHERE entidade = 'manutencao_aviso';
