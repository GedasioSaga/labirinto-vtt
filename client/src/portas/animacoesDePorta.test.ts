import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics } from 'pixi.js'
import {
  ANIMACOES_EMBUTIDAS,
  DURACAO_DE_ANIMACAO_MAX_MS,
  animacaoDePorta,
  assinarAnimacoesDePorta,
  esquecerAnimacoesDePortaDeFora,
  idDeAnimacaoDePortaValido,
  listarAnimacoesDePorta,
  portaComAnimacao,
  registrarAnimacaoDePorta,
  type PortaParaDesenho,
} from './animacoesDePorta'
import type { DoorState } from '../types/map'

afterEach(() => esquecerAnimacoesDePortaDeFora())

/** Porta horizontal de 0 a 100, folha de 60 (20..80) e 6 de espessura. */
const PORTA: PortaParaDesenho = { x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: 0, ux: 1, uy: 0, meioComprimento: 30, espessura: 6, contorno: 2, cor: 0xd08c3a, escala: 1 }

type Instruction = Graphics['context']['instructions'][number]

function fills(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'fill')
}

function strokes(g: Graphics): Instruction[] {
  return g.context.instructions.filter((i) => i.action === 'stroke')
}

function caixa(instruction: Instruction): { minX: number; maxX: number; minY: number; maxY: number } {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem path')
  const poly = instruction.data.path.instructions.find((i) => i.action === 'poly')
  if (poly === undefined || poly.action !== 'poly') throw new Error('sem poly')
  const [flat] = poly.data
  if (!Array.isArray(flat)) throw new Error('poly sem lista de números')
  const numeros = flat.filter((v): v is number => typeof v === 'number')
  const xs = numeros.filter((_, i) => i % 2 === 0)
  const ys = numeros.filter((_, i) => i % 2 === 1)
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

function alphaDo(instruction: Instruction): number {
  if (instruction.action !== 'fill') throw new Error('não é fill')
  return instruction.data.style.alpha
}

function desenhar(id: string, progresso: number): Graphics {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const g = new Graphics()
  animacao.desenhar(g, PORTA, progresso, true)
  return g
}

describe('registro de animações de porta — embutidas', () => {
  it('"Girar na dobradiça" e "Deslizar" vêm no app, nessa ordem', () => {
    expect(listarAnimacoesDePorta().map((a) => [a.id, a.nome])).toEqual([
      ['girar', 'Girar na dobradiça'],
      ['deslizar', 'Deslizar'],
    ])
  })

  it('id ausente ou desconhecido = sem animação', () => {
    expect(animacaoDePorta(undefined)).toBeNull()
    expect(animacaoDePorta('nao-existe')).toBeNull()
    expect(animacaoDePorta('girar')?.nome).toBe('Girar na dobradiça')
  })

  it.each(['girar', 'deslizar'])('%s em 0 é a porta fechada: folha inteira cobrindo o batente', (id) => {
    const g = desenhar(id, 0)
    expect(strokes(g)).toHaveLength(1)
    expect(fills(g)).toHaveLength(1)
    const folha = caixa(fills(g)[0])
    expect(folha.minX).toBeCloseTo(20, 9)
    expect(folha.maxX).toBeCloseTo(80, 9)
    expect(folha.minY).toBeCloseTo(-3, 9)
    expect(folha.maxY).toBeCloseTo(3, 9)
    expect(alphaDo(fills(g)[0])).toBe(1)
  })

  it.each(['girar', 'deslizar'])('%s em 1 é a porta aberta: só o batente, por dentro da caixa', (id) => {
    const g = desenhar(id, 1)
    expect(fills(g)).toHaveLength(0)
    const [batente] = strokes(g)
    const c = caixa(batente)
    expect(c.minX).toBeCloseTo(21, 9)
    expect(c.maxX).toBeCloseTo(79, 9)
  })

  it('girar a 0,5: a folha está a 45° da dobradiça de (x1,y1), ainda quase sólida', () => {
    const g = desenhar('girar', 0.5)
    const folha = caixa(fills(g)[0])
    // Dobradiça em (20, 0); ponta livre em 20 + 60·cos45 ≈ 62,4, para o lado da normal (y > 0).
    expect(folha.maxX).toBeGreaterThan(62)
    expect(folha.maxX).toBeLessThan(66)
    expect(folha.maxY).toBeGreaterThan(42)
    expect(alphaDo(fills(g)[0])).toBeCloseTo(1 - 0.5 ** 3, 9)
  })

  it('deslizar a 0,5: sobra a metade da folha, presa à ponta de (x2,y2)', () => {
    const folha = caixa(fills(desenhar('deslizar', 0.5))[0])
    expect(folha.minX).toBeCloseTo(50, 9)
    expect(folha.maxX).toBeCloseTo(80, 9)
  })
})

describe('registro de animações de porta — de fora (pacote, Fase B)', () => {
  function deFora(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return { id: 'pacote-x', nome: 'Abrir em leque', duracaoMs: 400, desenhar: () => {}, ...extra }
  }

  it('registrar uma válida: entra no fim da lista e desenha com os mesmos argumentos', () => {
    const desenharDeFora = vi.fn()
    expect(registrarAnimacaoDePorta(deFora({ desenhar: desenharDeFora }))).toBe(true)
    expect(listarAnimacoesDePorta().map((a) => a.id)).toEqual(['girar', 'deslizar', 'pacote-x'])
    const g = new Graphics()
    animacaoDePorta('pacote-x')?.desenhar(g, PORTA, 0.25, false)
    expect(desenharDeFora).toHaveBeenCalledWith(g, PORTA, 0.25, false)
  })

  it('o nome chega aparado', () => {
    registrarAnimacaoDePorta(deFora({ nome: '  Leque  ' }))
    expect(animacaoDePorta('pacote-x')?.nome).toBe('Leque')
  })

  it('mesmo id de fora de novo substitui (versão nova do pacote), sem duplicar', () => {
    registrarAnimacaoDePorta(deFora())
    registrarAnimacaoDePorta(deFora({ nome: 'Leque 2' }))
    expect(listarAnimacoesDePorta().filter((a) => a.id === 'pacote-x').map((a) => a.nome)).toEqual(['Leque 2'])
  })

  it.each<[string, unknown]>([
    ['null', null],
    ['texto', 'girar'],
    ['sem id', { nome: 'X', duracaoMs: 100, desenhar: () => {} }],
    ['id com maiúscula', { ...deFora(), id: 'Leque' }],
    ['id com espaço', { ...deFora(), id: 'em leque' }],
    ['id longo demais', { ...deFora(), id: 'a'.repeat(41) }],
    ['id de embutida', { ...deFora(), id: 'girar' }],
    ['nome vazio', { ...deFora(), nome: '   ' }],
    ['nome longo demais', { ...deFora(), nome: 'x'.repeat(61) }],
    ['duração zero', { ...deFora(), duracaoMs: 0 }],
    ['duração NaN', { ...deFora(), duracaoMs: Number.NaN }],
    ['duração acima do teto', { ...deFora(), duracaoMs: DURACAO_DE_ANIMACAO_MAX_MS + 1 }],
    ['duração em texto', { ...deFora(), duracaoMs: '300' }],
    ['desenhar não é função', { ...deFora(), desenhar: 'function' }],
  ])('recusa %s e não mexe na lista', (_caso, info) => {
    const antes = listarAnimacoesDePorta()
    expect(registrarAnimacaoDePorta(info)).toBe(false)
    expect(listarAnimacoesDePorta()).toBe(antes)
  })

  it('quem assina é avisado quando a lista muda; a referência só troca quando muda', () => {
    const ouvinte = vi.fn()
    const cancelar = assinarAnimacoesDePorta(ouvinte)
    const antes = listarAnimacoesDePorta()
    expect(listarAnimacoesDePorta()).toBe(antes)
    registrarAnimacaoDePorta(deFora())
    expect(ouvinte).toHaveBeenCalledTimes(1)
    expect(listarAnimacoesDePorta()).not.toBe(antes)
    cancelar()
    esquecerAnimacoesDePortaDeFora()
    expect(ouvinte).toHaveBeenCalledTimes(1)
  })

  it('esquecer as de fora volta só às embutidas', () => {
    registrarAnimacaoDePorta(deFora())
    esquecerAnimacoesDePortaDeFora()
    expect(listarAnimacoesDePorta()).toBe(ANIMACOES_EMBUTIDAS)
    expect(animacaoDePorta('pacote-x')).toBeNull()
  })
})

describe('id e campo da porta', () => {
  it.each<[unknown, boolean]>([
    ['girar', true],
    ['pacote-2', true],
    ['a'.repeat(40), true],
    ['', false],
    ['Girar', false],
    ['em leque', false],
    ['a'.repeat(41), false],
    [1, false],
    [null, false],
    [undefined, false],
  ])('%j válido = %s', (valor, esperado) => {
    expect(idDeAnimacaoDePortaValido(valor)).toBe(esperado)
  })

  it('portaComAnimacao põe, troca e tira o campo sem mexer na porta original', () => {
    const porta: DoorState = { open: true, locked: false, kind: 'normal', semEspiar: true }
    const comGiro = portaComAnimacao(porta, 'girar')
    expect(comGiro).toEqual({ ...porta, animacao: 'girar' })
    expect(portaComAnimacao(comGiro, 'deslizar').animacao).toBe('deslizar')
    const sem = portaComAnimacao(comGiro, null)
    expect(sem).toEqual(porta)
    expect('animacao' in sem).toBe(false)
    expect('animacao' in porta).toBe(false)
  })
})
