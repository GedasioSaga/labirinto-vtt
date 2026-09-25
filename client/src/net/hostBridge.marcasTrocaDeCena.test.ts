/**
 * BILHETE NO LUGAR: o "Apagar" do aviso ao mestre quando ele TROCA DE CENA
 * nos segundos em que o aviso está na tela. A ponte e a sessão são as de
 * verdade, ligadas às stores como o App liga (`hostWorldOf` +
 * `...hostPlayerChanges`); só o transporte é falso.
 *
 * O que se cobra: o clique apaga a marca na cena que a tem AGORA (a aberta ou
 * uma de fundo), e não na cena de quando ela chegou — e, se a marca já não
 * está em cena nenhuma, o mestre é avisado em vez de o clique sumir calado.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, MarcaNoLugar, Token } from '../types/map'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => ''),
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

const { useAdventureStore, hostWorldOf } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { useToastStore } = await import('../stores/toastStore')
const { createEmptyMap, addToken } = await import('../lib/mapFactory')
const { createHostBridge } = await import('./hostBridge')
const { hostPlayerChanges } = await import('./playerChanges')

const CODIGO = 'AB12CD'
const TEXTO_DO_VALE = 'GUI ESPERA NO POCO'
const TEXTO_DA_CRIPTA = 'NAO ABRA O SARCOFAGO'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `ficha-${id}`, x, y, size: 1, image: null }
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

/** Vale aberto com a ficha de Ana; a Cripta Rubra de fundo com a de Bia. */
async function mesa() {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vale', 'Vale', 30, 20, 40))
  useSessionStore.getState().markSaved()
  useMapStore.getState().addToken(ficha('lanterna', 200, 200))
  const cripta = useAdventureStore.getState().createScene('Cripta Rubra', null)
  const vale = useAdventureStore.getState().adventure?.scenes[0]?.id ?? ''
  useAdventureStore.getState().switchScene(vale)
  useAdventureStore.getState().updateBackgroundScene(cripta, (map) => addToken(map, ficha('machado', 200, 200)))

  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return { code: CODIGO, urls: [], qrSvg: '<svg/>' }
    if (cmd === 'net_send') enviados.push(JSON.parse(JSON.stringify(args)))
    return undefined
  })
  const listen = vi.fn(async (nome: string, handler: (event: { payload: unknown }) => void) => {
    ouvintes.set(nome, handler)
    return () => undefined
  })
  const bridge = createHostBridge({
    invoke,
    listen,
    getMap: () => useMapStore.getState().map,
    getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
    ...hostPlayerChanges,
    now: () => 0,
  })
  await bridge.start()
  const emite = (clientId: string, msg: Record<string, unknown>): void => {
    const ouvinte = ouvintes.get('net:message')
    if (ouvinte === undefined) throw new Error('sem ouvinte de net:message')
    ouvinte({ payload: { clientId, msg } })
  }
  const entra = (clientId: string, name: string, tokenId: string): void => {
    emite(clientId, { type: 'join', code: CODIGO, name })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    bridge.assignToken(boasVindas.msg.playerId, tokenId)
  }
  entra('c1', 'Ana', 'lanterna')
  entra('c2', 'Bia', 'machado')
  useToastStore.setState({ toasts: [] })
  const deixarBilhete = (clientId: string, texto: string): void => emite(clientId, { type: 'mark.place', x: 220, y: 200, tipo: 'bilhete', texto })
  return { vale, cripta, enviados, deixarBilhete }
}

function mapaDaCena(sceneId: string): MapData {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`a cena ${sceneId} deveria estar de fundo`)
  return slot.map
}

const textos = (marcas: readonly MarcaNoLugar[] | undefined): Array<string | undefined> => (marcas ?? []).map((m) => m.texto)

/** O "Apagar" do aviso cujo texto contém `trecho`. */
function apagarDoAviso(trecho: string): () => void {
  const aviso = useToastStore.getState().toasts.find((t) => t.text.includes(trecho))
  const apagar = aviso?.actions?.find((a) => a.label === 'Apagar')
  if (apagar === undefined) throw new Error(`sem "Apagar" no aviso de ${trecho}`)
  return apagar.run
}

beforeEach(() => {
  vi.clearAllMocks()
  useToastStore.setState({ toasts: [] })
})

describe('"Apagar" do aviso do bilhete depois de o mestre trocar de cena', () => {
  it('marca da cena aberta: o mestre abre outra cena e o clique ainda apaga a marca onde ela ficou', async () => {
    const t = await mesa()
    t.deixarBilhete('c1', TEXTO_DO_VALE)
    expect(textos(mapaDaCena(t.vale).marcas)).toEqual([TEXTO_DO_VALE])
    const apagar = apagarDoAviso(TEXTO_DO_VALE)

    expect(useAdventureStore.getState().switchScene(t.cripta)).toBe(true)
    const criptaAntes = useMapStore.getState().map
    apagar()

    expect(textos(mapaDaCena(t.vale).marcas)).toEqual([])
    // O desfazer guardado da cena também perde a marca: abrir e dar Ctrl+Z não a traz de volta.
    const slot = useAdventureStore.getState().cache[t.vale]
    if (slot?.status !== 'ok') throw new Error('o Vale deveria estar de fundo')
    expect(slot.past.length).toBeGreaterThan(0)
    expect(slot.past.flatMap((passo) => textos(passo.marcas))).toEqual([])
    // A cena aberta agora (a Cripta) não muda.
    expect(useMapStore.getState().map).toBe(criptaAntes)
  })

  it('marca de cena de fundo: o mestre abre essa cena para ver o bilhete, e o clique apaga ali e tira do jogador', async () => {
    const t = await mesa()
    t.deixarBilhete('c2', TEXTO_DA_CRIPTA)
    expect(useToastStore.getState().toasts[0]?.text).toBe(`Bia deixou um bilhete em Cripta Rubra: “${TEXTO_DA_CRIPTA}”`)
    expect(textos(mapaDaCena(t.cripta).marcas)).toEqual([TEXTO_DA_CRIPTA])
    const apagar = apagarDoAviso(TEXTO_DA_CRIPTA)

    expect(useAdventureStore.getState().switchScene(t.cripta)).toBe(true)
    expect(textos(useMapStore.getState().map.marcas)).toEqual([TEXTO_DA_CRIPTA])
    const antes = t.enviados.length
    apagar()

    expect(textos(useMapStore.getState().map.marcas)).toEqual([])
    const paraBia = t.enviados.slice(antes).filter((e) => e.clientId === 'c2' && (e.msg.type === 'snapshot' || e.msg.type === 'delta'))
    expect(paraBia.length).toBeGreaterThan(0)
    expect(JSON.stringify(paraBia)).not.toContain(TEXTO_DA_CRIPTA)
    // Nada de aviso de "já não estava": apagou de verdade.
    expect(useToastStore.getState().toasts.map((a) => a.text).filter((texto) => texto.includes('já não'))).toEqual([])
  })

  it('marca que já saiu do mapa (apagada pela lista): o clique avisa o mestre em vez de sumir calado', async () => {
    const t = await mesa()
    t.deixarBilhete('c1', TEXTO_DO_VALE)
    const apagar = apagarDoAviso(TEXTO_DO_VALE)
    const marca = mapaDaCena(t.vale).marcas?.[0]
    if (marca === undefined) throw new Error('o bilhete não entrou')
    hostPlayerChanges.removeMark(marca.id)
    const valeAntes = mapaDaCena(t.vale)
    useToastStore.setState({ toasts: [] })

    apagar()

    expect(mapaDaCena(t.vale)).toBe(valeAntes)
    expect(useToastStore.getState().toasts.map((a) => a.text)).toEqual(['Esse bilhete já não está no mapa'])
  })
})
