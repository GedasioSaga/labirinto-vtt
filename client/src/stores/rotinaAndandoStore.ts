/// <reference types="vite/client" />
import { create } from 'zustand'
import { type AvisoDePortaTrancada, avisosDePortaTrancada, mesmosAvisos } from '../lib/avisosDaRotina'
import { ORCAMENTO_POR_QUADRO_MS } from '../lib/caminhamento/agenda'
import { comPortasDoNpc, type MotorDosNpcs, motorComRelogio, type PortaDoNpc, QUADRO_DA_AGENDA_MS } from '../lib/caminhamento/tiqueDosNpcs'
import { adiarEsperas, chaveDaRotina, darPassoDaRotina, desligarRotina, ligarRotina, PASSO_DA_ROTINA_MS, type RotinasAndando } from '../lib/rotinaAndando'
import type { CenaDaRotina } from '../lib/rotinaDoNpc'
import type { MapData } from '../types/map'
import { periodoDaSessao, subscribeToOpenings, useAdventureStore } from './adventureStore'
import { useMapStore } from './mapStore'
import { agoraDosNpcs, assinarPausa, usePausaDosNpcsStore } from './pausaDosNpcsStore'

/**
 * ROTINA ANDANDO no editor do mestre: quem está com a rotina ligada e o
 * relógio que dá um passo a cada `PASSO_DA_ROTINA_MS`. O relógio só corre com
 * alguém andando. É estado da sessão de jogo, como a iniciativa: não vai ao
 * arquivo nem ao jogador — ele recebe só a ficha no lugar novo, pelo mapa.
 * O passo em si é do agendador puro (`lib/rotinaAndando.ts`); aplicar é do
 * `useAdventureStore.moverFichasDaRotina`, com a mecânica do apito.
 *
 * O estado de cada NPC andando (o trecho, a espera, o `aviso` de quando
 * desiste de um posto) mora em `andando`: nunca na ficha nem no arquivo.
 */
interface RotinaAndandoState {
  andando: RotinasAndando
  /**
   * AVISO AO MESTRE: as portas trancadas que param quem anda, uma por NPC e
   * porta (`lib/avisosDaRotina.ts`). A mesma lista enquanto nada muda: a tela
   * (`components/AvisoDaRotina.tsx`) não redesenha a cada tique.
   */
  avisos: readonly AvisoDePortaTrancada[]
  /** Fichas que um jogador segura: ficam onde estão, com a rotina ligada. */
  fixas: ReadonlySet<string>
  ligar: (tokenId: string) => void
  desligar: (tokenId: string) => void
  setFixas: (fixas: ReadonlySet<string>) => void
  /** Um tique do relógio. */
  darPasso: () => void
  /** Desliga todas e para o relógio. */
  reset: () => void
}

/**
 * O MOTOR DE CAMINHOS do editor, um só para a rotina e a patrulha andando: a
 * malha do mapa é montada uma vez e serve às duas.
 */
export const motorDosNpcs: MotorDosNpcs = motorComRelogio(() => performance.now())

let relogio: ReturnType<typeof setInterval> | null = null
let rega: ReturnType<typeof setTimeout> | null = null

/** Busca que não coube no tique (mapa grande, porta trancada): segue nos quadros seguintes até acabar. */
export function regarAgenda(): void {
  const { agenda } = motorDosNpcs
  if (!agenda.temTrabalho) {
    if (rega !== null) clearTimeout(rega)
    rega = null
    return
  }
  if (rega !== null) return
  rega = setTimeout(() => {
    rega = null
    agenda.rodar(ORCAMENTO_POR_QUADRO_MS)
    regarAgenda()
  }, QUADRO_DA_AGENDA_MS)
}

/** O relógio corre enquanto houver ficha andando e os NPCs não estiverem pausados, e só então. */
function acertarRelogio(andando: RotinasAndando): void {
  const correr = andando.size > 0 && usePausaDosNpcsStore.getState().pausadaDesde === null
  if (correr && relogio === null) relogio = setInterval(() => useRotinaAndandoStore.getState().darPasso(), PASSO_DA_ROTINA_MS)
  if (!correr && relogio !== null) {
    clearInterval(relogio)
    relogio = null
  }
}

function estadosDaAventura() {
  return useAdventureStore.getState().adventure?.estados ?? []
}

/** As portas que os NPCs mexeram, cada cena com uma mudança de mesa só: fora do Ctrl+Z, como o passo. */
function aplicarPortas(portas: readonly PortaDoNpc[]): void {
  if (portas.length === 0) return
  const aberta = useAdventureStore.getState().activeSceneId
  for (const sceneId of new Set(portas.map((p) => p.sceneId))) {
    const daCena = portas.filter((p) => p.sceneId === sceneId)
    const transform = (map: MapData) => comPortasDoNpc(map, daCena)
    if (sceneId === aberta) useMapStore.getState().applyPlayerChange(transform)
    else useAdventureStore.getState().applyPlayerChangeToBackgroundScene(sceneId, transform)
  }
}

/** Os avisos de `andando`, cada ficha no mapa da cena onde está agora (a aberta pelo mapa vivo, as de fundo pelo cache). */
function avisosDaRotina(andando: RotinasAndando): AvisoDePortaTrancada[] {
  // As cenas só são lidas se alguém estiver parado por porta: o tique comum não paga a busca.
  let cenas: readonly CenaDaRotina[] | null = null
  return avisosDePortaTrancada('rotina', andando, (tokenId) => {
    cenas ??= useAdventureStore.getState().cenasDaRotina()
    return cenas.find((c) => c.map.tokens.some((t) => t.id === tokenId))?.map
  })
}

export const useRotinaAndandoStore = create<RotinaAndandoState>()((set, get) => {
  const trocar = (andando: RotinasAndando) => {
    const avisos = avisosDaRotina(andando)
    const mudouAviso = !mesmosAvisos(avisos, get().avisos)
    if (andando !== get().andando || mudouAviso) set(mudouAviso ? { andando, avisos } : { andando })
    acertarRelogio(andando)
  }
  const largar = (ids: Iterable<string>) => {
    for (const id of ids) motorDosNpcs.agenda.cancelar(chaveDaRotina(id))
    regarAgenda()
  }
  return {
    andando: new Map(),
    avisos: [],
    fixas: new Set(),
    ligar: (tokenId) => trocar(ligarRotina(get().andando, useAdventureStore.getState().cenasDaRotina(), tokenId, estadosDaAventura(), agoraDosNpcs())),
    desligar: (tokenId) => {
      largar([tokenId])
      trocar(desligarRotina(get().andando, tokenId))
    },
    setFixas: (fixas) => set({ fixas }),
    darPasso: () => {
      const { andando, fixas } = get()
      const aventura = useAdventureStore.getState()
      const cenas = aventura.cenasDaRotina()
      // ROTINA POR PERÍODO: o período da sessão a cada tique; a troca chega no tique seguinte, sem assinatura.
      const tique = darPassoDaRotina(cenas, andando, estadosDaAventura(), Date.now(), fixas, motorDosNpcs, periodoDaSessao(aventura))
      useAdventureStore.getState().moverFichasDaRotina(tique.movimentos)
      aplicarPortas(tique.portas)
      trocar(tique.andando)
      regarAgenda()
    },
    reset: () => {
      largar(get().andando.keys())
      trocar(new Map())
    },
  }
})

// Toda abertura (outro mapa, ou a mesma aventura de novo) começa sem ninguém
// andando: a rotina ligada é da sessão que saiu. A troca de cena não passa por
// aqui — a ficha segue andando na cena de fundo.
const pararAoAbrir = subscribeToOpenings(() => useRotinaAndandoStore.getState().reset())

// AVISO AO MESTRE: o mestre destrancou (ou trancou) uma porta do mapa aberto —
// o aviso acompanha na hora, sem esperar tique (com os NPCs pausados não há tique).
const seguirAsPortas = useMapStore.subscribe((estado, antes) => {
  if (estado.map.walls === antes.map.walls) return
  const { andando, avisos } = useRotinaAndandoStore.getState()
  if (andando.size === 0) return
  const novos = avisosDaRotina(andando)
  if (!mesmosAvisos(novos, avisos)) useRotinaAndandoStore.setState({ avisos: novos })
})

// PAUSA GERAL: pausar para o relógio sem desligar ninguém; retomar empurra as
// esperas no posto pelo tempo pausado e religa o relógio.
const seguirAPausa = assinarPausa(
  () => acertarRelogio(useRotinaAndandoStore.getState().andando),
  (pausadoMs) => {
    const andando = adiarEsperas(useRotinaAndandoStore.getState().andando, pausadoMs)
    if (andando !== useRotinaAndandoStore.getState().andando) useRotinaAndandoStore.setState({ andando })
    acertarRelogio(andando)
  },
)

// Em `npm run dev`, editar este módulo (ou o que ele importa) o troca por um novo,
// com o store zerado; sem isto o relógio do módulo velho seguia andando a ficha com
// o botão já dizendo "Andar sozinha". O Vite só roda o `dispose` de quem aceita a
// troca: o módulo aceita, para o relógio velho e repassa a troca a quem o importa,
// que passa a usar o store novo.
import.meta.hot?.accept(() => import.meta.hot?.invalidate())
import.meta.hot?.dispose(() => {
  pararAoAbrir()
  seguirAsPortas()
  seguirAPausa()
  if (relogio !== null) clearInterval(relogio)
  relogio = null
  if (rega !== null) clearTimeout(rega)
  rega = null
})
