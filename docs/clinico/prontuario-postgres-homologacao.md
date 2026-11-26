**ATUALIZAÇÃO (26/11/2026):** O banco de desenvolvimento escolhido é `mensalidades-desenv`, e não a branch Neon de homologação citada abaixo. Para preparar o backend use `docs/clinico/persistencia-postgresql-desenv.md` na branch clínica do backend e o comando `npm run prontuario:migrate:desenv`. Não executar migrations na branch de teste por engano.

---

# Prontuário com persistência no PostgreSQL — somente homologação

O novo prontuário **não** usa o arquivo local da demonstração e não guarda
a anamnese, evolução ou laudo somente em React. As telas se comunicam
com o backend autenticado, que grava em PostgreSQL/Neon.

## Rodar localmente

Antes de abrir a interface, o responsável pelo backend deve preparar a
branch Neon isolada `homologacao-prontuario-20261125`, projeto
`mensalidades-test`, e executar as migrations 067/068/069/070 pelo
Knex com o comando controlado:

`npm run prontuario:migrate:homologacao`

Veja `backend/docs/clinico/persistencia-postgresql-homologacao.md`.
Não executar em `mensalidades-desenv` ou na branch principal do Neon.

No frontend:

```powershell
git fetch origin
git switch feat/prontuario-workspace-postgres-20261125
git pull --ff-only origin feat/prontuario-workspace-postgres-20261125
npm ci
```

Crie/ajuste `.env.local`:

```dotenv
BACKEND_URL=http://localhost:3333
```

Em terminais separados, inicie o backend preparado e o frontend com
`npm run dev` em cada repositório.

### Para o administrador

Abra `http://localhost:3000/prontuario-vinculos` e selecione
organização e área. Use somente clientes e profissionais fictícios.

Atribua um paciente ao profissional, cuja conta deve estar vinculada
a seu cadastro e autorizada para atendimento na área. Essa permissão
é gravada no banco e pode ser revogada.

### Para o fisioterapeuta

Faça login na conta autorizada e abra
`http://localhost:3000/prontuario`. O profissional consegue:

- Escolher somente seus pacientes vinculados;
- Criar anamnese versionada;
- Registrar evolução de sessão (objetivos, exercícios, procedimentos,
  resposta, orientações, plano);
- Criar laudo em rascunho;
- Consultar linha do tempo, versões e adendos após recarregar;
- Não ver prontuário de outro profissional, paciente ou organização.

Os dados ficam na branch Neon isolada, não no estado do navegador.
O simulador anterior permanece acessível em
`http://localhost:3000/prontuario-demo` e usa arquivo local para fins
estritamente fictícios.

## Segurança / limites

As rotas `/prontuario` e `/prontuario-vinculos` existem somente
em `NODE_ENV=development`, retornando **404 em produção**. O backend
só as publica em desenvolvimento com opt-in explícito e migrations
aplicadas. A autorização clínica permanece no servidor.

Não usar dados reais, não desabilitar gate, não copiar credenciais Neon
para o frontend, não aplicar migrações em banco compartilhado ou na
produção. Documentos gerados não têm assinatura digital ou validade
profissional nesta etapa.

Esta entrega é preparatória para homologação e ainda não substitui
revisão de LGPD, backup/restauração, concessões de banco, segregação
multi-organização e liberação clínica oficial.
