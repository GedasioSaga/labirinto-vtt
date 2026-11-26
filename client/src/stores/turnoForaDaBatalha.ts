import { create } from 'zustand'
import { comCondicoesNaFicha } from '../lib/condicoes/naFicha'
import type { CondicaoNaFicha } from '../lib/itens/modelo'
import {
  passarTurnoForaDaBatalha,
  personagemComAPerda,
  trocarCondicoesNoMapa,
  type CondicoesDaFicha,
  type CondicoesDoPersonagemNoTurno,
  type PerdaDeVida,
} from '../lib/turnoForaDaBatalha'
import type { MapData } from '../types/map'
import { useAdventureStore } from './adventureStore'
import { useCondicoesPropriasStore } from './condicoesPropriasStore'
import { useMapStore } from './mapStore'
import { mesaDaAventura } from './mesaDaAventura'
import { chavesDaFichaNaBatalha } from './ponteDasCondicoes'

/**
 * O TURNO FORA DA BATALHA, por cena (Fase C, item 4, 15/11/2026): o número
 * ("Turno 5"), a linha do último "Passar turno" e o Desfazer dele. A conta é
 * de `lib/turnoForaDaBatalha.ts`; aqui só se lê a mesa e se grava.
 *
 * O número mora só na MEMÓRIA do app do mestre (decisão do Claude): o mapa
 * não ganha campo novo, e reabrir o app recomeça no Turno 1. O que importa
 * para o jogo (o prazo de cada ficha, a vida) fica no mapa e na ficha.
 *
 * O mapa muda FORA do Ctrl+Z do mestre, como a ponte da batalha
 * (`applyPlayerChange`): a vida do personagem também não está no Ctrl+Z, e as
 * duas voltam juntas pelo Desfazer do aviso.
 */

/** O turno de uma cena: o número e a linha do último passe (`null` = nenhum ainda). */
export interface TurnoDaCena {
  numero: number
  resumo: string | null
}

export const TURNO_INICIAL: TurnoDaCena = { numero: 1, resumo: null }

/** Um "Passar turno" feito: o que o Desfazer precisa para voltar tudo. */
export interface PasseDoTurno {
  id: number
  sceneKey: string
  antes: TurnoDaCena
  depois: TurnoDaCena
  /** As condições de cada ficha que mudou, como estavam ANTES do passe. */
  tokens: ReadonlyMap<string, CondicoesDaFicha>
  /** CONDIÇÕES NA FICHA (E4a): as condições de cada ficha de personagem que contou o turno, antes e depois. */
  personagens: readonly CondicoesDoPersonagemNoTurno[]
  perdas: readonly PerdaDeVida[]
  /** Uma frase por ficha com prazo (o aviso as mostra). */
  partes: readonly string[]
}

interface TurnoForaDaBatalhaState {
  cenas: Readonly<Record<string, TurnoDaCena>>
  /** O id do último passe de cada cena: só ele se desfaz. */
  ultimo: Readonly<Record<string, number>>
  /** Passa o turno da cena ABERTA `sceneKey`. `null` = ninguém com prazo, ou a cena não é a aberta. */
  passar: (sceneKey: string) => PasseDoTurno | null
  /** Volta o passe: condições, vida e número. `false` = não é mais o último passe da cena. */
  desfazer: (passe: PasseDoTurno) => boolean
  reset: () => void
}

/** A chave da cena aberta no editor, a mesma de `App.tsx` (a cena da aventura, ou o mapa solto). */
export function chaveDaCenaAberta(): string {
  return useAdventureStore.getState().activeSceneId ?? useMapStore.getState().map.id
}

/** O turno da cena; a que nunca passou turno está no 1. */
export function turnoDaCena(cenas: Readonly<Record<string, TurnoDaCena>>, sceneKey: string): TurnoDaCena {
  return Object.hasOwn(cenas, sceneKey) ? cenas[sceneKey] : TURNO_INICIAL
}

/** Muda o mapa da cena: a aberta, ou a de fundo já carregada. Fora do Ctrl+Z, nas duas. */
function mudarACena(sceneKey: string, mudar: (map: MapData) => MapData): void {
  if (chaveDaCenaAberta() === sceneKey) useMapStore.getState().applyPlayerChange(mudar)
  else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneKey, mudar)
}

/**
 * CONDIÇÕES NA FICHA (E4a): grava em cada ficha de personagem as condições `qual` (as de depois no
 * passe, as de antes no Desfazer). Ficha em que nada mudou (só tirou vida) não é regravada.
 */
function gravarCondicoesDasFichas(fichas: readonly CondicoesDoPersonagemNoTurno[], qual: (ficha: CondicoesDoPersonagemNoTurno) => readonly CondicaoNaFicha[]): void {
  for (const ficha of fichas) {
    if (ficha.antes === ficha.depois) continue
    mesaDaAventura.ajustarPersonagem(ficha.personagemId, (atual) => comCondicoesNaFicha(atual, qual(ficha)))
  }
}

let ultimoId = 0

export const useTurnoForaDaBatalhaStore = create<TurnoForaDaBatalhaState>()((set, get) => ({
  cenas: {},
  ultimo: {},

  passar: (sceneKey) => {
    if (chaveDaCenaAberta() !== sceneKey) return null
    const sistema = mesaDaAventura.sistema()
    const feito = passarTurnoForaDaBatalha(
      useMapStore.getState().map,
      mesaDaAventura.personagens(),
      sistema,
      (tokenId) => chavesDaFichaNaBatalha(sceneKey, tokenId),
      useCondicoesPropriasStore.getState().catalogo,
    )
    if (feito === null) return null
    // O mapa num passo só; as condições de depois valem também nos passos guardados do Ctrl+Z.
    mudarACena(sceneKey, (map) => trocarCondicoesNoMapa(map, feito.depois))
    gravarCondicoesDasFichas(feito.personagens, (ficha) => ficha.depois)
    const quando = Date.now()
    if (sistema !== null) for (const perda of feito.perdas) mesaDaAventura.ajustarPersonagem(perda.personagemId, (atual) => personagemComAPerda(atual, sistema, perda, quando))
    const antes = turnoDaCena(get().cenas, sceneKey)
    const numero = antes.numero + 1
    const depois: TurnoDaCena = { numero, resumo: `Turno ${antes.numero} para ${numero}: ${feito.partes.join('; ')}.` }
    ultimoId += 1
    const passe: PasseDoTurno = { id: ultimoId, sceneKey, antes, depois, tokens: feito.antes, personagens: feito.personagens, perdas: feito.perdas, partes: feito.partes }
    set({ cenas: { ...get().cenas, [sceneKey]: depois }, ultimo: { ...get().ultimo, [sceneKey]: passe.id } })
    return passe
  },

  desfazer: (passe) => {
    const { sceneKey } = passe
    if (get().ultimo[sceneKey] !== passe.id) return false
    mudarACena(sceneKey, (map) => trocarCondicoesNoMapa(map, passe.tokens))
    gravarCondicoesDasFichas(passe.personagens, (ficha) => ficha.antes)
    const sistema = mesaDaAventura.sistema()
    const quando = Date.now()
    if (sistema !== null) {
      for (const perda of passe.perdas) {
        mesaDaAventura.ajustarPersonagem(perda.personagemId, (atual) => personagemComAPerda(atual, sistema, { recursoId: perda.recursoId, de: perda.para, para: perda.de }, quando))
      }
    }
    const { [sceneKey]: _desfeito, ...ultimo } = get().ultimo
    set({ cenas: { ...get().cenas, [sceneKey]: passe.antes }, ultimo })
    return true
  },

  reset: () => set({ cenas: {}, ultimo: {} }),
}))
