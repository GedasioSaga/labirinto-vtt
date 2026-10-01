/**
 * "Carregar Mapa": o "Excluir" troca a linha por uma pergunta. O Esc nela só
 * cancela — o mestre continua na lista, com o foco de volta no Excluir daquela
 * linha —, o foco começa no botão seguro, e apagar e duplicar avisam que
 * deu certo.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SavedMapEntry } from '../lib/mapFileIO'
import { useToastStore } from '../stores/toastStore'
import { LoadMapScreen } from './LoadMapScreen'

const arquivos = vi.hoisted(() => ({
  listSavedMaps: vi.fn<() => Promise<SavedMapEntry[]>>(),
  pickMapJsonToOpen: vi.fn<() => Promise<string | null>>(),
  renameMap: vi.fn<(id: string, newName: string) => Promise<string>>(),
  duplicateMap: vi.fn<(id: string) => Promise<SavedMapEntry>>(),
  deleteMap: vi.fn<(id: string) => Promise<void>>(),
}))

vi.mock('../lib/mapFileIO', () => arquivos)

function mapa(id: string, name: string): SavedMapEntry {
  return { path: `C:/mapas/${id}/map.json`, id, name, width: 30, height: 20, grid: 64, mtimeMs: 0 }
}

const TAVERNA = mapa('taverna', 'Taverna')
const CRIPTA = mapa('cripta', 'Cripta')

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  useToastStore.setState({ toasts: [] })
  arquivos.listSavedMaps.mockReset()
  arquivos.deleteMap.mockReset()
  arquivos.duplicateMap.mockReset()
  arquivos.listSavedMaps.mockResolvedValue([TAVERNA, CRIPTA])
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  // Os avisos que os testes criaram levam o timer de auto-dispensa junto.
  for (const toast of useToastStore.getState().toasts) useToastStore.getState().dismiss(toast.id)
})

/** Deixa as promessas da lista (ler, apagar, duplicar) chegarem à tela. */
async function assentar(): Promise<void> {
  for (let volta = 0; volta < 5; volta += 1) {
    await act(async () => {
      await Promise.resolve()
    })
  }
}

async function abrirTela(onBack: () => void = () => {}): Promise<void> {
  act(() => root.render(<LoadMapScreen onOpenPath={() => {}} onBack={onBack} />))
  await assentar()
}

function linha(nome: string): HTMLElement {
  const item = Array.from(container.querySelectorAll<HTMLElement>('.lb-maplist__item')).find((node) => (node.textContent ?? '').includes(nome))
  if (item === undefined) throw new Error(`sem a linha ${nome}`)
  return item
}

function botao(dentro: ParentNode, texto: string): HTMLButtonElement {
  const achado = Array.from(dentro.querySelectorAll('button')).find((node) => (node.textContent ?? '').trim() === texto)
  if (achado === undefined) throw new Error(`sem o botão ${texto}`)
  return achado
}

const pergunta = (): HTMLElement | null => container.querySelector('[role="alertdialog"]')

function teclar(alvo: Element | null, key: string): void {
  act(() => {
    alvo?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  })
}

describe('LoadMapScreen: a pergunta "Apagar mapa?"', () => {
  it('Excluir abre a pergunta como alertdialog, com nome, e o foco no Cancelar', async () => {
    await abrirTela()
    act(() => botao(linha('Cripta'), 'Excluir').click())
    const caixa = pergunta()
    expect(caixa).not.toBeNull()
    const titulo = document.getElementById(caixa?.getAttribute('aria-labelledby') ?? '')
    expect(titulo?.textContent).toContain('Apagar "Cripta"?')
    expect(document.activeElement).toBe(caixa === null ? null : botao(caixa, 'Cancelar'))
  })

  it('Esc na pergunta só cancela: o mestre continua na lista e o foco volta ao Excluir da linha', async () => {
    const onBack = vi.fn()
    await abrirTela(onBack)
    act(() => botao(linha('Cripta'), 'Excluir').click())
    teclar(document.activeElement, 'Escape')
    expect(onBack).not.toHaveBeenCalled()
    expect(pergunta()).toBeNull()
    expect(document.activeElement).toBe(botao(linha('Cripta'), 'Excluir'))
    expect(arquivos.deleteMap).not.toHaveBeenCalled()
  })

  it('Cancelar no clique também devolve o foco ao Excluir daquela linha', async () => {
    await abrirTela()
    act(() => botao(linha('Cripta'), 'Excluir').click())
    const caixa = pergunta()
    if (caixa === null) throw new Error('sem a pergunta')
    act(() => botao(caixa, 'Cancelar').click())
    expect(pergunta()).toBeNull()
    expect(document.activeElement).toBe(botao(linha('Cripta'), 'Excluir'))
  })

  it('controle: sem pergunta aberta, o Esc continua voltando ao menu', async () => {
    const onBack = vi.fn()
    await abrirTela(onBack)
    teclar(document.body, 'Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})

describe('LoadMapScreen: apagar e duplicar avisam', () => {
  it('Apagar confirmado avisa "<nome>" apagado.', async () => {
    arquivos.deleteMap.mockResolvedValue(undefined)
    await abrirTela()
    act(() => botao(linha('Cripta'), 'Excluir').click())
    arquivos.listSavedMaps.mockResolvedValue([TAVERNA])
    const caixa = pergunta()
    if (caixa === null) throw new Error('sem a pergunta')
    act(() => botao(caixa, 'Apagar').click())
    await assentar()
    expect(arquivos.deleteMap).toHaveBeenCalledWith('cripta')
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'info', text: '"Cripta" apagado.' }])
  })

  it('Duplicar avisa com o nome da cópia', async () => {
    const copia = mapa('taverna-2', 'Taverna (cópia)')
    arquivos.duplicateMap.mockResolvedValue(copia)
    await abrirTela()
    arquivos.listSavedMaps.mockResolvedValue([copia, TAVERNA, CRIPTA])
    act(() => botao(linha('Taverna'), 'Duplicar').click())
    await assentar()
    expect(arquivos.duplicateMap).toHaveBeenCalledWith('taverna')
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'info', text: 'Cópia criada: "Taverna (cópia)".' }])
  })

  it('apagar que falha não avisa sucesso: só o erro', async () => {
    arquivos.deleteMap.mockRejectedValue(new Error('arquivo em uso'))
    await abrirTela()
    act(() => botao(linha('Cripta'), 'Excluir').click())
    const caixa = pergunta()
    if (caixa === null) throw new Error('sem a pergunta')
    act(() => botao(caixa, 'Apagar').click())
    await assentar()
    expect(useToastStore.getState().toasts).toMatchObject([{ kind: 'error', text: 'Não foi possível excluir o mapa: arquivo em uso' }])
  })
})
