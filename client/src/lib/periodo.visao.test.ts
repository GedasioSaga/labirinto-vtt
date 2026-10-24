/**
 * LUZ L2 — a visão no período DA CENA (`raioNoPeriodo` com `visaoPorPeriodo`).
 * Em casas: em certos mapas a noite apaga a visão toda (0), em outros quase
 * nada. Sem o campo, a regra de antes: noite = metade da visão, tarde = visão
 * cheia. Dia sempre cheia; cena interior ignora (`periodoDaCena` dá dia);
 * período fixo vale qualquer que seja a sessão. Valor torto some (vale o
 * padrão) e valor acima da visão cheia vira a cheia.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Periodo } from '../types/map'
import { periodoDaCena, raioNoPeriodo, VISAO_DA_NOITE } from './periodo'

const GRID = 50
/** 14 casas de 50 px. */
const CHEIA = 700
const METADE = Math.round(CHEIA * VISAO_DA_NOITE)

type Cena = Pick<MapData, 'grid' | 'visaoPorPeriodo' | 'externa' | 'periodoFixo'>

function cena(extra: Partial<Cena> = {}): Cena {
  return { grid: GRID, externa: true, ...extra }
}

/** O raio de quem está na cena com a sessão em `sessao`. */
function raio(c: Cena, sessao: Periodo, fator = 1, cheia = CHEIA): number {
  return raioNoPeriodo(cheia, periodoDaCena(c, sessao), c, fator)
}

describe('raioNoPeriodo com visaoPorPeriodo (tabela de casos)', () => {
  const casos: { nome: string; c: Cena; dia: number; tarde: number; noite: number }[] = [
    { nome: 'sem campo: a regra de antes', c: cena(), dia: CHEIA, tarde: CHEIA, noite: METADE },
    { nome: 'tarde só: a noite fica na regra de antes', c: cena({ visaoPorPeriodo: { tarde: 4 } }), dia: CHEIA, tarde: 4 * GRID, noite: METADE },
    { nome: 'noite só', c: cena({ visaoPorPeriodo: { noite: 3 } }), dia: CHEIA, tarde: CHEIA, noite: 3 * GRID },
    { nome: 'noite 0 apaga a visão', c: cena({ visaoPorPeriodo: { noite: 0 } }), dia: CHEIA, tarde: CHEIA, noite: 0 },
    { nome: 'noite maior que a visão cheia vira a cheia', c: cena({ visaoPorPeriodo: { tarde: 200, noite: 30 } }), dia: CHEIA, tarde: CHEIA, noite: CHEIA },
    { nome: 'cena interior ignora o campo', c: cena({ externa: undefined, visaoPorPeriodo: { tarde: 1, noite: 0 } }), dia: CHEIA, tarde: CHEIA, noite: CHEIA },
  ]
  for (const { nome, c, dia, tarde, noite } of casos) {
    it(nome, () => {
      expect(raio(c, 'dia')).toBe(dia)
      expect(raio(c, 'tarde')).toBe(tarde)
      expect(raio(c, 'noite')).toBe(noite)
    })
  }

  it('periodoFixo: a cena fica na noite dela com a sessão de dia', () => {
    const fixa = cena({ externa: undefined, periodoFixo: 'noite', visaoPorPeriodo: { noite: 2 } })
    for (const sessao of ['dia', 'tarde', 'noite'] as const) expect(raio(fixa, sessao), sessao).toBe(2 * GRID)
    const tardeFixa = cena({ periodoFixo: 'tarde', visaoPorPeriodo: { tarde: 5, noite: 0 } })
    expect(raio(tardeFixa, 'noite')).toBe(5 * GRID)
  })

  it('valor torto some: vale o padrão do período', () => {
    const tortos: unknown[] = [2.5, -1, '3', Number.NaN, Number.POSITIVE_INFINITY, 201, null, true, { casas: 3 }]
    for (const torto of tortos) {
      const c = cena({ visaoPorPeriodo: { tarde: torto, noite: torto } as unknown as MapData['visaoPorPeriodo'] }) // forja de propósito: mapa cru (rede, arquivo editado à mão)
      expect(raio(c, 'noite'), String(torto)).toBe(METADE)
      expect(raio(c, 'tarde'), String(torto)).toBe(CHEIA)
    }
    for (const campoTorto of ['escuro', [1, 2], 7]) {
      const c = cena({ visaoPorPeriodo: campoTorto as unknown as MapData['visaoPorPeriodo'] }) // forja de propósito: o campo inteiro torto
      expect(raio(c, 'noite'), String(campoTorto)).toBe(METADE)
    }
  })

  it('o dia nunca lê o campo, nem forjado', () => {
    const c = cena({ visaoPorPeriodo: { dia: 1 } as unknown as MapData['visaoPorPeriodo'] }) // forja de propósito: 'dia' não é período configurável
    expect(raio(c, 'dia')).toBe(CHEIA)
  })

  it('o fator do jogador vale também no período (e o teto é a visão cheia DELE)', () => {
    const c = cena({ visaoPorPeriodo: { noite: 4 } })
    expect(raio(c, 'noite', 1.5, CHEIA * 1.5)).toBe(4 * GRID * 1.5)
    expect(raio(cena({ visaoPorPeriodo: { noite: 30 } }), 'noite', 0.5, CHEIA * 0.5)).toBe(CHEIA * 0.5)
  })

  it('sem a cena, a regra de antes (quem não tem o mapa à mão)', () => {
    expect(raioNoPeriodo(CHEIA, 'noite')).toBe(METADE)
    expect(raioNoPeriodo(CHEIA, 'tarde')).toBe(CHEIA)
  })
})
