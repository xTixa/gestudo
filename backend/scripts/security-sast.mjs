import fs from 'fs';
import path from 'path';

const projectRoot = path.resolve(process.cwd());
const targetDir = path.join(projectRoot, 'src');

const checks = [
    {
        id: 'client-error-leak',
        pattern:
            /res\.status\(500\)\.json\([\s\S]*?(error|detail)\s*:\s*(err|error)\.(message|stack)/g,
        message:
            'Resposta 500 está a expor detalhe técnico (error/detail com err.message/stack).',
    },
    {
        id: 'raw-stack-log',
        pattern: /console\.(error|warn)\([^\n]*stack[^\n]*\)/g,
        message:
            'Log com stack explícita detetado (potencial fuga em produção).',
    },
    {
        id: 'dangerous-eval',
        pattern: /\beval\(|new Function\(/g,
        message: 'Uso de eval/new Function detetado.',
    },
];

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walk(absolutePath));
            continue;
        }

        if (entry.isFile() && /\.(js|mjs|cjs|ts)$/.test(entry.name)) {
            files.push(absolutePath);
        }
    }

    return files;
}

const files = walk(targetDir);
const findings = [];

for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const check of checks) {
        const matches = [...content.matchAll(check.pattern)];
        for (const match of matches) {
            const before = content.slice(0, match.index);
            const line = before.split('\n').length;
            findings.push({
                file: path.relative(projectRoot, file).replace(/\\/g, '/'),
                line,
                check: check.id,
                message: check.message,
            });
        }
    }
}

if (findings.length > 0) {
    console.error('[security-sast] Foram encontrados potenciais riscos:');
    for (const finding of findings) {
        console.error(
            ` - ${finding.file}:${finding.line} [${finding.check}] ${finding.message}`
        );
    }
    process.exit(1);
}

console.log('[security-sast] Sem findings críticos nas regras atuais.');
