import { afterEach, describe, expect, it, vi } from 'vitest'
import { CENARIO_DURACAO_MAX_S, CENARIO_DURACAO_MIN_S, CENARIO_PADRAO } from './catalogo'
import {
  NOME_DE_ESTILO_MAX,
  assinarEstilosDeCenario,
  duracaoDoEstiloS,
  esquecerEstilosDeCenarioDeFora,
  estiloDeCenario,
  listarEstilosDeCenario,
  registrarEstiloDeCenario,
} from './estilosDeCenario'

afterEach(() => esquecerEstilosDeCenarioDeFora())

const OPCOES = { reduzirMovimento: false, volume: 0.5 }

/** O módulo do pacote como chega: objeto solto, sem tipo nenhum. */
function deFora(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'neve', nome: 'Neve caindo', duracaoNaturalS: 8, criar: () => ({ atualizar: () => {}, descartar: () => {} }), ...extra }
}

describe('registro de estilos de cenário', () => {
  it('começa vazio: sem pacote, só a panorâmica embutida', () => {
    expect(listarEstilosDeCenario()).toEqual([])
    expect(estiloDeCenario('neve')).toBeNull()
    expect(estiloDeCenario(undefined)).toBeNull()
  })

  it('aceita o estilo com a forma do contrato e acha pelo id; o nome perde os espaços das pontas', () => {
    expect(registrarEstiloDeCenario(deFora({ nome: '  Neve caindo  ', quadroDaMiniaturaS: 3 }))).toBe(true)
    const estilo = estiloDeCenario('neve')
    expect(estilo?.nome).toBe('Neve caindo')
    expect(estilo?.duracaoNaturalS).toBe(8)
    expect(estilo?.quadroDaMiniaturaS).toBe(3)
    expect(listarEstilosDeCenario().map((e) => e.id)).toEqual(['neve'])
  })

  it.each([
    ['não é objeto', 'neve'],
    ['null', null],
    ['sem id', deFora({ id: undefined })],
    ['id com maiúscula', deFora({ id: 'Neve' })],
    ['id com espaço', deFora({ id: 'neve caindo' })],
    ['id longo demais', deFora({ id: 'a'.repeat(41) })],
    ['nome vazio', deFora({ nome: '   ' })],
    ['nome que não é texto', deFora({ nome: 7 })],
    ['nome longo demais', deFora({ nome: 'n'.repeat(NOME_DE_ESTILO_MAX + 1) })],
    ['duração abaixo do teto', deFora({ duracaoNaturalS: CENARIO_DURACAO_MIN_S - 0.5 })],
    ['duração acima do teto', deFora({ duracaoNaturalS: CENARIO_DURACAO_MAX_S + 1 })],
    ['duração infinita', deFora({ duracaoNaturalS: Number.POSITIVE_INFINITY })],
    ['duração em texto', deFora({ duracaoNaturalS: '8' })],
    ['sem criar', deFora({ criar: undefined })],
    ['criar que não é função', deFora({ criar: 'function' })],
  ])('recusa: %s', (_caso, info) => {
    expect(registrarEstiloDeCenario(info)).toBe(false)
    expect(listarEstilosDeCenario()).toEqual([])
  })

  it('recusa id repetido (o primeiro fica) e o id reservado da panorâmica', () => {
    expect(registrarEstiloDeCenario(deFora())).toBe(true)
    expect(registrarEstiloDeCenario(deFora({ nome: 'Outra neve' }))).toBe(false)
    expect(estiloDeCenario('neve')?.nome).toBe('Neve caindo')
    expect(registrarEstiloDeCenario(deFora({ id: 'panoramica' }))).toBe(false)
    expect(listarEstilosDeCenario()).toHaveLength(1)
  })

  it('miniatura fora da animação some, e o estilo entra assim mesmo', () => {
    expect(registrarEstiloDeCenario(deFora({ quadroDaMiniaturaS: 99 }))).toBe(true)
    expect(estiloDeCenario('neve')?.quadroDaMiniaturaS).toBeUndefined()
  })

  it('avisa quem assina quando entra ou sai; a lista só troca de referência quando muda', () => {
    const ouvinte = vi.fn()
    const cancelar = assinarEstilosDeCenario(ouvinte)
    const antes = listarEstilosDeCenario()
    registrarEstiloDeCenario(deFora())
    expect(ouvinte).toHaveBeenCalledTimes(1)
    expect(listarEstilosDeCenario()).not.toBe(antes)
    const depois = listarEstilosDeCenario()
    registrarEstiloDeCenario('torto')
    expect(ouvinte).toHaveBeenCalledTimes(1)
    expect(listarEstilosDeCenario()).toBe(depois)
    esquecerEstilosDeCenarioDeFora()
    expect(ouvinte).toHaveBeenCalledTimes(2)
    expect(listarEstilosDeCenario()).toEqual([])
    cancelar()
    registrarEstiloDeCenario(deFora())
    expect(ouvinte).toHaveBeenCalledTimes(2)
  })

  it('criar repassa canvas, imagem e opções; os métodos da instância mantêm o this do módulo', () => {
    class Neve {
      quadros: number[] = []
      atualizar(tS: number) {
        this.quadros.push(tS)
      }
      descartar() {}
    }
    const instanciaDeFora = new Neve()
    const criar = vi.fn(() => instanciaDeFora)
    registrarEstiloDeCenario(deFora({ criar }))
    const canvas = document.createElement('canvas')
    const imagem = document.createElement('img')
    const instancia = estiloDeCenario('neve')?.criar(canvas, imagem, OPCOES)
    expect(criar).toHaveBeenCalledWith(canvas, imagem, OPCOES)
    instancia?.atualizar(1.5)
    expect(instanciaDeFora.quadros).toEqual([1.5])
    expect(instancia?.ajustarTela).toBeUndefined()
  })

  it.each([
    ['nada', undefined],
    ['sem atualizar', { descartar: () => {} }],
    ['sem descartar', { atualizar: () => {} }],
  ])('criar que devolve forma errada (%s) LANÇA, para quem toca cair na panorâmica', (_caso, devolvido) => {
    registrarEstiloDeCenario(deFora({ criar: () => devolvido }))
    const canvas = document.createElement('canvas')
    expect(() => estiloDeCenario('neve')?.criar(canvas, document.createElement('img'), OPCOES)).toThrow(/estilo de cenário neve/)
  })

  it('duração que toca: a do mestre, senão a natural do estilo', () => {
    registrarEstiloDeCenario(deFora())
    const estilo = estiloDeCenario('neve')
    if (estilo === null) throw new Error('sem o estilo')
    expect(duracaoDoEstiloS({ ...CENARIO_PADRAO, estilo: 'neve' }, estilo)).toBe(8)
    expect(duracaoDoEstiloS({ ...CENARIO_PADRAO, estilo: 'neve', duracaoS: 20 }, estilo)).toBe(20)
  })
})
