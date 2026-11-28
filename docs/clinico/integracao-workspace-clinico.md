# Integração clínica autenticada — próxima etapa do prontuário

**Estado:** interface implementada e testada com APIs simuladas nos testes unitários. Não é homologação clínica nem autorização de uso real.

## O que existe

A tela `src/features/clinical/clinical-workspace.tsx` centraliza:

- Identidade profissional derivada do JWT pelo backend, nunca digitada pelo navegador;
- Lista paginada e isolada de pacientes vinculados ao fisioterapeuta;
- Linha do tempo de evolução, anamnese e laudo para o paciente selecionado;
- Leitura detalhada autorizada de sessões e versões documentais;
- Criação de anamnese, evolução e laudo em rascunho com formulários validados;
- Revisões e adendos com motivo obrigatório, controle da última versão e finalização sem assinatura;
- Data/hora real de sessão e fuso explicitamente preenchidos pelo profissional;
- Recarga da fonte de dados no servidor após gravação; erros 403/404/409 não são contornados com dados locais.

A rota `/prontuario-integracao` é **exclusiva de desenvolvimento**,
usa o `AppShell` autenticado e retorna 404 fora de `NODE_ENV=development`.
A tela não entra no menu da aplicação de produção. Em execução contra a
API atual, o serviço clínico retornará bloqueio/404 por definição, pois
os endpoints clínicos ainda não foram homologados nem montados em `/api/v1`.

Para teste de UX já disponível, continuar usando a demonstração fictícia
`/prontuario-demo`. Não copiar dados reais para qualquer ambiente de
desenvolvimento ou testes.

## Dependência do backend

Backend PR #13 (empilhado sobre #12 → #11 → #8) introduz:

- `GET /prontuario/identidade` → `{ data: { profissional_id } }`
- `GET /prontuario/pacientes?pagina=1&limite=20` → `{ data: { items, pagina, limite, temMais } }`

As demais rotas de documentos, sessões e histórico já foram
implementadas em PRs anteriores, mas **seguem com gate fail-closed**.

## Para habilitar somente após homologação

1. Aprovar matriz de permissões e vínculo explícito por paciente, área,
   organização e profissional, inclusive revogação imediata.
2. Validar migrations 067/068/069, acesso pelo runtime sem DDL,
   integridade dos dados, transações de auditoria e política de retenção
   em PostgreSQL isolado com usuários e pacientes sintéticos.
3. Verificar que cada requisição de histórico/detalhe/escrita volta a
   autorizar o acesso e que conteúdo clínico nunca aparece em logs.
4. Homologar identidade profissional, horário da sessão, concorrência de
   revisões e continuidade de versões.
5. Disponibilizar a rota real somente após revisão de segurança
   específica. Não confiar em `NODE_ENV` ou link oculto como controle de
   acesso — o backend deve seguir autorizando todas as operações.
6. Elaborar mecanismo oficial de assinatura, identificação profissional
   e integridade de laudos antes de emissão com validade documental.

## Restrições deliberadas

- A interface de homologação ainda não edita evoluções já registradas.
  A consulta de histórico de correções e a edição segura por versão exigem
  fechamento do contrato de correções de sessão.
- Nenhuma funcionalidade de exportação ou assinatura oficial de laudos.
- A lista de pacientes **não usa** `GET /clientes`, que é cadastro comercial
  e não contém a autorização clínica necessária.
- A nova tela não utiliza `.local/prontuario-demo.json` nem qualquer
  armazenamento de prontuário no navegador.
