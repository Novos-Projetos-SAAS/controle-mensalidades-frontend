# Publicação privada HTTPS — checklist

## Antes de conectar serviços

- [ ] Obter autorização específica para publicar. A pasta local do frontend **não contém `.git`** e não há repositório frontend localizado na organização GitHub conectada. Recuperar o repositório original, se existir; caso contrário, criar depois um repositório **privado**, cloná-lo em outra pasta e copiar este código sem `node_modules`, `.next`, `.env.local` ou credenciais. Conferir diferenças e histórico antes de qualquer commit/push. Não versionar a pasta do backend junto.
- [ ] Preparar uma base de homologação **separada da produção**, com dados fictícios e credenciais próprias; uma [branch isolada no Neon](https://neon.com/branching) é uma opção. Configurar `DATABASE_URL`/TLS apenas no backend. Nunca colocar URL do banco ou `JWT_SECRET` no frontend, nem apontar o E2E ao banco de homologação/produção.

## Vercel, Render e URL da API

- [ ] Importar o repositório privado do frontend na Vercel como **Next.js**, com a raiz deste projeto. Não usar exportação estática: `/api/*` é uma rota de servidor. Definir `BACKEND_URL` somente no ambiente **Preview** de homologação, como origem HTTPS do backend Render, sem `/api` final e sem prefixo `NEXT_PUBLIC_`. A rota devolve 503 se a variável faltar fora do desenvolvimento ou se apontar para HTTP fora de loopback. [Next.js na Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs), [variáveis por ambiente](https://vercel.com/docs/environment-variables).
- [ ] Ativar [Deployment Protection](https://vercel.com/docs/deployment-protection) antes de compartilhar a URL: **Standard Protection** cobre previews; um domínio de produção privado exige **All Deployments** e plano compatível. Manter também o login do Orbe. Não promover a preview nem associar domínio público durante a homologação privada.
- [ ] Hospedar a API de homologação no Render com HTTPS e URL pública alcançável pela Vercel; o DNS da [rede privada do Render](https://render.com/docs/private-network) atende serviços Render na mesma rede, não a função Vercel. No backend de homologação, configurar `NODE_ENV=production`, `PORT`, `JWT_SECRET` exclusivo e `DATABASE_URL` do Neon de homologação; definir health check `/api/v1/health`. [Web services Render](https://render.com/docs/web-services), [health checks](https://render.com/docs/health-checks).
- [ ] O navegador deve chamar somente `/api/*` na origem Vercel. A rota repassa cookie, `x-organizacao-id`, `x-area-negocio-id` e `Idempotency-Key` ao Express. Com essa arquitetura, CORS não é necessário no navegador; se futuramente houver chamada direta ao Render, configurar `CORS_ALLOWED_ORIGINS` com origem HTTPS exata e credenciais, sem `*`. CORS não substitui autenticação.

## Segurança e fumaça na URL HTTPS

- [ ] Conferir cookie `token` com HttpOnly, Secure, SameSite=Lax e sem acesso por JavaScript; login, expiração e logout. Verificar `Cache-Control: private, no-store` em `/financeiro`, `/clientes` e respostas `/api/*`; `nosniff`, `Referrer-Policy` e `X-Frame-Options`. Conferir que Cache Storage guarda só `/offline.html` e ícones, nunca sessão, clientes ou pagamentos.
- [ ] Com conta administrativa e dados **fictícios**: entrar; alternar organização e área e confirmar isolamento; abrir clientes; listar mensalidades e conferir saldo/BRL; registrar **um** recebimento manual autorizado para teste, conferir exatamente um pagamento e indicadores atualizados; sair e confirmar redirecionamento e 401 em `/api/v1/auth/me`. Em caso de resultado incerto, consultar histórico antes de repetir a mesma chave/payload. Confirmar que não há navegação nem página clínica no frontend.
- [ ] Em Android Chrome e iPhone Safari reais, testar instalação, ícones, standalone, safe areas, teclado, offline sem dados privados e atualização do service worker. Seguir [o roteiro móvel](android.md). Executar `typecheck`, `lint`, `test`, `build` localmente; `test:e2e` só com o banco exclusivo descrito em [integração E2E](integracao-e2e.md).

## Reversão

- [ ] Registrar o deployment Vercel e o deploy Render anteriores antes de liberar acesso. Se a fumaça falhar, interromper o acesso e restaurar o [deployment Vercel anterior](https://vercel.com/docs/deployments/rollback-production-deployment) e/ou o [deploy Render anterior](https://render.com/docs/rollbacks). Revalidar login e API. Reverter código não desfaz dados ou migrations: planejar separadamente qualquer restauração da branch Neon. Nenhuma migration ou publicação faz parte desta etapa.
