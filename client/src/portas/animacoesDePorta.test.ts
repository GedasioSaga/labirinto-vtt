import { afterEach, describe, expect, it, vi } from 'vitest'
import { Graphics } from 'pixi.js'
import {
  ANIMACOES_EMBUTIDAS,
  CONTORNO_DA_PORTA,
  desenharBatente,
  desenharFolhaFechada,
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

/**
 * Porta horizontal de 0 a 100 como `pixi/drawDoors.ts` a monta a 100% desde
 * 22/10/2026: folha no vão inteiro (meio comprimento 50), 4 de espessura,
 * contorno escuro de 1 centrado na borda, batente de 1 e creme.
 */
const PORTA: PortaParaDesenho = { x1: 0, y1: 0, x2: 100, y2: 0, cx: 50, cy: 0, ux: 1, uy: 0, meioComprimento: 50, espessura: 4, contorno: 1, borda: 1, cor: 0xd9d2c0, escala: 1 }

/** O desenho de uma função de desenho só, num Graphics novo. */
function so(desenho: (g: Graphics, porta: PortaParaDesenho) => void, porta: PortaParaDesenho = PORTA): Graphics {
  const g = new Graphics()
  desenho(g, porta)
  return g
}

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

  it('a fechada parada: o escuro de 101 x 5 por fora e a cor de 99 x 3 por dentro (o stroke de 1 do SVG, centrado)', () => {
    const g = so(desenharFolhaFechada)
    expect(fills(g).map(corDo)).toEqual([CONTORNO_DA_PORTA, PORTA.cor])
    expect(caixa(fills(g)[0])).toEqual({ minX: -0.5, maxX: 100.5, minY: -2.5, maxY: 2.5 })
    expect(caixa(fills(g)[1])).toEqual({ minX: 0.5, maxX: 99.5, minY: -1.5, maxY: 1.5 })
  })

  it('a aberta parada (batente): a mesma caixa com o miolo vazado em escuro, sobra 1 de cor de cada lado', () => {
    const g = so(desenharBatente)
    expect(fills(g).map(corDo)).toEqual([CONTORNO_DA_PORTA, PORTA.cor, CONTORNO_DA_PORTA])
    expect(caixa(fills(g)[2])).toEqual({ minX: 1.5, maxX: 98.5, minY: -0.5, maxY: 0.5 })
    expect(strokes(g)).toHaveLength(0)
  })

  it.each(['girar', 'deslizar'])('%s em 0 é a porta fechada parada, instrução por instrução', (id) => {
    expect(desenhoInteiro(desenhar(id, 0))).toEqual(desenhoInteiro(so(desenharFolhaFechada)))
    for (const f of fills(desenhar(id, 0))) expect(alphaDo(f)).toBe(1)
  })

  it.each(['girar', 'deslizar'])('%s em 1 é a porta aberta parada: só o batente', (id) => {
    expect(desenhoInteiro(desenhar(id, 1))).toEqual(desenhoInteiro(so(desenharBatente)))
  })

  it('girar a 0,5: a folha está a 35° (metade dos 70) da dobradiça de (x1,y1), inteira e opaca', () => {
    const g = desenhar('girar', 0.5)
    const c = caixa(folha(g))
    // Dobradiça em (0, 0); a cor vai até 99,5 da dobradiça: ponta em 99,5·cos35 ≈ 81,5
    // e 99,5·sen35 ≈ 57,1 para o lado da normal (y > 0), mais a meia espessura (1,5).
    expect(c.maxX).toBeGreaterThan(81.5)
    expect(c.maxX).toBeLessThan(83)
    expect(c.maxY).toBeGreaterThan(57)
    expect(c.maxY).toBeLessThan(59)
    expect(alphaDo(folha(g))).toBe(1)
    expect(corDo(folha(g))).toBe(PORTA.cor)
  })

  it('deslizar a 0,5: sobra a metade da folha, presa à ponta de (x2,y2), com o contorno escuro em volta', () => {
    const g = desenhar('deslizar', 0.5)
    const todas = fills(g)
    const escuro = caixa(todas[todas.length - 2])
    const cor = caixa(folha(g))
    expect(corDo(todas[todas.length - 2])).toBe(CONTORNO_DA_PORTA)
    expect(escuro.minX).toBeCloseTo(49.5, 9)
    expect(escuro.maxX).toBeCloseTo(100.5, 9)
    expect(cor.minX).toBeCloseTo(50.5, 9)
    expect(cor.maxX).toBeCloseTo(99.5, 9)
  })

  it('girar recolhe a folha para a dobradiça no fim: a 0,95 ela é bem menor que a 0,5, e a 1 não sobra folha', () => {
    const meio = caixa(folha(desenhar('girar', 0.5)))
    const quase = caixa(folha(desenhar('girar', 0.95)))
    const extensao = (c: ReturnType<typeof caixa>): number => Math.hypot(c.maxX - c.minX, c.maxY - c.minY)
    expect(extensao(quase)).toBeLessThan(extensao(meio) / 4)
    // Recolhe para a dobradiça (0, 0), não para o meio do vão: o centro da folha
    // estava a 50 dela no meio do caminho e chega a menos de 10 (a 1/5, como antes).
    const distanciaDaDobradica = (c: ReturnType<typeof caixa>): number => Math.hypot((c.minX + c.maxX) / 2, (c.minY + c.maxY) / 2)
    expect(distanciaDaDobradica(meio)).toBeCloseTo(50, 0)
    expect(distanciaDaDobradica(quase)).toBeLessThan(10)
    expect(fills(desenhar('girar', 1))).toHaveLength(fills(so(desenharBatente)).length)
  })

  it.each(['girar', 'deslizar'])('%s é opaco o caminho inteiro: 201 pontos, nenhum preenchimento ou traço com alfa', (id) => {
    for (let i = 0; i <= 200; i += 1) {
      for (const instrucao of desenhar(id, i / 200).context.instructions) {
        if (instrucao.action === 'fill' || instrucao.action === 'stroke') expect(instrucao.data.style.alpha).toBe(1)
      }
    }
  })

  it.each(['girar', 'deslizar'])('%s: sombra só no meio do caminho, mais escura que a folha, e nenhuma nos extremos', (id) => {
    expect(fills(desenhar(id, 0))).toHaveLength(2)
    expect(fills(desenhar(id, 1))).toHaveLength(3)
    const g = desenhar(id, 0.3)
    // O batente (3), a penumbra, o miolo da sombra e a folha por cima (contorno e cor).
    expect(fills(g)).toHaveLength(7)
    const [, , , penumbra, miolo] = fills(g)
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
      // fills[4] é o miolo da sombra (depois do batente e da penumbra).
      return (centro(fills(g)[4]).y - centro(folha(g)).y) * escala
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

  it.each(CORES_DE_PORTA)('cor %i: batente e folha na cor da porta, com o contorno escuro; a sombra puxa da mesma cor', (cor) => {
    const g = desenhar('girar', 0.4, true, { ...PORTA, cor })
    expect(fills(g).slice(0, 3).map(corDo)).toEqual([CONTORNO_DA_PORTA, cor, CONTORNO_DA_PORTA])
    expect(corDo(folha(g))).toBe(cor)
    expect(corDo(fills(g)[3])).toBe(misturarCor(cor, ESCURO_DA_SOMBRA, 0.4))
    expect(strokes(g)).toHaveLength(0)
  })

  it('porta de pacote antigo, sem borda: a folha sai sem o contorno, como antes do campo', () => {
    const semBorda: PortaParaDesenho = { ...PORTA, borda: undefined }
    expect(fills(so(desenharFolhaFechada, semBorda)).map(corDo)).toEqual([PORTA.cor])
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
    expect(SONS_DA_ANIMACAO_DE_PORTA).toEqual(['rangido', 'trinco', 'dupla', 'grade', 'arrombada', 'sanfona', 'cortina'])
    expect(somDaAnimacaoDePortaValido('trinco')).toBe(true)
    expect(somDaAnimacaoDePortaValido('cortina')).toBe(true)
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
