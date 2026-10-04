import { useEffect, useState } from 'react';
import PreviewModal, {
    PreviewIdentidade,
} from '../../../components/people/PreviewModal';
import { resolverImagemPerfil } from '../../../components/people/imagemPerfil';
import { apiGet } from '../../../utils/api';
import { formatDate, getEncarregadoLabel } from './alunosFormat';

// função para formatar um valor numérico como moeda em euros, usando o Intl.NumberFormat com a localidade 'pt-PT' e o estilo 'currency', e retornando '€0,00' caso o valor seja nulo ou indefinido
function formatCurrency(value) {
    if (value === null || value === undefined) return '€0,00';
    return new Intl.NumberFormat('pt-PT', {
        style: 'currency',
        currency: 'EUR',
    }).format(value);
}

// função para converter uma string de tempo no formato "HH:MM" para o total de minutos, dividindo a string em horas e minutos, convertendo-os para números e calculando o total em minutos, retornando 0 caso a string seja inválida ou não fornecida
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return (hours || 0) * 60 + (minutes || 0);
}

// função para formatar a duração entre um horário de início e um horário de fim, calculando a diferença em minutos usando a função parseTimeToMinutes, e formatando o resultado como uma string no formato "XhYm" ou "Xh" caso os minutos sejam zero, retornando uma string vazia caso os horários sejam inválidos ou a diferença seja negativa
function formatDurationLabel(horaInicio, horaFim) {
    if (!horaInicio || !horaFim) return '';
    const inicio = parseTimeToMinutes(horaInicio);
    const fim = parseTimeToMinutes(horaFim);
    const diff = fim - inicio;
    if (diff <= 0) return '';
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h${mins}`;
}

function getAlunoNome(aluno) {
    const nome = String(aluno?.nome || aluno?.pessoa?.nome || '').trim();
    return nome || '-';
}

function getAlunoNif(aluno) {
    const nif = String(aluno?.nif || aluno?.pessoa?.nif || '').trim();
    return nif || '-';
}

function ServicoSubscrito({ servico }) {
    return (
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
            <p className="font-semibold text-slate-800 mb-2">
                {servico.tipo_servico || servico.modalidade || 'Serviço'}
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                {servico.modalidade && (
                    <p>
                        <strong>Modalidade:</strong> {servico.modalidade}
                    </p>
                )}
                {servico.disciplina && (
                    <p>
                        <strong>Disciplina:</strong> {servico.disciplina}
                    </p>
                )}
                {servico.valor !== null && (
                    <p>
                        <strong>Preço:</strong> {formatCurrency(servico.valor)}
                    </p>
                )}
                {servico.horaInicio && servico.horaFim && (
                    <p>
                        <strong>Duração:</strong>{' '}
                        {formatDurationLabel(servico.horaInicio, servico.horaFim)}
                    </p>
                )}
                {servico.dataInscricao && (
                    <p>
                        <strong>Data Inscrição:</strong>{' '}
                        {formatDate(servico.dataInscricao)}
                    </p>
                )}
                {servico.dataInicio && (
                    <p>
                        <strong>Data Início:</strong>{' '}
                        {formatDate(servico.dataInicio)}
                    </p>
                )}
            </div>
        </div>
    );
}

/**
 * Ficha rápida do aluno: mostra logo os dados da tabela e carrega a ficha
 * completa (com os serviços subscritos). Montar com key={id_aluno}.
 */
export default function AlunoPreviewModal({ aluno, onFechar }) {
    // null enquanto a ficha completa não chega.
    const [ficha, setFicha] = useState(null);

    useEffect(() => {
        let isMounted = true;

        apiGet(`/api/gestor/alunos/${aluno.id_aluno}`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) {
                    throw new Error('Erro ao carregar dados do aluno');
                }
                return { ...aluno, ...(data.aluno || {}) };
            })
            // Sem a ficha completa, mostra-se o que já se sabe do aluno.
            .catch(() => aluno)
            .then((dados) => {
                if (isMounted) setFicha(dados);
            });

        return () => {
            isMounted = false;
        };
    }, [aluno]);

    const dados = ficha || aluno;
    const servicos = ficha?.servicosSubscritos;

    return (
        <PreviewModal titulo="Ficha do Aluno" onFechar={onFechar}>
            <div className="max-h-[70vh] overflow-y-auto">
                {ficha === null ? (
                    <div className="flex items-center justify-center py-8">
                        <span className="text-slate-500">Carregando dados...</span>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 gap-4 px-5 py-5 text-sm border-b border-slate-200">
                            <PreviewIdentidade
                                imagem={resolverImagemPerfil(dados)}
                                nome={getAlunoNome(dados)}
                                entidade="aluno"
                            />

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <p className="text-slate-700">
                                    <strong>Nome:</strong> {getAlunoNome(dados)}
                                </p>
                                <p className="text-slate-700">
                                    <strong>NIF:</strong> {getAlunoNif(dados)}
                                </p>
                                <p className="text-slate-700">
                                    <strong>Ano Escolar:</strong> {dados.ano}º
                                </p>
                                <p className="text-slate-700">
                                    <strong>Escola:</strong> {dados.escola}
                                </p>
                                <p className="text-slate-700">
                                    <strong>Encarregado:</strong>{' '}
                                    {getEncarregadoLabel(dados.encarregado)}
                                </p>
                                <p className="text-slate-700">
                                    <strong>Contacto:</strong> {dados.contacto}
                                </p>
                                <p className="text-slate-700 md:col-span-2">
                                    <strong>Data de Início:</strong>{' '}
                                    {formatDate(dados.data_inicio)}
                                </p>
                            </div>
                        </div>

                        {servicos && servicos.length > 0 ? (
                            <div className="px-5 py-4 border-t border-slate-200">
                                <h3 className="font-semibold text-slate-800 mb-3">
                                    Serviços Subscritos
                                </h3>
                                <div className="space-y-3">
                                    {servicos.map((servico, idx) => (
                                        <ServicoSubscrito
                                            key={idx}
                                            servico={servico}
                                        />
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="px-5 py-4 border-t border-slate-200 text-center text-slate-500">
                                Não existem serviços subscritos para este aluno.
                            </div>
                        )}
                    </>
                )}
            </div>
        </PreviewModal>
    );
}
