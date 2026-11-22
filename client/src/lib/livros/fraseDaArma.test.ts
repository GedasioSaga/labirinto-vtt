/** Regra do dono: o Efeito em texto da arma e a descrição do item não contradizem a mecânica. Dados inventados; 2 testes. */
import { describe, expect, it } from 'vitest'
import { mecanicaDoModeloDaArma } from '../batalha/mecanica/arma'
import { guardarMecanica } from '../batalha/mecanica/modelos'
import { descricaoDizOEfeito } from '../descricaoDoEfeito'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { camposComOEfeitoDaMecanica, efeitoQueSegueAMecanica, fraseDoQueElaFaz } from './fraseDaArma'

const sistema = SISTEMA_ONE_PIECE
const atordoa = guardarMecanica(mecanicaDoModeloDaArma('atordoa', sistema))
const sangra = guardarMecanica(mecanicaDoModeloDaArma('laminaQueSangra', sistema))

describe('o texto segue a mecânica', () => {
  it('com mecânica o Efeito é sempre a frase (o texto à mão sai, com ou sem modelo); a frase sai com a mecânica; o texto à mão sem mecânica fica', () => {
    const fraseDoAtordoa = fraseDoQueElaFaz(atordoa, sistema)
    expect(fraseDoAtordoa).toMatch(/Atordoad/)
    expect(efeitoQueSegueAMecanica('Atordoa (à mão)', undefined, atordoa, sistema)).toBe(fraseDoAtordoa)
    expect(efeitoQueSegueAMecanica('', undefined, atordoa, sistema)).toBe(fraseDoAtordoa)
    expect(efeitoQueSegueAMecanica(fraseDoAtordoa, atordoa, sangra, sistema)).toBe(fraseDoQueElaFaz(sangra, sistema))
    expect(efeitoQueSegueAMecanica('3 usos por combate', atordoa, sangra, sistema)).toBe(fraseDoQueElaFaz(sangra, sistema))
    expect([efeitoQueSegueAMecanica(fraseDoAtordoa, atordoa, undefined, sistema), efeitoQueSegueAMecanica('Escrito à mão', atordoa, undefined, sistema)]).toEqual(['', 'Escrito à mão'])
    // Gravar: a arma montada leva a frase no Efeito; a sem mecânica fica com o texto à mão.
    expect([camposComOEfeitoDaMecanica({ dano: '2d6', efeito: '3 usos por combate' }, atordoa, sistema), camposComOEfeitoDaMecanica({ efeito: 'Escrito à mão' }, undefined, sistema)]).toEqual([{ dano: '2d6', efeito: fraseDoAtordoa }, { efeito: 'Escrito à mão' }])
  })

  it('a descrição do item que diz um efeito com número é reconhecida; a de cor, não', () => {
    expect(['Cura 50 HP.', 'Uma poção que recupera 30 de SP', 'Causa 40 de dano em área', '+20% de vida'].map(descricaoDizOEfeito)).toEqual([true, true, true, true])
    expect(['Uma garrafa verde da vovó.', 'Folha seca de 2 anos', '', undefined].map(descricaoDizOEfeito)).toEqual([false, false, false, false])
  })
})
