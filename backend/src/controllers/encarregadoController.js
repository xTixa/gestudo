import { db } from '../config/db.js';
import { registarUpdate } from '../services/logService.js';
import { buscarAtividadesPorDia } from './agendaController.js';
import { obterPresencasAlunoPorUserId } from './presencasController.js';
import { calcularContaCorrenteAluno } from './financeiroController.js';
import {
    listarEducandosDoEncarregado,
    obterEducandoDoEncarregado,
} from '../services/encarregadoService.js';

/**
 * ========================================
 * ÁREA DO ENCARREGADO DE EDUCAÇÃO
 * ========================================
 * O encarregado vê apenas os alunos (educandos) ligados à sua conta através
 * de encarregados.id_user → alunos.id_encarregado.
 * ========================================
 */

function toEducandoDto(row) {
    return {
        idAluno: row.id_aluno,
        nome: String(row.nome || 'Aluno').trim(),
        escola: row.escola || null,
        ano: row.ano ?? null,
        turma: row.turma || null,
        nivelEnsino: row.nivel_ensino || null,
        anoLetivo: row.ano_letivo_renovacao || null,
        parentesco: row.parentesco || null,
        ativo: row.status !== false,
        imagemPerfilUrl: row.imagem_perfil_url || null,
    };
}

/**
 * Middleware: garante que :idAluno é educando do encarregado autenticado e
 * guarda a linha em req.educando.
 */
export async function carregarEducando(req, res, next) {
    const idAluno = Number(req.params.idAluno);
    if (!Number.isInteger(idAluno) || idAluno <= 0) {
        return res.status(400).json({ message: 'Aluno inválido.' });
    }

    try {
        const educando = await obterEducandoDoEncarregado(req.userId, idAluno);

        if (!educando) {
            // 404 em vez de 403 para não revelar a existência do aluno.
            return res.status(404).json({ message: 'Educando não encontrado.' });
        }

        req.educando = educando;
        return next();
    } catch (error) {
        console.error('[encarregado] carregarEducando:', error.message);
        return res.status(500).json({ message: 'Erro ao validar o educando.' });
    }
}

const PERFIL_QUERY = `
    SELECT u.email, p.id_pessoa, p.nome, p.telemovel, p.telefone,
           p.morada, p.localidade, p.cod_postal
    FROM users u
    LEFT JOIN encarregados e ON e.id_user = u.id_user
    LEFT JOIN pessoas p ON p.id_pessoa = e.id_pessoa
    WHERE u.id_user = $1
    ORDER BY e.id_encarregado
    LIMIT 1
`;

function toPerfilDto(row = {}) {
    return {
        nome: row.nome || null,
        email: row.email || null,
        telemovel: row.telemovel || null,
        telefone: row.telefone || null,
        morada: row.morada || null,
        localidade: row.localidade || null,
        codPostal: row.cod_postal || null,
    };
}

export async function obterPerfilEncarregado(req, res) {
    try {
        const { rows } = await db.query(PERFIL_QUERY, [req.userId]);
        return res.json(toPerfilDto(rows[0]));
    } catch (error) {
        console.error('[encarregado] obterPerfil:', error.message);
        return res.status(500).json({ message: 'Erro ao obter o perfil.' });
    }
}

function textoOuNull(value) {
    const text = String(value ?? '').trim();
    return text || null;
}

/**
 * Atualiza os contactos do encarregado. Nome e email de login ficam a cargo
 * do centro (identificam a conta e o encarregado nas fichas dos alunos).
 */
export async function atualizarPerfilEncarregado(req, res) {
    const telemovel = String(req.body?.telemovel ?? '').replace(/\s/g, '');
    const telefone = String(req.body?.telefone ?? '').replace(/\s/g, '');
    const codPostal = textoOuNull(req.body?.codPostal);

    if (!/^\d{9}$/.test(telemovel)) {
        return res.status(400).json({ message: 'O telemóvel deve ter 9 dígitos.' });
    }
    if (telefone && !/^\d{9}$/.test(telefone)) {
        return res.status(400).json({ message: 'O telefone deve ter 9 dígitos.' });
    }
    if (codPostal && !/^\d{4}-\d{3}$/.test(codPostal)) {
        return res.status(400).json({ message: 'Código postal inválido (use 0000-000).' });
    }

    try {
        const { rows: antes } = await db.query(PERFIL_QUERY, [req.userId]);
        if (!antes[0]?.id_pessoa) {
            return res.status(404).json({ message: 'Perfil de encarregado não encontrado.' });
        }

        // Um encarregado pode ter vários registos (um por educando): atualiza
        // todas as pessoas associadas à conta.
        await db.query(
            `
                UPDATE pessoas p
                SET telemovel = $2,
                    telefone = $3,
                    morada = $4,
                    localidade = $5,
                    cod_postal = $6,
                    updated_at = now()
                FROM encarregados e
                WHERE e.id_user = $1 AND p.id_pessoa = e.id_pessoa
            `,
            [
                req.userId,
                telemovel,
                telefone || null,
                textoOuNull(req.body?.morada),
                textoOuNull(req.body?.localidade),
                codPostal,
            ]
        );

        const { rows: depois } = await db.query(PERFIL_QUERY, [req.userId]);

        try {
            await registarUpdate(
                req.userId,
                'pessoas',
                antes[0].id_pessoa,
                toPerfilDto(antes[0]),
                toPerfilDto(depois[0])
            );
        } catch {
            // O registo de auditoria não deve impedir a atualização.
        }

        return res.json({ message: 'Dados atualizados.', perfil: toPerfilDto(depois[0]) });
    } catch (error) {
        console.error('[encarregado] atualizarPerfil:', error.message);
        return res.status(500).json({ message: 'Erro ao atualizar o perfil.' });
    }
}

export async function listarEducandos(req, res) {
    try {
        const rows = await listarEducandosDoEncarregado(req.userId);
        return res.json({ educandos: rows.map(toEducandoDto) });
    } catch (error) {
        console.error('[encarregado] listarEducandos:', error.message);
        return res.status(500).json({ message: 'Erro ao listar educandos.' });
    }
}

export async function obterAgendaEducando(req, res) {
    try {
        const resultado = await buscarAtividadesPorDia(
            req.educando.id_user,
            String(req.query?.from || ''),
            String(req.query?.to || '')
        );
        return res.json(resultado);
    } catch (error) {
        console.error('[encarregado] agenda:', error.message);
        return res
            .status(error.status || 500)
            .json({ message: error.message || 'Erro ao obter a agenda.' });
    }
}

export async function obterPresencasEducando(req, res) {
    try {
        const payload = await obterPresencasAlunoPorUserId(req.educando.id_user);
        if (!payload) {
            return res.status(404).json({ message: 'Educando não encontrado.' });
        }
        return res.json(payload);
    } catch (error) {
        console.error('[encarregado] presencas:', error.message);
        return res.status(500).json({ message: 'Erro ao obter as presenças.' });
    }
}

export async function obterContaCorrenteEducando(req, res) {
    try {
        return res.json(await calcularContaCorrenteAluno(req.educando.id_aluno));
    } catch (error) {
        console.error('[encarregado] conta-corrente:', error.message);
        return res.status(500).json({ message: 'Erro ao obter os pagamentos.' });
    }
}
