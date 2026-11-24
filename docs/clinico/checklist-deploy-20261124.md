# Checklist do primeiro deploy dos repositórios — 24/11/2026

Este roteiro é para colocar **frontend e backend existentes** no ar e validar
conectividade. Não autoriza usar dados reais no prontuário. O módulo clínico
não está homologado e as rotas de laudos/sessões/documentos continuam fora da API.

## 1. Antes de fazer deploy

- Publicar a `main` dos dois repositórios como versão estável e registrar os
  respectivos SHAs/versões. A branch de testes do backend de prontuário está
  empilhada: PR #8 → #11 → #12, todos **em revisão**, sem merge na main.
- No frontend: `npm ci`, `npm run typecheck`, `npm run lint`,
  `npm test` e `npm run build`. Servidor de produção: `npm run start`.
- No backend: `npm ci`, `npm run typecheck`, `npm run lint` e
  `npm run build`. Executar testes que dependem de banco somente em
  PostgreSQL local descartável, **nunca no Neon real**.
- Confirmar que os serviços do ambiente de deploy possuem logs e alertas
  operacionais sem conteúdo clínico, dados pessoais ou secrets.
- Não copiar `.local/prontuario-demo.json` da máquina de desenvolvimento
  para hospedagem. Este arquivo contém apenas exemplos fictícios e não é banco.

## 2. Configuração segura (sem copiar segredos para o Git)

**Frontend (Next.js)**

- `BACKEND_URL`: URL base do backend acessível ao **servidor Next.js**,
  sem sufixo `/api` e sem caminhos, query ou credenciais embutidas.
- Em preview/produção, usar HTTPS; a camada de proxy atual recusa HTTP
  não-local e bloqueia redirecionamento automático da API.
- Não usar `NEXT_PUBLIC_BACKEND_URL` nem colocar tokens/chaves de banco no
  frontend. O acesso à API passa pelo proxy server-side `/api/v1/...`.
- Cookie de autenticação, SameSite, Secure, domínio, origem do frontend
  e CORS do backend devem ser verificados no domínio real.

**Backend (Express)**

- `NODE_ENV=production`, `PORT`, `DATABASE_URL`, `DB_SSL=true`
  e `JWT_SECRET` gerado e guardado no secret manager.
- `DATABASE_URL_MIGRATIONS`: **somente no job controlado de migração**,
  com credencial separada da role runtime. Não rodar migrations automaticamente
  no start da aplicação sem change aprovado.
- `CPF_CRYPTO_MODE` e as chaves de CPF devem corresponder ao estado
  realmente migrado do banco. Não trocar modo ou chaves durante deploy
  sem revisar a estratégia de transição. Não gerar chaves novas para
  dados já criptografados.
- `WHATSAPP_META_REAL_SEND_ENABLED=false` até o fluxo de envio real ser
  liberado separadamente.
- Confirmar configuração de origens CORS, limites de conexões, TLS
  `verify-full`, role runtime sem DDL e acesso apenas à organização correta.

## 3. Testes de fumaça após subir (somente leitura, sem dados reais)

Substitua `https://SEU-FRONTEND` e `https://SEU-BACKEND` pelos hosts reais.

1. Abrir a página de login no frontend em HTTPS.
2. Conferir `GET https://SEU-BACKEND/api/v1/health`: resposta HTTP 200
   (ou o contrato de health documentado pela versão implantada).
3. Conferir `GET https://SEU-FRONTEND/api/v1/health`: deve chegar ao
   backend via proxy HTTPS, sem erro 503 por `BACKEND_URL`.
4. Sem sessão, `GET https://SEU-FRONTEND/api/v1/auth/me`
   não deve retornar dados do usuário — esperado HTTP 401.
5. Em produção, `GET https://SEU-FRONTEND/api/prontuario-demo` deve
   responder **404**: este simulador é apenas local e não deve ficar público.
6. A API clínica real não deve estar publicada. Consultas a
   `/api/v1/documentos-clinicos`, `/api/v1/vinculos-clinicos` e
   `/api/v1/prontuario/pacientes/00000000-0000-4000-8000-000000000001/historico`
   devem continuar indisponíveis (tipicamente 404 no roteador público).
7. Validar login e logout apenas com conta de homologação, sem registrar
   credenciais/cookies nos logs ou screenshots.

## 4. Critérios de parada

Interromper o rollout se a API exigir desativar TLS, expuser `.env`,
`DATABASE_URL`, cookie de sessão, CPF, conteúdo clínico, se o proxy
encaminhar para outro host, se a role runtime puder alterar migrations
ou se qualquer rota clínica real estiver acessível sem homologação.

Em falha de deploy, voltar ao commit anterior da aplicação **sem derrubar
tabelas, sem executar `migrate:rollback` e sem apagar histórico clínico**.

## 5. Etapa posterior — persistência clínica de verdade

- Revisar e homologar as migrations 067 (evolução), 068 (documentos
  versionados) e 069 (vínculo paciente–fisioterapeuta).
- Selecionar branch/instância de **homologação do Neon**, sem pacientes reais,
  com credenciais runtime e migrations distintas, restauração testada e
  ambiente explicitamente identificado.
- Validar role, grants, triggers, SSL, auditoria, acesso próprio/alheio,
  revogação do vínculo e backup/restauração.
- Somente após aprovação, conectar uma tela clínica autenticada aos
  endpoints liberados de forma controlada; a API atual os mantém bloqueados.
- Produção com pacientes reais exige autorização adicional e políticas
  de privacidade, retenção e emissão/assinatura de documentos clínicos.

Roteiros e decisões existentes: backend
`docs/clinico/criterios-entrada-homologacao.md` e
`docs/clinico/plano-liberacao-controlada.md`.
