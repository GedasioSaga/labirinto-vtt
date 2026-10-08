import { describe, expect, it, vi } from 'vitest'
import { atributosDoTexto, importarFichasDoProjetoRpg } from './importarDoProjetoRpg'
import { novoPersonagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

/**
 * "Importar personagens" do projeto-rpg-v2: o arquivo do Exportar de lá
 * (array de FichaExportada v1, db/portabilidade.rs) vira personagens do
 * Labirinto — só os jogadores por padrão, sem sobrescrever nome, com o
 * retrato reduzido.
 */

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const REDUZIDA = 'data:image/webp;base64,UklGRg=='

function ficha(nome: string, tipo: 'jogador' | 'npc', extra: Record<string, unknown> = {}) {
  return {
    versao: 1,
    tipo,
    nome,
    descricao: 'Idade: 21',
    hp: 1000,
    sp: 120,
    escudo: 100,
    forca: 50,
    agilidade: 33,
    percepcao: 0,
    resistencia: 0,
    intuicao: 0,
    espirito: 35,
    carisma: 0,
    determinacao: 16,
    raca: 'Lunariano',
    oficio: 'Ferreiro',
    retrato: null,
    habilidades: [],
    pericias: [],
    vantagens: [],
    desvantagens: [],
    transformacoes: [],
    etiquetas: [],
    ...extra,
  }
}

const reduzir = () => vi.fn(async (imagem: Blob) => (imagem.size > 0 ? REDUZIDA : 'nada'))

describe('importarFichasDoProjetoRpg', () => {
  it('importa só os jogadores por padrão e conta os NPCs deixados de fora', async () => {
    const json = JSON.stringify([ficha('Vagn Kane', 'jogador'), ficha('Smoker', 'npc'), ficha('Aira', 'jogador'), ficha('Barril', 'npc')])
    const resultado = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })
    expect(resultado.personagens.map((personagem) => personagem.nome)).toEqual(['Vagn Kane', 'Aira'])
    expect(resultado.personagens.every((personagem) => personagem.tipo === 'jogador')).toBe(true)
    expect(resultado.npcsIgnorados).toBe(2)
    expect(resultado.avisos).toEqual([])
  })

  it('com incluirNpcs, os NPCs entram também', async () => {
    const json = JSON.stringify([ficha('Smoker', 'npc')])
    const resultado = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir(), incluirNpcs: true })
    expect(resultado.personagens.map((personagem) => [personagem.nome, personagem.tipo])).toEqual([['Smoker', 'npc']])
  })

  it('casa os números, as escolhas e cada aba pelo nome da coluna de lá', async () => {
    const json = JSON.stringify([
      ficha('Jimboy Segundo', 'jogador', {
        habilidades: [{ nome: 'Ka-Chi', descricao: 'Soco', acao: 'Ação', efeito: '', tempo: '1', custo: '-45 de SP', dano: '200', campos_extras: [{ nome: 'Requisito', valor: 'Haki desperto' }] }],
        pericias: [
          { nome: 'Rastrear', descricao: 'Segue pistas', atributo: 'percepcao,intuicao' },
          { nome: 'Antiga', descricao: '', atributo: '(Intuição/Percepção)' },
        ],
        vantagens: [{ nome: 'Força Superior', descricao: 'Forte', efeito: '+10 dano' }],
        transformacoes: [
          {
            nome: 'NEKO NEKO NO MI Hibrido',
            descricao: 'Forma',
            retrato: { base64: PNG_1PX, formato: 'png' },
            modificadores: [{ atributo: 'forca', delta: 25 }, { atributo: 'agilidade', delta: -5 }],
            habilidades: [{ nome: 'Garra', descricao: 'Corta', tempo: '', custo: '', dano: '50' }],
          },
        ],
      }),
    ])
    const [jimboy] = (await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })).personagens
    expect(jimboy.recursos).toEqual({ hp: 1000, sp: 120, escudo: 100 })
    expect(jimboy.atributos.forca).toBe(50)
    expect(jimboy.atributos.determinacao).toBe(16)
    expect(jimboy.escolhas).toEqual({ raca: 'Lunariano', oficio: 'Ferreiro' })
    expect(jimboy.descricao).toBe('Idade: 21')

    const [kachi] = jimboy.abas.habilidades
    expect(kachi.nome).toBe('Ka-Chi')
    expect(kachi.campos).toEqual({ descricao: 'Soco', acao: 'Ação', tempo: '1', custo: '-45 de SP', dano: '200' })
    expect(kachi.extras).toEqual([{ nome: 'Requisito', valor: 'Haki desperto' }])

    expect(jimboy.abas.pericias.map((pericia) => pericia.atributos)).toEqual([
      ['percepcao', 'intuicao'],
      ['intuicao', 'percepcao'],
    ])
    expect(jimboy.abas.vantagens[0].campos).toEqual({ descricao: 'Forte', efeito: '+10 dano' })
    expect(jimboy.abas.desvantagens).toEqual([])

    const [forma] = jimboy.abas.transformacoes
    expect(forma.imagem).toBe(REDUZIDA)
    expect(forma.modificadores).toEqual([
      { atributo: 'forca', delta: 25 },
      { atributo: 'agilidade', delta: -5 },
    ])
    expect(forma.subcartoes.map((sub) => [sub.nome, sub.campos])).toEqual([['Garra', { descricao: 'Corta', dano: '50' }]])
  })

  it('nome repetido não sobrescreve: entra "Nome (2)", e a colisão é por nome E tipo', async () => {
    const existentes = [novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Aira'), novoPersonagem(SISTEMA_ONE_PIECE, 'npc', 'Kian')]
    const json = JSON.stringify([ficha('Aira', 'jogador'), ficha('Aira', 'jogador'), ficha('Kian', 'jogador')])
    const resultado = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, existentes, { reduzirImagem: reduzir() })
    expect(resultado.personagens.map((personagem) => personagem.nome)).toEqual(['Aira (2)', 'Aira (3)', 'Kian'])
    const ids = new Set([...existentes, ...resultado.personagens].map((personagem) => personagem.id))
    expect(ids.size).toBe(5)
  })

  it('retrato: reduzido pelo caminho da foto do token; o que não dá para ler vira aviso e a ficha entra sem ele', async () => {
    const reduzirImagem = reduzir()
    const json = JSON.stringify([
      ficha('Com foto', 'jogador', { retrato: { base64: PNG_1PX, formato: 'png' } }),
      ficha('Formato estranho', 'jogador', { retrato: { base64: PNG_1PX, formato: 'bmp' } }),
      ficha('Base64 quebrado', 'jogador', { retrato: { base64: '***', formato: 'jpg' } }),
    ])
    const resultado = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem })
    expect(resultado.personagens.map((personagem) => personagem.retrato)).toEqual([REDUZIDA, null, null])
    expect(reduzirImagem).toHaveBeenCalledTimes(1)
    expect(reduzirImagem.mock.calls[0][0].type).toBe('image/png')
    expect(resultado.avisos).toHaveLength(2)
    expect(resultado.avisos[0]).toContain('Formato estranho')
  })

  it('redutor que falha ou devolve algo que não é imagem embutida: aviso, sem retrato', async () => {
    const json = JSON.stringify([ficha('Pesada', 'jogador', { retrato: { base64: PNG_1PX, formato: 'png' } })])
    const falha = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: async () => Promise.reject(new Error('pesada demais')) })
    expect(falha.personagens[0].retrato).toBeNull()
    expect(falha.avisos[0]).toContain('pesada demais')
    const torta = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: async () => 'C:/foto.png' })
    expect(torta.personagens[0].retrato).toBeNull()
    expect(torta.avisos).toHaveLength(1)
  })

  it('ficha a ficha, o que não serve vira aviso; o arquivo inteiro torto lança', async () => {
    const json = JSON.stringify([ficha('Futuro', 'jogador', { versao: 2 }), ficha('', 'jogador'), { ...ficha('Pirata', 'jogador'), tipo: 'capitao' }, 7, ficha('Certa', 'jogador')])
    const resultado = await importarFichasDoProjetoRpg(json, SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })
    expect(resultado.personagens.map((personagem) => personagem.nome)).toEqual(['Certa'])
    expect(resultado.avisos).toHaveLength(4)
    await expect(importarFichasDoProjetoRpg('{quebrado', SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })).rejects.toThrow('JSON')
    await expect(importarFichasDoProjetoRpg('42', SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })).rejects.toThrow('lista de fichas')
  })

  it('uma ficha solta (objeto, não lista) também entra', async () => {
    const resultado = await importarFichasDoProjetoRpg(JSON.stringify(ficha('Sozinha', 'jogador')), SISTEMA_ONE_PIECE, [], { reduzirImagem: reduzir() })
    expect(resultado.personagens.map((personagem) => personagem.nome)).toEqual(['Sozinha'])
  })
})

describe('atributosDoTexto', () => {
  it('lê CSV de slugs, texto antigo com nome e acento, "e/ou" e abreviação; ignora o que não casa', () => {
    expect(atributosDoTexto('percepcao,intuicao', SISTEMA_ONE_PIECE)).toEqual(['percepcao', 'intuicao'])
    expect(atributosDoTexto('Força e/ou Percepção', SISTEMA_ONE_PIECE)).toEqual(['forca', 'percepcao'])
    expect(atributosDoTexto('AGI; Espírito ou sorte', SISTEMA_ONE_PIECE)).toEqual(['agilidade', 'espirito'])
    expect(atributosDoTexto('', SISTEMA_ONE_PIECE)).toEqual([])
  })
})
