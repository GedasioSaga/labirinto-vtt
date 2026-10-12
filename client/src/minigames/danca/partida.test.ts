import { describe, expect, it } from 'vitest'
import { gerarChart, gradeDemo } from './coreografia'
import {
  apertarTrilha,
  avancarPartida,
  encerrarPartida,
  fecharSeguradasNaPausa,
  notaAoVivoPassa,
  novaPartida,
  progressoDe,
  resultadoDaPartida,
  soltarTrilha,
  type EventoDaPartida,
  type PartidaDanca,
} from './partida'
import { DIF, novoPlacar, VIDA } from './regras'
import { DURACAO_DEMO } from './som'
import type { DificuldadeDanca, NotaDaDanca, TrilhaDanca } from './tipos'

const PINO = 'pino-porta-que-danca'
const QUADRO_S = 1 / 60

function partidaDaDemo(dif: DificuldadeDanca): PartidaDanca {
  return novaPartida(gerarChart(gradeDemo(), dif, PINO), dif, DURACAO_DEMO)
}

/**
 * Jogador perfeito, como no protótipo: aperta cada seta no primeiro quadro em
 * que ela chega (até 4 ms antes), segura a cauda até o fim e solta 60 ms depois
 * da seta comum.
 */
function tocarPerfeito(p: PartidaDanca): EventoDaPartida[] {
  const todos: EventoDaPartida[] = []
  const soltar: { lane: TrilhaDanca; t: number }[] = []
  let proxima = 0
  for (let st = 0; p.motivo === null && st < p.fimS + 1; st += QUADRO_S) {
    while (proxima < p.notas.length && p.notas[proxima].t - st <= 0.004) {
      const n = p.notas[proxima]
      todos.push(...apertarTrilha(p, n.lane, st))
      soltar.push({ lane: n.lane, t: n.len > 0 ? n.t + n.len + 0.03 : n.t + 0.06 })
      proxima += 1
    }
    for (let i = soltar.length - 1; i >= 0; i -= 1) {
      if (soltar[i].t > st) continue
      todos.push(...soltarTrilha(p, soltar[i].lane, st))
      soltar.splice(i, 1)
    }
    todos.push(...avancarPartida(p, st))
  }
  return todos
}

function semTocar(p: PartidaDanca): EventoDaPartida[] {
  const todos: EventoDaPartida[] = []
  for (let st = 0; p.motivo === null && st < p.fimS + 1; st += QUADRO_S) todos.push(...avancarPartida(p, st))
  return todos
}

describe('partida inteira na faixa demo', () => {
  it('Diversão tocada no tempo termina com S e passa da nota mínima', () => {
    const p = partidaDaDemo('diversao')
    const eventos = tocarPerfeito(p)
    const r = resultadoDaPartida(p, 'B')
    expect(r.motivo).toBe('fim')
    expect(r.letra).toBe('S')
    expect(r.passou).toBe(true)
    expect(r.precisao).toBe(1)
    expect(r.pontos).toBe(1000000)
    expect(r.contagem.perfeito).toBe(61)
    expect(r.comboMax).toBe(61)
    expect(eventos.filter((e) => e.tipo === 'terminou')).toEqual([{ tipo: 'terminou', motivo: 'fim' }])
  })

  it('Expert tocado no tempo, segurando as caudas, termina com S e todas as seguradas inteiras', () => {
    const p = partidaDaDemo('expert')
    tocarPerfeito(p)
    const r = resultadoDaPartida(p, 'B')
    expect(r.motivo).toBe('fim')
    expect(r.letra).toBe('S')
    expect(r.seguradas).toEqual({ inteiras: 5, total: 5 })
    expect(r.pontos).toBe(1000000)
    expect(p.placar.vida).toBe(VIDA.max)
  })

  it('Expert sem tocar: a vida zera e encerra com "Falhou"', () => {
    const p = partidaDaDemo('expert')
    const eventos = semTocar(p)
    expect(p.motivo).toBe('falhou')
    expect(p.placar.vida).toBe(0)
    expect(eventos[eventos.length - 1]).toEqual({ tipo: 'terminou', motivo: 'falhou' })
    expect(resultadoDaPartida(p, 'D').passou).toBe(false)
    // Depois do fim, nada mais é julgado.
    const julgadas = p.placar.julgadas
    expect(avancarPartida(p, p.fimS)).toEqual([])
    expect(apertarTrilha(p, 0, p.fimS)).toEqual([])
    expect(p.placar.julgadas).toBe(julgadas)
  })

  it('Diversão sem tocar não derruba: chega ao fim com D', () => {
    const p = partidaDaDemo('diversao')
    semTocar(p)
    const r = resultadoDaPartida(p, 'D')
    expect(r.motivo).toBe('fim')
    expect(r.letra).toBe('D')
    expect(r.passou).toBe(true)
    expect(p.placar.vida).toBe(VIDA.inicio)
    expect(r.contagem.errou).toBe(61)
  })
})

/** Partida curta à mão: setas comuns em 2 s e 3 s na trilha 0 e uma segurada de 1 s em 5 s na trilha 1. */
function partidaCurta(dif: DificuldadeDanca): PartidaDanca {
  const notas: NotaDaDanca[] = [
    { t: 2, lane: 0, len: 0, sub: 4 },
    { t: 3, lane: 0, len: 0, sub: 4 },
    { t: 5, lane: 1, len: 1, sub: 4 },
  ]
  return novaPartida(notas, dif, 60)
}

describe('toques', () => {
  it('cedo demais na Diversão é ignorado; na janela, julga', () => {
    const p = partidaCurta('diversao')
    expect(apertarTrilha(p, 0, 2 - 0.17)).toEqual([])
    expect(p.notas[0].julg).toBeNull()
    expect(apertarTrilha(p, 0, 2 - 0.15)).toEqual([{ tipo: 'julgou', lane: 0, julg: 'ok', segurada: false }])
    expect(p.notas[0].delta).toBeCloseTo(-150, 6)
  })

  it('no Expert, toque até 160 ms cedo é Errou e tira 9 de vida', () => {
    const p = partidaCurta('expert')
    expect(apertarTrilha(p, 0, 2 - 0.17)).toEqual([])
    expect(apertarTrilha(p, 0, 2 - 0.15)).toEqual([{ tipo: 'julgou', lane: 0, julg: 'errou', segurada: false }])
    expect(p.placar.vida).toBe(VIDA.inicio + VIDA.errou)
  })

  it('toque na trilha errada não julga nada', () => {
    const p = partidaCurta('diversao')
    expect(apertarTrilha(p, 3, 2)).toEqual([])
  })

  it('seta que já passou da janela vira Errou e o toque vale para a próxima da trilha', () => {
    const p = partidaCurta('expert')
    // 2,9 s: a seta de 2 s passou faz tempo (ainda não varrida pelo laço); a de 3 s está a −100 ms.
    const eventos = apertarTrilha(p, 0, 2.9)
    expect(eventos).toEqual([
      { tipo: 'julgou', lane: 0, julg: 'errou', segurada: false },
      { tipo: 'julgou', lane: 0, julg: 'ok', segurada: false },
    ])
  })

  it('seta sem toque vira Errou só depois da janela Ok', () => {
    const p = partidaCurta('diversao')
    expect(avancarPartida(p, 2 + 0.159)).toEqual([])
    expect(avancarPartida(p, 2 + 0.161)).toEqual([{ tipo: 'julgou', lane: 0, julg: 'errou', segurada: false }])
    expect(p.cursor).toBe(1)
  })
})

describe('seguradas', () => {
  it('fecha inteira quando o fim chega com a trilha segura', () => {
    const p = partidaCurta('expert')
    apertarTrilha(p, 1, 5)
    expect(p.notas[2].segurando).toBe(true)
    expect(avancarPartida(p, 5.99)).not.toContainEqual({ tipo: 'segurada', lane: 1, inteira: true })
    expect(avancarPartida(p, 6)).toContainEqual({ tipo: 'segurada', lane: 1, inteira: true })
    expect(p.placar.segOk).toBe(1)
  })

  it('soltar até 120 ms antes do fim ainda conta inteira', () => {
    const p = partidaCurta('expert')
    apertarTrilha(p, 1, 5)
    expect(soltarTrilha(p, 1, 6 - 0.12)).toEqual([{ tipo: 'segurada', lane: 1, inteira: true }])
  })

  it('soltar cedo perde a cauda: zera o combo e tira 6 de vida no Expert', () => {
    const p = partidaCurta('expert')
    apertarTrilha(p, 1, 5)
    const vida = p.placar.vida
    expect(soltarTrilha(p, 1, 5.5)).toEqual([{ tipo: 'segurada', lane: 1, inteira: false }])
    expect(p.placar.combo).toBe(0)
    expect(p.placar.vida).toBe(vida + VIDA.soltou)
    expect(p.notas[2].fimOk).toBe(false)
  })

  it('pausar no meio da segurada conta como inteira', () => {
    const p = partidaCurta('expert')
    apertarTrilha(p, 1, 5)
    expect(fecharSeguradasNaPausa(p)).toEqual([{ tipo: 'segurada', lane: 1, inteira: true }])
    expect(p.notas[2].segurando).toBe(false)
    expect(soltarTrilha(p, 1, 5.3)).toEqual([])
  })

  it('Errou na cabeça da segurada perde a cauda junto', () => {
    const p = partidaCurta('expert')
    apertarTrilha(p, 1, 5 - 0.15)
    expect(p.notas[2].fimOk).toBe(false)
    expect(p.placar.segTotal).toBe(1)
    expect(p.placar.julgadas).toBe(2)
  })
})

describe('coreografia vazia (música sem batida)', () => {
  it('termina sozinha em 1,2 s, sem nota acima de D, sem pontos e sem dividir por zero', () => {
    const p = novaPartida([], 'expert', 30)
    expect(p.totalItens).toBe(0)
    expect(p.fimS).toBeCloseTo(1.2, 9)
    expect(apertarTrilha(p, 0, 0.5)).toEqual([])
    expect(soltarTrilha(p, 0, 0.6)).toEqual([])
    expect(fecharSeguradasNaPausa(p)).toEqual([])
    expect(avancarPartida(p, 1.2)).toEqual([{ tipo: 'terminou', motivo: 'fim' }])
    const r = resultadoDaPartida(p, 'D')
    expect(r).toMatchObject({ motivo: 'fim', letra: 'D', precisao: 0, pontos: 0, passou: true, comboMax: 0 })
    expect(r.seguradas).toEqual({ inteiras: 0, total: 0 })
  })
})

describe('fim e resultado', () => {
  it('a partida acaba 1,2 s depois da última seta, ou no fim do áudio', () => {
    expect(partidaCurta('diversao').fimS).toBeCloseTo(7.2, 9)
    expect(novaPartida([{ t: 10, lane: 0, len: 0, sub: 4 }], 'diversao', 10.5).fimS).toBe(10.5)
  })

  it('o mestre encerra: sem nota, ninguém passa', () => {
    const p = partidaCurta('diversao')
    apertarTrilha(p, 0, 2)
    expect(encerrarPartida(p, 'mestre')).toEqual([{ tipo: 'terminou', motivo: 'mestre' }])
    const r = resultadoDaPartida(p, 'D')
    expect(r.letra).toBeNull()
    expect(r.passou).toBe(false)
    expect(r.precisao).toBe(1)
    expect(encerrarPartida(p, 'fim')).toEqual([])
  })

  it('quem caiu é medido só no que dançou; quem chegou ao fim, na música inteira', () => {
    const p = partidaCurta('diversao')
    apertarTrilha(p, 0, 2)
    encerrarPartida(p, 'falhou')
    expect(resultadoDaPartida(p, 'B').precisao).toBe(1)
    const q = partidaCurta('diversao')
    apertarTrilha(q, 0, 2)
    for (let st = 0; q.motivo === null; st += QUADRO_S) avancarPartida(q, st)
    expect(q.motivo).toBe('fim')
    expect(resultadoDaPartida(q, 'B').precisao).toBeCloseTo(100 / 400, 9)
  })

  it('progresso de 0 a 1 e runas pela nota ao vivo', () => {
    const p = partidaCurta('diversao')
    expect(progressoDe(p, 0)).toBe(0)
    expect(progressoDe(p, p.fimS / 2)).toBeCloseTo(0.5, 9)
    expect(progressoDe(p, p.fimS * 2)).toBe(1)
    expect(notaAoVivoPassa(novoPlacar(), 'D')).toBe(false)
    apertarTrilha(p, 0, 2)
    expect(notaAoVivoPassa(p.placar, 'S')).toBe(true)
    expect(DIF[p.dif].vida).toBe(false)
  })
})
