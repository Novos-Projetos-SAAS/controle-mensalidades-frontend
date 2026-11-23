import { notFound } from 'next/navigation';
import { ClinicalDemo } from '@/features/clinical/clinical-demo';

export const metadata = {
  title: 'Treinamento de prontuário fisioterapêutico',
  robots: { index: false, follow: false },
};

export default function ProntuarioDemoPage() {
  // O simulador nunca deve integrar builds/deploys de producao.
  // Nao usa banco, API, dados de usuarios ou pacientes existentes.
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ClinicalDemo />;
}
