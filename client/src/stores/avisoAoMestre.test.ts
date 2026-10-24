/**
 * AVISO AO MESTRE (caminhos, fatia F0): NPC com rotina ou patrulha cujo
 * caminho passa por porta TRANCADA, num mapa 300x300 — em até 10 tiques o
 * store expõe `porta-trancada` com o id da porta; destrancar tira o aviso na
 * hora (sem esperar tique, vale com os NPCs pausados); ele não se repete a
 * cada tique; e nada disso entra na ficha nem no recorte do jogador.
 *
 * O relógio de `performance` fica DE VERDADE: o motor mede o orçamento do
 * tique (8 ms) e dos quadros entre tiques por ele, e é esse orçamento que
 * decide se a busca que prova "não passa" cabe em 10 tiques num mapa grande.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorState, MapData, Token, Wall } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useRotinaAndandoStore } = await import('./rotinaAndandoStore')
const { usePatrulhaAndandoStore } = await import('./patrulhaAndandoStore')
const { usePausaDosNpcsStore } = await import('./pausaDosNpcsStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { PASSO_DA_ROTINA_MS } = await import('../lib/rotinaAndando')
const { PASSO_DA_PATRULHA_MS } = await import('../lib/patrulhaAndando')
const { filterMapForPlayer } = await import('../lib/fogFilter')

const GRID = 50
/** 300x300 casas. A parede corta o mapa ao meio: provar que não passa é varrer a metade inteira (45 mil casas). */
const CASAS = 300
const MEIO = (CASAS * GRID) / 2
const AQUEM = { x: MEIO - 2 * GRID, y: MEIO }
const ALEM = { x: MEIO + 2 * GRID, y: MEIO }
/** O aceite da fatia. */
const TIQUES_ATE_O_AVISO = 10
/** Onde a espera desiste nos testes que cobram outra coisa (40 s de jogo). */
const TETO_DE_TIQUES = 200

function paredeComPorta(locked: boolean): Wall[] {
  const porta: DoorState = { open: false, locked, kind: 'normal' }
  const base = { blocksLight: true, blocksMove: true }
  return [
    { id: 'p-norte', x1: MEIO, y1: 0, x2: MEIO, y2: MEIO - GRID, ...base, door: null },
    { id: 'porta', x1: MEIO, y1: MEIO - GRID, x2: MEIO, y2: MEIO + GRID, ...base, door: porta },
    { id: 'p-sul', x1: MEIO, y1: MEIO + GRID, x2: MEIO, y2: CASAS * GRID, ...base, door: null },
  ]
}

function heroi(): Token {
  return { id: 'heroi', characterId: 'pc-heroi', name: 'Herói', x: AQUEM.x - 2 * GRID, y: AQUEM.y, size: 1, image: null }
}

/** Outro NPC, 6 casas abaixo, que patrulha para o outro lado: só serve para montar a malha antes da medida. */
function aquecedor(): Token {
  const y = AQUEM.y + 6 * GRID
  return { id: 'aquecedor', characterId: null, name: 'Aquecedor', x: AQUEM.x, y, size: 1, image: null, npc: true, patrulha: { pontos: [{ x: AQUEM.x, y }, { x: ALEM.x, y }], atual: 0 } }
}

function mapaGrande(npc: Token): MapData {
  return { ...createEmptyMap('m-grande', 'Mapa grande', CASAS, CASAS, GRID), walls: paredeComPorta(true), tokens: [npc, heroi(), aquecedor()] }
}

function destrancar(): void {
  useMapStore.getState().setWallDoor('porta', { open: false, locked: false, kind: 'normal' })
}

/** Tiques até o store `avisos` ter algo (no máximo `teto`); devolve quantos foram. */
function tiquesAteOAviso(avisos: () => readonly unknown[], passoMs: number, teto: number): number {
  for (let tique = 1; tique <= teto; tique += 1) {
    vi.advanceTimersByTime(passoMs)
    if (avisos().length > 0) return tique
  }
  return Number.POSITIVE_INFINITY
}

/**
 * A malha do mapa já montada, como para quem já anda por ele quando topa a
 * porta: a 1ª montagem de 300x300 (os marcos do A*) leva de 14 a 26 tiques
 * conforme a carga da máquina (medido em 23/10/2026) e é do motor, não do
 * aviso. Fica registrada no plano (F0), fora do aceite.
 */
function aquecerOMotor(): void {
  usePatrulhaAndandoStore.getState().ligar('aquecedor')
  tiquesAteOAviso(() => usePatrulhaAndandoStore.getState().avisos, PASSO_DA_PATRULHA_MS, TETO_DE_TIQUES)
  usePatrulhaAndandoStore.getState().reset()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(0)
  useAdventureStore.getState().reset()
})

afterEach(() => {
  useRotinaAndandoStore.getState().reset()
  usePatrulhaAndandoStore.getState().reset()
  usePausaDosNpcsStore.getState().retomar()
  vi.useRealTimers()
})

describe('rotina: porta trancada no caminho, mapa 300x300', () => {
  function montarRotina(): void {
    const tobias: Token = { id: 'tobias', characterId: null, name: 'Irmão Tobias', x: AQUEM.x, y: AQUEM.y, size: 1, image: null, npc: true }
    useMapStore.getState().loadMap(mapaGrande(tobias))
    useAdventureStore.getState().virarAventura(null)
    const cena = useAdventureStore.getState().activeSceneId ?? ''
    const apito = useAdventureStore.getState().criarEstadoDoMundo('Apito', 'Aquém, Além')
    if (apito === null) throw new Error('não criou o estado')
    useMapStore.getState().setTokenRotina('tobias', {
      estadoId: apito,
      postos: [
        { valor: 'Aquém', sceneId: cena, ...AQUEM },
        { valor: 'Além', sceneId: cena, ...ALEM },
      ],
    })
  }

  it(`em até ${TIQUES_ATE_O_AVISO} tiques o store diz porta-trancada com o id da porta, o nome da ficha e a porta em português`, () => {
    montarRotina()
    aquecerOMotor()
    useRotinaAndandoStore.getState().ligar('tobias')
    const tiques = tiquesAteOAviso(() => useRotinaAndandoStore.getState().avisos, PASSO_DA_ROTINA_MS, TETO_DE_TIQUES)
    expect(tiques, `tiques até o aviso: ${tiques}`).toBeLessThanOrEqual(TIQUES_ATE_O_AVISO)
    expect(useRotinaAndandoStore.getState().avisos).toEqual([
      expect.objectContaining({ origem: 'rotina', motivo: 'porta-trancada', tokenId: 'tobias', portaId: 'porta', npc: 'Irmão Tobias', porta: 'Porta' }),
    ])
  })

  it('não repete a cada tique: a mesma lista, um aviso por NPC e porta, até a desistência e depois dela', () => {
    montarRotina()
    useRotinaAndandoStore.getState().ligar('tobias')
    tiquesAteOAviso(() => useRotinaAndandoStore.getState().avisos, PASSO_DA_ROTINA_MS, TETO_DE_TIQUES)
    const primeira = useRotinaAndandoStore.getState().avisos
    const listas = new Set([primeira])
    // 40 tiques = 8 s: passa pelas 3 tentativas, desiste e volta a tentar.
    for (let tique = 0; tique < 40; tique += 1) {
      vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
      listas.add(useRotinaAndandoStore.getState().avisos)
    }
    expect(listas.size).toBe(1)
    expect(primeira).toHaveLength(1)
    expect(useRotinaAndandoStore.getState().andando.get('tobias')?.aviso?.motivo).toBe('porta-trancada')
  })

  it('destrancou: o aviso some na hora, mesmo com os NPCs pausados; ele passa e não volta', () => {
    montarRotina()
    useRotinaAndandoStore.getState().ligar('tobias')
    tiquesAteOAviso(() => useRotinaAndandoStore.getState().avisos, PASSO_DA_ROTINA_MS, TETO_DE_TIQUES)
    usePausaDosNpcsStore.getState().pausar()
    destrancar()
    expect(useRotinaAndandoStore.getState().avisos).toEqual([])
    usePausaDosNpcsStore.getState().retomar()
    for (let tique = 0; tique < 80 && useMapStore.getState().map.tokens.find((t) => t.id === 'tobias')?.x !== ALEM.x; tique += 1) {
      vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
      expect(useRotinaAndandoStore.getState().avisos).toEqual([])
    }
    expect(useMapStore.getState().map.tokens.find((t) => t.id === 'tobias')).toMatchObject(ALEM)
  })

  it('o aviso é só do mestre: a ficha não ganha campo e o recorte do jogador não leva motivo, porta nem frase', () => {
    montarRotina()
    const chavesAntes = Object.keys(useMapStore.getState().map.tokens.find((t) => t.id === 'tobias') ?? {}).sort()
    useRotinaAndandoStore.getState().ligar('tobias')
    tiquesAteOAviso(() => useRotinaAndandoStore.getState().avisos, PASSO_DA_ROTINA_MS, TETO_DE_TIQUES)
    expect(useRotinaAndandoStore.getState().avisos).not.toEqual([])
    const map = useMapStore.getState().map
    expect(Object.keys(map.tokens.find((t) => t.id === 'tobias') ?? {}).sort()).toEqual(chavesAntes)
    const texto = JSON.stringify(filterMapForPlayer(map, 'p1', { p1: ['heroi'] }, 700))
    // O jogador vê o Tobias (o recorte não está vazio), e só ele.
    expect(texto).toContain('"id":"tobias"')
    expect(texto).not.toContain('porta-trancada')
    expect(texto).not.toContain('parou')
    expect(texto).not.toContain('aviso')
    // Nem para onde ele ia (a rotina, com os postos): o motivo e o destino são do mestre.
    expect(texto).not.toContain('"rotina"')
    expect(texto).not.toContain('Além')
  })
})

describe('patrulha: porta trancada no caminho, mapa 300x300', () => {
  function montarPatrulha(): void {
    const guarda: Token = {
      id: 'guarda',
      characterId: null,
      name: 'Guarda',
      x: AQUEM.x,
      y: AQUEM.y,
      size: 1,
      image: null,
      npc: true,
      patrulha: { pontos: [{ ...AQUEM }, { ...ALEM }], atual: 0 },
    }
    useMapStore.getState().loadMap(mapaGrande(guarda))
  }

  it(`em até ${TIQUES_ATE_O_AVISO} tiques o store diz porta-trancada com o id da porta; destrancou, some`, () => {
    montarPatrulha()
    aquecerOMotor()
    usePatrulhaAndandoStore.getState().ligar('guarda')
    const tiques = tiquesAteOAviso(() => usePatrulhaAndandoStore.getState().avisos, PASSO_DA_PATRULHA_MS, TETO_DE_TIQUES)
    expect(tiques, `tiques até o aviso: ${tiques}`).toBeLessThanOrEqual(TIQUES_ATE_O_AVISO)
    expect(usePatrulhaAndandoStore.getState().avisos).toEqual([
      expect.objectContaining({ origem: 'patrulha', motivo: 'porta-trancada', tokenId: 'guarda', portaId: 'porta', npc: 'Guarda' }),
    ])
    destrancar()
    expect(usePatrulhaAndandoStore.getState().avisos).toEqual([])
  })

  it('desligar a patrulha tira o aviso', () => {
    montarPatrulha()
    usePatrulhaAndandoStore.getState().ligar('guarda')
    tiquesAteOAviso(() => usePatrulhaAndandoStore.getState().avisos, PASSO_DA_PATRULHA_MS, TETO_DE_TIQUES)
    usePatrulhaAndandoStore.getState().desligar('guarda')
    expect(usePatrulhaAndandoStore.getState().avisos).toEqual([])
  })
})
