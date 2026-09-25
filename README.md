# Gestudo – Plataforma de Gestão de Centro de Explicações

### Descrição do Projeto

A plataforma Gestudo tem como objetivo agilizar a gestão de um centro de explicações, reduzindo erros associados a tarefas manuais e à utilização de múltiplas aplicações dispersas.

A aplicação centraliza a gestão de:

- Professores
- Alunos
- Serviços
- Atividades
- Preços
- Agendamentos
- Relatórios e alertas

O sistema disponibiliza um backoffice para o gestor, permitindo a administração e validação da informação inserida pelos utilizadores.

### Objetivos

- Centralizar toda a informação do centro numa única plataforma
- Automatizar processos administrativos
- Reduzir erros operacionais
- Melhorar a organização de agendas
- Fornecer dados relevantes através de dashboard e relatórios

### Tipos de Utilizador

**Gestor**

- Acesso ao backoffice
- Registar, editar e validar informações
- Consultar dashboard com métricas
- Definir alertas
- Gerar relatórios

**Professor**

- Consultar e editar dados pessoais
- Aceder à agenda de serviços prestados
- Visualizar atividades atribuídas

**Aluno**

- Consultar dados pessoais
- Aceder à agenda com serviços contratados
- Visualizar histórico de atividades

### Funcionalidades Principais

- Registo e autenticação de utilizadores
- Gestão de professores e alunos
- Gestão de serviços e atividades
- Definição de preços
- Agendamento de serviços
- Dashboard com filtros de pesquisa
- Sistema de alertas
- Relatórios para apoio à gestão

### Arquitetura da Aplicação

Projeto desenvolvido em arquitetura Fullstack:

```
App/
│
├── frontend/   → React (Vite) + Javascript + Tailwind CSS
└── backend/    → Node.js + Express
```

### Instalação e Execução

1. Clonar o repositório

```
git clone https://github.com/xTixa/mediacenter.git
cd App
```

2. Instalar dependências
   Backend

```
cd backend
npm install
```

Frontend

```
cd ../frontend
npm install
```

3️. Executar aplicação

Backend

```
cd backend
npm run dev
```

Frontend (noutro terminal)

```
cd frontend
npm run dev
```

### Dashboard

A aplicação inclui um dashboard para:

- Consulta de métricas relevantes
- Aplicação de filtros de pesquisa
- Apoio à tomada de decisão do gestor

### Segurança

- Autenticação de utilizadores
- Separação de permissões por tipo de utilizador
- Proteção de dados

### Notificações Push com Firebase

Foi implementado suporte a notificações push via Firebase Cloud Messaging (FCM).

Backend (API):

- Criação/atualização de token do dispositivo: `POST /api/notificacoes/device-token`
- Remoção de token do dispositivo: `POST /api/notificacoes/device-token/remover`
- Broadcast existente (`POST /api/notificacoes/broadcast`) agora também envia push via FCM

Variáveis de ambiente do backend (uma das opções abaixo):

- `FIREBASE_SERVICE_ACCOUNT_JSON` com o JSON completo da service account

ou

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (com `\\n` escapado)

Frontend (Vite):

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

Notas importantes:

- O utilizador autenticado regista automaticamente o token FCM no backend.
- No logout, o token atual é removido do servidor.
- Foi adicionado service worker em `frontend/public/firebase-messaging-sw.js` para suporte de push no browser.

Projeto desenvolvido no para a unidade curricular de Projeto
