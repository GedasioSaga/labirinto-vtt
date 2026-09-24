import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { PartyMember } from '../net/protocol'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

/**
 * Seção "Grupo" do painel do jogador (G13): uma região com esse nome
 * acessível, um item de lista por companheiro com o nome e o estado escrito
 * ("aqui", "em outro lugar" ou "fora"). Sem jsdom de acessibilidade completa,
 * o nome da região é conferido pelo `aria-labelledby` -> texto do título.
 */
describe('PlayerPanel: seção Grupo', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(party: PartyMember[] | undefined): void {
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 'lanterna', name: 'Lanterna' }]}
          characterColor="#3cff00"
          settings={DEFAULT_PLAYER_SETTINGS}
          onSettingsChange={() => undefined}
          onFocusToken={() => undefined}
          signalArmed={false}
          onToggleSignal={() => undefined}
          measureArmed={false}
          onToggleMeasure={() => undefined}
          laserArmed={false}
          onToggleLaser={() => undefined}
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => undefined}
          onRenameToken={() => undefined}
          onChangeTokenPhoto={async () => undefined}
          party={party}
        />,
      ),
    )
  }

  /** A região "Grupo": `section` cujo `aria-labelledby` aponta para um título com o texto exato "Grupo". */
  function regiaoGrupo(): HTMLElement | null {
    for (const section of container.querySelectorAll<HTMLElement>('section[aria-labelledby]')) {
      const tituloId = section.getAttribute('aria-labelledby') ?? ''
      if (document.getElementById(tituloId)?.textContent?.trim() === 'Grupo') return section
    }
    return null
  }

  function linhas(): string[] {
    const regiao = regiaoGrupo()
    if (regiao === null) return []
    return Array.from(regiao.querySelectorAll('li')).map((li) => (li.textContent ?? '').replace(/\s+/g, ' ').trim())
  }

  it('mostra cada companheiro com o estado escrito: aqui, em outro lugar, fora', () => {
    render([
      { playerId: 'p2', name: 'Bruno', where: 'aqui' },
      { playerId: 'p3', name: 'Carla', where: 'longe' },
      { playerId: 'p4', name: 'Davi', where: 'fora' },
    ])
    expect(regiaoGrupo()).not.toBeNull()
    expect(linhas()).toEqual(['Bruno aqui', 'Carla em outro lugar', 'Davi fora'])
  })

  it('a região "Grupo" tem uma lista de verdade (ul > li) para leitor de tela contar os companheiros', () => {
    render([{ playerId: 'p2', name: 'Bruno', where: 'aqui' }])
    const regiao = regiaoGrupo()
    expect(regiao?.querySelector('ul > li')).not.toBeNull()
  })

  it('a lista atualiza quando alguém muda de estado', () => {
    render([{ playerId: 'p2', name: 'Bruno', where: 'aqui' }])
    render([{ playerId: 'p2', name: 'Bruno', where: 'longe' }])
    expect(linhas()).toEqual(['Bruno em outro lugar'])
  })

  it('sozinho na mesa: a região aparece, sem itens, dizendo que só ele está lá', () => {
    render([])
    expect(regiaoGrupo()?.textContent).toContain('Só você na mesa.')
    expect(linhas()).toEqual([])
  })

  it('antes do primeiro party.update (ou com mestre antigo) a seção não aparece', () => {
    render(undefined)
    expect(regiaoGrupo()).toBeNull()
  })

  it('nome de companheiro com marcação vira texto, nunca HTML', () => {
    render([{ playerId: 'p2', name: '<img src=x onerror=alert(1)>', where: 'aqui' }])
    expect(regiaoGrupo()?.querySelector('img')).toBeNull()
    expect(linhas()).toEqual(['<img src=x onerror=alert(1)> aqui'])
  })
})
