import { notFound } from 'next/navigation';
import { ClinicalAssignmentsWorkspace } from '@/features/clinical/clinical-assignments-workspace';

export const metadata = {
  title: 'Vínculos clínicos — banco de homologação',
  robots: { index: false, follow: false },
};

export default function VinculosClinicosPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ClinicalAssignmentsWorkspace />;
}
