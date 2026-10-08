/**
 * AJUSTE RÁPIDO NA MESA — a fronteira do que o jogador manda: o
 * `personagem.ajustar` (valor novo de cada parte, sem histórico pronto) e as
 * partes novas do "Salvar" (máximo e modificadores), cada número inteiro e no
 * teto. E as duas pontas da edição: o que sai do rascunho e o que entra no host.
 */
import { describe, expect, it } from 'vitest'
import { NUMERO_DA_FICHA_MAX } from '../lib/ajusteDaFicha'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { aplicarPartes, partesMudadas } from './edicaoDoPersonagem'
import { parsePlayerMessage } from './protocol'
import { PERSONAGEM_AJUSTES_MAX } from './protocoloDoPersonagem'

const ajustar = (ajustes: unknown) => ({ type: 'personagem.ajustar', reqId: 'a1', personagemId: 'pers_luffy', ajustes })
const editar = (partes: unknown) => ({ type: 'personagem.editar', reqId: 'p1', personagemId: 'pers_luffy', partes })

describe('personagem.ajustar: o que o host aceita', () => {
  it('cada parte com o valor novo; o cartão por id, ligado (1) ou desligado (0); modificador negativo', () => {
    const ajustes = [
      { parte: 'recurso', chave: 'hp', valor: 590 },
      { parte: 'maximo', chave: 'hp', valor: 600 },
      { parte: 'modRecurso', chave: 'sp', valor: -10 },
      { parte: 'atributo', chave: 'forca', valor: 61 },
      { parte: 'modAtributo', chave: 'forca', valor: -5 },
      { parte: 'cartao', chave: 'cart_7f3e-ab', valor: 1 },
    ]
    expect(parsePlayerMessage(ajustar(ajustes))).toEqual(ajustar(ajustes))
  })

  it.each([
    ['lista vazia', []],
    ['não é lista', { parte: 'recurso', chave: 'hp', valor: 1 }],
    ['parte inventada', [{ parte: 'historico', chave: 'hp', valor: 1 }]],
    ['chave que sai da ficha', [{ parte: 'recurso', chave: '__proto__', valor: 1 }]],
    ['chave com caminho', [{ parte: 'atributo', chave: '../forca', valor: 1 }]],
    ['número quebrado', [{ parte: 'recurso', chave: 'hp', valor: 1.5 }]],
    ['número em texto', [{ parte: 'recurso', chave: 'hp', valor: '590' }]],
    ['passa do teto', [{ parte: 'atributo', chave: 'forca', valor: NUMERO_DA_FICHA_MAX + 1 }]],
    ['cartão com 2', [{ parte: 'cartao', chave: 'cart_1', valor: 2 }]],
    ['cartão sem id', [{ parte: 'cartao', chave: '', valor: 1 }]],
    ['ajustes demais', Array.from({ length: PERSONAGEM_AJUSTES_MAX + 1 }, () => ({ parte: 'recurso', chave: 'hp', valor: 1 }))],
  ])('recusa: %s', (_caso, ajustes) => {
    expect(parsePlayerMessage(ajustar(ajustes))).toBeNull()
  })

  it('sem reqId ou sem personagem: recusa', () => {
    const certo = [{ parte: 'recurso', chave: 'hp', valor: 1 }]
    expect(parsePlayerMessage({ ...ajustar(certo), reqId: '' })).toBeNull()
    expect(parsePlayerMessage({ ...ajustar(certo), personagemId: undefined })).toBeNull()
  })
})

describe('personagem.editar: máximo e modificadores no Salvar', () => {
  it('aceita o máximo e os modificadores, chave a chave', () => {
    const partes = { maximos: { hp: 600 }, modificadoresDosRecursos: { hp: 100 }, modificadoresDosAtributos: { forca: -5 } }
    expect(parsePlayerMessage(editar(partes))).toEqual(editar(partes))
  })

  it('recusa máximo negativo e número fora do teto em qualquer registro', () => {
    expect(parsePlayerMessage(editar({ maximos: { hp: -1 } }))).toBeNull()
    expect(parsePlayerMessage(editar({ recursos: { hp: NUMERO_DA_FICHA_MAX + 1 } }))).toBeNull()
    expect(parsePlayerMessage(editar({ atributos: { forca: -NUMERO_DA_FICHA_MAX - 1 } }))).toBeNull()
  })

  it('o histórico e as transformações ligadas não viajam no Salvar', () => {
    expect(parsePlayerMessage(editar({ historico: [] }))).toBeNull()
    expect(parsePlayerMessage(editar({ cartoesAtivos: ['x'] }))).toBeNull()
  })
})

describe('as duas pontas da edição com os números novos', () => {
  const LUFFY: Personagem = { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'pers_luffy', recursos: { hp: 600, sp: 60, escudo: 0 } }

  it('o rascunho manda só o máximo e o modificador que mudaram', () => {
    const rascunho = { ...LUFFY, maximos: { hp: 700 }, modificadoresDosAtributos: { forca: 5 } }
    expect(partesMudadas(LUFFY, rascunho)).toEqual({ maximos: { hp: 700 }, modificadoresDosAtributos: { forca: 5 } })
  })

  it('o host troca chave a chave e não mexe no histórico nem nas transformações ligadas', () => {
    const agora: Personagem = {
      ...LUFFY,
      modificadoresDosRecursos: { sp: 10 },
      cartoesAtivos: ['forma'],
      historico: [{ quem: 'Mestre', parte: 'recurso', chave: 'hp', rotulo: 'HP', de: 600, para: 550, quando: 1 }],
    }
    const depois = aplicarPartes(agora, { modificadoresDosRecursos: { hp: 100 } })
    expect(depois.modificadoresDosRecursos).toEqual({ sp: 10, hp: 100 })
    expect([depois.cartoesAtivos, depois.historico]).toEqual([agora.cartoesAtivos, agora.historico])
  })
})
