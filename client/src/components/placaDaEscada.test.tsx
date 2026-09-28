/**
 * A escada nos dois desenhos que a mostram fora do mapa.
 *
 * A miniatura do campo "Sentido" fala a língua do mapa (`pixi/stairFlight.ts`):
 * placa retangular, degraus finos de trilho a trilho e um patamar sem degrau
 * no TOPO. Nada de galão ou seta: o lance antigo se lia como seta (swap cego
 * de 28/09). O teste lê a geometria que o SVG desenha: a única `rect` é a
 * placa, e todo traço de `path` precisa ser um degrau atravessando a placa de
 * um trilho ao outro. O patamar é o vão entre o último degrau e a borda do topo.
 *
 * O `StairIcon` (barra a 18 px, seleção a 16 px) NÃO é a placa: sem rótulo ao
 * lado, a placa vista de cima lia como documento, lista ou bateria e perdeu o
 * swap cego de 28/09 (2 a 0) para o perfil de degraus visto de lado.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StairIcon } from './icons'
import { StairControls } from './StairControls'

interface Placa {
  x: number
  y: number
  w: number
  h: number
}

interface Traco {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Eixo ao longo do lance: 'y' na placa em pé, 'x' na deitada. */
type Eixo = 'x' | 'y'

/** Em que ponta do eixo fica o topo (o patamar): 'inicio' = menor coordenada. */
type PontaDoTopo = 'inicio' | 'fim'

const TOLERANCIA = 1e-6

/** Traço de 1,6 no viewBox de 24 desenhado a 18 px: a linha de todo ícone da barra. */
const TRACO_DA_BARRA_PX = 1.2

/** Menor vão entre degraus, em unidades do viewBox de altura 24: 2 px a 16 px. */
const PASSO_MINIMO = 3

/** O patamar tem que ser pelo menos o dobro do maior vão; abaixo disso a placa lê como listra uniforme. */
const PATAMAR_SOBRE_PASSO = 2

function numero(el: Element, atributo: string): number {
  // Number(null) e Number('') dão 0: atributo ausente não pode passar por zero.
  const bruto = el.getAttribute(atributo)?.trim() ?? ''
  const valor = bruto === '' ? Number.NaN : Number(bruto)
  if (!Number.isFinite(valor)) throw new Error(`<${el.tagName}> sem ${atributo} numérico`)
  return valor
}

/** Traços de um `d` feito só de retas (M, L, H, V, Z, absolutos ou relativos). Curva é erro: a placa não tem. */
function tracosDe(d: string): Traco[] {
  const partes = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
  const tracos: Traco[] = []
  let comando = ''
  let x = 0
  let y = 0
  let inicioX = 0
  let inicioY = 0
  let i = 0
  const lerNumero = (): number => {
    const valor = Number(partes[i])
    i += 1
    if (!Number.isFinite(valor)) throw new Error(`número faltando em "${d}"`)
    return valor
  }
  const linhaAte = (nx: number, ny: number): void => {
    if (Math.hypot(nx - x, ny - y) > TOLERANCIA) tracos.push({ x1: x, y1: y, x2: nx, y2: ny })
    x = nx
    y = ny
  }
  while (i < partes.length) {
    if (/[a-zA-Z]/.test(partes[i])) {
      comando = partes[i]
      i += 1
      if (comando === 'Z' || comando === 'z') linhaAte(inicioX, inicioY)
      continue
    }
    switch (comando) {
      case 'M':
      case 'm': {
        const nx = lerNumero() + (comando === 'm' ? x : 0)
        const ny = lerNumero() + (comando === 'm' ? y : 0)
        x = nx
        y = ny
        inicioX = nx
        inicioY = ny
        comando = comando === 'm' ? 'l' : 'L'
        break
      }
      case 'L':
        linhaAte(lerNumero(), lerNumero())
        break
      case 'l':
        linhaAte(x + lerNumero(), y + lerNumero())
        break
      case 'H':
        linhaAte(lerNumero(), y)
        break
      case 'h':
        linhaAte(x + lerNumero(), y)
        break
      case 'V':
        linhaAte(x, lerNumero())
        break
      case 'v':
        linhaAte(x, y + lerNumero())
        break
      default:
        throw new Error(`comando "${comando}" fora da placa em "${d}"`)
    }
  }
  return tracos
}

interface Desenho {
  svg: SVGSVGElement
  placa: Placa
  tracos: Traco[]
}

function lerDesenho(svg: SVGSVGElement): Desenho {
  const rects = svg.querySelectorAll('rect')
  if (rects.length !== 1) throw new Error(`esperava 1 placa (rect), achei ${rects.length}`)
  const rect = rects[0]
  const placa = { x: numero(rect, 'x'), y: numero(rect, 'y'), w: numero(rect, 'width'), h: numero(rect, 'height') }
  const tracos = Array.from(svg.querySelectorAll('path')).flatMap((path) => tracosDe(path.getAttribute('d') ?? ''))
  return { svg, placa, tracos }
}

/** Posição de cada degrau ao longo do lance, sem repetição, em ordem crescente. */
function degraus({ tracos }: Desenho, eixo: Eixo): number[] {
  const posicoes = tracos.map((t) => (eixo === 'x' ? t.x1 : t.y1))
  return [...new Set(posicoes.map((p) => Math.round(p * 1000) / 1000))].sort((a, b) => a - b)
}

/** Vãos ao longo do lance: borda da placa, degraus, borda da placa. */
function vaos(desenho: Desenho, eixo: Eixo): number[] {
  const { placa } = desenho
  const inicio = eixo === 'x' ? placa.x : placa.y
  const fim = inicio + (eixo === 'x' ? placa.w : placa.h)
  const cortes = [inicio, ...degraus(desenho, eixo), fim]
  return cortes.slice(1).map((corte, i) => corte - cortes[i])
}

function viewBoxDe(svg: SVGSVGElement): [number, number, number, number] {
  const partes = (svg.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
  if (partes.length !== 4 || partes.some((p) => !Number.isFinite(p))) throw new Error('svg sem viewBox')
  return [partes[0], partes[1], partes[2], partes[3]]
}

describe('escada fora do mapa: StairIcon em perfil, miniatura do Sentido em placa', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function iconeDaBarra(): SVGSVGElement {
    act(() => root.render(<StairIcon size={18} />))
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('StairIcon não desenhou svg')
    return svg
  }

  function miniaturaDoSentido(rotulo: 'Sobe' | 'Desce'): SVGSVGElement {
    act(() =>
      root.render(
        <StairControls direction="up" onDirectionChange={vi.fn()} shape="straight" onShapeChange={vi.fn()} stepWidth={64} onStepWidthChange={vi.fn()} grid={64} travel={null} />,
      ),
    )
    const grupo = container.querySelector('[role="radiogroup"][aria-label="Sentido da escada"]')
    const opcao = Array.from(grupo?.querySelectorAll('[role="radio"]') ?? []).find((b) => b.textContent === rotulo)
    const svg = opcao?.querySelector('svg')
    if (!svg) throw new Error(`opção "${rotulo}" sem miniatura`)
    return svg
  }

  const CASOS: { nome: string; montar: () => SVGSVGElement; eixo: Eixo; topo: PontaDoTopo }[] = [
    { nome: 'Sentido "Sobe": patamar na ponta do arrasto', montar: () => miniaturaDoSentido('Sobe'), eixo: 'x', topo: 'fim' },
    { nome: 'Sentido "Desce": patamar no começo do arrasto', montar: () => miniaturaDoSentido('Desce'), eixo: 'x', topo: 'inicio' },
  ]

  describe.each(CASOS)('$nome', ({ montar, eixo, topo }) => {
    it('é uma placa só e traços retos, sem transform escondendo a geometria', () => {
      const svg = montar()
      const formas = Array.from(svg.querySelectorAll('*')).map((el) => el.tagName.toLowerCase())
      expect(formas.filter((f) => f === 'rect')).toHaveLength(1)
      expect(formas.filter((f) => f !== 'rect' && f !== 'path')).toEqual([])
      expect([svg, ...Array.from(svg.querySelectorAll('*'))].filter((el) => el.hasAttribute('transform'))).toEqual([])
      expect(lerDesenho(svg).tracos.length).toBeGreaterThan(0)
    })

    it('todo traço é um degrau que atravessa a placa de trilho a trilho (sem galão, sem seta)', () => {
      const desenho = lerDesenho(montar())
      const { placa } = desenho
      for (const t of desenho.tracos) {
        const [ao, atraves] = eixo === 'x' ? [[t.x1, t.x2], [t.y1, t.y2]] : [[t.y1, t.y2], [t.x1, t.x2]]
        const inicio = eixo === 'x' ? placa.x : placa.y
        const largura = eixo === 'x' ? placa.w : placa.h
        const trilho = eixo === 'x' ? placa.y : placa.x
        const vao = eixo === 'x' ? placa.h : placa.w
        expect(Math.abs(ao[0] - ao[1]), `traço torto: ${JSON.stringify(t)}`).toBeLessThan(TOLERANCIA)
        expect(Math.min(...atraves), `degrau não sai do trilho: ${JSON.stringify(t)}`).toBeCloseTo(trilho, 6)
        expect(Math.max(...atraves), `degrau não chega ao trilho: ${JSON.stringify(t)}`).toBeCloseTo(trilho + vao, 6)
        expect(ao[0]).toBeGreaterThan(inicio)
        expect(ao[0]).toBeLessThan(inicio + largura)
      }
    })

    it('tem pelo menos três degraus, com passo que ainda se lê a 16 px', () => {
      const desenho = lerDesenho(montar())
      expect(degraus(desenho, eixo).length).toBeGreaterThanOrEqual(3)
      const todos = vaos(desenho, eixo)
      const semPatamar = topo === 'inicio' ? todos.slice(1) : todos.slice(0, -1)
      expect(Math.min(...semPatamar)).toBeGreaterThanOrEqual(PASSO_MINIMO)
    })

    it('o patamar fica no topo e é pelo menos o dobro do maior vão entre degraus', () => {
      const todos = vaos(lerDesenho(montar()), eixo)
      const patamar = topo === 'inicio' ? todos[0] : todos[todos.length - 1]
      const semPatamar = topo === 'inicio' ? todos.slice(1) : todos.slice(0, -1)
      expect(patamar).toBeGreaterThanOrEqual(PATAMAR_SOBRE_PASSO * Math.max(...semPatamar))
    })

    it('usa a cor e o traço dos ícones da barra: currentColor, 1,2 px, sem preenchimento nem opacidade', () => {
      const svg = montar()
      expect(svg.getAttribute('fill')).toBe('none')
      expect(svg.getAttribute('stroke')).toBe('currentColor')
      expect(svg.getAttribute('aria-hidden')).toBe('true')
      const [, , , alturaDoViewBox] = viewBoxDe(svg)
      const traco = (numero(svg, 'stroke-width') * numero(svg, 'height')) / alturaDoViewBox
      expect(traco).toBeCloseTo(TRACO_DA_BARRA_PX, 6)
      const sobrescritos = Array.from(svg.querySelectorAll('*')).flatMap((el) =>
        ['fill', 'stroke', 'stroke-width', 'opacity', 'stroke-opacity', 'fill-opacity'].filter((a) => el.hasAttribute(a)).map((a) => `${el.tagName}[${a}]`),
      )
      expect(sobrescritos).toEqual([])
    })
  })

  it('na barra o StairIcon é o perfil de degraus: um traço aberto que sobe em escada, sem placa', () => {
    const svg = iconeDaBarra()
    const formas = Array.from(svg.querySelectorAll('*')).map((el) => el.tagName.toLowerCase())
    expect(formas).toEqual(['path'])
    const d = svg.querySelector('path')?.getAttribute('d') ?? ''
    expect(d).not.toMatch(/[zZ]/)
    const tracos = tracosDe(d)
    // Alterna subida (vertical, y diminui) e pisada (horizontal, x aumenta), começando pela subida.
    expect(tracos.length).toBeGreaterThanOrEqual(6)
    tracos.forEach((t, i) => {
      const subida = i % 2 === 0
      if (subida) {
        expect(Math.abs(t.x2 - t.x1), `espelho torto: ${JSON.stringify(t)}`).toBeLessThan(TOLERANCIA)
        expect(t.y2).toBeLessThan(t.y1)
      } else {
        expect(Math.abs(t.y2 - t.y1), `pisada torta: ${JSON.stringify(t)}`).toBeLessThan(TOLERANCIA)
        expect(t.x2).toBeGreaterThan(t.x1)
      }
    })
    // Degraus iguais e legíveis a 16 px: a silhueta é uma diagonal de degraus, não um rabisco.
    const alturas = tracos.filter((_, i) => i % 2 === 0).map((t) => t.y1 - t.y2)
    const larguras = tracos.filter((_, i) => i % 2 === 1).map((t) => t.x2 - t.x1)
    for (const passo of [...alturas, ...larguras]) expect(passo).toBeGreaterThanOrEqual(PASSO_MINIMO)
    expect(Math.max(...alturas) - Math.min(...alturas)).toBeLessThan(TOLERANCIA)
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThan(TOLERANCIA)
    expect(svg.getAttribute('stroke')).toBe('currentColor')
    expect(svg.getAttribute('fill')).toBe('none')
  })

  it('no Sentido a placa deita, e "Desce" é o desenho de "Sobe" espelhado', () => {
    const sobe = lerDesenho(miniaturaDoSentido('Sobe'))
    const desce = lerDesenho(miniaturaDoSentido('Desce'))
    expect(sobe.placa.w).toBeGreaterThan(sobe.placa.h)
    const altura = numero(sobe.svg, 'height')
    expect(altura).toBeGreaterThanOrEqual(16)
    expect(altura).toBeLessThanOrEqual(20)
    const [, , larguraDoViewBox] = viewBoxDe(sobe.svg)
    expect(desce.placa).toEqual({ ...sobe.placa, x: larguraDoViewBox - sobe.placa.x - sobe.placa.w })
    const espelhados = degraus(sobe, 'x')
      .map((x) => larguraDoViewBox - x)
      .sort((a, b) => a - b)
    expect(degraus(desce, 'x')).toEqual(espelhados)
  })
})
