/**
 * PRELÚDIO F3b: o quadro e as ligações entre verbetes. As setas que um cartão
 * novo ganha (uma por par, tipos juntos, lugar dentro de lugar) e a ligação que
 * nasce de uma seta desenhada. Dados inventados (o repositório é público).
 */
import { describe, expect, it } from 'vitest'
import { verbeteNovo } from './enciclopedia'
import { haLigacaoEntre, ligacaoNova, setasDasLigacoes, tiposParaSugerir, TIPOS_SUGERIDOS } from './ligacoes'
import type { Ligacao, Verbete } from './tipos'

function ligacao(id: string, de: string, para: string, tipo: string, segredo = false): Ligacao {
  return { id, de, para, tipo, notas: '', segredo }
}

function verbete(id: string, tipo: Verbete['tipo'], paiId?: string): Verbete {
  return { ...verbeteNovo(tipo, `Inventado ${id}`, { campanhas: [], ...(paiId === undefined ? {} : { paiId }) }), id }
}

describe('setas do quadro a partir das ligações', () => {
  it('uma seta por par, com os tipos juntos, a do lugar dentro de lugar e só entre cartões que estão no quadro', () => {
    const verbetes = new Map(
      [verbete('vela', 'personagem'), verbete('brasa', 'personagem'), verbete('porto', 'lugar'), verbete('cais', 'lugar', 'porto'), verbete('fora', 'personagem')].map((cada) => [cada.id, cada]),
    )
    const ligacoes = [
      ligacao('l1', 'vela', 'brasa', 'aliado de'),
      // O mesmo par ao contrário: entra no rótulo, a direção fica a da primeira.
      ligacao('l2', 'brasa', 'vela', 'deve favor a'),
      ligacao('l3', 'vela', 'brasa', 'aliado de'),
      ligacao('l4', 'brasa', 'porto', ' mora em ', true),
      ligacao('l5', 'vela', 'fora', 'teme'),
      ligacao('l6', 'vela', 'vela', 'sozinha'),
    ]
    const noQuadro = new Set(['vela', 'brasa', 'porto', 'cais'])

    expect(setasDasLigacoes(ligacoes, noQuadro, verbetes)).toEqual([
      { de: 'vela', para: 'brasa', rotulo: 'aliado de · deve favor a' },
      { de: 'brasa', para: 'porto', rotulo: 'mora em' },
      { de: 'porto', para: 'cais', rotulo: '' },
    ])
    // O cartão que acabou de chegar ganha só as setas dele.
    expect(setasDasLigacoes(ligacoes, noQuadro, verbetes, 'cais')).toEqual([{ de: 'porto', para: 'cais', rotulo: '' }])
    // Sem o outro cartão no quadro, não há seta.
    expect(setasDasLigacoes(ligacoes, new Set(['vela']), verbetes)).toEqual([])
  })

  it('a ligação nova de uma seta: tipo limpo, sem origem, sem segredo; achada nas duas direções; sugestões com as usadas primeiro', () => {
    const nova = ligacaoNova('vela', 'brasa', '  protege ')
    expect(nova).toMatchObject({ de: 'vela', para: 'brasa', tipo: 'protege', notas: '', segredo: false })
    expect(nova.origem).toBeUndefined()
    expect(nova.id).toMatch(/^lg-/)

    const ligacoes = [nova, ligacao('l1', 'porto', 'vela', 'teme'), ligacao('l2', 'cais', 'vela', 'teme'), ligacao('l3', 'cais', 'brasa', 'jurou vingança')]
    expect(haLigacaoEntre(ligacoes, 'brasa', 'vela')).toBe(true)
    expect(haLigacaoEntre(ligacoes, 'porto', 'brasa')).toBe(false)

    const sugestoes = tiposParaSugerir(ligacoes)
    expect(sugestoes.slice(0, 3)).toEqual(['teme', 'jurou vingança', 'protege'])
    expect(sugestoes.filter((tipo) => tipo === 'teme')).toHaveLength(1)
    expect(sugestoes).toHaveLength(TIPOS_SUGERIDOS.length + 1)
  })
})
