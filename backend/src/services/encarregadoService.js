import { db } from '../config/db.js';

// Educandos de um encarregado: encarregados.id_user → alunos.id_encarregado.
const EDUCANDOS_QUERY = `
    SELECT
        a.id_aluno,
        a.id_user,
        p.nome,
        a.escola,
        a.ano,
        a.turma,
        a.nivel_ensino,
        a.ano_letivo_renovacao,
        e.parentesco,
        u.status,
        u.imagem_perfil_url
    FROM encarregados e
    INNER JOIN alunos a ON a.id_encarregado = e.id_encarregado
    INNER JOIN pessoas p ON p.id_pessoa = a.id_pessoa
    INNER JOIN users u ON u.id_user = a.id_user
    WHERE e.id_user = $1
`;

export async function listarEducandosDoEncarregado(userId) {
    const { rows } = await db.query(`${EDUCANDOS_QUERY} ORDER BY p.nome`, [userId]);
    return rows;
}

export async function obterEducandoDoEncarregado(userId, idAluno) {
    const { rows } = await db.query(`${EDUCANDOS_QUERY} AND a.id_aluno = $2 LIMIT 1`, [
        userId,
        idAluno,
    ]);
    return rows[0] || null;
}

export function primeiroNome(nome) {
    return String(nome || '').trim().split(/\s+/)[0] || 'Aluno';
}
