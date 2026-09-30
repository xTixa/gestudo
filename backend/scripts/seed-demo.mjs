/**
 * Dados de demonstração: professores, encarregados, alunos (com irmãos),
 * serviços com horário, inscrições, presenças, mensalidades e pagamentos.
 *
 *   node scripts/seed-demo.mjs            insere (recusa se já existirem dados demo)
 *   node scripts/seed-demo.mjs --reset    remove os dados demo e volta a inserir
 *   node scripts/seed-demo.mjs --remove   só remove os dados demo
 *   (qualquer uma com --dry-run corre tudo e desfaz no fim, sem gravar)
 *
 * Todas as contas criadas usam emails @demo.gestudo.test — é isso que permite
 * remover apenas estes dados. Os catálogos (níveis, disciplinas, salas,
 * modalidades, pacotes) são reutilizados se já existirem e não são removidos.
 * Insere diretamente na BD: não envia emails nem notificações.
 */
import '../src/loadEnv.js';
import bcrypt from 'bcryptjs';
import { db } from '../src/config/db.js';

const DEMO_DOMAIN = 'demo.gestudo.test';
const DEMO_PASSWORD = 'Demo2026!';
const ANO_LETIVO = '2026/2027';
const INICIO_AULAS = '2026-09-14';
const FIM_SERVICOS = '2027-06-30';

const args = new Set(process.argv.slice(2));

if (String(process.env.NODE_ENV || '').trim() === 'production' && !args.has('--force')) {
    console.error('Recusado: NODE_ENV=production. Use --force se tiver mesmo a certeza.');
    process.exit(1);
}

// ── Utilitários ────────────────────────────────────────────────────────────

// PRNG determinístico: os mesmos dados em cada execução.
function mulberry32(seed) {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const random = mulberry32(2026);

function slug(nome) {
    return nome
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .split(/\s+/)
        .filter((_, i, parts) => i === 0 || i === parts.length - 1)
        .join('.');
}

// NIF português com dígito de controlo válido (prefixo 2 = pessoa singular).
function gerarNif(seq) {
    const base = `29${String(seq).padStart(6, '0')}`;
    const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (9 - i), 0);
    const resto = soma % 11;
    const controlo = resto < 2 ? 0 : 11 - resto;
    return `${base}${controlo}`;
}

function toKey(date) {
    return date.toISOString().slice(0, 10);
}

const DIA_INDEX = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };

// ── Dados ──────────────────────────────────────────────────────────────────

const NIVEIS = ['1º Ciclo', '2º Ciclo', '3º Ciclo', 'Secundário'];

const SALAS = [
    { nome: 'Sala 1', capacidade: 6 },
    { nome: 'Sala 2', capacidade: 6 },
    { nome: 'Sala 3', capacidade: 8 },
    { nome: 'Sala de Estudo', capacidade: 12 },
];

const PROFESSORES = [
    { key: 'ana', nome: 'Ana Ribeiro', habilitacao: 'Mestrado', area: 'Matemática', nivel: '3º Ciclo e Secundário', cor: '#0891B2' },
    { key: 'rui', nome: 'Rui Carvalho', habilitacao: 'Licenciatura', area: 'Físico-Química', nivel: '3º Ciclo e Secundário', cor: '#EA580C' },
    { key: 'sofia', nome: 'Sofia Lopes', habilitacao: 'Mestrado', area: 'Português', nivel: '3º Ciclo e Secundário', cor: '#7C3AED' },
    { key: 'pedro', nome: 'Pedro Nunes', habilitacao: 'Licenciatura', area: 'Inglês', nivel: '3º Ciclo e Secundário', cor: '#16A34A' },
    { key: 'marta', nome: 'Marta Pinto', habilitacao: 'Doutoramento', area: 'Biologia e Geologia', nivel: 'Secundário', cor: '#DB2777' },
    { key: 'carla', nome: 'Carla Mendes', habilitacao: 'Licenciatura', area: 'Ensino Básico', nivel: '1º e 2º Ciclo', cor: '#CA8A04' },
];

// modalidade: G = Grupo, I = Individual. preco = mensal.
const SERVICOS = [
    { key: 'S1', disc: 'Matemática', nivel: '3º Ciclo', mod: 'G', prof: 'ana', sala: 'Sala 2', dia: 'segunda', ini: '17:00', fim: '18:00', preco: 45 },
    { key: 'S2', disc: 'Matemática', nivel: '3º Ciclo', mod: 'G', prof: 'ana', sala: 'Sala 2', dia: 'quarta', ini: '18:00', fim: '19:00', preco: 45 },
    { key: 'S3', disc: 'Matemática', nivel: 'Secundário', mod: 'G', prof: 'rui', sala: 'Sala 3', dia: 'terca', ini: '18:00', fim: '19:30', preco: 60 },
    { key: 'S4', disc: 'Físico-Química', nivel: 'Secundário', mod: 'G', prof: 'rui', sala: 'Sala 3', dia: 'quinta', ini: '18:00', fim: '19:30', preco: 60 },
    { key: 'S5', disc: 'Físico-Química', nivel: '3º Ciclo', mod: 'G', prof: 'rui', sala: 'Sala 2', dia: 'terca', ini: '17:00', fim: '18:00', preco: 45 },
    { key: 'S6', disc: 'Português', nivel: '3º Ciclo', mod: 'G', prof: 'sofia', sala: 'Sala 3', dia: 'segunda', ini: '18:00', fim: '19:00', preco: 45 },
    { key: 'S7', disc: 'Português', nivel: 'Secundário', mod: 'G', prof: 'sofia', sala: 'Sala 3', dia: 'quarta', ini: '17:00', fim: '18:30', preco: 60 },
    { key: 'S8', disc: 'Inglês', nivel: '3º Ciclo', mod: 'G', prof: 'pedro', sala: 'Sala 2', dia: 'quinta', ini: '17:00', fim: '18:00', preco: 45 },
    { key: 'S9', disc: 'Inglês', nivel: 'Secundário', mod: 'G', prof: 'pedro', sala: 'Sala 2', dia: 'sexta', ini: '17:00', fim: '18:00', preco: 45 },
    { key: 'S10', disc: 'Biologia e Geologia', nivel: 'Secundário', mod: 'G', prof: 'marta', sala: 'Sala de Estudo', dia: 'segunda', ini: '17:00', fim: '18:30', preco: 60 },
    { key: 'S11', disc: 'Apoio ao Estudo', nivel: '1º Ciclo', mod: 'G', prof: 'carla', sala: 'Sala de Estudo', dia: 'terca', ini: '15:30', fim: '17:00', preco: 55 },
    { key: 'S12', disc: 'Apoio ao Estudo', nivel: '1º Ciclo', mod: 'G', prof: 'carla', sala: 'Sala de Estudo', dia: 'quinta', ini: '15:30', fim: '17:00', preco: 55 },
    { key: 'S13', disc: 'Matemática', nivel: '2º Ciclo', mod: 'G', prof: 'carla', sala: 'Sala 2', dia: 'quarta', ini: '15:30', fim: '16:30', preco: 40 },
    { key: 'S14', disc: 'Português', nivel: '2º Ciclo', mod: 'G', prof: 'carla', sala: 'Sala 2', dia: 'sexta', ini: '15:30', fim: '16:30', preco: 40 },
    { key: 'S15', disc: 'Matemática', nivel: 'Secundário', mod: 'I', prof: 'ana', sala: 'Sala 1', dia: 'sexta', ini: '18:00', fim: '19:00', preco: 90 },
    { key: 'S16', disc: 'Físico-Química', nivel: 'Secundário', mod: 'I', prof: 'rui', sala: 'Sala 1', dia: 'segunda', ini: '19:00', fim: '20:00', preco: 90 },
];

const ESCOLAS = {
    '1º Ciclo': 'EB Grão Vasco',
    '2º Ciclo': 'EB Infante D. Henrique',
    '3º Ciclo': 'EB Infante D. Henrique',
    Secundário: 'Escola Secundária Alves Martins',
};

// Famílias: um encarregado e os seus educandos (irmãos partilham o encarregado).
const FAMILIAS = [
    { ee: 'Helena Marques', parentesco: 'Mãe', filhos: [
        { nome: 'Tomás Marques', ano: 9, nivel: '3º Ciclo', servicos: ['S1', 'S6', 'S8'] },
        { nome: 'Inês Marques', ano: 6, nivel: '2º Ciclo', servicos: ['S13', 'S14'] },
    ] },
    { ee: 'João Ferreira', parentesco: 'Pai', filhos: [
        { nome: 'Beatriz Ferreira', ano: 11, nivel: 'Secundário', servicos: ['S3', 'S4', 'S10'] },
        { nome: 'Diogo Ferreira', ano: 8, nivel: '3º Ciclo', servicos: ['S2', 'S5'] },
    ] },
    { ee: 'Cristina Almeida', parentesco: 'Mãe', filhos: [
        { nome: 'Leonor Almeida', ano: 12, nivel: 'Secundário', servicos: ['S15', 'S16', 'S7'] },
        { nome: 'Martim Almeida', ano: 10, nivel: 'Secundário', servicos: ['S3', 'S9'] },
        { nome: 'Carolina Almeida', ano: 3, nivel: '1º Ciclo', servicos: ['S11', 'S12'] },
    ] },
    { ee: 'Paulo Santos', parentesco: 'Pai', filhos: [
        { nome: 'Rodrigo Santos', ano: 9, nivel: '3º Ciclo', servicos: ['S1', 'S5', 'S8'] },
    ] },
    { ee: 'Rosa Oliveira', parentesco: 'Avó', filhos: [
        { nome: 'Matilde Oliveira', ano: 7, nivel: '3º Ciclo', servicos: ['S2', 'S6'] },
    ] },
    { ee: 'Nuno Costa', parentesco: 'Pai', filhos: [
        { nome: 'Gonçalo Costa', ano: 11, nivel: 'Secundário', servicos: ['S3', 'S4'] },
    ] },
    { ee: 'Ana Rita Sousa', parentesco: 'Mãe', filhos: [
        { nome: 'Mariana Sousa', ano: 10, nivel: 'Secundário', servicos: ['S7', 'S9', 'S10'] },
        { nome: 'Francisco Sousa', ano: 5, nivel: '2º Ciclo', servicos: ['S13'] },
    ] },
    { ee: 'Luís Gomes', parentesco: 'Pai', filhos: [
        { nome: 'Afonso Gomes', ano: 4, nivel: '1º Ciclo', servicos: ['S11'] },
    ] },
    { ee: 'Sandra Pereira', parentesco: 'Mãe', filhos: [
        { nome: 'Clara Pereira', ano: 12, nivel: 'Secundário', servicos: ['S3', 'S7'] },
    ] },
    { ee: 'Miguel Rodrigues', parentesco: 'Pai', filhos: [
        { nome: 'Duarte Rodrigues', ano: 8, nivel: '3º Ciclo', servicos: ['S2', 'S8', 'S5'] },
    ] },
    { ee: 'Teresa Martins', parentesco: 'Mãe', filhos: [
        { nome: 'Laura Martins', ano: 9, nivel: '3º Ciclo', servicos: ['S1', 'S6'] },
    ] },
];

const RUAS = ['Rua Direita', 'Av. Alberto Sampaio', 'Rua do Comércio', 'Rua Formosa', 'Av. da Europa', 'Rua da Paz', 'Rua Serpa Pinto'];
const LOCALIDADES = [['Viseu', '3500'], ['Viseu', '3510'], ['Mangualde', '3530'], ['Tondela', '3460'], ['São Pedro do Sul', '3660']];
const METODOS = ['mbway', 'transferencia', 'multibanco', 'numerario'];

// ── Remoção ────────────────────────────────────────────────────────────────

async function removerDemo(client) {
    const { rows: users } = await client.query(
        `SELECT id_user FROM users WHERE email LIKE $1`,
        [`%@${DEMO_DOMAIN}`]
    );
    const userIds = users.map((u) => u.id_user);
    if (!userIds.length) return 0;

    const ids = async (sql) => (await client.query(sql, [userIds])).rows.map((r) => Object.values(r)[0]);
    const alunoIds = await ids(`SELECT id_aluno FROM alunos WHERE id_user = ANY($1)`);
    const profIds = await ids(`SELECT id_professor FROM professores WHERE id_user = ANY($1)`);
    const pessoaIds = await ids(`
        SELECT id_pessoa FROM alunos WHERE id_user = ANY($1)
        UNION SELECT id_pessoa FROM encarregados WHERE id_user = ANY($1)
        UNION SELECT id_pessoa FROM professores WHERE id_user = ANY($1)`);
    const servicoIds = (
        await client.query(`SELECT id_servico FROM servicos_curriculares WHERE id_professor = ANY($1)`, [profIds])
    ).rows.map((r) => r.id_servico);

    await client.query(
        `DELETE FROM pagamentos WHERE id_mensalidade IN (SELECT id_mensalidade FROM mensalidades WHERE id_aluno = ANY($1))`,
        [alunoIds]
    );
    await client.query(`DELETE FROM mensalidades WHERE id_aluno = ANY($1)`, [alunoIds]);
    await client.query(`DELETE FROM inscricoes WHERE id_aluno = ANY($1) OR id_servico_curricular = ANY($2)`, [alunoIds, servicoIds]);
    await client.query(`DELETE FROM presencas WHERE id_aluno = ANY($1) OR id_servico = ANY($2)`, [alunoIds, servicoIds]);
    await client.query(`DELETE FROM servicos_curriculares WHERE id_servico = ANY($1)`, [servicoIds]);
    await client.query(`DELETE FROM pagamentos_professores WHERE id_professor = ANY($1)`, [profIds]);
    await client.query(`DELETE FROM alunos WHERE id_aluno = ANY($1)`, [alunoIds]);
    await client.query(`DELETE FROM encarregados WHERE id_user = ANY($1)`, [userIds]);
    await client.query(`DELETE FROM professores WHERE id_professor = ANY($1)`, [profIds]);
    await client.query(`DELETE FROM users WHERE id_user = ANY($1)`, [userIds]);
    await client.query(`DELETE FROM pessoas WHERE id_pessoa = ANY($1)`, [pessoaIds]);
    return userIds.length;
}

// ── Inserção ───────────────────────────────────────────────────────────────

async function getOrCreate(client, selectSql, selectParams, insertSql, insertParams) {
    const found = await client.query(selectSql, selectParams);
    if (found.rows.length) return Object.values(found.rows[0])[0];
    const created = await client.query(insertSql, insertParams);
    return Object.values(created.rows[0])[0];
}

async function inserirDemo(client) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    let seqPessoa = 0;
    const usedEmails = new Set();

    async function criarPessoa(nome, dataNasc) {
        seqPessoa += 1;
        const [localidade, cp4] = LOCALIDADES[seqPessoa % LOCALIDADES.length];
        const { rows } = await client.query(
            `INSERT INTO pessoas (nome, data_nasc, cc, nif, morada, localidade, cod_postal, telemovel)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_pessoa`,
            [
                nome,
                dataNasc,
                `DEMO${String(seqPessoa).padStart(6, '0')}`,
                gerarNif(seqPessoa),
                `${RUAS[seqPessoa % RUAS.length]}, ${10 + ((seqPessoa * 7) % 180)}`,
                localidade,
                `${cp4}-${String(100 + seqPessoa * 13).slice(-3)}`,
                `91${String(2000000 + seqPessoa * 7919).slice(-7)}`,
            ]
        );
        return rows[0].id_pessoa;
    }

    async function criarUser(nome, role) {
        let email = `${slug(nome)}@${DEMO_DOMAIN}`;
        for (let n = 2; usedEmails.has(email); n += 1) email = `${slug(nome)}${n}@${DEMO_DOMAIN}`;
        usedEmails.add(email);
        const { rows } = await client.query(
            `INSERT INTO users (email, password, role, status, primeira_login)
             VALUES ($1, $2, $3, true, false) RETURNING id_user`,
            [email, passwordHash, role]
        );
        return { idUser: rows[0].id_user, email };
    }

    // Catálogos (reutiliza o que já existe)
    const nivelId = {};
    for (const nome of NIVEIS) {
        nivelId[nome] = await getOrCreate(
            client,
            `SELECT id_nivel FROM niveis_ensino WHERE nome = $1`, [nome],
            `INSERT INTO niveis_ensino (nome) VALUES ($1) RETURNING id_nivel`, [nome]
        );
    }
    const salaId = {};
    for (const sala of SALAS) {
        salaId[sala.nome] = await getOrCreate(
            client,
            `SELECT id_sala FROM salas WHERE nome = $1`, [sala.nome],
            `INSERT INTO salas (nome, capacidade) VALUES ($1, $2) RETURNING id_sala`, [sala.nome, sala.capacidade]
        );
    }
    const modId = {
        I: await getOrCreate(client,
            `SELECT id_modalidade FROM modalidades WHERE nome = 'Individual'`, [],
            `INSERT INTO modalidades (nome) VALUES ('Individual') RETURNING id_modalidade`, []),
        G: await getOrCreate(client,
            `SELECT id_modalidade FROM modalidades WHERE nome = 'Grupo'`, [],
            `INSERT INTO modalidades (nome, descricao) VALUES ('Grupo', 'Até 6 alunos') RETURNING id_modalidade`, []),
    };
    const tipoServicoId = await getOrCreate(client,
        `SELECT id_tiposervico FROM tipo_servico WHERE nome = 'Explicação'`, [],
        `INSERT INTO tipo_servico (nome) VALUES ('Explicação') RETURNING id_tiposervico`, []);

    const discId = {};
    for (const s of SERVICOS) {
        const k = `${s.disc}|${s.nivel}`;
        if (discId[k]) continue;
        discId[k] = await getOrCreate(client,
            `SELECT id_disciplina FROM disciplinas WHERE nome = $1 AND id_nivel = $2`, [s.disc, nivelId[s.nivel]],
            `INSERT INTO disciplinas (nome, id_nivel) VALUES ($1, $2) RETURNING id_disciplina`, [s.disc, nivelId[s.nivel]]);
    }

    // Professores
    const prof = {};
    for (const [i, p] of PROFESSORES.entries()) {
        const idPessoa = await criarPessoa(p.nome, `${1975 + i * 3}-0${1 + (i % 9)}-1${i}`);
        const { idUser, email } = await criarUser(p.nome, 'professor');
        const { rows } = await client.query(
            `INSERT INTO professores (id_user, id_pessoa, habilitacao, area_ensino, nivel, cor)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_professor`,
            [idUser, idPessoa, p.habilitacao, p.area, p.nivel, p.cor]
        );
        prof[p.key] = { idProfessor: rows[0].id_professor, idUser, email };
    }

    // Serviços e pacotes
    const servico = {};
    for (const s of SERVICOS) {
        const minutos = (Number(s.fim.slice(0, 2)) * 60 + Number(s.fim.slice(3))) - (Number(s.ini.slice(0, 2)) * 60 + Number(s.ini.slice(3)));
        const horasMes = Math.round((minutos / 60) * 4);
        const modNome = s.mod === 'G' ? 'Grupo' : 'Individual';
        const idDisc = discId[`${s.disc}|${s.nivel}`];
        const idPacote = await getOrCreate(client,
            `SELECT id_pacote FROM pacotes WHERE id_disciplina = $1 AND id_modalidade = $2 AND horas_mensais = $3 AND preco = $4`,
            [idDisc, modId[s.mod], horasMes, s.preco],
            `INSERT INTO pacotes (id_modalidade, nome, horas_mensais, preco, id_disciplina, id_tiposervico)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_pacote`,
            [modId[s.mod], `${s.disc} ${s.nivel} · ${modNome} ${horasMes}h`, horasMes, s.preco, idDisc, tipoServicoId]);

        const { rows } = await client.query(
            `INSERT INTO servicos_curriculares
                (id_professor, id_disciplina, id_modalidade, id_tiposervico, id_sala, tipo, ano_letivo,
                 data_inicio, data_fim, hora_inicio, hora_fim, capacidade_max, dias_semana, ativo)
             VALUES ($1, $2, $3, $4, $5, 'periodico', $6, $7, $8, $9, $10, $11, $12, true)
             RETURNING id_servico`,
            [
                prof[s.prof].idProfessor, idDisc, modId[s.mod], tipoServicoId, salaId[s.sala], ANO_LETIVO,
                INICIO_AULAS, FIM_SERVICOS, s.ini, s.fim, s.mod === 'G' ? 6 : 1,
                JSON.stringify([{ dia: s.dia, horaInicio: s.ini, horaFim: s.fim, duracao: String(minutos) }]),
            ]
        );
        servico[s.key] = { ...s, idServico: rows[0].id_servico, idPacote, profUserId: prof[s.prof].idUser };
    }

    // Famílias, alunos e inscrições
    const alunos = [];
    for (const [f, familia] of FAMILIAS.entries()) {
        const idPessoaEe = await criarPessoa(familia.ee, `${1972 + (f % 12)}-${String(1 + (f % 12)).padStart(2, '0')}-15`);
        const ee = await criarUser(familia.ee, 'encarregado');
        const { rows: eeRows } = await client.query(
            `INSERT INTO encarregados (id_user, id_pessoa, parentesco) VALUES ($1, $2, $3) RETURNING id_encarregado`,
            [ee.idUser, idPessoaEe, familia.parentesco]
        );
        const idEncarregado = eeRows[0].id_encarregado;

        for (const filho of familia.filhos) {
            // Ex.: 9.º ano em 2026/27 → nascido em 2012.
            const anoNasc = 2026 - (filho.ano + 5);
            const idPessoa = await criarPessoa(filho.nome, `${anoNasc}-${String(3 + (alunos.length % 9)).padStart(2, '0')}-${String(5 + (alunos.length % 20)).padStart(2, '0')}`);
            const user = await criarUser(filho.nome, 'aluno');
            const { rows } = await client.query(
                `INSERT INTO alunos
                    (id_user, id_pessoa, escola, ano, turma, id_encarregado, nivel_ensino, data_inicio,
                     ano_letivo_renovacao, data_renovacao_ultima, disciplinas_pretendidas)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), '[]'::jsonb) RETURNING id_aluno`,
                [user.idUser, idPessoa, ESCOLAS[filho.nivel], filho.ano, 'ABCD'[alunos.length % 4],
                 idEncarregado, filho.nivel, INICIO_AULAS, ANO_LETIVO]
            );
            const idAluno = rows[0].id_aluno;

            const inscricoes = [];
            for (const key of filho.servicos) {
                const s = servico[key];
                const { rows: insc } = await client.query(
                    `INSERT INTO inscricoes (id_aluno, id_pacote, id_servico_curricular, data_inscricao, estado, valor_final)
                     VALUES ($1, $2, $3, $4, 'ativa', $5) RETURNING id_inscricao`,
                    [idAluno, s.idPacote, s.idServico, '2026-09-08', s.preco]
                );
                inscricoes.push({ idInscricao: insc[0].id_inscricao, servico: s });
            }
            alunos.push({ idAluno, idEncarregado, nome: filho.nome, email: user.email, eeEmail: ee.email, inscricoes });
        }
    }

    // Presenças: aulas desde o início até ontem
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    let totalPresencas = 0;
    for (const aluno of alunos) {
        for (const { servico: s } of aluno.inscricoes) {
            for (let d = new Date(`${INICIO_AULAS}T12:00:00Z`); d <= ontem; d.setUTCDate(d.getUTCDate() + 1)) {
                if (d.getUTCDay() !== DIA_INDEX[s.dia]) continue;
                const r = random();
                const estado = r < 0.86 ? 'presente' : r < 0.94 ? 'falta' : 'justificada';
                await client.query(
                    `INSERT INTO presencas (id_servico, id_aluno, data_aula, hora_aula, estado, observacao, marcado_por)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [s.idServico, aluno.idAluno, toKey(d), s.ini, estado,
                     estado === 'justificada' ? 'Consulta médica (justificada pelo encarregado).' : null,
                     s.profUserId]
                );
                totalPresencas += 1;
            }
        }
    }

    // Mensalidades de setembro (vencida a 22/09) e outubro, com pagamentos
    const { rows: gestores } = await client.query(`SELECT id_user FROM users WHERE role = 'gestor' AND status = true ORDER BY id_user LIMIT 1`);
    const gestorId = gestores[0]?.id_user ?? null;
    const resumoPagamentos = { pagas: 0, parciais: 0, emAtraso: 0, outubroPagas: 0 };

    for (const [i, aluno] of alunos.entries()) {
        const total = aluno.inscricoes.reduce((sum, { servico: s }) => sum + s.preco, 0);
        for (const [mes, vencimento] of [['2026-09-01', '2026-09-22'], ['2026-10-01', '2026-10-08']]) {
            const { rows } = await client.query(
                `INSERT INTO mensalidades (id_aluno, id_encarregado, mes_referencia, data_vencimento, valor_total, criado_por)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_mensalidade`,
                [aluno.idAluno, aluno.idEncarregado, mes, vencimento, total, gestorId]
            );
            const idMensalidade = rows[0].id_mensalidade;
            for (const [ordem, { idInscricao, servico: s }] of aluno.inscricoes.entries()) {
                await client.query(
                    `INSERT INTO mensalidade_linhas (id_mensalidade, id_inscricao, descricao, valor, ordem)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [idMensalidade, idInscricao, `${s.disc} (${s.mod === 'G' ? 'Grupo' : 'Individual'})`, s.preco, ordem]
                );
            }

            let pago = 0;
            let dataPagamento = null;
            if (mes === '2026-09-01') {
                // 2 em atraso, 1 pagamento parcial, restantes pagas
                if (i === 3 || i === 9) {
                    resumoPagamentos.emAtraso += 1;
                } else if (i === 6) {
                    pago = Math.round(total / 2);
                    resumoPagamentos.parciais += 1;
                } else {
                    pago = total;
                    resumoPagamentos.pagas += 1;
                }
                dataPagamento = `2026-09-${String(15 + (i % 7)).padStart(2, '0')}`;
            } else if (i % 5 === 0) {
                pago = total;
                dataPagamento = '2026-09-26';
                resumoPagamentos.outubroPagas += 1;
            }

            if (pago > 0) {
                await client.query(
                    `INSERT INTO pagamentos (id_mensalidade, valor, data_pagamento, metodo, referencia, registado_por)
                     VALUES ($1, $2, $3, $4, $5, $6)`,
                    [idMensalidade, pago, dataPagamento, METODOS[i % METODOS.length],
                     METODOS[i % METODOS.length] === 'transferencia' ? `TRF-${1000 + i}` : null, gestorId]
                );
            }
        }
    }

    return { alunos, prof, totalPresencas, resumoPagamentos };
}

// ── Execução ───────────────────────────────────────────────────────────────

const client = await db.connect();
try {
    await client.query('BEGIN');

    const { rows } = await client.query(`SELECT COUNT(*)::int n FROM users WHERE email LIKE $1`, [`%@${DEMO_DOMAIN}`]);
    const existentes = rows[0].n;

    if (args.has('--remove') || args.has('--reset')) {
        const removidos = await removerDemo(client);
        console.log(`Removidas ${removidos} contas demo (e dados associados).`);
    } else if (existentes > 0) {
        throw new Error(`Já existem ${existentes} contas demo. Use --reset para as recriar ou --remove para as apagar.`);
    }

    if (!args.has('--remove')) {
        const { alunos, prof, totalPresencas, resumoPagamentos } = await inserirDemo(client);
        const familias = new Set(alunos.map((a) => a.eeEmail));
        console.log(`\nInseridos: ${Object.keys(prof).length} professores, ${familias.size} encarregados, ${alunos.length} alunos, ${SERVICOS.length} serviços, ${totalPresencas} presenças.`);
        console.log(`Mensalidades set.: ${resumoPagamentos.pagas} pagas, ${resumoPagamentos.parciais} parcial, ${resumoPagamentos.emAtraso} em atraso · out.: ${resumoPagamentos.outubroPagas} já pagas.`);
        console.log(`\nPassword de todas as contas demo: ${DEMO_PASSWORD}`);
        console.log('Exemplos de acesso:');
        console.log(`  professor   ${prof.ana.email}`);
        const tresIrmaos = alunos.filter((a) => a.eeEmail === alunos.find((x) => x.nome === 'Leonor Almeida').eeEmail);
        console.log(`  encarregado ${tresIrmaos[0].eeEmail}  (3 educandos)`);
        console.log(`  aluno       ${alunos[0].email}`);
    }

    if (args.has('--dry-run')) {
        await client.query('ROLLBACK');
        console.log('\n--dry-run: tudo correu bem, mas nada foi gravado.');
    } else {
        await client.query('COMMIT');
    }
} catch (error) {
    await client.query('ROLLBACK');
    console.error('\nNada foi gravado:', error.message);
    process.exitCode = 1;
} finally {
    client.release();
    await db.end();
}
