import { notFound } from 'next/navigation';
import { ClinicalWorkspace } from '@/features/clinical/clinical-workspace';

export const metadata = {
  title: 'Prontuário — banco de homologação',
  robots: { index: false, follow: false },
};

export default function ProntuarioPage() {
  // Não publicar prontuários na Vercel/produção até homologar o módulo.
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ClinicalWorkspace />;
}
