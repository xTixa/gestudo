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

### Testes e CI

```
cd backend
npm test            # corre uma vez
npm run test:watch  # modo watch
```

- `tests/unit/`: funções e middlewares isolados.
- `tests/http/`: pedidos à API com supertest (autenticação, CORS, CSRF, validação, rate limit).
- Os testes não usam a base de dados: `tests/setupEnv.js` aponta a ligação para um endereço inválido.

O workflow `.github/workflows/ci.yml` corre em cada push e pull request para `main`: testes, SAST e `npm audit` no backend, lint e build no frontend.

### Tarefas automáticas

A API corre sozinha as rotinas abaixo (código em `backend/src/scheduler/`). As horas são no fuso `APP_TIMEZONE` (Europe/Lisbon por omissão).

| Tarefa | Quando | O que faz |
| --- | --- | --- |
| Lembrete de mensalidades a vencer | Diária, 09:00 | Avisa o encarregado (ou o aluno sem encarregado) 3 dias antes do vencimento |
| Aviso de mensalidades em atraso | Diária, 09:05 | Avisa 1 e 8 dias depois do vencimento; resumo aos gestores |
| Lembrete das aulas de amanhã | Diária, 18:00 | Alunos, encarregados e professores recebem as aulas do dia seguinte |
| Geração de mensalidades | Dia 1, 07:00 | Gera as mensalidades do mês (desligada por omissão: Configurações → Funcionalidades) |
| Limpeza de logs antigos | Diária, 03:30 | Aplica os prazos de retenção dos logs |

- Cada execução fica registada em `tarefas_agendadas_execucoes`. Um período corre uma só vez, mesmo com várias instâncias da API.
- Se a API estiver em baixo à hora marcada, a tarefa corre quando voltar (no mesmo dia ou mês).
- Uma execução que falha é repetida até 3 vezes; à terceira falha os gestores recebem um alerta.
- Em Configurações → Tarefas automáticas o gestor vê o histórico e pode executar cada tarefa manualmente.
- `JOBS_ENABLED=false` desliga o agendador numa instância.

### Mensagens internas

Conversas 1:1 ou em grupo (até 50 pessoas) entre gestores, professores, alunos e encarregados. Disponível a partir do pacote Plus (módulo `mensagens`).

Quem pode escrever a quem:

- Toda a gente pode escrever à gestão; o gestor pode escrever a qualquer utilizador ativo.
- Professor ↔ alunos dos seus serviços (inscrições ativas) e os respetivos encarregados.
- Encarregado ↔ professores dos seus educandos.

API (`/api/mensagens`, autenticada):

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/contactos?q=` | Pessoas a quem o utilizador pode escrever |
| GET | `/conversas?arquivadas=` | Conversas com pré-visualização e nº de não lidas |
| GET | `/nao-lidas` | Total de mensagens por ler (para o contador do menu) |
| POST | `/conversas` | `{ participantes, assunto?, mensagem }`; uma conversa 1:1 sem assunto continua a existente |
| GET | `/conversas/:id/mensagens?antes=&limit=` | Mensagens, paginadas para trás |
| POST | `/conversas/:id/mensagens` | `{ corpo }` |
| POST | `/conversas/:id/lida` | Marca a conversa como lida |
| PATCH | `/conversas/:id` | `{ arquivada }` |

Cada mensagem gera uma notificação push. Às 19:00, quem tem mensagens por ler há mais de 2 horas recebe um resumo por email (tarefa `mensagens-por-ler`).

### Migrações da base de dados

As migrações são os ficheiros `backend/sql/NNN_descricao.sql`, aplicados por ordem alfabética quando a API arranca.

- Cada ficheiro aplicado fica registado na tabela `schema_migrations` e não volta a correr.
- Cada migração corre numa transação: se falhar, nada fica aplicado e o arranque é cancelado.
- Não edite uma migração já aplicada. Para alterar o schema, crie um ficheiro novo com o número seguinte.

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

Projeto desenvolvido para Portfolio
