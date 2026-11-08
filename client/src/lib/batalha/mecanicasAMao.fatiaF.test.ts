// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F2, fatia F (Harvey Solferino e Siegfried): o que o
 * menu e a mira mostram, com os cartões e os números REAIS
 * (`fichasDaFatiaF.testkit.ts`). Lei: docs/auditoria-fichas/respostas-do-grilling.md.
 * No máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { alvosNaAreaDaMira, alvosNaOrdemDaMira, armasNaBatalha, golpesDeAtaque, golpesDeHabilidade, type AlvoNaMira } from '../../components/batalha/dadosDoMenu'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { variantesDe } from './escolhaEEvolucao'
import { leituraDaTecnica } from './leituraDaTecnica'
import { motivoDoEvoluirPelaMecanica, somaContraOSelo } from './mecanicasAMao'
import { CACA, CHAMAS, FLORESCER, MELODIA, GIRO_DE_PA, GOLPE_BAIXO, LUA, MEDICINA, PAZADA, ALVORADA, GRAM, BALMUNG, GILGAMESH, harveyCom, siegCom } from './fichasDaFatiaF.testkit'

const sistema = SISTEMA_ONE_PIECE

describe('fatia F: Harvey, todos os golpes somam a Pá (10)', () => {
  // A duração da Pazada ("de 1 turno") fica fora da fatia: o leitor só entende "por N turnos" (B2 da auditoria).
  it('Atacar 60, Giro de Pá 123, Pazada 105 com Atordoado; Golpe Baixo lembra o terreno; Medicina sem a Cirurgia', () => {
    const harvey = harveyCom()
    expect(golpesDeAtaque(harvey, sistema, undefined, null)[0]?.dano.valor).toBe(60)
    const golpes = golpesDeHabilidade(harvey, sistema, undefined, null, armasNaBatalha(harvey, undefined)[0] ?? null)
    const de = (id: string) => golpes.find((golpe) => golpe.cartaoId === id)
    expect(de(GIRO_DE_PA.id)?.dano.valor).toBe(123)
    expect(de(GIRO_DE_PA.id)?.area).toEqual({ forma: { tipo: 'raio', casas: 1 }, quem: 'inimigos' })
    expect(de(PAZADA.id)).toMatchObject({ dano: { valor: 105 }, selo: { nome: 'Atordoado' } })
    expect(de(GOLPE_BAIXO.id)?.lembrete).toContain('terra ou areia')
    expect(de(MEDICINA.id)).toMatchObject({ alvoEmSi: true, tempoTexto: expect.stringContaining('3') })
    expect(de(MEDICINA.id)?.opcoes).toBeUndefined()
    expect(variantesDe(MEDICINA).map((variante) => variante.principal)).toEqual([true])
  })
})

describe('fatia F: Giro de Pá marca sozinho os inimigos a 1 casa', () => {
  it('inimigo do lado e na diagonal entram; a 2 casas e o aliado do lado ficam de fora', () => {
    const alvos: AlvoNaMira[] = [
      { tokenId: 'harvey', nome: 'Harvey', lado: 'eu', caiu: false },
      { tokenId: 'lado', nome: 'Pirata 1', lado: 'outro', caiu: false },
      { tokenId: 'diagonal', nome: 'Pirata 2', lado: 'outro', caiu: false },
      { tokenId: 'longe', nome: 'Pirata 3', lado: 'outro', caiu: false },
      { tokenId: 'amigo', nome: 'Aliado', lado: 'aliado', caiu: false },
    ]
    // Casas de 50 px; o Harvey na casa (2, 2).
    const fichas = [
      { id: 'harvey', x: 125, y: 125 },
      { id: 'lado', x: 175, y: 125 },
      { id: 'diagonal', x: 75, y: 75 },
      { id: 'longe', x: 225, y: 125 },
      { id: 'amigo', x: 125, y: 175 },
    ]
    const ordenados = alvosNaOrdemDaMira(alvos, fichas, 'harvey', 50)
    expect(alvosNaAreaDaMira({ forma: { tipo: 'raio', casas: 1 }, quem: 'inimigos' }, ordenados).sort()).toEqual(['diagonal', 'lado'])
  })
})

describe('fatia F: Siegfried, qual arma e as leituras da tabela', () => {
  it('a Alvorada pergunta a arma: Balmung 61, Gram 64, Gilgamesh 64 (levadas as 3); a Lua divide até 3', () => {
    const sieg = siegCom()
    const combate = { recargas: {}, usos: {}, overload: false, carga: 0 as const, armas: [BALMUNG.id, GRAM.id, GILGAMESH.id] }
    const golpes = golpesDeHabilidade(sieg, sistema, combate, null, armasNaBatalha(sieg, combate)[0] ?? null)
    const alvorada = golpes.find((golpe) => golpe.cartaoId === ALVORADA.id)
    expect(alvorada?.armas?.map((arma) => [arma.nome, arma.dano.valor])).toEqual([
      ['Balmung', 61],
      ['Gram', 64],
      ['Gilgamesh', 64],
    ])
    expect(golpes.find((golpe) => golpe.cartaoId === LUA.id)).toMatchObject({ divide: 3, dano: { valor: 71 } })
  })

  it('Florescer é Livre (sem a Bônus); Chamas Celestes custa 10% do HP MÁXIMO (90) mesmo com 300 de HP', () => {
    const sieg = siegCom({ hp: 300, sp: 140, escudo: 80 })
    expect(leituraDaTecnica(FLORESCER, { personagem: sieg, sistema }).acaoDaFicha.acao).toBe('livre')
    expect(leituraDaTecnica(CHAMAS, { personagem: sieg, sistema }).custo).toEqual({ tipo: 'valor', recurso: 'hp', valor: 90, porTurno: false })
  })
})

describe('fatia F: Melodia (+20 contra o analisado) e a evolução da CAÇA', () => {
  const SIEG = 'pers_f665c18d-a3fa-46dd-9a58-02a100920d60'
  const ligada = { tokenId: 'pirata', cartaoId: MELODIA.id, donoId: SIEG }

  it('a Melodia na opção do +20 soma 20 só no alvo analisado; na opção do dado de reação não soma', () => {
    expect(somaContraOSelo([ligada], 'pirata', SIEG)).toBe(20)
    expect(somaContraOSelo([ligada], 'outro', SIEG)).toBe(0)
    expect(somaContraOSelo([{ ...ligada, opcao: 'Opção Dado de reação' }], 'pirata', SIEG)).toBe(0)
  })

  it('evoluir a CAÇA pede a Melodia no +20; depois do SUPER a CAÇA volta ao menu', () => {
    const motivo = 'Para evoluir, a Melodia tem de estar ligada na opção do +20 de dano'
    expect(motivoDoEvoluirPelaMecanica(CACA.id, [], SIEG)).toBe(motivo)
    expect(motivoDoEvoluirPelaMecanica(CACA.id, [{ ...ligada, opcao: 'Opção Dado de reação' }], SIEG)).toBe(motivo)
    expect(motivoDoEvoluirPelaMecanica(CACA.id, [ligada], SIEG)).toBeNull()
    const sieg = siegCom()
    const depoisDoSuper = { recargas: {}, usos: {}, overload: true, carga: 0 as const, armas: [BALMUNG.id, GRAM.id, GILGAMESH.id] }
    const caca = golpesDeHabilidade(sieg, sistema, depoisDoSuper, null, armasNaBatalha(sieg, depoisDoSuper)[0] ?? null).find((golpe) => golpe.cartaoId === CACA.id)
    expect(caca?.motivo).toBeNull()
  })
})
