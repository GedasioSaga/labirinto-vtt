/**
 * O tipo MINIGAME no catálogo do pino: rótulo, ordem, glifo de texto, o
 * controle desenhado com as coordenadas do protótipo aprovado e a troca de
 * tipo (`pinKindChangePatch`), que entra no mesmo passo do desfazer.
 */
import { describe, expect, it } from 'vitest'
import { MINIGAME_PADRAO } from '../minigames/danca/tipos'
import { buildPin } from './mapFactory'
import {
  PIN_CONTROLE_SYMBOL,
  PIN_GLYPH,
  PIN_KIND_LABELS,
  PIN_KIND_ORDER,
  isPinKind,
  minigamePadrao,
  pinKindAfterShortcut,
  pinKindChangePatch,
  pinKindShowsIcon,
  pinSummary,
  sameMinigame,
} from './pins'

/** Meio-lado do símbolo dentro da cabeça de raio 11 (o `SYMBOL_RADIUS` de `pixi/drawPins.ts`). */
const MEIO_LADO = 11 * 0.64
/** Centro da cabeça no `<symbol id="pinoControle" viewBox="0 0 30 40">` do protótipo. */
const CENTRO = 15

const noProtótipo = (n: number): number => Math.round((CENTRO + n * MEIO_LADO) * 100) / 100

describe('tipo minigame', () => {
  it('entra no fim do seletor, com rótulo e glifo de texto', () => {
    expect(PIN_KIND_ORDER).toEqual(['exclamacao', 'interrogacao', 'viagem', 'alavanca', 'minigame'])
    expect(PIN_KIND_LABELS.minigame).toBe('Minigame')
    expect(PIN_GLYPH.minigame).not.toBe('')
    expect(isPinKind('minigame')).toBe(true)
  })

  it('não mostra a grade de ícones e o atalho "?" não o troca', () => {
    expect(pinKindShowsIcon('minigame')).toBe(false)
    expect(pinKindAfterShortcut('minigame')).toBeNull()
  })

  it('o resumo do mestre diz o jogo, e o ícone escolhido não muda nada', () => {
    const pino = buildPin('m', { x: 0, y: 0 }, 'minigame')
    expect(pinSummary(pino)).toBe('Dança')
    expect(pinSummary({ ...pino, icon: 'bau' })).toBe('Dança')
    expect(pinSummary({ ...pino, minigame: undefined })).toBe('Minigame')
    expect(pinSummary({ ...pino, description: 'A pista' })).toBe('A pista')
  })

  it('o controle tem os pontos do protótipo aprovado', () => {
    const [corpo, cruzDeitada, cruzEmPe] = PIN_CONTROLE_SYMBOL.strokes
    expect(corpo?.closed).toBe(true)
    expect(corpo?.points.map((p) => [noProtótipo(p.x), noProtótipo(p.y)])).toEqual([
      [10.78, 12.04],
      [19.22, 12.04],
      [20.91, 13.45],
      [21.9, 17.82],
      [20.63, 19.36],
      [18.52, 18.24],
      [11.48, 18.24],
      [9.37, 19.36],
      [8.1, 17.82],
      [9.09, 13.45],
    ])
    expect(cruzDeitada?.points.map((p) => [noProtótipo(p.x), noProtótipo(p.y)])).toEqual([
      [10.78, 15.14],
      [13.45, 15.14],
    ])
    expect(cruzEmPe?.points.map((p) => [noProtótipo(p.x), noProtótipo(p.y)])).toEqual([
      [12.11, 13.8],
      [12.11, 16.48],
    ])
    expect(PIN_CONTROLE_SYMBOL.dots?.map((d) => [noProtótipo(d.x), noProtótipo(d.y), Math.round(d.r * MEIO_LADO * 10) / 10])).toEqual([
      [17.11, 15.7, 0.9],
      [18.94, 14.3, 0.9],
    ])
  })

  it('cabe dentro da cabeça: nenhum ponto passa do aro', () => {
    const pontos = [...PIN_CONTROLE_SYMBOL.strokes.flatMap((s) => s.points), ...(PIN_CONTROLE_SYMBOL.dots ?? [])]
    for (const p of pontos) expect(Math.hypot(p.x, p.y) * MEIO_LADO).toBeLessThan(11)
  })
})

describe('buildPin e minigamePadrao', () => {
  it('o pino de minigame nasce com uma CÓPIA do desafio padrão', () => {
    const a = buildPin('a', { x: 0, y: 0 }, 'minigame')
    const b = buildPin('b', { x: 0, y: 0 }, 'minigame')
    expect(a.minigame).toEqual(MINIGAME_PADRAO)
    expect(a.minigame).not.toBe(MINIGAME_PADRAO)
    expect(a.minigame?.premio).not.toBe(b.minigame?.premio)
    expect(buildPin('c', { x: 0, y: 0 }, 'alavanca').minigame).toBeUndefined()
  })

  it('sameMinigame compara por valor', () => {
    expect(sameMinigame(minigamePadrao(), minigamePadrao())).toBe(true)
    expect(sameMinigame(undefined, undefined)).toBe(true)
    expect(sameMinigame(minigamePadrao(), undefined)).toBe(false)
    expect(sameMinigame(minigamePadrao(), { ...minigamePadrao(), notaMin: 'S' })).toBe(false)
    expect(sameMinigame(minigamePadrao(), { ...minigamePadrao(), premio: { tipo: 'item', texto: 'Outra chave' } })).toBe(false)
  })
})

describe('pinKindChangePatch', () => {
  const ponto = buildPin('p', { x: 0, y: 0 }, 'exclamacao')
  const jogo = { ...buildPin('m', { x: 0, y: 0 }, 'minigame'), portaLigada: 'porta-1' }

  it('entrar no minigame grava o desafio padrão e solta destino e ficha', () => {
    expect(pinKindChangePatch(ponto, 'minigame')).toEqual({ kind: 'minigame', destino: null, presoA: undefined, minigame: MINIGAME_PADRAO })
  })

  it('escolher de novo o minigame não apaga o desafio montado', () => {
    const montado = { ...jogo, minigame: { ...MINIGAME_PADRAO, npc: 'Seu Lula' } }
    expect(pinKindChangePatch(montado, 'minigame').minigame?.npc).toBe('Seu Lula')
  })

  it('sair do minigame apaga o desafio; a porta fica só se o novo tipo for alavanca', () => {
    const paraAlavanca = pinKindChangePatch(jogo, 'alavanca')
    expect(paraAlavanca.minigame).toBeUndefined()
    expect('portaLigada' in paraAlavanca).toBe(false)
    const paraPonto = pinKindChangePatch(jogo, 'interrogacao')
    expect('portaLigada' in paraPonto && paraPonto.portaLigada === undefined).toBe(true)
    expect(paraPonto.minigame).toBeUndefined()
    const paraViagem = pinKindChangePatch(jogo, 'viagem')
    expect(paraViagem).toEqual({ kind: 'viagem', portaLigada: undefined, minigame: undefined })
  })

  it('da alavanca para o minigame a porta ligada fica', () => {
    const alavanca = { ...buildPin('a', { x: 0, y: 0 }, 'alavanca'), portaLigada: 'porta-1' }
    expect('portaLigada' in pinKindChangePatch(alavanca, 'minigame')).toBe(false)
  })
})
