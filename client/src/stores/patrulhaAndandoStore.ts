/// <reference types="vite/client" />
import { create } from 'zustand'
import { type AvisoDePortaTrancada, avisosDePortaTrancada, mesmosAvisos } from '../lib/avisosDaRotina'
import { comPortasDoNpc } from '../lib/caminhamento/tiqueDosNpcs'
import {
  adiarEsperas,
  calarFicha,
  chaveDaPatrulha,
  darPassoDaPatrulha,
  desligarPatrulha,
  ligarPatrulha,
  moverPatrulhas,
  PASSO_DA_PATRULHA_MS,
  passosDaRota,
  seguirPatrulha,
  type FichaPatrulhando,
  type PatrulhasAndando,
} from '../lib/patrulhaAndando'
import type { CenaDaRotina } from '../lib/rotinaDoNpc'
import type { MapData } from '../types/map'
import { subscribeToOpenings, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { agoraDosNpcs, assinarPausa, usePausaDosNpcsStore } from './pausaDosNpcsStore'
import { motorDosNpcs, regarAgenda } from './rotinaAndandoStore'

/**
 * PATRULHA ANDANDO no editor do mestre: quem está com "Patrulhar sozinha"
 * ligado e o relógio que dá um passo a cada `PASSO_DA_PATRULHA_MS`. O relógio
 * só corre com alguém andando e sem a pausa geral dos NPCs. Estado da sessão
 * de jogo, como a rotina andando: não vai ao arquivo (o mapa reaberto volta
 * parado) nem ao jogador, que recebe só a ficha no lugar novo.
 *
 * O passo é do agendador puro (`lib/patrulhaAndando.ts`), uma vez por cena
 * com alguém patrulhando: a ficha anda na cena ONDE ESTÁ — a aberta ou, numa
 * aventura, uma de fundo. Trocar de cena não desliga a patrulha: o guarda não
 * congela para os jogadores quando o mestre olha outra cena, como a rotina
 * andando. Aplicar é `useMapStore.applyPlayerChange` na cena aberta e
 * `applyPlayerChangeToBackgroundScene` nas de fundo — fora do Ctrl+Z (desfazer
 * não devolve o guarda ao passo anterior) e pelo mesmo caminho que leva a
 * ficha ao jogador com deslize. As portas que ela abre e fecha vão na mesma
 * mudança. O caminho sai do motor do editor, o mesmo da rotina
 * (`motorDosNpcs`); o trecho e o `aviso` de quando ela desiste de um ponto
 * moram em `andando`, nunca na ficha.
 */
interface PatrulhaAndandoState {
  andando: PatrulhasAndando
  /** AVISO AO MESTRE: as portas trancadas que param quem patrulha, como na rotina andando. */
  avisos: readonly AvisoDePortaTrancada[]
  /** Fichas que um jogador segura: ficam onde estão, com a patrulha ligada. */
  fixas: ReadonlySet<string>
  /** Fichas que o mestre arrasta agora no canvas: o arrasto manda, a patrulha espera. */
  arrastadas: ReadonlySet<string>
  ligar: (tokenId: string) => void
  desligar: (tokenId: string) => void
  setFixas: (fixas: ReadonlySet<string>) => void
  /** Começo (ids) e fim (vazio) do arrasto do mestre (`pixi/PixiCanvas.tsx`). */
  setArrastadas: (ids: ReadonlySet<string>) => void
  /** "Seguir" do painel: solta a ficha parada em "Esperar o mestre". */
  seguir: (tokenId: string) => void
  /** O ponto cuja macro está aberta no painel: o mapa o destaca (`pixi/drawNpcPatrol.ts`). */
  pontoAberto: PontoAberto | null
  abrirPonto: (ponto: PontoAberto | null) => void
  /** Um tique do relógio. */
  darPasso: () => void
  /** Desliga todas e para o relógio. */
  reset: () => void
}

/** Um ponto da rota de uma ficha. */
export interface PontoAberto {
  tokenId: string
  indice: number
}

let relogio: ReturnType<typeof setInterval> | null = null

/** O relógio corre enquanto houver ficha patrulhando e os NPCs não estiverem pausados, e só então. */
function acertarRelogio(andando: PatrulhasAndando): void {
  const correr = andando.size > 0 && usePausaDosNpcsStore.getState().pausadaDesde === null
  if (correr && relogio === null) relogio = setInterval(() => usePatrulhaAndandoStore.getState().darPasso(), PASSO_DA_PATRULHA_MS)
  if (!correr && relogio !== null) {
    clearInterval(relogio)
    relogio = null
  }
}

/** O id da "cena" do mapa solto: fora de aventura só existe o mapa aberto. */
const MAPA_SOLTO = ''

/** Onde a patrulha pode andar agora: a cena aberta (mapa vivo) e as de fundo que abriram; no mapa solto, só ele. */
function cenasDaPatrulha(): readonly CenaDaRotina[] {
  const cenas = useAdventureStore.getState().cenasDaRotina()
  return cenas.length > 0 ? cenas : [{ sceneId: MAPA_SOLTO, map: useMapStore.getState().map }]
}

/** A cena onde a ficha está agora. A aberta vem primeiro na lista, e ganha se o id aparecer em duas. */
function cenaDaFicha(cenas: readonly CenaDaRotina[], tokenId: string): CenaDaRotina | undefined {
  return cenas.find((cena) => cena.map.tokens.some((token) => token.id === tokenId))
}

/** Uma mudança de mesa (fora do Ctrl+Z) na cena `sceneId`: a aberta pelo mapa vivo, a de fundo pela aventura. */
function mudarNaCena(sceneId: string, transform: (map: MapData) => MapData): void {
  const aventura = useAdventureStore.getState()
  if (aventura.adventure === null || sceneId === aventura.activeSceneId) useMapStore.getState().applyPlayerChange(transform)
  else aventura.applyPlayerChangeToBackgroundScene(sceneId, transform)
}

/** Os avisos de `andando`, cada ficha no mapa da cena onde está agora (como os da rotina andando). */
function avisosDaPatrulha(andando: PatrulhasAndando): AvisoDePortaTrancada[] {
  // As cenas só são lidas se alguém estiver parado por porta: o tique comum não paga a busca.
  let cenas: readonly CenaDaRotina[] | null = null
  return avisosDePortaTrancada('patrulha', andando, (tokenId) => {
    cenas ??= cenasDaPatrulha()
    const cena = cenaDaFicha(cenas, tokenId)
    return cena === undefined ? undefined : cena.map
  })
}

export const usePatrulhaAndandoStore = create<PatrulhaAndandoState>()((set, get) => {
  const trocar = (andando: PatrulhasAndando) => {
    const avisos = avisosDaPatrulha(andando)
    const mudouAviso = !mesmosAvisos(avisos, get().avisos)
    if (andando !== get().andando || mudouAviso) set(mudouAviso ? { andando, avisos } : { andando })
    acertarRelogio(andando)
  }
  const largar = (ids: Iterable<string>) => {
    for (const id of ids) motorDosNpcs.agenda.cancelar(chaveDaPatrulha(id))
    regarAgenda()
  }
  return {
    andando: new Map(),
    avisos: [],
    fixas: new Set(),
    arrastadas: new Set(),
    ligar: (tokenId) => trocar(ligarPatrulha(get().andando, useMapStore.getState().map, tokenId, agoraDosNpcs())),
    desligar: (tokenId) => {
      // Parou no meio de um "Falar": o balão não fica sobre a ficha parada. Fora do Ctrl+Z, como a fala, na cena onde ela está.
      const cena = get().andando.has(tokenId) ? cenaDaFicha(cenasDaPatrulha(), tokenId) : undefined
      if (cena !== undefined) mudarNaCena(cena.sceneId, (map) => calarFicha(map, tokenId))
      largar([tokenId])
      trocar(desligarPatrulha(get().andando, tokenId))
    },
    seguir: (tokenId) => trocar(seguirPatrulha(get().andando, tokenId, agoraDosNpcs())),
    pontoAberto: null,
    abrirPonto: (ponto) => {
      const antes = get().pontoAberto
      if (ponto?.tokenId === antes?.tokenId && ponto?.indice === antes?.indice) return
      set({ pontoAberto: ponto })
    },
    setFixas: (fixas) => set({ fixas }),
    setArrastadas: (ids) => {
      // Todo fim de gesto do canvas chama com vazio: sem isto cada clique acordava quem assina.
      if (ids.size === 0 && get().arrastadas.size === 0) return
      set({ arrastadas: ids })
    },
    darPasso: () => {
      const { andando, fixas, arrastadas } = get()
      const paradas = arrastadas.size === 0 ? fixas : new Set([...fixas, ...arrastadas])
      const now = Date.now()
      const cenas = cenasDaPatrulha()
      // Cada ficha anda na cena onde está agora. A que não está em cena nenhuma (apagada, cena que saiu) para.
      const porCena = new Map<string, Map<string, FichaPatrulhando>>()
      for (const [tokenId, ficha] of andando) {
        const cena = cenaDaFicha(cenas, tokenId)
        if (cena === undefined) {
          motorDosNpcs.agenda.cancelar(chaveDaPatrulha(tokenId))
          continue
        }
        const grupo = porCena.get(cena.sceneId) ?? new Map<string, FichaPatrulhando>()
        grupo.set(tokenId, ficha)
        porCena.set(cena.sceneId, grupo)
      }
      const depois = new Map<string, FichaPatrulhando>()
      for (const cena of cenas) {
        const grupo = porCena.get(cena.sceneId)
        if (grupo === undefined) continue
        const tique = darPassoDaPatrulha(cena.map, grupo, now, paradas, passosDaRota, motorDosNpcs)
        const { movimentos, portas } = tique
        if (movimentos.length > 0 || portas.length > 0) mudarNaCena(cena.sceneId, (map) => comPortasDoNpc(moverPatrulhas(map, movimentos), portas))
        for (const [tokenId, ficha] of tique.andando) depois.set(tokenId, ficha)
      }
      // Na ordem de antes: a lista do painel e a dos avisos não embaralham com fichas em cenas diferentes.
      const seguem = new Map<string, FichaPatrulhando>()
      for (const tokenId of andando.keys()) {
        const ficha = depois.get(tokenId)
        if (ficha !== undefined) seguem.set(tokenId, ficha)
      }
      trocar(seguem)
      regarAgenda()
    },
    reset: () => {
      largar(get().andando.keys())
      // Um arrasto que não chegou ao fim (o canvas saiu no meio do gesto) não prende ninguém no mapa seguinte.
      if (get().arrastadas.size > 0) set({ arrastadas: new Set() })
      // O ponto aberto era de uma ficha do mapa que saiu.
      if (get().pontoAberto !== null) set({ pontoAberto: null })
      trocar(new Map())
    },
  }
})

// Toda abertura (outro mapa, solto ou de aventura) começa sem ninguém
// patrulhando: a patrulha ligada é da sessão que saiu. A troca de cena não
// passa por aqui, e não desliga ninguém: a ficha segue patrulhando na cena de fundo.
const pararAoAbrir = subscribeToOpenings(() => usePatrulhaAndandoStore.getState().reset())

// AVISO AO MESTRE: porta destrancada (ou trancada) no mapa aberto muda o aviso na hora, sem esperar tique.
const seguirAsPortas = useMapStore.subscribe((estado, antes) => {
  if (estado.map.walls === antes.map.walls) return
  const { andando, avisos } = usePatrulhaAndandoStore.getState()
  if (andando.size === 0) return
  const novos = avisosDaPatrulha(andando)
  if (!mesmosAvisos(novos, avisos)) usePatrulhaAndandoStore.setState({ avisos: novos })
})

// PAUSA GERAL: o mesmo acordo da rotina andando.
const seguirAPausa = assinarPausa(
  () => acertarRelogio(usePatrulhaAndandoStore.getState().andando),
  (pausadoMs) => {
    const andando = adiarEsperas(usePatrulhaAndandoStore.getState().andando, pausadoMs)
    if (andando !== usePatrulhaAndandoStore.getState().andando) usePatrulhaAndandoStore.setState({ andando })
    acertarRelogio(andando)
  },
)

// Em `npm run dev`, o mesmo cuidado de `rotinaAndandoStore`: o módulo trocado
// para o relógio velho, que senão seguia andando a ficha com o botão já
// dizendo "Patrulhar sozinha".
import.meta.hot?.accept(() => import.meta.hot?.invalidate())
import.meta.hot?.dispose(() => {
  pararAoAbrir()
  seguirAsPortas()
  seguirAPausa()
  if (relogio !== null) clearInterval(relogio)
  relogio = null
})
