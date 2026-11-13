import crypto from 'node:crypto';
import connection from '../../controle-mensalidades-backend/src/database/connection.ts';
import { hashPassword } from '../../controle-mensalidades-backend/src/utils/senha.utils.ts';

function requireTestDatabase() {
  if (
    process.env.NODE_ENV !== 'test' ||
    process.env.AMBIENTE_BANCO !== 'teste' ||
    !process.env.DATABASE_URL_TEST
  ) {
    throw new Error('A fixture exige NODE_ENV=test, AMBIENTE_BANCO=teste e DATABASE_URL_TEST.');
  }
  if (process.env.DATABASE_URL_TEST === process.env.DATABASE_URL) {
    throw new Error('O banco de testes não pode ser o de desenvolvimento.');
  }
}

function ids() {
  return crypto.randomUUID();
}

async function setup() {
  const runId = ids();
  const fixture = {
    runId,
    orgA: ids(),
    orgB: ids(),
    areaA1: ids(),
    areaA2: ids(),
    areaB1: ids(),
    adminId: ids(),
    operatorId: ids(),
    availableUserId: ids(),
    clientA1: ids(),
    clientA2: ids(),
    clientB1: ids(),
    professionalA1: ids(),
    professionalB1: ids(),
    adminEmail: `orbe-e2e-admin-${runId}@teste.local`,
    adminPassword: `Orbe!${ids()}Aa1`,
    operatorEmail: `orbe-e2e-operator-${runId}@teste.local`,
    operatorPassword: `Orbe!${ids()}Aa1`,
  };
  const agenda = await connection('modulos')
    .select('id')
    .where({ codigo: 'AGENDA', ativo: true })
    .whereNull('deletado_em')
    .first();
  if (!agenda) throw new Error('O módulo AGENDA não está disponível no banco de testes.');
  const [adminHash, operatorHash, availableHash] = await Promise.all([
    hashPassword(fixture.adminPassword),
    hashPassword(fixture.operatorPassword),
    hashPassword(`Orbe!${ids()}Aa1`),
  ]);
  await connection.transaction(async (tx) => {
    await tx('organizacoes').insert([
      { id: fixture.orgA, nome: `E2E Orbe A ${runId}`, ativo: true },
      { id: fixture.orgB, nome: `E2E Orbe B ${runId}`, ativo: true },
    ]);
    await tx('areas_negocio').insert([
      {
        id: fixture.areaA1,
        organizacao_id: fixture.orgA,
        nome: 'Área E2E A1',
        codigo: 'E2E-A1',
        ativo: true,
      },
      {
        id: fixture.areaA2,
        organizacao_id: fixture.orgA,
        nome: 'Área E2E A2',
        codigo: 'E2E-A2',
        ativo: true,
      },
      {
        id: fixture.areaB1,
        organizacao_id: fixture.orgB,
        nome: 'Área E2E B1',
        codigo: 'E2E-B1',
        ativo: true,
      },
    ]);
    await tx('usuarios').insert([
      {
        id: fixture.adminId,
        nome: 'Administrador E2E',
        email: fixture.adminEmail,
        senha_hash: adminHash,
        ativo: true,
      },
      {
        id: fixture.operatorId,
        nome: 'Operador E2E',
        email: fixture.operatorEmail,
        senha_hash: operatorHash,
        ativo: true,
      },
      {
        id: fixture.availableUserId,
        nome: 'Usuário disponível E2E',
        email: `orbe-e2e-disponivel-${runId}@teste.local`,
        senha_hash: availableHash,
        ativo: true,
      },
    ]);
    await tx('usuarios_organizacoes').insert([
      {
        usuario_id: fixture.adminId,
        organizacao_id: fixture.orgA,
        perfil: 'ADMINISTRADOR',
        ativo: true,
      },
      {
        usuario_id: fixture.adminId,
        organizacao_id: fixture.orgB,
        perfil: 'ADMINISTRADOR',
        ativo: true,
      },
      {
        usuario_id: fixture.operatorId,
        organizacao_id: fixture.orgA,
        perfil: 'OPERADOR',
        ativo: true,
      },
      {
        usuario_id: fixture.availableUserId,
        organizacao_id: fixture.orgA,
        perfil: 'OPERADOR',
        ativo: true,
      },
    ]);
    await tx('organizacoes_modulos').insert([
      { organizacao_id: fixture.orgA, modulo_id: agenda.id, habilitado: true },
      { organizacao_id: fixture.orgB, modulo_id: agenda.id, habilitado: true },
    ]);
    await tx('areas_modulos').insert([
      { area_negocio_id: fixture.areaA1, modulo_id: agenda.id, habilitado: true },
      { area_negocio_id: fixture.areaA2, modulo_id: agenda.id, habilitado: false },
      { area_negocio_id: fixture.areaB1, modulo_id: agenda.id, habilitado: true },
    ]);
    await tx('clientes').insert([
      { id: fixture.clientA1, organizacao_id: fixture.orgA, nome: 'Cliente E2E A1', ativo: true },
      { id: fixture.clientA2, organizacao_id: fixture.orgA, nome: 'Cliente E2E A2', ativo: true },
      { id: fixture.clientB1, organizacao_id: fixture.orgB, nome: 'Cliente E2E B1', ativo: true },
    ]);
    await tx('clientes_areas').insert([
      { cliente_id: fixture.clientA1, area_negocio_id: fixture.areaA1, ativo: true },
      { cliente_id: fixture.clientA2, area_negocio_id: fixture.areaA2, ativo: true },
      { cliente_id: fixture.clientB1, area_negocio_id: fixture.areaB1, ativo: true },
    ]);
    await tx('profissionais').insert([
      {
        id: fixture.professionalA1,
        organizacao_id: fixture.orgA,
        nome: 'Profissional E2E A1',
        ativo: true,
      },
      {
        id: fixture.professionalB1,
        organizacao_id: fixture.orgB,
        nome: 'Profissional E2E B1',
        ativo: true,
      },
    ]);
    await tx('profissionais_areas').insert([
      {
        profissional_id: fixture.professionalA1,
        area_negocio_id: fixture.areaA1,
        ativo: true,
        acesso_clinico_autorizado: false,
      },
      {
        profissional_id: fixture.professionalB1,
        area_negocio_id: fixture.areaB1,
        ativo: true,
        acesso_clinico_autorizado: false,
      },
    ]);
  });
  process.stdout.write(`${JSON.stringify(fixture)}\n`);
}

async function cleanup() {
  const raw = process.env.E2E_FIXTURE_IDS;
  if (!raw) throw new Error('IDs da fixture não informados.');
  const fixture = JSON.parse(raw) as {
    runId: string;
    orgA: string;
    orgB: string;
    adminId: string;
    operatorId: string;
    availableUserId: string;
  };
  const orgIds = [fixture.orgA, fixture.orgB];
  const userIds = [fixture.adminId, fixture.operatorId, fixture.availableUserId];
  const matches = await connection('organizacoes').select('id', 'nome').whereIn('id', orgIds);
  if (
    matches.length !== 2 ||
    matches.some((org) => !org.nome.startsWith('E2E Orbe ') || !org.nome.endsWith(fixture.runId))
  ) {
    throw new Error('A identidade da fixture não confere; limpeza cancelada.');
  }
  await connection.transaction(async (tx) => {
    const clientIds = (await tx('clientes').select('id').whereIn('organizacao_id', orgIds)).map(
      (row) => row.id,
    );
    const professionalIds = (
      await tx('profissionais').select('id').whereIn('organizacao_id', orgIds)
    ).map((row) => row.id);
    const areaIds = (await tx('areas_negocio').select('id').whereIn('organizacao_id', orgIds)).map(
      (row) => row.id,
    );
    const monthlyIds = (
      await tx('mensalidades').select('id').whereIn('organizacao_id', orgIds)
    ).map((row) => row.id);
    const accountIds = (
      await tx('contas_receber').select('id').whereIn('organizacao_id', orgIds)
    ).map((row) => row.id);
    await tx('registros_auditoria').whereIn('organizacao_id', orgIds).del();
    if (monthlyIds.length)
      await tx('historico_mensalidades').whereIn('mensalidade_id', monthlyIds).del();
    if (accountIds.length) {
      await tx('pagamentos').whereIn('conta_receber_id', accountIds).del();
      await tx('cobrancas_pagamento').whereIn('conta_receber_id', accountIds).del();
    }
    await tx('mensalidades').whereIn('organizacao_id', orgIds).del();
    await tx('contas_receber').whereIn('organizacao_id', orgIds).del();
    await tx('assinaturas').whereIn('organizacao_id', orgIds).del();
    await tx('planos_comerciais').whereIn('organizacao_id', orgIds).del();
    if (clientIds.length) await tx('clientes_areas').whereIn('cliente_id', clientIds).del();
    if (professionalIds.length)
      await tx('profissionais_areas').whereIn('profissional_id', professionalIds).del();
    await tx('clientes').whereIn('organizacao_id', orgIds).del();
    await tx('profissionais').whereIn('organizacao_id', orgIds).del();
    if (areaIds.length) await tx('areas_modulos').whereIn('area_negocio_id', areaIds).del();
    await tx('organizacoes_modulos').whereIn('organizacao_id', orgIds).del();
    await tx('usuarios_organizacoes').whereIn('usuario_id', userIds).del();
    await tx('areas_negocio').whereIn('organizacao_id', orgIds).del();
    await tx('organizacoes').whereIn('id', orgIds).del();
    await tx('usuarios').whereIn('id', userIds).del();
  });
  process.stdout.write('fixture-cleaned\n');
}

async function verify() {
  const raw = process.env.E2E_FIXTURE_IDS;
  if (!raw) throw new Error('IDs da fixture não informados.');
  const fixture = JSON.parse(raw) as { professionalA1: string; availableUserId: string };
  const professional = await connection('profissionais')
    .select('usuario_id')
    .where('id', fixture.professionalA1)
    .first();
  const area = await connection('profissionais_areas')
    .select('acesso_clinico_autorizado')
    .where('profissional_id', fixture.professionalA1)
    .first();
  if (
    professional?.usuario_id !== fixture.availableUserId ||
    area?.acesso_clinico_autorizado !== false
  ) {
    throw new Error('O vínculo ou a ausência de acesso clínico não foram confirmados.');
  }
  process.stdout.write('link-verified\n');
}

requireTestDatabase();
try {
  if (process.argv[2] === 'setup') await setup();
  else if (process.argv[2] === 'cleanup') await cleanup();
  else if (process.argv[2] === 'verify') await verify();
  else throw new Error('Use setup ou cleanup.');
} finally {
  await connection.destroy();
}
