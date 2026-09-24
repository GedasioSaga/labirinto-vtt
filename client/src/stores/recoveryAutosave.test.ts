import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMapStore } from './mapStore'
import { subscribeToDirtyFlag, useSessionStore } from './sessionStore'
import { useAdventureStore } from './adventureStore'
import { RECOVERY_INTERVAL_MS, restoreRecoveryCopy, startRecoveryAutosave, type RecoveryAutosave } from './recoveryAutosave'
import * as mapFactory from '../lib/mapFactory'
import type { RecoveryCopy } from '../lib/recoveryCopy'
import type { OpenedMapFile } from '../lib/mapFileIO'
import { ADVENTURE_VERSION } from '../lib/adventure'
import type { Wall } from '../types/map'

const parede: Wall = { id: 'w1', x1: 0, y1: 0, x2: 64, y2: 0, blocksLight: true, blocksMove: true, door: null }
const outraParede: Wall = { ...parede, id: 'w2', y1: 64, y2: 64 }
const CAMINHO = 'C:/appdata/maps/map_teste/map.json'
const AGORA = Date.UTC(2026, 8, 23, 17, 5)

/** Disco falso que registra a ordem das operações. */
function discoFalso() {
  const ops: string[] = []
  const gravadas: RecoveryCopy[] = []
  return {
    ops,
    gravadas,
    write: vi.fn(async (copy: RecoveryCopy) => {
      ops.push('write')
      gravadas.push(copy)
    }),
    clear: vi.fn(async () => {
      ops.push('clear')
    }),
  }
}

let pararFlag: () => void = () => {}
let autosave: RecoveryAutosave | null = null

beforeEach(() => {
  vi.useFakeTimers()
  pararFlag = subscribeToDirtyFlag()
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_teste', 'Masmorra', 10, 10, 64))
  useSessionStore.getState().markSaved()
})

afterEach(() => {
  autosave?.stop()
  autosave = null
  pararFlag()
  vi.useRealTimers()
})

function ligar(disco: ReturnType<typeof discoFalso>, extras: { onError?: (err: unknown) => void } = {}): RecoveryAutosave {
  autosave = startRecoveryAutosave({ storage: disco, getLooseMapPath: () => CAMINHO, now: () => AGORA, ...extras })
  return autosave
}

describe('salvamento automático da cópia de recuperação', () => {
  it('edição não salva vira cópia em até um intervalo, com o mapa, a origem e a hora', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS - 1)
    expect(disco.write).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await a.idle()
    expect(disco.gravadas).toHaveLength(1)
    expect(disco.gravadas[0].map.walls.map((w) => w.id)).toEqual(['w1'])
    expect(disco.gravadas[0].mapPath).toBe(CAMINHO)
    expect(disco.gravadas[0].savedAtMs).toBe(AGORA)
  })

  it('o intervalo cabe na promessa da régua: no máximo 30 s depois da edição', () => {
    // Piso: zero seria gravar a cada traço do arrasto, não "de tempos em tempos".
    expect(RECOVERY_INTERVAL_MS).toBeGreaterThanOrEqual(1_000)
    expect(RECOVERY_INTERVAL_MS).toBeLessThanOrEqual(30_000)
  })

  it('edições seguidas entram na cópia seguinte, não se perdem', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    useMapStore.getState().addWall(outraParede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    await a.idle()

    expect(disco.gravadas).toHaveLength(2)
    expect(disco.gravadas[1].map.walls.map((w) => w.id)).toEqual(['w1', 'w2'])
  })

  it('sem edição nada é gravado', async () => {
    const disco = discoFalso()
    const a = ligar(disco)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS * 3)
    await a.idle()
    expect(disco.write).not.toHaveBeenCalled()
    expect(disco.clear).not.toHaveBeenCalled()
  })

  it('Salvar depois da cópia apaga a cópia (reabrir não oferece nada)', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    useSessionStore.getState().markSaved()
    await a.idle()

    expect(disco.ops).toEqual(['write', 'clear'])
  })

  it('Salvar antes do intervalo não grava cópia nenhuma', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS / 2)
    useSessionStore.getState().markSaved()
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS * 2)
    await a.idle()

    expect(disco.write).not.toHaveBeenCalled()
  })

  it('desfazer até a versão salva apaga a cópia: não há mais trabalho perdido', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    useMapStore.getState().undo()
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    await a.idle()

    expect(useSessionStore.getState().isDirty).toBe(false)
    expect(disco.ops).toEqual(['write', 'clear'])
  })

  it('abrir outro mapa não apaga a cópia deixada por uma sessão anterior', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().loadMap(mapFactory.createEmptyMap('map_outro', 'Outro', 10, 10, 64))
    useSessionStore.getState().markSaved()
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    await a.idle()

    expect(disco.clear).not.toHaveBeenCalled()
  })

  it('cópia recuperada passa a ser desta sessão: Salvar logo depois a apaga', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    a.adoptExistingCopy()
    useMapStore.getState().addWall(parede)
    useSessionStore.getState().markSaved()
    await a.idle()

    expect(disco.clear).toHaveBeenCalledTimes(1)
  })

  it('aventura: trocar de cena não apaga a cópia, e a cena de fundo com mudança entra nela', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    const torre = useAdventureStore.getState().createScene('Torre', CAMINHO)
    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    const raiz = useAdventureStore.getState().adventure?.startSceneId
    expect(raiz).toBeDefined()
    if (raiz !== undefined) useAdventureStore.getState().switchScene(raiz)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    await a.idle()

    expect(disco.clear).not.toHaveBeenCalled()
    const ultima = disco.gravadas[disco.gravadas.length - 1]
    expect(ultima.scenes[torre]?.walls.map((w) => w.id)).toEqual(['w1'])
    // Aventura nunca gravada: não há arquivo de cena para reabrir.
    expect(ultima.mapPath).toBeNull()
  })

  it('falha de disco avisa uma vez só, não a cada intervalo', async () => {
    const disco = discoFalso()
    disco.write.mockRejectedValue(new Error('disco cheio'))
    const onError = vi.fn()
    const a = ligar(disco, { onError })

    useMapStore.getState().addWall(parede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    useMapStore.getState().addWall(outraParede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS)
    await a.idle()

    expect(disco.write).toHaveBeenCalledTimes(2)
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('stop cancela a cópia pendente e para de ouvir', async () => {
    const disco = discoFalso()
    const a = ligar(disco)

    useMapStore.getState().addWall(parede)
    a.stop()
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS * 2)
    useMapStore.getState().addWall(outraParede)
    await vi.advanceTimersByTimeAsync(RECOVERY_INTERVAL_MS * 2)
    await a.idle()

    expect(disco.write).not.toHaveBeenCalled()
  })
})

describe('Recuperar: devolve o trabalho ao editor', () => {
  const salvo = () => mapFactory.createEmptyMap('map_teste', 'Masmorra', 10, 10, 64)
  const recuperado = () => ({ ...salvo(), walls: [parede] })
  const solto = (path: string): OpenedMapFile => ({
    path,
    map: salvo(),
    adventure: null,
    adventureDir: null,
    activeSceneId: null,
    scenes: [],
    changedSceneIds: [],
    adventureChanged: false,
  })

  it('mapa salvo: reabre o arquivo e põe por cima o trabalho, como NÃO salvo', async () => {
    const abrir = vi.fn(async (path: string) => solto(path))
    const origem = await restoreRecoveryCopy({ savedAtMs: AGORA, mapPath: CAMINHO, map: recuperado(), scenes: {} }, abrir)

    expect(abrir).toHaveBeenCalledWith(CAMINHO)
    expect(origem).toBe(CAMINHO)
    expect(useMapStore.getState().map.walls.map((w) => w.id)).toEqual(['w1'])
    expect(useSessionStore.getState().isDirty).toBe(true)
  })

  it('mapa nunca salvo (sem origem, sem cenas): volta como mapa novo, sem abrir arquivo', async () => {
    useAdventureStore.getState().createScene('Sobra de antes', null)
    const abrir = vi.fn(async (path: string) => solto(path))
    const origem = await restoreRecoveryCopy({ savedAtMs: AGORA, mapPath: null, map: recuperado(), scenes: {} }, abrir)

    expect(abrir).not.toHaveBeenCalled()
    expect(origem).toBeNull()
    expect(useAdventureStore.getState().adventure).toBeNull()
    expect(useMapStore.getState().map.walls.map((w) => w.id)).toEqual(['w1'])
    expect(useSessionStore.getState().isDirty).toBe(true)
  })

  it('arquivo de origem sumiu: o trabalho volta mesmo assim, como mapa novo', async () => {
    const abrir = vi.fn(async (path: string): Promise<OpenedMapFile> => {
      throw new Error(`arquivo não existe: ${path}`)
    })
    const origem = await restoreRecoveryCopy({ savedAtMs: AGORA, mapPath: CAMINHO, map: recuperado(), scenes: {} }, abrir)

    expect(origem).toBeNull()
    expect(useMapStore.getState().map.walls.map((w) => w.id)).toEqual(['w1'])
  })

  it('aventura: a cena de fundo com mudança volta pendente de gravação', async () => {
    const cenaA = { id: 's1', name: 'Entrada', file: 'map.json' }
    const cenaB = { id: 's2', name: 'Torre', file: 'scenes/s2/map.json' }
    const mapaB = mapFactory.createEmptyMap('map_b', 'Torre', 10, 10, 64)
    const aventura: OpenedMapFile = {
      path: 'C:/adv/map.json',
      map: salvo(),
      adventure: { version: ADVENTURE_VERSION, id: 'adv_1', name: 'Aventura', startSceneId: 's1', scenes: [cenaA, cenaB] },
      adventureDir: 'C:/adv',
      activeSceneId: 's1',
      scenes: [
        { entry: cenaA, status: 'ok', map: salvo() },
        { entry: cenaB, status: 'ok', map: mapaB },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    }
    const origem = await restoreRecoveryCopy(
      { savedAtMs: AGORA, mapPath: 'C:/adv/map.json', map: recuperado(), scenes: { s2: { ...mapaB, walls: [outraParede] } } },
      async () => aventura,
    )

    expect(origem).toBe('C:/adv/map.json')
    const fundo = useAdventureStore.getState().cache.s2
    expect(fundo?.status === 'ok' ? fundo.map.walls.map((w) => w.id) : null).toEqual(['w2'])
    expect(useAdventureStore.getState().hasPendingScenes()).toBe(true)
    expect(useMapStore.getState().map.walls.map((w) => w.id)).toEqual(['w1'])
  })
})
