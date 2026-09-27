// Pacotes comerciais do Gestudo apresentados na homepage.
// Preços em euros por mês, sem IVA. Valores provisórios — ajustar antes de publicar.

export const ANNUAL_MONTHS_CHARGED = 10; // anual = 12 meses pelo preço de 10

export const PLANS = [
    {
        key: 'basico',
        name: 'Básico',
        price: 29,
        tagline: 'Para quem está a começar a organizar o centro.',
        includesFrom: null,
        highlights: [
            'Até 40 alunos ativos',
            'Gestão de alunos e professores',
            'Agenda, salas e presenças',
            'Áreas do aluno e do professor',
        ],
    },
    {
        key: 'plus',
        name: 'Plus',
        price: 59,
        tagline: 'Para centros que querem captar e comunicar melhor.',
        includesFrom: 'Básico',
        highlights: [
            'Até 120 alunos ativos',
            'Inscrições online',
            'Notificações push',
            'Sincronização com Google, Outlook e Apple',
        ],
    },
    {
        key: 'profissional',
        name: 'Profissional',
        price: 99,
        tagline: 'A gestão completa do dia a dia, incluindo as contas.',
        includesFrom: 'Plus',
        featured: true,
        highlights: [
            'Até 300 alunos ativos',
            'Mensalidades e pagamentos',
            'Renovações online',
            'Relatórios e alertas',
        ],
    },
    {
        key: 'completo',
        name: 'Completo',
        price: 169,
        tagline: 'Para centros grandes ou com várias equipas de gestão.',
        includesFrom: 'Profissional',
        highlights: [
            'Alunos e gestores ilimitados',
            'Custos e tarifas de professores',
            'Registo de auditoria',
            'Suporte dedicado e formação',
        ],
    },
];

// Matriz de funcionalidades: `plans` indica o pacote a partir do qual está incluída,
// ou um valor por pacote (array com a mesma ordem de PLANS).
export const FEATURE_GROUPS = [
    {
        title: 'Limites',
        rows: [
            { label: 'Alunos ativos', values: ['40', '120', '300', 'Ilimitados'] },
            { label: 'Contas de gestor', values: ['1', '2', '5', 'Ilimitadas'] },
            { label: 'Professores', values: ['Ilimitados', 'Ilimitados', 'Ilimitados', 'Ilimitados'] },
        ],
    },
    {
        title: 'Pessoas e serviços',
        rows: [
            { label: 'Gestão de alunos e professores', from: 'basico' },
            { label: 'Serviços curriculares e extracurriculares', from: 'basico' },
            { label: 'Disciplinas, modalidades, pacotes e salas', from: 'basico' },
            { label: 'Área do aluno e área do professor', from: 'basico' },
            { label: 'Exportação de fichas em PDF e Excel', from: 'plus' },
        ],
    },
    {
        title: 'Agenda e presenças',
        rows: [
            { label: 'Agenda do centro e gestão de salas', from: 'basico' },
            { label: 'Registo de presenças', from: 'basico' },
            { label: 'Assiduidade e horas dos professores', from: 'plus' },
            { label: 'Sincronização de calendário', from: 'plus' },
        ],
    },
    {
        title: 'Inscrições',
        rows: [
            { label: 'Formulário de inscrição online', from: 'plus' },
            { label: 'Reinscrição e renovações online', from: 'profissional' },
            { label: 'Textos do formulário personalizáveis', from: 'profissional' },
        ],
    },
    {
        title: 'Financeiro',
        rows: [
            { label: 'Mensalidades geradas automaticamente', from: 'profissional' },
            { label: 'Registo de pagamentos e conta-corrente', from: 'profissional' },
            { label: 'Custos e tarifas de professores', from: 'completo' },
        ],
    },
    {
        title: 'Comunicação',
        rows: [
            { label: 'Notificações na plataforma', from: 'basico' },
            { label: 'Notificações push', from: 'plus' },
            { label: 'Alertas configuráveis', from: 'profissional' },
            { label: 'Modelos de email personalizáveis', from: 'completo' },
        ],
    },
    {
        title: 'Gestão e segurança',
        rows: [
            { label: 'Dashboard com métricas', from: 'basico' },
            { label: 'Relatórios exportáveis', from: 'profissional' },
            { label: 'Registo de auditoria', from: 'completo' },
        ],
    },
    {
        title: 'Suporte',
        rows: [
            { label: 'Suporte', values: ['Email', 'Email', 'Prioritário', 'Dedicado'] },
            { label: 'Migração de dados existentes', from: 'profissional' },
            { label: 'Sessão de formação da equipa', from: 'completo' },
        ],
    },
];

export function planIncludes(row, planIndex) {
    if (row.values) return row.values[planIndex];
    const fromIndex = PLANS.findIndex((plan) => plan.key === row.from);
    return planIndex >= fromIndex;
}
