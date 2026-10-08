import { describe, expect, it } from 'vitest'
import { parseAdventure, serializeAdventure, type Adventure } from './adventure'
import { novoCartao, novoPersonagem, personagemDoArquivo, type Personagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

/**
 * SISTEMA DE RPG e PERSONAGENS no `adventure.json`: vão e voltam iguais, a
 * aventura antiga abre (e grava) sem as chaves, e o arquivo editado à mão
 * perde só o que estiver torto.
 */

const FOTO = 'data:image/webp;base64,UklGRg=='

function base(): Adventure {
  return { version: 1, id: 'adv_mar', name: 'Grand Line', startSceneId: 'porto', scenes: [{ id: 'porto', name: 'Porto', file: 'map.json' }] }
}

function aira(): Personagem {
  const personagem = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira')
  const habilidade = novoCartao('Habilidade')
  const transformacao = novoCartao('Transformação')
  return {
    ...personagem,
    descricao: 'Idade: 24\nRaça: Mink',
    retrato: FOTO,
    escolhas: { raca: 'Mink (Raposa)', oficio: 'Artista' },
    etiquetas: ['tripulação'],
    recursos: { hp: 900, sp: 120, escudo: 100 },
    atributos: { ...personagem.atributos, forca: 1, espirito: 40 },
    abas: {
      ...personagem.abas,
      habilidades: [{ ...habilidade, nome: 'A Virtude Traz Benção', campos: { descricao: 'Bênção', custo: '-45 de SP' }, extras: [{ nome: 'Requisito', valor: 'Haki' }] }],
      transformacoes: [{ ...transformacao, nome: 'Híbrido', imagem: FOTO, modificadores: [{ atributo: 'forca', delta: 25 }], subcartoes: [{ ...habilidade, id: 'sub', nome: 'Garra' }] }],
    },
  }
}

describe('adventure.json com sistema e personagens', () => {
  it('ida e volta: o sistema escolhido e cada personagem voltam iguais', () => {
    const adventure: Adventure = { ...base(), sistemaDeRpg: 'one-piece', personagens: [aira()] }
    const lida = parseAdventure(serializeAdventure(adventure))
    expect(lida.sistemaDeRpg).toBe('one-piece')
    expect(lida.personagens).toEqual(adventure.personagens)
    // Gravar de novo o que foi lido não muda o arquivo.
    expect(serializeAdventure(lida)).toBe(serializeAdventure(adventure))
  })

  it('aventura antiga abre e grava sem as chaves', () => {
    const lida = parseAdventure(serializeAdventure(base()))
    expect('sistemaDeRpg' in lida).toBe(false)
    expect('personagens' in lida).toBe(false)
    expect(serializeAdventure(lida)).not.toContain('personagens')
  })

  it('arquivo editado à mão: chave de outro tipo some, personagem sem id sai, id repetido fica o primeiro', () => {
    const json = JSON.stringify({
      ...base(),
      sistemaDeRpg: 42,
      personagens: [
        { id: 'p1', nome: 'Kian', tipo: 'jogador' },
        { nome: 'Sem id' },
        { id: 'p1', nome: 'Kian de novo' },
        'lixo',
      ],
    })
    const lida = parseAdventure(json)
    expect(lida.sistemaDeRpg).toBeUndefined()
    expect(lida.personagens?.map((personagem) => personagem.nome)).toEqual(['Kian'])
  })

  it('personagem torto: tipo desconhecido vira NPC, retrato que não é imagem embutida sai, número que não é número sai', () => {
    const personagem = personagemDoArquivo({
      id: 'p2',
      tipo: 'capitao',
      nome: '   ',
      retrato: 'C:\\Users\\mestre\\foto.png',
      recursos: { hp: 'muito', sp: 60 },
      atributos: { forca: Number.POSITIVE_INFINITY, agilidade: 33 },
      abas: { habilidades: [{ nome: 'Soco', campos: { dano: '10', ruim: 3 }, imagem: 'http://x/y.png', modificadores: [{ atributo: 'forca', delta: 'x' }] }], pericias: 'nada' },
    })
    expect(personagem).not.toBeNull()
    if (personagem === null) return
    expect(personagem.tipo).toBe('npc')
    expect(personagem.nome).toBe('Personagem sem nome')
    expect(personagem.retrato).toBeNull()
    expect(personagem.recursos).toEqual({ sp: 60 })
    expect(personagem.atributos).toEqual({ agilidade: 33 })
    expect(Object.keys(personagem.abas)).toEqual(['habilidades'])
    const [soco] = personagem.abas.habilidades
    expect(soco.campos).toEqual({ dano: '10' })
    expect(soco.imagem).toBeNull()
    expect(soco.modificadores).toEqual([])
    expect(soco.id.length).toBeGreaterThan(0)
  })
})
