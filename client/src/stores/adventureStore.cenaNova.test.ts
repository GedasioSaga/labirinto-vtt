/**
 * `createSceneForPin` — o "+ Cena nova…" do "Leva a…" do pino de viagem.
 *
 * A cena nasce, o pino de chegada nasce no centro dela, as pontas se ligam
 * (a volta pelo guardião da mão dupla) e o mestre CONTINUA onde estava: a
 * cena aberta não troca.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco no teste')
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

const { useAdventureStore, pinTravelOf, sceneList, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')

subscribeToDirtyFlag()
subscribeToTravelLinks()

function viagem(id: string, extra: Partial<Pin> = {}): Pin {
  return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
}

function abrirMapaSolto(map: MapData): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(map)
  useSessionStore.getState().markSaved()
}

function pinoAberto(pinId: string): Pin {
  const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
  if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
  return pin
}

function pinoDoFundo(sceneId: string, pinId: string): Pin | undefined {
  const slot = useAdventureStore.getState().cache[sceneId]
  return slot?.status === 'ok' ? slot.map.pins.find((p) => p.id === pinId) : undefined
}

/** Porto Cinza aberto (a primeira cena), o Cais atrás, e o pino de viagem "porta" em Porto Cinza. */
function montarPorto(): { porto: string; cais: string } {
  const cais = useAdventureStore.getState().createScene('Cais', null)
  const porto = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(porto)
  useAdventureStore.getState().renameScene(porto, 'Porto Cinza')
  useMapStore.getState().addPin(viagem('porta', { description: 'Porta da forja' }))
  return { porto, cais }
}

beforeEach(() => {
  abrirMapaSolto(createEmptyMap('map_raiz', 'Porto Cinza', 30, 20, 64))
})

describe('"+ Cena nova…" no "Leva a…"', () => {
  it('"Casa do ferreiro": a tela continua em Porto Cinza, o pino leva à casa, e a casa ganha o pino par no centro', () => {
    const { porto } = montarPorto()
    const mapaAberto = useMapStore.getState().map.id

    const feito = useAdventureStore.getState().createSceneForPin('porta', 'Casa do ferreiro', null)
    if (feito === null) throw new Error('não criou')

    const state = useAdventureStore.getState()
    // O mestre fica onde estava.
    expect(state.activeSceneId).toBe(porto)
    expect(useMapStore.getState().map.id).toBe(mapaAberto)
    // A lista ganha a casa.
    expect(sceneList(state, useMapStore.getState().map).map((item) => item.name)).toEqual(['Porto Cinza', 'Cais', 'Casa do ferreiro'])
    expect(state.adventure?.scenes.find((s) => s.id === feito.sceneId)?.name).toBe('Casa do ferreiro')
    // O painel do pino diz "Leva a Casa do ferreiro".
    expect(pinoAberto('porta').destino).toEqual({ sceneId: feito.sceneId, pinId: feito.arrivalId })
    expect(pinTravelOf(state, useMapStore.getState().map, pinoAberto('porta'))).toMatchObject({
      status: 'ligado',
      sceneName: 'Casa do ferreiro',
      partner: { id: feito.arrivalId },
    })
    // O par nasce no centro da casa (30×20 casas de 64 px), ligado de volta.
    expect(pinoDoFundo(feito.sceneId, feito.arrivalId)).toMatchObject({ kind: 'viagem', x: 960, y: 640, destino: { sceneId: porto, pinId: 'porta' } })
    // A casa e a lista pedem Salvar.
    expect(state.dirty[feito.sceneId]).toBe(true)
    expect(state.structureDirty).toBe(true)
  })

  it('no mapa solto a aventura nasce, e o mapa aberto continua aberto como a primeira cena', () => {
    useMapStore.getState().addPin(viagem('porta'))
    const antes = useMapStore.getState().map.id

    const feito = useAdventureStore.getState().createSceneForPin('porta', 'Casa do ferreiro', 'C:/mapas/porto.json')
    if (feito === null) throw new Error('não criou')

    const state = useAdventureStore.getState()
    expect(state.adventure?.scenes.map((s) => s.name)).toEqual(['Porto Cinza', 'Casa do ferreiro'])
    expect(state.activeSceneId).toBe(state.adventure?.scenes[0].id)
    expect(state.rootPath).toBe('C:/mapas/porto.json')
    expect(useMapStore.getState().map.id).toBe(antes)
    expect(pinoAberto('porta').destino?.sceneId).toBe(feito.sceneId)
  })

  it('a cena nova entra na mesma pasta da cena aberta', () => {
    const { porto, cais } = montarPorto()
    expect(useAdventureStore.getState().moveScene(porto, cais)).toBe(true)

    const feito = useAdventureStore.getState().createSceneForPin('porta', 'Casa do ferreiro', null)
    if (feito === null) throw new Error('não criou')

    expect(useAdventureStore.getState().adventure?.scenes.find((s) => s.id === feito.sceneId)?.parentId).toBe(cais)
  })

  it('"+ Outra saída" (null) liga uma saída NOVA e deixa a principal como estava', () => {
    const { cais } = montarPorto()
    const chegadaCais = useAdventureStore.getState().linkPinToNewArrival('porta', cais)
    if (chegadaCais === null) throw new Error('não ligou ao Cais')

    const feito = useAdventureStore.getState().createSceneForPin('porta', 'Casa do ferreiro', null, null)
    if (feito === null) throw new Error('não criou')

    const pin = pinoAberto('porta')
    expect(pin.destino).toEqual({ sceneId: cais, pinId: chegadaCais })
    expect(pin.saidas?.map((saida) => saida.destino)).toEqual([{ sceneId: feito.sceneId, pinId: feito.arrivalId }])
  })

  it('pino que sumiu ou que não é de viagem não cria cena nenhuma', () => {
    montarPorto()
    const cenasAntes = useAdventureStore.getState().adventure?.scenes.length

    expect(useAdventureStore.getState().createSceneForPin('nao-existe', 'Casa', null)).toBeNull()
    useMapStore.getState().addPin({ ...viagem('aviso'), kind: 'exclamacao' })
    expect(useAdventureStore.getState().createSceneForPin('aviso', 'Casa', null)).toBeNull()
    expect(useAdventureStore.getState().adventure?.scenes.length).toBe(cenasAntes)
  })
})
