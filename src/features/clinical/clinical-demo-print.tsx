import type { LaudoDraft } from './clinical-contracts';
import { FISIOTERAPEUTA_DEMO, type PacienteDemo, type VersaoDemo } from './clinical-demo-domain';

// Layout de impressao SOMENTE do simulador local. Nao ha geracao de laudo oficial.
const campos: Array<[keyof LaudoDraft, string]> = [
  ['finalidade', 'Finalidade'],
  ['fundamentacao_avaliacao', 'Fundamentação e avaliação'],
  ['achados_funcionais', 'Achados funcionais'],
  ['diagnostico_fisioterapeutico', 'Diagnóstico fisioterapêutico'],
  ['conclusao', 'Conclusão profissional'],
  ['recomendacoes', 'Recomendações'],
];

export function LaudoDemoPrint({
  paciente,
  versao,
}: {
  paciente: PacienteDemo;
  versao: VersaoDemo;
}) {
  const dados = versao.dados as LaudoDraft;

  return (
    <article id="clinical-demo-print" className="clinical-demo-print" aria-label="Prévia impressa fictícia do laudo">
      <div className="clinical-demo-print-head">
        <p className="clinical-demo-print-watermark">SIMULAÇÃO · SEM VALIDADE</p>
        <p>Orbe · treinamento do prontuário de fisioterapia</p>
        <h1>Prévia de laudo fisioterapêutico</h1>
        <p className="clinical-demo-print-notice">
          DOCUMENTO FICTÍCIO. Não assinado. Não utilizar em atendimento, perícia ou encaminhamento.
        </p>
      </div>
      <dl className="clinical-demo-print-meta">
        <div><dt>Paciente de demonstração</dt><dd>{paciente.nome}</dd></div>
        <div><dt>Profissional fictício</dt><dd>{FISIOTERAPEUTA_DEMO.nome}</dd></div>
        <div><dt>Registro</dt><dd>{FISIOTERAPEUTA_DEMO.registro}</dd></div>
        <div><dt>Versão demonstrativa</dt><dd>{versao.numero} · {versao.estado}</dd></div>
      </dl>
      <div className="clinical-demo-print-sections">
        {campos.map(([chave, rotulo]) => (
          <section key={chave}>
            <h2>{rotulo}</h2>
            <p>{dados[chave] || 'Não informado.'}</p>
          </section>
        ))}
      </div>
      <footer className="clinical-demo-print-footer">
        PRÉVIA FICTÍCIA — NÃO É DOCUMENTO ASSINADO NEM LAUDO EMITIDO
      </footer>
    </article>
  );
}
