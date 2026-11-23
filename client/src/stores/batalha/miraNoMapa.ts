import { create } from 'zustand'
import type { Casa, Direcao, PegadaNaGrade } from '../../lib/batalha/area'
import type { CorDoAlcance } from '../../lib/batalha/alcance/cor'
import { usaDirecao, type FormaDoAlcance } from '../../lib/batalha/alcance/forma'
import type { MapaDoAlcance } from '../../lib/batalha/alcance/quemEntra'

/**
 * A MIRA NO MAPA (plano docs/design/habilidades/ALCANCE.md §7.2, fase E): o que a mira de quem age
 * mostra no chão da batalha, entre a `MiraDoGolpe` (a dona, que escreve) e a camada Pixi
 * `pixi/alcanceDoGolpe.ts` (no mestre e no jogador, que só lê). Ninguém guarda cópia.
 *
 * Duas listas: `local` (a mira desta tela; só ela tem o passar do mouse) e `remotas` (as miras dos
 * outros na mesa, a fase D põe aqui, já com a ficha e as paredes desta tela). A camada lê as duas
 * juntas por `mirasParaDesenhar`, então a fase D não muda a API da camada.
 *
 * O ponteiro (`apontar`) vira a casa em foco e o lado para onde a forma olha; muda o estado só
 * quando a casa ou o lado mudam, para o mouse correndo não acordar a mira a cada pixel.
 */

/** Uma mira como o chão a desenha: a forma que vale agora (com as condições) e onde quem usa está. */
export interface MiraNoMapa {
  /** A ficha de quem mira (uma mira por ficha). */
  tokenId: string
  /** A forma que vale agora, já com as condições de quem usa (`alcanceComCondicoes`). */
  forma: FormaDoAlcance
  cor: CorDoAlcance
  /** A ficha inteira de quem usa, na grade. */
  quemUsa: PegadaNaGrade
  /** Para onde a forma olha; `null` = a forma não olha para um lado. */
  direcao: Direcao | null
  /** As casas de quem usa também acendem (a ajuda que o pega, a forma `si`). */
  acendeQuemUsa: boolean
  /** As paredes e a grade da conta (as que esta tela tem). */
  mapa: MapaDoAlcance
  /** O centro escolhido da área longe (a casa da granada ou a ficha); `null` = ainda não. */
  centro: PegadaNaGrade | null
  /** As fichas marcadas (os cantos de latão). */
  alvos: readonly PegadaNaGrade[]
  /** As fichas da mesa na grade: a área numa ficha acende a explosão da ficha sob o mouse. */
  fichas: readonly PegadaNaGrade[]
}

/** Uma mira na hora de desenhar: a casa sob o mouse vale só para a mira desta tela. */
export interface MiraNoDesenho extends MiraNoMapa {
  foco: Casa | null
}

interface EstadoDaMiraNoMapa {
  local: MiraNoMapa | null
  /** As miras dos outros (fase D); vazia até lá. */
  remotas: readonly MiraNoMapa[]
  /** A casa sob o mouse (só da tela local); `null` = fora do mapa ou sem mira. */
  foco: Casa | null
  /** O lado do mouse em relação a quem usa, só nas formas que olham; `null` = no meio ou sem mira. */
  lado: Direcao | null
  mostrar: (mira: MiraNoMapa | null) => void
  /** Fase D: as miras dos outros, já resolvidas com a ficha e as paredes desta tela (a lista inteira troca). */
  mostrarDaMesa: (miras: readonly MiraNoMapa[]) => void
  /** O mouse em px do mundo; sem mira local, nada muda. */
  apontar: (x: number, y: number) => void
  soltarPonteiro: () => void
}

/** Perto do meio da ficha, o lado fica como está (o protótipo: 0,3 casa). */
const ZONA_MORTA_EM_CASAS = 0.3

/** O lado para onde o mouse está, visto do meio da ficha de quem usa; `null` = na zona morta. */
export function ladoDoPonteiro(quemUsa: PegadaNaGrade, col: number, row: number): Direcao | null {
  const dx = col - (quemUsa.col + quemUsa.tamanho / 2)
  const dy = row - (quemUsa.row + quemUsa.tamanho / 2)
  const zona = quemUsa.tamanho / 2 - 0.5 + ZONA_MORTA_EM_CASAS
  if (Math.abs(dx) < zona && Math.abs(dy) < zona) return null
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'leste' : 'oeste'
  return dy > 0 ? 'sul' : 'norte'
}

function mesmaCasa(a: Casa | null, b: Casa | null): boolean {
  return a === b || (a !== null && b !== null && a.col === b.col && a.row === b.row)
}

export const useMiraNoMapa = create<EstadoDaMiraNoMapa>()((set, get) => ({
  local: null,
  remotas: [],
  foco: null,
  lado: null,
  mostrar: (mira) => set(mira === null ? { local: null, foco: null, lado: null } : { local: mira }),
  mostrarDaMesa: (miras) => set({ remotas: miras }),
  apontar: (x, y) => {
    const { local, foco, lado } = get()
    if (local === null || local.mapa.grade <= 0) return
    const col = x / local.mapa.grade
    const row = y / local.mapa.grade
    const casa = { col: Math.floor(col), row: Math.floor(row) }
    const novoFoco = mesmaCasa(foco, casa) ? foco : casa
    // Fora da zona morta o lado segue o mouse; dentro dela, fica o último.
    const novoLado = usaDirecao(local.forma) ? (ladoDoPonteiro(local.quemUsa, col, row) ?? lado) : null
    if (novoFoco !== foco || novoLado !== lado) set({ foco: novoFoco, lado: novoLado })
  },
  soltarPonteiro: () => {
    if (get().foco !== null) set({ foco: null })
  },
}))

let guardado: { local: MiraNoMapa | null; remotas: readonly MiraNoMapa[]; foco: Casa | null; miras: readonly MiraNoDesenho[] } | null = null

/**
 * O que a camada do chão desenha: a mira desta tela (com o foco do mouse) e as dos outros. A mesma
 * lista enquanto nada muda (a camada compara pela referência).
 */
export function mirasParaDesenhar(estado: Pick<EstadoDaMiraNoMapa, 'local' | 'remotas' | 'foco'>): readonly MiraNoDesenho[] {
  if (guardado !== null && guardado.local === estado.local && guardado.remotas === estado.remotas && guardado.foco === estado.foco) return guardado.miras
  const daMesa = estado.remotas.filter((mira) => mira.tokenId !== estado.local?.tokenId).map((mira) => ({ ...mira, foco: null }))
  const miras = estado.local === null ? daMesa : [{ ...estado.local, foco: estado.foco }, ...daMesa]
  guardado = { local: estado.local, remotas: estado.remotas, foco: estado.foco, miras }
  return miras
}
