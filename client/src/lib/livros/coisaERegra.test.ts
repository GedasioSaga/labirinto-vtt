/**
 * COISA x REGRA, UM INVENTÁRIO SÓ (Fase 5): a passagem dos cartões antigos da
 * aba Itens para a mochila e o "Pôr em" da porta única. No máximo 2 testes por caso.
 */
import { describe, expect, it } from 'vitest'
import { SISTEMA_ONE_PIECE } from '../sistemaOnePiece'
import { novoCartao, novoPersonagem, personagemDoArquivo, type CartaoDaFicha, type Personagem } from '../personagem'
import { armasDe } from '../batalha/leituraDaFicha'
import { catalogoDoArquivo, ligarPeloNome, type ItemDoCatalogo } from './catalogo'
import { ABA_DOS_ITENS, desfazerPosto, passarAbaItensParaMochila, porCoisaNaFicha, porEntradaNaFicha } from './coisaERegra'

const sistema = SISTEMA_ONE_PIECE
const abaDosItens = sistema.abas.find((aba) => aba.id === ABA_DOS_ITENS)

function cartao(nome: string, campos: Record<string, string>, extra: Partial<CartaoDaFicha> = {}): CartaoDaFicha {
  return { ...novoCartao(nome), campos, ...extra }
}

function fichaComItens(cartoes: CartaoDaFicha[], mochila: Personagem['mochila'] = undefined): Personagem {
  const ficha = novoPersonagem(sistema, 'jogador', 'Aira')
  return { ...ficha, abas: { ...ficha.abas, [ABA_DOS_ITENS]: cartoes }, ...(mochila === undefined ? {} : { mochila }) }
}

describe('passar os cartões antigos da aba Itens para a mochila', () => {
  it('3 cartões viram 3 vagas sem perder nada (quantidade, campos, extras); a aba fica vazia; rodar de novo não duplica', () => {
    const poção = cartao('Poção', { descricao: 'Cura 50 de HP', quantidade: '3' })
    const corda = cartao('Corda', { quantidade: '2 rolos', efeito: 'Amarra' }, { extras: [{ nome: 'Peso', valor: '1 kg' }] })
    const mapa = cartao('Mapa do tesouro', {})
    const antes = fichaComItens([poção, corda, mapa], [{ id: 'pin_1', nome: 'Chave de latão' }])
    const { personagem, passados, ficaram } = passarAbaItensParaMochila(antes, abaDosItens)
    expect([passados, ficaram]).toEqual([3, 0])
    expect(personagem.abas[ABA_DOS_ITENS]).toEqual([])
    const mochila = personagem.mochila ?? []
    expect(mochila.map((item) => item.nome)).toEqual(['Chave de latão', 'Poção', 'Corda', 'Mapa do tesouro'])
    expect(mochila[1]).toMatchObject({ quantidade: 3, descricao: 'Cura 50 de HP' })
    // O texto que não é número vai para a descrição, com o rótulo do campo; o extra também.
    expect(mochila[2]?.quantidade).toBeUndefined()
    expect(mochila[2]?.descricao).toContain('2 rolos')
    expect(mochila[2]?.descricao).toContain('Amarra')
    expect(mochila[2]?.descricao).toContain('Peso: 1 kg')
    // O arquivo velho abre igual: a ficha gravada e relida guarda a mochila nova.
    expect(personagemDoArquivo(JSON.parse(JSON.stringify(personagem)))?.mochila).toEqual(mochila)
    // A cópia do editor recebe a mesma mudança: mesmas vagas, nada repetido.
    expect(passarAbaItensParaMochila({ ...personagem, abas: antes.abas }, abaDosItens).personagem.mochila).toEqual(mochila)
  })

  it('o cartão com o que a mochila não guarda (modificadores) fica na aba, intacto', () => {
    const anel = cartao('Anel da força', { descricao: '+5 de Força' }, { modificadores: [{ atributo: 'forca', delta: 5 }] })
    const pão = cartao('Pão', {})
    const { personagem, passados, ficaram } = passarAbaItensParaMochila(fichaComItens([anel, pão]), abaDosItens)
    expect([passados, ficaram]).toEqual([1, 1])
    expect(personagem.abas[ABA_DOS_ITENS]).toEqual([anel])
    expect((personagem.mochila ?? []).map((item) => item.nome)).toEqual(['Pão'])
  })
})

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
