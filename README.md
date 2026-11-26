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

## InfinitePay

Administradores configuram a integração da organização em **Financeiro → InfinitePay**: ativação, InfiniteTag, chave da conta e geração automática um ou dois dias antes do vencimento. A chave existente nunca é exibida; deixar o campo vazio mantém a credencial cadastrada. Nos detalhes de cada mensalidade, **Gerar link de pagamento** cria ou recupera a cobrança do saldo atual e permite copiar a página privada para o cliente. O recebimento manual permanece disponível.

O cliente acessa `/pagamento/:token` sem login e vê apenas valor, vencimento, situação e checkout. O retorno fixo `/pagamento/retorno` encaminha os identificadores à API; parâmetros do navegador não confirmam pagamento. As consultas automáticas ocorrem a cada 15 segundos, somente com a página visível, por no máximo 20 consultas, e param ao encerrar a cobrança. É possível atualizar a situação manualmente.

O frontend reutiliza exclusivamente `BACKEND_URL`. O proxy define `x-platform-origin` a partir da origem da requisição no servidor; essa origem precisa estar autorizada no CORS existente do backend e acessível por HTTPS para callbacks reais. Não cadastre URL pública de backend nem URL de retorno. A única variável nova da integração, `INFINITEPAY_ENCRYPTION_KEY`, pertence ao backend. Homologação real da conta e do webhook continua necessária antes de ativar.

Os testes de browser `e2e/infinitepay.spec.ts` usam APIs simuladas, sem conta InfinitePay ou banco: com o build servido localmente, execute `$env:E2E_BASE_URL='http://127.0.0.1:3012'; npx --no-install playwright test e2e/infinitepay.spec.ts` no PowerShell. O restante da suíte E2E segue exigindo o banco exclusivo de testes documentado acima.
