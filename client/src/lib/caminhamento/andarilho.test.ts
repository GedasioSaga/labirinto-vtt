/**
 * ANDARILHO — o anti-trava: todo trecho termina em CHEGOU ou em DESISTIU com
 * o motivo, nunca em espera sem fim; e no caminho não cruza parede, não
 * encosta em ficha, abre a porta diante de si e a fecha atrás.
 */
import { describe, expect, it } from 'vitest'
import type { Point } from '../../pixi/world'
import type { Wall } from '../../types/map'
import { fecharAoSair, novoAndarilho, tiqueDoAndarilho } from './andarilho'
import type { ResultadoDoCaminho } from './busca'
import { GRID, mapa, parede, paredeComVao, porta } from './caminho.fixture'
import { montarMalha } from './marcos'
import { passoDaRotina, type Trecho, simularTrecho } from './simulacao.fixture'

const R1 = GRID / 2
const corredorEstreito = [parede('n', 0, 256, 960, 256), parede('s', 0, 320, 960, 320)]

function trecho(walls: Wall[], de: Point, para: Point, extra: Partial<Trecho> = {}): Trecho {
  return { mapa: mapa(walls), de, para, raio: R1, maxTiques: 400, ...extra }
}

describe('andarilho: termina sempre, com motivo', () => {
  it('corredor com NPC parado e sem outra volta: desiste, ocupado, dizendo quem', () => {
    const r = simularTrecho(trecho(corredorEstreito, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: () => [{ id: 't', x: 480, y: 288, raio: R1 }] }))
    expect(r.fim).toEqual({ tipo: 'desistiu', motivo: 'ocupado', portas: [], fichas: ['t'] })
    expect(r.tiques).toBeLessThanOrEqual(60)
    expect(r.violacoes).toEqual([])
  })

  it('corredor com NPC parado e outra volta: vai pela volta e chega', () => {
    // Parede em x=480 com um vão de uma casa (y 256..320), onde está a ficha, e a passagem de baixo livre.
    const walls = [parede('cima', 480, 0, 480, 256), parede('meio', 480, 320, 480, 576)]
    const r = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: () => [{ id: 't', x: 480, y: 288, raio: R1 }] }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.violacoes).toEqual([])
  })

  it('porta trancada sem outra volta: desiste, porta trancada, com a porta', () => {
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta({ locked: true }) }), { x: 224, y: 96 }, { x: 608, y: 96 }))
    expect(r.fim).toEqual({ tipo: 'desistiu', motivo: 'porta-trancada', portas: ['vao'], fichas: [] })
    expect(r.tiques).toBeLessThanOrEqual(20)
  })

  it('o mestre destranca enquanto ele espera: segue, abre, passa, fecha e chega', () => {
    const destrancar = (tique: number, paredes: readonly Wall[]) =>
      tique === 4 ? paredes.map((w) => (w.door !== null ? { ...w, door: { ...w.door, locked: false } } : w)) : null
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta({ locked: true }) }), { x: 224, y: 96 }, { x: 608, y: 96 }, { aoTique: destrancar }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.acoes.map((a) => a.acao)).toEqual([
      { tipo: 'abrir', wallId: 'vao' },
      { tipo: 'fechar', wallId: 'vao' },
    ])
    expect(r.deixouAbertas).toEqual([])
    expect(r.violacoes).toEqual([])
  })

  it('porta fechada: abre diante dela, passa, fecha atrás de si', () => {
    const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta() }), { x: 224, y: 96 }, { x: 608, y: 96 }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    const [abrir, fechar] = r.acoes
    expect(abrir?.acao).toEqual({ tipo: 'abrir', wallId: 'vao' })
    expect(fechar?.acao).toEqual({ tipo: 'fechar', wallId: 'vao' })
    expect((fechar?.tique ?? 0) - (abrir?.tique ?? 0)).toBeGreaterThan(0)
    expect(r.paredes.find((w) => w.id === 'vao')?.door?.open).toBe(false)
    expect(r.violacoes).toEqual([])
  })

  it('preso no canto (nicho) por uma ficha na saída: desiste, ocupado', () => {
    // Nicho de uma casa de largura em x 0..64, y 0..256, aberto embaixo; a ficha fica na boca.
    const walls = [parede('nicho', 64, 0, 64, 256)]
    const r = simularTrecho(trecho(walls, { x: 32, y: 96 }, { x: 480, y: 480 }, { fichas: () => [{ id: 'boca', x: 32, y: 288, raio: R1 }] }))
    expect(r.fim).toMatchObject({ tipo: 'desistiu', motivo: 'ocupado', fichas: ['boca'] })
    expect(r.violacoes).toEqual([])
  })

  it('quina em L: dobra a quina sem travar nem raspar', () => {
    const walls = [parede('v', 384, 128, 384, 320), parede('h', 384, 320, 576, 320)]
    const r = simularTrecho(trecho(walls, { x: 352, y: 352 }, { x: 416, y: 288 }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.violacoes).toEqual([])
  })

  it('sala fechada: desiste, sem caminho', () => {
    const walls = [parede('n', 256, 128, 576, 128), parede('s', 256, 448, 576, 448), parede('o', 256, 128, 256, 448), parede('l', 576, 128, 576, 448)]
    const r = simularTrecho(trecho(walls, { x: 96, y: 96 }, { x: 416, y: 288 }))
    expect(r.fim).toMatchObject({ tipo: 'desistiu', motivo: 'sem-caminho' })
    expect(r.tiques).toBeLessThanOrEqual(20)
  })
})

describe('andarilho: desvio das fichas', () => {
  it('ficha que aparece na frente no meio do caminho: replaneja, contorna, chega', () => {
    const intruso = (tique: number) => (tique >= 5 ? [{ id: 'intruso', x: 608, y: 288, raio: R1 }] : [])
    const r = simularTrecho(trecho([], { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas: intruso }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.pedidos).toBeGreaterThanOrEqual(2)
    expect(r.violacoes).toEqual([])
  })

  it('ficha que se põe na frente de novo e de novo: termina mesmo assim, sem encostar', () => {
    const destino = { x: 864, y: 288 }
    const teimosa = (_tique: number, aqui: Point) => {
      const d = Math.hypot(destino.x - aqui.x, destino.y - aqui.y)
      if (d < 3 * GRID) return []
      const k = (2 * GRID) / d
      return [{ id: 'teimosa', x: aqui.x + (destino.x - aqui.x) * k, y: aqui.y + (destino.y - aqui.y) * k, raio: R1 }]
    }
    const r = simularTrecho(trecho(corredorEstreito, { x: 96, y: 288 }, destino, { fichas: teimosa, maxTiques: 600 }))
    expect(r.fim).not.toBeNull()
    expect(r.violacoes).toEqual([])
  })

  it('mesmo mundo, mesmo trecho: determinístico', () => {
    const fichas = () => [{ id: 't', x: 480, y: 288, raio: R1 }]
    const walls = [parede('cima', 480, 0, 480, 256), parede('meio', 480, 320, 480, 576)]
    const a = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas }))
    const b = simularTrecho(trecho(walls, { x: 96, y: 288 }, { x: 864, y: 288 }, { fichas }))
    expect([a.fim, a.tiques, a.acoes, a.primeira]).toEqual([b.fim, b.tiques, b.acoes, b.primeira])
  })
})

/** Diante da porta do vão (384, 256..320), do lado oeste: onde o NPC para para abri-la. */
const DIANTE_DA_PORTA = { x: 352, y: 288 }
/** Logo depois da porta: a ficha aqui fecha a passagem sem estar no vão. */
const DEPOIS_DA_PORTA = { x: 416, y: 288 }

/** Uma ficha que surge depois da porta no tique seguinte ao que o NPC parou diante dela, e fica `tiques` tiques (ou para sempre). */
function passanteDepoisDaPorta(tiques: number = Number.POSITIVE_INFINITY): { fichas: NonNullable<Trecho['fichas']>; surgiu: () => number | null } {
  let surgiu: number | null = null
  const fichas = (tique: number, aqui: Point) => {
    if (surgiu === null && aqui.x === DIANTE_DA_PORTA.x && aqui.y === DIANTE_DA_PORTA.y) surgiu = tique
    return surgiu !== null && tique < surgiu + tiques ? [{ id: 'passante', ...DEPOIS_DA_PORTA, raio: R1 }] : []
  }
  return { fichas, surgiu: () => surgiu }
}

describe('andarilho: porta que ele abriu e replanejou antes de cruzar', () => {
  it('replaneja e cruza a porta de novo: marca o canto depois dela e fecha ao passar', () => {
    const walls = paredeComVao(384, 256, 320, 10, { door: porta() })
    const passante = passanteDepoisDaPorta(3)
    const r = simularTrecho(trecho(walls, { x: 224, y: 96 }, { x: 608, y: 96 }, { fichas: passante.fichas }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    const surgiu = passante.surgiu()
    expect(surgiu).not.toBeNull()
    const [abrir, fechar, ...resto] = r.acoes
    expect(abrir?.acao).toEqual({ tipo: 'abrir', wallId: 'vao' })
    expect(fechar?.acao).toEqual({ tipo: 'fechar', wallId: 'vao' })
    expect(resto).toEqual([])
    // Abriu antes de o passante surgir; fechou depois de replanejar (o caminho novo, com a porta já aberta, não marca onde fechar).
    expect(abrir?.tique ?? Number.POSITIVE_INFINITY).toBeLessThan(surgiu ?? 0)
    expect(fechar?.tique ?? 0).toBeGreaterThan((surgiu ?? 0) + 3)
    // Fecha ao passar por ela, e não só na chegada (o último tique), de longe.
    expect(fechar?.tique ?? Number.POSITIVE_INFINITY).toBeLessThan(r.tiques - 1)
    expect(r.pedidos).toBeGreaterThanOrEqual(3)
    expect(r.deixouAbertas).toEqual([])
    expect(r.violacoes).toEqual([])
  })

  it('o caminho novo não cruza mais a porta: fecha assim que sai de perto, sem cruzar', () => {
    // A porta e, embaixo (y 576..640), uma volta mais comprida que o passante não fecha.
    const walls = [parede('cima', 384, 0, 384, 256), parede('vao', 384, 256, 384, 320, { door: porta() }), parede('baixo', 384, 320, 384, 576)]
    const passante = passanteDepoisDaPorta()
    const r = simularTrecho(trecho(walls, { x: 224, y: 96 }, { x: 608, y: 96 }, { fichas: passante.fichas }))
    expect(r.fim).toEqual({ tipo: 'chegou' })
    expect(r.acoes.map((a) => a.acao)).toEqual([
      { tipo: 'abrir', wallId: 'vao' },
      { tipo: 'fechar', wallId: 'vao' },
    ])
    const [abrir, fechar] = r.acoes
    expect((fechar?.tique ?? Number.POSITIVE_INFINITY) - (abrir?.tique ?? 0)).toBeLessThanOrEqual(3)
    expect(r.deixouAbertas).toEqual([])
    expect(r.violacoes).toEqual([])
  })

  it('o canto depois dela já fecha outra porta: ela fica nas abertas e fecha na chegada', () => {
    const walls = [...paredeComVao(384, 256, 320, 10, { door: porta({ open: true }) }), parede('outra', 576, 448, 640, 448, { door: porta({ open: true }) })]
    const destino = { x: 608, y: 96 }
    const malha = montarMalha(mapa(walls), R1)
    const mundo = { aqui: DIANTE_DA_PORTA, agora: 0, passo: passoDaRotina(GRID), malha, paredes: walls, fichas: [] }
    const esperando = { ...novoAndarilho(destino, DIANTE_DA_PORTA), aguardando: true, abertas: ['vao'] }
    const resposta: ResultadoDoCaminho = { tipo: 'caminho', pontos: [{ ...DIANTE_DA_PORTA }, { ...DEPOIS_DA_PORTA, fechar: 'outra' }, destino], comprimento: 0, portas: 0 }
    const { andarilho } = tiqueDoAndarilho(esperando, mundo, resposta)
    expect(andarilho.abertas).toEqual(['vao'])
    expect(andarilho.fechar).toEqual([])
    expect(andarilho.pontos?.[0]).toEqual({ ...DEPOIS_DA_PORTA, fechar: 'outra' })
    const chegada = tiqueDoAndarilho({ ...andarilho, pontos: [] }, { ...mundo, aqui: destino })
    expect(chegada.situacao).toBe('chegou')
    expect(chegada.acoes).toContainEqual({ tipo: 'fechar', wallId: 'vao' })
  })
})

describe('andarilho: ao sair da cena, fecha o que deixou aberto', () => {
  /** Quatro portas abertas em x 384, uma por faixa de 64 px; a última trancada. */
  const portas = [
    parede('fechar-livre', 384, 0, 384, 64, { door: porta({ open: true }) }),
    parede('aberta-sem-cruzar', 384, 128, 384, 192, { door: porta({ open: true }) }),
    parede('com-gente', 384, 256, 384, 320, { door: porta({ open: true }) }),
    parede('trancada', 384, 384, 384, 448, { door: porta({ open: true, locked: true }) }),
    parede('ja-fechada', 384, 512, 384, 576, { door: porta() }),
  ]
  const trecho = { ...novoAndarilho({ x: 0, y: 0 }, { x: 0, y: 0 }, ['fechar-livre', 'com-gente', 'trancada', 'ja-fechada', 'sumiu']), abertas: ['aberta-sem-cruzar', 'fechar-livre'] }

  it('fecha as que ia fechar e as que abriu sem cruzar, uma vez cada; com alguém no vão, trancada, já fechada ou que sumiu: nada', () => {
    const noVao = [{ id: 'heroi', x: 368, y: 288, raio: R1 }]
    expect(fecharAoSair(trecho, portas, noVao, GRID)).toEqual([
      { tipo: 'fechar', wallId: 'fechar-livre' },
      { tipo: 'fechar', wallId: 'aberta-sem-cruzar' },
    ])
  })

  it('ficha encostada no vão, sem estar nele: fecha; ninguém para fechar: nada', () => {
    // A ficha a um raio inteiro da porta só a toca (a tolerância do desenho).
    const encostada = [{ id: 'heroi', x: 384 - R1, y: 288, raio: R1 }]
    expect(fecharAoSair(trecho, portas, encostada, GRID).map((a) => a.wallId)).toEqual(['fechar-livre', 'com-gente', 'aberta-sem-cruzar'])
    expect(fecharAoSair(novoAndarilho({ x: 0, y: 0 }, { x: 0, y: 0 }), portas, [], GRID)).toEqual([])
  })
})

describe('andarilho: a resposta demora (vários tiques, ou pela agenda em fatias)', () => {
  const porta1 = paredeComVao(384, 256, 320, 10, { door: porta() })
  const de = { x: 224, y: 96 }
  const para = { x: 608, y: 96 }
  const modos: { nome: string; extra: Partial<Trecho> }[] = [
    { nome: 'resposta 3 tiques depois', extra: { atrasoDaResposta: 3 } },
    { nome: 'resposta 5 tiques depois', extra: { atrasoDaResposta: 5 } },
    { nome: 'pela agenda, malha e busca em fatias', extra: { pelaAgenda: { pontosPorFatia: 8, paredesPorFatia: 1, fatiasPorTique: 2 } } },
  ]

  for (const { nome, extra } of modos) {
    it(`${nome}: porta fechada, abre, passa, fecha e chega`, () => {
      const r = simularTrecho(trecho(porta1, de, para, extra))
      expect(r.fim).toEqual({ tipo: 'chegou' })
      expect(r.acoes.map((a) => a.acao)).toEqual([
        { tipo: 'abrir', wallId: 'vao' },
        { tipo: 'fechar', wallId: 'vao' },
      ])
      // Esperou a resposta parado, vários tiques seguidos.
      expect(r.situacoes.slice(0, 3)).toEqual(['planejando', 'planejando', 'planejando'])
      expect(r.deixouAbertas).toEqual([])
      expect(r.violacoes).toEqual([])
    })

    it(`${nome}: a porta fecha entre o pedido e a resposta, e ele a abre`, () => {
      const aberta = paredeComVao(384, 256, 320, 10, { door: porta({ open: true }) })
      const fechar = (tique: number, paredes: readonly Wall[]) => (tique === 1 ? paredes.map((w) => (w.door !== null ? { ...w, door: { ...w.door, open: false } } : w)) : null)
      const r = simularTrecho(trecho(aberta, de, para, { ...extra, aoTique: fechar }))
      expect(r.fim).toEqual({ tipo: 'chegou' })
      expect(r.acoes.map((a) => a.acao)).toEqual([
        { tipo: 'abrir', wallId: 'vao' },
        { tipo: 'fechar', wallId: 'vao' },
      ])
      expect(r.deixouAbertas).toEqual([])
      expect(r.violacoes).toEqual([])
    })

    it(`${nome}: ficha que aparece na frente, replaneja, contorna e chega`, () => {
      const intruso = (tique: number) => (tique >= 8 ? [{ id: 'intruso', x: 608, y: 288, raio: R1 }] : [])
      const r = simularTrecho(trecho([], { x: 96, y: 288 }, { x: 864, y: 288 }, { ...extra, fichas: intruso }))
      expect(r.fim).toEqual({ tipo: 'chegou' })
      expect(r.pedidos).toBeGreaterThanOrEqual(2)
      expect(r.violacoes).toEqual([])
    })

    it(`${nome}: o mestre destranca (a malha muda) enquanto ele espera: segue e chega`, () => {
      const destrancar = (tique: number, paredes: readonly Wall[]) =>
        tique === 12 ? paredes.map((w) => (w.door !== null ? { ...w, door: { ...w.door, locked: false } } : w)) : null
      const r = simularTrecho(trecho(paredeComVao(384, 256, 320, 10, { door: porta({ locked: true }) }), de, para, { ...extra, aoTique: destrancar }))
      expect(r.fim).toEqual({ tipo: 'chegou' })
      expect(r.acoes.map((a) => a.acao)).toEqual([
        { tipo: 'abrir', wallId: 'vao' },
        { tipo: 'fechar', wallId: 'vao' },
      ])
      expect(r.violacoes).toEqual([])
    })
  }
})
