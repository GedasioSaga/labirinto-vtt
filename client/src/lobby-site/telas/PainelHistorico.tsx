import { useEffect, useId, useState } from 'react'
import type { MembroProjetado, OpGravada } from '../../lib/nuvem/tipos'
import type { EstadoDaCampanha, FichaDoSite, SituacaoDoDesfazer } from '../dados/sessaoDaCampanha'
import { useAgora, useSistemaDoLobby, useSite } from './contexto'
import { Icone } from './Icone'
import { deParaDaOp, fraseDaOp, horaExata, motivoEmTexto, nomeDoDia, quandoRelativo, rotuloDoCaminho, tomDe, valorEmTexto } from './textos'

/**
 * O HISTÓRICO da ficha (protótipo, tela 7): quem mudou o quê, por dia, da
 * mais nova para a mais velha, em páginas de 50. Você desfaz as suas
 * mudanças; o mestre desfaz qualquer uma. Desfazer o que outra pessoa já
 * mudou de novo pede confirmação (§5.3).
 */

interface PainelProps {
  campanha: EstadoDaCampanha
  ficha: FichaDoSite
}

/** As ops desfeitas: a desfeita de uma desfeita volta a valer (lista da mais nova para a mais velha). */
function desfeitasDa(lista: readonly OpGravada[]): Set<string> {
  const desfeitas = new Set<string>()
  for (const op of lista) {
    if (desfeitas.has(op.opId) || op.desfaz === undefined) continue
    desfeitas.add(op.desfaz)
  }
  return desfeitas
}

export function PainelHistorico({ campanha, ficha }: PainelProps) {
  const site = useSite()
  const tituloId = useId()
  const agora = useAgora()
  const fichaId = ficha.doc.id
  const emDia = campanha.conexao === 'em-dia'
  const historico = campanha.historicos.get(fichaId)
  const eu = campanha.eu
  const ehMestre = eu?.papel === 'mestre'

  // A primeira página ao abrir, e de novo quando a ficha muda (outra pessoa, ou um desfazer que voltou).
  useEffect(() => {
    if (emDia) site.sessao()?.pedirHistorico(fichaId)
  }, [site, fichaId, emDia, campanha.rev])

  const lista = historico?.lista ?? []
  const carregando = historico === undefined || (historico.carregando && lista.length === 0)
  const desfeitas = desfeitasDa(lista)
  const porId = new Map(lista.map((op): [string, OpGravada] => [op.opId, op]))
  const grupos: { dia: string; ops: OpGravada[] }[] = []
  for (const op of lista) {
    const dia = nomeDoDia(op.quando, agora)
    const ultimo = grupos.at(-1)
    if (ultimo !== undefined && ultimo.dia === dia) ultimo.ops.push(op)
    else grupos.push({ dia, ops: [op] })
  }
  const regra = ficha.ehMinha
    ? 'Quem mudou o quê nesta ficha. Você desfaz as suas mudanças; o mestre desfaz qualquer uma.'
    : `Quem mudou o quê nesta ficha. Só ${ficha.nomeDoDono === null ? 'o mestre desfaz' : `${ficha.nomeDoDono} e o mestre desfazem`}.`

  return (
    <section aria-labelledby={tituloId} aria-busy={carregando}>
      <div className="lo-painel__cab">
        <h2 className="lo-painel__titulo" id={tituloId}>
          Histórico
        </h2>
        <p className="lo-secao__nota">{regra}</p>
      </div>
      {!emDia && historico === undefined ? (
        <p className="lo-vazio">Sem internet: o histórico abre quando a conexão voltar.</p>
      ) : carregando ? (
        <p className="lo-carregando" role="status">
          <span className="lo-giro" aria-hidden="true" />
          Carregando o histórico…
        </p>
      ) : lista.length === 0 ? (
        <p className="lo-vazio">Ninguém mudou esta ficha ainda. Cada mudança aparece aqui, com quem fez e quando.</p>
      ) : (
        grupos.map((grupo) => (
          <div key={grupo.dia}>
            <h3 className="lo-hist__dia">{grupo.dia}</h3>
            <ol className="lo-eventos">
              {grupo.ops.map((op) => {
                const alvo = op.desfaz === undefined ? undefined : porId.get(op.desfaz)
                const podeDesfazer = (ehMestre || (ficha.ehMinha && eu !== null && op.autorContaId === eu.contaId)) && !desfeitas.has(op.opId)
                return (
                  <LinhaDoEvento
                    key={op.opId}
                    op={op}
                    ficha={ficha}
                    eu={eu}
                    agora={agora}
                    desfeita={desfeitas.has(op.opId)}
                    refaz={alvo?.desfaz !== undefined}
                    podeDesfazer={podeDesfazer}
                    emDia={emDia}
                    situacao={campanha.desfazeres.get(op.opId)}
                  />
                )
              })}
            </ol>
          </div>
        ))
      )}
      {historico?.temMaisAntigas === true && (
        <div className="lo-mochila__pe">
          <button type="button" className="lo-btn" disabled={!emDia || historico.carregando} onClick={() => site.sessao()?.pedirHistorico(fichaId, true)}>
            {historico.carregando ? 'Carregando…' : 'Ver mudanças mais antigas'}
          </button>
          {!emDia && <span className="lo-motivo">Sem internet: volta quando a conexão voltar.</span>}
        </div>
      )}
    </section>
  )
}

interface LinhaProps {
  op: OpGravada
  ficha: FichaDoSite
  eu: MembroProjetado | null
  agora: number
  desfeita: boolean
  /** Esta op desfaz uma que já era um desfazer: é um "refez". */
  refaz: boolean
  podeDesfazer: boolean
  emDia: boolean
  situacao: SituacaoDoDesfazer | undefined
}

function LinhaDoEvento({ op, ficha, eu, agora, desfeita, refaz, podeDesfazer, emDia, situacao }: LinhaProps) {
  const site = useSite()
  const sistema = useSistemaDoLobby()
  // "Deixar como está" na confirmação: some daqui (a op continua como está, nada vai ao servidor).
  const [dispensada, setDispensada] = useState<SituacaoDoDesfazer | null>(null)
  const rotulo = rotuloDoCaminho(sistema, ficha.doc, op.caminho, op.valor, op.antes)
  const frase = fraseDaOp(op, rotulo, eu, refaz)
  const dePara = op.desfaz === undefined ? deParaDaOp(op) : null
  const nomeDoBotao = op.desfaz === undefined ? 'Desfazer' : 'Refazer'
  const enviando = situacao?.t === 'enviando'
  const visivel = situacao !== undefined && situacao !== dispensada ? situacao : undefined

  return (
    <li className="lo-ev" data-aumento={frase.aumento ? '1' : undefined} data-desfeita={desfeita ? '1' : undefined}>
      <span className="lo-av" data-tom={tomDe(op.autorContaId)} aria-hidden="true">
        {op.autorNome.slice(0, 1).toUpperCase()}
      </span>
      <div className="lo-ev__corpo">
        <p className="lo-ev__frase">
          <b>{frase.quem}</b> {frase.verbo} <b>{frase.alvo}</b>
          {frase.resto !== '' && <> {frase.resto}</>}
        </p>
        <p className="lo-ev__meta">
          <time dateTime={new Date(op.quando).toISOString()} title={horaExata(op.quando)}>
            {quandoRelativo(op.quando, agora)}
          </time>
          {dePara !== null && <span>{dePara}</span>}
          {frase.aumento && <span className="lo-tag lo-tag--latao">Aumento na mochila</span>}
          {desfeita && <span className="lo-tag">desfeita</span>}
        </p>
        {visivel?.t === 'confirmar' && (
          <div className="lo-confirma" role="group" aria-label="Confirmar desfazer">
            <p>
              Depois disso, {visivel.conflito.quem} mudou {rotulo} para {valorEmTexto(visivel.conflito.valorAtual)}. Desfazer volta para {valorEmTexto(op.antes)}. Confirmar?
            </p>
            <div>
              <button type="button" className="lo-btn lo-btn--primario" disabled={!emDia} onClick={() => site.sessao()?.desfazer(op.opId, true)}>
                Voltar para {valorEmTexto(op.antes)}
              </button>
              <button type="button" className="lo-btn" onClick={() => setDispensada(visivel)}>
                Deixar como está
              </button>
            </div>
          </div>
        )}
        {visivel?.t === 'negado' && (
          <p className="lo-erro-campo" role="alert">
            Não deu para {nomeDoBotao.toLowerCase()}: {motivoEmTexto(visivel.motivo)}.{visivel.detalhe !== undefined ? ` ${visivel.detalhe}` : ''}
          </p>
        )}
      </div>
      {podeDesfazer && (
        <button
          type="button"
          className="lo-btn lo-btn--fantasma lo-ev__acao"
          disabled={!emDia || enviando}
          aria-label={`${nomeDoBotao}: ${frase.quem} ${frase.verbo} ${frase.alvo}${frase.resto === '' ? '' : ` ${frase.resto}`}`}
          title={emDia ? undefined : 'Sem internet: volta quando a conexão voltar.'}
          onClick={() => site.sessao()?.desfazer(op.opId)}
        >
          {enviando ? <span className="lo-giro" aria-hidden="true" /> : <Icone nome="desfazer" />} {enviando ? (op.desfaz === undefined ? 'Desfazendo…' : 'Refazendo…') : nomeDoBotao}
        </button>
      )}
    </li>
  )
}
