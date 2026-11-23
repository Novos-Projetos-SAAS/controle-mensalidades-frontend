## Treinamento local navegavel — demonstracao da fisioterapeuta

**Disponível no código da branch `feat/prontuario-simulador-fisioterapeuta-20261122`.**

Com Node.js 22 e dependências instaladas no frontend:

```powershell
npm ci
npm run dev
```

Abra **http://localhost:3000/prontuario-demo**. É uma rota de **desenvolvimento** (responde 404 em build de produção). Quando houver login no sistema de gestão, existe também atalho `Prontuário (treinamento)` no menu de desenvolvimento; o acesso direto à rota não depende de login nem do backend, pois todos os dados são inventados.

### Roteiro de teste

1. Entre como `Fisioterapeuta de demonstração` (identidade fictícia já exibida).
2. Escolha `Paciente Exemplo A` e consulte o histórico de anamnese e de evolução, incluindo o campo **O que foi trabalhado**.
3. Corrija a evolução e informe um motivo; confirme que as versões 1 e 2 ficam disponíveis.
4. Finalize um registro **apenas na simulação** e inclua um adendo; confirme que não há alteração retroativa.
5. Crie nova anamnese e novo laudo para `Paciente Exemplo C` e consulte as respectivas versões.
6. Troque de paciente para comprovar que não aparecem os registros do outro paciente no estado local.
7. Clique em `Reiniciar treinamento` ou recarregue a página para limpar as alterações.

**ATENÇÃO:** nenhum dado é persistido. O estado fica apenas na memória React. Não há request de dados clínicos ao backend, banco, cookies clínicos, localStorage, sessionStorage, exportação, PDF, assinatura, RBAC de produção nem auditoria de leitura. **Nunca digite dados reais nesta simulação.** Ela valida somente a experiência visual e as regras de versões no cliente, não a segurança do prontuário de produção.

### Critérios para o prontuário real

Para disponibilizar a ficha real aos fisioterapeutas, ainda são indispensáveis: contrato HTTP validado, persistência PostgreSQL no ambiente isolado, autenticação e autorização clínica específicas por organização/área/profissional/paciente, auditoria de leitura/escrita com operações transacionais, proteção de versões, testes de autorização e revogação, gestão de versões finais/assinaturas, backup/restauração verificada, logs sem dados de saúde e homologação com o responsável pelo projeto.

Backend #8 adiciona a evolução estruturada, mas continua draft; backend #11 prepara anamnese/laudo versionados e também continua draft. O simulador não contorna esses bloqueios.

---

# Frente clínica — prontuário da fisioterapia

## Situação de desenvolvimento (22/11/2026)

Este PR disponibiliza **somente componentes e validações de rascunho, não montados em rotas navegáveis**. Não persiste dados sensíveis, não chama API, não usa localStorage e não emite PDF/laudo assinado.

As rotas de sessões clínicas do backend continuam intencionalmente fora de `/api/v1` e o gate `ACESSO_CLINICO_NAO_CONFIGURADO` continua ativo. **Não remover o gate nem publicar o prontuário** antes dos controles exigidos em `docs/clinico/criterios-entrada-homologacao.md` do backend.

## Fluxo solicitado

1. **Ficha do paciente / anamnese:** queixa principal, história da condição atual, antecedentes, medicamentos/alergias informados, limitações funcionais, objetivos e avaliação inicial.
2. **Evolução por sessão:** data, objetivo, avaliação prévia, **o que foi trabalhado**, exercícios e dosagens, resposta do paciente, evolução clínica, orientações e planejamento da próxima sessão.
3. **Laudo fisioterapêutico:** finalidade, fundamentação, achados, diagnóstico fisioterapêutico, conclusão e recomendações; a autoria técnica pertence ao fisioterapeuta. Rascunho não é laudo assinado.
4. **Histórico cronológico:** metadados mínimos em lista; detalhes só após autorização específica e auditoria de leitura. Correção deve guardar trilha, jamais sobrescrever silenciosamente.

## Contrato com o backend antes de disponibilizar

- Reutilizar a identidade clínica vinculada ao `usuario_id` e permissão explícita `profissionais_areas.acesso_clinico_autorizado`. Perfil ADMINISTRADOR/OPERADOR **não** concede por si só leitura de prontuário.
- O endpoint de sessões existente tem `evolucao`, `diagnostico_fisioterapeutico`, `prognostico`, `plano_terapeutico` e `observacoes`, mas **não** armazena separadamente o que foi trabalhado, séries ou resposta. Persistir os campos estruturados exige contrato e modelagem revisados; não descartar silenciosamente campos.
- Existem tabelas `formularios` (tipo ANAMNESE), `sessoes_atividades` e `documentos_clinicos`, mas não há API liberada de anamnese/laudo: definir serviço de armazenamento, vínculo ao paciente, versões e assinatura profissional antes de usar.
- Garantir escopo por organização + área + profissional, isolamento de paciente, revogação imediata, trilha de leitura/alteração, integridade do histórico e testes PostgreSQL com dados fictícios.
- Definir política de retenção, backups/restauração, segregação de privilégios e inspeção de logs para dados de saúde antes de homologação com paciente real.
- A futura API de assinatura e PDF precisa de validação profissional, versão, identificação do emissor e integridade do documento. Não gerar conclusões médicas automaticamente.
- Nunca enviar informações clínicas à InfinitePay, WhatsApp ou telemetria por padrão.

## Próximas entregas

1. Contratos protegidos e testes de leitura, anamnese, evolução por sessão, correção e laudo em PostgreSQL descartável.
2. Persistência auditada e assinatura com RBAC clínico específico, revisão de segurança/backup e homologação isolada.
3. Publicação controlada da tela no cadastro do paciente **apenas depois** da liberação do backend.


## Prévia imprimível do laudo no simulador

Após criar um **laudo fictício**, selecione-o na linha do tempo e utilize
**Imprimir prévia fictícia**. A impressão do navegador mostra somente a
versão escolhida, com campos organizados, identificação do profissional
de demonstração e avisos permanentes de **SIMULAÇÃO · SEM VALIDADE**,
**NÃO É DOCUMENTO ASSINADO**.

A ação não emite laudo oficial, não cria PDF assinado, não envia
dados ao servidor e não persiste documentos. O navegador pode permitir
"Salvar como PDF" da prévia, que continuará marcada como fictícia.
Não digitar pacientes reais no modo treinamento.
