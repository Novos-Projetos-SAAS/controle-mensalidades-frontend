import { AppShell } from '@/components/app-shell';
import { ClinicalDemo } from '@/features/clinical/clinical-demo';
import { ClinicalWorkspace } from '@/features/clinical/clinical-workspace';

export const metadata = {
  title: 'Prontuário — prévia segura',
  robots: { index: false, follow: false },
};

export default function ProntuarioPage() {
  // API clínica real permanece restrita a desenvolvimento/homologação.
  if (process.env.NODE_ENV === 'development') return <ClinicalWorkspace />;
  // Em produção só exibir demonstração com pacientes fictícios em memória,
  // dentro do AppShell autenticado. Nenhuma chamada a API ou banco clínico.
  return (
    <AppShell>
      <ClinicalDemo modo="previa-temporaria" />
    </AppShell>
  );
}
