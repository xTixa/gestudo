import apoioEstudoImg from '../../assets/img/infos/apoioEstudo.jpg';
import explicacoesImg from '../../assets/img/infos/explicacoes.jpg';
import psicoImg from '../../assets/img/infos/psico.jpg';
import linguasImg from '../../assets/img/infos/linguas.jpg';
import informaticaImg from '../../assets/img/infos/informatica.jpg';
import examesImg from '../../assets/img/infos/exames.jpg';

export const SERVICES = [
    {
        slug: 'apoio-estudo',
        title: 'Apoio ao Estudo',
        image: apoioEstudoImg,
        shortDescription:
            'Acompanhamento regular para reforçar métodos de estudo, organização e autonomia.',
        description:
            'O Apoio ao Estudo é direcionado a alunos que necessitam de consolidar aprendizagens, melhorar a gestão do tempo e criar rotinas de trabalho eficazes.',
        highlights: [
            'Organização semanal',
            'Métodos de estudo',
            'Acompanhamento contínuo',
        ],
    },
    {
        slug: 'explicacoes',
        title: 'Explicações',
        image: explicacoesImg,
        shortDescription:
            'Sessões personalizadas por disciplina, com foco em dúvidas e preparação de avaliações.',
        description:
            'As Explicações são ajustadas ao ritmo e necessidades de cada aluno, promovendo compreensão sólida dos conteúdos e evolução consistente.',
        highlights: [
            'Plano individual',
            'Revisão de matéria',
            'Preparação para testes',
        ],
    },
    {
        slug: 'apoio-psicopedagogico',
        title: 'Apoio Psicopedagógico',
        image: psicoImg,
        shortDescription:
            'Intervenção especializada para apoiar motivação, atenção e estratégias de aprendizagem.',
        description:
            'O Apoio Psicopedagógico procura identificar dificuldades de aprendizagem e desenvolver estratégias que favoreçam o desempenho escolar e o bem-estar do aluno.',
        highlights: [
            'Avaliação de necessidades',
            'Estratégias de aprendizagem',
            'Acompanhamento orientado',
        ],
    },
    {
        slug: 'linguas',
        title: 'Línguas',
        image: linguasImg,
        shortDescription:
            'Aulas de línguas com abordagem prática para comunicação e sucesso académico.',
        description:
            'As sessões de Línguas trabalham compreensão, expressão e confiança do aluno, com exercícios adaptados ao nível e aos objetivos definidos.',
        highlights: [
            'Compreensão oral e escrita',
            'Expressão e comunicação',
            'Preparação escolar',
        ],
    },
    {
        slug: 'informatica',
        title: 'Cursos de Informática',
        image: informaticaImg,
        shortDescription:
            'Formação prática em competências digitais para estudo, trabalho e certificação.',
        description:
            'Os Cursos de Informática incluem conteúdos essenciais e aplicados, ajudando alunos e formandos a desenvolver competências tecnológicas úteis no dia a dia.',
        highlights: [
            'Competências digitais',
            'Formação prática',
            'Aplicação real',
        ],
    },
    {
        slug: 'exames',
        title: 'Preparação para Exames',
        image: examesImg,
        shortDescription:
            'Treino orientado para exame com revisão estruturada e gestão de tempo em prova.',
        description:
            'A Preparação para Exames combina revisão de conteúdos, resolução de exercícios e estratégias para maximizar o desempenho em contexto de avaliação.',
        highlights: [
            'Revisão intensiva',
            'Simulação de prova',
            'Estratégias de exame',
        ],
    },
];

export const SERVICE_BY_SLUG = Object.fromEntries(
    SERVICES.map((service) => [service.slug, service])
);
