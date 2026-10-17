import { describe, expect, it } from 'vitest'
import { Container, Graphics, Text } from 'pixi.js'
import type { Pin } from '../types/map'
import { PIN_HEAD_OFFSET, PIN_HEAD_RADIUS } from '../lib/pins'
import { createPinsRenderer } from './drawPins'

/**
 * COR E TAMANHO DO PINO no desenho (fatia 14): o tamanho multiplica cabeça,
 * haste, anel, glifo e a distância do nome; a cor pinta a cabeça e a tinta do
 * glifo troca pela de mais contraste. Sem os dois campos, o desenho é
 * exatamente o de antes.
 */

const MARCADOR: Pin = { id: 'p', x: 100, y: 200, kind: 'exclamacao', description: '', image: null, nome: 'Baú' }

interface Desenho {
  minX: number
  maxX: number
  minY: number
  maxY: number
  glifo: Text | null
  nome: Text | null
}

function desenhar(pins: Pin[], selectedId: string | null = null, sizeScale = 1): Desenho {
  const container = new Container()
  createPinsRenderer({ showNames: true }).draw(container, pins, selectedId, undefined, sizeScale)
  const graphics = container.children.find((child): child is Graphics => child instanceof Graphics)
  if (!graphics) throw new Error('o renderer não pôs o Graphics dos pinos no container')
  const textos = container.children.filter((child): child is Text => child instanceof Text && child.visible)
  const { minX, maxX, minY, maxY } = graphics.getLocalBounds()
  return {
    minX,
    maxX,
    minY,
    maxY,
    glifo: textos.find((t) => t.text === '!') ?? null,
    nome: textos.find((t) => t.text === 'Baú') ?? null,
  }
}

const caixa = (d: Desenho) => ({ minX: d.minX, maxX: d.maxX, minY: d.minY, maxY: d.maxY })

describe('drawPins: cor e escala', () => {
  it('sem cor e sem escala: o mesmo desenho do pino de sempre (escala 1 explícita idem)', () => {
    const deSempre = desenhar([MARCADOR])
    const umExplicito = desenhar([{ ...MARCADOR, escala: 1 }])
    expect(caixa(umExplicito)).toEqual(caixa(deSempre))
    expect(deSempre.glifo?.style.fill).toBe(0x1b1208)
    expect(deSempre.glifo?.scale.x).toBe(1)
  })

  it.each([3, 0.5])('escala %s: a caixa da cabeça e a altura crescem na mesma razão, a ponta fica', (escala) => {
    const deSempre = desenhar([MARCADOR])
    const escalado = desenhar([{ ...MARCADOR, escala }])
    const largura = (d: Desenho) => d.maxX - d.minX
    const altura = (d: Desenho) => d.maxY - d.minY
    expect(largura(escalado)).toBeCloseTo(largura(deSempre) * escala, 4)
    expect(altura(escalado)).toBeCloseTo(altura(deSempre) * escala, 4)
    expect(escalado.glifo?.position.y).toBeCloseTo(MARCADOR.y - PIN_HEAD_OFFSET * escala, 6)
    expect(escalado.glifo?.scale.x).toBe(escala)
  })

  it('o nome se afasta da cabeça maior (com o zoom junto) e a letra segue a do zoom', () => {
    const { nome } = desenhar([{ ...MARCADOR, escala: 3 }], null, 2)
    expect(nome?.position.x).toBeCloseTo(MARCADOR.x + (PIN_HEAD_RADIUS + 4) * 2 * 3, 6)
    expect(nome?.scale.x).toBe(2)
  })

  it('selecionado: o anel cresce com o pino', () => {
    const deSempre = desenhar([MARCADOR], 'p')
    const grande = desenhar([{ ...MARCADOR, escala: 3 }], 'p')
    expect(grande.maxX - grande.minX).toBeCloseTo((deSempre.maxX - deSempre.minX) * 3, 4)
  })

  it('cor escura: o glifo vira tinta clara; cor clara: tinta escura', () => {
    expect(desenhar([{ ...MARCADOR, cor: '#5b6670' }]).glifo?.style.fill).toBe(0xe8e2d0)
    expect(desenhar([{ ...MARCADOR, cor: '#d9d2c0' }]).glifo?.style.fill).toBe(0x1b1208)
  })

  it('o mesmo Text do glifo troca a tinta quando a cor muda (nunca é recriado)', () => {
    const container = new Container()
    const renderer = createPinsRenderer()
    renderer.draw(container, [{ ...MARCADOR, cor: '#5b6670' }], null)
    const antes = container.children.find((child): child is Text => child instanceof Text)
    renderer.draw(container, [MARCADOR], null)
    const depois = container.children.find((child): child is Text => child instanceof Text)
    expect(depois).toBe(antes)
    expect(depois?.style.fill).toBe(0x1b1208)
  })

  it.each<Partial<Pin>>([{ kind: 'alavanca' }, { kind: 'minigame' }, { kind: 'viagem' }, { kind: 'viagem', soChegada: true }, { icon: 'chave' }])(
    'cabeça %o: escala 3 triplica a largura, com ou sem cor',
    (extra) => {
      const pin = { ...MARCADOR, nome: undefined, ...extra }
      const deSempre = desenhar([pin])
      const grande = desenhar([{ ...pin, escala: 3, cor: '#5b6670' }])
      expect(grande.maxX - grande.minX).toBeCloseTo((deSempre.maxX - deSempre.minX) * 3, 4)
    },
  )

  it('viagem sem par: com cor, a PRÓPRIA cor apagada por opacidade; sem cor, o cinza de sempre', () => {
    const viagem: Pin = { ...MARCADOR, nome: undefined, kind: 'viagem' }
    const tracos = (pin: Pin) => {
      const container = new Container()
      createPinsRenderer().draw(container, [pin], null, new Set([pin.id]))
      const graphics = container.children.find((child): child is Graphics => child instanceof Graphics)
      if (!graphics) throw new Error('o renderer não pôs o Graphics dos pinos no container')
      return graphics.context.instructions
        .filter((instrucao) => instrucao.action === 'stroke')
        .map((instrucao) => ({ color: instrucao.data.style.color, alpha: instrucao.data.style.alpha }))
    }
    // A haste escura (0x1b1208) fica de fora: só o aro e o símbolo levam a cor.
    const daCor = tracos({ ...viagem, cor: '#e2645a' }).filter((t) => t.color !== 0x1b1208)
    expect(daCor.length).toBeGreaterThan(0)
    for (const traco of daCor) expect(traco).toEqual({ color: 0xe2645a, alpha: 0.5 })
    const deSempre = tracos(viagem).filter((t) => t.color !== 0x1b1208)
    expect(deSempre.length).toBeGreaterThan(0)
    for (const traco of deSempre) expect(traco).toEqual({ color: 0x8a8478, alpha: 1 })
  })

  it('pino reduzido não desce do piso de tela: com piso, o 0,5 sai do tamanho do piso', () => {
    const deSempre = desenhar([MARCADOR])
    const container = new Container()
    createPinsRenderer().draw(container, [{ ...MARCADOR, escala: 0.5 }], null, undefined, 1, 0.8)
    const graphics = container.children.find((child): child is Graphics => child instanceof Graphics)
    if (!graphics) throw new Error('o renderer não pôs o Graphics dos pinos no container')
    const caixaDoReduzido = graphics.getLocalBounds()
    expect(caixaDoReduzido.maxX - caixaDoReduzido.minX).toBeCloseTo((deSempre.maxX - deSempre.minX) * 0.8, 4)
    // O pino de escala 1 com o mesmo piso fica exatamente como sempre.
    const umComPiso = new Container()
    createPinsRenderer().draw(umComPiso, [MARCADOR], null, undefined, 1, 0.8)
    const g1 = umComPiso.children.find((child): child is Graphics => child instanceof Graphics)
    expect(g1?.getLocalBounds().maxX).toBe(deSempre.maxX)
  })

  it('valor torto que chegasse do host não estoura o desenho', () => {
    const deSempre = desenhar([MARCADOR])
    const torto = desenhar([{ ...MARCADOR, escala: 40, cor: 'vermelho' }])
    expect(caixa(torto)).toEqual(caixa(deSempre))
    expect(torto.glifo?.style.fill).toBe(0x1b1208)
  })
})
