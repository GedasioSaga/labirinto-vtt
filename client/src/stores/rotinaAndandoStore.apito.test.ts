/**
 * APITO SEM TELEPORTE no editor (Caminhos F4, `docs/planos/caminhos-2026-10-23.md`).
 * O apito é trocar o estado do mundo; desde a F4 ele LIGA A CAMINHADA de quem
 * tem posto no valor novo (`subscribeToApito` -> `useRotinaAndandoStore.apitar`).
 * O teleporte antigo ficou só no "Pular para o posto".
 *
 * Metas (escritas antes do código):
 * - `trocarEstadoDoMundo` desloca 0 fichas no ato e 0 fichas além de 1 passo
 *   (2 casas/s x 0,2 s + 1 px) no tique 0, com 30 NPCs;
 * - quem não andava chega ao posto andando, sem nenhum passo maior que 1
 *   passo, e sai da rotina andando ao acabar as etapas do posto;
 * - quem já andava sozinha vai ao posto do apito e segue o loop dali;
 * - ficha na mão de jogador não anda;
 * - "Pular para o posto" leva de uma vez e acaba a caminhada do apito.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Point } from '../pixi/world'
import type { PostoDaRotina, Token } from '../types/map'

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
const { useSessionStore } = await import('./sessionStore')
const { useRotinaAndandoStore } = await import('./rotinaAndandoStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { PASSO_DA_ROTINA_MS, passoEmPx } = await import('../lib/rotinaAndando')

const GRID = 50
const PASSO = passoEmPx(GRID)
/** 1 passo de 2 casas/s x 0,2 s, mais 1 px de folga de arredondamento. */
const MAIOR_PASSO = PASSO + 1

function posicoes(): Map<string, Point> {
  return new Map(useMapStore.getState().map.tokens.map((t): [string, Point] => [t.id, { x: t.x, y: t.y }]))
}

function ondeEsta(id: string): Point {
  const t = useMapStore.getState().map.tokens.find((token) => token.id === id)
  if (t === undefined) throw new Error(`${id} sumiu do mapa`)
  return { x: t.x, y: t.y }
}

/** O maior deslocamento entre duas fotos das fichas, e quantas passaram de `limite`. */
function deslocamento(antes: ReadonlyMap<string, Point>, depois: ReadonlyMap<string, Point>, limite: number): { maior: number; acima: number; andaram: number } {
  let maior = 0
  let acima = 0
  let andaram = 0
  for (const [id, a] of antes) {
    const d = depois.get(id)
    if (d === undefined) continue
    const dist = Math.hypot(d.x - a.x, d.y - a.y)
    maior = Math.max(maior, dist)
    if (dist > limite) acima += 1
    if (dist > 0) andaram += 1
  }
  return { maior, acima, andaram }
}

function npc(id: string, p: Point, postos: PostoDaRotina[], estadoId: string): Token {
  return { id, characterId: null, name: id, x: p.x, y: p.y, size: 1, image: null, npc: true, rotina: { estadoId, postos } }
}

/**
 * A Praça aberta com o estado "Apito: Aurora, Meio, Brasa". `fichas` monta as
 * fichas com o id da cena e do estado; devolve os dois.
 */
function montar(fichas: (praca: string, apito: string) => Token[]): { praca: string; apito: string } {
  useMapStore.getState().loadMap(createEmptyMap('map_vila', 'Vila', 30, 20, GRID))
  useSessionStore.getState().markSaved()
  const praca = useAdventureStore.getState().createScene('Praça', null)
  const apito = useAdventureStore.getState().criarEstadoDoMundo('Apito', 'Aurora, Meio, Brasa')
  if (apito === null) throw new Error('não criou o estado')
  for (const t of fichas(praca, apito)) useMapStore.getState().addToken(t)
  return { praca, apito }
}

/** `n` tiques do relógio da rotina: o maior passo de `id` entre eles. */
function tiques(id: string, n: number): number {
  let antes = ondeEsta(id)
  let maior = 0
  for (let k = 0; k < n; k += 1) {
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    const agora = ondeEsta(id)
    maior = Math.max(maior, Math.hypot(agora.x - antes.x, agora.y - antes.y))
    antes = agora
  }
  return maior
}

beforeEach(() => {
  vi.useFakeTimers()
  useAdventureStore.getState().reset()
})

afterEach(() => {
  useRotinaAndandoStore.getState().reset()
  vi.useRealTimers()
})

describe('apito: trocarEstadoDoMundo liga a caminhada, ninguém pula', () => {
  it('30 NPCs: 0 deslocados no ato e 0 além de 1 passo no tique 0 (e em cada tique depois)', () => {
    const { apito } = montar((praca, estado) =>
      Array.from({ length: 30 }, (_, i) => {
        const p = { x: 100 + (i % 10) * 100, y: 100 + Math.floor(i / 10) * 100 }
        return npc(`npc${i}`, p, [{ valor: 'Meio', sceneId: praca, x: p.x, y: p.y + 500 }], estado)
      }),
    )
    const antes = posicoes()
    const resumo = useAdventureStore.getState().trocarEstadoDoMundo(apito, 'Meio')
    expect(resumo?.fichas).toBe(30)
    expect(deslocamento(antes, posicoes(), 0).andaram).toBe(0)
    expect(useRotinaAndandoStore.getState().andando.size).toBe(30)
    vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
    const tique0 = deslocamento(antes, posicoes(), MAIOR_PASSO)
    expect(tique0.acima).toBe(0)
    expect(tique0.maior).toBeLessThanOrEqual(MAIOR_PASSO)
    // O caminho que não coube no orçamento do tique sai nos seguintes: em 10 tiques todas andaram, sem pulo.
    const andaram = new Set<string>()
    let foto = posicoes()
    for (const [id, p] of foto) if (p.x !== antes.get(id)?.x || p.y !== antes.get(id)?.y) andaram.add(id)
    for (let k = 0; k < 10; k += 1) {
      vi.advanceTimersByTime(PASSO_DA_ROTINA_MS)
      const agora = posicoes()
      expect(deslocamento(foto, agora, MAIOR_PASSO).acima).toBe(0)
      for (const [id, p] of agora) if (p.x !== antes.get(id)?.x || p.y !== antes.get(id)?.y) andaram.add(id)
      foto = agora
    }
    expect(andaram.size).toBe(30)
  })

  it('quem não andava chega ao posto andando e sai da rotina andando ao acabar as etapas', () => {
    const MEIO = { x: 600, y: 100 }
    const { apito } = montar((praca, estado) => [npc('tobias', { x: 100, y: 100 }, [{ valor: 'Meio', sceneId: praca, ...MEIO }], estado)])
    useAdventureStore.getState().trocarEstadoDoMundo(apito, 'Meio')
    expect(useRotinaAndandoStore.getState().andando.get('tobias')?.apito).toEqual({ valor: 'Meio', seguir: false })
    const maior = tiques('tobias', 40)
    expect(ondeEsta('tobias')).toEqual(MEIO)
    expect(maior).toBeLessThanOrEqual(MAIOR_PASSO)
    // Etapas de antes do campo (esperar 2 s) não seguram quem só ia ao posto: chegou, saiu.
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(false)
  })

  it('quem já andava sozinha vai ao posto do apito e segue o loop dali', () => {
    const AURORA = { x: 100, y: 100 }
    const MEIO = { x: 600, y: 100 }
    const BRASA = { x: 100, y: 600 }
    const { apito } = montar((praca, estado) => [
      npc(
        'tobias',
        AURORA,
        [
          { valor: 'Aurora', sceneId: praca, ...AURORA },
          { valor: 'Meio', sceneId: praca, ...MEIO },
          { valor: 'Brasa', sceneId: praca, ...BRASA },
        ],
        estado,
      ),
    ])
    useRotinaAndandoStore.getState().ligar('tobias')
    // Liga rumo ao Meio (o seguinte ao posto onde está); o apito da Brasa o desvia.
    tiques('tobias', 3)
    useAdventureStore.getState().trocarEstadoDoMundo(apito, 'Brasa')
    expect(useRotinaAndandoStore.getState().andando.get('tobias')?.apito).toEqual({ valor: 'Brasa', seguir: true })
    const maior = tiques('tobias', 40)
    expect(maior).toBeLessThanOrEqual(MAIOR_PASSO)
    // Passou pela Brasa e seguiu o loop: continua andando sozinha, sem o apito.
    const ficha = useRotinaAndandoStore.getState().andando.get('tobias')
    expect(ficha).toBeDefined()
    expect(ficha?.apito).toBeUndefined()
  })

  it('ficha na mão de jogador não anda', () => {
    const { apito } = montar((praca, estado) => [npc('tobias', { x: 100, y: 100 }, [{ valor: 'Meio', sceneId: praca, x: 600, y: 100 }], estado)])
    useAdventureStore.getState().trocarEstadoDoMundo(apito, 'Meio', new Set(['tobias']))
    tiques('tobias', 5)
    expect(ondeEsta('tobias')).toEqual({ x: 100, y: 100 })
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(false)
  })
})

describe('"Pular para o posto" pelo store da rotina', () => {
  it('leva de uma vez e acaba a caminhada do apito; quem anda sozinha recomeça do posto', () => {
    const MEIO = { x: 600, y: 100 }
    const { apito } = montar((praca, estado) => [
      npc('tobias', { x: 100, y: 100 }, [{ valor: 'Meio', sceneId: praca, ...MEIO }], estado),
      npc(
        'irma',
        { x: 100, y: 400 },
        [
          { valor: 'Aurora', sceneId: praca, x: 100, y: 400 },
          { valor: 'Meio', sceneId: praca, x: 600, y: 400 },
        ],
        estado,
      ),
    ])
    useRotinaAndandoStore.getState().ligar('irma')
    useAdventureStore.getState().trocarEstadoDoMundo(apito, 'Meio')
    tiques('tobias', 2)
    const pularam = useRotinaAndandoStore.getState().pularParaOPosto(apito)
    expect(pularam).toBe(2)
    expect(ondeEsta('tobias')).toEqual(MEIO)
    expect(ondeEsta('irma')).toEqual({ x: 600, y: 400 })
    expect(useRotinaAndandoStore.getState().andando.has('tobias')).toBe(false)
    // A irmã andava sozinha: recomeça do posto onde caiu, mirando o seguinte (Aurora).
    expect(useRotinaAndandoStore.getState().andando.get('irma')).toEqual(expect.objectContaining({ destino: 0 }))
    expect(useRotinaAndandoStore.getState().andando.get('irma')?.apito).toBeUndefined()
    // Ninguém mais longe do posto: o botão de novo não leva ninguém.
    expect(useRotinaAndandoStore.getState().pularParaOPosto(apito)).toBe(0)
  })
})
