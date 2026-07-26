-- Token opaco e revogavel por utilizador, usado para autenticar o feed
-- iCalendar (.ics) publico (GET /api/public/agenda.ics?token=...). E'
-- distinto do JWT de sessao porque o feed e' acedido diretamente por apps
-- externas (Google Calendar, Outlook, Apple Calendar) via GET simples, sem
-- cookies nem headers customizados.
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS calendar_token TEXT UNIQUE;
