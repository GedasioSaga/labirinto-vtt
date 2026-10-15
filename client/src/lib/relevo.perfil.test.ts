/**
 * PERFIL DO PENHASCO (pedido de 15/10/2026: "suavizar a altura da parede"): a
 * altura da parede ao longo da costa, uma por amostra, sem degrau seco.
 *
 * Decisões do usuário que este arquivo prova:
 * 1. rampa média: cada px de altura pede `AJUSTE_DO_PENHASCO.rampa` px de costa
 *    na horizontal (Grande↔Médio e Médio→0 em ~6 células, Pequeno→0 em ~3);
 * 2. a rampa da ponta fica DENTRO do risco (a parede nunca aparece onde não foi
 *    riscada; risco curto vira um morrinho baixo);
 * 3. na emenda, o lado mais BAIXO fica inteiro e o mais alto desce até ele;
 * 4. só a ponta ABERTA (a costa segue sem penhasco e a parede estaria à vista,
 *    como a praia) desce a 0; ponta de ilha, divisa de região e corte da névoa
 *    ficam como hoje (neutros);
 * 5. mapa antigo: o meio uniforme continua 9 / 18 / 36 exatos.
 */
import { describe, expect, it } from 'vitest'
import type { Region, RegionPoint, TracoDePenhasco } from '../types/map'
import { createExploration, markRings } from './exploration'
import { penhascosParaJogador } from './penhasco'
import { AJUSTE_DO_PENHASCO, alturaDaParede, perfilDoPenhasco, planoDoRelevo, type ConhecidoDoRelevo, type PerfilDoPenhasco, type PlanoDoRelevo } from './relevo'

/** 1 px do protótipo = 10 px de mundo. */
const MAPA = { width: 1242, height: 1242, grid: 10 }
const UNIDADE = 10
const TETO = 276
const K = AJUSTE_DO_PENHASCO.rampa
const MEDIA = AJUSTE_DO_PENHASCO.altura
const ALTA = alturaDaParede({ altura: 'alto' })
const BAIXA = alturaDaParede({ altura: 'baixo' })
const EPS = 1e-9

function retangulo(x0: number, y0: number, x1: number, y1: number): RegionPoint[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ]
}

function regiao(id: string, points: RegionPoint[]): Region {
  return { id, points, tag: 'region', fillColor: '#76c577', fillPattern: 'solid', data: {} }
}

/** Risco reto de `a` até `b`, com um ponto a cada 10 px de mundo. */
function risco(id: string, a: RegionPoint, b: RegionPoint, extra: Partial<TracoDePenhasco> = {}): TracoDePenhasco {
  const passos = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 10))
  const pontos = Array.from({ length: passos + 1 }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / passos, y: a.y + ((b.y - a.y) * k) / passos }))
  return { id, modo: 'riscar', raio: 40, pontos, ...extra }
}

function naCosta(id: string, de: number, ate: number, extra: Partial<TracoDePenhasco> = {}): TracoDePenhasco {
  return risco(id, { x: de, y: 1000 }, { x: ate, y: 1000 }, extra)
}

function plano(regioes: Region[], riscos: TracoDePenhasco[], conhecido?: ConhecidoDoRelevo): PlanoDoRelevo {
  const p = planoDoRelevo(MAPA, regioes, [], TETO, riscos)
  if (p === null) throw new Error('sem terra')
  return conhecido === undefined ? p : { ...p, conhecido }
}

interface Amostra {
  x: number
  y: number
  h: number
}

/** As amostras do perfil sobre a reta `y = y0 + (x - x0) * inclinacao` (a costa de baixo), da esquerda para a direita. */
function naReta(perfil: PerfilDoPenhasco, x0: number, y0: number, inclinacao = 0): Amostra[] {
  const fora = Math.hypot(1, inclinacao)
  const amostras: Amostra[] = []
  for (const c of perfil.cadeias) {
    for (let i = 0; i < c.x.length; i += 1) {
      if (Math.abs(c.y[i] - (y0 + (c.x[i] - x0) * inclinacao)) / fora < 0.5) amostras.push({ x: c.x[i], y: c.y[i], h: c.altura[i] })
    }
  }
  return amostras.sort((a, b) => a.x - b.x)
}

/** A altura da amostra mais perto de `x` na reta. */
function alturaEm(amostras: readonly Amostra[], x: number): number {
  let melhor = amostras[0]
  for (const a of amostras) if (Math.abs(a.x - x) < Math.abs(melhor.x - x)) melhor = a
  return melhor.h
}

/** Entre duas amostras vizinhas a altura muda no máximo o deslocamento horizontal ÷ rampa. */
function esperarInclinacaoContida(amostras: readonly Amostra[]): void {
  for (let i = 1; i < amostras.length; i += 1) {
    const dh = Math.abs(amostras[i].h - amostras[i - 1].h)
    const dx = Math.abs(amostras[i].x - amostras[i - 1].x) / UNIDADE
    expect(dh, `x = ${amostras[i].x}`).toBeLessThanOrEqual(dx / K + EPS)
  }
}

const TERRA = regiao('t', retangulo(0, 0, 4000, 1000))

describe('perfilDoPenhasco: o meio uniforme e a ponta aberta', () => {
  const amostras = naReta(perfilDoPenhasco(plano([TERRA], [naCosta('m', 1000, 3000)])), 0, 1000)

  it('o meio do risco Médio desce exatos 18 px do protótipo', () => {
    expect(alturaEm(amostras, 2000)).toBe(MEDIA)
  })

  it('a ponta aberta começa em ~0 dentro do risco e sobe até 18 em no máximo 18 × rampa px', () => {
    // A praia antes do risco (e o pincel acaba em 960): sem parede.
    expect(alturaEm(amostras, 900)).toBe(0)
    const inicio = amostras.filter((a) => a.x >= 960 && a.x <= 1000)
    expect(Math.min(...inicio.map((a) => a.h))).toBeLessThanOrEqual(40 / UNIDADE / K + EPS)
    // 18 × rampa px do protótipo depois da beira do pincel, e um passo de amostra de folga.
    expect(alturaEm(amostras, 960 + MEDIA * K * UNIDADE + 40)).toBe(MEDIA)
    const rampa = amostras.filter((a) => a.x >= 900 && a.x <= 1400)
    for (let i = 1; i < rampa.length; i += 1) expect(rampa[i].h).toBeGreaterThanOrEqual(rampa[i - 1].h)
    // A outra ponta, espelhada.
    expect(alturaEm(amostras, 3100)).toBe(0)
    expect(alturaEm(amostras, 3040 - MEDIA * K * UNIDADE - 40)).toBe(MEDIA)
  })

  it('a altura nunca muda mais que o deslocamento horizontal ÷ rampa', () => {
    esperarInclinacaoContida(amostras)
  })

  it('o Pequeno chega a 9 e desce a 0 em metade da distância do Médio', () => {
    const baixo = naReta(perfilDoPenhasco(plano([TERRA], [naCosta('b', 1000, 3000, { altura: 'baixo' })])), 0, 1000)
    expect(alturaEm(baixo, 2000)).toBe(BAIXA)
    expect(alturaEm(baixo, 960 + BAIXA * K * UNIDADE + 40)).toBe(BAIXA)
    expect(alturaEm(baixo, 900)).toBe(0)
  })

  it('risco mais curto que duas rampas vira um morrinho baixo, sem passar da altura dele', () => {
    const curto = naReta(perfilDoPenhasco(plano([TERRA], [naCosta('c', 2000, 2200)])), 0, 1000)
    const maior = Math.max(...curto.map((a) => a.h))
    expect(maior).toBeGreaterThan(0)
    expect(maior).toBeLessThan(MEDIA)
    expect(alturaEm(curto, 1900)).toBe(0)
    expect(alturaEm(curto, 2300)).toBe(0)
  })
})

describe('perfilDoPenhasco: emenda Grande → Médio na costa reta e inclinada', () => {
  for (const graus of [0, 45, 70]) {
    it(`a ${graus} graus: o Médio fica inteiro, o Grande desce até ele sem degrau`, () => {
      const t = Math.tan((graus * Math.PI) / 180)
      const largura = 3000
      // Terra acima da costa de baixo, que vai de (0, 1000) a (3000, 1000 + 3000 × tan).
      const terra = regiao('i', [
        { x: 0, y: 0 },
        { x: largura, y: 0 },
        { x: largura, y: 1000 + largura * t },
        { x: 0, y: 1000 },
      ])
      const ponto = (x: number) => ({ x, y: 1000 + x * t })
      const grande = risco('g', ponto(300), ponto(1500), { altura: 'alto' })
      const medio = risco('m', ponto(1500), ponto(2700))
      const amostras = naReta(perfilDoPenhasco(plano([terra], [grande, medio])), 0, 1000, t).filter((a) => a.x > 50 && a.x < largura - 50)
      // O pincel tem raio 40 medido na reta: na horizontal, 40 × cos.
      const raioX = 40 / Math.hypot(1, t)
      const emenda = 1500 - raioX
      // Do Grande já inteiro (a ponta de lá sobe até 36 em 720 px) ao meio do Médio, a parede só desce.
      const atravessa = amostras.filter((a) => a.x >= 1030 && a.x <= 2000)
      for (let i = 1; i < atravessa.length; i += 1) expect(atravessa[i].h, `x = ${atravessa[i].x}`).toBeLessThanOrEqual(atravessa[i - 1].h + EPS)
      // O lado Médio (depois da emenda, longe da ponta de lá) fica 18 exatos.
      for (const a of amostras.filter((s) => s.x >= emenda && s.x <= 2700 + raioX - MEDIA * K * UNIDADE - 40)) expect(a.h, `x = ${a.x}`).toBe(MEDIA)
      // O Grande chega a 36 antes de começar a descer.
      expect(alturaEm(amostras, emenda - (ALTA - MEDIA) * K * UNIDADE - 60)).toBe(ALTA)
      esperarInclinacaoContida(amostras)
    })
  }
})

describe('perfilDoPenhasco: borracha, divisa de região, ponta de ilha e névoa', () => {
  it('a borracha no meio faz duas rampas', () => {
    const amostras = naReta(perfilDoPenhasco(plano([TERRA], [naCosta('m', 500, 3500), naCosta('e', 2000, 2000, { modo: 'apagar', raio: 100 })])), 0, 1000)
    expect(alturaEm(amostras, 2000)).toBe(0)
    const antes = alturaEm(amostras, 1800)
    const depois = alturaEm(amostras, 2200)
    expect(antes).toBeGreaterThan(0)
    expect(antes).toBeLessThan(MEDIA)
    expect(depois).toBeGreaterThan(0)
    expect(depois).toBeLessThan(MEDIA)
    expect(alturaEm(amostras, 1900 - MEDIA * K * UNIDADE - 40)).toBe(MEDIA)
    expect(alturaEm(amostras, 2100 + MEDIA * K * UNIDADE + 40)).toBe(MEDIA)
    esperarInclinacaoContida(amostras)
  })

  it('a divisa entre duas regiões (encostadas, ou com fresta) não afunda a parede', () => {
    for (const fresta of [0, 5]) {
      const regioes = [regiao('a', retangulo(0, 0, 2000, 1000)), regiao('b', retangulo(2000 + fresta, 0, 4000, 1000))]
      const amostras = naReta(perfilDoPenhasco(plano(regioes, [naCosta('m', 500, 3500)])), 0, 1000)
      const meio = amostras.filter((a) => a.x >= 1000 && a.x <= 3000)
      expect(meio.length).toBeGreaterThan(10)
      expect(Math.min(...meio.map((a) => a.h)), `fresta ${fresta}`).toBe(MEDIA)
    }
  })

  it('ponta de ilha: o risco que cobre a costa de baixo inteira fica 18 até as quinas', () => {
    const ilha = regiao('ilha', retangulo(0, 0, 1000, 1000))
    const amostras = naReta(perfilDoPenhasco(plano([ilha], [naCosta('m', 0, 1000)])), 0, 1000).filter((a) => a.h > 0)
    expect(amostras.length).toBeGreaterThan(10)
    expect(Math.min(...amostras.map((a) => a.h))).toBe(MEDIA)
    expect(Math.min(...amostras.map((a) => a.x))).toBeLessThan(30)
    expect(Math.max(...amostras.map((a) => a.x))).toBeGreaterThan(970)
  })

  it('névoa: o corte do conhecido não afunda a parede, e o jogador vê a altura do mestre', () => {
    const riscos = [naCosta('m', 500, 3500)]
    const visao = retangulo(0, 900, 2000, 1500)
    const dentro = (p: RegionPoint) => p.x >= 0 && p.x <= 2000 && p.y >= 900 && p.y <= 1500
    const doJogador = penhascosParaJogador(riscos, dentro, () => false) ?? []
    const conhecido: ConhecidoDoRelevo = { visao: [visao] }
    const mestre = perfilDoPenhasco(plano([TERRA], riscos))
    const jogador = perfilDoPenhasco(plano([TERRA], doJogador, conhecido))
    const doMestre = naReta(mestre, 0, 1000)
    const vistas = naReta(jogador, 0, 1000)
    // Perto do corte, do lado conhecido, a parede segue inteira.
    expect(alturaEm(vistas, 1950)).toBe(MEDIA)
    // Do lado da névoa, nada se desenha.
    expect(alturaEm(vistas, 2300)).toBe(0)
    // Na costa conhecida, a mesma altura do mestre, amostra por amostra.
    const conhecidas = vistas.filter((a) => a.x < 1990)
    expect(conhecidas.length).toBeGreaterThan(10)
    for (const a of conhecidas) expect(a.h, `x = ${a.x}`).toBe(alturaEm(doMestre, a.x))
  })

  it('jogador que só explorou (sem visão agora): o explorado conta como conhecido, o resto não', () => {
    const riscos = [naCosta('m', 500, 3500)]
    const explorado = createExploration(MAPA)
    // A grade do explorado cobre só o retângulo do mapa (`createExploration`): aqui, até x = 1242.
    markRings(explorado, [retangulo(0, 600, 1000, 1400)])
    const vistas = naReta(perfilDoPenhasco(plano([TERRA], riscos, { visao: [], explorado })), 0, 1000)
    // Já inteira (a ponta de lá sobe até 18 em 360 px) e sem afundar perto do fim do explorado.
    expect(alturaEm(vistas, 900)).toBe(MEDIA)
    expect(alturaEm(vistas, 980)).toBe(MEDIA)
    expect(alturaEm(vistas, 1300)).toBe(0)
  })

  it('jogador cujo conhecido é só o mar até a beira (a Sala vista de fora): a costa conta como vista', () => {
    const riscos = [naCosta('m', 500, 3500)]
    const jogador = perfilDoPenhasco(plano([TERRA], riscos, { visao: [retangulo(0, 1002, 4000, 1500)] }))
    expect(alturaEm(naReta(jogador, 0, 1000), 2000)).toBe(MEDIA)
  })
})

describe('perfilDoPenhasco: mapa de antes da altura', () => {
  it('risco sem o campo dá o mesmo perfil do Médio explícito', () => {
    const sem = perfilDoPenhasco(plano([TERRA], [naCosta('m', 1000, 3000)]))
    const medio = perfilDoPenhasco(plano([TERRA], [naCosta('m', 1000, 3000, { altura: 'medio' })]))
    expect(sem.cadeias.map((c) => Array.from(c.altura))).toEqual(medio.cadeias.map((c) => Array.from(c.altura)))
    expect(sem.maisAlta).toBe(MEDIA)
  })

  it('o Alto no meio uniforme desce 36 exatos', () => {
    const alto = naReta(perfilDoPenhasco(plano([TERRA], [naCosta('a', 500, 3500, { altura: 'alto' })])), 0, 1000)
    expect(alturaEm(alto, 2000)).toBe(ALTA)
  })

  it('a costa de cima (a parede ficaria atrás da terra) não tem parede', () => {
    const cima = perfilDoPenhasco(plano([TERRA], [risco('c', { x: 1000, y: 0 }, { x: 3000, y: 0 })]))
    expect(cima.maisAlta).toBe(0)
  })
})
