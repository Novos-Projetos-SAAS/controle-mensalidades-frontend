'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { EmptyState } from '@/components/query-state';
import { Button } from '@/components/ui/button';
import { useSession } from '@/features/auth/session';
import { ReminderCalendar, WhatsappActivity, WhatsappTemplates } from './whatsapp-activity';
import { WhatsappConnection } from './whatsapp-connection';
import { WhatsappBaileys } from './whatsapp-baileys';

const sections = [
  'Conexão',
  'Conexão Baileys',
  'Modelos de mensagem',
  'Lembretes automáticos',
  'Histórico de mensagens',
] as const;

export function WhatsappPage() {
  const { organization, area } = useSession();
  const activeArea = area?.ativo === false ? null : area;
  return (
    <AppShell>
      {organization?.perfil === 'ADMINISTRADOR' ? (
        <WhatsappContent
          key={organization.id}
          orgId={organization.id}
          areaId={activeArea?.id}
          areaName={activeArea?.nome}
        />
      ) : (
        <EmptyState
          title="Acesso restrito"
          description="O painel WhatsApp Business está disponível para administradores da organização."
        />
      )}
    </AppShell>
  );
}

function WhatsappContent({
  orgId,
  areaId,
  areaName,
}: {
  orgId: string;
  areaId?: string;
  areaName?: string;
}) {
  const [section, setSection] = useState<(typeof sections)[number]>('Conexão');
  const context = areaId ? { organizacaoId: orgId, areaId } : null;
  return (
    <section className="space-y-5 pb-8">
      <header>
        <h1 className="display text-3xl text-slate-900 sm:text-4xl">WhatsApp Business</h1>
        <p className="mt-2 text-sm text-slate-600">
          Configure o número responsável pelas cobranças, acompanhe os lembretes e consulte o
          histórico das mensagens.
        </p>
      </header>
      <nav aria-label="Seções do WhatsApp Business" className="flex flex-wrap gap-2">
        {sections.map((item) => (
          <Button
            key={item}
            variant={section === item ? 'secondary' : 'outline'}
            aria-pressed={section === item}
            aria-controls="whatsapp-section"
            onClick={() => setSection(item)}
          >
            {item}
          </Button>
        ))}
      </nav>
      <div id="whatsapp-section" className="space-y-4">
        {section === 'Conexão' ? (
          <WhatsappConnection orgId={orgId} areaId={areaId} areaName={areaName} />
        ) : section === 'Conexão Baileys' ? (
          context ? <WhatsappBaileys key={orgId + ':' + areaId} context={context} /> :
          <EmptyState title="Selecione uma área" description="Escolha uma área ativa para conectar o WhatsApp." />
        ) : (
          <>
            {section === 'Lembretes automáticos' && <ReminderCalendar />}
            {context ? (
              section === 'Modelos de mensagem' ? (
                <WhatsappTemplates context={context} />
              ) : (
                <WhatsappActivity
                  key={`${areaId}:${section}`}
                  context={context}
                  kind={section === 'Lembretes automáticos' ? 'tarefas' : 'mensagens'}
                />
              )
            ) : (
              <EmptyState
                title="Selecione uma área"
                description="Escolha uma área ativa para consultar os dados do WhatsApp."
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}
