import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { esquecerPacotesDeMinigames, type PortaDoPacoteDeMinigames } from '../minigames/pacoteDeMinigames'
import { PacoteDoMinigame } from './PacoteDoMinigame'

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  esquecerPacotesDeMinigames()
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

it('esconde o chamar enquanto baixa, mostra a barra e libera ao terminar; falha mostra o motivo e "Tentar de novo"', async () => {
  const MB = 1024 * 1024
  let progredir: (valor: unknown) => void = () => {}
  let terminar: (valor: unknown) => void = () => {}
  let tentativa = 0
  const porta: PortaDoPacoteDeMinigames = {
    disponivel: () => true,
    lerIndice: async () => null,
    atualizar: (_jogo, aoProgredir) => {
      tentativa += 1
      if (tentativa === 1) return Promise.resolve({ estado: 'sem_internet', versao: null, indice: null })
      progredir = aoProgredir
      return new Promise((resolver) => {
        terminar = resolver
      })
    },
  }
  const desenhar = () =>
    root.render(
      <PacoteDoMinigame jogo="fogo" ocupado={false} porta={porta} dispensarSemPacote={false}>
        <button type="button">Chamar para o fogo</button>
      </PacoteDoMinigame>,
    )
  await act(async () => desenhar())
  expect(container.textContent).toContain('Sem internet para baixar o Fogo na Floresta')
  expect(container.textContent).not.toContain('Chamar para o fogo')

  const tentar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Tentar de novo')
  expect(tentar).toBeDefined()
  await act(async () => tentar?.click())
  await act(async () => progredir({ baixado: 4 * MB, total: 10 * MB }))
  const barra = container.querySelector('progress')
  expect(barra?.value).toBe(4 * MB)
  expect(barra?.max).toBe(10 * MB)
  expect(container.textContent).toContain('Baixando o Fogo na Floresta (só na primeira vez)')
  expect(container.textContent).toContain('4,0 de 10,0 MB')
  expect(container.textContent).not.toContain('Chamar para o fogo')

  await act(async () => terminar({ estado: 'novo', versao: 1, indice: '{}' }))
  expect(container.querySelector('progress')).toBeNull()
  expect(container.textContent).toContain('Chamar para o fogo')
})
