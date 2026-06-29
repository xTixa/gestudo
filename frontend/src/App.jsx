import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import Login from './pages/Auth/Login';
import RecoverPassword from './pages/Auth/RecoverPassword';
import AlterarPasswordObrigatorio from './pages/Auth/AlterPassword';
import InfosHomePage from './pages/Infos/index';
import InfosAboutPage from './pages/Infos/about';
import InfosServicosPage from './pages/Infos/services';
import InfosContactsPage from './pages/Infos/contacts';
import InfosServicoDetalhePage from './pages/Infos/servicesDetails';
import InfosInscricaoPage from './pages/Infos/enrollment';
import Navbar from './components/layout/navbar';
import Sidebar from './components/layout/sidebar';
import DashboardGestor from './pages/Admin/dashboard';
import AuditLogs from './pages/Admin/LogsPage';
import AlertsPage from './pages/Admin/alerts';
import NotificationsPage from './pages/Admin/notifications';
import SettingsPage from './pages/Admin/settings';
import PublicEnrollmentsPage from './pages/Admin/PublicEnrollments';
import AgendaPage from './pages/Admin/agenda';
import PresencasGestorPage from './pages/Admin/presences';
import ReagendamentosPage from './pages/Admin/rescheduling';
import DisciplinasPage from './pages/Admin/InternalManagement/disciplines';
import SalasPage from './pages/Admin/InternalManagement/rooms';
import ModalidadePage from './pages/Admin/InternalManagement/modality';
import PacotesPage from './pages/Admin/InternalManagement/packs';
import GestaoCurricularPage from './pages/Admin/ServicesManagement/Curricular/managementCurricular';
import GestaoExtraPage from './pages/Admin/ServicesManagement/ExtraCurricular/managementExtra';
import GestaoAlunosPage from './pages/Admin/StudentManagement/managementStudent';
import AddAlunoPage from './pages/Admin/StudentManagement/addStudent';
import UpdateAlunoPage from './pages/Admin/StudentManagement/updateStudent';
import GestaoProfsPage from './pages/Admin/TeacherManagement/managementTeacher';
import AddProfPage from './pages/Admin/TeacherManagement/addTeacher';
import UpdateProfPage from './pages/Admin/TeacherManagement/updateTeacher';
import FichaAlunoPage from './pages/Admin/StudentManagement/recordStudent';
import FichaProfPage from './pages/Admin/TeacherManagement/recordTeacher';
import DashboardProfessorPage from './pages/Teacher/dashboard';
import AgendaProfessorPage from './pages/Teacher/agenda';
import ReagendamentosProfessorPage from './pages/Teacher/rescheduling';
import ServicosProfessorPage from './pages/Teacher/services';
import PresencasProfessorPage from './pages/Teacher/presences';
import NotificationsProfessorPage from './pages/Teacher/notifications';
import DashboardAlunoPage from './pages/Student/dashboard';
import AgendaAlunoPage from './pages/Student/agenda';
import ServicosAlunoPage from './pages/Student/services';
import PresencasAlunoPage from './pages/Student/presences';
import NotificationsAlunoPage from './pages/Student/notifications';
import PerfilAlunoPage from './pages/Student/Profile/profile';
import UpdatePerfilAlunoPage from './pages/Student/Profile/updateProfile';
import PerfilProfessorPage from './pages/Teacher/Profile/profile';
import UpdatePerfilProfessorPage from './pages/Teacher/Profile/updateProfile';
import { apiGet, apiPost } from './utils/api';
import {
    iniciarNotificacoesFirebase,
    removerTokenFirebaseAtual,
} from './services/firebaseMessaging';
import PendingEnrollmentsPopup from './components/enrollments/PendingEnrollmentsPopup';

const ROLE_HOME_PATH = {
    gestor: '/gestor/dashboard',
    professor: '/professor/dashboard',
    aluno: '/aluno/dashboard',
};

const ROLE_PREFIX_PATH = {
    gestor: '/gestor',
    professor: '/professor',
    aluno: '/aluno',
};

function getStoredUser() {
    const stored = localStorage.getItem('mc_user');

    if (!stored) {
        return null;
    }

    try {
        return JSON.parse(stored);
    } catch {
        localStorage.removeItem('mc_user');
        return null;
    }
}

const AuthenticatedRoutes = memo(function AuthenticatedRoutes({
    currentRole,
    user,
}) {
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
                        path="/gestor/reagendar"
                        element={<ReagendamentosPage />}
                    />
                    <Route
                        path="/gestor/servicos/curriculares"
                        element={<GestaoCurricularPage />}
                    />
                    <Route
                        path="/gestor/servicos/extra-curriculares"
                        element={<GestaoExtraPage />}
                    />
                    <Route path="/gestor/logs" element={<AuditLogs />} />
                    <Route
                        path="/gestor/inscricoes-publicas"
                        element={<PublicEnrollmentsPage />}
                    />
                    <Route path="/gestor/alertas" element={<AlertsPage />} />
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
                        path="/professor/reagendamentos"
                        element={<ReagendamentosProfessorPage />}
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
                        path="/aluno/presencas"
                        element={<PresencasAlunoPage />}
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

    const prevUserRef = useRef(null);

    function handleLogin(loggedUser, csrfToken) {
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
            localStorage.removeItem('mc_user');
            localStorage.removeItem('mc_token');
            localStorage.removeItem('mc_csrf_token');
            window.csrfToken = undefined;
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
            if (nextUser && typeof nextUser === 'object') {
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
        if (!user) {
            return undefined;
        }

        let unsubscribeForeground = () => {};
        let active = true;

        async function setupPush() {
            try {
                await apiGet('/api/auth/csrf-token');
                const result = await iniciarNotificacoesFirebase();
                if (!active || !result?.success) {
                    return;
                }

                if (typeof result.unsubscribeForeground === 'function') {
                    unsubscribeForeground = result.unsubscribeForeground;
                }
            } catch (error) {
                console.warn(
                    '[App] Firebase Messaging não inicializado:',
                    error.message
                );
            }
        }

        setupPush();

        return () => {
            active = false;
            unsubscribeForeground();
        };
    }, [user]);

    const handleLogout = useCallback(async () => {
        try {
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
        localStorage.removeItem('mc_user');
        localStorage.removeItem('mc_token');
        localStorage.removeItem('mc_csrf_token');
        window.csrfToken = undefined;
        navigate('/login', { replace: true });
    }, [navigate]);

    const handleNavigate = useCallback(
        (path) => {
            navigate(path);
        },
        [navigate]
    );

    if (!user) {
        return (
            <Routes>
                <Route path="/" element={<InfosHomePage />} />
                <Route path="/sobre" element={<InfosAboutPage />} />
                <Route path="/servicos" element={<InfosServicosPage />} />
                <Route
                    path="/servicos/:slug"
                    element={<InfosServicoDetalhePage />}
                />
                <Route path="/inscricao" element={<InfosInscricaoPage />} />
                <Route path="/contactos" element={<InfosContactsPage />} />
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
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
    }

    if (!isKnownRole) {
        localStorage.removeItem('mc_user');
        localStorage.removeItem('mc_token');
        localStorage.removeItem('mc_csrf_token');
        return (
            <Routes>
                <Route path="/" element={<InfosHomePage />} />
                <Route path="/sobre" element={<InfosAboutPage />} />
                <Route path="/servicos" element={<InfosServicosPage />} />
                <Route
                    path="/servicos/:slug"
                    element={<InfosServicoDetalhePage />}
                />
                <Route path="/inscricao" element={<InfosInscricaoPage />} />
                <Route path="/contactos" element={<InfosContactsPage />} />
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
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        );
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
                <div className="flex-1 min-w-0 flex flex-col">
                    {/* Navbar */}
                    <Navbar
                        user={user}
                        onLogout={handleLogout}
                        onNavigate={handleNavigate}
                    />

                    {/* Conteúdo da página */}
                    <main className="flex-1 p-4 sm:p-6 overflow-auto">
                        <AuthenticatedRoutes
                            currentRole={currentRole}
                            user={user}
                        />
                    </main>
                </div>
            </div>

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
