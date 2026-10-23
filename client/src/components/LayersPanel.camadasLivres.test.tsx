// FATIA 7 no painel: "+ Nova camada" abre o nome para escrever; Enter grava,
// Esc desiste; Subir/Descer pelo teclado com o foco no botão que andou; Apagar
// só em camada livre; sem `modelo`, nada disso aparece (a lista é só leitura).
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { MapData } from '../types/map'
import { apagarCamadaLivre, criarCamadaLivre, moverCamada, renomearCamada } from '../lib/camadas/modelo'
import { createEmptyMap } from '../lib/mapFactory'
import { LayersPanel, type AcoesDoModelo } from './LayersPanel'

type Pedido = [string, ...unknown[]]

function Harness({ pedidos, inicial, comModelo = true }: { pedidos: Pedido[]; inicial: MapData; comModelo?: boolean }) {
  const [map, setMap] = useState(inicial)
  const modelo: AcoesDoModelo = {
    criar: async (acimaDe) => {
      pedidos.push(['criar', acimaDe])
      const criada = criarCamadaLivre(map, { acimaDe })
      if (criada === null) return null
      setMap(criada.map)
      return criada.id
    },
    renomear: (id, nome) => {
      pedidos.push(['renomear', id, nome])
      setMap((m) => renomearCamada(m, id, nome))
    },
    mover: (id, destino) => {
      pedidos.push(['mover', id, destino])
      setMap((m) => moverCamada(m, id, destino))
    },
    apagar: (id) => {
      pedidos.push(['apagar', id])
      setMap((m) => apagarCamadaLivre(m, id).map)
    },
  }
  return <LayersPanel camadas={map} counts={{ paredes: 1 }} onToggleLayer={() => {}} onTogglePlayers={() => {}} onToggleLock={() => {}} onOpacity={() => {}} {...(comModelo ? { modelo } : {})} />
}

let alvo: HTMLDivElement
let raiz: Root

beforeEach(() => {
  alvo = document.createElement('div')
  document.body.appendChild(alvo)
  raiz = createRoot(alvo)
})

afterEach(() => {
  act(() => raiz.unmount())
  alvo.remove()
})

const botao = (nome: string): HTMLButtonElement => {
  const achado = Array.from(alvo.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === nome || b.textContent === nome)
  if (achado === undefined) throw new Error(`sem botão ${nome}`)
  return achado
}
const linhas = (): string[] => Array.from(alvo.querySelectorAll('li[data-camada]')).map((li) => li.getAttribute('data-camada') ?? '')

async function montar(pedidos: Pedido[], comModelo = true): Promise<void> {
  await act(async () => raiz.render(<Harness pedidos={pedidos} inicial={createEmptyMap('m', 'M', 4, 4, 64)} comModelo={comModelo} />))
}

describe('painel: camadas livres', () => {
  it('"+ Nova camada" cria no topo e abre o nome selecionado; Enter grava; o foco volta ao nome', async () => {
    const pedidos: Pedido[] = []
    await montar(pedidos)
    await act(async () => botao('+ Nova camada').click())
    const campo = alvo.querySelector<HTMLInputElement>('input[type="text"]')
    expect(campo).not.toBeNull()
    expect(document.activeElement).toBe(campo)
    expect(campo?.value).toBe('Nova camada')
    expect([campo?.selectionStart, campo?.selectionEnd]).toEqual([0, 'Nova camada'.length])
    const id = linhas()[0]
    expect(id).toMatch(/^livre_[0-9a-f]{8}$/)
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      set?.call(campo, 'Cripta')
      campo?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
    expect(pedidos).toContainEqual(['renomear', id, 'Cripta'])
    expect(alvo.querySelector(`li[data-camada="${id}"]`)?.textContent).toMatch(/^Cripta\s*0$/)
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Cripta, opacidade')
  })

  it('Esc no nome desiste (nada é renomeado) e não chega ao mapa', async () => {
    const pedidos: Pedido[] = []
    await montar(pedidos)
    await act(async () => botao('+ Nova camada').click())
    const campo = alvo.querySelector<HTMLInputElement>('input[type="text"]')
    let chegou = false
    const ouvir = () => {
      chegou = true
    }
    window.addEventListener('keydown', ouvir)
    await act(async () => campo?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    window.removeEventListener('keydown', ouvir)
    expect(pedidos.some(([tipo]) => tipo === 'renomear')).toBe(false)
    expect(chegou).toBe(false)
    expect(alvo.querySelector('input[type="text"]')).toBeNull()
  })

  it('Subir/Descer: mexe um lugar, o foco fica no botão, e nos extremos o botão desliga', async () => {
    const pedidos: Pedido[] = []
    await montar(pedidos)
    await act(async () => botao('Salas, opacidade').click())
    await act(async () => botao('Subir Salas').focus())
    await act(async () => botao('Subir Salas').click())
    expect(pedidos).toContainEqual(['mover', 'salas', 2])
    expect(linhas().slice(-3)).toEqual(['salas', 'desenhos', 'chao'])
    expect(document.activeElement).toBe(botao('Subir Salas'))
    await act(async () => botao('Telhados, opacidade').click())
    expect(botao('Subir Telhados').disabled).toBe(true)
    expect(botao('Descer Telhados').disabled).toBe(false)
  })

  it('Apagar e Renomear só em camada livre', async () => {
    const pedidos: Pedido[] = []
    await montar(pedidos)
    await act(async () => botao('Paredes, opacidade').click())
    expect(alvo.querySelector('[aria-label="Subir Paredes"]')).not.toBeNull()
    expect(alvo.querySelector('[aria-label="Apagar a camada Paredes"]')).toBeNull()
    expect(alvo.querySelector('[aria-label="Renomear Paredes"]')).toBeNull()
    await act(async () => botao('+ Nova camada').click())
    await act(async () => alvo.querySelector<HTMLInputElement>('input[type="text"]')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))
    // Com Paredes aberta, a camada nova nasce logo ACIMA dela (como "camada nova acima da atual").
    const id = linhas().find((c) => c.startsWith('livre_')) ?? ''
    expect(linhas().indexOf(id)).toBe(linhas().indexOf('paredes') - 1)
    await act(async () => botao('Nova camada, opacidade').click())
    expect(alvo.querySelector('[aria-label="Renomear Nova camada"]')).not.toBeNull()
    await act(async () => botao('Apagar a camada Nova camada').click())
    expect(pedidos).toContainEqual(['apagar', id])
    expect(linhas()).not.toContain(id)
  })

  it('sem `modelo`: sem alça, sem Subir/Descer e sem "+ Nova camada"; o texto da linha continua nome e contagem', async () => {
    await montar([], false)
    expect(alvo.querySelector('.lb-camadas__alca')).toBeNull()
    expect(alvo.querySelector('[aria-label="Subir Salas"]')).toBeNull()
    expect(Array.from(alvo.querySelectorAll('button')).some((b) => b.textContent === '+ Nova camada')).toBe(false)
    expect(alvo.querySelector('li[data-camada="paredes"]')?.textContent).toMatch(/^Paredes\s*1$/)
  })

  it('com `modelo`, a linha continua "Paredes 1" (alça e ações não têm texto na linha fechada... só no miolo)', async () => {
    await montar([])
    const cabeca = alvo.querySelector('li[data-camada="paredes"] .lb-camadas__cabeca')
    expect(cabeca?.textContent).toMatch(/^Paredes\s*1$/)
    expect(alvo.querySelector('li[data-camada="paredes"] .lb-camadas__alca')?.getAttribute('aria-hidden')).toBe('true')
  })
})
