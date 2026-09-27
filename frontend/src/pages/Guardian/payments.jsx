import { Wallet } from 'lucide-react';
import EducandoScope from '../../components/guardian/EducandoScope';
import UsersPageHeader from '../../components/layout/UsersPageHeader';
import ContaCorrenteAluno from '../../components/finance/ContaCorrenteAluno';

export default function PagamentosEncarregadoPage() {
    return (
        <EducandoScope>
            {(educando, selector) => (
                <section className="space-y-5">
                    <UsersPageHeader
                        eyebrow="Área do encarregado"
                        title="Mensalidades e pagamentos"
                        subtitle={`Conta corrente de ${educando.nome}.`}
                        icon={Wallet}
                        actions={selector}
                    />
                    <ContaCorrenteAluno
                        key={educando.idAluno}
                        url={`/api/encarregado/educandos/${educando.idAluno}/conta-corrente`}
                        readOnly
                    />
                    <p className="text-sm text-slate-500">
                        Para esclarecer algum valor ou combinar um pagamento,
                        contacte a secretaria do centro.
                    </p>
                </section>
            )}
        </EducandoScope>
    );
}
