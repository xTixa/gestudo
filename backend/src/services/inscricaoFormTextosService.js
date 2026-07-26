import { db } from '../config/db.js';

export const DEFAULT_INSCRICAO_TEXTOS = {
    hero_eyebrow: {
        secao: 'Cabeçalho',
        label: 'Texto pequeno acima do título',
        value: 'Inscrições',
    },
    hero_title: {
        secao: 'Cabeçalho',
        label: 'Título principal da página',
        value: 'Formulário de Inscrição 2025/2026',
    },
    hero_subtitle: {
        secao: 'Cabeçalho',
        label: 'Subtítulo abaixo do título',
        value: 'Preencha os dados do aluno e do encarregado de educação.',
    },
    required_fields_note: {
        secao: 'Cabeçalho',
        label: 'Nota sobre campos obrigatórios',
        value: 'Os campos marcados com * são obrigatórios.',
    },

    section_aluno_heading: {
        secao: 'Dados do Aluno',
        label: 'Título da secção',
        value: 'Dados do Aluno',
    },
    label_data_inicio: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Data de Início',
        value: 'Data de Início',
    },
    label_nome_completo: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Nome Completo',
        value: 'Nome Completo',
    },
    label_data_nascimento: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Data de Nascimento',
        value: 'Data de Nascimento',
    },
    label_email_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Email',
        value: 'Email',
    },
    label_telemovel_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Telemóvel',
        value: 'Telemóvel',
    },
    label_telefone_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Telefone',
        value: 'Telefone',
    },
    label_cc: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Cartão de Cidadão',
        value: 'Cartão de Cidadão',
    },
    label_nif: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo NIF',
        value: 'NIF',
    },
    label_morada_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Morada',
        value: 'Morada',
    },
    label_localidade_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Localidade',
        value: 'Localidade',
    },
    label_codigo_postal_aluno: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Código Postal',
        value: 'Código Postal',
    },
    label_escola: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Escola',
        value: 'Escola',
    },
    label_nivel_ensino: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Nível de Ensino',
        value: 'Nível de Ensino',
    },
    label_ano_escolar: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Ano Escolar',
        value: 'Ano Escolar',
    },
    label_turma: {
        secao: 'Dados do Aluno',
        label: 'Rótulo do campo Turma',
        value: 'Turma',
    },
    placeholder_turma: {
        secao: 'Dados do Aluno',
        label: 'Texto de exemplo no campo Turma',
        value: 'Ex: B',
    },
    help_ensino_superior: {
        secao: 'Dados do Aluno',
        label: 'Texto de ajuda quando o nível é Ensino Superior',
        value: 'Ensino superior não usa ano escolar neste formulário.',
    },
    help_anos_nivel: {
        secao: 'Dados do Aluno',
        label: 'Texto de ajuda sobre os anos disponíveis',
        value: 'Anos apresentados conforme o nível selecionado.',
    },

    section_encarregado_heading: {
        secao: 'Encarregado de Educação',
        label: 'Título da secção',
        value: 'Encarregado de Educação',
    },
    label_ee_nome: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Nome',
        value: 'Nome',
    },
    label_ee_email: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Email',
        value: 'Email',
    },
    label_ee_telemovel: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Telemóvel',
        value: 'Telemóvel',
    },
    label_ee_morada: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Morada',
        value: 'Morada',
    },
    button_copiar_morada: {
        secao: 'Encarregado de Educação',
        label: 'Texto do botão "copiar morada do aluno"',
        value: 'Copiar morada do aluno',
    },
    label_ee_localidade: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Localidade',
        value: 'Localidade',
    },
    label_ee_codigo_postal: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Código Postal',
        value: 'Código Postal',
    },
    label_ee_parentesco: {
        secao: 'Encarregado de Educação',
        label: 'Rótulo do campo Parentesco',
        value: 'Parentesco',
    },
    placeholder_ee_parentesco: {
        secao: 'Encarregado de Educação',
        label: 'Texto de exemplo no campo Parentesco',
        value: 'Ex: Mãe, Pai, Tio, Avô',
    },

    section_plano_heading: {
        secao: 'Plano',
        label: 'Título da secção',
        value: 'Plano',
    },
    section_plano_descricao: {
        secao: 'Plano',
        label: 'Texto explicativo da secção',
        value: 'Pode inscrever-se em mais do que uma disciplina. Cada disciplina tem o seu próprio tipo de serviço, modalidade e horas pretendidas.',
    },
    label_disciplina: {
        secao: 'Plano',
        label: 'Palavra usada para "Disciplina" (título de cada bloco e rótulo do campo)',
        value: 'Disciplina',
    },
    button_remover: {
        secao: 'Plano',
        label: 'Texto do botão para remover uma disciplina do plano',
        value: 'Remover',
    },
    help_sem_disciplinas: {
        secao: 'Plano',
        label: 'Aviso quando não há disciplinas disponíveis para o nível',
        value: 'Sem disciplinas para este nível.',
    },
    label_tipo_servico: {
        secao: 'Plano',
        label: 'Rótulo do campo Tipo de Serviço',
        value: 'Tipo de Serviço',
    },
    label_modalidade: {
        secao: 'Plano',
        label: 'Rótulo do campo Modalidade',
        value: 'Modalidade',
    },
    label_pacote: {
        secao: 'Plano',
        label: 'Rótulo do campo Horas Pretendidas',
        value: 'Horas Pretendidas',
    },
    help_pacote_sem_modalidade: {
        secao: 'Plano',
        label: 'Texto de ajuda antes de escolher a modalidade',
        value: 'Selecione primeiro a modalidade para escolher as horas pretendidas.',
    },
    text_pacotes_individual: {
        secao: 'Plano',
        label: 'Texto quando a modalidade é individual (sem horas pretendidas)',
        value: 'Horas pretendidas não aplicáveis para explicação individual.',
    },
    button_adicionar_disciplina: {
        secao: 'Plano',
        label: 'Texto do botão para adicionar outra disciplina',
        value: '+ Adicionar outra disciplina',
    },
    label_observacoes: {
        secao: 'Plano',
        label: 'Rótulo do campo Observações',
        value: 'Observações',
    },
    placeholder_observacoes: {
        secao: 'Plano',
        label: 'Texto de exemplo no campo Observações',
        value: 'Informações relevantes sobre o aluno, objetivos ou disponibilidade.',
    },

    section_autorizacao_heading: {
        secao: 'Autorização de Saída',
        label: 'Título da secção',
        value: 'Autorização de Saída',
    },
    section_autorizacao_descricao: {
        secao: 'Autorização de Saída',
        label: 'Texto explicativo da secção',
        value: 'Indique as pessoas autorizadas com que o aluno pode sair no final das atividades.',
    },
    label_aut_nome_1: {
        secao: 'Autorização de Saída',
        label: 'Rótulo do campo Nome (1)',
        value: 'Nome (1)',
    },
    label_aut_parentesco_1: {
        secao: 'Autorização de Saída',
        label: 'Rótulo do campo Parentesco (1)',
        value: 'Parentesco (1)',
    },
    label_aut_nome_2: {
        secao: 'Autorização de Saída',
        label: 'Rótulo do campo Nome (2)',
        value: 'Nome (2)',
    },
    label_aut_parentesco_2: {
        secao: 'Autorização de Saída',
        label: 'Rótulo do campo Parentesco (2)',
        value: 'Parentesco (2)',
    },
    consent_dados_texto: {
        secao: 'Autorização de Saída',
        label: 'Texto do consentimento de utilização de dados',
        value: 'Consinto a utilização dos dados para procedimentos de gestão e comunicação interna, incluindo contacto telefónico, SMS, email e correspondência postal.',
    },

    button_enviar: {
        secao: 'Botões e Mensagens',
        label: 'Texto do botão de submissão do formulário',
        value: 'Enviar Inscrição',
    },
    mensagem_sucesso: {
        secao: 'Botões e Mensagens',
        label: 'Mensagem apresentada após envio com sucesso',
        value: 'Inscrição enviada com sucesso. Aguarde a confirmação por parte do administrador.',
    },
};

function rowToTexto(row) {
    return {
        key: row.text_key,
        secao: row.secao,
        label: row.label,
        value: row.value,
        updatedAt: row.updated_at || null,
        updatedBy: row.updated_by || null,
    };
}

export async function ensureDefaultInscricaoTextos() {
    const query = `
        INSERT INTO inscricao_form_textos (text_key, secao, label, value)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (text_key) DO NOTHING
    `;

    for (const [key, defaults] of Object.entries(DEFAULT_INSCRICAO_TEXTOS)) {
        await db.query(query, [
            key,
            defaults.secao,
            defaults.label,
            defaults.value,
        ]);
    }
}

export async function listInscricaoTextos() {
    await ensureDefaultInscricaoTextos();

    const { rows } = await db.query(`
        SELECT *
        FROM inscricao_form_textos
        ORDER BY secao ASC, text_key ASC
    `);

    return rows.map(rowToTexto);
}

export async function getInscricaoTextosMap() {
    try {
        const textos = await listInscricaoTextos();
        return Object.fromEntries(textos.map((item) => [item.key, item.value]));
    } catch (error) {
        console.warn(
            '[inscricaoFormTextosService] A usar textos default:',
            error.message
        );
        return Object.fromEntries(
            Object.entries(DEFAULT_INSCRICAO_TEXTOS).map(([key, item]) => [
                key,
                item.value,
            ])
        );
    }
}

export async function updateInscricaoTextos(updates, updatedBy) {
    const entries = Object.entries(updates || {});
    const invalidKeys = entries
        .map(([key]) => key)
        .filter((key) => !DEFAULT_INSCRICAO_TEXTOS[key]);

    if (invalidKeys.length) {
        const error = new Error(
            `Chave(s) desconhecida(s): ${invalidKeys.join(', ')}`
        );
        error.status = 400;
        throw error;
    }

    for (const [key, value] of entries) {
        if (!String(value ?? '').trim()) {
            const error = new Error(
                `O texto "${DEFAULT_INSCRICAO_TEXTOS[key].label}" não pode ficar vazio.`
            );
            error.status = 400;
            throw error;
        }
    }

    await ensureDefaultInscricaoTextos();

    for (const [key, value] of entries) {
        await db.query(
            `
                UPDATE inscricao_form_textos
                SET value = $2,
                    updated_by = $3,
                    updated_at = now()
                WHERE text_key = $1
            `,
            [key, String(value).trim(), updatedBy || null]
        );
    }

    return listInscricaoTextos();
}

export async function resetInscricaoTexto(key, updatedBy) {
    const defaults = DEFAULT_INSCRICAO_TEXTOS[key];
    if (!defaults) {
        return null;
    }

    await ensureDefaultInscricaoTextos();

    const { rows } = await db.query(
        `
            UPDATE inscricao_form_textos
            SET value = $2,
                updated_by = $3,
                updated_at = now()
            WHERE text_key = $1
            RETURNING *
        `,
        [key, defaults.value, updatedBy || null]
    );

    return rows[0] ? rowToTexto(rows[0]) : null;
}
