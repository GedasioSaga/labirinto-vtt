/**
 * CADERNO do jogador, depois das melhorias de 08/10/2026: "Recados" saiu,
 * "Minhas pistas" foi para a aba Lugares (por lugar) e "Minhas notas" ficou
 * fixa ao jogador — as de TODOS os mapas, não só as da cena na tela.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { createExploration } from '../lib/exploration'
import type { ClueEntry } from '../net/protocol'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'
import type { PersonalNote } from './personalNotes'
import { rememberPlace, type VisitedPlace } from './playerPlaces'

const AS_20_30 = new Date(2026, 8, 22, 20, 30).getTime()

const NOTA_AQUI: PersonalNote = { id: 'n1', mapId: 'm-taverna', x: 100, y: 100, text: 'baú trancado' }
const NOTA_PORAO: PersonalNote = { id: 'n2', mapId: 'm-porao', x: 50, y: 60, text: 'rato morto' }
const NOTA_SEM_LUGAR: PersonalNote = { id: 'n3', mapId: 'm-nunca-visto', x: 10, y: 10, text: 'velha anotação' }

/** Dois lugares visitados: a taverna (l1, onde ele está) e o porão (l2). */
function lugares(): VisitedPlace[] {
  const exp = createExploration({ width: 500, height: 500, grid: 50 })
  return ['l1', 'l2'].reduce<VisitedPlace[]>((lista, id) => rememberPlace(lista, id, createEmptyMap(`m-${id}`, '', 10, 10, 50), exp, [], undefined), [])
}

function pista(id: string, title: string, place?: string): ClueEntry {
  return place === undefined ? { id, title, text: '', image: null, at: AS_20_30 } : { id, title, text: '', image: null, at: AS_20_30, place }
}

describe('PlayerPanel: aba Caderno', () => {
  let container: HTMLDivElement
  let root: Root
  let onFocusNote: ReturnType<typeof vi.fn<(noteId: string) => void>>
  let onRemoveNote: ReturnType<typeof vi.fn<(noteId: string) => void>>
  let onOpenClue: ReturnType<typeof vi.fn<(clueId: string) => void>>

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    onFocusNote = vi.fn<(noteId: string) => void>()
    onRemoveNote = vi.fn<(noteId: string) => void>()
    onOpenClue = vi.fn<(clueId: string) => void>()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  interface Extra {
    personalNotes?: readonly PersonalNote[]
    clues?: readonly ClueEntry[]
  }

  function render(extra: Extra = {}): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Fábio' }]}
          characterColor="#fff"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => {}}
          onFocusToken={() => {}}
          signalArmed={false}
          onToggleSignal={() => {}}
          measureArmed={false}
          onToggleMeasure={() => {}}
          laserArmed={false}
          onToggleLaser={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          personalNotes={extra.personalNotes ?? []}
          currentMapId="m-taverna"
          placeOfMap={{ 'm-taverna': 'l1', 'm-porao': 'l2' }}
          places={lugares()}
          currentPlace="l1"
          placeNames={{ l2: 'Porão' }}
          onFocusNote={onFocusNote}
          onRemoveNote={onRemoveNote}
          clues={extra.clues ?? []}
          onOpenClue={onOpenClue}
          onDownloadNotebook={() => 'caderno.html'}
        />,
      ),
    )
  }

  function aba(nome: RegExp): HTMLButtonElement {
    const achada = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => nome.test(b.textContent ?? ''))
    if (!achada) throw new Error(`aba ${nome} não existe`)
    return achada
  }

  function painelAberto(): HTMLElement {
    const achado = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')
    if (!achado) throw new Error('nenhuma aba à vista')
    return achado
  }

  function tecla(alvo: HTMLElement, key: string): void {
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
    })
  }

  it('o Caderno não tem mais Recados nem Minhas pistas: só Minhas notas e Levar para casa', () => {
    render({ personalNotes: [NOTA_AQUI], clues: [pista('c1', 'Carta rasgada', 'l1')] })
    act(() => aba(/Caderno/).click())
    const titulos = Array.from(painelAberto().querySelectorAll('h2')).map((h) => h.textContent)
    expect(titulos).toEqual(['Minhas notas', 'Levar para casa'])
    expect(painelAberto().textContent).not.toContain('Recados')
    expect(painelAberto().textContent).not.toContain('Carta rasgada')
    expect(painelAberto().textContent).toContain('suas pistas e suas notas')
  })

  it('Minhas notas de TODOS os mapas: as deste lugar primeiro (tocar centra), as do outro mapa com o nome que ele deu ao lugar', () => {
    render({ personalNotes: [NOTA_PORAO, NOTA_AQUI] })
    act(() => aba(/Caderno/).click())
    const grupos = Array.from(painelAberto().querySelectorAll('.pp-personal-notes__group'))
    expect(grupos.map((g) => g.querySelector('h3')?.textContent)).toEqual(['Neste lugar', 'Porão'])
    expect(grupos[0]?.textContent).toContain('baú trancado')
    expect(grupos[1]?.textContent).toContain('rato morto')
    const centrar = painelAberto().querySelector<HTMLButtonElement>('button[aria-label="Centralizar em baú trancado"]')
    act(() => centrar?.click())
    expect(onFocusNote).toHaveBeenCalledWith('n1')
    // A do porão é de outra cena: a câmera não vai até ela, então não é botão.
    expect(painelAberto().querySelector('button[aria-label="Centralizar em rato morto"]')).toBeNull()
  })

  it('nota de mapa que esta tela não viu fica em "Outro lugar", e Apagar vale para ela também', () => {
    render({ personalNotes: [NOTA_SEM_LUGAR] })
    act(() => aba(/Caderno/).click())
    expect(painelAberto().querySelector('.pp-personal-notes__group h3')?.textContent).toBe('Outro lugar')
    act(() => painelAberto().querySelector<HTMLButtonElement>('button[aria-label="Apagar nota velha anotação"]')?.click())
    expect(onRemoveNote).toHaveBeenCalledWith('n3')
  })

  it('sem nota nenhuma, o Caderno diz como anotar pelas Marcações', () => {
    render()
    act(() => aba(/Caderno/).click())
    expect(painelAberto().textContent).toMatch(/Em Marcações, toque em Anotar/)
  })

  it('Minhas pistas foram para a aba Lugares, por lugar: onde ele está primeiro, depois os outros, depois "Outros lugares"', () => {
    render({ clues: [pista('c1', 'Mapa do porão', 'l2'), pista('c2', 'Carta rasgada', 'l1'), pista('c3', 'Bilhete antigo')] })
    act(() => aba(/Lugares/).click())
    const blocos = Array.from(painelAberto().querySelectorAll('.pp-place-clues'))
    expect(blocos.map((b) => b.querySelector('h3')?.textContent)).toEqual(['Lugar 1 · você está aqui', 'Porão', 'Outros lugares'])
    expect(blocos[0]?.textContent).toContain('Carta rasgada')
    expect(blocos[1]?.textContent).toContain('Mapa do porão')
    expect(blocos[2]?.textContent).toContain('Bilhete antigo')
    act(() => blocos[1]?.querySelector<HTMLButtonElement>('button')?.click())
    expect(onOpenClue).toHaveBeenCalledWith('c1')
  })

  it('sem pista nenhuma, a aba Lugares diz o que vai aparecer ali', () => {
    render()
    act(() => aba(/Lugares/).click())
    expect(painelAberto().textContent).toMatch(/Nenhuma pista ainda/)
  })

  it('o botão Painel não acende mais por recado: sem menção no chat, nenhum ponto', () => {
    render({ personalNotes: [NOTA_AQUI] })
    expect(container.querySelector('.pp-unread')).toBeNull()
  })

  it('a aba de jogo é a padrão: o painel abre como sempre abriu', () => {
    render({ personalNotes: [NOTA_AQUI] })
    expect(aba(/Jogo/).getAttribute('aria-selected')).toBe('true')
    expect(container.textContent).toContain('Meus personagens')
    expect(container.textContent).not.toContain('baú trancado')
  })

  it('setas trocam de aba e só a aba ativa entra no Tab', () => {
    render()
    const jogo = aba(/Jogo/)
    act(() => jogo.focus())
    tecla(jogo, 'ArrowRight')
    expect(aba(/Caderno/).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(aba(/Caderno/))
    expect(aba(/Jogo/).tabIndex).toBe(-1)
    expect(aba(/Caderno/).tabIndex).toBe(0)
    tecla(aba(/Caderno/), 'Home')
    expect(aba(/Jogo/).getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(aba(/Jogo/))
  })
})
