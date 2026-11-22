/** Regra do dono: o Efeito em texto da arma e a descrição do item não contradizem a mecânica. Dados inventados; 2 testes. */
import { describe, expect, it } from 'vitest'
import { mecanicaDoModeloDaArma } from '../batalha/mecanica/arma'
import { guardarMecanica } from '../batalha/mecanica/modelos'
import { descricaoDizOEfeito } from '../descricaoDoEfeito'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { efeitoQueSegueAMecanica, fraseDoQueElaFaz } from './fraseDaArma'

const sistema = SISTEMA_ONE_PIECE
const atordoa = guardarMecanica(mecanicaDoModeloDaArma('atordoa', sistema))
const sangra = guardarMecanica(mecanicaDoModeloDaArma('laminaQueSangra', sistema))

describe('o texto segue a mecânica', () => {
  it('modelo escolhido troca o texto à mão; a frase automática segue cada mudança e sai com a mecânica; o texto à mão fica no ajuste', () => {
    const fraseDoAtordoa = fraseDoQueElaFaz(atordoa, sistema)
    expect(fraseDoAtordoa).toMatch(/Atordoad/)
    expect(efeitoQueSegueAMecanica('Atordoa (à mão)', undefined, atordoa, sistema, true)).toBe(fraseDoAtordoa)
    expect(efeitoQueSegueAMecanica('', undefined, atordoa, sistema, false)).toBe(fraseDoAtordoa)
    expect(efeitoQueSegueAMecanica(fraseDoAtordoa, atordoa, sangra, sistema, false)).toBe(fraseDoQueElaFaz(sangra, sistema))
    expect(efeitoQueSegueAMecanica('Escrito à mão', atordoa, sangra, sistema, false)).toBe('Escrito à mão')
    expect([efeitoQueSegueAMecanica(fraseDoAtordoa, atordoa, undefined, sistema, false), efeitoQueSegueAMecanica('Escrito à mão', atordoa, undefined, sistema, false)]).toEqual(['', 'Escrito à mão'])
  })

  it('a descrição do item que diz um efeito com número é reconhecida; a de cor, não', () => {
    expect(['Cura 50 HP.', 'Uma poção que recupera 30 de SP', 'Causa 40 de dano em área', '+20% de vida'].map(descricaoDizOEfeito)).toEqual([true, true, true, true])
    expect(['Uma garrafa verde da vovó.', 'Folha seca de 2 anos', '', undefined].map(descricaoDizOEfeito)).toEqual([false, false, false, false])
  })
})
