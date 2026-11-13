# Orbe Gestão

Frontend Next.js para o backend `controle-mensalidades-backend`. Interface em português brasileiro, autenticação por cookie HttpOnly e PWA com cache apenas de recursos públicos.

## Desenvolvimento

1. Rode o backend localmente e confira sua porta.
2. Copie `.env.example` para `.env.local` e ajuste `BACKEND_URL`.
3. Execute `npm install` e `npm run dev`.

O endereço padrão do backend é `http://localhost:3333`. O frontend fica em `http://localhost:3000`.

## Verificação

`npm run typecheck`, `npm run lint`, `npm run test` e `npm run build`.

Para a integração real, execute `npm run test:e2e`. O comando compila o frontend, inicia a API e o Next.js localmente, cria dados exclusivamente fictícios no banco de testes e os remove ao terminar. Consulte [o procedimento E2E](docs/integracao-e2e.md) antes de executar.

## Integração

Rotas utilizadas: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`, `POST /api/v1/auth/logout`, `GET /api/v1/areas-negocio`, `GET /api/v1/areas-negocio/:areaNegocioId/modulos`, `GET/POST/PATCH /api/v1/clientes`, `GET/POST/PATCH /api/v1/profissionais`, `GET /api/v1/usuarios` e `PATCH /api/v1/profissionais/:id/usuario`, incluindo detalhes e ativação/inativação.

Profissionais dependem do módulo `AGENDA` habilitado na área. O [financeiro](docs/financeiro.md) usa as rotas reais disponíveis para administradores; o E2E local no banco exclusivo de testes cobre recebimento manual e replay idempotente. O módulo clínico não é acessado pelo frontend.

Confira [a instalação Android/iPhone](docs/android.md) e a [checklist HTTPS](docs/publicacao-https.md) antes da homologação.
