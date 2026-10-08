/**
 * AJUSTE RÁPIDO na ficha do JOGADOR: fora da edição, o − do HP, a Força e o
 * "Ativar" saem na hora para a conexão (que junta e manda), e o valor
 * aparece já, por cima da ficha que a mesa mandou. Em edição não há ajuste
 * rápido; sem conexão, avisa; a mesa recusou, avisa sem travar nada.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { novoCartao, novoPersonagem, type Personagem } from '../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../lib/sistemaOnePiece'
import { PlayerFicha, type PlayerFichaProps } from './PlayerFicha'

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const BASE = novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy')
const FORMA = { ...novoCartao('Transformação'), id: 'forma', nome: 'Gear Second', modificadores: [{ atributo: 'forca', delta: 40 }] }
const LUFFY: Personagem = { ...BASE, id: 'pers_luffy', recursos: { hp: 600, sp: 60, escudo: 0 }, abas: { ...BASE.abas, transformacoes: [FORMA] } }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function props(extra: Partial<PlayerFichaProps> = {}): PlayerFichaProps {
  return {
    sistema: SISTEMA_ONE_PIECE,
    personagens: [LUFFY],
    tokens: [{ tokenId: 'tok-ana', nome: 'Ana', personagemId: LUFFY.id }],
    envio: undefined,
    onCriar: vi.fn(() => true),
    onSalvar: vi.fn(() => ({ ok: true as const, nada: false })),
    onClose: vi.fn(),
    escolherImagem: vi.fn(async () => null),
    onAjustar: vi.fn(() => true),
    ...extra,
  }
}

const render = (p: PlayerFichaProps) => act(() => root.render(<PlayerFicha {...p} />))

function porRotulo(rotulo: string): HTMLElement {
  const achado = container.querySelector<HTMLElement>(`[aria-label="${rotulo}"]`)
  if (achado === null) throw new Error(`"${rotulo}" não está na tela`)
  return achado
}

const clicar = (rotulo: string) => act(() => porRotulo(rotulo).click())
const quadrinhoDoHp = () => container.querySelector('.lb-ficha__recurso[data-tom="vida"]')?.textContent

describe('PlayerFicha: ajuste rápido', () => {
  it('o "−" do HP e o "+" da Força vão à conexão com o valor novo, do personagem mostrado', () => {
    const p = props()
    render(p)
    clicar('HP 600 de 600. Ajustar')
    clicar('Diminuir HP')
    clicar('Aumentar Força')
    expect(p.onAjustar).toHaveBeenNthCalledWith(1, LUFFY.id, { parte: 'recurso', chave: 'hp', valor: 599 })
    expect(p.onAjustar).toHaveBeenNthCalledWith(2, LUFFY.id, { parte: 'atributo', chave: 'forca', valor: 1 })
  })

  it('o ajuste que a mesa ainda não confirmou já aparece na ficha (e o rank da transformação ligada)', () => {
    render(
      props({
        ajustesPendentes: [
          { personagemId: LUFFY.id, parte: 'recurso', chave: 'hp', valor: 590 },
          { personagemId: LUFFY.id, parte: 'cartao', chave: 'forma', valor: 1 },
          { personagemId: 'pers_outro', parte: 'recurso', chave: 'hp', valor: 1 },
        ],
      }),
    )
    expect(quadrinhoDoHp()).toBe('HP590/600')
    const forca = Array.from(container.querySelectorAll('.lb-ficha__atributo')).find((linha) => linha.textContent?.startsWith('Força'))
    expect(forca?.querySelector('.lb-ficha__rank')?.textContent).toBe('R2')
  })

  it('"Ativar" da transformação sai como ajuste do cartão', () => {
    const p = props()
    render(p)
    act(() => {
      const aba = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((botao) => botao.textContent?.startsWith('Transformações'))
      aba?.click()
    })
    clicar('Ativar Gear Second')
    expect(p.onAjustar).toHaveBeenCalledWith(LUFFY.id, { parte: 'cartao', chave: 'forma', valor: 1 })
  })

  it('sem conexão o clique não entra e a ficha avisa; a mesa recusou o último, avisa sem travar', () => {
    render(props({ onAjustar: vi.fn(() => false) }))
    clicar('Aumentar Força')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('confira a conexão')
    render(props({ ajusteFalhou: true }))
    expect(container.textContent).toContain('A mesa não confirmou o último ajuste')
  })

  it('em edição não há ajuste rápido; o Editar começa da ficha com os ajustes ainda no ar', () => {
    const p = props({ ajustesPendentes: [{ personagemId: LUFFY.id, parte: 'atributo', chave: 'forca', valor: 7 }] })
    render(p)
    act(() => {
      const editar = Array.from(container.querySelectorAll('button')).find((botao) => botao.textContent === 'Editar')
      editar?.click()
    })
    expect(container.querySelector('[aria-label="Aumentar Força"], [aria-label="HP 600 de 600. Ajustar"]')).toBeNull()
    const forca = Array.from(container.querySelectorAll<HTMLInputElement>('input')).find((input) => input.id.endsWith('atributo-forca'))
    expect(forca?.value).toBe('7')
  })
})
