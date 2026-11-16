/**
 * DO VERBETE PARA A FICHA E PARA O MAPA (E3, 16/11/2026): o item de mesmo
 * nome no Acervo é reaproveitado; o "!" de um lugar só leva imagem (e a
 * animação do cenário) quando ela pode ir ao jogador; e seção de segredo
 * nunca entra na descrição do NPC nem no texto do "!".
 */
import { describe, expect, it } from 'vitest'
import type { Pin } from '../../types/map'
import { verbeteNovo } from './enciclopedia'
import { descricaoDoNpc, itemComOMesmoNome, textoDoLugar } from './doVerbeteParaOMapa'
import { pinoDoLugar } from './pinoDoLugar'
import type { Secao, TextoRico, Verbete } from './tipos'

const texto = (frase: string): TextoRico => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: frase }] }] })
const secao = (id: string, titulo: string, frase: string, segredo = false): Secao => ({ id, titulo, texto: texto(frase), segredo })

function comSecoes(tipo: 'personagem' | 'lugar', resumo: string, secoes: Secao[]): Verbete {
  const verbete = verbeteNovo(tipo, 'Farol de Areia Alta', { campanhas: [] }, (prefixo) => `${prefixo}_teste`)
  const [forma] = verbete.formas
  if (forma === undefined) throw new Error('verbeteNovo sempre nasce com uma forma')
  return { ...verbete, formas: [{ ...forma, resumo, secoes }] }
}

const PINO: Pin = { id: 'p1', x: 10, y: 20, kind: 'interrogacao', description: '', image: null }

describe('itemComOMesmoNome', () => {
  it('reaproveita o item do Acervo de mesmo nome, sem acento nem caixa, e não inventa quando não há', () => {
    const itens = [
      { id: 'a', nome: 'Den Den Mushi' },
      { id: 'b', nome: 'Lâmina  de Sal' },
    ]
    expect(itemComOMesmoNome(itens, 'lamina de sal')?.id).toBe('b')
    expect(itemComOMesmoNome(itens, 'Lâmina de Ferro')).toBeNull()
    expect(itemComOMesmoNome(itens, '   ')).toBeNull()
  })
})

describe('pinoDoLugar', () => {
  it('leva a imagem com a animação do cenário só quando a imagem é data URL', () => {
    const seguro = pinoDoLugar(PINO, { nome: 'Farol', texto: 'A luz gira.', imagem: 'data:image/webp;base64,AAAA' })
    expect(seguro).toMatchObject({ kind: 'exclamacao', nome: 'Farol', description: 'A luz gira.', image: 'data:image/webp;base64,AAAA' })
    expect(seguro.cenario?.quando).toBe('primeira')
    const caminho = pinoDoLugar(PINO, { nome: 'Farol', texto: 'A luz gira.', imagem: 'C:/Users/mestre/farol.png' })
    expect(caminho.image).toBeNull()
    expect(caminho.cenario).toBeUndefined()
  })
})

describe('segredo barrado', () => {
  it('o Segredo não entra na descrição do NPC nem no texto do lugar', () => {
    const npc = comSecoes('personagem', 'Ladrão de mapas.', [secao('s1', 'Segredo', 'É filho do capitão.', true), secao('s2', 'Aparência', 'Chapéu de palha.')])
    const [formaDoNpc] = npc.formas
    if (formaDoNpc === undefined) throw new Error('forma')
    const descricao = descricaoDoNpc(npc, formaDoNpc, new Map([[npc.id, npc]]))
    expect(descricao).toBe('Ladrão de mapas.\n\nChapéu de palha.')

    // Sem Resumo, o "!" pega a primeira seção que pode sair, pulando o segredo.
    const lugar = comSecoes('lugar', '', [secao('s1', 'Segredo', 'O tesouro está embaixo.', true), secao('s2', 'Descrição', 'Fica no fim da estrada.')])
    const [formaDoLugar] = lugar.formas
    if (formaDoLugar === undefined) throw new Error('forma')
    const doLugar = textoDoLugar(lugar, formaDoLugar, new Map([[lugar.id, lugar]]))
    expect(doLugar).toBe('Fica no fim da estrada.')
    expect(doLugar).not.toContain('tesouro')
  })
})
