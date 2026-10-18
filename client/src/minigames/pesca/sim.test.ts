import { describe, expect, it } from 'vitest'
import {
  cardapio,
  DIF,
  estrelas,
  faixa,
  forcaNoTempo,
  novaPuxada,
  passo,
  PEIXES,
  peixePorId,
  pesoDe,
  politicaFoge,
  politicaSegue,
  rngDe,
  simular,
  sortear,
} from './sim'
import type { DificuldadeSim, Peixe, Politica, Raridade } from './sim'

/**
 * Os números conferidos aqui são os de docs/design/minigame-pesca/provas/testes.json,
 * gerados do protótipo que o usuário aprovou jogando: bater exato prova que o porte
 * não mudou a conta.
 */

function peixe(id: string): Peixe {
  const p = peixePorId(id)
  if (!p) throw new Error(id)
  return p
}

interface Robo {
  taxa: number
  pegos: number
  perfeitas: number
  porPeixe: Record<string, number>
}

/**
 * Robô que joga como gente (regra de teste de jogos, 18/10/2026): reação 250 ± 60 ms com piso de
 * 120 ms, erro de leitura ± 0,03 da coluna, relê o peixe a cada 0,15 s e decide a 60 Hz. É o mesmo
 * de docs/design/minigame-pesca/provas/gerar-provas.cjs, com a mesma semente.
 */
function politicaHumana(semente: string): Politica {
  const r = rngDe('humano|' + semente)
  const gauss = (): number => {
    let u = 0
    while (u === 0) u = r()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r())
  }
  const reacao = (): number => Math.max(0.12, 0.25 + 0.06 * gauss())
  const visto: number[] = []
  let olhadaEm = -Infinity
  let atraso = 0.25
  let erro = 0
  let segura = false
  let n = 0
  return (e) => {
    visto.push(e.p.y)
    if (e.t - olhadaEm >= 0.15) {
      olhadaEm = e.t
      atraso = reacao()
      erro = 0.03 * gauss()
    }
    if (n++ % 2 === 0) {
      const y = visto[Math.max(0, visto.length - 1 - Math.round(atraso / DT_SIM))] + erro
      segura = y > e.b.y + e.b.tam / 2 + e.b.v * 0.12
    }
    return segura
  }
}
const DT_SIM = 1 / 120

function rodarRobo(dif: DificuldadeSim): Robo {
  const lista = cardapio(dif)
  const N = 240
  let pegos = 0
  let perfeitas = 0
  const tentou: Record<string, number> = {}
  const pegou: Record<string, number> = {}
  for (let i = 0; i < N; i++) {
    const p = lista[i % lista.length]
    const r = simular(dif, p.id, `robo|${dif}|${i}`, politicaHumana(`${dif}|${i}`))
    tentou[p.id] = (tentou[p.id] ?? 0) + 1
    if (r.fim === 'pegou') {
      pegos++
      pegou[p.id] = (pegou[p.id] ?? 0) + 1
      if (r.perfeito) perfeitas++
    }
  }
  const porPeixe: Record<string, number> = {}
  for (const id of Object.keys(tentou)) porPeixe[id] = Math.round(((pegou[id] ?? 0) / tentou[id]) * 100)
  return { taxa: pegos / N, pegos, perfeitas, porPeixe }
}

describe('semente', () => {
  it('mesma semente = mesma puxada, no Normal e no Extremo', () => {
    const a1 = simular('normal', 'carpa-runa', 'semente-a', politicaSegue(0.12))
    const a2 = simular('normal', 'carpa-runa', 'semente-a', politicaSegue(0.12))
    const x1 = simular('extremo', 'lampreia', 'semente-a', politicaSegue(0.12))
    const x2 = simular('extremo', 'lampreia', 'semente-a', politicaSegue(0.12))
    expect(a2).toEqual(a1)
    expect(x2).toEqual(x1)
  })

  it('outra semente = outra puxada', () => {
    const a = simular('normal', 'carpa-runa', 'semente-a', politicaSegue(0.12))
    const b = simular('normal', 'carpa-runa', 'semente-b', politicaSegue(0.12))
    expect(b.amostras).not.toEqual(a.amostras)
  })

  it('sorteio: mesma semente, mesmo peixe, tamanho, espera e beliscadas', () => {
    expect(sortear('extremo', 0.9, 'pino|extremo|3')).toEqual(sortear('extremo', 0.9, 'pino|extremo|3'))
  })
})

describe('robô que joga como gente, 240 puxadas', () => {
  const normal = rodarRobo('normal')
  const extremo = rodarRobo('extremo')

  it('Normal: pega >= 70%', () => {
    expect(normal.taxa).toBeGreaterThanOrEqual(0.7)
  })

  it('Extremo: pega entre 15% e 40%', () => {
    expect(extremo.taxa).toBeGreaterThanOrEqual(0.15)
    expect(extremo.taxa).toBeLessThanOrEqual(0.4)
  })

  it('bate exato com o protótipo (medidor do Extremo 50% e −22%/s): 100% e 35 perfeitas no Normal, 28,3% no Extremo', () => {
    expect(normal.pegos).toBe(240)
    expect(normal.perfeitas).toBe(35)
    expect(extremo.pegos).toBe(68)
    expect(extremo.porPeixe).toEqual({
      'carpa-runa': 96, enguia: 0, lume: 17, piaba: 8, bagre: 13,
      truta: 79, linguado: 38, lampreia: 0, esturjao: 8, coroa: 25,
    })
  })
})

describe('sorteio pelo lance', () => {
  it('6.000 sorteios do Normal: nenhum raro nem lendário', () => {
    let fora = 0
    for (let i = 0; i < 6000; i++) {
      const s = sortear('normal', i / 6000, 'n' + i)
      if (s.peixe.rar === 'raro' || s.peixe.rar === 'lendario' || s.peixe.onde !== 'ambos') fora++
    }
    expect(fora).toBe(0)
  })

  it('lendário nunca sai com lance <= 0,6', () => {
    let lendario = 0
    for (let i = 0; i < 6000; i++) if (sortear('extremo', (i % 61) / 100, 'p' + i).peixe.rar === 'lendario') lendario++
    expect(lendario).toBe(0)
    expect(pesoDe(peixe('coroa'), 0.6)).toBe(0)
  })

  it('no Extremo longe saem raros e o lendário, nas contagens do protótipo', () => {
    const conta: Partial<Record<Raridade, number>> = {}
    for (let i = 0; i < 6000; i++) {
      const r = sortear('extremo', 0.8 + (i % 21) / 100, 'x' + i).peixe.rar
      conta[r] = (conta[r] ?? 0) + 1
    }
    expect(conta).toEqual({ comum: 3070, incomum: 1536, raro: 1227, lendario: 167 })
  })

  it('beliscadas dentro do limite da dificuldade e em ordem', () => {
    const difs: DificuldadeSim[] = ['normal', 'extremo']
    for (let i = 0; i < 500; i++) {
      for (const dif of difs) {
        const s = sortear(dif, (i % 11) / 10, `b${i}`)
        expect(s.beliscadas.length).toBeLessThanOrEqual(DIF[dif].beliscadas)
        expect([...s.beliscadas].sort((a, b) => a - b)).toEqual(s.beliscadas)
        expect(s.cm).toBeGreaterThanOrEqual(s.peixe.cm[0])
        expect(s.cm).toBeLessThanOrEqual(s.peixe.cm[1])
      }
    }
  })
})

describe('medidor', () => {
  it('zerado = escapou (robô que foge), no mesmo instante do protótipo', () => {
    const r = simular('normal', 'carpa-runa', 'foge', politicaFoge())
    expect(r.fim).toBe('escapou')
    expect(r.amostras[r.amostras.length - 1][4]).toBe(0)
    expect(+r.t.toFixed(2)).toBe(3.38)
  })

  it('cheio = pegou', () => {
    const e = novaPuxada('normal', peixe('carpa-runa'), 'cheio')
    e.m = 0.9999
    expect(passo(e, false)).toBe('pegou')
    expect(e.m).toBe(1)
    expect(passo(e, true)).toBe('pegou')
  })

  it('puxada sem baú (o campo opcional ausente) também anda e termina', () => {
    let semente = ''
    for (let i = 0; i < 50 && !semente; i++) if (novaPuxada('normal', peixe('enguia'), `s${i}`).bau === null) semente = `s${i}`
    expect(semente).not.toBe('')
    const r = simular('normal', 'enguia', semente, politicaSegue(0.12))
    expect(r.bau).toBeNull()
    expect(r.fim).not.toBe('tempo')
  })
})

describe('auxiliares', () => {
  it('força vai e volta no ciclo, faixas e estrelas', () => {
    expect(forcaNoTempo(0.7, 1.4)).toBeCloseTo(0.5, 12)
    expect(forcaNoTempo(2.1, 1.4)).toBeCloseTo(0.5, 12)
    expect([0.39, 0.4, 0.79, 0.8].map(faixa)).toEqual(['perto', 'medio', 'medio', 'longe'])
    expect(estrelas(0.1, false)).toBe(1)
    expect(estrelas(0.85, true)).toBe(4)
  })

  it('cardápio: 6 no Normal, 10 no Extremo', () => {
    expect(cardapio('normal')).toHaveLength(6)
    expect(cardapio('extremo')).toHaveLength(PEIXES.length)
  })
})
