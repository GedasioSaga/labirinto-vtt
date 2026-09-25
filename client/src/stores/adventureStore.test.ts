/**
 * `stores/adventureStore.ts` — várias cenas no editor do mestre.
 *
 * O que se cobra aqui e a jornada não mede: cada cena tem o PRÓPRIO desfazer,
 * mudança numa cena de fundo não entra no desfazer da cena aberta, cena
 * indisponível não abre, e gravar escreve a pasta da aventura inteira.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import type { HostMessage } from '../net/protocol'

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
const { useInitiativeStore } = await import('./initiativeStore')
const { createHostSession } = await import('../net/hostSession')
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

  it('ficha guardada ("Guardar ficha") sai do editor mas não do arquivo: cada uma na cena de onde saiu', async () => {
    useMapStore.getState().addToken(token('escudo'))
    const cripta = useAdventureStore.getState().createScene('Cripta', null)
    const vale = useAdventureStore.getState().adventure?.scenes[0]?.id
    if (vale === undefined) throw new Error('a aventura deveria ter nascido com o Vale')
    useMapStore.getState().addToken(token('machado'))
    const slotVale = useAdventureStore.getState().cache[vale]
    const guardadoVale = slotVale?.status === 'ok' ? slotVale.map.tokens.find((t) => t.id === 'escudo') : undefined
    const guardadoCripta = useMapStore.getState().map.tokens.find((t) => t.id === 'machado')
    if (guardadoVale === undefined || guardadoCripta === undefined) throw new Error('as duas fichas deveriam estar no mapa')
    // O mestre guarda as duas: saem do mapa (a do Vale, cena de fundo; a da Cripta, a aberta).
    useAdventureStore.getState().updateBackgroundScene(vale, (m) => ({ ...m, tokens: m.tokens.filter((t) => t.id !== 'escudo') }))
    useMapStore.getState().removeToken('machado')
    const aberto = useMapStore.getState().map

    const caminho = await useAdventureStore.getState().flush([
      { token: guardadoVale, sceneId: vale },
      { token: guardadoCripta, sceneId: cripta },
    ])

    expect(deserializeMap(arquivos.get('C:/appdata/maps/map_raiz/map.json') ?? '').tokens.map((t) => t.id)).toEqual(['escudo'])
    expect(deserializeMap(arquivos.get(caminho) ?? '').tokens.map((t) => t.id)).toEqual(['machado'])
    // O editor continua sem elas, e nada fica pendente: fechar a janela agora não perde ficha nenhuma.
    expect(useMapStore.getState().map).toBe(aberto)
    expect(useMapStore.getState().map.tokens).toEqual([])
    expect(hasUnsavedWork()).toBe(false)
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

  it('recusa o que não dá para fazer: mesma cena, token que não está lá, cena que não existe', () => {
    const { vale, cripta } = montar()
    expect(useAdventureStore.getState().transferToken('grog', vale, vale, 0, 0)).toBe(false)
    expect(useAdventureStore.getState().transferToken('fantasma', vale, cripta, 0, 0)).toBe(false)
    expect(useAdventureStore.getState().transferToken('grog', vale, 'cena-que-nao-existe', 0, 0)).toBe(false)
    expect(tokensAbertos()).toEqual(['grog'])
  })

  /*
   * FICHA COM ID REPETIDO: duas cenas podem ter uma ficha de mesmo id (cena
   * copiada, mapa importado duas vezes). Quem chega não apaga nem rouba nada
   * de quem já estava: a de destino ganha id novo, e tudo que era guardado
   * pelo id dela (tocha presa, quem ela leva, seleção, valor de iniciativa e
   * a vez) vai junto. A que viaja guarda o id — é por ele que a sessão sabe
   * de qual jogador ela é.
   */
  describe('a cena de destino já tem uma ficha com o mesmo id', () => {
    /** Vale (aberta) com o Grog; Cripta (de fundo) com OUTRA ficha de id "grog", o Grog da Cripta, e um esqueleto. */
    function montarRepetido(residente: Partial<Token> = {}): { vale: string; cripta: string } {
      useMapStore.getState().addToken(token('grog'))
      const cripta = useAdventureStore.getState().createScene('Cripta', null)
      useMapStore.getState().addToken({ ...token('grog'), name: 'Grog da Cripta', x: 320, y: 320, ...residente })
      useMapStore.getState().addToken({ ...token('esqueleto'), x: 360, y: 320 })
      const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
      useAdventureStore.getState().switchScene(vale)
      return { vale, cripta }
    }

    function mapaDe(sceneId: string): MapData | null {
      const slot = useAdventureStore.getState().cache[sceneId]
      return slot?.status === 'ok' ? slot.map : null
    }

    function residenteEm(map: MapData | null): Token | undefined {
      return map?.tokens.find((t) => t.name === 'Grog da Cripta')
    }

    beforeEach(() => {
      useInitiativeStore.getState().reset()
    })

    it('levar o Grog do Vale para a Cripta deixa DUAS fichas lá: a que chegou e a que já estava', () => {
      const { vale, cripta } = montarRepetido()
      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)

      const naCripta = mapaDe(cripta)?.tokens ?? []
      expect(naCripta).toHaveLength(3)
      expect(new Set(naCripta.map((t) => t.id)).size).toBe(3)
      // A que chegou guarda o id (é dela que o jogador é dono) e vai ao ponto de chegada.
      expect(naCripta.find((t) => t.id === 'grog')).toMatchObject({ name: 'grog', x: 400, y: 320 })
      // A que já estava continua lá, no mesmo lugar, com id novo.
      const residente = residenteEm(mapaDe(cripta))
      expect(residente).toMatchObject({ x: 320, y: 320 })
      expect(residente?.id).not.toBe('grog')
      expect(tokensAbertos()).toEqual([])
    })

    it('o desfazer da Cripta nunca perde a ficha que já estava nem a devolve ao id da que chegou', () => {
      const { vale, cripta } = montarRepetido()
      useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)
      const residente = residenteEm(mapaDe(cripta))
      expect(residente?.id).not.toBe('grog')

      useAdventureStore.getState().switchScene(cripta)
      // Desfazer o esqueleto: o Grog da Cripta continua, com o mesmo id novo, e o que chegou também.
      useMapStore.getState().undo()
      const ids = tokensAbertos()
      expect(ids).toHaveLength(2)
      expect(ids).toContain('grog')
      expect(ids).toContain(residente?.id)
    })

    it('a tocha presa e a ficha levada pelo Grog da Cripta continuam com ele, e não passam para o que chegou', () => {
      useMapStore.getState().addToken(token('grog'))
      const cripta = useAdventureStore.getState().createScene('Cripta', null)
      useMapStore.getState().addToken({ ...token('grog'), name: 'Grog da Cripta' })
      useMapStore.getState().addToken({ ...token('cao'), levadoPor: 'grog' })
      useMapStore.getState().addLight({ id: 'tocha', x: 64, y: 64, radius: 200, color: '#ffaa00', intensity: 1, attachedTokenId: 'grog' })
      const vale = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
      useAdventureStore.getState().switchScene(vale)

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 900, 700)).toBe(true)
      const map = mapaDe(cripta)
      const residente = residenteEm(map)
      expect(residente?.id).not.toBe('grog')
      expect(map?.lights.find((l) => l.id === 'tocha')?.attachedTokenId).toBe(residente?.id)
      expect(map?.tokens.find((t) => t.id === 'cao')?.levadoPor).toBe(residente?.id)
    })

    it('chegando na cena ABERTA, a seleção da ficha que já estava segue a ficha, não a que chegou', () => {
      const { vale, cripta } = montarRepetido()
      useAdventureStore.getState().switchScene(cripta)
      useMapStore.getState().setSelection([{ kind: 'token', id: 'grog' }])

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const { map, selection } = useMapStore.getState()
      expect(map.tokens).toHaveLength(3)
      const residente = residenteEm(map)
      expect(residente?.id).not.toBe('grog')
      expect(selection).toEqual([{ kind: 'token', id: residente?.id }])
      expect(mapaDe(vale)?.tokens).toEqual([])
    })

    /*
     * A iniciativa é guardada por mapa + id da ficha. O Grog da Cripta estava
     * em combate lá (valor 15, e era a vez dele): a ficha que chega com o
     * mesmo id não pode herdar nem o valor nem a vez.
     */
    it('o valor de iniciativa e a vez do Grog da Cripta continuam com ele, e não passam para o que chegou', () => {
      const { vale, cripta } = montarRepetido()
      const mapaCripta = mapaDe(cripta)?.id ?? ''
      const mapaVale = useMapStore.getState().map.id
      expect(mapaCripta).not.toBe(mapaVale)
      useInitiativeStore.getState().setValue(mapaCripta, 'grog', 15)
      useInitiativeStore.getState().setValue(mapaCripta, 'esqueleto', 9)
      useInitiativeStore.getState().setValue(mapaVale, 'grog', 4)
      useInitiativeStore.getState().setTurn({ mapId: mapaCripta, tokenId: 'grog' })

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const residente = residenteEm(mapaDe(cripta))
      expect(residente?.id).not.toBe('grog')
      const { values, turn } = useInitiativeStore.getState()
      // O que já estava leva o 15 e a vez; o que chegou entra na Cripta sem valor.
      expect(values[mapaCripta]).toEqual({ [residente?.id ?? '']: 15, esqueleto: 9 })
      expect(turn).toEqual({ mapId: mapaCripta, tokenId: residente?.id })
      // O valor do Grog no Vale é de lá e fica como estava.
      expect(values[mapaVale]).toEqual({ grog: 4 })
    })

    it('chegando na cena ABERTA com combate, o valor e a vez também ficam com quem já estava', () => {
      const { vale, cripta } = montarRepetido()
      useAdventureStore.getState().switchScene(cripta)
      const mapaCripta = useMapStore.getState().map.id
      useInitiativeStore.getState().setValue(mapaCripta, 'grog', 15)
      useInitiativeStore.getState().setTurn({ mapId: mapaCripta, tokenId: 'grog' })

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const residente = residenteEm(useMapStore.getState().map)
      expect(residente?.id).not.toBe('grog')
      const { values, turn } = useInitiativeStore.getState()
      expect(values[mapaCripta]).toEqual({ [residente?.id ?? '']: 15 })
      expect(turn).toEqual({ mapId: mapaCripta, tokenId: residente?.id })
    })

    it('sem combate do Grog da Cripta, a chegada não inventa valor nem vez para ninguém', () => {
      const { vale, cripta } = montarRepetido()
      const mapaCripta = mapaDe(cripta)?.id ?? ''
      useInitiativeStore.getState().setValue(mapaCripta, 'esqueleto', 9)
      useInitiativeStore.getState().setTurn({ mapId: mapaCripta, tokenId: 'esqueleto' })

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const { values, turn } = useInitiativeStore.getState()
      expect(values[mapaCripta]).toEqual({ esqueleto: 9 })
      expect(turn).toEqual({ mapId: mapaCripta, tokenId: 'esqueleto' })
    })

    /*
     * PELA REDE: o jogador dono do Grog que chegou não pode receber a vez do
     * Grog da Cripta ("sua vez" que não é dele), nem mover na vez dele. E se
     * o Grog da Cripta é SECRETO, nem o id novo dele chega ao jogador.
     */
    function sessaoNaCripta(map: MapData) {
      const s = createHostSession({ code: 'AB12CD', visionRadius: 700, now: () => 0, getTurn: () => useInitiativeStore.getState().turn })
      const welcome = s.handleMessage('c1', { type: 'join', code: 'AB12CD', name: 'Ana' }, map).outbound[0]?.msg
      if (welcome?.type !== 'welcome') throw new Error('esperava welcome')
      s.assignToken(welcome.playerId, 'grog')
      const snapshot = (): Extract<HostMessage, { type: 'snapshot' }> => {
        const msg = s.broadcast(map).outbound.find((o) => o.clientId === 'c1')?.msg
        if (msg?.type !== 'snapshot') throw new Error('esperava snapshot')
        return msg
      }
      const mover = () => s.handleMessage('c1', { type: 'token.move', reqId: 'r1', tokenId: 'grog', x: 440, y: 320 }, map)
      return { snapshot, mover }
    }

    it('REDE: o jogador do Grog que chegou vê a vez com o Grog da Cripta (id novo) e não move fora da vez dele', () => {
      const { vale, cripta } = montarRepetido()
      const mapaCripta = mapaDe(cripta)?.id ?? ''
      useInitiativeStore.getState().setValue(mapaCripta, 'grog', 15)
      useInitiativeStore.getState().setTurn({ mapId: mapaCripta, tokenId: 'grog' })

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const map = mapaDe(cripta)
      const residente = residenteEm(map)
      if (map === null || residente === undefined) throw new Error('esperava a Cripta com o Grog da Cripta')
      const { snapshot, mover } = sessaoNaCripta(map)
      expect(snapshot().turn).toBe(residente.id)
      expect(snapshot().turn).not.toBe('grog')
      const r = mover()
      expect(r.applyMove).toBeUndefined()
      expect(r.outbound).toEqual([{ clientId: 'c1', msg: { type: 'token.move.rejected', reqId: 'r1', reason: 'not_your_turn' } }])
    })

    it('REDE/SEGURANÇA: com o Grog da Cripta SECRETO na vez, o jogador não recebe a vez, nem o id novo, nem o nome dele', () => {
      const { vale, cripta } = montarRepetido({ secret: true })
      const mapaCripta = mapaDe(cripta)?.id ?? ''
      useInitiativeStore.getState().setValue(mapaCripta, 'grog', 15)
      useInitiativeStore.getState().setTurn({ mapId: mapaCripta, tokenId: 'grog' })

      expect(useAdventureStore.getState().transferToken('grog', vale, cripta, 400, 320)).toBe(true)
      const map = mapaDe(cripta)
      const residente = residenteEm(map)
      if (map === null || residente === undefined) throw new Error('esperava a Cripta com o Grog da Cripta')
      const msg = sessaoNaCripta(map).snapshot()
      expect('turn' in msg).toBe(false)
      const fio = JSON.stringify(msg)
      expect(fio).not.toContain(residente.id)
      expect(fio).not.toContain('Grog da Cripta')
      // O Grog que chegou é dele e continua chegando.
      expect(msg.map.tokens.map((t) => t.id)).toContain('grog')
    })
  })
})
