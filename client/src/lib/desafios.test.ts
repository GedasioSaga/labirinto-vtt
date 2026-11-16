/**
 * DESAFIOS (minigames fora do pino, 15/11/2026): o pino ▷ de minigame de mapa
 * antigo vira desafio ao abrir, o desafio sobrevive a salvar e reabrir, e o
 * jogador recebe só o selo (o jogo e como ele começa), nunca o desafio.
 */
import { describe, expect, it } from 'vitest'
import type { Desafio, MapData, Pin, Prop, Token } from '../types/map'
import { ehJogoDoRegistro, padraoDoJogo } from '../minigames/registro'
import { comPinosDeMinigameComoDesafios, desafiosDo, novoDesafio, pinosDosDesafios } from './desafios'
import { emptyPlanMemory, filterMapForPlayer, planOfWholeMap } from './fogFilter'
import { buildPin, createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'

function ficha(id: string, x: number, y: number): Token {
  return { id, characterId: null, name: `nome-${id}`, x, y, size: 1, image: null }
}

function pinoDeJogo(id: string, x: number, y: number, extra: Partial<Pin> = {}): Pin {
  return { ...buildPin(id, { x, y }, 'minigame'), id, ...extra }
}

const BASE: MapData = createEmptyMap('m', 'M', 1000, 1000, 40)

describe('desafios — o mapa antigo abre com os pinos ▷ virados desafios', () => {
  const antigo: MapData = {
    ...BASE,
    pins: [
      pinoDeJogo('lago', 200, 200, { nome: 'Lago do Velho', minigame: padraoDoJogo('pesca') }),
      // Pino de dança sem desafio gravado: joga a dança padrão, como antes.
      pinoDeJogo('salao', 300, 240, { portaLigada: 'porta-1' }),
      { ...buildPin('banco', { x: 100, y: 100 }, 'exclamacao'), id: 'banco' },
    ],
  }
  const aberto = deserializeMap(serializeMap(antigo))

  it('o pino de minigame sai de pins e entra em desafios, com o mesmo id e no mesmo ponto', () => {
    expect(aberto.pins.map((p) => p.id)).toEqual(['banco'])
    expect(desafiosDo(aberto).map((d) => d.id)).toEqual(['lago', 'salao'])
    const [lago, salao] = desafiosDo(aberto)
    expect(lago.lugar).toEqual({ tipo: 'ponto', x: 200, y: 200 })
    expect(lago.minigame.jogo).toBe('pesca')
    expect(lago.nome).toBe('Lago do Velho')
    expect(lago.eraPino?.id).toBe('lago')
    expect(salao.minigame.jogo).toBe('danca')
    expect(salao.portaLigada).toBe('porta-1')
    expect(salao.nome.length).toBeGreaterThan(0)
  })

  it('salvar e reabrir mantém os desafios, sem duplicar nem voltar a ser pino', () => {
    const deNovo = deserializeMap(serializeMap(aberto))
    expect(deNovo.pins).toEqual(aberto.pins)
    expect(deNovo.desafios).toEqual(aberto.desafios)
  })

  it('o mestre vê um selo por desafio com lugar, com o nome do desafio', () => {
    const selos = pinosDosDesafios(aberto, 'mestre')
    expect(selos.map((p) => [p.id, p.kind, p.x, p.y])).toEqual([
      ['lago', 'minigame', 200, 200],
      ['salao', 'minigame', 300, 240],
    ])
    expect(selos[0].nome).toBe('Lago do Velho')
  })
})

describe('desafios — tudo opcional ausente', () => {
  const solto: Desafio = novoDesafio('d1', 'tiro')

  it('desafio sem lugar, sem porta, sem piso e sem pino de antes passa por salvar e reabrir', () => {
    const lido = deserializeMap(serializeMap({ ...BASE, desafios: [solto] }))
    expect(lido.desafios).toEqual([solto])
    expect(pinosDosDesafios(lido, 'mestre')).toEqual([])
    expect(pinosDosDesafios(lido, 'mesa')).toEqual([])
  })

  it('mapa sem desafios nem pinos de minigame não ganha nada', () => {
    expect(desafiosDo(comPinosDeMinigameComoDesafios(BASE))).toEqual([])
    expect(pinosDosDesafios(BASE, 'mesa')).toEqual([])
    expect(desafiosDo(deserializeMap(serializeMap(BASE)))).toEqual([])
  })

  it('lixo no arquivo não vira desafio torto', () => {
    const torto = JSON.stringify({ ...BASE, desafios: [{ id: 3 }, null, 'x', { id: 'y', nome: 'ok', lugar: { tipo: 'voo' }, minigame: { jogo: 'xadrez' } }] })
    const lidos = desafiosDo(deserializeMap(torto))
    expect(lidos.some((d) => d.id === '3')).toBe(false)
    expect(lidos.every((d) => typeof d.id === 'string' && ehJogoDoRegistro(d.minigame.jogo) && ['ponto', 'objeto', 'nenhum'].includes(d.lugar.tipo))).toBe(true)
  })
})

describe('desafios — o recorte do jogador', () => {
  const mapa: MapData = {
    ...BASE,
    tokens: [ficha('heroi', 180, 200)],
    desafios: [{ ...novoDesafio('d-pesca', 'pesca', { tipo: 'ponto', x: 200, y: 200 }), nome: 'Lago secreto do mestre', portaLigada: 'porta-cofre-9f3a' }],
  }
  const out = filterMapForPlayer(mapa, 'p1', { p1: ['heroi'] }, 700)

  it('o jogador não recebe a lista de desafios, só o selo como pino de minigame', () => {
    expect(out.map.desafios).toBeUndefined()
    const selo = out.map.pins.find((p) => p.id === 'd-pesca')
    expect(selo?.kind).toBe('minigame')
    expect(selo?.minigameVisivel).toEqual({ jogo: 'pesca', entrada: padraoDoJogo('pesca').entrada })
    expect(selo !== undefined && 'minigame' in selo).toBe(false)
  })

  it('SEGURANÇA: nome do mestre, porta ligada e desafio não vão no pacote', () => {
    const texto = JSON.stringify(out)
    for (const segredo of ['Lago secreto do mestre', 'porta-cofre-9f3a', '"desafios"', '"lugar"']) expect(texto, segredo).not.toContain(segredo)
  })
})

/**
 * MEMÓRIA DA PLANTA (auditoria de 16/11/2026, bloqueante): numa sessão de
 * verdade o host guarda a planta de cada jogador, e o selo do desafio nunca
 * entrava nela — o recorte com memória o jogava fora, e o jogador não tocava
 * no selo da pesca. O selo tem de passar pela memória como o pino ▷ de antes.
 */
describe('desafios — o recorte com a memória da planta', () => {
  const PERTO = ficha('heroi', 180, 200)
  const LONGE = ficha('heroi', 20000, 20000)
  const POSSE = { p1: ['heroi'] }
  const RAIO = 700
  const pesca = (lugar: Desafio['lugar']): Desafio => ({ ...novoDesafio('d-pesca', 'pesca', lugar), minigame: { ...padraoDoJogo('pesca'), entrada: 'pino' } })
  const cena = (desafio: Desafio, extra: Partial<MapData> = {}): MapData => ({ ...BASE, tokens: [PERTO], desafios: [desafio], ...extra })
  const seloDe = (view: ReturnType<typeof filterMapForPlayer>): Pin | undefined => view.map.pins.find((p) => p.id === 'd-pesca')
  const comMemoria = (map: MapData, plano: ReturnType<typeof emptyPlanMemory>) =>
    filterMapForPlayer(map, 'p1', POSSE, RAIO, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, plano)

  it('o selo à vista chega e entra na planta; longe, chega lembrado', () => {
    const mapa = cena(pesca({ tipo: 'ponto', x: 200, y: 200 }))
    const visto = comMemoria(mapa, emptyPlanMemory())
    expect(seloDe(visto)?.minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'pino' })
    expect(visto.plan.pins.has('d-pesca')).toBe(true)
    const lembrado = comMemoria({ ...mapa, tokens: [LONGE] }, visto.plan)
    expect(seloDe(lembrado)?.kind).toBe('minigame')
  })

  it('"Revelar planta" (planOfWholeMap) leva o selo, como levava o pino ▷', () => {
    const mapa = cena(pesca({ tipo: 'ponto', x: 200, y: 200 }), { tokens: [LONGE] })
    const plano = planOfWholeMap(mapa)
    expect(plano.pins.has('d-pesca')).toBe(true)
    expect(seloDe(comMemoria(mapa, plano))?.minigameVisivel).toEqual({ jogo: 'pesca', entrada: 'pino' })
  })

  it('SEGURANÇA: o selo num objeto escondido não chega, nem lembrado, nem pela planta revelada', () => {
    const bau: Prop = { id: 'bau', src: '', x: 200, y: 200, width: 40, height: 40, linkedMapPath: null }
    const mapa = cena(pesca({ tipo: 'objeto', propId: 'bau' }), { props: [bau] })
    const visto = comMemoria(mapa, emptyPlanMemory())
    expect(seloDe(visto), 'controle: o objeto à vista leva o selo').toBeDefined()
    const escondido = { ...mapa, props: [{ ...bau, hidden: true }] }
    const depois = comMemoria(escondido, visto.plan)
    expect(seloDe(depois)).toBeUndefined()
    expect(depois.plan.pins.has('d-pesca')).toBe(false)
    expect(seloDe(comMemoria({ ...escondido, tokens: [LONGE] }, planOfWholeMap(escondido)))).toBeUndefined()
  })

  it('mapa sem desafio nem pino: a planta não ganha nada', () => {
    expect(planOfWholeMap({ ...BASE, tokens: [LONGE] }).pins.size).toBe(0)
    expect(comMemoria({ ...BASE, tokens: [PERTO] }, emptyPlanMemory()).map.pins).toEqual([])
  })
})
