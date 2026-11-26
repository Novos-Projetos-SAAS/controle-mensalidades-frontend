# AGENTS.md — Controle de Mensalidades (instruções do repositório)

> Este arquivo complementa as regras globais de `~/.codex/AGENTS.md`. Revalide as informações contra o código atual, pois decisões e branches podem evoluir.

## Contexto inicial, sujeito à verificação

SaaS multi-tenant e multiárea para academia, Pilates e fisioterapia, com clientes/pacientes, agenda, prontuário, mensalidades, contas a receber, pagamentos e WhatsApp.

- Backend esperado: Node.js, Express, TypeScript/ESM, PostgreSQL, Knex, REST, Zod e testes automatizados.
- Frontend esperado: Next.js e TypeScript, com experiência mobile-first.
- Integrações: WhatsApp Cloud API e pagamentos por interface genérica de provedor.
- Preferência mais recente de produto: InfinitePay para a V1; confirmar suporte e estado real no código antes de afirmar que está implementado.
- Pode haver repositórios separados para frontend e backend. Não assuma a branch em uso; inspecione Git.

## Restrições de domínio

1. **Isolamento:** todas as operações sobre clientes, pagamentos e prontuários devem respeitar a organização e a autorização do usuário.
2. **Modelo financeiro:** origem (mensalidade, sessão, pacote ou venda) → conta a receber → tentativa de cobrança → pagamento/baixa. Não acople o domínio ao SDK da InfinitePay ou de outro provedor.
3. **Pagamentos:** valor calculado no servidor, cobranças idempotentes, webhooks persistidos e verificados, baixa transacional, conciliação e testes de duplicidade/concurrency. Não assumir capacidade de cancelamento/estorno sem consultar a API vigente.
4. **WhatsApp:** respeitar aceite/opt-out, régua de cobrança e revalidação do estado financeiro antes de enviar. Não enviar lembretes para obrigações já quitadas/canceladas.
5. **Prontuário:** dados de saúde demandam proteção reforçada, permissões específicas, histórico e auditoria; não misturar dados clínicos com logs e mensagens de cobrança.
6. **Banco:** inspecionar migrations e constraints existentes antes de criar alterações. Preferir migrations aditivas; nunca editar migrations históricas já aplicadas.
7. **Ambientes:** development, test e production são distintos. Nunca executar migração ou teste destrutivo em produção sem autorização explícita.

## Fluxo por tarefa

- Verifique os `AGENTS.md` relevantes e inspecione o código antes de planejar.
- Faça o menor recorte funcional seguro do MVP.
- Para bugs: reproduza, localize causa, corrija e adicione teste de regressão.
- Para UI: valide loading, erro, vazio, responsividade e acessibilidade.
- Para finanças/prontuário: redobre os testes de autorização, privacidade e isolamento multi-tenant.
- Execute typecheck, lint, testes e build quando disponíveis; relate falhas.
- Ao finalizar, forneça branch/commit **somente se verificados**, arquivos alterados, testes e instruções de teste local.

## Referência de planejamento

Trello: https://trello.com/b/LSGRTfAl/controle-de-mensalidades-academia

Use o Trello para contexto e prioridades quando acessível, mas não o trate como evidência de que uma funcionalidade existe no repositório. Não atualize cartões sem solicitação do usuário.
