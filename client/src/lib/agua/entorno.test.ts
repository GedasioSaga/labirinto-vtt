import { describe, expect, it } from 'vitest'
import type { Agua, MapData, Region, RegionPoint, Token, Wall } from '../../types/map'
import { filterMapForPlayer } from '../fogFilter'
import { createEmptyMap } from '../mapFactory'
import type { CampoComposto } from './campo'
import { campoDasAguas } from './corpos'
import { areiaParaJogador, entornoDaAgua, semAreiaDaBeira, SEM_ENTORNO } from './entorno'
import { curvaGuardada } from './forma'

/**
 * MAR MAIS FÁCIL (13/11/2026): a borda do mapa, o chão por cima da água e o
 * pincel de areia (`lib/agua/entorno.ts`), e a prova de névoa: a sala secreta
 * que o jogador não recebe não abre buraco nem tira margem.
 */
const G = 40
const P = (x: number, y: number): RegionPoint => ({ x: x * G, y: y * G })
const rect = (x0: number, y0: number, x1: number, y1: number): RegionPoint[] => [P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]
const mar = (pontos: RegionPoint[], extra: Partial<Agua> = {}): Agua => ({ id: 'mar', tipo: 'mar', cor: '#2d5f8c', reto: true, pontos, ...extra })
const sala = (id: string, pontos: RegionPoint[], extra: Partial<Region> = {}): Region => ({ id, points: pontos, tag: 'region', fillColor: '#4d2f05', fillPattern: 'solid', data: {}, room: { shape: 'rect', name: id }, ...extra })
const entornoDe = (regioes: Region[], lado = 20): ReturnType<typeof entornoDaAgua> => entornoDaAgua({ largura: lado * G, altura: lado * G, regioes, ocultas: [], chao: [], props: [] })

/** O valor do campo no ponto (px de mundo): a distância com sinal até a margem, ou o buraco (0 a 255). */
function noPonto(c: CampoComposto | null, px: number, py: number, canal: 'sd' | 'buraco'): number {
  if (c === null) return Number.NaN
  const k = 40 / G
  const i = (Math.floor((py * k) / c.texel) - c.y0) * c.w + (Math.floor((px * k) / c.texel) - c.x0)
  return canal === 'sd' ? c.f1[i * 4] : c.f4[i * 4]
}

describe('o mar e o mapa em volta', () => {
  it('a borda: o campo para no mapa e a beira fora dele não é margem; mapa sem tamanho fica como antes', () => {
    // Mar de 10 a 20,5 casas de altura num mapa de 20: o lado de baixo e os lados passam da borda.
    const a = mar(rect(-5, 10, 20.5, 25))
    const antes = campoDasAguas([a], G)
    const depois = campoDasAguas([a], G, entornoDe([]))
    expect(depois !== null && (depois.x0 + depois.w) * depois.texel <= 20 * 40 + 3 * depois.texel, 'cortado no mapa').toBe(true)
    // A meia casa da borda direita: antes raso (a margem estava a 1 casa), agora fundo (a margem de cima está longe).
    expect(noPonto(antes, 19.5 * G, 18 * G, 'sd')).toBeLessThan(60)
    expect(noPonto(depois, 19.5 * G, 18 * G, 'sd')).toBe(240)
    // A margem de cima, dentro do mapa, continua igual.
    expect(noPonto(depois, 10 * G, 10.25 * G, 'sd')).toBe(noPonto(antes, 10 * G, 10.25 * G, 'sd'))
    const semTamanho = campoDasAguas([a], G, { ...SEM_ENTORNO, mapa: null })
    expect(semTamanho?.f1).toEqual(antes?.f1)
  })

  it('a sala por cima: abre buraco no fundo dela e tira a margem a menos de meia casa; a sala sem fundo só tira a margem', () => {
    const a = mar(rect(0, 10, 20, 20))
    const pier = rect(9.5, 7, 10.5, 15)
    const comPier = campoDasAguas([a], G, entornoDe([sala('pier', pier)]))
    const semFundo = campoDasAguas([a], G, entornoDe([sala('pier', pier, { filled: false })]))
    const semNada = campoDasAguas([a], G, entornoDe([]))
    expect(noPonto(comPier, 10 * G, 12 * G, 'buraco'), 'o fundo da sala cobre a água').toBe(255)
    expect(noPonto(comPier, 8 * G, 12 * G, 'buraco'), 'fora da sala, água').toBe(0)
    expect(noPonto(semFundo, 10 * G, 12 * G, 'buraco'), 'sala sem fundo não cobre').toBe(0)
    // Na beira junto da sala (0,2 casa dela) não há margem: a água ali não é rasa; longe dela, é como antes.
    for (const c of [comPier, semFundo]) expect(noPonto(c, 9.3 * G, 10.1 * G, 'sd')).toBeGreaterThan(noPonto(semNada, 9.3 * G, 10.1 * G, 'sd') + 5)
    expect(noPonto(comPier, 5 * G, 10.1 * G, 'sd')).toBe(noPonto(semNada, 5 * G, 10.1 * G, 'sd'))
  })

  it('o pincel de areia: o último traço manda; o jogador recebe só o pedaço que alcança a beira que conhece, com a mesma conta', () => {
    const a = mar(rect(0, 10, 20, 20), {
      areia: [
        { modo: 'tirar', raio: 0.75 * G, pontos: [P(2, 10), P(8, 10)] },
        { modo: 'por', raio: 0.75 * G, pontos: [P(7, 10), P(9, 10)] },
        { modo: 'tirar', raio: 0.5 * G, pontos: [P(17, 10), P(18, 10)] },
      ],
    })
    const xy = curvaGuardada(a, G)
    const sa = semAreiaDaBeira(xy, a.areia, G)
    const em = (x: number): number => {
      for (let i = 0; i < xy.length; i += 2) if (xy[i + 1] === 10 * G && Math.abs(xy[i] - x * G) < 4) return sa?.[i / 2] ?? 0
      return Number.NaN
    }
    expect([em(4), em(8), em(12)]).toEqual([1, 0, 0])
    expect(semAreiaDaBeira(xy, undefined, G)).toBeNull()
    // O jogador conhece a beira até x = 12 casas: o traço de 17 a 18 não vai; os outros, sim.
    const conhecida = [xy.filter((_, i) => i % 2 === 0 ? xy[i] <= 12 * G && xy[i + 1] === 10 * G : xy[i - 1] <= 12 * G && xy[i] === 10 * G)]
    const doJogador = areiaParaJogador(a.areia, conhecida, G)
    expect(doJogador?.map((t) => t.modo)).toEqual(['tirar', 'por'])
    const noJogador = semAreiaDaBeira(conhecida[0], doJogador, G)
    const noMestre = semAreiaDaBeira(conhecida[0], a.areia, G)
    expect(noJogador).toEqual(noMestre)
  })
})

describe('névoa: a sala secreta por cima do mar', () => {
  const POSSE: Record<string, string[]> = { ana: ['ryoko'] }
  // A ficha no mar (fora do Chão ela não vê nada): a beira e o píer ficam na visão dela.
  const ficha: Token = { id: 'ryoko', characterId: null, name: 'Ryoko', x: 6 * G, y: 11 * G, size: 1, image: null }

  /** Mar na metade de baixo, com areia tirada junto do píer; o píer S é sala secreta fechada que entra no mar. */
  function cena(comSala: boolean): MapData {
    const pts = rect(9.5, 7, 10.5, 14)
    const s = sala('S', pts, { secret: true })
    const walls = pts.map((p, i): Wall => {
      const q = pts[(i + 1) % pts.length]
      return { id: `sw${i}`, x1: p.x, y1: p.y, x2: q.x, y2: q.y, blocksLight: true, blocksMove: true, door: null, regionId: 'S', regionEdgeIndex: i }
    })
    const a = mar(rect(0, 10, 20, 20), { areia: [{ modo: 'tirar', raio: 0.75 * G, pontos: [P(3, 10), P(8, 10)] }] })
    return { ...createEmptyMap('m', 'M', 20, 20, G), regions: comSala ? [s] : [], walls: comSala ? walls : [], aguas: [a], tokens: [ficha] }
  }

  /** O campo como a tela do jogador o monta (`PlayerView`): só do mapa que ele recebe. */
  function campoDoJogador(m: MapData): CampoComposto | null {
    const entorno = entornoDaAgua({ largura: m.width * m.grid, altura: m.height * m.grid, regioes: m.regions, ocultas: m.hiddenLayers, chao: [], props: m.props })
    return campoDasAguas(m.aguas ?? [], m.grid, entorno)
  }

  it('igual com e sem a sala secreta: nem buraco, nem margem tirada, nem areia diferente', () => {
    const comSala = filterMapForPlayer(cena(true), 'ana', POSSE, 10 * G).map
    const semSala = filterMapForPlayer(cena(false), 'ana', POSSE, 10 * G).map
    expect(comSala.regions.some((r) => r.id === 'S'), 'premissa: a sala não chega a ele').toBe(false)
    expect(comSala.aguas?.[0]?.areia?.length, 'a areia tirada chega (não é segredo)').toBe(1)
    const c = campoDoJogador(comSala)
    const s = campoDoJogador(semSala)
    expect(c).not.toBeNull()
    expect(c?.f1).toEqual(s?.f1)
    expect(c?.f4).toEqual(s?.f4)
    // Controle: no mestre a mesma sala abre buraco.
    const doMestre = cena(true)
    const mestre = campoDasAguas(doMestre.aguas ?? [], G, entornoDaAgua({ largura: 20 * G, altura: 20 * G, regioes: doMestre.regions, ocultas: [], chao: [], props: [] }))
    expect(noPonto(mestre, 10 * G, 12 * G, 'buraco')).toBe(255)
  })
})
