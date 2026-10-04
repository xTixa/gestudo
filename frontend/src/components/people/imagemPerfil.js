const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * URL da foto de perfil de um aluno ou professor (o campo pode estar na
 * pessoa ou no utilizador). Caminhos relativos são servidos pela API.
 */
export function resolverImagemPerfil(pessoa) {
    const raw =
        pessoa?.imagem_perfil_url ||
        pessoa?.pessoa?.imagem_perfil_url ||
        pessoa?.pessoa?.user?.imagem_perfil_url ||
        '';

    const value = String(raw || '').trim();
    if (!value) {
        return '';
    }

    if (/^https?:\/\//i.test(value)) {
        return value;
    }

    if (value.startsWith('/')) {
        return `${API_URL}${value}`;
    }

    return `${API_URL}/${value}`;
}
