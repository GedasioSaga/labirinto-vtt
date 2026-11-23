/**
 * OS CONTADORES DO BALANCEADOR SÓ OBSERVAM (docs/design/balanceamento/NOTAS.md):
 * a mesma luta, com a mesma semente, dá o mesmo resumo com e sem contador
 * (vitória, rodada, passos, d20, vida de cada vaga e o registro inteiro). E o
 * que o contador viu bate com o resumo: quem caiu tem a rodada da queda, e o
 * dano que um lado sofreu é o que o outro lado causou.
 */
import { describe, expect, it } from 'vitest'
import { doisContraUm, SISTEMA_DO_TESTE } from './fichasDeTreino.testkit'
import { lutaAutomatica, lutaContada } from './lutaAutomatica'

describe('lutaContada', () => {
  it('dá o mesmo resumo que a luta sem contador, semente por semente', () => {
    for (const semente of [1, 7, 42, 2026]) {
      const pedido = { sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(), semente }
      const sem = lutaAutomatica(pedido)
      const com = lutaContada(pedido)
      expect(com.resumo).toEqual(sem)
    }
  })

  it('conta a queda e o dano de forma coerente com o resumo', () => {
    const { resumo, contadores, primeiraACair } = lutaContada({ sistema: SISTEMA_DO_TESTE, lutadores: doisContraUm(), semente: 7 })
    const porVaga = new Map(contadores.map((contador) => [contador.vaga, contador]))
    for (const lutador of resumo.lutadores) {
      const contador = porVaga.get(lutador.vaga)
      expect(contador).toBeDefined()
      const caiu = lutador.vida !== null && lutador.vida.atual <= 0
      expect(contador?.caiuNaRodada !== null).toBe(caiu)
    }
    if (resumo.lutadores.some((lutador) => lutador.vida !== null && lutador.vida.atual <= 0)) expect(primeiraACair).not.toBeNull()
    const ladoDe = new Map(resumo.lutadores.map((lutador) => [lutador.vaga, lutador.lado]))
    const soma = (lado: 'a' | 'b', campo: 'danoCausado' | 'danoSofrido') =>
      contadores.filter((contador) => ladoDe.get(contador.vaga) === lado).reduce((total, contador) => total + contador[campo], 0)
    expect(soma('b', 'danoSofrido')).toBeGreaterThan(0)
    expect(soma('a', 'danoCausado')).toBe(soma('b', 'danoSofrido'))
  })
})
