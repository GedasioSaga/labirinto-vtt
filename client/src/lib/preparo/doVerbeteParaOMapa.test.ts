/**
 * DO VERBETE PARA A FICHA E PARA O MAPA (E3, 16/11/2026): o item de mesmo
 * nome no Acervo é reaproveitado; o "!" de um lugar só leva imagem (e a
 * animação do cenário) quando ela pode ir ao jogador; e seção de segredo
 * nunca entra na descrição do NPC nem no texto do "!".
 */
import { describe, expect, it } from 'vitest'
import type { Pin } from '../../types/map'
import { verbeteNovo } from './enciclopedia'
import { campanhaComPastaDoVerbete, campanhaParaLigar, descricaoDoNpc, itemComOMesmoNome, pastaDeMesmoNome, textoDoLugar } from './doVerbeteParaOMapa'
import { pinoDoLugar } from './pinoDoLugar'
import type { Campanha, Secao, TextoRico, Verbete } from './tipos'

const texto = (frase: string): TextoRico => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: frase }] }] })
const secao = (id: string, titulo: string, frase: string, segredo = false): Secao => ({ id, titulo, texto: texto(frase), segredo })

function comSecoes(tipo: 'personagem' | 'lugar', resumo: string, secoes: Secao[]): Verbete {
  const verbete = verbeteNovo(tipo, 'Farol de Areia Alta', { campanhas: [] }, (prefixo) => `${prefixo}_teste`)
  const [forma] = verbete.formas
  if (forma === undefined) throw new Error('verbeteNovo sempre nasce com uma forma')
  return { ...verbete, formas: [{ ...forma, resumo, secoes }] }
}

const PINO: Pin = { id: 'p1', x: 10, y: 20, kind: 'interrogacao', description: '', image: null }

describe('a campanha e a pasta da ficha (pedido 6 de 17/11)', () => {
  const OP: Campanha = { id: 'c_op', nome: 'One Piece' }
  const DB: Campanha = { id: 'c_db', nome: 'Dragon Ball', pastaId: 'pasta_db' }
  const GEO: Campanha = { id: 'c_geo', nome: 'Geonova', pastaId: 'pasta_geo' }

  it('a campanha escolhida na barra lateral vence quando o verbete é de várias; sem ela, a ordem do índice', () => {
    const deTres = { campanhas: ['c_op', 'c_db', 'c_geo'] }
    expect(campanhaComPastaDoVerbete(deTres, [OP, DB, GEO], 'c_geo')?.pastaId).toBe('pasta_geo')
    expect(campanhaComPastaDoVerbete(deTres, [OP, DB, GEO], null)?.pastaId).toBe('pasta_db')
    // A escolhida sem pasta não esconde a outra que tem.
    expect(campanhaComPastaDoVerbete(deTres, [OP, DB, GEO], 'c_op')?.pastaId).toBe('pasta_db')
    expect(campanhaComPastaDoVerbete({ campanhas: ['c_op'] }, [OP, DB, GEO], 'c_db')).toBeNull()
  })

  it('"Usar a pasta One Piece": a campanha a ligar e a pasta de mesmo nome, sem acento nem caixa', () => {
    const pastas = [
      { id: 'pasta_db', nome: 'Dragon Ball' },
      { id: 'pasta_op', nome: 'one  piéce' },
    ]
    expect(pastaDeMesmoNome(pastas, OP.nome)?.id).toBe('pasta_op')
    expect(pastaDeMesmoNome(pastas, 'Geonova')).toBeNull()
    expect(campanhaParaLigar({ campanhas: ['c_db', 'c_op'] }, [OP, DB], 'c_op')?.id).toBe('c_op')
    expect(campanhaParaLigar({ campanhas: ['c_db', 'c_op'] }, [OP, DB], null)?.id).toBe('c_op')
    expect(campanhaParaLigar({ campanhas: [] }, [OP, DB], 'c_op')).toBeNull()
  })
})

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
