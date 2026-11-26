/**
 * COISA x REGRA, UM INVENTÁRIO SÓ (Fase 5): o "Pôr em" da porta única. A passagem dos
 * cartões antigos para a mochila saiu na E7 (é a conversão ao abrir). No máximo 2 testes por caso.
 */
import { describe, expect, it } from 'vitest'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { novoPersonagem } from '../personagem'
import { armasDe } from '../batalha/leituraDaFicha'
import { catalogoDoArquivo, ligarPeloNome, type ItemDoCatalogo } from './catalogo'
import { ABA_DOS_ITENS, desfazerPosto, porCoisaNaFicha, porEntradaNaFicha } from './coisaERegra'

const sistema = SISTEMA_ONE_PIECE

const FOTO = `midia:${'a'.repeat(64)}.webp`
const GARRUCHA_DO_ACERVO = { nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma', imagem: FOTO }

describe('o "Pôr em" da porta única e a ligação coisa x regra', () => {
  it('a ligação sobrevive à gravação; a arma ligada põe o cartão com o itemId E a coisa na mochila; o Desfazer tira os dois', () => {
    const solta: ItemDoCatalogo = { id: 'cat_garrucha', tipo: 'arma', nome: 'garrucha ', texto: 'De um tiro', campos: { dano: '40' } }
    const { itens, ligadas } = ligarPeloNome([solta], [{ id: 'item_garrucha', nome: 'Garrucha' }])
    expect(ligadas).toBe(1)
    const relida = catalogoDoArquivo(JSON.parse(JSON.stringify({ formato: 1, itens })))
    expect(relida[0]?.acervoId).toBe('item_garrucha')
    const regra = relida[0]
    if (regra === undefined) throw new Error('a regra sumiu na leitura')
    const ficha = novoPersonagem(sistema, 'jogador', 'Aira')
    const posto = porEntradaNaFicha(ficha, regra, sistema, GARRUCHA_DO_ACERVO, 'vaga_1')
    if (!posto.ok) throw new Error(`recusou: ${posto.motivo}`)
    const armas = armasDe(posto.personagem)
    // Uma arma só: o cartão da regra cobre a Garrucha da mochila (mesmo itemId).
    expect(armas.map((arma) => [arma.nome, arma.itemId, arma.campos.dano])).toEqual([['garrucha', 'item_garrucha', '40']])
    expect(posto.personagem.mochila).toEqual([{ id: 'vaga_1', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma', imagem: FOTO }])
    const desfeito = desfazerPosto(posto.personagem, posto)
    expect(armasDe(desfeito)).toEqual([])
    expect(desfeito.mochila).toBeUndefined()
  })

  it('o item do catálogo vai para a mochila (não para a aba Itens); a coisa do Acervo com a regra de arma traz o cartão junto', () => {
    const kit: ItemDoCatalogo = { id: 'cat_kit', tipo: 'item', nome: 'Kit Médico', texto: 'Para a Medicina', campos: { efeito: 'cura' } }
    const ficha = novoPersonagem(sistema, 'jogador', 'Harvey')
    const posto = porEntradaNaFicha(ficha, kit, sistema, undefined, 'vaga_kit')
    if (!posto.ok) throw new Error(`recusou: ${posto.motivo}`)
    expect(posto.cartao).toBeNull()
    expect(posto.personagem.abas[ABA_DOS_ITENS] ?? []).toEqual([])
    expect(posto.personagem.mochila?.[0]).toMatchObject({ id: 'vaga_kit', nome: 'Kit Médico' })
    const regra: ItemDoCatalogo = { id: 'cat_garrucha', tipo: 'arma', nome: 'Garrucha', texto: '', campos: { dano: '40' }, acervoId: 'item_garrucha' }
    const daCoisa = porCoisaNaFicha(ficha, GARRUCHA_DO_ACERVO, regra, sistema, 'vaga_g')
    if (!daCoisa.ok) throw new Error(`recusou: ${daCoisa.motivo}`)
    expect(daCoisa.cartao).not.toBeNull()
    expect(armasDe(daCoisa.personagem).map((arma) => arma.campos.dano)).toEqual(['40'])
  })
})
