import { useCallback, useEffect, useRef, useState } from 'react'
import { abrirCanalDoNavegador } from '../net/visaoDeTeste/canal'
import { MesaDaBatalha } from './MesaDaBatalha'
import { lerMensagemDaMesa, nomeDoCanal, type MensagemDaJanela } from './protocolo'
import type { EspelhoDaBatalha, PedidoDaMesa, RespostaDaMesa } from './tipos'

/**
 * A JANELA DA BATALHA (`client/batalha.html`): a mesa numa janela à parte. Só
 * mostra o espelho que a principal manda e devolve os pedidos; não guarda a
 * batalha (recarregar esta janela não mexe em nada: ela pede o espelho de novo).
 */

/** A principal manda `pong` a cada `ping`: sem nada dela por isto, ela fechou ou recarregou. */
const PING_MS = 2000
const SEM_A_PRINCIPAL_MS = 6000
const RESPOSTA_MS = 5000

type SemEnvelope<T> = T extends unknown ? Omit<T, 'de' | 'sessao'> : never
type Situacao = 'esperando' | 'viva' | 'sumiu'

export function JanelaDaBatalha({ sessao }: { sessao: string }) {
  const [espelho, setEspelho] = useState<EspelhoDaBatalha | null>(null)
  const [situacao, setSituacao] = useState<Situacao>('esperando')
  const fio = useRef<{ mandar: (corpo: SemEnvelope<MensagemDaJanela>) => void; respostas: Map<number, (resposta: RespostaDaMesa) => void>; proximo: number } | null>(null)

  useEffect(() => {
    const canal = abrirCanalDoNavegador(nomeDoCanal(sessao))
    const respostas = new Map<number, (resposta: RespostaDaMesa) => void>()
    let ultima = 0
    const mandar = (corpo: SemEnvelope<MensagemDaJanela>) => canal.enviar({ de: 'janela', sessao, ...corpo })
    fio.current = { mandar, respostas, proximo: 1 }
    const parar = canal.ouvir((dado) => {
      const mensagem = lerMensagemDaMesa(dado, sessao)
      if (mensagem === null) return
      if (mensagem.tipo === 'saiu') {
        ultima = 0
        setSituacao('sumiu')
        return
      }
      ultima = Date.now()
      switch (mensagem.tipo) {
        case 'estado':
          setEspelho(mensagem.espelho)
          setSituacao('viva')
          return
        case 'pong':
          setSituacao((antes) => (antes === 'sumiu' ? 'esperando' : antes))
          return
        case 'resposta':
          respostas.get(mensagem.id)?.(mensagem.resposta)
          respostas.delete(mensagem.id)
          return
        case 'fechar':
          window.close()
          return
      }
    })
    mandar({ tipo: 'ola' })
    const ping = setInterval(() => {
      mandar({ tipo: 'ping' })
      if (Date.now() - ultima > SEM_A_PRINCIPAL_MS) setSituacao((antes) => (antes === 'esperando' && ultima === 0 ? antes : 'sumiu'))
    }, PING_MS)
    const adeus = () => mandar({ tipo: 'adeus' })
    window.addEventListener('pagehide', adeus)
    return () => {
      clearInterval(ping)
      window.removeEventListener('pagehide', adeus)
      parar()
      canal.fechar()
      fio.current = null
    }
  }, [sessao])

  const enviar = useCallback((pedido: PedidoDaMesa): Promise<RespostaDaMesa> => {
    const atual = fio.current
    if (atual === null) return Promise.resolve({ ok: false, motivo: 'A janela ainda está ligando o fio com a principal.' })
    const id = atual.proximo
    atual.proximo += 1
    return new Promise<RespostaDaMesa>((resolver) => {
      const prazo = setTimeout(() => {
        atual.respostas.delete(id)
        resolver({ ok: false, motivo: 'A janela principal não respondeu: confira se ela está aberta.' })
      }, RESPOSTA_MS)
      atual.respostas.set(id, (resposta) => {
        clearTimeout(prazo)
        resolver(resposta)
      })
      atual.mandar({ tipo: 'pedido', id, pedido })
    })
  }, [])

  const semFonte =
    situacao === 'sumiu' ? 'A janela principal fechou ou está recarregando. A mesa volta sozinha quando ela voltar; até lá, nada aqui vale.' : situacao === 'esperando' && espelho === null ? 'Ligando com a janela principal…' : null

  return (
    <main className="mb-janela">
      <MesaDaBatalha
        espelho={espelho}
        enviar={enviar}
        semFonte={semFonte}
        teclasNaPagina
        lugar="janela"
        itensDoLugar={[{ chave: 'voltar', rotulo: 'Trazer para o app', onEscolher: () => fio.current?.mandar({ tipo: 'voltar' }) }]}
      />
    </main>
  )
}
