import { useEffect, useId, useRef, useState } from 'react'
import type { AjudaParaJogador } from '../../lib/batalha/vistaDoJogador'
import type { EscolhaDaAjuda } from '../../lib/batalha/requisitos/ajuda'
import type { CancelamentoDaAjuda, RespostaDaAjuda } from '../../lib/batalha/requisitos/modelo'
import './batalha.css'
import './combate.css'
import './pedidosDeAjuda.css'

/**
 * REQUISITOS E (protótipo aprovado, tela 5): o pedido de ajuda a um aliado nas duas pontas.
 *
 * - `responde`: a caixa "VAGN PEDE 25 SP" na tela do aliado (ou do mestre, pelo NPC), com o prazo
 *   correndo, Aceitar e Recusar. O aliado só paga: o SP sai dele e não entra em quem pediu.
 * - `pede`: "Esperando Aira responder..." com Cancelar; e o aviso quando fecha sem aceite (recusou,
 *   venceu, a vez passou), com Fechar.
 *
 * O prazo conta a partir de quando ESTA tela viu o pedido (o relógio do host pode não bater com o
 * dela); quem decide o prazo de verdade é o host.
 */

const NOME_DO_RECURSO: Readonly<Record<'sp' | 'hp' | 'escudo', string>> = { sp: 'SP', hp: 'HP', escudo: 'Escudo' }
const TIQUE_MS = 1_000

/** Um pedido pronto para a tela. `npc`: o mestre responde por um NPC aliado (a frase muda). */
export type AjudaNaTela = AjudaParaJogador & { npc?: boolean }

/** O que o pedido pede, curto: "25 SP" ou "ajuda". */
function oQuePede(item: AjudaNaTela): string {
  return item.paga === undefined ? 'ajuda' : `${item.paga.n} ${NOME_DO_RECURSO[item.paga.recurso]}`
}

/** Os segundos que faltam de cada pedido esperando, contados desde que esta tela o viu. */
function useSegundosQueFaltam(itens: readonly AjudaNaTela[]): ReadonlyMap<string, number> {
  const vistos = useRef(new Map<string, number>())
  const [agora, setAgora] = useState(() => Date.now())
  const comPrazo = itens.some((item) => item.estado === 'esperando' && item.prazoS !== null)
  useEffect(() => {
    if (!comPrazo) return undefined
    const relogio = setInterval(() => setAgora(Date.now()), TIQUE_MS)
    return () => clearInterval(relogio)
  }, [comPrazo])
  const faltam = new Map<string, number>()
  for (const item of itens) {
    if (item.estado !== 'esperando' || item.prazoS === null) continue
    const visto = vistos.current.get(item.id) ?? agora
    vistos.current.set(item.id, visto)
    faltam.set(item.id, Math.max(0, item.prazoS - Math.floor((agora - visto) / 1000)))
  }
  return faltam
}

function CaixaDoPedido({ item, faltam, onPedir }: { item: AjudaNaTela; faltam: number | undefined; onPedir: (pedido: RespostaDaAjuda | CancelamentoDaAjuda) => boolean }) {
  const id = useId()
  const [esperando, setEsperando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const responder = (aceita: boolean) => {
    if (esperando) return
    setEsperando(true)
    const saiu = onPedir({ tipo: 'responderAjuda', ajudaId: item.id, aceita })
    setEsperando(false)
    setErro(saiu ? null : 'Não saiu: sem conexão com o mestre, ou o pedido já fechou.')
  }
  const quem = item.npc === true ? `O ${item.nomePara} paga` : 'Você paga'
  return (
    <li className="bt-pedido-ajuda" aria-labelledby={`${id}-tit`} data-ajuda={item.id}>
      <h3 className="bt-pedido-ajuda__tit" id={`${id}-tit`}>
        {item.nomeDe} pede {oQuePede(item)}
        {item.npc === true ? ` ao ${item.nomePara}` : ''}
      </h3>
      <p className="bt-pedido-ajuda__txt">
        {item.paga === undefined ? (
          <>
            Para usar <b>{item.tecnica}</b>. Não gasta nada seu.
          </>
        ) : (
          <>
            {quem} a <b>{item.tecnica}</b> do {item.nomeDe}. O {NOME_DO_RECURSO[item.paga.recurso]} não vai para o {item.nomeDe}, só paga a técnica.
          </>
        )}
        {item.npc === true ? ' O aliado é NPC: você, mestre, responde por ele.' : ''}
      </p>
      {faltam !== undefined && (
        <span className="bt-pedido-ajuda__prazo" aria-live="off">
          Faltam {faltam} s
        </span>
      )}
      <div className="bt-pedido-ajuda__acoes" role="group" aria-labelledby={`${id}-tit`}>
        <button type="button" className="bt-botao bt-botao--passiva" disabled={esperando} onClick={() => responder(true)}>
          Aceitar
        </button>
        <button type="button" className="bt-botao" disabled={esperando} onClick={() => responder(false)}>
          Recusar
        </button>
      </div>
      {erro !== null && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
    </li>
  )
}

function EsperaDoPedido({ item, faltam, onPedir }: { item: AjudaNaTela; faltam: number | undefined; onPedir: (pedido: RespostaDaAjuda | CancelamentoDaAjuda) => boolean }) {
  const esperando = item.estado === 'esperando'
  const texto = esperando ? `Esperando ${item.nomePara} responder${item.prazoS === null ? ' (na tela do mestre)' : ' na tela dele'}…${faltam === undefined ? '' : ` ${faltam} s`}` : `${item.motivo ?? 'O pedido fechou'}. Peça a outro aliado ou use outro caminho.`
  return (
    <li className="bt-espera-ajuda" data-estado={item.estado} data-ajuda={item.id} role="status">
      <span className="bt-espera-ajuda__ponto" aria-hidden="true" />
      <span className="bt-espera-ajuda__texto">
        <b>{item.tecnica}</b> · {texto}
      </span>
      <button type="button" className="bt-botao bt-botao--p" onClick={() => onPedir({ tipo: 'cancelarAjuda', ajudaId: item.id })}>
        {esperando ? 'Cancelar pedido' : 'Fechar'}
      </button>
    </li>
  )
}

/**
 * REQUISITOS E (protótipo, tela 5): a técnica pede ajuda; quem pede escolhe o aliado (a lista já vem
 * filtrada pela marca ou pelo recurso). Nada é gasto aqui: o pedido vai ao aliado, que aceita na tela dele.
 */
export function EscolhaDoAliado({ escolha, onPedir, onCancelar }: { escolha: EscolhaDaAjuda; onPedir: (ajudaDe: string) => boolean; onCancelar: () => void }) {
  const id = useId()
  const [erro, setErro] = useState<string | null>(null)
  const primeiro = useRef<HTMLButtonElement>(null)
  useEffect(() => primeiro.current?.focus(), [])
  return (
    <section className="bt-pedido-ajuda bt-pedido-ajuda--escolha" aria-labelledby={`${id}-tit`} onKeyDown={(evento) => evento.key === 'Escape' && onCancelar()}>
      <h3 className="bt-pedido-ajuda__tit" id={`${id}-tit`}>
        Pedir {escolha.pede}
      </h3>
      <p className="bt-pedido-ajuda__txt">A quem? O pedido chega na tela dele; nada é gasto até ele aceitar.</p>
      <div className="bt-pedido-ajuda__acoes" role="group" aria-labelledby={`${id}-tit`}>
        {escolha.candidatos.map((candidato, indice) => (
          <button
            key={candidato.tokenId}
            ref={indice === 0 ? primeiro : undefined}
            type="button"
            className="bt-botao bt-botao--passiva"
            onClick={() => setErro(onPedir(candidato.tokenId) ? null : 'Não saiu: sem conexão com o mestre.')}
          >
            {candidato.nome}
            {candidato.responde === 'mestre' ? ' (o mestre responde)' : ''}
          </button>
        ))}
        <button type="button" className="bt-botao" onClick={onCancelar}>
          Cancelar
        </button>
      </div>
      {erro !== null && (
        <p className="bt-lembrete__motivo" role="alert">
          {erro}
        </p>
      )}
    </section>
  )
}

/** Os pedidos de ajuda desta tela (os que ela responde primeiro). Nenhum = nada. */
export function PedidosDeAjuda({ itens, onPedir, className }: { itens: readonly AjudaNaTela[]; onPedir: (pedido: RespostaDaAjuda | CancelamentoDaAjuda) => boolean; className?: string }) {
  const faltam = useSegundosQueFaltam(itens)
  if (itens.length === 0) return null
  const responde = itens.filter((item) => item.papel === 'responde')
  const pede = itens.filter((item) => item.papel === 'pede')
  return (
    <ul className={className === undefined ? 'bt-ajudas' : `bt-ajudas ${className}`} aria-label="Pedidos de ajuda">
      {responde.map((item) => (
        <CaixaDoPedido key={item.id} item={item} faltam={faltam.get(item.id)} onPedir={onPedir} />
      ))}
      {pede.map((item) => (
        <EsperaDoPedido key={item.id} item={item} faltam={faltam.get(item.id)} onPedir={onPedir} />
      ))}
    </ul>
  )
}
