import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FichaDaPagina, type FichaDaPaginaProps } from './FichaDaPagina'

/*
 * A ficha das páginas Cena e Aventura (fatia 18) no lugar da seção recolhível:
 * lembra aberta/fechada na mesma chave `lb-section:<id>`, abre por pedido de
 * fora (o Ctrl+K dos Objetos do mapa) sem abrir na montagem, não monta o miolo
 * `lazy` fechado e põe o resumo na descrição do cabeçalho, nunca no nome.
 */

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  window.localStorage.clear()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.localStorage.clear()
})

const MIOLO = <ul className="miolo-de-teste" />

function ficha(extra: Partial<FichaDaPaginaProps> & { children?: ReactNode } = {}) {
  const { children = MIOLO, ...resto } = extra
  act(() =>
    root.render(
      <FichaDaPagina id="pins" titulo="Pinos" icone="pino" padrao={false} {...resto}>
        {children}
      </FichaDaPagina>,
    ),
  )
}

function cabecalho(): HTMLButtonElement {
  const botao = container.querySelector<HTMLButtonElement>('.gr-ficha__cab')
  if (botao === null) throw new Error('sem o cabeçalho da ficha')
  return botao
}

const aberta = () => cabecalho().getAttribute('aria-expanded') === 'true'
const guardada = (id: string) => window.localStorage.getItem(`lb-section:${id}`)
const miolo = () => container.querySelector('.miolo-de-teste')

/** O nome acessível: o texto do botão sem o que é `aria-hidden`. */
function nomeAcessivel(el: Element): string {
  const copia = el.cloneNode(true)
  if (!(copia instanceof Element)) return ''
  for (const oculto of copia.querySelectorAll('[aria-hidden="true"]')) oculto.remove()
  return (copia.textContent ?? '').trim()
}

/** O texto que o `aria-describedby` do cabeçalho aponta; `null` sem descrição. */
function descricao(): string | null {
  const id = cabecalho().getAttribute('aria-describedby')
  if (id === null) return null
  const alvo = document.getElementById(id)
  if (alvo === null) throw new Error(`a descrição aponta para #${id}, que não existe`)
  return alvo.textContent
}

describe('FichaDaPagina', () => {
  it('a chave de antes vence o padrão, e o clique grava a escolha para a próxima montagem', () => {
    window.localStorage.setItem('lb-section:floor', '0')
    ficha({ id: 'floor', titulo: 'Chão do mapa', icone: 'chao', padrao: true })
    expect(aberta()).toBe(false)
    act(() => cabecalho().click())
    expect(guardada('floor')).toBe('1')

    act(() => root.unmount())
    root = createRoot(container)
    ficha({ id: 'floor', titulo: 'Chão do mapa', icone: 'chao', padrao: false })
    expect(aberta()).toBe(true)
  })

  it('sem chave guardada vale o padrão, e montar não grava nada', () => {
    ficha({ padrao: true })
    expect(aberta()).toBe(true)
    ficha({ id: 'agenda', titulo: 'Agenda', icone: 'relogio', padrao: false })
    expect(aberta()).toBe(false)
    expect(window.localStorage.length).toBe(0)
  })

  it('lazy: fechada, o miolo nem existe; abre e monta, fecha e desmonta', () => {
    ficha({ lazy: true })
    expect(miolo()).toBeNull()
    act(() => cabecalho().click())
    expect(miolo()).not.toBeNull()
    act(() => cabecalho().click())
    expect(miolo()).toBeNull()
  })

  it('sem lazy o miolo existe fechado, mas fora do Tab e do leitor de tela (inert)', () => {
    ficha()
    const corpo = document.getElementById(cabecalho().getAttribute('aria-controls') ?? '')
    expect(corpo?.hasAttribute('inert')).toBe(true)
    expect(corpo?.contains(miolo())).toBe(true)
  })

  it('o resumo fica fora do nome e entra na descrição só com a ficha fechada', () => {
    ficha({ resumo: '3 pinos' })
    expect(nomeAcessivel(cabecalho())).toBe('Pinos')
    expect(descricao()).toBe('3 pinos')
    act(() => cabecalho().click())
    // Aberta, o resumo some da tela (grimorio.css) e da descrição.
    expect(descricao()).toBeNull()
    expect(nomeAcessivel(cabecalho())).toBe('Pinos')
  })

  it('sem resumo (ausente ou vazio) não há descrição nem o texto apagado na linha', () => {
    ficha()
    expect(descricao()).toBeNull()
    expect(container.querySelector('.gr-ficha__resumo')).toBeNull()
    ficha({ resumo: '' })
    expect(descricao()).toBeNull()
    expect(container.querySelector('.gr-ficha__resumo')).toBeNull()
  })

  it('o id vira o endereço data-secao, o mesmo de quem leva o foco até a seção', () => {
    ficha({ id: 'floor-layers', titulo: 'Camadas do chão', icone: 'peca' })
    expect(container.querySelector('section')?.getAttribute('data-secao')).toBe('floor-layers')
  })
})
