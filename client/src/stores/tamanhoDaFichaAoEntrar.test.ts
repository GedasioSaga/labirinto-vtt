/**
 * TAMANHO DA FICHA AO ENTRAR (pedido do mestre de 12/11/2026, 13h18: "se o
 * token for de uma cena para outra ele fica do tamanho padrão da cena") de
 * ponta a ponta no lado do mestre: a ponte com a sessão de verdade, ligada às
 * stores de verdade do jeito que o App liga (`applyTransfer` com piso, hold e
 * tamanho). Só o transporte é falso.
 *
 * Montagem: a Vila (SEM padrão) e a Cripta (com o padrão de cada teste),
 * ligadas por uma passagem (o jogador pede, o mestre "Deixar ir") e por uma
 * escada livre. Ana e Bia são jogadoras; o Zumbi é ficha sem dono.
 *
 * O que se cobra: o jogador que entra na Cripta pela passagem, pela escada e
 * pelo "Reunir grupo" chega no padrão; o NPC levado pelo mestre também; a
 * ficha nova nasce nele; a cena de fundo grava nele; cena sem padrão não muda
 * nada; o Ctrl+Z e o "Desfazer" do diário devolvem o tamanho de antes; e o
 * número do mestre não sai pelo fio. Dados inventados.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Pin, Stair, Token } from '../types/map'

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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, hostWorldOf } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { useToastStore } = await import('./toastStore')
const { enviarParaCena, ligarSalaAoEnvio } = await import('./enviarParaCena')
const { colocarPecaDoAcervo, criarToken } = await import('./criarToken')
const { createEmptyMap } = await import('../lib/mapFactory')
const { partyMembers } = await import('../lib/party')
const { applyGatherPlan, planGather } = await import('../lib/gatherParty')
const { filterMapForPlayer } = await import('../lib/fogFilter')
const { createHostBridge } = await import('../net/hostBridge')
type HostBridge = ReturnType<typeof createHostBridge>
type AppliedTransfer = import('../net/hostSession').AppliedTransfer
type TravelLogEntry = import('../lib/travelLog').TravelLogEntry

const CODIGO = 'TAM123'
const GRADE = 64
const casa = (coluna: number, linha: number) => ({ x: coluna * GRADE + GRADE / 2, y: linha * GRADE + GRADE / 2 })

// Vila: Ana encostada na porta (à direita) e na escada (à esquerda); o Zumbi longe.
const INICIO_DA_ANA = casa(3, 3)
const PORTA_DA_VILA = casa(4, 3)
const ESCADA_DA_VILA = casa(2, 3)
const INICIO_DO_ZUMBI = casa(8, 10)
// Cripta: as duas pontas de chegada, a fogueira da reunião e Bia.
const PORTA_DA_CRIPTA = casa(10, 8)
const ESCADA_DA_CRIPTA = casa(20, 8)
const FOGUEIRA_DA_CRIPTA = casa(15, 14)
const INICIO_DA_BIA = casa(5, 14)

function ficha(id: string, p: { x: number; y: number }, size: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: id === 'ana' ? 'Ana' : id === 'bia' ? 'Bia' : 'Zumbi', x: p.x, y: p.y, size, image: null, ...extra }
}

function porta(id: string, p: { x: number; y: number }, destino: Pin['destino']): Pin {
  return { id, x: p.x, y: p.y, kind: 'viagem', description: id, image: null, destino }
}

function escada(id: string, p: { x: number; y: number }, direction: Stair['direction']): Stair {
  return { id, shape: 'straight', direction, segments: [{ x1: p.x, y1: p.y, x2: p.x, y2: p.y - 100 }], stepWidth: 50 }
}

function pinoDaEscada(id: string, stairId: string, p: { x: number; y: number }, destino: Pin['destino']): Pin {
  return { ...porta(id, p, destino), passagem: 'livre', escadaId: stairId }
}

interface Montagem {
  /** O "Tamanho da ficha ao entrar" da Cripta; ausente = "Não mudar". */
  padraoDaCripta?: number
  /** O lado da Ana na Vila (o mestre pode tê-la aumentado). */
  ladoDaAna?: number
  /** A cena aberta no editor; a outra fica de fundo. */
  aberta?: 'vila' | 'cripta'
}

/** Vila e Cripta, cada uma montada enquanto está de fundo; termina com `aberta` aberta. */
function montarAventura({ padraoDaCripta, ladoDaAna = 1, aberta = 'vila' }: Montagem = {}): { vila: string; cripta: string } {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vila', 'Vila', 30, 20, GRADE))
  useSessionStore.getState().markSaved()
  const cripta = useAdventureStore.getState().createScene('Cripta', null)
  const vila = useAdventureStore.getState().adventure?.scenes[0].id ?? ''
  useAdventureStore.getState().switchScene(vila)
  useAdventureStore.getState().updateBackgroundScene(cripta, (map) => ({
    ...map,
    tokens: [ficha('bia', INICIO_DA_BIA, 1)],
    stairs: [escada('esc-cripta', ESCADA_DA_CRIPTA, 'down')],
    pins: [
      porta('porta-cripta', PORTA_DA_CRIPTA, { sceneId: vila, pinId: 'porta-vila' }),
      pinoDaEscada('pino-esc-cripta', 'esc-cripta', ESCADA_DA_CRIPTA, { sceneId: vila, pinId: 'pino-esc-vila' }),
      { id: 'fogueira', ...FOGUEIRA_DA_CRIPTA, kind: 'exclamacao', description: 'Fogueira', image: null },
    ],
    ...(padraoDaCripta === undefined ? {} : { tamanhoDaFichaAoEntrar: padraoDaCripta }),
  }))
  useAdventureStore.getState().switchScene(cripta)
  useAdventureStore.getState().updateBackgroundScene(vila, (map) => ({
    ...map,
    tokens: [ficha('ana', INICIO_DA_ANA, ladoDaAna), ficha('zumbi', INICIO_DO_ZUMBI, 3, { npc: true })],
    stairs: [escada('esc-vila', ESCADA_DA_VILA, 'up')],
    pins: [
      porta('porta-vila', PORTA_DA_VILA, { sceneId: cripta, pinId: 'porta-cripta' }),
      pinoDaEscada('pino-esc-vila', 'esc-vila', ESCADA_DA_VILA, { sceneId: cripta, pinId: 'pino-esc-cripta' }),
    ],
  }))
  if (aberta === 'vila') useAdventureStore.getState().switchScene(vila)
  return { vila, cripta }
}

function mapaDaCena(sceneId: string): MapData {
  const { activeSceneId, cache } = useAdventureStore.getState()
  if (sceneId === activeSceneId) return useMapStore.getState().map
  const slot = cache[sceneId]
  if (slot?.status !== 'ok') throw new Error(`a cena ${sceneId} deveria estar no ar`)
  return slot.map
}

function fichaNaCena(sceneId: string, tokenId: string): Token | undefined {
  return mapaDaCena(sceneId).tokens.find((t) => t.id === tokenId)
}

interface Enviado {
  clientId: string
  msg: { type: string; [campo: string]: unknown }
}

/** A mesa online aberta, com Ana (c1) e Bia (c2) jogando, ligada como o App liga. */
async function mesaOnline() {
  const ouvintes = new Map<string, (event: { payload: unknown }) => void>()
  const enviados: Enviado[] = []
  const transferencias: AppliedTransfer[] = []
  let diario: TravelLogEntry[] = []
  // O relógio anda um minuto a cada pedido: o host recusa pedido de passagem colado no anterior ("too_soon").
  let relogio = 1_000_000
  const invoke = vi.fn(async (cmd: string, args?: unknown) => {
    if (cmd === 'net_start_room') return { code: CODIGO, urls: [], qrSvg: '<svg/>' }
    // O `JSON.parse(JSON.stringify(…))` é o fio: o que o jogador recebe é texto.
    if (cmd === 'net_send') enviados.push(JSON.parse(JSON.stringify(args)))
    return undefined
  })
  const listen = vi.fn(async (nome: string, handler: (event: { payload: unknown }) => void) => {
    ouvintes.set(nome, handler)
    return () => undefined
  })
  const bridge: HostBridge = createHostBridge({
    invoke,
    listen,
    getMap: () => useMapStore.getState().map,
    getWorld: () => hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map),
    applyMove: () => undefined,
    applyDoor: () => undefined,
    // Igual ao App.tsx: piso, hold e tamanho seguem até a travessia.
    applyTransfer: (t) => {
      transferencias.push(t)
      return useAdventureStore.getState().transferToken(t.tokenId, t.fromSceneId, t.toSceneId, t.x, t.y, t.piso, t.hold, t.tamanho)
    },
    onPlayersChange: vi.fn(),
    onTravelLogChange: (log) => {
      diario = log
    },
    now: () => relogio,
  })
  await bridge.start()
  const fala = (clientId: string, msg: unknown) => ouvintes.get('net:message')?.({ payload: { clientId, msg } })
  const entra = (clientId: string, name: string, tokenId: string): string => {
    fala(clientId, { type: 'join', code: CODIGO, name })
    const boasVindas = enviados.find((e) => e.clientId === clientId && e.msg.type === 'welcome')
    if (boasVindas === undefined || typeof boasVindas.msg.playerId !== 'string') throw new Error(`${name} não entrou`)
    bridge.assignToken(boasVindas.msg.playerId, tokenId)
    return boasVindas.msg.playerId
  }
  const ana = entra('c1', 'Ana', 'ana')
  const bia = entra('c2', 'Bia', 'bia')
  /** Ana toca a passagem `pinId` e o mestre clica "Deixar ir" no aviso. */
  const anaPedeAPortaEOMestreDeixa = (pinId = 'porta-vila') => {
    relogio += 60_000
    fala('c1', { type: 'pin.travel.request', pinId })
    const aviso = useToastStore.getState().toasts.filter((t) => t.text.includes('quer passar')).at(-1)
    const deixar = aviso?.actions?.find((a) => a.label === 'Deixar ir')
    if (deixar === undefined) throw new Error('o mestre deveria ler o pedido da Ana com "Deixar ir"')
    deixar.run()
  }
  return { bridge, enviados, transferencias, diario: () => diario, fala, ana, bia, anaPedeAPortaEOMestreDeixa }
}

const naLinhaDaGrade = (t: Token | undefined) => t !== undefined && t.x % GRADE === 0 && t.y % GRADE === 0
const distancia = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/** A volta e a ida do Ctrl+Z/Ctrl+Y rodam logo depois do passo (fora do aviso da store). */
const depoisDoPasso = () => Promise.resolve()

let pontes: HostBridge[] = []

describe('Tamanho da ficha ao entrar: toda forma de entrar numa cena com padrão', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useToastStore.setState({ toasts: [] })
    ligarSalaAoEnvio(() => null)
  })

  afterEach(async () => {
    for (const ponte of pontes) await ponte.stop()
    pontes = []
  })

  async function mesa() {
    const m = await mesaOnline()
    pontes.push(m.bridge)
    return m
  }

  describe('passagem (o jogador pede, o mestre "Deixar ir")', () => {
    it('Ana (1 casa) entra na Cripta ABERTA com padrão 2: chega com 2, assentada na linha da grade, na casa que o host já escolheu no lado novo', async () => {
      const { vila, cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'cripta' })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()

      expect(fichaNaCena(vila, 'ana')).toBeUndefined()
      const ana = fichaNaCena(cripta, 'ana')
      expect(ana?.size).toBe(2)
      expect(naLinhaDaGrade(ana)).toBe(true)
      // A casa veio pronta do host (`noLadoDeChegada`): a travessia não precisou assentar de novo.
      expect(t.transferencias.map((x) => [x.tokenId, x.x, x.y])).toEqual([['ana', ana?.x, ana?.y]])
      expect(distancia(ana ?? INICIO_DA_ANA, PORTA_DA_CRIPTA)).toBeLessThanOrEqual(GRADE * 3)
    })

    it('ficha grande também fica no padrão ("todas iguais"): Ana com 3 casas chega com 2; e ao voltar para a Vila (sem padrão) continua com 2', async () => {
      const { vila, cripta } = montarAventura({ padraoDaCripta: 2, ladoDaAna: 3, aberta: 'cripta' })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()
      expect(fichaNaCena(cripta, 'ana')?.size).toBe(2)

      // De volta pela porta da Cripta: a Vila não tem padrão, a ficha entra como estava.
      t.anaPedeAPortaEOMestreDeixa('porta-cripta')
      expect(fichaNaCena(cripta, 'ana')).toBeUndefined()
      expect(fichaNaCena(vila, 'ana')?.size).toBe(2)
    })
  })

  describe('escada entre cenas', () => {
    it('Ana sobe a escada livre da Vila e chega à Cripta (padrão 2) com 2 casas, junto da escada de lá', async () => {
      const { cripta } = montarAventura({ padraoDaCripta: 2 })
      const t = await mesa()

      t.fala('c1', { type: 'pin.travel.request', pinId: 'pino-esc-vila' })

      const ana = fichaNaCena(cripta, 'ana')
      expect(ana?.size).toBe(2)
      expect(naLinhaDaGrade(ana)).toBe(true)
      expect(distancia(ana ?? INICIO_DA_ANA, ESCADA_DA_CRIPTA)).toBeLessThanOrEqual(GRADE * 3)
    })
  })

  describe('"Reunir o grupo aqui"', () => {
    it('com a Cripta aberta (padrão 2), Ana vem da Vila e chega com 2; Bia, que já estava na Cripta com 1, só anda e continua com 1', async () => {
      const { cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'cripta' })
      const t = await mesa()
      const fogueira = mapaDaCena(cripta).pins.find((p) => p.id === 'fogueira')
      if (fogueira === undefined) throw new Error('a fogueira deveria estar na Cripta')

      const world = hostWorldOf(useAdventureStore.getState(), useMapStore.getState().map)
      const plano = planGather(partyMembers(t.bridge.players(), world), world, fogueira)
      expect(plano.leftOut).toEqual([])
      applyGatherPlan(plano, {
        sceneId: world.open.sceneId,
        bringFromOtherScene: (playerId, sceneId, at) => t.bridge.sendPlayer(playerId, sceneId, null, at),
        placeInScene: (positions) => useMapStore.getState().setTokenPositions(positions),
      })

      const ana = fichaNaCena(cripta, 'ana')
      const bia = fichaNaCena(cripta, 'bia')
      expect([ana?.size, bia?.size]).toEqual([2, 1])
      expect(naLinhaDaGrade(ana)).toBe(true)
      expect(distancia(ana ?? INICIO_DA_ANA, FOGUEIRA_DA_CRIPTA)).toBeLessThanOrEqual(GRADE * 3)
      expect(distancia(bia ?? INICIO_DA_BIA, FOGUEIRA_DA_CRIPTA)).toBeLessThanOrEqual(GRADE * 3)
    })
  })

  describe('"Levar para…" (ficha sem dono, pelo mestre)', () => {
    it('o Zumbi (3 casas) vai da Vila aberta para a Cripta com padrão 1 e chega com 1, junto da porta de lá', () => {
      const { vila, cripta } = montarAventura({ padraoDaCripta: 1 })

      expect(useAdventureStore.getState().carryToken('zumbi', cripta, 'porta-cripta')).not.toBeNull()

      expect(fichaNaCena(vila, 'zumbi')).toBeUndefined()
      const zumbi = fichaNaCena(cripta, 'zumbi')
      expect(zumbi?.size).toBe(1)
      expect(distancia(zumbi ?? INICIO_DO_ZUMBI, PORTA_DA_CRIPTA)).toBeLessThanOrEqual(GRADE * 3)
    })
  })

  describe('cena de fundo', () => {
    it('Ana passa para a Cripta DE FUNDO (padrão 2, a Vila aberta): no cache da Cripta ela está com 2', async () => {
      const { cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'vila' })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()

      expect(useAdventureStore.getState().activeSceneId).not.toBe(cripta)
      expect(fichaNaCena(cripta, 'ana')?.size).toBe(2)
      expect(useAdventureStore.getState().dirty[cripta]).toBe(true)
    })

    it('a engrenagem da Cripta usada com a Vila aberta grava o padrão no cache, e a próxima chegada já o segue', async () => {
      const { cripta } = montarAventura({ aberta: 'vila' })
      const t = await mesa()

      useAdventureStore.getState().definirTamanhoAoEntrar(cripta, 3)
      expect(mapaDaCena(cripta).tamanhoDaFichaAoEntrar).toBe(3)

      t.fala('c1', { type: 'pin.travel.request', pinId: 'pino-esc-vila' })
      expect(fichaNaCena(cripta, 'ana')?.size).toBe(3)
    })
  })

  describe('"+ Token" e peça do acervo', () => {
    it('na Cripta aberta com padrão 2, o "+ Token" nasce com 2 e a peça do acervo de 3 casas também', () => {
      const { cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'cripta' })

      const nova = criarToken('Guarda', { at: casa(12, 12) }, null)
      const doAcervo = colocarPecaDoAcervo({ nome: 'Ogro', tamanho: 3 }, 'tok-ogro', { image: null, imageData: null }, casa(16, 12), null)

      expect([fichaNaCena(cripta, nova ?? '')?.size, fichaNaCena(cripta, doAcervo ?? '')?.size]).toEqual([2, 2])
    })
  })

  describe('cena SEM padrão: nada muda', () => {
    it('Ana com 3 casas passa da Vila para a Cripta sem padrão e chega com 3, como no app de antes', async () => {
      const { cripta } = montarAventura({ ladoDaAna: 3 })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()

      expect(fichaNaCena(cripta, 'ana')?.size).toBe(3)
    })

    it('na Vila aberta (sem padrão), o "+ Token" nasce com 1 e a peça do acervo com o tamanho dela (3)', () => {
      const { vila } = montarAventura({ padraoDaCripta: 2, aberta: 'vila' })

      const nova = criarToken('Guarda', { at: casa(12, 12) }, null)
      const doAcervo = colocarPecaDoAcervo({ nome: 'Ogro', tamanho: 3 }, 'tok-ogro', { image: null, imageData: null }, casa(16, 12), null)

      expect([fichaNaCena(vila, nova ?? '')?.size, fichaNaCena(vila, doAcervo ?? '')?.size]).toEqual([1, 3])
    })
  })

  describe('desfazer a viagem devolve o tamanho de antes (commit 2cc765dc)', () => {
    it('"Enviar para cena ›" de Ana (1 casa) para a Cripta com padrão 2: chega com 2; Ctrl+Z a devolve à Vila com 1, na casa de antes', async () => {
      const { vila, cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'vila' })
      const t = await mesa()
      ligarSalaAoEnvio(() => t.bridge)

      expect(enviarParaCena(['ana'], cripta)).toBe(true)
      expect(fichaNaCena(cripta, 'ana')?.size).toBe(2)

      useMapStore.getState().undo()
      await depoisDoPasso()
      expect(fichaNaCena(cripta, 'ana')).toBeUndefined()
      const ana = fichaNaCena(vila, 'ana')
      expect([ana?.x, ana?.y, ana?.size]).toEqual([INICIO_DA_ANA.x, INICIO_DA_ANA.y, 1])
    })

    it('"Desfazer" do diário: Ana com 3 casas vai pela passagem (chega com 2) e volta para a Vila com 3', async () => {
      const { vila, cripta } = montarAventura({ padraoDaCripta: 2, ladoDaAna: 3 })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()
      expect(fichaNaCena(cripta, 'ana')?.size).toBe(2)
      const [ida] = t.diario()
      expect(ida?.fromSize).toBe(3)

      expect(t.bridge.undoTravel(ida?.id ?? '')).toBe(true)
      expect(fichaNaCena(cripta, 'ana')).toBeUndefined()
      expect(fichaNaCena(vila, 'ana')?.size).toBe(3)
    })
  })

  describe('o número do mestre não vai ao jogador (commit d203816d)', () => {
    /** Toda ficha `tokenId` que apareceu num frame para `clientId`, na ordem do fio. */
    function fichasNoFio(enviados: readonly Enviado[], clientId: string, tokenId: string): { size: unknown }[] {
      const achadas: { size: unknown }[] = []
      const andar = (valor: unknown): void => {
        if (Array.isArray(valor)) valor.forEach(andar)
        else if (typeof valor === 'object' && valor !== null) {
          const campos = Object.fromEntries(Object.entries(valor))
          if (campos.id === tokenId && 'size' in campos) achadas.push({ size: campos.size })
          Object.values(campos).forEach(andar)
        }
      }
      for (const e of enviados) if (e.clientId === clientId) andar(e.msg)
      return achadas
    }

    it('nenhum frame do fio traz "tamanhoDaFichaAoEntrar", e a ficha da Ana chega à tela dela já com 2 casas', async () => {
      const { cripta } = montarAventura({ padraoDaCripta: 2, aberta: 'cripta' })
      const t = await mesa()

      t.anaPedeAPortaEOMestreDeixa()
      await new Promise((resolve) => setTimeout(resolve, 400))

      expect(fichaNaCena(cripta, 'ana')?.size).toBe(2)
      expect(t.enviados.length).toBeGreaterThan(0)
      expect(t.enviados.filter((e) => JSON.stringify(e).includes('tamanhoDaFichaAoEntrar'))).toEqual([])
      expect(fichasNoFio(t.enviados, 'c1', 'ana').at(-1)?.size).toBe(2)
    })

    it('o recorte do jogador de uma cena com padrão 2 é IGUAL ao da mesma cena sem padrão (fichas iguais)', () => {
      const fichaDaAna = ficha('ana', casa(4, 4), 2)
      const semPadrao: MapData = { ...createEmptyMap('m-cripta', 'Cripta', 12, 12, GRADE), tokens: [fichaDaAna] }
      const comPadrao: MapData = { ...semPadrao, tamanhoDaFichaAoEntrar: 2 }

      const vistaCom = filterMapForPlayer(comPadrao, 'p-ana', { 'p-ana': ['ana'] }, 700)
      const vistaSem = filterMapForPlayer(semPadrao, 'p-ana', { 'p-ana': ['ana'] }, 700)

      expect(vistaCom.map.tamanhoDaFichaAoEntrar).toBeUndefined()
      expect(JSON.stringify(vistaCom)).toBe(JSON.stringify(vistaSem))
      expect(vistaCom.map.tokens.map((t) => [t.id, t.size])).toEqual([['ana', 2]])
    })
  })
})
