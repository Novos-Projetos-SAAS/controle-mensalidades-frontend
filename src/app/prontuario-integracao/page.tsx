import { notFound } from 'next/navigation';
import { ClinicalWorkspace } from '@/features/clinical/clinical-workspace';

export const metadata = {
  title: 'Prontuário fisioterapêutico — integração em homologação',
  robots: { index: false, follow: false },
};

export default function ProntuarioIntegracaoPage() {
  // O backend clínico real permanece bloqueado. A interface fica disponível
  // SOMENTE para desenvolvimento local, nunca em deploy Vercel/produção.
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ClinicalWorkspace />;
}
