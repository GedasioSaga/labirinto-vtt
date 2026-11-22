/**
 * Os 20 modelos de arma (docs/design/habilidades/ARMAS-FONTE-UNICA.md §5, aceite
 * da F1): todos cabem no Atacar com arma e gravam a versão da tabela. Dados
 * inventados; no máximo 2 testes por situação.
 */
import { describe, expect, it } from 'vitest'
import { novoCartao } from '../../personagem'
import { SISTEMA_ONE_PIECE } from '../../sistemaOnePiece'
import { armaLida, MODELOS_DA_ARMA, mecanicaDoModeloDaArma } from './arma'
import { guardarMecanica } from './modelos'

/** A coluna v da tabela: 2 = pede 0.5.91+; o resto é 1. */
const DA_VERSAO_2 = new Set(['A10', 'A11', 'A14', 'A18', 'A20'])

describe('os 20 modelos de arma', () => {
  it('cada um é lido como peças na arma (nenhum recusado) e grava a versão da tabela', () => {
    const cartao = { ...novoCartao('Faca de Teste'), campos: { dano: '30' } }
    expect(MODELOS_DA_ARMA).toHaveLength(20)
    expect(new Set(MODELOS_DA_ARMA.map((modelo) => modelo.numero)).size).toBe(20)
    const lidos = MODELOS_DA_ARMA.map((modelo) => {
      const mecanica = guardarMecanica(mecanicaDoModeloDaArma(modelo.id, SISTEMA_ONE_PIECE, cartao))
      const lida = armaLida({ nome: cartao.nome, mecanica })
      return { numero: modelo.numero, tipo: lida.tipo === 'recusada' ? lida.motivo : lida.tipo, versao: mecanica.versao }
    })
    expect(lidos).toEqual(MODELOS_DA_ARMA.map((modelo) => ({ numero: modelo.numero, tipo: 'pecas', versao: DA_VERSAO_2.has(modelo.numero) ? 2 : 1 })))
  })
})
