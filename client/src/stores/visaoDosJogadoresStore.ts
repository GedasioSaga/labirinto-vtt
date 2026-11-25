import { create } from 'zustand'
import type { PlayerInfo } from '../net/hostSession'
import type { MapData, TokenContract } from '../types/map'

/**
 * VISÃO DOS JOGADORES (pedido do mestre de 25/11/2026): o anel do alcance de
 * visão de cada ficha de jogador, só no editor do mestre
 * (`pixi/drawVisaoDosJogadores.ts`).
 *
 * O botão liga/desliga é preferência do APARELHO, como o Chão leve
 * (`chaoLeveStore`): mora no localStorage do mestre e nasce LIGADO. O resto é
 * estado da sessão, como a posse (`donosDasFichasStore`): os acordos das fichas
 * emprestadas e de onde sai o raio que o host aplica. Nada vai ao disco do mapa
 * nem ao desfazer; quem escreve é o App, quem lê é o `PixiCanvas`.
 */

export const CHAVE_DA_VISAO_DOS_JOGADORES = 'lb-visao-dos-jogadores'

/** O pedaço de `Storage` usado: o `localStorage` real ou um dublê. */
export type ArmazemDaVisao = Pick<Storage, 'getItem' | 'setItem'>

/** Storage bloqueado, vazio ou adulterado: ligado (o padrão), e nada lança. */
export function lerVisaoDosJogadores(armazem: ArmazemDaVisao | null): boolean {
  if (armazem === null) return true
  try {
    return armazem.getItem(CHAVE_DA_VISAO_DOS_JOGADORES) !== '0'
  } catch {
    return true
  }
}

/** Storage cheio ou bloqueado: a escolha vale só enquanto o app estiver aberto. */
export function gravarVisaoDosJogadores(armazem: ArmazemDaVisao | null, ligada: boolean): void {
  if (armazem === null) return
  try {
    armazem.setItem(CHAVE_DA_VISAO_DOS_JOGADORES, ligada ? '1' : '0')
  } catch {
    // Sem persistência: segue com a escolha em memória.
  }
}

/** O raio que a sessão aplica a cada ficha com dono neste mapa (`HostBridge.tokenVisionRadii`), em px de mundo. */
export type RaiosDaSessao = (map: MapData) => ReadonlyMap<string, number>

const NENHUM_ACORDO: ReadonlyMap<string, TokenContract> = new Map()
const SEM_RAIOS: ReadonlyMap<string, number> = new Map()
const SEM_SESSAO: RaiosDaSessao = () => SEM_RAIOS

interface VisaoDosJogadoresState {
  /** O botão "Visão dos jogadores" da barra do editor. */
  ligada: boolean
  alternar: () => void
  /** AJUDANTE CONTRATADO: o acordo de cada ficha emprestada, de todos os jogadores (`PlayerInfo.loans`). */
  acordos: ReadonlyMap<string, TokenContract>
  /** Lista nova da ponte. Só troca a referência quando algum acordo muda: o canvas refaz os anéis a cada troca. */
  setFromPlayers: (players: readonly PlayerInfo[]) => void
  /** Sala fechada: nenhum acordo. */
  clear: () => void
  raiosDaSessao: RaiosDaSessao
  /** O App liga a ponte do host aqui uma vez; sem ponte, nenhuma ficha tem raio. */
  definirRaiosDaSessao: (raios: RaiosDaSessao) => void
}

function mesmosAcordos(a: ReadonlyMap<string, TokenContract>, b: ReadonlyMap<string, TokenContract>): boolean {
  if (a.size !== b.size) return false
  for (const [tokenId, acordo] of a) {
    const outro = b.get(tokenId)
    if (outro === undefined || outro.visao !== acordo.visao) return false
  }
  return true
}

function armazemDoNavegador(): ArmazemDaVisao | null {
  try {
    // Só ler `localStorage` já lança em iframe sem permissão ou com o dado do site bloqueado.
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Store com o armazém injetado, para quem precisar de um dublê; o app usa `useVisaoDosJogadoresStore`. */
export function criarVisaoDosJogadoresStore(armazem: ArmazemDaVisao | null) {
  return create<VisaoDosJogadoresState>()((set, get) => ({
    ligada: lerVisaoDosJogadores(armazem),
    alternar: () => {
      const ligada = !get().ligada
      set({ ligada })
      gravarVisaoDosJogadores(armazem, ligada)
    },

    acordos: NENHUM_ACORDO,
    setFromPlayers: (players) => {
      const acordos = new Map<string, TokenContract>()
      for (const player of players) {
        for (const [tokenId, acordo] of Object.entries(player.loans ?? {})) acordos.set(tokenId, acordo)
      }
      if (mesmosAcordos(get().acordos, acordos)) return
      set({ acordos: acordos.size === 0 ? NENHUM_ACORDO : acordos })
    },
    clear: () => {
      if (get().acordos.size > 0) set({ acordos: NENHUM_ACORDO })
    },

    raiosDaSessao: SEM_SESSAO,
    definirRaiosDaSessao: (raiosDaSessao) => set({ raiosDaSessao }),
  }))
}

export const useVisaoDosJogadoresStore = criarVisaoDosJogadoresStore(armazemDoNavegador())
