/**
 * A MOCHILA NA FICHA DO MESTRE durante a edição (conserto de 16/11/2026): a
 * grade da aba Itens é a mochila de verdade nos dois modos de dono. Antes da
 * migração (`mochilaMigrada` ausente) o BONECO é o dono: a edição não troca a
 * grade pela cópia da ficha (vazia: "Inventário 0" com Balas de prata ×2 no
 * token), e o "+ Adicionar" e o Salvar não apagam nada dele. Depois dela a
 * FICHA é a dona: a grade da edição é o rascunho, conta igual à aba, e o
 * Salvar guarda o que entrou com a janela aberta e o que o "Passar para a
 * mochila" pôs. Dados inventados.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CarriedItem, MapData, Token } from '../types/map'
import type { Personagem } from '../lib/personagem'

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
vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => undefined), isTauri: () => false }))
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn(async () => 'C:/appdata'),
  join: vi.fn(async (...parts: string[]) => parts.join('/')),
  dirname: vi.fn(async (path: string) => path.slice(0, path.lastIndexOf('/'))),
}))

const { useAdventureStore, applyItemsInScene, personagensAtivos } = await import('../stores/adventureStore')
const { useMapStore } = await import('../stores/mapStore')
const { useRpgStore } = await import('../stores/rpgStore')
const { useSessionStore } = await import('../stores/sessionStore')
const { useToastStore } = await import('../stores/toastStore')
const { createEmptyMap } = await import('../lib/mapFactory')
const { novoCartao, novoPersonagem } = await import('../lib/personagem')
const { SISTEMA_ONE_PIECE } = await import('../lib/sistemaOnePiece')
const { RpgDialogs } = await import('./RpgDialogs')
type Adventure = import('../lib/adventure').Adventure
type OpenedMapFile = import('../lib/mapFileIO').OpenedMapFile

beforeAll(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
})

const CENA = 's_sky'
const BALAS: CarriedItem = { id: 'vaga_balas', nome: 'Balas de prata', quantidade: 2, empilhavel: true }
const POCAO: CarriedItem = { id: 'vaga_pocao', nome: 'Poção' }

function luffy(extra: Partial<Personagem> = {}): Personagem {
  return { ...novoPersonagem(SISTEMA_ONE_PIECE, 'jogador', 'Luffy'), id: 'p_luffy', ...extra }
}

/** Abre a aventura com o Luffy ligado ao boneco `t_luffy` da cena aberta. `migrada` = a ficha é a dona da mochila. */
async function abrir(ficha: Personagem, migrada: boolean, mochilaDoBoneco: CarriedItem[] = []): Promise<void> {
  const entrada = { id: CENA, name: 'Sky Lagoon', file: 'map.json' }
  const boneco: Token = { id: 't_luffy', characterId: ficha.id, name: 'Luffy', x: 96, y: 96, size: 1, image: null, mochila: mochilaDoBoneco }
  const map: MapData = { ...createEmptyMap('map_sky', 'Sky Lagoon', 20, 16, 64), tokens: [boneco] }
  const adventure: Adventure = {
    version: 1,
    id: 'adv_op',
    name: 'One Piece',
    startSceneId: CENA,
    scenes: [entrada],
    sistemaDeRpg: SISTEMA_ONE_PIECE.id,
    personagens: [ficha],
    ...(migrada ? { mochilaMigrada: 1 } : {}),
  }
  const aberto: OpenedMapFile = {
    path: 'C:/appdata/maps/adv_op/map.json',
    map,
    adventure,
    adventureDir: 'C:/appdata/maps/adv_op',
    activeSceneId: CENA,
    scenes: [{ entry: entrada, status: 'ok', map }],
    changedSceneIds: [],
    adventureChanged: false,
    legacySources: [],
  }
  await useAdventureStore.getState().open(aberto, null)
}

function botao(nome: string): HTMLButtonElement {
  const achado = Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).find((candidato) => candidato.textContent?.trim() === nome)
  if (achado === undefined) throw new Error(`botão "${nome}" não está na tela`)
  return achado
}

function clicar(nome: string): void {
  act(() => botao(nome).click())
}

function abaDosItens(): HTMLButtonElement {
  const aba = Array.from(document.body.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((candidata) => candidata.textContent?.startsWith('Itens'))
  if (aba === undefined) throw new Error('a aba Itens não está na tela')
  return aba
}

/** O número da aba Itens e o do título "Inventário" da grade: os dois que o mestre compara. */
function contas(): { aba: string; grade: string } {
  return {
    aba: abaDosItens().querySelector('.lb-ficha__aba-conta')?.textContent ?? '0',
    grade: document.body.querySelector('.lb-inv__conta')?.textContent ?? 'sem grade',
  }
}

function digitar(input: HTMLInputElement, valor: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  act(() => {
    setter?.call(input, valor)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function itens(mochila: readonly CarriedItem[] | undefined): string[] {
  return (mochila ?? []).map((item) => `${item.nome} x${item.quantidade ?? 1}`)
}

function mochilaDoBoneco(): string[] {
  return itens(useMapStore.getState().map.tokens.find((token) => token.id === 't_luffy')?.mochila)
}

function mochilaDaFicha(): string[] {
  return itens(personagensAtivos(useAdventureStore.getState()).find((personagem) => personagem.id === 'p_luffy')?.mochila)
}

describe('a mochila na ficha do mestre durante a edição', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    useAdventureStore.getState().reset()
    useMapStore.getState().loadMap(createEmptyMap('map_vazio', 'Vazio', 20, 16, 64))
    useSessionStore.getState().markSaved()
    useToastStore.setState({ toasts: [] })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => useRpgStore.getState().fecharFicha())
    act(() => root.unmount())
    container.remove()
  })

  /** Monta as janelas do RPG com o caminho dos itens do app e abre a ficha do Luffy na aba Itens. */
  function abrirAFicha(): void {
    act(() => root.render(<RpgDialogs aplicarItens={applyItemsInScene} garantirAventura={async () => true} />))
    act(() => useRpgStore.getState().abrirFicha('p_luffy'))
    act(() => abaDosItens().click())
  }

  it('antes da migração: a edição mostra a mochila do boneco, o + Adicionar vai a ele e o Salvar não apaga nada', async () => {
    await abrir(luffy(), false, [BALAS])
    abrirAFicha()
    clicar('Editar')
    expect(contas()).toEqual({ aba: '2', grade: '2' })
    expect(document.body.textContent).not.toContain('Salve a ficha para usar')

    clicar('+ Adicionar')
    const busca = document.body.querySelector<HTMLInputElement>('input[type="search"]')
    if (busca === null) throw new Error('sem o campo do + Adicionar')
    digitar(busca, 'Corda')
    clicar('Item novo: Corda')
    expect(mochilaDoBoneco()).toEqual(['Balas de prata x2', 'Corda x1'])
    expect(contas()).toEqual({ aba: '3', grade: '3' })

    clicar('Salvar')
    expect(mochilaDoBoneco()).toEqual(['Balas de prata x2', 'Corda x1'])
    expect(contas()).toEqual({ aba: '3', grade: '3' })
  })

  it('depois da migração: a grade da edição é o rascunho e conta igual à aba, também depois do Passar para a mochila', async () => {
    const corda = { ...novoCartao('Item'), nome: 'Corda' }
    await abrir(luffy({ mochila: [POCAO], abas: { ...luffy().abas, itens: [corda] } }), true, [POCAO])
    abrirAFicha()
    clicar('Editar')
    expect(contas()).toEqual({ aba: '2', grade: '1' })
    expect(document.body.textContent).toContain('Salve a ficha para usar')

    clicar('Passar para a mochila')
    expect(contas()).toEqual({ aba: '2', grade: '2' })
  })

  it('depois da migração: o Salvar guarda o que entrou com a janela aberta e o que o Passar para a mochila pôs', async () => {
    const corda = { ...novoCartao('Item'), nome: 'Corda' }
    await abrir(luffy({ mochila: [POCAO], abas: { ...luffy().abas, itens: [corda] } }), true, [POCAO])
    abrirAFicha()
    clicar('Editar')
    clicar('Passar para a mochila')
    // Com a janela aberta, as Balas chegam ao Luffy por outro caminho (o "Dar a…" do Acervo, o jogador que pega).
    act(() => {
      expect(applyItemsInScene({ mochilas: [{ tokenId: 't_luffy', mochila: [POCAO, BALAS] }] })).toBe(true)
    })
    expect(mochilaDaFicha()).toEqual(['Poção x1', 'Balas de prata x2'])

    clicar('Salvar')
    expect(mochilaDaFicha()).toEqual(['Poção x1', 'Balas de prata x2', 'Corda x1'])
    expect(mochilaDoBoneco()).toEqual(['Poção x1', 'Balas de prata x2', 'Corda x1'])
    expect(contas()).toEqual({ aba: '4', grade: '4' })
  })
})
