import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics } from 'pixi.js'
import {
  ANIMACOES_EMBUTIDAS,
  DURACAO_DE_ANIMACAO_MAX_MS,
  ESCURO_DA_SOMBRA,
  SONS_DA_ANIMACAO_DE_PORTA,
  animacaoDePorta,
  misturarCor,
  somDaAnimacaoDePortaValido,
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

function desenhar(id: string, progresso: number, abrindo = true, porta: PortaParaDesenho = PORTA): Graphics {
  const animacao = animacaoDePorta(id)
  if (animacao === null) throw new Error(`sem a animação ${id}`)
  const g = new Graphics()
  animacao.desenhar(g, porta, progresso, abrindo)
  return g
}

/** A folha é o último preenchimento: a sombra (quando há) vem antes, por baixo. */
function folha(g: Graphics): Instruction {
  const todas = fills(g)
  const ultima = todas[todas.length - 1]
  if (ultima === undefined) throw new Error('sem folha')
  return ultima
}

function corDo(instruction: Instruction): number {
  if (instruction.action !== 'fill' && instruction.action !== 'stroke') throw new Error('instrução sem estilo')
  return instruction.data.style.color
}

/** Cada instrução comparável: ação, cor, alfa e pontos. */
function desenhoInteiro(g: Graphics): unknown[] {
  return g.context.instructions.map((i) => (i.action === 'fill' || i.action === 'stroke' ? [i.action, i.data.style.color, i.data.style.alpha, caixa(i)] : [i.action]))
}

function centro(instruction: Instruction): { x: number; y: number } {
  const c = caixa(instruction)
  return { x: (c.minX + c.maxX) / 2, y: (c.minY + c.maxY) / 2 }
}

const CORES_DE_PORTA = [0xd08c3a, 0x3a7bd5, 0x5e8c4a]

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

  it('girar a 0,5: a folha está a 35° (metade dos 70) da dobradiça de (x1,y1), inteira e opaca', () => {
    const g = desenhar('girar', 0.5)
    const c = caixa(folha(g))
    // Dobradiça em (20, 0); ponta livre em 20 + 60·cos35 ≈ 69,1 e 60·sen35 ≈ 34,4
    // para o lado da normal (y > 0), mais a meia espessura da folha.
    expect(c.maxX).toBeGreaterThan(69)
    expect(c.maxX).toBeLessThan(72)
    expect(c.maxY).toBeGreaterThan(34)
    expect(c.maxY).toBeLessThan(38)
    expect(alphaDo(folha(g))).toBe(1)
    expect(corDo(folha(g))).toBe(PORTA.cor)
  })

  it('deslizar a 0,5: sobra a metade da folha, presa à ponta de (x2,y2)', () => {
    const c = caixa(folha(desenhar('deslizar', 0.5)))
    expect(c.minX).toBeCloseTo(50, 9)
    expect(c.maxX).toBeCloseTo(80, 9)
  })

  it('girar recolhe a folha para a dobradiça no fim: a 0,95 ela é bem menor que a 0,5, e a 1 não sobra folha', () => {
    const meio = caixa(folha(desenhar('girar', 0.5)))
    const quase = caixa(folha(desenhar('girar', 0.95)))
    const extensao = (c: ReturnType<typeof caixa>): number => Math.hypot(c.maxX - c.minX, c.maxY - c.minY)
    expect(extensao(quase)).toBeLessThan(extensao(meio) / 4)
    // Recolhe para a dobradiça (20, 0), não para o meio do vão.
    expect(quase.minX).toBeGreaterThan(17)
    expect(quase.maxX).toBeLessThan(26)
    expect(fills(desenhar('girar', 1))).toHaveLength(0)
  })

  it.each(['girar', 'deslizar'])('%s é opaco o caminho inteiro: 201 pontos, nenhum preenchimento ou traço com alfa', (id) => {
    for (let i = 0; i <= 200; i += 1) {
      for (const instrucao of desenhar(id, i / 200).context.instructions) {
        if (instrucao.action === 'fill' || instrucao.action === 'stroke') expect(instrucao.data.style.alpha).toBe(1)
      }
    }
  })

  it.each(['girar', 'deslizar'])('%s: sombra só no meio do caminho, mais escura que a folha, e nenhuma nos extremos', (id) => {
    expect(fills(desenhar(id, 0))).toHaveLength(1)
    expect(fills(desenhar(id, 1))).toHaveLength(0)
    const g = desenhar(id, 0.3)
    // Penumbra, miolo e a folha por cima.
    expect(fills(g)).toHaveLength(3)
    const [penumbra, miolo] = fills(g)
    const brilho = (cor: number): number => ((cor >> 16) & 0xff) + ((cor >> 8) & 0xff) + (cor & 0xff)
    expect(brilho(corDo(miolo))).toBeLessThan(brilho(corDo(penumbra)))
    expect(brilho(corDo(penumbra))).toBeLessThan(brilho(PORTA.cor))
    // A sombra cai para baixo e para a direita da tela.
    expect(centro(miolo).x).toBeGreaterThan(centro(folha(g)).x)
    expect(centro(miolo).y).toBeGreaterThan(centro(folha(g)).y)
  })

  it.each(['girar', 'deslizar'])('%s: a sombra fica do mesmo tamanho na tela em qualquer zoom', (id) => {
    const desvioNaTela = (escala: number): number => {
      const g = desenhar(id, 0.5, true, { ...PORTA, escala })
      return (centro(fills(g)[1]).y - centro(folha(g)).y) * escala
    }
    expect(desvioNaTela(1)).toBeCloseTo(2, 6)
    expect(desvioNaTela(4)).toBeCloseTo(2, 6)
  })

  it.each(['girar', 'deslizar'])('%s: o desenho só depende do progresso, então abrir e fechar passam pelo mesmo ponto (inverter não salta)', (id) => {
    for (const p of [0, 0.25, 0.5, 0.75, 1]) expect(desenhoInteiro(desenhar(id, p, true))).toEqual(desenhoInteiro(desenhar(id, p, false)))
  })

  it.each(['girar', 'deslizar'])('%s não salta: a cada 0,5%% do caminho o centro da folha anda no máximo 1,5 px', (id) => {
    let anterior = centro(folha(desenhar(id, 0)))
    for (let i = 1; i < 200; i += 1) {
      const atual = centro(folha(desenhar(id, i / 200)))
      expect(Math.hypot(atual.x - anterior.x, atual.y - anterior.y)).toBeLessThanOrEqual(1.5)
      anterior = atual
    }
  })

  it.each(CORES_DE_PORTA)('cor %i: batente e folha na cor da porta; a sombra puxa da mesma cor', (cor) => {
    const g = desenhar('girar', 0.4, true, { ...PORTA, cor })
    expect(corDo(strokes(g)[0])).toBe(cor)
    expect(corDo(folha(g))).toBe(cor)
    expect(corDo(fills(g)[0])).toBe(misturarCor(cor, ESCURO_DA_SOMBRA, 0.4))
  })

  it('misturarCor vai de uma cor à outra canal a canal', () => {
    expect(misturarCor(0xff0000, 0x0000ff, 0)).toBe(0xff0000)
    expect(misturarCor(0xff0000, 0x0000ff, 1)).toBe(0x0000ff)
    expect(misturarCor(0x000000, 0xffffff, 0.5)).toBe(0x808080)
  })

  it('as embutidas têm som: girar range, deslizar só estala o trinco', () => {
    expect(animacaoDePorta('girar')?.som).toBe('rangido')
    expect(animacaoDePorta('deslizar')?.som).toBe('trinco')
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

  it('som do pacote: conhecido fica; desconhecido ou torto deixa a animação muda, sem recusá-la', () => {
    expect(registrarAnimacaoDePorta(deFora({ som: 'rangido' }))).toBe(true)
    expect(animacaoDePorta('pacote-x')?.som).toBe('rangido')
    for (const torto of ['sino', 'Rangido', 7, null, { tipo: 'rangido' }]) {
      expect(registrarAnimacaoDePorta(deFora({ som: torto }))).toBe(true)
      const animacao = animacaoDePorta('pacote-x')
      expect(animacao).not.toBeNull()
      expect(animacao !== null && 'som' in animacao).toBe(false)
    }
  })

  it('pacote sem som (cliente e pacote de antes do campo): entra igual, mudo', () => {
    registrarAnimacaoDePorta(deFora())
    expect(animacaoDePorta('pacote-x')?.som).toBeUndefined()
  })

  it('validador do som: só os que o app sintetiza', () => {
    expect(SONS_DA_ANIMACAO_DE_PORTA).toEqual(['rangido', 'trinco'])
    expect(somDaAnimacaoDePortaValido('trinco')).toBe(true)
    expect(somDaAnimacaoDePortaValido('tranca')).toBe(false)
    expect(somDaAnimacaoDePortaValido(undefined)).toBe(false)
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
