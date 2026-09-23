import { describe, expect, it } from 'vitest'
import { buildToolByLetter, hiddenTools, resolveShortcut, TOOL_SHORTCUTS } from './keymap'
import { FEATURES } from './features'
import type { ShortcutEvent } from './keymap'
import type { DrawingTool } from '../types/tools'

// Builder com defaults "sem modificador, fora de campo de texto" — cada
// teste só sobrescreve o que importa pro caso.
function evt(overrides: Partial<ShortcutEvent>): ShortcutEvent {
  return {
    key: '',
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    targetTagName: '',
    ...overrides,
  }
}

describe('resolveShortcut — letras de ferramenta', () => {
  // Tabela completa duplicada aqui de propósito (não deriva de
  // TOOL_SHORTCUTS): é o contrato que o integrador vê no tooltip, então o
  // teste prova o round-trip letra→ferramenta pra cada uma das 21, não só
  // reflete a tabela de volta pra ela mesma.
  const ALL_TOOLS: Array<[DrawingTool, string]> = [
    ['select', 'V'],
    ['wall', 'W'],
    ['door', 'D'],
    ['light', 'H'],
    ['region', 'G'],
    ['room', 'N'],
    ['roomCircle', 'J'],
    ['roomPolygon', 'Q'],
    ['stair', 'S'],
    // token/K fica fora do laço: a ferramenta está escondida (FEATURES.tokenTool);
    // os testes de K logo abaixo cobrem os dois estados.
    ['prop', 'B'],
    ['brush', 'P'],
    ['line', 'L'],
    ['circle', 'C'],
    ['ellipse', 'O'],
    ['rect', 'R'],
    ['polygon', 'A'],
    ['curve', 'U'],
    ['text', 'T'],
    ['measure', 'M'],
    ['eraser', 'E'],
    ['floor', 'I'],
    ['concealZone', 'X'],
    ['pin', 'Y'],
  ]

  it('TOOL_SHORTCUTS cobre exatamente as 25 ferramentas esperadas, sem duplicar letra', () => {
    // Do laço saem TRÊS: token, que continua na tabela mesmo escondida;
    // roomFree, que ficou SEM letra na integração de 17/09/2026 — ela e o Pino
    // escolheram 'Y' em árvores separadas, e duas ferramentas na mesma letra
    // fariam o índice perder uma em silêncio; e Caminho, que chegou quando já
    // não sobrava letra nenhuma (F é "enquadrar tudo", Z fica com o Ctrl+Z).
    expect(Object.keys(TOOL_SHORTCUTS)).toHaveLength(ALL_TOOLS.length + 3)
    expect(TOOL_SHORTCUTS.token).toBe('K')
    expect(TOOL_SHORTCUTS.roomFree).toBe('')
    expect(TOOL_SHORTCUTS.path).toBe('')
    const letters = Object.values(TOOL_SHORTCUTS).filter((l) => l.length > 0)
    expect(new Set(letters).size).toBe(letters.length)
  })

  it('Sala livre não tem letra: o índice não a alcança, só a barra', () => {
    const porLetra = buildToolByLetter(new Set())
    expect([...porLetra.values()]).not.toContain('roomFree')
    expect(porLetra.has('')).toBe(false)
  })

  it('Caminho também não tem letra: nenhuma tecla o ativa, e ele não rouba a de ninguém', () => {
    const porLetra = buildToolByLetter(new Set())
    expect([...porLetra.values()]).not.toContain('path')
    // Controle positivo do mesmo índice: quem TEM letra continua alcançável,
    // senão este teste passaria com um índice vazio.
    expect(porLetra.get('i')).toBe('floor')
  })

  it('k devolve null: a ferramenta Token está escondida', () => {
    expect(resolveShortcut(evt({ key: 'k' }))).toBeNull()
    expect(resolveShortcut(evt({ key: 'K' }))).toBeNull()
  })

  it('buildToolByLetter(vazio) mapeia k para token (religar é trocar a flag)', () => {
    expect(buildToolByLetter(new Set()).get('k')).toBe('token')
    expect(buildToolByLetter(hiddenTools({ ...FEATURES, tokenTool: true })).get('k')).toBe('token')
    expect(buildToolByLetter(hiddenTools(FEATURES)).has('k')).toBe(false)
  })

  for (const [tool, letter] of ALL_TOOLS) {
    it(`${letter} (minúscula) seleciona ${tool}`, () => {
      expect(TOOL_SHORTCUTS[tool]).toBe(letter)
      expect(resolveShortcut(evt({ key: letter.toLowerCase() }))).toEqual({ kind: 'selectTool', tool })
    })

    it(`${letter} (maiúscula, ex. caps lock) também seleciona ${tool}`, () => {
      expect(resolveShortcut(evt({ key: letter }))).toEqual({ kind: 'selectTool', tool })
    })
  }

  it('letra desconhecida (sem tool nem ação) devolve null', () => {
    // 'x' virou a Zona oculta (A5) e 'y' o Pino; Z segue livre, reservada ao
    // Ctrl+Z. A Sala livre ficou sem letra nenhuma (ver o teste acima).
    expect(resolveShortcut(evt({ key: 'z' }))).toBeNull()
  })

  it('Shift+letra de ferramenta não troca de ferramenta (Shift é reservado)', () => {
    expect(resolveShortcut(evt({ key: 'v', shiftKey: true }))).toBeNull()
  })

  it('Alt+letra de ferramenta não troca de ferramenta (Alt é reservado)', () => {
    expect(resolveShortcut(evt({ key: 'w', altKey: true }))).toBeNull()
  })
})

describe('resolveShortcut — REGRA CRÍTICA: foco em campo de texto', () => {
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    it(`${tagName} focado: letra de ferramenta (V) devolve null, não troca de ferramenta`, () => {
      expect(resolveShortcut(evt({ key: 'v', targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: F (enquadrar) devolve null`, () => {
      expect(resolveShortcut(evt({ key: 'f', targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: seta (nudge) devolve null — não deve roubar o cursor de texto`, () => {
      expect(resolveShortcut(evt({ key: 'ArrowLeft', targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: Delete/Backspace devolve null — não deve apagar objeto ao editar texto`, () => {
      expect(resolveShortcut(evt({ key: 'Delete', targetTagName: tagName }))).toBeNull()
      expect(resolveShortcut(evt({ key: 'Backspace', targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: Ctrl+A devolve null — deixa o campo selecionar o próprio texto`, () => {
      expect(resolveShortcut(evt({ key: 'a', ctrlKey: true, targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: Ctrl+Z devolve null — deixa o campo desfazer o próprio texto`, () => {
      expect(resolveShortcut(evt({ key: 'z', ctrlKey: true, targetTagName: tagName }))).toBeNull()
    })

    it(`${tagName} focado: Escape AINDA cancela (não é letra, não interfere em digitação)`, () => {
      expect(resolveShortcut(evt({ key: 'Escape', targetTagName: tagName }))).toEqual({ kind: 'cancel' })
    })
  }

  it('digitar "wave" (w, a, v, e) num INPUT nunca troca de ferramenta', () => {
    for (const letter of ['w', 'a', 'v', 'e']) {
      expect(resolveShortcut(evt({ key: letter, targetTagName: 'INPUT' }))).toBeNull()
    }
  })
})

describe('resolveShortcut — ações globais (Ctrl/Cmd)', () => {
  it('Ctrl+D duplica (não seleciona a ferramenta Porta, que também é D)', () => {
    expect(resolveShortcut(evt({ key: 'd', ctrlKey: true }))).toEqual({ kind: 'duplicate' })
  })

  it('Cmd+D (metaKey, mac) também duplica', () => {
    expect(resolveShortcut(evt({ key: 'd', metaKey: true }))).toEqual({ kind: 'duplicate' })
  })

  it('Ctrl+S salva (não seleciona a ferramenta Escada, que também é S)', () => {
    expect(resolveShortcut(evt({ key: 's', ctrlKey: true }))).toEqual({ kind: 'save' })
  })

  it('Ctrl+O abre (não seleciona a ferramenta Elipse, que também é O)', () => {
    expect(resolveShortcut(evt({ key: 'o', ctrlKey: true }))).toEqual({ kind: 'open' })
  })

  it('Ctrl+0 reseta zoom pra 100%', () => {
    expect(resolveShortcut(evt({ key: '0', ctrlKey: true }))).toEqual({ kind: 'zoomReset' })
  })

  it('Ctrl+A seleciona tudo (não seleciona a ferramenta Polígono, que também é A)', () => {
    expect(resolveShortcut(evt({ key: 'a', ctrlKey: true }))).toEqual({ kind: 'selectAll' })
  })

  it('Ctrl+Z desfaz', () => {
    expect(resolveShortcut(evt({ key: 'z', ctrlKey: true }))).toEqual({ kind: 'undo' })
  })

  it('Ctrl+Shift+Z refaz', () => {
    expect(resolveShortcut(evt({ key: 'z', ctrlKey: true, shiftKey: true }))).toEqual({ kind: 'redo' })
  })

  it('Ctrl+Y refaz', () => {
    expect(resolveShortcut(evt({ key: 'y', ctrlKey: true }))).toEqual({ kind: 'redo' })
  })

  it('Ctrl+<tecla sem atalho> devolve null', () => {
    expect(resolveShortcut(evt({ key: 'x', ctrlKey: true }))).toBeNull()
  })
})

describe('resolveShortcut — ações globais sem modificador', () => {
  it('F enquadra tudo', () => {
    expect(resolveShortcut(evt({ key: 'f' }))).toEqual({ kind: 'fitAll' })
  })

  it('Escape cancela', () => {
    expect(resolveShortcut(evt({ key: 'Escape' }))).toEqual({ kind: 'cancel' })
  })

  it('Delete apaga seleção', () => {
    expect(resolveShortcut(evt({ key: 'Delete' }))).toEqual({ kind: 'deleteSelected' })
  })

  it('Backspace apaga seleção', () => {
    expect(resolveShortcut(evt({ key: 'Backspace' }))).toEqual({ kind: 'deleteSelected' })
  })
})

describe('resolveShortcut — rascunho ponto a ponto aberto', () => {
  // Região/Área/Corredor em construção: Ctrl+Z e Backspace tiram o último
  // ponto do rascunho. Desfazer o mapa ou apagar a seleção nessa hora perdia
  // trabalho (a última Sala sumia e o rascunho continuava na tela).
  it('Ctrl+Z tira o último ponto em vez de desfazer o mapa', () => {
    expect(resolveShortcut(evt({ key: 'z', ctrlKey: true, hasPointDraft: true }))).toEqual({ kind: 'undoDraftPoint' })
    expect(resolveShortcut(evt({ key: 'Z', metaKey: true, hasPointDraft: true }))).toEqual({ kind: 'undoDraftPoint' })
  })

  it('Backspace tira o último ponto em vez de apagar a seleção', () => {
    expect(resolveShortcut(evt({ key: 'Backspace', hasPointDraft: true }))).toEqual({ kind: 'undoDraftPoint' })
  })

  it('Delete, refazer e campo de texto não mudam', () => {
    expect(resolveShortcut(evt({ key: 'Delete', hasPointDraft: true }))).toEqual({ kind: 'deleteSelected' })
    expect(resolveShortcut(evt({ key: 'z', ctrlKey: true, shiftKey: true, hasPointDraft: true }))).toEqual({ kind: 'redo' })
    expect(resolveShortcut(evt({ key: 'Backspace', targetTagName: 'INPUT', hasPointDraft: true }))).toBeNull()
  })
})

describe('resolveShortcut — nudge por seta', () => {
  it('seta sozinha empurra 1 célula', () => {
    expect(resolveShortcut(evt({ key: 'ArrowRight' }))).toEqual({ kind: 'nudge', dx: 1, dy: 0, fine: false })
    expect(resolveShortcut(evt({ key: 'ArrowLeft' }))).toEqual({ kind: 'nudge', dx: -1, dy: 0, fine: false })
    expect(resolveShortcut(evt({ key: 'ArrowUp' }))).toEqual({ kind: 'nudge', dx: 0, dy: -1, fine: false })
    expect(resolveShortcut(evt({ key: 'ArrowDown' }))).toEqual({ kind: 'nudge', dx: 0, dy: 1, fine: false })
  })

  it('Shift+seta empurra 10 células (passo grande)', () => {
    expect(resolveShortcut(evt({ key: 'ArrowRight', shiftKey: true }))).toEqual({
      kind: 'nudge',
      dx: 10,
      dy: 0,
      fine: false,
    })
  })

  it('Alt+seta empurra 1px cru (passo fino, ignora grade)', () => {
    expect(resolveShortcut(evt({ key: 'ArrowUp', altKey: true }))).toEqual({
      kind: 'nudge',
      dx: 0,
      dy: -1,
      fine: true,
    })
  })

  it('Alt+Shift+seta: Alt vence — continua fino, não 10x', () => {
    expect(resolveShortcut(evt({ key: 'ArrowDown', altKey: true, shiftKey: true }))).toEqual({
      kind: 'nudge',
      dx: 0,
      dy: 1,
      fine: true,
    })
  })
})

describe('resolveShortcut — agrupar objetos (Ctrl+G / Ctrl+Shift+G)', () => {
  it('Ctrl+G agrupa a seleção', () => {
    expect(resolveShortcut(evt({ key: 'g', ctrlKey: true }))).toEqual({ kind: 'group' })
  })

  it('Cmd+G (Mac) agrupa igual', () => {
    expect(resolveShortcut(evt({ key: 'g', metaKey: true }))).toEqual({ kind: 'group' })
  })

  it('Ctrl+Shift+G desagrupa (com Shift o navegador manda a letra maiúscula)', () => {
    expect(resolveShortcut(evt({ key: 'G', ctrlKey: true, shiftKey: true }))).toEqual({ kind: 'ungroup' })
  })

  it('G sem Ctrl continua sendo a ferramenta Região', () => {
    expect(resolveShortcut(evt({ key: 'g' }))).toEqual({ kind: 'selectTool', tool: 'region' })
  })

  it('com o foco num campo de texto, Ctrl+G não é nosso', () => {
    expect(resolveShortcut(evt({ key: 'g', ctrlKey: true, targetTagName: 'INPUT' }))).toBeNull()
    expect(resolveShortcut(evt({ key: 'G', ctrlKey: true, shiftKey: true, targetTagName: 'TEXTAREA' }))).toBeNull()
  })
})
