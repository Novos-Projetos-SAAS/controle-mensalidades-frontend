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
