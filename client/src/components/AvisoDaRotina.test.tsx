/**
 * AVISO AO MESTRE na tela (caminhos, F0): a frase em português simples, sem id
 * cru; no máximo 3 à vista e "e mais N"; "Fechar" dispensa só aquele, até ele
 * sumir e voltar.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AvisoDePortaTrancada } from '../lib/avisosDaRotina'

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(async () => undefined),
  rename: vi.fn(async () => undefined),
  mkdir: vi.fn(async () => undefined),
  exists: vi.fn(async () => false),
  readTextFile: vi.fn(async () => {
    throw new Error('sem disco neste teste')
  }),
  readDir: vi.fn(async () => []),
  stat: vi.fn(async () => ({ mtime: null })),
  remove: vi.fn(async () => undefined),
  copyFile: vi.fn(async () => undefined),
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save: vi.fn(async () => null), open: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined) }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { AvisoDaRotina } = await import('./AvisoDaRotina')
const { useRotinaAndandoStore } = await import('../stores/rotinaAndandoStore')
const { usePatrulhaAndandoStore } = await import('../stores/patrulhaAndandoStore')

let container: HTMLDivElement
let root: Root

function aviso(origem: 'rotina' | 'patrulha', tokenId: string, npc: string, portaId: string, porta: string): AvisoDePortaTrancada {
  return { chave: `${origem}:${tokenId}:${portaId}`, origem, motivo: 'porta-trancada', tokenId, portaId, npc, porta }
}

function itens(): string[] {
  return [...container.querySelectorAll('.lb-aviso-rotina__texto')].map((el) => el.textContent ?? '')
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<AvisoDaRotina />))
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useRotinaAndandoStore.setState({ avisos: [] })
  usePatrulhaAndandoStore.setState({ avisos: [] })
})

describe('AvisoDaRotina', () => {
  it('sem NPC parado: nada na tela', () => {
    expect(container.innerHTML).toBe('')
  })

  it('"Porta X trancada: NPC Y parou", com o nome da ficha e a porta para gente, nunca o id', () => {
    act(() => usePatrulhaAndandoStore.setState({ avisos: [aviso('patrulha', 'tok-guarda-9f2', 'Guarda', 'wall-77ab', 'Porta da sala Cozinha')] }))
    expect(itens()).toEqual(['Porta da sala Cozinha trancada: Guarda parou'])
    expect(container.textContent).not.toContain('wall-77ab')
    expect(container.textContent).not.toContain('tok-guarda-9f2')
    const fechar = container.querySelector('button')
    expect(fechar?.getAttribute('aria-label')).toBe('Fechar aviso: Porta da sala Cozinha trancada: Guarda parou')
    expect(container.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe('Avisos dos NPCs')
  })

  it('empilha no máximo 3, da rotina e da patrulha, e diz quantos sobram', () => {
    act(() => {
      useRotinaAndandoStore.setState({
        avisos: [aviso('rotina', 'a', 'Ana', 'p1', 'Porta'), aviso('rotina', 'b', 'Bento', 'p1', 'Porta'), aviso('rotina', 'c', 'Caio', 'p2', 'Grade')],
      })
      usePatrulhaAndandoStore.setState({ avisos: [aviso('patrulha', 'd', 'Dora', 'p3', 'Porta dupla'), aviso('patrulha', 'e', 'Eva', 'p3', 'Porta dupla')] })
    })
    expect(itens()).toEqual(['Porta trancada: Ana parou', 'Porta trancada: Bento parou', 'Grade trancada: Caio parou'])
    expect(container.querySelector('.lb-aviso-rotina__mais')?.textContent).toBe('e mais 2')
  })

  it('"Fechar" tira só aquele e o próximo sobe; o que some do store e volta aparece de novo', () => {
    const dora = aviso('patrulha', 'd', 'Dora', 'p3', 'Porta dupla')
    const eva = aviso('patrulha', 'e', 'Eva', 'p3', 'Porta dupla')
    act(() => usePatrulhaAndandoStore.setState({ avisos: [dora, eva] }))
    act(() => container.querySelector('button')?.click())
    expect(itens()).toEqual(['Porta dupla trancada: Eva parou'])
    // A Dora passou (destrancaram) e depois trancaram de novo: o aviso volta.
    act(() => usePatrulhaAndandoStore.setState({ avisos: [eva] }))
    act(() => usePatrulhaAndandoStore.setState({ avisos: [dora, eva] }))
    expect(itens()).toEqual(['Porta dupla trancada: Dora parou', 'Porta dupla trancada: Eva parou'])
  })

  it('a porta destrancada tira o aviso da tela', () => {
    act(() => useRotinaAndandoStore.setState({ avisos: [aviso('rotina', 'a', 'Ana', 'p1', 'Porta')] }))
    expect(itens()).toHaveLength(1)
    act(() => useRotinaAndandoStore.setState({ avisos: [] }))
    expect(container.innerHTML).toBe('')
  })
})
