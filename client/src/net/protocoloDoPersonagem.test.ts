/**
 * FICHA DE PERSONAGEM NA MESA — a fronteira do protocolo. O que o jogador
 * manda é hostil: forma torta, texto acima do teto, chave que não é id,
 * imagem que não é foto embutida, cartão com imagem dentro ou subcartão sem
 * fundo — tudo recusa a mensagem INTEIRA. O que o host manda é lido com a
 * mesma tolerância do arquivo.
 */
import { describe, expect, it } from 'vitest'
import { PLAYER_MESSAGE_MAX_BYTES, parsePlayerMessage } from './protocol'
import {
  PERSONAGEM_CARTOES_MAX,
  PERSONAGEM_CHAVES_MAX,
  PERSONAGEM_ETIQUETAS_MAX,
  PERSONAGEM_NOME_MAX,
  PERSONAGEM_TEXTO_MAX,
  parsePersonagemResultado,
  parsePersonagensMessage,
  parseSistemaDeRpgMessage,
} from './protocoloDoPersonagem'
import { TOKEN_PHOTO_SEND_MAX_CHARS } from '../lib/tokenPhoto'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'

const FOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

const cartao = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: 'Soco', campos: { descricao: 'Bate.' }, extras: [], atributos: [], modificadores: [], subcartoes: [], ...extra })

const editar = (partes: unknown) => ({ type: 'personagem.editar', reqId: 'p1', personagemId: 'pers_1', partes })

describe('personagem.editar — o que passa', () => {
  it('aceita só as partes que vieram, inteiras', () => {
    const partes = {
      nome: 'Luffy',
      descricao: 'Capitão.',
      etiquetas: ['Chapéu de Palha'],
      escolhas: { raca: 'Humano' },
      recursos: { hp: 120 },
      atributos: { forca: 45 },
      abas: { habilidades: [cartao('cart_1', { subcartoes: [cartao('cart_2')] })] },
    }
    expect(parsePlayerMessage(editar(partes))).toEqual(editar(partes))
    expect(parsePlayerMessage(editar({ atributos: { forca: -3 } }))).toEqual(editar({ atributos: { forca: -3 } }))
  })

  it('nome vazio passa (o host o troca por "Personagem sem nome")', () => {
    expect(parsePlayerMessage(editar({ nome: '' }))).toEqual(editar({ nome: '' }))
  })
})

describe('personagem.editar — o que cai inteiro', () => {
  const recusadas: [string, unknown][] = [
    ['sem parte nenhuma', {}],
    ['partes que não são objeto', ['nome']],
    ['nome acima do teto', { nome: 'a'.repeat(PERSONAGEM_NOME_MAX + 1) }],
    ['descrição acima do teto', { descricao: 'a'.repeat(PERSONAGEM_TEXTO_MAX + 1) }],
    ['nome que não é texto', { nome: 42 }],
    ['etiquetas demais', { etiquetas: Array.from({ length: PERSONAGEM_ETIQUETAS_MAX + 1 }, (_, i) => `e${i}`) }],
    ['etiqueta vazia', { etiquetas: [''] }],
    ['atributo que não é inteiro', { atributos: { forca: 1.5 } }],
    ['atributo fora do inteiro seguro', { atributos: { forca: Number.MAX_SAFE_INTEGER + 2 } }],
    ['atributo em texto', { atributos: { forca: '10' } }],
    ['chave __proto__', JSON.parse('{"atributos":{"__proto__":1}}')],
    ['chave com ponto e barra', { atributos: { '../x': 1 } }],
    ['chaves demais', { recursos: Object.fromEntries(Array.from({ length: PERSONAGEM_CHAVES_MAX + 1 }, (_, i) => [`r${i}`, 1])) }],
    ['cartão com imagem (ela vai sozinha)', { abas: { habilidades: [cartao('c1', { imagem: FOTO })] } }],
    ['cartão sem id', { abas: { habilidades: [cartao('')] } }],
    ['cartão sem campos', { abas: { habilidades: [{ id: 'c1', nome: 'X' }] } }],
    ['subcartão dentro de subcartão', { abas: { t: [cartao('c1', { subcartoes: [cartao('c2', { subcartoes: [cartao('c3')] })] })] } }],
    ['cartão com id repetido (com o subcartão)', { abas: { t: [cartao('c1', { subcartoes: [cartao('c1')] })] } }],
    ['cartões demais na aba', { abas: { t: Array.from({ length: PERSONAGEM_CARTOES_MAX + 1 }, (_, i) => cartao(`c${i}`)) } }],
    ['campo de cartão acima do teto', { abas: { t: [cartao('c1', { campos: { descricao: 'a'.repeat(PERSONAGEM_TEXTO_MAX + 1) } })] } }],
    ['modificador com delta torto', { abas: { t: [cartao('c1', { modificadores: [{ atributo: 'forca', delta: 'muito' }] })] } }],
    ['aba que não é lista', { abas: { t: 'cartões' } }],
  ]
  it.each(recusadas)('%s', (_, partes) => {
    expect(parsePlayerMessage(editar(partes))).toBeNull()
  })

  it('sem reqId ou sem personagem', () => {
    expect(parsePlayerMessage({ type: 'personagem.editar', personagemId: 'pers_1', partes: { nome: 'A' } })).toBeNull()
    expect(parsePlayerMessage({ type: 'personagem.editar', reqId: 'p1', partes: { nome: 'A' } })).toBeNull()
  })
})

describe('personagem.imagem e personagem.criar', () => {
  it('retrato e imagem de cartão: só foto embutida no teto de envio', () => {
    expect(parsePlayerMessage({ type: 'personagem.imagem', reqId: 'p1', personagemId: 'pers_1', imagem: FOTO })).toEqual({ type: 'personagem.imagem', reqId: 'p1', personagemId: 'pers_1', imagem: FOTO })
    expect(parsePlayerMessage({ type: 'personagem.imagem', reqId: 'p1', personagemId: 'pers_1', cartaoId: 'c1', imagem: null })).toEqual({
      type: 'personagem.imagem',
      reqId: 'p1',
      personagemId: 'pers_1',
      cartaoId: 'c1',
      imagem: null,
    })
  })

  it('caminho de disco, endereço, script e foto acima do teto de envio caem', () => {
    const grande = `data:image/png;base64,${'A'.repeat(TOKEN_PHOTO_SEND_MAX_CHARS)}`
    for (const imagem of ['C:\\fotos\\luffy.png', 'http://intranet/luffy.png', 'javascript:alert(1)', grande, undefined]) {
      expect(parsePlayerMessage({ type: 'personagem.imagem', reqId: 'p1', personagemId: 'pers_1', imagem })).toBeNull()
    }
  })

  it('criar pede só a ficha (token): sem ela, ou com id longo demais, cai', () => {
    expect(parsePlayerMessage({ type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-ana' })).toEqual({ type: 'personagem.criar', reqId: 'p1', tokenId: 'tok-ana' })
    expect(parsePlayerMessage({ type: 'personagem.criar', reqId: 'p1' })).toBeNull()
    expect(parsePlayerMessage({ type: 'personagem.criar', reqId: 'p1', tokenId: 'x'.repeat(65) })).toBeNull()
  })

  it('a maior edição que o parser aceita num campo cabe no teto do servidor', () => {
    const maior = editar({ descricao: 'é'.repeat(PERSONAGEM_TEXTO_MAX) })
    expect(parsePlayerMessage(maior)).not.toBeNull()
    expect(new TextEncoder().encode(JSON.stringify(maior)).length).toBeLessThan(PLAYER_MESSAGE_MAX_BYTES)
  })
})

describe('o que o host manda, lido no jogador', () => {
  it('personagens: o personagem torto sai, a lista que não é lista recusa', () => {
    const lida = parsePersonagensMessage({
      type: 'personagens',
      personagens: [{ id: 'pers_1', tipo: 'jogador', nome: 'Luffy' }, { nome: 'sem id' }],
      tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: 'pers_1' }, { tokenId: 'tok-x', nome: 'X', personagemId: 3 }],
    })
    expect(lida?.personagens.map((p) => p.id)).toEqual(['pers_1'])
    expect(lida?.tokens).toEqual([{ tokenId: 'tok-ana', nome: 'Ana', personagemId: 'pers_1' }])
    expect(parsePersonagensMessage({ type: 'personagens', personagens: 'x', tokens: [] })).toBeNull()
  })

  it('rpg.sistema: o sistema passa pelo leitor do arquivo; o que ele recusa vira "sem sistema"', () => {
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: SISTEMA_ONE_PIECE })?.sistema?.id).toBe(SISTEMA_ONE_PIECE.id)
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: { id: 'x' } })).toEqual({ type: 'rpg.sistema', sistema: null })
    expect(parseSistemaDeRpgMessage({ type: 'rpg.sistema', sistema: null })).toEqual({ type: 'rpg.sistema', sistema: null })
  })

  it('personagem.resultado', () => {
    expect(parsePersonagemResultado({ type: 'personagem.resultado', reqId: 'p1', ok: true, personagemId: 'pers_9' })).toEqual({ type: 'personagem.resultado', reqId: 'p1', ok: true, personagemId: 'pers_9' })
    expect(parsePersonagemResultado({ type: 'personagem.resultado', reqId: 'p1', ok: 'sim' })).toBeNull()
  })
})
