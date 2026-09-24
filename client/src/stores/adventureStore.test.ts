/**
 * `stores/adventureStore.ts` — várias cenas no editor do mestre.
 *
 * O que se cobra aqui e a jornada não mede: cada cena tem o PRÓPRIO desfazer,
 * mudança numa cena de fundo não entra no desfazer da cena aberta, cena
 * indisponível não abre, e gravar escreve a pasta da aventura inteira.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'

const arquivos = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async (path: string, data: string) => {
    arquivos.set(path, data)
  }),
  rename: vi.fn(async (from: string, to: string) => {
    const conteudo = arquivos.get(from)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${from}`)
    arquivos.set(to, conteudo)
    arquivos.delete(from)
  }),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async (path: string) => arquivos.has(path)),
  readTextFile: vi.fn(async (path: string) => {
    const conteudo = arquivos.get(path)
    if (conteudo === undefined) throw new Error(`arquivo não existe: ${path}`)
    return conteudo
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

const { useAdventureStore, sceneList, hasUnsavedWork, pinTravelOf, unlinkedTravelPinIds, subscribeToTravelLinks } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore, subscribeToDirtyFlag } = await import('./sessionStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { parseAdventure } = await import('../lib/adventure')
const { deserializeMap } = await import('../lib/mapFile')

subscribeToDirtyFlag()
// O guardião da mão dupla do pino de viagem, ligado como o App liga.
subscribeToTravelLinks()

function token(id: string): Token {
  return { id, characterId: null, name: id, x: 64, y: 64, size: 1, image: null }
}

function abrirMapaSolto(map: MapData): void {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(map)
  useSessionStore.getState().markSaved()
}

beforeEach(() => {
  arquivos.clear()
  abrirMapaSolto(createEmptyMap('map_raiz', 'Vale', 30, 20, 64))
})

describe('mapa solto', () => {
  it('a lista mostra só ele, sem aventura e sem nada pendente', () => {
    const state = useAdventureStore.getState()
    expect(state.adventure).toBeNull()
    expect(sceneList(state, useMapStore.getState().map)).toEqual([
      { id: '', name: 'Vale', tokenCount: 0, available: true, active: true, renamable: false },
    ])
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('createScene + switchScene', () => {
  it('a aventura nasce com duas cenas e a nova abre vazia', () => {
    useMapStore.getState().addToken(token('grog'))
    const id = useAdventureStore.getState().createScene('  Cripta  ', null)

    const state = useAdventureStore.getState()
    expect(state.adventure?.scenes.map((c) => c.name)).toEqual(['Vale', 'Cripta'])
    expect(state.activeSceneId).toBe(id)
    expect(useMapStore.getState().map.name).toBe('Cripta')
    expect(useMapStore.getState().map.tokens).toEqual([])
    expect(useMapStore.getState().past).toEqual([])
    expect(sceneList(state, useMapStore.getState().map).map((c) => [c.name, c.tokenCount, c.active])).toEqual([
      ['Vale', 1, false],
      ['Cripta', 0, true],
    ])
    expect(hasUnsavedWork()).toBe(true)
  })

  it('cada cena guarda o próprio desfazer: trocar e voltar devolve o histórico de cada uma', () => {
    useMapStore.getState().addToken(token('grog'))
    const raiz = useAdventureStore.getState().adventure
    expect(raiz).toBeNull()
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useMapStore.getState().addToken(token('esqueleto'))
    useMapStore.getState().addToken(token('zumbi'))

    expect(useAdventureStore.getState().switchScene(vale)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['grog'])
    expect(useMapStore.getState().past).toHaveLength(1)
    expect(useAdventureStore.getState().previousSceneId).toBe(cripta)

    // Desfazer no Vale desfaz o Grog, e não um token da Cripta.
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens).toEqual([])

    expect(useAdventureStore.getState().switchScene(cripta)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['esqueleto', 'zumbi'])
    expect(useMapStore.getState().past).toHaveLength(2)
    useMapStore.getState().undo()
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['esqueleto'])
  })

  it('trocar para a própria cena não faz nada', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    expect(useAdventureStore.getState().switchScene(cripta)).toBe(false)
  })
})

describe('câmera por cena', () => {
  it('a cena que sai guarda a câmera; voltar a ela pede essa câmera; cena nunca vista pede enquadrar', () => {
    useMapStore.getState().setCamera({ x: -300, y: -120, scale: 3.75 })
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''

    // Cripta é nova: nenhuma câmera guardada, o canvas enquadra.
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null })
    const slotVale = useAdventureStore.getState().cache[vale]
    expect(slotVale.status === 'ok' ? slotVale.camera : 'indisponível').toEqual({ x: -300, y: -120, scale: 3.75 })

    useMapStore.getState().setCamera({ x: 10, y: 20, scale: 0.5 })
    useAdventureStore.getState().switchScene(vale)
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: { x: -300, y: -120, scale: 3.75 } })

    useAdventureStore.getState().switchScene(cripta)
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: { x: 10, y: 20, scale: 0.5 } })
  })

  it('"Ir até lá" na cena aberta leva o ponto e a caixa do objeto: o canvas afasta se ela não couber', () => {
    const caixa = { minX: 1500, minY: 200, maxX: 1850, maxY: 600 }
    expect(useAdventureStore.getState().goToPoint(null, { x: 1675, y: 400 }, caixa)).toBe(true)
    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null, focus: { x: 1675, y: 400 }, fit: caixa })
    // Sem caixa, o "Ir lá" de sempre: só o ponto, no zoom de agora.
    useAdventureStore.getState().goToPoint(null, { x: 10, y: 20 })
    expect(useAdventureStore.getState().cameraRequest).toStrictEqual({ camera: null, focus: { x: 10, y: 20 } })
  })

  it('cena aberta do disco (depois de reiniciar) não herda câmera: pede enquadrar', () => {
    const vale = createEmptyMap('map_vale', 'Vale', 30, 20, 64)
    const cripta = createEmptyMap('map_cripta', 'Cripta', 30, 20, 64)
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/map_vale/map.json',
      map: vale,
      adventure: {
        version: 1,
        id: 'adv',
        name: 'Vale',
        startSceneId: 's_vale',
        scenes: [
          { id: 's_vale', name: 'Vale', file: 'map.json' },
          { id: 's_cripta', name: 'Cripta', file: 'scenes/s_cripta/map.json' },
        ],
      },
      adventureDir: 'C:/appdata/maps/map_vale',
      activeSceneId: 's_vale',
      scenes: [
        { entry: { id: 's_vale', name: 'Vale', file: 'map.json' }, status: 'ok', map: vale },
        { entry: { id: 's_cripta', name: 'Cripta', file: 'scenes/s_cripta/map.json' }, status: 'ok', map: cripta },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    })
    expect(useAdventureStore.getState().cameraRequest).toBeNull()
    useMapStore.getState().setCamera({ x: -900, y: -400, scale: 3.75 })

    useAdventureStore.getState().switchScene('s_cripta')

    expect(useAdventureStore.getState().cameraRequest).toEqual({ camera: null })
  })
})

describe('updateBackgroundScene', () => {
  it('muda a cena de fundo sem tocar no desfazer nem no mapa da cena aberta', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useMapStore.getState().addToken(token('esqueleto'))
    const mapaAberto = useMapStore.getState().map
    const pastAntes = useMapStore.getState().past

    useAdventureStore.getState().updateBackgroundScene(vale, (map) => ({ ...map, tokens: [...map.tokens, token('viajante')] }))

    expect(useMapStore.getState().map).toBe(mapaAberto)
    expect(useMapStore.getState().past).toBe(pastAntes)
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
    // A cena de fundo tem o token, e o desfazer dela não o conhece.
    expect(useAdventureStore.getState().switchScene(vale)).toBe(true)
    expect(useMapStore.getState().map.tokens.map((t) => t.id)).toEqual(['viajante'])
    expect(useMapStore.getState().past).toEqual([])
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
    expect(useAdventureStore.getState().previousSceneId).toBe(cripta)
  })
})

describe('cena indisponível', () => {
  it('aparece na lista como indisponível e não abre', () => {
    const vale = createEmptyMap('map_vale', 'Vale', 30, 20, 64)
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/map_vale/map.json',
      map: vale,
      adventure: {
        version: 1,
        id: 'adv',
        name: 'Vale',
        startSceneId: 's_vale',
        scenes: [
          { id: 's_vale', name: 'Vale', file: 'map.json' },
          { id: 's_sumiu', name: 'Cripta', file: 'scenes/s_sumiu/map.json' },
        ],
      },
      adventureDir: 'C:/appdata/maps/map_vale',
      activeSceneId: 's_vale',
      scenes: [
        { entry: { id: 's_vale', name: 'Vale', file: 'map.json' }, status: 'ok', map: vale },
        { entry: { id: 's_sumiu', name: 'Cripta', file: 'scenes/s_sumiu/map.json' }, status: 'indisponivel', reason: 'arquivo não encontrado' },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    })

    const lista = sceneList(useAdventureStore.getState(), useMapStore.getState().map)
    expect(lista.map((c) => [c.name, c.available, c.tokenCount])).toEqual([
      ['Vale', true, 0],
      ['Cripta', false, null],
    ])
    expect(useAdventureStore.getState().switchScene('s_sumiu')).toBe(false)
    expect(useMapStore.getState().map.id).toBe('map_vale')
    expect(hasUnsavedWork()).toBe(false)
  })
})

describe('flush', () => {
  it('mapa nunca salvo: grava a pasta da aventura em maps/<id>, as duas cenas e o adventure.json', async () => {
    useMapStore.getState().addToken(token('grog'))
    useAdventureStore.getState().createScene('Cripta', null)
    useMapStore.getState().addToken(token('esqueleto'))

    const caminho = await useAdventureStore.getState().flush()

    const aventura = parseAdventure(arquivos.get('C:/appdata/maps/map_raiz/adventure.json') ?? '')
    const cripta = aventura.scenes[1]
    expect(caminho).toBe(`C:/appdata/maps/map_raiz/scenes/${cripta.id}/map.json`)
    expect(aventura.scenes.map((c) => [c.name, c.file])).toEqual([
      ['Vale', 'map.json'],
      ['Cripta', `scenes/${cripta.id}/map.json`],
    ])
    expect(deserializeMap(arquivos.get('C:/appdata/maps/map_raiz/map.json') ?? '').tokens.map((t) => t.id)).toEqual(['grog'])
    expect(deserializeMap(arquivos.get(caminho) ?? '').tokens.map((t) => t.id)).toEqual(['esqueleto'])
    expect(hasUnsavedWork()).toBe(false)
  })

  it('mapa solto já salvo: a pasta é a do arquivo dele e a primeira cena é o próprio arquivo', async () => {
    useAdventureStore.getState().createScene('Cripta', 'C:/mesa/torre/torre.json')

    await useAdventureStore.getState().flush()

    const aventura = parseAdventure(arquivos.get('C:/mesa/torre/adventure.json') ?? '')
    expect(aventura.scenes[0].file).toBe('torre.json')
    expect(arquivos.has(`C:/mesa/torre/${aventura.scenes[1].file}`)).toBe(true)
  })

  it('renomear a cena grava o nome novo e vazio vira "Cena sem nome"', async () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    useAdventureStore.getState().renameScene(cripta, '   ')
    await useAdventureStore.getState().flush()
    const aventura = parseAdventure(arquivos.get('C:/appdata/maps/map_raiz/adventure.json') ?? '')
    expect(aventura.scenes[1].name).toBe('Cena sem nome')
  })
})

describe('pino de viagem', () => {
  function viagem(id: string, extra: Partial<Pin> = {}): Pin {
    return { id, x: 200, y: 200, kind: 'viagem', description: '', image: null, ...extra }
  }

  /** Vale (mapa solto que vira aventura) com o pino de viagem "a", e a Cripta criada vazia. Termina no Vale. */
  function montar(): { vale: string; cripta: string } {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(vale)
    useMapStore.getState().addPin(viagem('a', { description: 'Escada que desce' }))
    return { vale, cripta }
  }

  function pinoDoFundo(sceneId: string, pinId: string): Pin | undefined {
    const slot = useAdventureStore.getState().cache[sceneId]
    return slot?.status === 'ok' ? slot.map.pins.find((p) => p.id === pinId) : undefined
  }

  function pinoAberto(pinId: string): Pin {
    const pin = useMapStore.getState().map.pins.find((p) => p.id === pinId)
    if (pin === undefined) throw new Error(`pino ${pinId} não está na cena aberta`)
    return pin
  }

  it('ligar em mão dupla: a chegada nasce no centro da Cripta, já ligada de volta, e o painel de cada lado diz para onde leva', () => {
    const { vale, cripta } = montar()

    const chegada = useAdventureStore.getState().linkPinToNewArrival('a', cripta)
    if (chegada === null) throw new Error('não ligou')

    // A ida, na cena aberta.
    expect(pinoAberto('a').destino).toEqual({ sceneId: cripta, pinId: chegada })
    // A volta, na cena de fundo — gravada sem abrir a Cripta.
    expect(pinoDoFundo(cripta, chegada)).toMatchObject({ kind: 'viagem', x: 960, y: 640, destino: { sceneId: vale, pinId: 'a' } })
    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    expect(pinTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto('a'))).toMatchObject({
      status: 'ligado',
      sceneName: 'Cripta',
      partner: { id: chegada },
    })

    useAdventureStore.getState().switchScene(cripta)
    expect(pinTravelOf(useAdventureStore.getState(), useMapStore.getState().map, pinoAberto(chegada))).toMatchObject({
      status: 'ligado',
      sceneName: 'Vale',
      partner: { id: 'a', description: 'Escada que desce' },
    })
  })

  it('ligar a um pino de viagem que já está na outra cena grava a volta nele', () => {
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    useMapStore.getState().addPin(viagem('b', { description: 'Portão' }))
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(vale)
    useMapStore.getState().addPin(viagem('a'))

    expect(useAdventureStore.getState().linkPinToExisting('a', cripta, 'b')).toBe(true)

    expect(pinoAberto('a').destino).toEqual({ sceneId: cripta, pinId: 'b' })
    expect(pinoDoFundo(cripta, 'b')?.destino).toEqual({ sceneId: vale, pinId: 'a' })
    expect(unlinkedTravelPinIds(useAdventureStore.getState(), useMapStore.getState().map).size).toBe(0)
  })

  it('apagar o pino de chegada desliga o par que está na cena de FUNDO, fora do desfazer da cena aberta; Ctrl+Z religa', () => {
    const { vale, cripta } = montar()
    const chegada = useAdventureStore.getState().linkPinToNewArrival('a', cripta) ?? ''
    useAdventureStore.getState().switchScene(cripta)
    const passosAntes = useMapStore.getState().past.length

    useMapStore.getState().removePin(chegada)

    // O pino do Vale, que está no cache, perdeu o destino...
    expect(pinoDoFundo(vale, 'a')?.destino).toBeNull()
    expect(useAdventureStore.getState().dirty[vale]).toBe(true)
    // ... e o desfazer da Cripta só conhece a remoção dela.
    expect(useMapStore.getState().past.length).toBe(passosAntes + 1)

    // No Vale o painel diz "sem destino" e o pino é desenhado apagado.
    useAdventureStore.getState().switchScene(vale)
    const mapaDoVale = useMapStore.getState().map
    expect(pinTravelOf(useAdventureStore.getState(), mapaDoVale, pinoAberto('a')).status).toBe('sem-destino')
    expect(unlinkedTravelPinIds(useAdventureStore.getState(), mapaDoVale).has('a')).toBe(true)

    // Voltar à Cripta e desfazer a remoção devolve a chegada E a ligação.
    useAdventureStore.getState().switchScene(cripta)
    useMapStore.getState().undo()
    expect(pinoAberto(chegada).destino).toEqual({ sceneId: vale, pinId: 'a' })
    expect(pinoDoFundo(vale, 'a')?.destino).toEqual({ sceneId: cripta, pinId: chegada })
  })

  it('deixar de ser pino de viagem desliga o par', () => {
    const { cripta } = montar()
    const chegada = useAdventureStore.getState().linkPinToNewArrival('a', cripta) ?? ''
    expect(pinoDoFundo(cripta, chegada)?.destino).not.toBeNull()

    useMapStore.getState().updatePin('a', { kind: 'interrogacao', destino: null })

    expect(pinoDoFundo(cripta, chegada)?.destino).toBeNull()
  })

  it('trocar de cena não mexe em ligação nenhuma — nem com a meia ligação que a cena que entra traz', () => {
    // O pior caso para quem confunde "cena entrando" com "pino ligado agora":
    // Vale e Cripta com o MESMO id de mapa (arquivo copiado à mão) e, na
    // Cripta, um pino que aponta para o par do Vale sem ser apontado de volta.
    // Abrir a Cripta não pode roubar o par da Torre nem desligar o pino do Vale.
    const mapaVale: MapData = { ...createEmptyMap('map_copiado', 'Vale', 30, 20, 64), pins: [viagem('x', { destino: { sceneId: 's_torre', pinId: 't' } })] }
    const mapaCripta: MapData = { ...createEmptyMap('map_copiado', 'Cripta', 30, 20, 64), pins: [viagem('b', { destino: { sceneId: 's_torre', pinId: 't' } })] }
    const mapaTorre: MapData = { ...createEmptyMap('map_torre', 'Torre', 30, 20, 64), pins: [viagem('t', { destino: { sceneId: 's_vale', pinId: 'x' } })] }
    const cena = (id: string, name: string, file: string) => ({ id, name, file })
    const vale = cena('s_vale', 'Vale', 'map.json')
    const cripta = cena('s_cripta', 'Cripta', 'scenes/s_cripta/map.json')
    const torre = cena('s_torre', 'Torre', 'scenes/s_torre/map.json')
    useAdventureStore.getState().open({
      path: 'C:/appdata/maps/vale/map.json',
      map: mapaVale,
      adventure: { version: 1, id: 'adv', name: 'Vale', startSceneId: 's_vale', scenes: [vale, cripta, torre] },
      adventureDir: 'C:/appdata/maps/vale',
      activeSceneId: 's_vale',
      scenes: [
        { entry: vale, status: 'ok', map: mapaVale },
        { entry: cripta, status: 'ok', map: mapaCripta },
        { entry: torre, status: 'ok', map: mapaTorre },
      ],
      changedSceneIds: [],
      adventureChanged: false,
    })

    useAdventureStore.getState().switchScene('s_cripta')
    useAdventureStore.getState().switchScene('s_vale')

    expect(pinoAberto('x').destino).toEqual({ sceneId: 's_torre', pinId: 't' })
    expect(pinoDoFundo('s_torre', 't')?.destino).toEqual({ sceneId: 's_vale', pinId: 'x' })
    expect(pinoDoFundo('s_cripta', 'b')?.destino).toEqual({ sceneId: 's_torre', pinId: 't' })
    expect(hasUnsavedWork()).toBe(false)
  })

  it('atravessar: a visão do mestre vai para a cena de destino, com o par no centro e aberto no painel', () => {
    const { vale, cripta } = montar()
    const chegada = useAdventureStore.getState().linkPinToNewArrival('a', cripta) ?? ''

    expect(useAdventureStore.getState().travelThroughPin('a')).toBe(true)

    expect(useAdventureStore.getState().activeSceneId).toBe(cripta)
    expect(useMapStore.getState().selectedPinId).toBe(chegada)
    // O pino de chegada nasce em (960, 640); a câmera centraliza o meio do desenho dele.
    expect(useAdventureStore.getState().cameraRequest?.focus).toEqual({ x: 960, y: 640 - 17 })
    // E o par leva de volta.
    expect(useAdventureStore.getState().travelThroughPin(chegada)).toBe(true)
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
  })

  it('pino de viagem sem par não atravessa: a cena não muda', () => {
    const { vale } = montar()
    expect(useAdventureStore.getState().travelThroughPin('a')).toBe(false)
    expect(useAdventureStore.getState().activeSceneId).toBe(vale)
  })
})

describe('transferToken (o jogador atravessou o pino de viagem)', () => {
  function tokensDoFundo(sceneId: string): string[] {
    const slot = useAdventureStore.getState().cache[sceneId]
    return slot?.status === 'ok' ? slot.map.tokens.map((t) => t.id) : []
  }

  function tokensAbertos(): string[] {
    return useMapStore.getState().map.tokens.map((t) => t.id)
  }

  /** Vale com o Grog e o desfazer cheio (criou, andou), a Cripta vazia de fundo. Termina no Vale. */
  function montar(): { vale: string; cripta: string } {
    useMapStore.getState().addToken(token('grog'))
    useMapStore.getState().setTokenPosition('grog', 128, 64)
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
    useAdventureStore.getState().switchScene(vale)
    return { vale, cripta }
  }

  it('o token sai da cena aberta e entra na de fundo, no ponto de chegada, e a Cripta fica pendente de gravação', () => {
    const { cripta } = montar()
    expect(useAdventureStore.getState().transferToken('grog', useAdventureStore.getState().activeSceneId ?? '', cripta, 900, 700)).toBe(true)
    expect(tokensAbertos()).toEqual([])
    const slot = useAdventureStore.getState().cache[cripta]
    expect(slot?.status === 'ok' ? slot.map.tokens.map((t) => [t.id, t.x, t.y]) : null).toEqual([['grog', 900, 700]])
    expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
  })

  it('Ctrl+Z e Ctrl+Y depois da travessia NÃO duplicam o token: ele continua só na Cripta', () => {
    const { vale, cripta } = montar()
    expect(useMapStore.getState().past.length).toBeGreaterThan(0)
    useAdventureStore.getState().transferToken('grog', vale, cripta, 900, 700)

    // Desfazer tudo o que o Vale tem no histórico: o Grog não volta.
    while (useMapStore.getState().past.length > 0) {
      useMapStore.getState().undo()
      expect(tokensAbertos()).toEqual([])
    }
    while (useMapStore.getState().future.length > 0) {
      useMapStore.getState().redo()
      expect(tokensAbertos()).toEqual([])
    }
    expect(tokensDoFundo(cripta)).toEqual(['grog'])

    // Na Cripta, o desfazer dela também não o perde.
    useAdventureStore.getState().switchScene(cripta)
    useMapStore.getState().addToken(token('esqueleto'))
    useMapStore.getState().undo()
    useMapStore.getState().undo()
    expect(tokensAbertos()).toEqual(['grog'])
  })

  it('a travessia de uma cena de FUNDO para a aberta também sai do desfazer das duas', () => {
    const { vale, cripta } = montar()
    useAdventureStore.getState().switchScene(cripta)
    // O editor está na Cripta; o Grog, no Vale (de fundo), atravessa para cá.
    expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 300, 300)).toBe(true)
    expect(tokensAbertos()).toEqual(['grog'])
    expect(tokensDoFundo(vale)).toEqual([])
    useMapStore.getState().undo()
    expect(tokensAbertos()).toEqual(['grog'])
    useAdventureStore.getState().switchScene(vale)
    while (useMapStore.getState().past.length > 0) useMapStore.getState().undo()
    expect(tokensAbertos()).toEqual([])
  })

  it('PISOS: chega no piso pedido; sem piso, no térreo — o piso da cena de partida não atravessa', () => {
    const { vale, cripta } = montar()
    useMapStore.getState().setTokenPiso('grog', 3)
    expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 900, 700, 2)).toBe(true)
    const noFundo = (): Token | undefined => {
      const slot = useAdventureStore.getState().cache[cripta]
      return slot?.status === 'ok' ? slot.map.tokens.find((t) => t.id === 'grog') : undefined
    }
    expect(noFundo()?.piso).toBe(2)
    useAdventureStore.getState().switchScene(cripta)
    expect(useAdventureStore.getState().transferToken('grog', cripta, vale, 100, 100)).toBe(true)
    const slotVale = useAdventureStore.getState().cache[vale]
    const grogNoVale = slotVale?.status === 'ok' ? slotVale.map.tokens.find((t) => t.id === 'grog') : undefined
    expect(grogNoVale?.id).toBe('grog')
    expect(grogNoVale !== undefined && 'piso' in grogNoVale).toBe(false)
  })

  it('recusa o que não dá para fazer: mesma cena, token que não está lá, cena que não existe', () => {
    const { vale, cripta } = montar()
    expect(useAdventureStore.getState().transferToken('grog', vale, vale, 0, 0)).toBe(false)
    expect(useAdventureStore.getState().transferToken('fantasma', vale, cripta, 0, 0)).toBe(false)
    expect(useAdventureStore.getState().transferToken('grog', vale, 'cena-que-nao-existe', 0, 0)).toBe(false)
    expect(tokensAbertos()).toEqual(['grog'])
  })
})
