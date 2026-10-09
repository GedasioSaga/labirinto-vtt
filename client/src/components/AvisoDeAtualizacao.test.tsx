import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MainMenu } from '../screens/MainMenu'
import { novaMemoriaDaAbertura, type AtualizacaoAchada, type PortaDoAtualizador } from '../lib/atualizacao'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

function portaFalsa(opcoes: { achada?: AtualizacaoAchada | null; salaAberta?: boolean; falha?: boolean } = {}) {
  const porta: PortaDoAtualizador = {
    disponivel: () => true,
    procurar: vi.fn(async () => {
      if (opcoes.falha) throw new Error('sem internet')
      return opcoes.achada ?? null
    }),
    versaoAtual: vi.fn(async () => '0.4.19'),
    salaAberta: vi.fn(async () => opcoes.salaAberta ?? false),
    reiniciar: vi.fn(async () => {}),
  }
  return porta
}

function achada(): AtualizacaoAchada {
  return {
    versao: '0.4.20',
    notas: 'Mapa mais rápido.',
    instalar: vi.fn(async (aoProgredir: (baixado: number, total: number | null) => void) => {
      aoProgredir(50, 200)
    }),
  }
}

async function montar(porta: PortaDoAtualizador, memoria = novaMemoriaDaAbertura()) {
  await act(async () => {
    root.render(
      <MainMenu onCreate={vi.fn()} onLoad={vi.fn()} onOptions={vi.fn()} onRoleplay={vi.fn()} atualizador={porta} memoriaDaAtualizacao={memoria} />,
    )
  })
  return memoria
}

const botao = (texto: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === texto)

describe('atualização na tela inicial', () => {
  it('ao abrir, procura sozinha e mostra "Versão X pronta" com as notas', async () => {
    await montar(portaFalsa({ achada: achada() }))
    expect(container.textContent).toContain('Versão 0.4.20 pronta')
    expect(container.textContent).toContain('Mapa mais rápido.')
    expect(botao('Atualizar agora')).toBeDefined()
  })

  it('"Atualizar agora" baixa, mostra o progresso e reinicia', async () => {
    const nova = achada()
    const porta = portaFalsa({ achada: nova })
    await montar(porta)
    await act(async () => botao('Atualizar agora')?.click())
    expect(nova.instalar).toHaveBeenCalledOnce()
    expect(porta.reiniciar).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('O app vai reiniciar')
  })

  it('"Depois" fecha e a mesma abertura não pergunta de novo ao voltar à tela', async () => {
    const porta = portaFalsa({ achada: achada() })
    const memoria = await montar(porta)
    act(() => botao('Depois')?.click())
    expect(container.textContent).not.toContain('Versão 0.4.20 pronta')
    expect(memoria.adiada).toBe(true)
    // Voltar do editor remonta a tela: não é abrir o app.
    act(() => root.unmount())
    root = createRoot(container)
    await montar(porta, memoria)
    expect(porta.procurar).toHaveBeenCalledOnce()
    expect(container.textContent).not.toContain('Versão 0.4.20 pronta')
  })

  it('com sala aberta não mostra aviso nenhum', async () => {
    await montar(portaFalsa({ achada: achada(), salaAberta: true }))
    expect(container.textContent).not.toContain('pronta')
  })

  it('sem internet na abertura fica em silêncio', async () => {
    await montar(portaFalsa({ falha: true }))
    expect(container.querySelector('.lb-atualizacao')).toBeNull()
    expect(container.textContent).not.toContain('Não deu')
  })

  it('"Procurar atualizações" sem versão nova diz que está em dia', async () => {
    await montar(portaFalsa())
    await act(async () => botao('Procurar atualizações')?.click())
    expect(container.textContent).toContain('Você está na versão mais nova (0.4.19).')
  })

  it('fora do app não há botão nem procura', async () => {
    const porta = { ...portaFalsa({ achada: achada() }), disponivel: () => false }
    await montar(porta)
    expect(botao('Procurar atualizações')).toBeUndefined()
    expect(porta.procurar).not.toHaveBeenCalled()
  })
})
