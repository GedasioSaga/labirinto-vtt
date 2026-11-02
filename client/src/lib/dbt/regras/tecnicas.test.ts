/**
 * Montador de técnica do Dragon Ball Tales contra os exemplos do livro:
 * Kamehameha (6.7, p. 85-86) e a Esfera de Ki dos NPCs do Enma Daioh
 * (Rank D, 08-17-34, Ki 08).
 */
import { describe, expect, it } from 'vitest'
import {
  ACUMULACAO,
  AUMENTAR_DANO_POR_KI,
  AUMENTAR_PRECISAO,
  CATALOGO,
  CONDICIONADA,
  DRENO_DE_KI,
  EFEITO_NEGATIVO,
  ENGOLFANTE,
  EXAUSTIVA,
  PROJETIL,
  RAJADA_CONTINUA,
  RANKS_DO_LIVRO,
  SOMATICA,
  TECNICA_BASICA,
  TECNICA_HIBRIDA,
  VERBAL,
  escolhido,
  tecnicaDeTeste,
} from './livro.fixture'
import { especiaisNaoOfensivas, faixaDoDano, montarTecnica, slotsUsados } from './tecnicas'
import type { TecnicaDBT, TecnicaEspecialDBT } from '../modelo'

function montar(tecnica: TecnicaDBT, extra: { pdl?: number; podeUsarMagica?: boolean } = {}) {
  return montarTecnica(tecnica, { rank: RANKS_DO_LIVRO[tecnica.rank], rotulos: CATALOGO, ...extra })
}

const KAMEHAMEHA = tecnicaDeTeste({
  nome: 'Kamehameha',
  rank: 'B',
  tipo: 'ki',
  atributo: 'int',
  rotulos: [escolhido(ENGOLFANTE), escolhido(ACUMULACAO), escolhido(RAJADA_CONTINUA), escolhido(SOMATICA), escolhido(VERBAL)],
})

describe('faixa de dano (p. 59)', () => {
  it('¼, ½ e inteiro, arredondando para baixo: 50 → 12 / 25 / 50', () => {
    expect(faixaDoDano(50)).toEqual({ minimo: 12, medio: 25, completo: 50 })
    expect(faixaDoDano(44)).toEqual({ minimo: 11, medio: 22, completo: 44 })
  })
})

describe('Kamehameha do exemplo (6.7, p. 85-86)', () => {
  const montada = montar(KAMEHAMEHA)

  it('8 pontos positivos cabem no Rank B com Somática e Verbal (4 + 4)', () => {
    expect(montada.pontosBase).toBe(4)
    expect(montada.positivos).toBe(8)
    expect(montada.negativos).toBe(4)
    expect(montada.orcamento).toBe(8)
    expect(montada.sobra).toBe(0)
    expect(montada.valida).toBe(true)
    expect(montada.avisos.filter((a) => a.gravidade === 'erro')).toEqual([])
  })

  it('Ki 11: mínimo do Rank B 8 + Engolfante 3 (a ficha final do livro diz 11; o passo 4 diz 12 com +4)', () => {
    expect(montada.ki).toBe(11)
    expect(montada.formulaDoKi).toContain('= 11')
  })

  it('dano base 44 e faixa 11 / 22 / 44 (o passo 5 diz 11; a ficha final imprime 12)', () => {
    expect(montada.danoBase).toBe(44)
    expect(montada.faixa).toEqual({ minimo: 11, medio: 22, completo: 44 })
  })

  it('sem os negativos o orçamento estoura e a técnica é recusada', () => {
    const semNegativos = montar({ ...KAMEHAMEHA, rotulos: [escolhido(ENGOLFANTE), escolhido(ACUMULACAO), escolhido(RAJADA_CONTINUA)] })
    expect(semNegativos.valida).toBe(false)
    expect(semNegativos.sobra).toBe(-4)
    expect(semNegativos.avisos.map((a) => a.codigo)).toContain('orcamento')
  })
})

describe('Esfera de Ki dos NPCs do Enma Daioh (Rank D, 08-17-34, Ki 08)', () => {
  it('Técnica Básica (?) + Projétil + Aumentar Dano por Ki com 2 de Ki − Somática', () => {
    const montada = montar(
      tecnicaDeTeste({
        rank: 'D',
        rotulos: [escolhido(TECNICA_BASICA), escolhido(PROJETIL), escolhido(AUMENTAR_DANO_POR_KI, { investimento: 2 }), escolhido(SOMATICA)],
      }),
    )
    expect(montada.positivos).toBe(4)
    expect(montada.orcamento).toBe(4)
    expect(montada.valida).toBe(true)
    expect(montada.ki).toBe(8)
    expect(montada.danoBase).toBe(34)
    expect(montada.faixa).toEqual({ minimo: 8, medio: 17, completo: 34 })
  })
})

describe('orçamento de rótulos (p. 60)', () => {
  it('negativos acima dos pontos base são recusados', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'E', rotulos: [escolhido(SOMATICA), escolhido(VERBAL)] }))
    expect(montada.limiteDeNegativos).toBe(1)
    expect(montada.valida).toBe(false)
    expect(montada.avisos.map((a) => a.codigo)).toContain('negativos')
  })

  it('o rótulo "?" custa todos os pontos base do rank', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'C', rotulos: [escolhido(TECNICA_BASICA)] }))
    expect(montada.positivos).toBe(3)
    expect(montada.sobra).toBe(0)
    expect(montada.valida).toBe(true)
  })

  it('o tipo conta no orçamento (Híbrida 2) e o rótulo de tipo repetido na lista não conta de novo', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'D', tipo: 'hibrida', atributo: 'for', rotulos: [escolhido(TECNICA_HIBRIDA)] }))
    expect(montada.custoDoTipo).toBe(2)
    expect(montada.positivos).toBe(2)
    expect(montada.avisos.map((a) => a.codigo)).toContain('tipo-repetido')
  })

  it('ponto extra num "X a Variável" soma pontos e Ki', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'B', rotulos: [escolhido(ENGOLFANTE, { pontosExtras: 2 })] }))
    expect(montada.positivos).toBe(4)
    expect(montada.ki).toBe(8 + 3 + 3 * 2)
  })

  it('rótulo que não acumula entrando duas vezes é recusado', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'Z', rotulos: [escolhido(TECNICA_BASICA), escolhido(TECNICA_BASICA)] }))
    expect(montada.avisos.map((a) => a.codigo)).toContain('nao-acumula')
    expect(montada.valida).toBe(false)
  })

  it('rótulo fora do catálogo é recusado', () => {
    const montada = montar(tecnicaDeTeste({ rotulos: [{ rotuloId: 'inventado', pontosExtras: 0, variavel: null, investimento: 0, nota: '' }] }))
    expect(montada.avisos.map((a) => a.codigo)).toContain('rotulo-desconhecido')
    expect(montada.valida).toBe(false)
  })

  it('faixa sem escolha conta o valor impresso primeiro e avisa; valor fora da faixa é preso na borda', () => {
    const pendente = montar(tecnicaDeTeste({ rotulos: [escolhido(CONDICIONADA)] }))
    expect(pendente.negativos).toBe(1)
    expect(pendente.avisos.map((a) => a.codigo)).toContain('escolha-pendente')
    const fora = montar(tecnicaDeTeste({ rotulos: [escolhido(CONDICIONADA, { variavel: -5 })] }))
    expect(fora.negativos).toBe(2)
    expect(fora.avisos.map((a) => a.codigo)).toContain('valor-fora-da-faixa')
  })

  it('Efeito Negativo em técnica de área consome antes todos os positivos base (p. 76)', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'C', rotulos: [escolhido(ENGOLFANTE), escolhido(EFEITO_NEGATIVO, { variavel: 2 })] }))
    expect(montada.positivos).toBe(2 + 3 + 2)
    expect(montada.avisos.map((a) => a.codigo)).toContain('efeito-negativo-em-area')
  })
})

describe('Ki e dano com teto do rank (p. 58-59, 74)', () => {
  it('Aumentar Dano por Ki para no teto do rank E (24 de dano, 4 de Ki)', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'E', rotulos: [escolhido(AUMENTAR_DANO_POR_KI, { investimento: 10 })] }))
    expect(montada.danoBase).toBe(24)
    expect(montada.ki).toBe(4)
    const codigos = montada.avisos.map((a) => a.codigo)
    expect(codigos).toContain('teto-do-dano')
    expect(codigos).toContain('teto-do-ki')
    // Teto é ajuste, não recusa.
    expect(montada.valida).toBe(true)
  })

  it('Exaustiva dobra o Ki no uso', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'B', rotulos: [escolhido(EXAUSTIVA)] }))
    expect(montada.kiCalculado).toBe(8)
    expect(montada.multiplicadorDoKi).toBe(2)
    expect(montada.ki).toBe(16)
  })

  it('Dreno de Ki: −2 de negativo custa +6 de Ki', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'B', rotulos: [escolhido(DRENO_DE_KI, { variavel: -2 })] }))
    expect(montada.negativos).toBe(2)
    expect(montada.ki).toBe(14)
  })

  it('Aumentar Precisão soma +1 no acerto e +4 de Ki por cópia', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'A', rotulos: [escolhido(AUMENTAR_PRECISAO), escolhido(AUMENTAR_PRECISAO)] }))
    expect(montada.acertoExtra).toBe(2)
    expect(montada.ki).toBe(12 + 8)
  })

  it('Ki e dano à mão vencem a conta', () => {
    const montada = montar({ ...KAMEHAMEHA, kiManual: 12, danoManual: { minimo: 12, medio: 22, completo: 44 } })
    expect(montada.ki).toBe(12)
    expect(montada.faixa).toEqual({ minimo: 12, medio: 22, completo: 44 })
    expect(montada.manual).toEqual({ ki: true, dano: true })
    expect(montada.kiCalculado).toBe(11)
  })
})

describe('avisos de tipo e PDL (p. 59, 61)', () => {
  it('atributo diferente do tipo, mágica sem Mago de Ki e PDL abaixo do rank avisam sem recusar', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'B', tipo: 'magica', atributo: 'int' }), { pdl: 10_000, podeUsarMagica: false })
    const codigos = montada.avisos.map((a) => a.codigo)
    expect(codigos).toEqual(expect.arrayContaining(['atributo-do-tipo', 'magica-sem-mago', 'pdl-baixo']))
    expect(montada.valida).toBe(true)
  })
})

describe('técnica especial (p. 87-92)', () => {
  const especial = (ofensiva: boolean, aprovada: boolean): TecnicaEspecialDBT => ({ ofensiva, momento: 'acao', efeito: 'Teleporte curto', aprovada })

  it('sem rótulos nem orçamento; Ki mínimo do rank', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'C', especial: especial(false, true) }))
    expect(montada.ki).toBe(6)
    expect(montada.positivos).toBe(0)
    expect(montada.faixa).toEqual({ minimo: 0, medio: 0, completo: 0 })
    expect(montada.valida).toBe(true)
  })

  it('Ki à mão abaixo do mínimo do rank é recusado; sem aprovação avisa', () => {
    const montada = montar(tecnicaDeTeste({ rank: 'A', kiManual: 4, especial: especial(true, false) }))
    const codigos = montada.avisos.map((a) => a.codigo)
    expect(codigos).toContain('especial-ki-baixo')
    expect(codigos).toContain('especial-pendente')
    expect(montada.valida).toBe(false)
  })

  it('ofensiva sem dano à mão usa o dano mínimo do rank', () => {
    expect(montar(tecnicaDeTeste({ rank: 'D', especial: especial(true, true) })).faixa).toEqual(faixaDoDano(26))
  })
})

describe('contas da lista de técnicas', () => {
  it('ST usados: só técnicas ativas e não especiais (p. 109)', () => {
    const lista = [
      tecnicaDeTeste({ rank: 'Z', ativa: true }),
      tecnicaDeTeste({ rank: 'E', ativa: true }),
      tecnicaDeTeste({ rank: 'B', ativa: false }),
      tecnicaDeTeste({ rank: 'A', ativa: true, especial: { ofensiva: false, momento: 'passiva', efeito: '', aprovada: true } }),
    ]
    expect(slotsUsados(lista, RANKS_DO_LIVRO)).toBe(16)
  })

  it('especiais não ofensivas: 1 por ponto de EP base', () => {
    const lista = [
      tecnicaDeTeste({ especial: { ofensiva: false, momento: 'acao', efeito: '', aprovada: true } }),
      tecnicaDeTeste({ especial: { ofensiva: false, momento: 'reacao', efeito: '', aprovada: true } }),
      tecnicaDeTeste({ especial: { ofensiva: true, momento: 'acao', efeito: '', aprovada: true } }),
    ]
    expect(especiaisNaoOfensivas(lista, 1)).toEqual({ usadas: 2, limite: 1, passou: true })
    expect(especiaisNaoOfensivas(lista, 2).passou).toBe(false)
  })
})
