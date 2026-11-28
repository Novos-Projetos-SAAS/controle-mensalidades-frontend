'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, Eye, Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { clinicalApi, type ClinicalContext } from './clinical-api';

/**
 * Não persiste PDF em localStorage, IndexedDB ou arquivos do servidor.
 * Um object URL temporário existe apenas enquanto o documento está aberto.
 */
export function LaudoPdfActions({
  contexto, documentoId, versao, estado, historica,
}: {
  contexto: ClinicalContext;
  documentoId: string;
  versao: number;
  estado: 'RASCUNHO' | 'FINALIZADO';
  historica: boolean;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const arquivoUrl = useRef<string | null>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const imprimirQuandoCarregar = useRef(false);
  const prontoParaImpressao = useRef(false);
  const emAndamento = useRef(false);

  useEffect(() => () => {
    if (arquivoUrl.current) URL.revokeObjectURL(arquivoUrl.current);
  }, []);

  async function carregarPdf(): Promise<string | null> {
    if (arquivoUrl.current) return arquivoUrl.current;
    if (emAndamento.current) return null;
    emAndamento.current = true;
    setCarregando(true);
    setErro('');
    try {
      const pdf = await clinicalApi.pdfLaudo(contexto, documentoId, versao);
      const temporaria = URL.createObjectURL(pdf);
      arquivoUrl.current = temporaria;
      prontoParaImpressao.current = false;
      setUrl(temporaria);
      return temporaria;
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404].includes(error.status)) {
        setErro('Você não tem acesso a este laudo ou o vínculo clínico foi encerrado.');
      } else {
        setErro(error instanceof Error ? error.message : 'Não foi possível gerar o laudo em PDF.');
      }
      imprimirQuandoCarregar.current = false;
      return null;
    } finally {
      emAndamento.current = false;
      setCarregando(false);
    }
  }

  async function baixar() {
    const endereco = await carregarPdf();
    if (!endereco) return;
    const link = document.createElement('a');
    link.href = endereco;
    link.download = 'laudo-fisioterapeutico-versao-' + versao + '.pdf';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function solicitarImpressao() {
    try {
      iframe.current?.contentWindow?.focus();
      iframe.current?.contentWindow?.print();
      imprimirQuandoCarregar.current = false;
    } catch {
      setErro('Abra a visualização do PDF e utilize a opção Imprimir do leitor do navegador.');
    }
  }

  async function imprimir() {
    imprimirQuandoCarregar.current = true;
    const endereco = await carregarPdf();
    if (!endereco) {
      imprimirQuandoCarregar.current = false;
      return;
    }
    if (prontoParaImpressao.current) solicitarImpressao();
  }

  function fechar() {
    imprimirQuandoCarregar.current = false;
    prontoParaImpressao.current = false;
    setUrl(null);
    if (arquivoUrl.current) URL.revokeObjectURL(arquivoUrl.current);
    arquivoUrl.current = null;
  }

  return (
    <section className="space-y-3" aria-label="PDF do laudo fisioterapêutico">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" disabled={carregando}
          onClick={() => void carregarPdf()}>
          <Eye size={16} aria-hidden /> Visualizar PDF
        </Button>
        <Button variant="outline" type="button" disabled={carregando}
          onClick={() => void baixar()}>
          <Download size={16} aria-hidden /> Baixar PDF
        </Button>
        <Button variant="outline" type="button" disabled={carregando}
          onClick={() => void imprimir()}>
          <Printer size={16} aria-hidden /> Imprimir
        </Button>
      </div>
      {carregando && <p role="status" className="text-sm">Gerando PDF protegido…</p>}
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <p className="text-xs text-slate-600">
        {historica
          ? 'Cópia de versão histórica. Confira a versão mais recente antes de utilizar.'
          : estado === 'RASCUNHO'
            ? 'PDF de rascunho: não é um documento assinado.'
            : 'Documento finalizado para impressão e assinatura física, sem assinatura digital.'}
      </p>
      {url && (
        <div className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <strong className="text-sm">Prévia do laudo — versão {versao}</strong>
            <Button type="button" variant="ghost" onClick={fechar}>
              <X size={16} aria-hidden /> Fechar prévia
            </Button>
          </div>
          <iframe
            ref={iframe}
            src={url}
            title={'Prévia do laudo fisioterapêutico, versão ' + versao}
            className="h-[75vh] min-h-96 w-full rounded-lg border border-slate-200"
            onLoad={() => {
              prontoParaImpressao.current = true;
              if (imprimirQuandoCarregar.current) solicitarImpressao();
            }}
          />
        </div>
      )}
    </section>
  );
}
