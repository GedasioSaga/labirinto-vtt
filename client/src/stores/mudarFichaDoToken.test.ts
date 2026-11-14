/**
 * MUDAR FICHA (pedido de 14/11/2026), a porta do botão direito do mestre
 * (`stores/mudarFichaDoToken.ts`): escolher a transformação marca-a como Ativa
 * na ficha de personagem ligada, SEM cobrar o custo, e a imagem que o token
 * mostra FORA da batalha passa a ser a da forma; "Normal" volta à imagem base
 * e desliga a forma. Nas stores do app (aventura One Piece sem pasta, uma
 * cena), sem batalha ligada. Dados inventados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapData, Token } from '../types/map'
import type { Personagem } from '../lib/personagem'

vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (caminho: string) => caminho.slice(0, caminho.lastIndexOf('/'))),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async (caminho: string) => {
    throw new Error(`arquivo não existe: ${caminho}`)
  }),
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  remove: vi.fn(async () => undefined),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  copyFile: vi.fn(async () => undefined),
}))

const { useAdventureStore, personagensAtivos, sistemaAtivo } = await import('./adventureStore')
const { useMapStore } = await import('./mapStore')
const { useSessionStore } = await import('./sessionStore')
const { sistemaPorId, useRpgStore } = await import('./rpgStore')
const { mudarFichaDoToken } = await import('./mudarFichaDoToken')
const { formasVisiveisDoMapa } = await import('../lib/mudarFicha')
const { createEmptyMap } = await import('../lib/mapFactory')
const { personagemDoArquivo } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
type OpenedMapFile = import('../lib/mapFileIO').OpenedMapFile
type Adventure = import('../lib/adventure').Adventure

const DIR = 'C:/appdata/maps/adv_op'
const CENA = 's_sky'
const TOKEN = 't_luffy'
const FORMA = 'forma_gear'
/** A imagem do cartão da forma: embutida pequena, a que a mesa aceita (`ehImagemDaMesa`). */
const FOTO_DA_FORMA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const FOTO_BASE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const SP_ANTES = 100

function ficha(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

/** Uma forma com imagem e custo de 50 SP (que o "Mudar ficha" NÃO cobra), outra sem imagem. */
function luffy(): Personagem {
  return ficha({
    id: 'p_luffy',
    tipo: 'jogador',
    nome: 'Luffy',
    recursos: { hp: 300, sp: SP_ANTES },
    maximos: { hp: 700, sp: 120 },
    abas: {
      transformacoes: [
        { id: FORMA, nome: 'Gear Second', campos: { acao: 'Livre', custo: '50 SP' }, imagem: FOTO_DA_FORMA },
        { id: 'forma_sem_foto', nome: 'Sem Foto', campos: { acao: 'Livre' } },
      ],
    },
  })
}

function boneco(): Token {
  return { id: TOKEN, characterId: 'p_luffy', name: 'Luffy', x: 96, y: 96, size: 1, image: null, imageData: FOTO_BASE }
}

async function abrirAventura(): Promise<void> {
  const mapa: MapData = { ...createEmptyMap('map_sky', 'Sky Lagoon', 20, 16, 64), tokens: [boneco()] }
  const entrada = { id: CENA, name: 'Sky Lagoon', file: 'map.json' }
  const adventure: Adventure = { version: 1, id: 'adv_op', name: 'One Piece', startSceneId: CENA, scenes: [entrada], sistemaDeRpg: SISTEMA_ONE_PIECE.id, personagens: [luffy()], mochilaMigrada: 1 }
  const aberto: OpenedMapFile = {
    path: `${DIR}/map.json`,
    map: mapa,
    adventure,
    adventureDir: DIR,
    activeSceneId: CENA,
    scenes: [{ entry: entrada, status: 'ok', map: mapa }],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
  await useAdventureStore.getState().open(aberto, null)
}

function fichaDoLuffy(): Personagem {
  const achada = personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === 'p_luffy')
  if (achada === undefined) throw new Error('sem a ficha do Luffy')
  return achada
}

function tokenDoLuffy(): Token {
  const achado = useMapStore.getState().map.tokens.find((token) => token.id === TOKEN)
  if (achado === undefined) throw new Error('sem o token do Luffy')
  return achado
}

/** A imagem de forma que o token mostra no mapa, pela mesma conta do app (`App.tsx`, `net/hostSession.ts`): `undefined` = a imagem base. */
function imagemVisivel(): string | undefined {
  const estado = useAdventureStore.getState()
  const sistema = sistemaPorId(useRpgStore.getState().biblioteca, sistemaAtivo(estado))
  return formasVisiveisDoMapa(useMapStore.getState().map.tokens, personagensAtivos(estado), sistema)?.get(TOKEN)
}

beforeEach(async () => {
  useAdventureStore.getState().reset()
  useMapStore.getState().loadMap(createEmptyMap('map_vazio', 'Vazio', 20, 16, 64))
  useSessionStore.getState().markSaved()
  await abrirAventura()
})

describe('Mudar ficha pelo botão direito do mestre (fora da batalha)', () => {
  it('escolher a forma marca Ativa na ficha, sem cobrar o custo, e o token passa a mostrar a imagem dela', () => {
    expect(fichaDoLuffy().cartoesAtivos).toEqual([])
    expect(imagemVisivel()).toBeUndefined()

    mudarFichaDoToken(TOKEN, FORMA)

    expect(tokenDoLuffy().formaVisivel).toBe(FORMA)
    expect(fichaDoLuffy().cartoesAtivos).toEqual([FORMA])
    // Sem custo: os 50 SP do cartão não saem.
    expect(fichaDoLuffy().recursos.sp).toBe(SP_ANTES)
    expect(imagemVisivel()).toBe(FOTO_DA_FORMA)
    // A foto base do token continua guardada: é só a imagem à vista que muda.
    expect(tokenDoLuffy().imageData).toBe(FOTO_BASE)
  })

  it('"Normal" desliga a forma na ficha e o token volta à imagem base; desligar só na ficha também volta', () => {
    mudarFichaDoToken(TOKEN, FORMA)
    expect(imagemVisivel()).toBe(FOTO_DA_FORMA)

    mudarFichaDoToken(TOKEN, null)

    expect('formaVisivel' in tokenDoLuffy()).toBe(false)
    expect(fichaDoLuffy().cartoesAtivos).toEqual([])
    expect(imagemVisivel()).toBeUndefined()

    // A forma escolhida de novo e desligada NA FICHA (não pelo menu): o token guarda a escolha, mas mostra a base.
    mudarFichaDoToken(TOKEN, FORMA)
    useAdventureStore.getState().ajustarPersonagem('p_luffy', (atual) => ({ ...atual, cartoesAtivos: [] }))
    expect(tokenDoLuffy().formaVisivel).toBe(FORMA)
    expect(imagemVisivel()).toBeUndefined()
  })
})
