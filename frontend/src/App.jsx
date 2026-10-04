import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import Navbar from './components/layout/navbar';
import Sidebar from './components/layout/sidebar';
import { apiGet, apiPost } from './utils/api';
import { lazyPage } from './utils/lazyPage';
import PendingEnrollmentsPopup from './components/enrollments/PendingEnrollmentsPopup';
import ErrorBoundary from './components/ErrorBoundary';
import PlanGate from './components/plan/PlanGate';
import MessagesDock from './components/messages/MessagesDock';
import { usePlan } from './utils/plan';
import { useAplicarModoTema } from './theme/modoTema';
import { useAplicarTemaCentro } from './theme/aparenciaCentro';

// Páginas carregadas a pedido (cada uma é um ficheiro JS à parte).
const Login = lazyPage(() => import('./pages/Auth/Login'));
const RecoverPassword = lazyPage(() => import('./pages/Auth/RecoverPassword'));
const AlterarPasswordObrigatorio = lazyPage(() => import('./pages/Auth/AlterPassword'));
const InfosInscricaoPage = lazyPage(() => import('./pages/Infos/enrollment'));
const HomePage = lazyPage(() => import('./pages/Infos/home'));
const DashboardGestor = lazyPage(() => import('./pages/Admin/dashboard'));
const ReportsPage = lazyPage(() => import('./pages/Admin/reports'));
const AuditLogs = lazyPage(() => import('./pages/Admin/LogsPage'));
const AlertsPage = lazyPage(() => import('./pages/Admin/alerts'));
const NotificationsPage = lazyPage(() => import('./pages/Admin/notifications'));
const SettingsPage = lazyPage(() => import('./pages/Admin/settings'));
const PublicEnrollmentsPage = lazyPage(() => import('./pages/Admin/PublicEnrollments'));
const RenewalsPage = lazyPage(() => import('./pages/Admin/renewals'));
const FinanceOverview = lazyPage(() => import('./pages/Admin/Finance/FinanceOverview'));
const MensalidadesPage = lazyPage(() => import('./pages/Admin/Finance/Mensalidades'));
const PagamentosPage = lazyPage(() => import('./pages/Admin/Finance/Pagamentos'));
const CustosProfessoresPage = lazyPage(() => import('./pages/Admin/Finance/CustosProfessores'));
const AgendaPage = lazyPage(() => import('./pages/Admin/agenda'));
const PresencasGestorPage = lazyPage(() => import('./pages/Admin/presences'));
const DisciplinasPage = lazyPage(() => import('./pages/Admin/InternalManagement/disciplines'));
const SalasPage = lazyPage(() => import('./pages/Admin/InternalManagement/rooms'));
const ModalidadePage = lazyPage(() => import('./pages/Admin/InternalManagement/modality'));
const PacotesPage = lazyPage(() => import('./pages/Admin/InternalManagement/packs'));
const TipoServicoPage = lazyPage(() => import('./pages/Admin/InternalManagement/serviceTypes'));
const GestaoCurricularPage = lazyPage(() => import('./pages/Admin/ServicesManagement/Curricular/managementCurricular'));
const GestaoExtraPage = lazyPage(() => import('./pages/Admin/ServicesManagement/ExtraCurricular/managementExtra'));
const GestaoAlunosPage = lazyPage(() => import('./pages/Admin/StudentManagement/managementStudent'));
const AddAlunoPage = lazyPage(() => import('./pages/Admin/StudentManagement/addStudent'));
const UpdateAlunoPage = lazyPage(() => import('./pages/Admin/StudentManagement/updateStudent'));
const GestaoProfsPage = lazyPage(() => import('./pages/Admin/TeacherManagement/managementTeacher'));
const AddProfPage = lazyPage(() => import('./pages/Admin/TeacherManagement/addTeacher'));
const UpdateProfPage = lazyPage(() => import('./pages/Admin/TeacherManagement/updateTeacher'));
const FichaAlunoPage = lazyPage(() => import('./pages/Admin/StudentManagement/recordStudent'));
const FichaProfPage = lazyPage(() => import('./pages/Admin/TeacherManagement/recordTeacher'));
const DashboardProfessorPage = lazyPage(() => import('./pages/Teacher/dashboard'));
const AgendaProfessorPage = lazyPage(() => import('./pages/Teacher/agenda'));
const ServicosProfessorPage = lazyPage(() => import('./pages/Teacher/services'));
const PresencasProfessorPage = lazyPage(() => import('./pages/Teacher/presences'));
const AssiduidadeProfessorPage = lazyPage(() => import('./pages/Teacher/attendance'));
const NotificationsProfessorPage = lazyPage(() => import('./pages/Teacher/notifications'));
const DashboardAlunoPage = lazyPage(() => import('./pages/Student/dashboard'));
const AgendaAlunoPage = lazyPage(() => import('./pages/Student/agenda'));
const ReinscricaoAlunoPage = lazyPage(() => import('./pages/Student/reinscricao'));
const ServicosAlunoPage = lazyPage(() => import('./pages/Student/services'));
const PresencasAlunoPage = lazyPage(() => import('./pages/Student/presences'));
const NotificationsAlunoPage = lazyPage(() => import('./pages/Student/notifications'));
const DashboardEncarregadoPage = lazyPage(() => import('./pages/Guardian/dashboard'));
const AgendaEncarregadoPage = lazyPage(() => import('./pages/Guardian/agenda'));
const PresencasEncarregadoPage = lazyPage(() => import('./pages/Guardian/presences'));
const PagamentosEncarregadoPage = lazyPage(() => import('./pages/Guardian/payments'));
const NotificacoesEncarregadoPage = lazyPage(() => import('./pages/Guardian/notifications'));
const PerfilEncarregadoPage = lazyPage(() => import('./pages/Guardian/profile'));
const PerfilAlunoPage = lazyPage(() => import('./pages/Student/Profile/profile'));
const UpdatePerfilAlunoPage = lazyPage(() => import('./pages/Student/Profile/updateProfile'));
const PerfilProfessorPage = lazyPage(() => import('./pages/Teacher/Profile/profile'));
const UpdatePerfilProfessorPage = lazyPage(() => import('./pages/Teacher/Profile/updateProfile'));
const NotFound = lazyPage(() => import('./pages/NotFound'));
const MessagesPage = lazyPage(() => import('./pages/Messages/MessagesPage'));

function PageLoader({ fullScreen = false }) {
    return (
        <div
            className={`flex items-center justify-center text-slate-400 ${fullScreen ? 'h-screen' : 'py-24'}`}
            role="status"
            aria-label="A carregar"
        >
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600" />
        </div>
    );
}

const ROLE_HOME_PATH = {
    gestor: '/gestor/dashboard',
    professor: '/professor/dashboard',
    aluno: '/aluno/dashboard',
    encarregado: '/encarregado/dashboard',
};

const ROLE_PREFIX_PATH = {
    gestor: '/gestor',
    professor: '/professor',
    aluno: '/aluno',
    encarregado: '/encarregado',
};

function limparSessaoLocal() {
    localStorage.removeItem('mc_user');
    localStorage.removeItem('mc_token');
    localStorage.removeItem('mc_csrf_token');
    window.csrfToken = undefined;
}

function isKnownUser(user) {
    return Boolean(user && ROLE_HOME_PATH[user.role]);
}

// Um utilizador guardado com um papel desconhecido é tratado como sessão
// inválida logo aqui, em vez de ser limpo depois por um efeito.
function getStoredUser() {
    const stored = localStorage.getItem('mc_user');

    if (!stored) {
        return null;
    }

    try {
        const user = JSON.parse(stored);
        if (isKnownUser(user)) return user;
    } catch {
        // JSON inválido: limpa abaixo.
    }
    limparSessaoLocal();
    return null;
}

const AuthenticatedRoutes = memo(function AuthenticatedRoutes({
    currentRole,
    user,
}) {
    const gate = (module, element) => (
        <PlanGate module={module} isManager={currentRole === 'gestor'}>
            {element}
        </PlanGate>
    );

    return (
        <Routes>
            {currentRole === 'gestor' ? (
                <>
                    <Route
                        path="/gestor/dashboard"
                        element={<DashboardGestor />}
                    />
                    <Route path="/gestor/agenda" element={<AgendaPage />} />
                    <Route
                        path="/gestor/presencas"
                        element={<PresencasGestorPage />}
                    />
                    <Route
                        path="/gestor/servicos/curriculares"
                        element={<GestaoCurricularPage />}
                    />
                    <Route
                        path="/gestor/servicos/extra-curriculares"
                        element={<GestaoExtraPage />}
                    />
                    <Route path="/gestor/logs" element={gate('auditoria', <AuditLogs />)} />
                    <Route
                        path="/gestor/inscricoes-publicas"
                        element={gate('inscricoes_online', <PublicEnrollmentsPage />)}
                    />
                    <Route
                        path="/gestor/renovacoes"
                        element={gate('renovacoes', <RenewalsPage />)}
                    />
                    <Route path="/gestor/financeiro" element={gate('financeiro', <FinanceOverview />)} />
                    <Route
                        path="/gestor/financeiro/mensalidades"
                        element={gate('financeiro', <MensalidadesPage />)}
                    />
                    <Route
                        path="/gestor/financeiro/pagamentos"
                        element={gate('financeiro', <PagamentosPage />)}
                    />
                    <Route
                        path="/gestor/financeiro/professores"
                        element={gate('custos_professores', <CustosProfessoresPage />)}
                    />
                    <Route path="/gestor/alertas" element={gate('alertas', <AlertsPage />)} />
                    <Route
                        path="/gestor/notificacoes"
                        element={<NotificationsPage user={user} />}
                    />
                    <Route
                        path="/gestor/disciplinas"
                        element={<DisciplinasPage />}
                    />
                    <Route path="/gestor/salas" element={<SalasPage />} />
                    <Route
                        path="/gestor/modalidade"
                        element={<ModalidadePage />}
                    />
                    <Route path="/gestor/pacotes" element={<PacotesPage />} />
                    <Route
                        path="/gestor/tipos-servico"
                        element={<TipoServicoPage />}
                    />
                    <Route
                        path="/gestor/alunos"
                        element={<GestaoAlunosPage />}
                    />
                    <Route
                        path="/gestor/alunos/addAluno"
                        element={<AddAlunoPage />}
                    />
                    <Route
                        path="/gestor/alunos/ficha/:id"
                        element={<FichaAlunoPage />}
                    />
                    <Route
                        path="/gestor/alunos/update/:id"
                        element={<UpdateAlunoPage />}
                    />
                    <Route
                        path="/gestor/professores"
                        element={<GestaoProfsPage />}
                    />
                    <Route
                        path="/gestor/professores/addProf"
                        element={<AddProfPage />}
                    />
                    <Route
                        path="/gestor/professores/ficha/:id"
                        element={<FichaProfPage />}
                    />
                    <Route
                        path="/gestor/professores/update/:id"
                        element={<UpdateProfPage />}
                    />
                    <Route
                        path="/gestor/configuracoes"
                        element={<SettingsPage />}
                    />
                    <Route
                        path="/gestor/mensagens"
                        element={gate('mensagens', <MessagesPage />)}
                    />
                    <Route
                        path="/gestor/relatorios"
                        element={gate('relatorios', <ReportsPage />)}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/gestor/dashboard" replace />}
                    />
                </>
            ) : currentRole === 'professor' ? (
                <>
                    <Route
                        path="/professor/dashboard"
                        element={<DashboardProfessorPage />}
                    />
                    <Route
                        path="/professor/agenda"
                        element={<AgendaProfessorPage />}
                    />
                    <Route
                        path="/professor/servicos"
                        element={<ServicosProfessorPage />}
                    />
                    <Route
                        path="/professor/presencas"
                        element={<PresencasProfessorPage />}
                    />
                    <Route
                        path="/professor/assiduidade"
                        element={gate('assiduidade', <AssiduidadeProfessorPage />)}
                    />
                    <Route
                        path="/professor/mensagens"
                        element={gate('mensagens', <MessagesPage />)}
                    />
                    <Route
                        path="/professor/notificacoes"
                        element={<NotificationsProfessorPage />}
                    />
                    <Route
                        path="/professor/perfil"
                        element={<PerfilProfessorPage />}
                    />
                    <Route
                        path="/professor/perfil/editar"
                        element={<UpdatePerfilProfessorPage />}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/professor/dashboard" replace />}
                    />
                </>
            ) : currentRole === 'aluno' ? (
                <>
                    <Route
                        path="/aluno/dashboard"
                        element={<DashboardAlunoPage />}
                    />
                    <Route path="/aluno/agenda" element={<AgendaAlunoPage />} />
                    <Route
                        path="/aluno/servicos"
                        element={<ServicosAlunoPage />}
                    />
                    <Route
                        path="/aluno/subscricao-servicos"
                        element={<ServicosAlunoPage />}
                    />
                    <Route
                        path="/aluno/reinscricao"
                        element={gate('renovacoes', <ReinscricaoAlunoPage />)}
                    />
                    <Route
                        path="/aluno/presencas"
                        element={<PresencasAlunoPage />}
                    />
                    <Route
                        path="/aluno/mensagens"
                        element={gate('mensagens', <MessagesPage />)}
                    />
                    <Route
                        path="/aluno/notificacoes"
                        element={<NotificationsAlunoPage />}
                    />
                    <Route path="/aluno/perfil" element={<PerfilAlunoPage />} />
                    <Route
                        path="/aluno/perfil/editar"
                        element={<UpdatePerfilAlunoPage />}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/aluno/dashboard" replace />}
                    />
                </>
            ) : currentRole === 'encarregado' ? (
                <>
                    <Route
                        path="/encarregado/dashboard"
                        element={<DashboardEncarregadoPage />}
                    />
                    <Route
                        path="/encarregado/agenda"
                        element={<AgendaEncarregadoPage />}
                    />
                    <Route
                        path="/encarregado/presencas"
                        element={<PresencasEncarregadoPage />}
                    />
                    <Route
                        path="/encarregado/pagamentos"
                        element={gate('financeiro', <PagamentosEncarregadoPage />)}
                    />
                    <Route
                        path="/encarregado/mensagens"
                        element={gate('mensagens', <MessagesPage />)}
                    />
                    <Route
                        path="/encarregado/notificacoes"
                        element={<NotificacoesEncarregadoPage />}
                    />
                    <Route
                        path="/encarregado/perfil"
                        element={<PerfilEncarregadoPage />}
                    />
                    <Route
                        path="*"
                        element={<Navigate to="/encarregado/dashboard" replace />}
                    />
                </>
            ) : (
                <Route
                    path="*"
                    element={
                        <section className="rounded-xl border border-slate-200 bg-white p-6">
                            <h1 className="text-xl font-semibold">
                                Área do utilizador
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Layout base carregado. Esta área será adaptada
                                ao perfil {currentRole}.
                            </p>
                        </section>
                    }
                />
            )}
        </Routes>
    );
});

function App() {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(getStoredUser);
    const [pendingEnrollmentsCount, setPendingEnrollmentsCount] = useState(0);
    const [showEnrollmentsPopup, setShowEnrollmentsPopup] = useState(false);

    const [sidebarOpen, setSidebarOpen] = useState(() => {
        if (typeof window === 'undefined') {
            return true;
        }
        return window.innerWidth >= 1024;
    });
    const currentRole = useMemo(() => user?.role || null, [user]);
    const isKnownRole = useMemo(
        () => Boolean(currentRole && ROLE_HOME_PATH[currentRole]),
        [currentRole]
    );
    useAplicarModoTema(Boolean(user) && isKnownRole);
    useAplicarTemaCentro(Boolean(user) && isKnownRole);

    const prevUserRef = useRef(null);
    const { hasModule, loading: planLoading } = usePlan();
    const pushEnabled = !planLoading && hasModule('notificacoes_push');

    function handleLogin(loggedUser, csrfToken) {
        if (!isKnownUser(loggedUser)) {
            limparSessaoLocal();
            navigate('/login', { replace: true });
            return;
        }

        setUser(loggedUser);
        localStorage.setItem('mc_user', JSON.stringify(loggedUser));

        if (csrfToken) {
            window.csrfToken = csrfToken;
            localStorage.setItem('mc_csrf_token', csrfToken);
        }

        const nextPath = ROLE_HOME_PATH[loggedUser?.role] || '/';
        navigate(nextPath, { replace: true });
    }

    // Detecta transição de login e verifica inscrições pendentes para gestores
    useEffect(() => {
        const prev = prevUserRef.current;
        prevUserRef.current = user;

        const justLoggedIn = !prev && user?.role === 'gestor';
        if (!justLoggedIn) return;

        apiGet('/api/gestor/inscricoes-publicas?estado=pendente')
            .then((res) => {
                if (!res.ok) return null;
                return res.json();
            })
            .then((data) => {
                if (!data) return;
                const count = data?.inscricoes?.length ?? 0;
                if (count > 0) {
                    setPendingEnrollmentsCount(count);
                    setShowEnrollmentsPopup(true);
                }
            })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        if (!user || !isKnownRole) {
            return;
        }

        const prefix = ROLE_PREFIX_PATH[currentRole];
        const home = ROLE_HOME_PATH[currentRole];

        if (!location.pathname.startsWith(prefix)) {
            navigate(home, { replace: true });
        }
    }, [currentRole, isKnownRole, location.pathname, navigate, user]);

    useEffect(() => {
        function handleUnauthorized() {
            setUser(null);
            limparSessaoLocal();
            navigate('/login', { replace: true });
        }

        window.addEventListener('mc:unauthorized', handleUnauthorized);
        return () => {
            window.removeEventListener('mc:unauthorized', handleUnauthorized);
        };
    }, [navigate]);

    useEffect(() => {
        function handleUserUpdated(event) {
            const nextUser = event?.detail;
            if (isKnownUser(nextUser)) {
                setUser(nextUser);
            }
        }

        window.addEventListener('mc:user-updated', handleUserUpdated);
        return () => {
            window.removeEventListener('mc:user-updated', handleUserUpdated);
        };
    }, []);

    useEffect(() => {
        if (!user) return;

        apiGet('/api/auth/csrf-token')
            .then((res) => res.json())
            .then((data) => {
                if (data?.csrfToken) {
                    window.csrfToken = data.csrfToken;
                    localStorage.setItem('mc_csrf_token', data.csrfToken);
                }
            })
            .catch(() => {});
    }, [user]);

    useEffect(() => {
        if (!user || !pushEnabled) {
            return undefined;
        }

        let unsubscribeForeground = () => {};
        let active = true;

        async function setupPush() {
            try {
                await apiGet('/api/auth/csrf-token');
                // Firebase só é descarregado quando as notificações push estão ativas.
                const { iniciarNotificacoesFirebase } = await import('./services/firebaseMessaging');
                const result = await iniciarNotificacoesFirebase();
                if (!active || !result?.success) {
                    return;
                }

                if (typeof result.unsubscribeForeground === 'function') {
                    unsubscribeForeground = result.unsubscribeForeground;
                }
            } catch {
                // Firebase não disponível neste contexto.
            }
        }

        setupPush();

        return () => {
            active = false;
            unsubscribeForeground();
        };
    }, [user, pushEnabled]);

    const handleLogout = useCallback(async () => {
        try {
            const { removerTokenFirebaseAtual } = await import('./services/firebaseMessaging');
            await removerTokenFirebaseAtual();
        } catch {
            // Falha no cleanup do token não bloqueia logout.
        }

        try {
            await apiPost('/api/auth/logout', {});
        } catch {
            // Se o servidor não responder, o estado local ainda é limpo.
        }

        setUser(null);
        limparSessaoLocal();
        navigate('/login', { replace: true });
    }, [navigate]);

    const handleNavigate = useCallback(
        (path) => {
            navigate(path);
        },
        [navigate]
    );
    const isAdminRole = currentRole === 'gestor';
    // A doca não aparece na própria página de mensagens.
    const showMessagesDock =
        hasModule('mensagens') && !location.pathname.endsWith('/mensagens');

    if (!user) {
        return (
            <Suspense fallback={<PageLoader fullScreen />}>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/inscricao" element={<InfosInscricaoPage />} />
                    <Route
                        path="/login"
                        element={<Login onLogin={handleLogin} />}
                    />
                    <Route
                        path="/recuperar-password"
                        element={<RecoverPassword />}
                    />
                    <Route
                        path="/auth/alterar-password-obrigatorio"
                        element={<AlterarPasswordObrigatorio />}
                    />
                    <Route path="*" element={<NotFound homePath="/" />} />
                </Routes>
            </Suspense>
        );
    }

    if (!isKnownRole) {
        return null;
    }

    return (
        <div className="h-screen bg-slate-50 text-slate-800">
            <div className="flex h-full">
                {/* Sidebar */}
                <Sidebar
                    role={currentRole}
                    isOpen={sidebarOpen}
                    currentPath={location.pathname}
                    onNavigate={handleNavigate}
                    onToggle={() => setSidebarOpen((prev) => !prev)}
                    onClose={() => setSidebarOpen(false)}
                />

                {/* Conteúdo principal */}
                <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    {/* Navbar */}
                    <Navbar
                        user={user}
                        onLogout={handleLogout}
                        onNavigate={handleNavigate}
                        onToggleSidebar={() => setSidebarOpen(true)}
                    />

                    {/* Conteúdo da página. "relative" prende elementos absolute
                        (ex.: sr-only) ao scroll do main, em vez de alongarem a
                        página inteira. */}
                    <main
                        data-admin-compact={isAdminRole ? 'true' : undefined}
                        className={`relative flex-1 overflow-auto px-4 py-6 sm:px-6 lg:px-8 ${
                            showMessagesDock ? 'lg:pb-20' : ''
                        }`}
                    >
                        <ErrorBoundary>
                            <Suspense fallback={<PageLoader />}>
                                <AuthenticatedRoutes
                                    currentRole={currentRole}
                                    user={user}
                                />
                            </Suspense>
                        </ErrorBoundary>
                    </main>
                </div>
            </div>

            {showMessagesDock && user?.id ? (
                <MessagesDock key={user.id} role={currentRole} userId={user.id} />
            ) : null}

            {showEnrollmentsPopup && (
                <PendingEnrollmentsPopup
                    count={pendingEnrollmentsCount}
                    onClose={() => setShowEnrollmentsPopup(false)}
                    onNavigate={handleNavigate}
                />
            )}
        </div>
    );
}

export default App;
