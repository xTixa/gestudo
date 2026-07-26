import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('pt-PT');
}

function formatCurrency(value) {
    if (value == null || value === '') return '-';
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return String(value);
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(numeric);
}

function parseTimeToMinutes(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})/);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}

function formatDurationLabel(horaInicio, horaFim) {
    const inicio = parseTimeToMinutes(horaInicio);
    const fim = parseTimeToMinutes(horaFim);
    if (inicio == null || fim == null || fim <= inicio) return '-';
    const totalMinutes = fim - inicio;
    const horas = Math.floor(totalMinutes / 60);
    const minutos = totalMinutes % 60;
    if (minutos === 0) return `${horas}h`;
    return `${horas}h${String(minutos).padStart(2, '0')}`;
}

function formatNivelEnsino(value) {
    const raw = String(value || '').trim();
    if (!raw) return '-';
    const map = {
        '1_ciclo': '1º Ciclo',
        '2_ciclo': '2º Ciclo',
        '3_ciclo': '3º Ciclo',
        secundario: 'Secundário',
        ensino_superior: 'Ensino Superior',
    };
    const key = raw.toLowerCase().replace(/\s+/g, '_');
    return map[key] || raw.replace(/_/g, ' ');
}

function addSectionTable(doc, startY, title, rows, head = ['Campo', 'Valor']) {
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 14, startY);

    autoTable(doc, {
        startY: startY + 4,
        head: [head],
        body: rows,
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [59, 130, 246], textColor: 255 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 70 } },
    });

    return doc.lastAutoTable.finalY + 12;
}

function ensureSpace(doc, nextY, minSpace = 40) {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (nextY + minSpace > pageHeight) {
        doc.addPage();
        return 20;
    }
    return nextY;
}

/**
 * Gera e descarrega o PDF completo da ficha de aluno, com as mesmas secções
 * apresentadas na página online (dados pessoais, escolares, serviços
 * subscritos, encarregado de educação, autorização de saída e observações).
 *
 * @param {object} aluno - objeto no formato devolvido por GET /api/gestor/alunos/:id
 */
export function gerarFichaAlunoPdf(aluno) {
    const doc = new jsPDF();
    const dateLabel = new Date().toLocaleDateString('pt-PT');

    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('Ficha de Aluno', 14, 18);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Gerado em ${dateLabel}`, 14, 25);
    doc.setTextColor(0, 0, 0);

    let y = 34;

    y = addSectionTable(doc, y, 'Dados Pessoais', [
        ['Nome Completo', aluno.pessoa?.nome || '-'],
        ['Data de Nascimento', formatDate(aluno.pessoa?.data_nasc)],
        ['Cartão de Cidadão', aluno.pessoa?.cc || '-'],
        ['NIF', aluno.pessoa?.nif || '-'],
        ['Email', aluno.pessoa?.user?.email || '-'],
        ['Morada', aluno.pessoa?.morada || '-'],
        ['Localidade', aluno.pessoa?.localidade || '-'],
        ['Código Postal', aluno.pessoa?.cod_postal || '-'],
        ['Telemóvel', aluno.pessoa?.telemovel || '-'],
        ['Telefone', aluno.pessoa?.telefone || '-'],
    ]);

    y = ensureSpace(doc, y);
    y = addSectionTable(doc, y, 'Dados Escolares', [
        ['Escola', aluno.escola || '-'],
        ['Ano', aluno.ano ? `${aluno.ano}º` : '-'],
        ['Turma', aluno.turma || '-'],
        ['Nível de Ensino', formatNivelEnsino(aluno.nivel_ensino)],
        ['Data de Início', formatDate(aluno.data_inicio)],
    ]);

    const servicosSubscritos = Array.isArray(aluno.servicosSubscritos)
        ? aluno.servicosSubscritos
        : [];
    const disciplinasPretendidas = Array.isArray(aluno.disciplinasPretendidas)
        ? aluno.disciplinasPretendidas
        : [];

    if (disciplinasPretendidas.length > 0) {
        const disciplinasComServico = new Set(
            servicosSubscritos
                .map((servico) => String(servico.disciplina || '').toLowerCase())
                .filter(Boolean)
        );

        y = ensureSpace(doc, y);
        y = addSectionTable(
            doc,
            y,
            'Disciplinas Pretendidas',
            disciplinasPretendidas.map((disciplina) => [
                disciplina,
                disciplinasComServico.has(disciplina.toLowerCase())
                    ? 'Com serviço associado'
                    : 'Sem serviço associado',
            ]),
            ['Disciplina', 'Estado']
        );
    }

    if (servicosSubscritos.length > 0) {
        y = ensureSpace(doc, y);
        servicosSubscritos.forEach((servico, idx) => {
            y = ensureSpace(doc, y);
            const rows = [
                ['Modalidade', servico.modalidade || '-'],
                [
                    'Nº Horas/Mês',
                    formatDurationLabel(servico.horaInicio, servico.horaFim),
                ],
                ['Disciplina', servico.disciplina || '-'],
                ['Preço', formatCurrency(servico.valor)],
                ['Data Inscrição', formatDate(servico.dataInscricao)],
                ['Data Início', formatDate(servico.dataInicio)],
            ];
            if (servico.pacoteDescricao) {
                rows.push(['Pacote', servico.pacoteDescricao]);
            }
            y = addSectionTable(
                doc,
                y,
                `Serviço Subscrito ${idx + 1}: ${servico.tipoServico || servico.modalidade || ''}`,
                rows
            );
        });
    } else {
        y = ensureSpace(doc, y);
        y = addSectionTable(doc, y, 'Serviços Subscritos', [
            ['Serviços', 'Não existem serviços subscritos.'],
        ]);
    }

    y = ensureSpace(doc, y);
    y = addSectionTable(doc, y, 'Encarregado de Educação', [
        ['Nome Completo', aluno.encarregado?.pessoa?.nome || '-'],
        ['Parentesco', aluno.encarregado?.parentesco || '-'],
        ['Email', aluno.encarregado?.pessoa?.user?.email || '-'],
        ['Telemóvel', aluno.encarregado?.pessoa?.telemovel || '-'],
        ['Telefone', aluno.encarregado?.pessoa?.telefone || '-'],
        ['Morada', aluno.encarregado?.pessoa?.morada || '-'],
        ['Localidade', aluno.encarregado?.pessoa?.localidade || '-'],
        ['Código Postal', aluno.encarregado?.pessoa?.cod_postal || '-'],
    ]);

    y = ensureSpace(doc, y);
    y = addSectionTable(doc, y, 'Autorização de Saída', [
        ['Nome (1)', aluno.aut_saida_nome_1 || '-'],
        ['Parentesco (1)', aluno.aut_saida_parentesco_1 || '-'],
        ['Nome (2)', aluno.aut_saida_nome_2 || '-'],
        ['Parentesco (2)', aluno.aut_saida_parentesco_2 || '-'],
    ]);

    y = ensureSpace(doc, y);
    addSectionTable(doc, y, 'Observações', [
        ['Observações', aluno.observacoes || '-'],
    ]);

    const name = (aluno.pessoa?.nome || 'aluno')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .trim()
        .replace(/\s+/g, '_');
    doc.save(`ficha_aluno_${name}.pdf`);
}
