import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { criarFogoNoHost, type SaidaDoFogo } from '../../../../net/fogoNoHost'
import { parseFogoHostMessage, type FogoPlacar } from '../../../../net/protocoloDoFogo'
import { receberFogo, type FogoDoJogador } from '../../../../player/estadoDoFogo'
import '../../../../player/player.css'
import { themeCss } from '../../../../theme'
import { DIFICULDADES_FOGO, MINIGAME_FOGO_PADRAO, type DificuldadeFogo } from '../../tipos'
import { FogoOverlay, URL_DO_JOGO_FOGO, type AcoesDoFogo } from '../FogoOverlay'

/**
 * VITRINE DO CONVITE DO FOGO (só dev): a `FogoOverlay` DE VERDADE, com o jogo
 * de verdade no iframe, no caminho do "Apagar o fogo" sozinho no pino. No
 * lugar da conexão da sala, o mestre do app (`fogoNoHost.ts`) na mesma página,
 * com as mensagens passando pelo parser do protocolo (como o fio).
 *
 * Serve para ver e medir a carga do jogo na tela do jogador: a barra com o
 * quanto já chegou, o motivo quando não chega, o "Tentar de novo" e a partida
 * até o resultado.
 *
 * Parâmetros:
 *  - `?jogo=<url>`: de onde o iframe carrega (padrão: a rota da sala); uma
 *    rota que não existe mostra o caso do mestre sem o jogo;
 *  - `?robo=1`: o robô joga no lugar da pessoa (`?robo-rede=1` no jogo);
 *  - `?permitida=escolha|facil|normal|extremo`: a dificuldade que o mestre deixou.
 *
 * O que aconteceu fica em `window.vitrineDoFogo`.
 */

interface Relato {
  /** Quantas vezes a tela avisou o mestre que o jogo não carregou. */
  falhas: number
  /** ms (relógio da página) do "Começar" aceito e do resultado na tela. */
  comecouMs: number | null
  resultadoMs: number | null
  placar: Pick<FogoPlacar, 'vitoria' | 'motivo' | 'pontos' | 'modo'> | null
  tiqueFinal: number | null
}

declare global {
  interface Window {
    vitrineDoFogo?: Relato
  }
}

const parametros = new URLSearchParams(window.location.search)
const EU = { playerId: 'ana', nome: 'Ana' }
const robo = parametros.get('robo') === '1'
const urlBase = parametros.get('jogo') ?? URL_DO_JOGO_FOGO
const urlDoJogo = robo ? `${urlBase}${urlBase.includes('?') ? '&' : '?'}robo-rede=1` : urlBase
const pedida = parametros.get('permitida')
const permitida: 'escolha' | DificuldadeFogo = DIFICULDADES_FOGO.find((d) => d === pedida) ?? 'escolha'

const relato: Relato = { falhas: 0, comecouMs: null, resultadoMs: null, placar: null, tiqueFinal: null }
window.vitrineDoFogo = relato

let seq = 0
const host = criarFogoNoHost({ conexaoDe: (id) => (id === EU.playerId ? 'c-ana' : null), randomId: () => `vitrine-${(seq += 1)}` })

function Vitrine() {
  const [fogo, setFogo] = useState<FogoDoJogador | undefined>(() => {
    const { outbound } = host.pedir({ pinId: 'pino', minigame: { ...MINIGAME_FOGO_PADRAO, npc: 'Guarda Florêncio', fala: 'O pinheiral está pegando fogo! Ajudem a salvar a vila.', permitida } }, EU)
    return aplicar(undefined, outbound)
  })

  /** As mensagens do mestre para este jogador, pelo parser (como chegam pelo fio), aplicadas ao estado da tela. */
  function aplicar(atual: FogoDoJogador | undefined, saidas: readonly SaidaDoFogo[]): FogoDoJogador | undefined {
    let proximo = atual
    for (const saida of saidas) {
      const msg = parseFogoHostMessage(JSON.parse(JSON.stringify(saida.msg)))
      if (msg === null || msg.type === 'fogo.recusado') continue
      proximo = receberFogo(proximo, msg)
      if (msg.type === 'fogo.comecar') relato.comecouMs = performance.now()
      if (msg.type === 'fogo.desfecho') relato.resultadoMs = performance.now()
    }
    return proximo
  }

  if (fogo === undefined) return <p style={{ padding: 16 }}>A tela do fogo fechou. Recarregue a página para abrir de novo.</p>
  const sessao = fogo.sessao
  const acoes: AcoesDoFogo = {
    prontoFogo: (ferramenta, dificuldade) => {
      const saidas = host.pronto(EU.playerId, dificuldade === undefined ? { type: 'fogo.pronto', sessao, ferramenta } : { type: 'fogo.pronto', sessao, ferramenta, dificuldade })
      setFogo((atual) => aplicar(atual === undefined ? atual : { ...atual, pronto: ferramenta }, saidas))
      return true
    },
    entradasFogo: () => true,
    hashFogo: () => true,
    fimFogo: (tique, hash, placar) => {
      relato.placar = { vitoria: placar.vitoria, motivo: placar.motivo, pontos: placar.pontos, modo: placar.modo }
      relato.tiqueFinal = tique
      const saidas = host.fim(EU.playerId, { type: 'fogo.fim', sessao, tique, hash, placar })
      setFogo((atual) => aplicar(atual === undefined ? atual : { ...atual, fimEnviado: true }, saidas))
      return true
    },
    fecharFogo: () => setFogo(undefined),
    falhouFogo: () => {
      relato.falhas += 1
      const saidas = host.desistir(EU.playerId, { type: 'fogo.desistir', sessao, motivo: 'erro' })
      setFogo((atual) => aplicar(atual === undefined ? atual : { ...atual, pronto: undefined }, saidas))
      return true
    },
    ouvirFogo: () => () => undefined,
  }
  return <FogoOverlay fogo={fogo} playerId={EU.playerId} acoes={acoes} urlDoJogo={urlDoJogo} />
}

const raiz = document.getElementById('raiz')
// Sem exports, o Fast Refresh roda este arquivo de novo ao editar um componente importado:
// a página recarrega inteira, em vez de montar uma segunda raiz sobre a primeira.
if (Reflect.get(window, '__vitrineDoFogoMontada') === true) {
  window.location.reload()
} else if (raiz !== null) {
  Reflect.set(window, '__vitrineDoFogoMontada', true)
  const tema = document.createElement('style')
  tema.textContent = themeCss()
  document.head.prepend(tema)
  createRoot(raiz).render(<Vitrine />)
}
