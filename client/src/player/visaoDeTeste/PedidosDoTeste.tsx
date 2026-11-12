import { useId, useState, type FormEvent } from 'react'
import type { PedidoDoTeste } from '../../net/visaoDeTeste/tipos'
import './PedidosDoTeste.css'

/**
 * VISÃO DE JOGADOR — os pedidos que esperam o mestre, na própria janela de
 * teste (caça J6). Quem testa sozinho apertava "Pedir para subir" e ficava
 * olhando "Aguardando o mestre…": a resposta só existia na caixa "Pedidos do
 * teste" da janela principal, atrás desta. Aqui vão os mesmos botões; a caixa
 * de lá continua, e responder num lado tira o pedido dos dois.
 *
 * Mora embaixo, no meio, logo ACIMA do aviso do jogador (`.pp-notice`), que é
 * onde está o "Aguardando o mestre…": pergunta e resposta lado a lado. Fora
 * da tela do jogador, então nem o bloqueio do Olhar nem o mapa pegam o
 * clique. Não rouba o foco: o pedido chega enquanto a pessoa joga.
 */

export const TITULO_DOS_PEDIDOS = 'Você é o mestre:'

export interface PedidosDoTesteProps {
  pedidos: readonly PedidoDoTeste[]
  onResponder(id: string, botao: number | null, texto: string): void
}

export function PedidosDoTeste({ pedidos, onResponder }: PedidosDoTesteProps) {
  /** Respondidos aqui: somem na hora, sem esperar a lista nova do host. */
  const [respondidos, setRespondidos] = useState<ReadonlySet<string>>(() => new Set())
  const visiveis = pedidos.filter((pedido) => !respondidos.has(pedido.id))
  if (visiveis.length === 0) return null

  const responder = (id: string, botao: number | null, texto: string) => {
    // Só os ids que o host ainda manda ficam guardados: a lista não cresce para sempre.
    setRespondidos((atual) => new Set([...atual].filter((visto) => pedidos.some((pedido) => pedido.id === visto)).concat(id)))
    onResponder(id, botao, texto)
  }

  return (
    <section className="vj-pedidos" aria-label="Pedidos do teste">
      <p className="vj-pedidos__titulo">{TITULO_DOS_PEDIDOS}</p>
      <ul className="vj-pedidos__lista">
        {visiveis.map((pedido) => (
          <LinhaDoPedido key={pedido.id} pedido={pedido} onResponder={(botao, texto) => responder(pedido.id, botao, texto)} />
        ))}
      </ul>
    </section>
  )
}

interface LinhaDoPedidoProps {
  pedido: PedidoDoTeste
  onResponder(botao: number | null, texto: string): void
}

function LinhaDoPedido({ pedido, onResponder }: LinhaDoPedidoProps) {
  const campoId = useId()
  const respostaId = useId()
  const [escrito, setEscrito] = useState('')
  const [respondendo, setRespondendo] = useState(false)
  const [resposta, setResposta] = useState('')

  const enviarResposta = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault()
    const limpo = resposta.trim()
    if (limpo === '') return
    onResponder(null, limpo)
  }

  return (
    <li className="vj-pedidos__linha">
      <p className="vj-pedidos__texto" role="status" aria-live="polite">
        {pedido.texto}
      </p>
      {pedido.campo !== undefined && (
        <div className="vj-pedidos__campo">
          <label className="vj-pedidos__rotulo" htmlFor={campoId}>
            {pedido.campo.rotulo}
          </label>
          <input id={campoId} className="vj-pedidos__entrada" type="text" value={escrito} maxLength={pedido.campo.maxLength} onChange={(evento) => setEscrito(evento.target.value)} />
        </div>
      )}
      {respondendo && pedido.responder !== undefined ? (
        <form className="vj-pedidos__campo" onSubmit={enviarResposta}>
          <label className="vj-pedidos__rotulo" htmlFor={respostaId}>
            {pedido.responder.rotulo}
          </label>
          <input
            id={respostaId}
            className="vj-pedidos__entrada"
            type="text"
            value={resposta}
            maxLength={pedido.responder.maxLength}
            // Foi a pessoa que abriu o campo: o foco vai para ele.
            autoFocus
            onChange={(evento) => setResposta(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== 'Escape') return
              // O Esc é deste campo: não fecha junto o cartão ou o Painel do jogador.
              evento.stopPropagation()
              evento.nativeEvent.stopImmediatePropagation()
              setRespondendo(false)
            }}
          />
          <div className="vj-pedidos__acoes">
            <button type="submit" className="vj-pedidos__botao" disabled={resposta.trim() === ''}>
              Enviar
            </button>
            <button type="button" className="vj-pedidos__botao vj-pedidos__botao--leve" onClick={() => setRespondendo(false)}>
              Voltar
            </button>
          </div>
        </form>
      ) : (
        <div className="vj-pedidos__acoes">
          {pedido.botoes.map((rotulo, indice) => (
            <button key={`${indice}-${rotulo}`} type="button" className="vj-pedidos__botao" onClick={() => onResponder(indice, escrito)}>
              {rotulo}
            </button>
          ))}
          {pedido.responder !== undefined && (
            <button type="button" className="vj-pedidos__botao vj-pedidos__botao--leve" onClick={() => setRespondendo(true)}>
              {pedido.responder.rotulo}
            </button>
          )}
        </div>
      )}
    </li>
  )
}
