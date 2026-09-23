/**
 * OLHOS DO GUARDA no RECORTE DO JOGADOR. O cone do guarda (`vigia`) é do
 * mestre e nunca sai da máquina dele. O jogador recebe, na ficha do guarda que
 * ELE PRÓPRIO enxerga, só a marca de alerta (`alerta`: "?" ou "!") — nunca a
 * direção, a abertura, o alcance, nem QUEM o guarda viu. E a marca só conta
 * fichas que o próprio recorte entrega: colega na névoa, "Oculto para
 * jogadores", em zona oculta ou sob teto fechado não acende marca nenhuma — ela
 * contaria que há alguém ali. Guarda que o jogador
 * não vê (atrás da parede, fora do raio, "Oculto para jogadores", em zona
 * oculta) não leva marca nenhuma para a rede.
 */
import { describe, expect, it } from 'vitest'
import type { ConcealZone, MapData, Region, Token, TokenWatch, Wall } from '../types/map'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

function ficha(id: string, x: number, y: number, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null, ...extra }
}

function parede(id: string, x1: number, y1: number, x2: number, y2: number): Wall {
  return { id, x1, y1, x2, y2, blocksLight: true, blocksMove: true, door: null }
}

/** Grade de 40 px: alcance 6 = 240 px, metade = 120 px. */
function mesa(tokens: Token[], extra: Partial<MapData> = {}): MapData {
  return { ...createEmptyMap('m', 'M', 1000, 1000, 40), tokens, ...extra }
}

const OESTE: TokenWatch = { direcao: 180, abertura: 90, alcance: 6 }
const LESTE: TokenWatch = { direcao: 0, abertura: 90, alcance: 6 }
const DONOS = { p1: ['heroi'], p2: ['ladra'] }
const RAIO = 700

function guardaNo(out: MapData, id = 'sentinela'): Token | undefined {
  return out.tokens.find((t) => t.id === id)
}

describe('filterMapForPlayer — olhos do guarda', () => {
  it('guarda que vê a ficha do jogador de perto chega com "!", e sem o cone', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE })]), 'p1', DONOS, RAIO)
    const guarda = guardaNo(out.map)
    expect(guarda?.alerta).toBe('!')
    expect(guarda !== undefined && 'vigia' in guarda).toBe(false)
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('vigia')
    expect(texto).not.toContain('direcao')
    expect(texto).not.toContain('abertura')
    expect(texto).not.toContain('alcance')
  })

  it('de longe, na borda do olhar: "?"', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 400, 200, { vigia: OESTE })]), 'p1', DONOS, RAIO)
    expect(guardaNo(out.map)?.alerta).toBe('?')
  })

  it('guarda de costas para todo mundo: a ficha dele chega sem marca', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: LESTE })]), 'p1', DONOS, RAIO)
    const guarda = guardaNo(out.map)
    expect(guarda).toBeDefined()
    expect(guarda !== undefined && 'alerta' in guarda).toBe(false)
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('o guarda viu OUTRO jogador que eu não vejo (névoa): nem a marca chega — ela contaria que há alguém ali', () => {
    // Raio 400: o herói (x=100) vê o guarda (x=400) mas não a ladra (x=600).
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForPlayer(mapa, 'p1', DONOS, 400)
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('ladra')
    expect(texto).not.toContain('alerta')
  })

  it('o guarda viu um colega que EU VEJO: a marca chega, e o cone não', () => {
    // Mesmo desenho, raio 700: agora o herói vê a ladra também.
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForPlayer(mapa, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'ladra', 'sentinela'])
    expect(guardaNo(out.map)?.alerta).toBe('?')
    expect(JSON.stringify(out)).not.toContain('vigia')
  })

  it('o guarda viu a ficha do colega que o mestre marcou "Oculto para jogadores": nem a ficha, nem a marca', () => {
    // O herói (x=100) vê o guarda (x=300), que olha a leste para a ladra (x=400), a 100 px.
    const fichas = (secret: boolean): Token[] => [
      ficha('heroi', 100, 200),
      ficha('sentinela', 300, 200, { vigia: LESTE }),
      ficha('ladra', 400, 200, { secret }),
    ]
    const escondida = filterMapForPlayer(mesa(fichas(true)), 'p1', DONOS, RAIO)
    expect(escondida.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    expect(JSON.stringify(escondida)).not.toContain('alerta')
    // Controle: a mesma ladra sem o segredo dá "!" no guarda.
    expect(guardaNo(filterMapForPlayer(mesa(fichas(false)), 'p1', DONOS, RAIO).map)?.alerta).toBe('!')
  })

  it('o guarda viu a ficha do colega dentro de zona oculta: a marca só chega depois de o mestre revelar a zona', () => {
    const zona = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 360, y: 160 }, { x: 460, y: 160 }, { x: 460, y: 240 }, { x: 360, y: 240 }],
    })
    const fichas = [ficha('heroi', 100, 200), ficha('sentinela', 300, 200, { vigia: LESTE }), ficha('ladra', 400, 200)]
    const oculta = filterMapForPlayer(mesa(fichas, { concealZones: [zona(false)] }), 'p1', DONOS, RAIO)
    expect(oculta.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    expect(JSON.stringify(oculta)).not.toContain('alerta')
    expect(guardaNo(filterMapForPlayer(mesa(fichas, { concealZones: [zona(true)] }), 'p1', DONOS, RAIO).map)?.alerta).toBe('!')
  })

  it('o guarda viu a ficha do colega sob teto fechado: nem a ficha, nem a marca', () => {
    // A casa (360..520) tem teto e o herói está fora dela: o interior não sai para ele.
    const casa = (roof: boolean): Region => ({
      id: 'casa',
      points: [{ x: 360, y: 140 }, { x: 520, y: 140 }, { x: 520, y: 260 }, { x: 360, y: 260 }],
      tag: '',
      fillColor: '#123',
      fillPattern: 'solid',
      data: {},
      room: { shape: 'rect', name: 'casa', roof },
    })
    const fichas = [ficha('heroi', 100, 200), ficha('sentinela', 300, 200, { vigia: LESTE }), ficha('ladra', 440, 200)]
    const out = filterMapForPlayer(mesa(fichas, { regions: [casa(true)] }), 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    expect(JSON.stringify(out)).not.toContain('alerta')
    // Controle: sem teto, a ladra aparece e o guarda leva "?".
    expect(guardaNo(filterMapForPlayer(mesa(fichas, { regions: [casa(false)] }), 'p1', DONOS, RAIO).map)?.alerta).toBe('?')
  })

  it('guarda "Oculto para jogadores" que me vê: nem ele, nem marca nenhuma', () => {
    const out = filterMapForPlayer(
      mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE, secret: true })]),
      'p1',
      DONOS,
      RAIO,
    )
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('sentinela')
    expect(texto).not.toContain('alerta')
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
  })

  it('guarda atrás da parede não chega, nem a marca dele', () => {
    // O guarda olha para a parede (oeste) e não enxerga o herói; o que importa aqui é que ele nem sai.
    const mapa = mesa([ficha('heroi', 200, 200), ficha('sentinela', 800, 200, { vigia: OESTE }), ficha('ladra', 700, 200)], {
      walls: [parede('divisoria', 500, 0, 500, 1000)],
    })
    const out = filterMapForPlayer(mapa, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('guarda dentro de zona oculta: a marca só chega depois de o mestre revelar a zona', () => {
    const zona = (revealed: boolean): ConcealZone => ({
      id: 'zona',
      name: 'zona',
      revealed,
      points: [{ x: 260, y: 160 }, { x: 360, y: 160 }, { x: 360, y: 240 }, { x: 260, y: 240 }],
    })
    const fichas = [ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE })]
    expect(JSON.stringify(filterMapForPlayer(mesa(fichas, { concealZones: [zona(false)] }), 'p1', DONOS, RAIO))).not.toContain('alerta')
    expect(guardaNo(filterMapForPlayer(mesa(fichas, { concealZones: [zona(true)] }), 'p1', DONOS, RAIO).map)?.alerta).toBe('!')
  })

  it('"alerta" gravado à mão numa ficha não passa: quem decide a marca é o recorte', () => {
    const mapa = mesa([ficha('heroi', 200, 200), ficha('rato', 300, 200, { alerta: '!' }), ficha('sentinela', 300, 260, { vigia: LESTE, alerta: '!' })])
    const out = filterMapForPlayer(mapa, 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'rato', 'sentinela'])
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('vigia posta na ficha do PRÓPRIO jogador também não sai para ele', () => {
    const out = filterMapForPlayer(mesa([ficha('heroi', 200, 200, { vigia: LESTE })]), 'p1', DONOS, RAIO)
    expect(out.map.tokens.map((t) => t.id)).toEqual(['heroi'])
    expect(JSON.stringify(out)).not.toContain('vigia')
  })
})

/**
 * TELA DA MESA: o recorte de GRUPO (`filterMapForGroup`) só conhece as fichas
 * do próprio grupo. A marca é medida contra as fichas de TODOS os jogadores,
 * que chegam de fora (`watchTargets`), mas só as que a mesa VÊ; o cone nunca
 * sai, igual ao jogador.
 */
describe('filterMapForGroup — olhos do guarda na tela da mesa', () => {
  it('guarda que o grupo vê olhando para ele: "!" e sem o cone', () => {
    const mapa = mesa([ficha('heroi', 200, 200), ficha('sentinela', 300, 200, { vigia: OESTE })])
    const out = filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: RAIO }], undefined, undefined, new Set(['heroi', 'ladra']))
    expect(guardaNo(out.map)?.alerta).toBe('!')
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('vigia')
    expect(texto).not.toContain('direcao')
    expect(texto).not.toContain('abertura')
    expect(texto).not.toContain('alcance')
  })

  it('o guarda viu a ficha de um jogador FORA do grupo que a mesa não vê: nem a marca', () => {
    // Raio 400: o herói (x=100) vê o guarda (x=400) mas não a ladra (x=600), que não é do grupo.
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: 400 }], undefined, undefined, new Set(['heroi', 'ladra']))
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    const texto = JSON.stringify(out)
    expect(texto).not.toContain('ladra')
    expect(texto).not.toContain('alerta')
  })

  it('o guarda viu a ficha de um jogador FORA do grupo que a mesa VÊ: a marca vem', () => {
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: RAIO }], undefined, undefined, new Set(['heroi', 'ladra']))
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'ladra', 'sentinela'])
    expect(guardaNo(out.map)?.alerta).toBe('?')
  })

  it('o guarda viu a ficha secreta de um jogador: a tela da mesa, que é pública, não recebe marca', () => {
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 300, 200, { vigia: LESTE }), ficha('ladra', 400, 200, { secret: true })])
    const out = filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: RAIO }], undefined, undefined, new Set(['heroi', 'ladra']))
    expect(out.map.tokens.map((t) => t.id).sort()).toEqual(['heroi', 'sentinela'])
    expect(JSON.stringify(out)).not.toContain('alerta')
  })

  it('sem quem vigiar passado de fora, vale o grupo: guarda olhando para quem não é jogador fica sem marca', () => {
    const mapa = mesa([ficha('heroi', 100, 200), ficha('sentinela', 400, 200, { vigia: LESTE }), ficha('ladra', 600, 200)])
    const out = filterMapForGroup(mapa, [{ tokenIds: ['heroi'], visionRadius: 400 }])
    const guarda = guardaNo(out.map)
    expect(guarda).toBeDefined()
    expect(guarda !== undefined && 'alerta' in guarda).toBe(false)
    expect(JSON.stringify(out)).not.toContain('vigia')
  })
})
