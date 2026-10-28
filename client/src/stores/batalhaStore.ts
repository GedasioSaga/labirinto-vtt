import { create } from 'zustand'
import type { Casa } from '../lib/batalha/blocos'
import { somarNaTrilha } from '../lib/batalha/caminhoAndado'

/**
 * MODO BATALHA (fatia B4 de docs/planos/modo-batalha-2026-10-24.md): quais
 * cenas estão em batalha e o caminho andado de cada ficha nelas. Estado da
 * SESSÃO do mestre (decisão 1): não vai ao arquivo, ao desfazer nem ao
 * jogador. A chave da cena é a de `tableSceneKey` (`net/hostSession.ts`): o id
 * da cena na aventura, ou o id do mapa solto.
 *
 * Quem lê é a sessão do host (`getBatalha`, a cada snapshot e pedido de
 * movimento); quem soma o caminho é a mesma sessão (`onBatalhaAndou`). O App
 * assina a store: troca de cena em batalha manda o snapshot na hora
 * (`notifyBatalhaChanged`) e o `anuncio` novo vai aos jogadores e à tela da
 * mesa (`anunciarBatalha`). A B5 só chama `ligar`, `desligar` e `zerarCaminhos`.
 */

/** A abertura escolhida ao ligar: id da animação de transição e o texto dela ("Royals"). Os dois opcionais. */
export interface AberturaDaBatalha {
  transicao?: string
  texto?: string
}

export interface BatalhaDaCena {
  /** Blocos andados por ficha desde que a batalha ligou (ou desde o último "Zerar caminhos"). */
  caminhos: Readonly<Record<string, number>>
  /** B6: as casas andadas por ficha, para o desenho do caminho (teto em `CASAS_POR_TRILHA`). */
  trilhas: Readonly<Record<string, readonly Casa[]>>
  /** Quantas vezes o mestre zerou os caminhos desta batalha: o jogador avisa quando o número sobe. */
  zerados: number
  /** Sobe a cada caminho somado ou zerado: o host refaz o recorte de quem está na cena. */
  rev: number
}

/** O último "ligou a batalha": `seq` novo a cada `ligar`, para o App mandar o aviso uma vez. */
export interface AnuncioDaBatalha extends AberturaDaBatalha {
  seq: number
  sceneKey: string
}

interface BatalhaState {
  cenas: Readonly<Record<string, BatalhaDaCena>>
  anuncio: AnuncioDaBatalha | null
  /** Liga a batalha na cena (caminhos zerados) e anuncia a abertura. Já ligada: só anuncia de novo. */
  ligar: (sceneKey: string, abertura?: AberturaDaBatalha) => void
  /** Desliga a batalha na cena; o caminho andado some com ela. */
  desligar: (sceneKey: string) => void
  /** "Zerar caminhos": a batalha continua, o caminho andado de toda ficha da cena volta a 0. */
  zerarCaminhos: (sceneKey: string) => void
  /** A sessão do host aceitou `blocos` para a ficha nesta cena, andando `casas`. Cena fora de batalha: nada. */
  somarCaminho: (sceneKey: string, tokenId: string, blocos: number, casas?: readonly Casa[]) => void
  /** A cena está em batalha? */
  ligada: (sceneKey: string) => boolean
  /** Sala fechada: nenhuma cena em batalha. */
  reset: () => void
}

const SEM_CAMINHOS: Readonly<Record<string, number>> = {}
const SEM_TRILHAS: Readonly<Record<string, readonly Casa[]>> = {}
const CENA_NOVA: BatalhaDaCena = { caminhos: SEM_CAMINHOS, trilhas: SEM_TRILHAS, zerados: 0, rev: 0 }

function semACena(cenas: Readonly<Record<string, BatalhaDaCena>>, sceneKey: string): Record<string, BatalhaDaCena> {
  const resto: Record<string, BatalhaDaCena> = {}
  for (const [chave, cena] of Object.entries(cenas)) if (chave !== sceneKey) resto[chave] = cena
  return resto
}

export const useBatalhaStore = create<BatalhaState>()((set, get) => ({
  cenas: {},
  anuncio: null,

  ligar: (sceneKey, abertura = {}) => {
    const { cenas, anuncio } = get()
    const seq = (anuncio?.seq ?? 0) + 1
    const novo: AnuncioDaBatalha = { seq, sceneKey }
    if (abertura.transicao !== undefined) novo.transicao = abertura.transicao
    if (abertura.texto !== undefined) novo.texto = abertura.texto
    const jaLigada = Object.hasOwn(cenas, sceneKey)
    set(jaLigada ? { anuncio: novo } : { cenas: { ...cenas, [sceneKey]: CENA_NOVA }, anuncio: novo })
  },

  desligar: (sceneKey) => {
    const { cenas } = get()
    if (!Object.hasOwn(cenas, sceneKey)) return
    set({ cenas: semACena(cenas, sceneKey) })
  },

  zerarCaminhos: (sceneKey) => {
    const { cenas } = get()
    const cena = cenas[sceneKey]
    if (cena === undefined || Object.keys(cena.caminhos).length === 0) return
    set({ cenas: { ...cenas, [sceneKey]: { caminhos: SEM_CAMINHOS, trilhas: SEM_TRILHAS, zerados: cena.zerados + 1, rev: cena.rev + 1 } } })
  },

  somarCaminho: (sceneKey, tokenId, blocos, casas = []) => {
    const { cenas } = get()
    const cena = cenas[sceneKey]
    if (cena === undefined || !Number.isFinite(blocos) || blocos <= 0) return
    const caminhos = { ...cena.caminhos, [tokenId]: (cena.caminhos[tokenId] ?? 0) + blocos }
    const trilhas = { ...cena.trilhas, [tokenId]: somarNaTrilha(cena.trilhas[tokenId] ?? [], casas) }
    set({ cenas: { ...cenas, [sceneKey]: { caminhos, trilhas, zerados: cena.zerados, rev: cena.rev + 1 } } })
  },

  ligada: (sceneKey) => Object.hasOwn(get().cenas, sceneKey),

  reset: () => set({ cenas: {}, anuncio: null }),
}))
