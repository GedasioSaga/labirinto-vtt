/**
 * Transformações do Dragon Ball Tales: a regra geral (p. 93) e o exemplo
 * impresso do Super Saiyajin (p. 92-93), que foge dela e vence.
 */
import { describe, expect, it } from 'vitest'
import type { TransformacaoDBT } from '../modelo'
import { fichaDeTeste } from './livro.fixture'
import {
  ativarTransformacao,
  custoParaAtivar,
  desativarTransformacao,
  divergenciaDaRegra,
  epBonusDaFicha,
  motivoDoFimDaTransformacao,
  novaTransformacao,
  regraDoEstagio,
  transformacaoDoCatalogo,
} from './transformacoes'

function doCatalogo(parcial: Partial<TransformacaoDBT>): TransformacaoDBT {
  return {
    id: 'super-saiyajin-1',
    nome: 'Super Saiyajin – Estágio 1',
    estagio: 1,
    estagioTexto: 'Estágio 1',
    ep: 2,
    custoKi: 6,
    custoTexto: '[KI: 06]',
    requisito: '',
    duracao: '',
    efeitos: ['Transforma falha em êxito gastando Ki.'],
    pagina: 92,
    ...parcial,
  }
}

describe('regra geral (p. 93)', () => {
  it('estágio N: EP +N, Ki 3 × N (Estágio 6 = 18)', () => {
    expect(regraDoEstagio(1)).toEqual({ ep: 1, custoKi: 3 })
    expect(regraDoEstagio(6)).toEqual({ ep: 6, custoKi: 18 })
  })

  it('forma criada com o mestre usa a regra', () => {
    const forma = novaTransformacao('Modo Assalto', 2)
    expect(forma).toMatchObject({ estagio: 2, ep: 2, custoKi: 6, livroId: null })
    expect(divergenciaDaRegra(forma)).toBeNull()
  })
})

describe('catálogo: o impresso vence', () => {
  it('Super Saiyajin 1 fica com EP +2 e Ki 6, e a divergência aparece em texto', () => {
    const forma = transformacaoDoCatalogo(doCatalogo({}), 'raça Saiyajin')
    expect(forma).toMatchObject({ livroId: 'super-saiyajin-1', estagio: 1, ep: 2, custoKi: 6, origem: 'raça Saiyajin' })
    expect(divergenciaDaRegra(forma)).toContain('EP +2 (a regra dá +1)')
  })

  it('sem número impresso, entra a regra do estágio', () => {
    const forma = transformacaoDoCatalogo(doCatalogo({ estagio: 3, ep: null, custoKi: null }), '')
    expect(forma).toMatchObject({ ep: 3, custoKi: 9 })
  })
})

describe('forma ativa na ficha', () => {
  const forma = transformacaoDoCatalogo(doCatalogo({}), '')
  const ficha = fichaDeTeste({ transformacoes: [forma] })

  it('ligar soma o EP bônus; desligar volta a 0; id desconhecido não muda nada', () => {
    const ligada = ativarTransformacao(ficha, forma.id)
    expect(epBonusDaFicha(ligada)).toBe(2)
    expect(epBonusDaFicha(desativarTransformacao(ligada))).toBe(0)
    expect(ativarTransformacao(ficha, 'nao-existe')).toBe(ficha)
  })

  it('20 natural na iniciativa: transformar no 1º turno custa 0 (9.1)', () => {
    expect(custoParaAtivar(forma, true)).toBe(0)
    expect(custoParaAtivar(forma, false)).toBe(6)
  })

  it('acaba com 0 PV, inconsciente, atordoado ou Ki zerado (p. 93)', () => {
    const bem = { pv: 10, ki: 5, atordoado: false, inconsciente: false }
    expect(motivoDoFimDaTransformacao(bem)).toBeNull()
    expect(motivoDoFimDaTransformacao({ ...bem, pv: 0 })).not.toBeNull()
    expect(motivoDoFimDaTransformacao({ ...bem, ki: 0 })).not.toBeNull()
    expect(motivoDoFimDaTransformacao({ ...bem, atordoado: true })).not.toBeNull()
  })
})
