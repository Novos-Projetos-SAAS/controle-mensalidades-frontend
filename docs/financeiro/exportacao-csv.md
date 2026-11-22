# Exportação de mensalidades CSV — escopo e segurança

- Ação exclusivamente manual, no painel Financeiro (requer autorização administrativa já existente).
- Exporta **somente a página atualmente carregada** depois dos filtros e da busca local, não todas as páginas.
- Dados exportados: cliente (nome), competência, vencimento, situação, valor final, pago, saldo. Sem CPF, contatos ou informações clínicas.
- UTF-8 com BOM, delimitador ponto e vírgula, aspas escapadas; protege contra injeção de fórmulas `= + - @` no início do conteúdo (ignorando espaços iniciais).
- Não cria nenhum endpoint, não envia dados a serviços externos, não persiste o CSV no navegador e não altera pagamentos, gateways ou o Neon.
- Quem exportar deve armazenar e compartilhar o CSV apenas em local autorizado, pois ele contém dados financeiros e nomes de clientes.
- Para exportação de todos os registros, criar futuramente job/endpoint autenticado e auditado com limites/paginação; esta função não afirma exportação completa.
