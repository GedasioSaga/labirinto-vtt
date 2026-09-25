import { describe, expect, it } from 'vitest'
import { distanciaAoPino, idadeDoPedido, linhaDoPedidoVivo } from './pedidoVivo'

/**
 * CAIXA DE PEDIDOS COM IDADE: a linha pequena embaixo de cada pedido de
 * passagem conta há quanto tempo o jogador espera e a que distância a ficha
 * dele está do pino AGORA ("há 3 min · agora a 20 casas do pino").
 */

const MIN = 60_000

describe('idadeDoPedido', () => {
  it('menos de um minuto não vira "há 0 min"', () => {
    expect(idadeDoPedido(0)).toBe('há menos de 1 min')
    expect(idadeDoPedido(59_999)).toBe('há menos de 1 min')
  })

  it('conta minutos inteiros, arredondando para baixo', () => {
    expect(idadeDoPedido(MIN)).toBe('há 1 min')
    expect(idadeDoPedido(3 * MIN + 59_000)).toBe('há 3 min')
  })

  it('passou de uma hora: horas e minutos', () => {
    expect(idadeDoPedido(60 * MIN)).toBe('há 1 h')
    expect(idadeDoPedido(65 * MIN)).toBe('há 1 h 5 min')
  })

  it('relógio que voltou (espera negativa) conta como agora, e não "há -1 min"', () => {
    expect(idadeDoPedido(-5 * MIN)).toBe('há menos de 1 min')
  })
})

describe('distanciaAoPino', () => {
  it('casas no singular e no plural, e a ficha em cima do pino', () => {
    expect(distanciaAoPino(20)).toBe('agora a 20 casas do pino')
    expect(distanciaAoPino(1)).toBe('agora a 1 casa do pino')
    expect(distanciaAoPino(0)).toBe('agora no pino')
  })

  it('sem ficha na cena do pino: diz isso, e não uma distância inventada', () => {
    expect(distanciaAoPino(null)).toBe('ficha fora da cena do pino')
  })
})

describe('linhaDoPedidoVivo', () => {
  it('junta a idade e a distância numa linha só', () => {
    expect(linhaDoPedidoVivo(3 * MIN, 20)).toBe('há 3 min · agora a 20 casas do pino')
    expect(linhaDoPedidoVivo(10_000, null)).toBe('há menos de 1 min · ficha fora da cena do pino')
  })
})
