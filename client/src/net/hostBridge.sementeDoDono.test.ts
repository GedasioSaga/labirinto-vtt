import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { countExploredCells, createExploration, decodeExploration, encodeExploration, markAll } from '../lib/exploration'
import { createEmptyMap } from '../lib/mapFactory'
import type { SavedExploration, SavedSceneMemory, SavedTable } from '../lib/savedTable'
import { useToastStore } from '../stores/toastStore'
import type { MapData, Region, Token } from '../types/map'
import { BROADCAST_THROTTLE_MS, createHostBridge, EXPLORATION_SAVE_DELAY_MS } from './hostBridge'
import type { HostWorld } from './hostSession'
import type { SementeDoDono } from './visaoDeTeste/semente'

/**
 * VISÃO DE JOGADOR, lado da ponte da sala de verdade: `seatSeedFor` só LÊ a
 * memória do dono (o teste começa dela) e `forgetPlayerMemory` é o "Esquecer
 * tudo" da ponte de teste. A ponte da sala não pode gravar, mandar nem mudar
 * nada por causa da leitura.
 */

const ROOM = { code: 'SEMEN2', urls: [], qrSvg: '' }
const GRADE = 50
const COLUNAS = 40
const LINHAS = 10
/** Raio pequeno num mapa de 2000 px: a vista de agora é bem menor que a cena inteira. */
const RAIO = 300

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function cena(id: string, tokens: Token[]): MapData {
  return { ...createEmptyMap(id, id, COLUNAS, LINHAS, GRADE), tokens }
}

const SALAO = cena('m-salao', [ficha('bia-f', 125, 125), ficha('npc', 1800, 400)])
const CRIPTA = cena('m-cripta', [])
const MUNDO: HostWorld = { open: { sceneId: 's-salao', name: 'Salão', map: SALAO }, background: [{ sceneId: 's-cripta', name: 'Cripta', map: CRIPTA }] }

/** A memória gravada de uma cena INTEIRA explorada. */
function cenaExplorada(map: MapData): SavedSceneMemory {
  const exp = createExploration({ width: map.width * map.grid, height: map.height * map.grid, grid: map.grid })
  markAll(exp)
  return { mapId: map.id, width: map.width, height: map.height, grid: map.grid, explored: encodeExploration(exp), doors: [] }
}

const CELULAS_DA_CENA = countExploredCells(decodeExploration(cenaExplorada(SALAO).explored) ?? createExploration({ width: 1, height: 1, grid: 1 }))

/** Ontem Bia explorou a Cripta e o Salão inteiros; o mestre retoma a mesa hoje. */
const MESA: SavedTable = { version: 1, code: ROOM.code, seats: [{ name: 'Bia', tokenIds: ['bia-f'], visionRadius: 200, sceneKey: 'm-salao' }] }
const EXPLORADO: SavedExploration = { version: 1, seats: [{ name: 'Bia', scenes: [cenaExplorada(CRIPTA), cenaExplorada(SALAO)] }] }

function celulasDe(scene: SavedSceneMemory | undefined): number {
  const exp = scene === undefined ? null : decodeExploration(scene.explored)
  if (exp === null) throw new Error('a cena deveria ter um explorado válido')
  return countExploredCells(exp)
}

function montar(world: HostWorld = MUNDO) {
  const handlers = new Map<string, (event: { payload: unknown }) => void>()
  const invoke = vi.fn(async (cmd: string, _args?: unknown) => (cmd === 'net_start_room' ? ROOM : undefined))
  const listen = vi.fn(async (name: string, handler: (event: { payload: unknown }) => void) => {
    handlers.set(name, handler)
    return vi.fn()
  })
  const mesas: SavedTable[] = []
  const exploracoes: SavedExploration[] = []
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => world.open.map,
    getWorld: () => world,
    applyMove: vi.fn(),
    applyDoor: vi.fn(),
    visionRadius: RAIO,
    loadTable: () => MESA,
    saveTable: (table) => {
      mesas.push(table)
    },
    loadExploration: () => EXPLORADO,
    saveExploration: (exploration) => {
      exploracoes.push(exploration)
    },
  })
  const entra = (clientId: string, name: string): string => {
    const handler = handlers.get('net:message')
    if (handler === undefined) throw new Error('sem listener de net:message')
    handler({ payload: { clientId, msg: { type: 'join', code: ROOM.code, name } } })
    const jogador = bridge.players().find((player) => player.clientId === clientId)
    if (jogador === undefined) throw new Error(`${name} deveria ter entrado`)
    return jogador.playerId
  }
  const enviosPara = (clientId: string) => invoke.mock.calls.filter(([cmd, args]) => cmd === 'net_send' && JSON.stringify(args).includes(`"clientId":"${clientId}"`)).length
  return { bridge, invoke, entra, enviosPara, mesas, exploracoes }
}

function mapIds(semente: SementeDoDono | null): string[] {
  return (semente?.cenas ?? []).map((scene) => scene.mapId).sort()
}

describe('hostBridge: a memória do dono para a Visão de jogador', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })
  afterEach(() => {
    vi.useRealTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('sala fechada ou ficha sem dono: null', async () => {
    const m = montar()
    expect(m.bridge.seatSeedFor('bia-f')).toBeNull()
    await m.bridge.start({ resume: true })
    expect(m.bridge.seatSeedFor('npc')).toBeNull()
    expect(m.bridge.seatSeedFor('nao-existe')).toBeNull()
    await m.bridge.stop()
    expect(m.bridge.seatSeedFor('bia-f')).toBeNull()
  })

  it('dono que ainda não voltou: o assento e a memória guardados, sem fator (ele não está na sala)', async () => {
    const m = montar()
    await m.bridge.start({ resume: true })
    const semente = m.bridge.seatSeedFor('bia-f')
    expect(semente).toMatchObject({ nome: 'Bia', visionRadius: 200, visionFactor: null })
    expect(mapIds(semente)).toEqual(['m-cripta', 'm-salao'])
    expect(celulasDe(semente?.cenas.find((scene) => scene.mapId === 'm-cripta'))).toBe(CELULAS_DA_CENA)
  })

  it('dono na sala: assento, raio, fator e o explorado de todas as cenas — e a ponte da sala não grava, não manda e não muda nada', async () => {
    const m = montar()
    await m.bridge.start({ resume: true })
    const bia = m.entra('c1', 'bia')
    m.bridge.setVisionFactor(bia, 1.5)
    await vi.advanceTimersByTimeAsync(BROADCAST_THROTTLE_MS)
    // O explorado pendente já foi gravado: daqui em diante, nenhuma gravação é esperada.
    await vi.advanceTimersByTimeAsync(EXPLORATION_SAVE_DELAY_MS)
    const antes = {
      envios: m.invoke.mock.calls.length,
      mesas: m.mesas.length,
      exploracoes: m.exploracoes.length,
      jogadores: JSON.stringify(m.bridge.players()),
      // Nada agendado para depois: sem timer novo, nenhuma gravação ou envio pode sair mais tarde.
      timers: vi.getTimerCount(),
    }

    const semente = m.bridge.seatSeedFor('bia-f')
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(antes.timers)
    expect(semente).toMatchObject({ nome: 'Bia', visionRadius: 200, visionFactor: 1.5 })
    expect(mapIds(semente)).toEqual(['m-cripta', 'm-salao'])
    expect(celulasDe(semente?.cenas.find((scene) => scene.mapId === 'm-cripta'))).toBe(CELULAS_DA_CENA)
    const copia = JSON.stringify(semente)

    // O teste mexe na semente que recebeu: a memória de verdade fica como estava.
    const primeira = semente?.cenas[0]
    if (primeira === undefined) throw new Error('a semente deveria ter cenas')
    primeira.explored.bits = ''
    semente?.cenas.splice(0)

    expect(vi.getTimerCount()).toBe(antes.timers)
    expect(m.invoke.mock.calls.length).toBe(antes.envios)
    expect(m.mesas.length).toBe(antes.mesas)
    expect(m.exploracoes.length).toBe(antes.exploracoes)
    expect(JSON.stringify(m.bridge.players())).toBe(antes.jogadores)
    expect(JSON.stringify(m.bridge.seatSeedFor('bia-f'))).toBe(copia)
  })

  it('só o térreo: a memória do andar de cima não vai na semente (limitação declarada)', async () => {
    const biblioteca: Region = {
      id: 'biblioteca',
      points: [
        { x: 1600, y: 0 },
        { x: 2000, y: 0 },
        { x: 2000, y: 500 },
        { x: 1600, y: 500 },
      ],
      tag: '',
      fillColor: '#654',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'Biblioteca' },
      piso: 1,
    }
    const torre: MapData = { ...cena('m-torre', [ficha('lia', 150, 250), ficha('caio', 1850, 250, { piso: 1 })]), regions: [biblioteca] }
    const m = montar({ open: { sceneId: null, name: 'Torre', map: torre }, background: [] })
    await m.bridge.start()
    m.bridge.assignToken(m.entra('c1', 'Ana'), 'lia')
    m.bridge.assignToken(m.entra('c2', 'Bia'), 'caio')
    await vi.advanceTimersByTimeAsync(BROADCAST_THROTTLE_MS)

    expect(mapIds(m.bridge.seatSeedFor('lia'))).toEqual(['m-torre'])
    // Caio só viu o 1º piso: o dono existe (assento e raio vêm), a memória não.
    expect(m.bridge.seatSeedFor('caio')).toMatchObject({ nome: 'Bia', cenas: [] })
  })

  it('forgetPlayerMemory: esquece TODAS as cenas na hora, e a tela nova sai sem esperar', async () => {
    const m = montar()
    await m.bridge.start({ resume: true })
    const bia = m.entra('c1', 'Bia')
    await vi.advanceTimersByTimeAsync(BROADCAST_THROTTLE_MS)
    expect(mapIds(m.bridge.seatSeedFor('bia-f'))).toEqual(['m-cripta', 'm-salao'])
    const enviosAntes = m.enviosPara('c1')

    m.bridge.forgetPlayerMemory(bia)
    await vi.advanceTimersByTimeAsync(0)

    expect(m.enviosPara('c1')).toBeGreaterThan(enviosAntes)
    // A Cripta foi esquecida; do Salão sobra só o que a ficha vê agora.
    const depois = m.bridge.seatSeedFor('bia-f')
    expect(mapIds(depois)).toEqual(['m-salao'])
    const salao = celulasDe(depois?.cenas[0])
    expect(salao).toBeGreaterThan(0)
    expect(salao).toBeLessThan(CELULAS_DA_CENA)
  })
})
