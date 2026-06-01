const baseUrl = process.env.SECURITY_TEST_BASE_URL || 'http://localhost:5000';

const checks = [
    {
        name: 'Health endpoint online',
        request: () => fetch(`${baseUrl}/api/health`),
        validate: (res) => res.status === 200,
        expected: '200',
    },
    {
        name: 'Busca exige autenticação',
        request: () => fetch(`${baseUrl}/api/busca?q=test`),
        validate: (res) => res.status === 401 || res.status === 403,
        expected: '401 ou 403',
    },
    {
        name: 'Alterar password sem sessão bloqueado',
        request: () =>
            fetch(`${baseUrl}/api/auth/alterar-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    passwordAtual: 'x',
                    passwordNova: '12345678',
                    passwordNovaConfirm: '12345678',
                }),
            }),
        validate: (res) => res.status === 401 || res.status === 403,
        expected: '401 ou 403',
    },
    {
        name: 'CORS bloqueia origem não permitida',
        request: () =>
            fetch(`${baseUrl}/api/health`, {
                headers: { Origin: 'https://attacker.example' },
            }),
        validate: (res) => res.status === 403,
        expected: '403',
    },
];

async function run() {
    const failures = [];

    for (const check of checks) {
        try {
            const res = await check.request();
            if (!check.validate(res)) {
                failures.push(
                    `${check.name}: esperado ${check.expected}, recebido ${res.status}`
                );
            }
        } catch (error) {
            failures.push(`${check.name}: erro de execução (${error.message})`);
        }
    }

    if (failures.length > 0) {
        console.error('[security-dast] Falhas encontradas:');
        failures.forEach((failure) => console.error(` - ${failure}`));
        process.exit(1);
    }

    console.log('[security-dast] Smoke tests de segurança passaram.');
}

run();
