import bcrypt from 'bcryptjs';
import { db } from '../config/db.js';
import { enviarEmailCredenciaisIniciais } from '../services/emailService.js';
import { registarInsert, registarUpdate, registarDelete } from '../services/logService.js';

function gerarPasswordTemporaria() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = hoje.getFullYear();
    return `Temp@${dia}${mes}${ano}`;
}

export async function listarGestores(req, res) {
    try {
        const { rows } = await db.query(`
            SELECT id_user, email, status, created_at
            FROM users
            WHERE role = 'gestor'
            ORDER BY created_at DESC
        `);
        return res.status(200).json(rows);
    } catch (error) {
        console.error('Erro ao listar gestores:', error.message);
        return res.status(500).json({ message: 'Erro ao listar gestores.' });
    }
}

export async function criarGestor(req, res) {
    const { email, nome } = req.body || {};

    const gestorEmail = String(email || '').trim().toLowerCase();
    const gestorNome = String(nome || '').trim();

    if (!gestorEmail) {
        return res.status(400).json({ message: 'Email é obrigatório.' });
    }

    try {
        const existingUser = await db.query(
            `SELECT id_user FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
            [gestorEmail]
        );

        if (existingUser.rows.length) {
            return res.status(400).json({ message: 'Já existe um utilizador com esse email.' });
        }

        const passwordTemporaria = gerarPasswordTemporaria();
        const passwordHash = await bcrypt.hash(passwordTemporaria, 10);

        const { rows } = await db.query(
            `INSERT INTO users (email, password, role, status, primeira_login)
             VALUES ($1, $2, 'gestor', true, true)
             RETURNING id_user, email, status, created_at`,
            [gestorEmail, passwordHash]
        );

        const novoGestor = rows[0];

        try {
            await enviarEmailCredenciaisIniciais(
                gestorNome || gestorEmail,
                gestorEmail,
                passwordTemporaria
            );
        } catch (emailErr) {
            console.warn('Aviso: não foi possível enviar email de credenciais:', emailErr.message);
        }

        try {
            await registarInsert(req.userId, 'users', { email: gestorEmail, role: 'gestor' }, novoGestor.id_user);
        } catch {}

        return res.status(201).json({
            message: 'Administrador criado com sucesso. As credenciais foram enviadas por email.',
            gestor: novoGestor,
        });
    } catch (error) {
        if (error?.code === '23505') {
            return res.status(400).json({ message: 'Já existe um utilizador com esse email.' });
        }
        console.error('Erro ao criar gestor:', error.message);
        return res.status(500).json({ message: 'Erro ao criar administrador.' });
    }
}

export async function alterarEstadoGestor(req, res) {
    const idUser = Number(req.params?.id);
    const { status } = req.body || {};

    if (!idUser || typeof status !== 'boolean') {
        return res.status(400).json({ message: 'ID e status são obrigatórios.' });
    }

    if (idUser === req.userId) {
        return res.status(400).json({ message: 'Não pode alterar o estado da sua própria conta.' });
    }

    try {
        const { rows } = await db.query(
            `UPDATE users SET status = $1
             WHERE id_user = $2 AND role = 'gestor'
             RETURNING id_user, email, status, created_at`,
            [status, idUser]
        );

        if (!rows.length) {
            return res.status(404).json({ message: 'Administrador não encontrado.' });
        }

        try {
            await registarUpdate(req.userId, 'users', idUser, {}, { status });
        } catch {}

        return res.status(200).json({
            message: `Conta ${status ? 'ativada' : 'desativada'} com sucesso.`,
            gestor: rows[0],
        });
    } catch (error) {
        console.error('Erro ao alterar estado do gestor:', error.message);
        return res.status(500).json({ message: 'Erro ao alterar estado do administrador.' });
    }
}

export async function removerGestor(req, res) {
    const idUser = Number(req.params?.id);

    if (!idUser) {
        return res.status(400).json({ message: 'ID é obrigatório.' });
    }

    if (idUser === req.userId) {
        return res.status(400).json({ message: 'Não pode remover a sua própria conta.' });
    }

    const client = await db.connect();

    try {
        await client.query('BEGIN');

        const { rows } = await client.query(
            `SELECT id_user, email FROM users WHERE id_user = $1 AND role = 'gestor'`,
            [idUser]
        );

        if (!rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: 'Administrador não encontrado.' });
        }

        await client.query(`DELETE FROM users WHERE id_user = $1`, [idUser]);

        await client.query('COMMIT');

        try {
            await registarDelete(req.userId, 'users', idUser, { email: rows[0].email, role: 'gestor' });
        } catch {}

        return res.status(200).json({
            message: 'Administrador removido com sucesso.',
            gestor: rows[0],
        });
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Erro ao remover gestor:', error.message);
        return res.status(500).json({ message: 'Erro ao remover administrador.' });
    } finally {
        client.release();
    }
}
