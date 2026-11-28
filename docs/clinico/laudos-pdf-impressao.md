# Laudos: visualização, download e impressão

Na branch clínica `feat/prontuario-workspace-postgres-20261125`:

1. Entre com fisioterapeuta autorizado, selecione organização e área.
2. Abra `/prontuario`, escolha o paciente e clique em **Novo laudo**.
3. Preencha e **Salve rascunho**. Na linha do tempo, clique em **Consultar registro**.
4. Você pode **Corrigir documento** ou **Finalizar sem assinatura**.
5. Selecione a versão apropriada e use **Visualizar PDF**, **Baixar PDF** ou **Imprimir**.
6. O botão **Imprimir** usa a janela de impressão do visualizador de PDF do navegador. Se o navegador bloquear a impressão automática, abra a prévia e imprima pelo leitor de PDF.

A impressão usa o PDF A4 gerado pelo backend, autenticado e com registro de auditoria. Nenhum dado clínico é salvo em localStorage; ao fechar a prévia o arquivo temporário é liberado da memória.

**Rascunhos, versões históricas e documentos sem assinatura digital são explicitamente marcados.** Finalizar não aplica assinatura digital. Para assinatura física, imprimir e assinar manualmente. Conferir nome, conselho/registro do profissional e conteúdo antes da impressão.

Backend local deve estar na branch clínica com `BACKEND_URL=http://localhost:3334` no `.env.local` do frontend. As migrations 068–070 já aplicadas no `mensalidades-desenv` são suficientes; não há nova migration.

A funcionalidade permanece apenas em desenvolvimento até aprovação da segurança clínica.
