import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Pin } from '../types/map'
import { PlayerPinCard } from './PlayerPinCard'

/*
 * CARTÃO DE PINO COMPACTO — simulação de 7 jogadores, cenário vila*: o pino sem
 * imagem abria com um retângulo escuro de 190 px em cima do texto, e o jogador
 * lia aquilo como imagem quebrada. Sem imagem, o cartão é só glifo, texto e
 * botões; com imagem, fica como era (foto em cima, texto embaixo).
 *
 * O jsdom não tem layout: o que se prova aqui é a ESTRUTURA que a folha de
 * estilo arruma — o que existe no cartão, em que ordem e com que nome para o
 * leitor de tela. A posição em pixel é da jornada
 * `task-jornada-pinos-ponto-de-interesse.spec.ts`, que continua cobrando uma
 * imagem ACIMA da descrição: no cartão compacto, essa imagem é a cabeça do
 * pino, a mesma que o jogador acabou de tocar no mapa.
 */

const FOTO = 'data:image/png;base64,iVBORw0KGgo='
const DESCRICAO = 'Estátua de mármore rachada, com uma moeda no pedestal.'

function pino(parcial: Partial<Pin> = {}): Pin {
  return { id: 'p-estatua', x: 100, y: 100, kind: 'exclamacao', description: DESCRICAO, image: null, ...parcial }
}

type Props = Parameters<typeof PlayerPinCard>[0]

describe('PlayerPinCard: sem imagem, só glifo, texto e botões; com imagem, igual a hoje', () => {
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

  function abre(pin: Pin, extra: Partial<Props> = {}): HTMLElement {
    act(() => root.render(<PlayerPinCard pin={pin} onClose={() => {}} {...extra} />))
    const cartao = container.querySelector<HTMLElement>('[role="dialog"]')
    if (cartao === null) throw new Error('o cartão não abriu')
    return cartao
  }

  /** Classe de cada filho do cartão, na ordem em que o olho (e o leitor de tela) passa. */
  function ordem(cartao: HTMLElement): string[] {
    return Array.from(cartao.children).map((filho) => filho.className)
  }

  it('pino sem imagem abre compacto: nenhum retângulo de imagem, o cartão começa pela cabeça do pino e o texto', () => {
    const cartao = abre(pino())

    expect(cartao.querySelector('img')).toBeNull()
    expect(cartao.classList.contains('pp-pincard--compacto')).toBe(true)
    expect(ordem(cartao)).toEqual(['pp-pincard__body', 'pp-pincard__close'])

    // A cabeça vem antes do texto: é a imagem que a jornada mede ACIMA da descrição.
    const [cabeca, texto] = Array.from(cartao.children[0].children)
    expect(cabeca.getAttribute('role')).toBe('img')
    expect(cabeca.getAttribute('aria-label')).toBe('Símbolo do pino: exclamação')
    expect(cabeca.textContent).toBe('!')
    expect(texto.textContent).toBe(DESCRICAO)
  })

  it('pino sem imagem e sem descrição: compacto, com a frase de sempre no lugar do texto', () => {
    const cartao = abre(pino({ description: '   ', kind: 'interrogacao' }))

    expect(cartao.querySelector('img')).toBeNull()
    expect(cartao.classList.contains('pp-pincard--compacto')).toBe(true)
    const cabeca = cartao.querySelector('.pp-pincard__glyph')
    expect(cabeca?.getAttribute('aria-label')).toBe('Símbolo do pino: interrogação')
    expect(cabeca?.textContent).toBe('?')
    expect(cartao.querySelector('.pp-pincard__text')?.textContent).toBe('O mestre ainda não escreveu nada sobre este ponto.')
  })

  it('pino com imagem: igual a hoje — a foto em cima, depois a cabeça do pino ao lado do texto', () => {
    const cartao = abre(pino({ image: FOTO }))

    expect(cartao.classList.contains('pp-pincard--compacto')).toBe(false)
    expect(ordem(cartao)).toEqual(['pp-pincard__image', 'pp-pincard__body', 'pp-pincard__close'])
    const foto = cartao.children[0]
    expect(foto.tagName).toBe('IMG')
    expect(foto.getAttribute('src')).toBe(FOTO)
    expect(foto.getAttribute('alt')).toBe('Imagem deixada pelo mestre neste ponto de interesse')
    const corpo = cartao.children[1]
    expect(corpo.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('Símbolo do pino: exclamação')
    expect(corpo.querySelector('.pp-pincard__text')?.textContent).toBe(DESCRICAO)
  })

  it('caminho de disco do mestre nunca vira imagem: o cartão abre compacto, sem tentar carregar nada', () => {
    const cartao = abre(pino({ image: 'C:\\Users\\mestre\\mapas\\estatua.png' }))

    expect(cartao.querySelector('img')).toBeNull()
    expect(cartao.classList.contains('pp-pincard--compacto')).toBe(true)
  })

  it('a cabeça do cartão é a do pino no mapa: com símbolo, o desenho dele; de viagem, a passagem (nunca o símbolo)', () => {
    const bau = abre(pino({ icon: 'bau' })).querySelector('.pp-pincard__glyph')
    expect(bau?.getAttribute('role')).toBe('img')
    expect(bau?.getAttribute('aria-label')).toBe('Símbolo do pino: baú')
    expect(bau?.querySelector('svg')).not.toBeNull()
    // O "!" sai de cena, como no mapa (`pixi/drawPins.ts`): o símbolo ocupa a cabeça.
    expect(bau?.textContent).toBe('')

    const passagem = abre(pino({ kind: 'viagem', icon: 'bau' })).querySelector('.pp-pincard__glyph')
    expect(passagem?.getAttribute('aria-label')).toBe('Símbolo do pino: passagem')
    expect(passagem?.classList.contains('pp-pincard__glyph--viagem')).toBe(true)
    expect(passagem?.querySelector('svg')).not.toBeNull()
  })

  it('pino de viagem sem imagem: compacto, com o pedido de passagem logo abaixo do texto e o Fechar por último', () => {
    const cartao = abre(pino({ kind: 'viagem', description: 'Escada para o porão.' }), { onRequestTravel: () => {} })

    expect(cartao.querySelector('img')).toBeNull()
    expect(ordem(cartao)).toEqual(['pp-pincard__body', 'pp-pincard__travel', 'pp-pincard__close'])
    expect(cartao.querySelector('.pp-pincard__travel')?.textContent).toBe('Pedir para passar')
  })
})
