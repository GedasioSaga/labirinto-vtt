/**
 * PASTAS no "Carregar Mapa": criar pasta, pôr um mapa nela pelo "Mover…" e
 * arrastando o card, recolher e abrir, e apagar a pasta — os mapas voltam
 * para fora, nenhum é apagado.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedMapEntry } from '../lib/mapFileIO'
import type { IndiceDasPastas, IndiceLido, RpgLido } from '../lib/pastasDeMapas'
import { useToastStore } from '../stores/toastStore'
import { LoadMapScreen } from './LoadMapScreen'

const arquivos = vi.hoisted(() => ({
  listSavedMaps: vi.fn<() => Promise<SavedMapEntry[]>>(),
  pickMapJsonToOpen: vi.fn<() => Promise<string | null>>(),
  renameMap: vi.fn<(id: string, newName: string) => Promise<string>>(),
  duplicateMap: vi.fn<(id: string) => Promise<SavedMapEntry>>(),
  deleteMap: vi.fn<(id: string) => Promise<void>>(),
}))

/** O índice das pastas em memória, no lugar do disco. */
const disco = vi.hoisted(() => {
  const vazio = (): IndiceDasPastas => ({ pastas: [], mapas: [] })
  let indice = vazio()
  return {
    lerIndiceDasPastas: vi.fn(async (): Promise<IndiceLido> => ({ indice, aviso: null })),
    mudarIndiceDasPastas: vi.fn(async (mudar: (atual: IndiceDasPastas) => IndiceDasPastas): Promise<IndiceDasPastas> => {
      indice = mudar(indice)
      return indice
    }),
    lerRpgDaPasta: vi.fn(async (): Promise<RpgLido> => ({ ok: true, rpg: { personagens: [] } })),
    zerar: () => {
      indice = vazio()
    },
    atual: () => indice,
  }
})

vi.mock('../lib/mapFileIO', () => arquivos)
vi.mock('../lib/pastasDeMapas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/pastasDeMapas')>()),
  lerIndiceDasPastas: disco.lerIndiceDasPastas,
  mudarIndiceDasPastas: disco.mudarIndiceDasPastas,
  lerRpgDaPasta: disco.lerRpgDaPasta,
}))

const MIME_DO_MAPA = 'application/x-labirinto-mapa'

function mapa(id: string, name: string): SavedMapEntry {
  return { path: `C:/appdata/maps/${id}/map.json`, id, name, width: 30, height: 20, grid: 64, mtimeMs: 0 }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useToastStore.setState({ toasts: [] })
  disco.zerar()
  arquivos.deleteMap.mockReset()
  arquivos.listSavedMaps.mockResolvedValue([mapa('taverna', 'Taverna'), mapa('cripta', 'Cripta')])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
})

async function montar(): Promise<void> {
  await act(async () => {
    root.render(<LoadMapScreen onOpenPath={() => {}} onBack={() => {}} />)
  })
}

function botao(nome: string, escopo: ParentNode = container): HTMLButtonElement {
  const alvo = Array.from(escopo.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent === nome || b.getAttribute('aria-label') === nome)
  if (alvo === undefined) throw new Error(`sem botão ${nome}`)
  return alvo
}

async function clicar(alvo: HTMLElement): Promise<void> {
  await act(async () => {
    alvo.click()
  })
}

/** Troca o valor como o teclado trocaria: o React só ouve o evento do campo. */
function preencher(campo: HTMLInputElement | HTMLSelectElement, valor: string): void {
  const prototipo = campo instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLSelectElement.prototype
  act(() => {
    Object.getOwnPropertyDescriptor(prototipo, 'value')?.set?.call(campo, valor)
    campo.dispatchEvent(new Event(campo instanceof HTMLInputElement ? 'input' : 'change', { bubbles: true }))
  })
}

function secao(nome: string): HTMLElement {
  const alvo = container.querySelector<HTMLElement>(`section[aria-label="${nome}"]`)
  if (alvo === null) throw new Error(`sem a seção ${nome}`)
  return alvo
}

function nomesEm(escopo: HTMLElement): string[] {
  return Array.from(escopo.querySelectorAll('.lb-maplist__item .lb-maplist__name'))
    .map((nome) => nome.textContent ?? '')
    .filter((nome) => nome !== 'Campanha')
}

async function criarPastaCampanha(): Promise<void> {
  await montar()
  await clicar(botao('+ Nova pasta'))
  const campo = container.querySelector<HTMLInputElement>('#lb-nova-pasta')
  if (campo === null) throw new Error('sem o campo da pasta nova')
  preencher(campo, 'Campanha')
  await clicar(botao('Criar'))
}

/** Solta o card `chave` sobre `alvo`, com o dado do arrasto que o card põe. */
async function soltar(chave: string, alvo: HTMLElement): Promise<void> {
  const dados = { types: [MIME_DO_MAPA], getData: (tipo: string) => (tipo === MIME_DO_MAPA ? chave : ''), setData: () => {}, dropEffect: 'none', effectAllowed: 'all' }
  for (const tipo of ['dragover', 'drop']) {
    const evento = new Event(tipo, { bubbles: true, cancelable: true })
    Object.defineProperty(evento, 'dataTransfer', { value: dados })
    await act(async () => {
      alvo.dispatchEvent(evento)
    })
  }
}

describe('Carregar Mapa: pastas', () => {
  it('criar a pasta: ela aparece vazia, e os mapas ficam em "Fora das pastas"', async () => {
    await criarPastaCampanha()
    expect(disco.atual().pastas.map((pasta) => pasta.nome)).toEqual(['Campanha'])
    expect(secao('Pasta Campanha').textContent).toContain('Pasta vazia')
    expect(nomesEm(secao('Fora das pastas'))).toEqual(['Taverna', 'Cripta'])
  })

  it('"Mover…" põe o mapa na pasta; arrastar o card até a pasta também', async () => {
    await criarPastaCampanha()
    const taverna = Array.from(container.querySelectorAll<HTMLElement>('.lb-maplist__item')).find((item) => item.textContent?.includes('Taverna'))
    if (taverna === undefined) throw new Error('sem a Taverna')
    await clicar(botao('Mover…', taverna))
    const destino = container.querySelector<HTMLSelectElement>('#lb-mover-taverna')
    if (destino === null) throw new Error('sem a escolha da pasta')
    preencher(destino, disco.atual().pastas[0].id)
    await clicar(botao('Mover'))
    expect(nomesEm(secao('Pasta Campanha'))).toEqual(['Taverna'])

    await soltar('cripta', secao('Pasta Campanha'))
    expect(nomesEm(secao('Pasta Campanha'))).toEqual(['Taverna', 'Cripta'])
    expect(nomesEm(secao('Fora das pastas'))).toEqual([])

    // E de volta para fora, arrastando.
    await soltar('cripta', secao('Fora das pastas'))
    expect(nomesEm(secao('Fora das pastas'))).toEqual(['Cripta'])
  })

  it('recolher esconde os mapas da pasta; abrir mostra de novo', async () => {
    await criarPastaCampanha()
    await soltar('taverna', secao('Pasta Campanha'))
    const alternar = botao('Recolher a pasta Campanha')
    expect(alternar.getAttribute('aria-expanded')).toBe('true')
    await clicar(alternar)
    expect(nomesEm(secao('Pasta Campanha'))).toEqual([])
    await clicar(botao('Abrir a pasta Campanha'))
    expect(nomesEm(secao('Pasta Campanha'))).toEqual(['Taverna'])
  })

  it('apagar a pasta: pergunta, e os mapas voltam para a lista sem nenhum ser apagado', async () => {
    await criarPastaCampanha()
    await soltar('taverna', secao('Pasta Campanha'))
    const cabecalho = secao('Pasta Campanha')
    await clicar(botao('Excluir', cabecalho))
    expect(container.querySelector('[role="alertdialog"]')?.textContent).toContain('nenhum mapa é apagado')
    await clicar(botao('Apagar pasta'))
    expect(container.querySelector('section[aria-label="Pasta Campanha"]')).toBeNull()
    expect(disco.atual()).toEqual({ pastas: [], mapas: [] })
    expect(Array.from(container.querySelectorAll('.lb-maplist__name')).map((nome) => nome.textContent)).toEqual(['Taverna', 'Cripta'])
    expect(arquivos.deleteMap).not.toHaveBeenCalled()
    expect(useToastStore.getState().toasts.map((toast) => toast.text).join(' ')).toContain('continuam na lista')
  })
})
