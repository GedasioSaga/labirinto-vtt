import { describe, expect, it } from 'vitest'
import {
  avisoDaSalaQueNaoAbriu,
  avisoDoCorredorAberto,
  deleteSelectionLabel,
  PAREDE_TRAVADA_SEGURA_O_VAO_TEXT,
  PORTA_NO_ENCOSTE_TEXT,
  SALA_SECRETA_NAO_ABRE_TEXT,
  SALA_TRAVADA_NAO_ABRE_TEXT,
  SELECTION_LABELS,
  STAIR_CLICK_WITHOUT_DRAG_TEXT,
  TOOLBAR_SLOTS,
  TOOL_CLUSTERS,
  TOOL_HINTS,
  TOOL_LABELS,
  toolsOfSlot,
} from './labels'
import { DRAWING_SHAPE_GROUP } from '../lib/toolVariants'
import type { DrawingTool, SelectionKind } from '../types/tools'

describe('botão Desenho e posições da barra', () => {
  it('rótulos do grupo Forma são iguais a TOOL_LABELS', () => {
    for (const option of DRAWING_SHAPE_GROUP.options) {
      expect(option.label, option.value).toBe(TOOL_LABELS[option.value])
    }
    expect(DRAWING_SHAPE_GROUP.options.map((o) => o.value)).toEqual(TOOL_CLUSTERS.drawing.tools)
  })

  it('TOOLBAR_SLOTS cobre cada ferramenta visível exatamente 1 vez (token escondido fica fora)', () => {
    const inBar = TOOLBAR_SLOTS.flat().flatMap(toolsOfSlot)
    expect(new Set(inBar).size).toBe(inBar.length)
    const visible = (Object.keys(TOOL_LABELS) as DrawingTool[]).filter((tool) => tool !== 'token')
    expect([...inBar].sort()).toEqual([...visible].sort())
    expect(inBar).not.toContain('token')
  })
})

const ALL_KINDS: SelectionKind[] = ['token', 'wall', 'light', 'region', 'stair', 'prop', 'drawing', 'floor']

describe('deleteSelectionLabel', () => {
  it('escada tem rótulo (antes: "Apagar undefined selecionada(o)")', () => {
    expect(deleteSelectionLabel('stair')).toBe('Apagar escada selecionada')
  })

  it('gênero certo por tipo', () => {
    expect(deleteSelectionLabel('token')).toBe('Apagar token selecionado')
    expect(deleteSelectionLabel('wall')).toBe('Apagar parede selecionada')
    expect(deleteSelectionLabel('light')).toBe('Apagar luz selecionada')
    expect(deleteSelectionLabel('region')).toBe('Apagar região selecionada')
    expect(deleteSelectionLabel('prop')).toBe('Apagar peça selecionada')
    expect(deleteSelectionLabel('drawing')).toBe('Apagar desenho selecionado')
    expect(deleteSelectionLabel('floor')).toBe('Apagar peça de chão selecionada')
  })

  it('todo SelectionKind tem entrada, e nenhum rótulo sai com "undefined" ou "(o)"', () => {
    for (const kind of ALL_KINDS) {
      expect(SELECTION_LABELS[kind], kind).toBeDefined()
      expect(deleteSelectionLabel(kind), kind).not.toMatch(/undefined|\(o\)/)
    }
  })
})

describe('aviso do clique parado com a Escada', () => {
  it('não é a dica da barra repetida: a dica já estava na tela quando a pessoa clicou', () => {
    const dica = TOOL_HINTS.stair
    expect(dica).toBeDefined()
    expect(STAIR_CLICK_WITHOUT_DRAG_TEXT).not.toBe(dica)
  })

  it('diz que o gesto falhou e qual é o gesto certo', () => {
    // Uma pessoa que só lê "arraste" fica sem saber se a escada nasceu; uma que
    // só lê "não deu" fica sem saber o que fazer. Precisa das duas metades.
    expect(STAIR_CLICK_WITHOUT_DRAG_TEXT).toMatch(/n[ãa]o deu|n[ãa]o foi poss[íi]vel|n[ãa]o criou/i)
    expect(STAIR_CLICK_WITHOUT_DRAG_TEXT).toMatch(/arrast/i)
  })
})

describe('avisos do "Abrir para o corredor"', () => {
  it('diz o nome da sala e quantos corredores, sem concordar com o gênero do nome', () => {
    // "Porão aberta" sairia errado: o texto concorda com "vão", nunca com o nome que o mestre deu.
    expect(avisoDoCorredorAberto('Sala 3', 1)).toBe('Vão aberto entre Sala 3 e o corredor. Ctrl+Z desfaz.')
    expect(avisoDoCorredorAberto('Porão', 2)).toBe('2 vãos abertos entre Porão e os corredores. Ctrl+Z desfaz.')
  })

  it('sala sem nome vira "a sala"', () => {
    expect(avisoDoCorredorAberto('   ', 1)).toBe('Vão aberto entre a sala e o corredor. Ctrl+Z desfaz.')
  })

  it('cada recusa tem o seu aviso; "nada" a abrir não avisa', () => {
    expect(avisoDaSalaQueNaoAbriu('nada', false)).toBeNull()
    expect(avisoDaSalaQueNaoAbriu('porta', false)).toBe(PORTA_NO_ENCOSTE_TEXT)
    expect(avisoDaSalaQueNaoAbriu('secreta', false)).toBe(SALA_SECRETA_NAO_ABRE_TEXT)
    expect(avisoDaSalaQueNaoAbriu('travada', false)).toBe(PAREDE_TRAVADA_SEGURA_O_VAO_TEXT)
    expect(avisoDaSalaQueNaoAbriu('travada', true)).toBe(SALA_TRAVADA_NAO_ABRE_TEXT)
  })

  it('toda recusa diz que nada foi aberto e o que fazer para abrir', () => {
    for (const texto of [PORTA_NO_ENCOSTE_TEXT, SALA_TRAVADA_NAO_ABRE_TEXT, SALA_SECRETA_NAO_ABRE_TEXT]) {
      expect(texto).toMatch(/nada foi aberto/i)
      expect(texto).toMatch(/tente de novo/i)
    }
  })
})
