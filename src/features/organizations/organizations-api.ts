import { api, type Area, type Organizacao } from '@/lib/api';

export type CreatedOrganization = {
  organizacao: Organizacao;
  area: Area & { codigo: string };
};

export const createOrganization = (nome: string, areaInicialNome: string) =>
  api<CreatedOrganization>('/organizacoes', {
    method: 'POST',
    body: JSON.stringify({ nome, areaInicial: { nome: areaInicialNome } }),
  });

export const createBusinessArea = (organizacaoId: string, nome: string) =>
  api<Area & { codigo: string }>(
    '/areas-negocio',
    { method: 'POST', body: JSON.stringify({ nome }) },
    { organizacaoId },
  );
