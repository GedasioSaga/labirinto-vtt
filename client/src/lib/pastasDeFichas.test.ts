import { describe, expect, it } from 'vitest'
import { novaVariacao } from './livros/combate'
import { moverFichaParaPasta, organizarFichas, pastasDeFichasDoArquivo, type PastaDeFichas } from './pastasDeFichas'
import { novoPersonagem, type Personagem } from './personagem'
import { SISTEMA_ONE_PIECE } from './sistemaOnePiece'

function ficha(tipo: 'jogador' | 'npc', nome: string, id: string, extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, tipo, nome), id, ...extra }
}

const nomes = (linhas: readonly { personagem: Personagem }[]) => linhas.map((linha) => linha.personagem.nome)

describe('organizarFichas: grupos, pastas do mestre, cópias e busca', () => {
  const harvey = ficha('jogador', 'Harvey Specter', 'p-harvey')
  const jimboy = ficha('npc', 'Jimboy', 'p-jimboy')
  const urso = ficha('npc', 'Urso', 'p-urso')
  const soldado = ficha('npc', 'Soldado da Marinha', 'p-soldado', { combate: { forca: 1 } })
  const copia = { ...novaVariacao(urso, 'Urso Pardo'), id: 'p-urso-2' }
  const todos = [soldado, copia, urso, harvey, jimboy]

  it('jogador, NPC e inimigo em grupos; a pasta do mestre ganha do grupo; a cópia anda embaixo do modelo', () => {
    const pastas: PastaDeFichas[] = [{ id: 'f1', nome: 'Floresta', fichas: ['p-urso'] }, { id: 'f2', nome: 'Vazia', fichas: [] }]
    const org = organizarFichas(todos, pastas, '')
    expect(org.pastas.map((item) => [item.pasta.nome, nomes(item.linhas)])).toEqual([
      ['Floresta', ['Urso']],
      ['Vazia', []],
    ])
    expect(org.pastas[0].linhas[0].copias.map((c) => c.nome)).toEqual(['Urso Pardo'])
    expect(org.grupos.map((item) => [item.grupo, nomes(item.linhas)])).toEqual([
      ['jogadores', ['Harvey Specter']],
      ['npcs', ['Jimboy']],
      ['inimigos', ['Soldado da Marinha']],
    ])
  })

  it('a busca ignora acento e caixa; a cópia que bate traz o modelo junto; pasta e grupo sem nada somem', () => {
    const marinha = ficha('npc', 'Capitão Smóker', 'p-smoker')
    const org = organizarFichas([...todos, marinha], [{ id: 'f1', nome: 'Floresta', fichas: ['p-urso'] }], 'SMOKER')
    expect(org.pastas).toEqual([])
    expect(org.grupos.map((item) => [item.grupo, nomes(item.linhas)])).toEqual([['npcs', ['Capitão Smóker']]])
    const pardo = organizarFichas(todos, [], 'pardo')
    expect(pardo.grupos.map((item) => nomes(item.linhas))).toEqual([['Urso']])
    expect(pardo.grupos[0].linhas[0].copias.map((c) => c.id)).toEqual(['p-urso-2'])
    expect(pardo.vistas).toBe(2)
  })
})

describe('pastas do mestre: mover e ler do disco', () => {
  it('mover tira de toda pasta e põe na escolhida; null devolve ao grupo; repetir não muda nada', () => {
    const pastas: PastaDeFichas[] = [{ id: 'a', nome: 'Floresta', fichas: ['x'] }, { id: 'b', nome: 'Marinha', fichas: [] }]
    const movida = moverFichaParaPasta(pastas, 'x', 'b')
    expect(movida.map((pasta) => pasta.fichas)).toEqual([[], ['x']])
    expect(moverFichaParaPasta(movida, 'x', 'b')).toBe(movida)
    expect(moverFichaParaPasta(movida, 'x', null).map((pasta) => pasta.fichas)).toEqual([[], []])
  })

  it('o arquivo torto: entrada sem id sai, id repetido sai, a ficha em duas pastas fica só na primeira, nome vazio vira "Pasta nova"', () => {
    const lidas = pastasDeFichasDoArquivo([
      { id: 'a', nome: 'Floresta', fichas: ['x', 'y', 7] },
      { nome: 'sem id', fichas: [] },
      { id: 'a', nome: 'repetida', fichas: [] },
      { id: 'b', nome: '   ', fichas: ['y', 'z'] },
    ])
    expect(lidas).toEqual([
      { id: 'a', nome: 'Floresta', fichas: ['x', 'y'] },
      { id: 'b', nome: 'Pasta nova', fichas: ['z'] },
    ])
    expect(pastasDeFichasDoArquivo('lixo')).toBeUndefined()
  })
})
