/**
 * ABA JOGO do painel do jogador depois das melhorias de 08/10/2026: saíram o
 * "Centralizar no meu personagem" ("Minha ficha", na barra, já centra), o
 * "Bilhete" (Escrever bilhete) e o "Encontro" (Esperar aqui); "Marcar
 * destino", "Anotar" e "Deixar marca aqui…" viraram um botão "Marcações".
 * Medir, Laser, "Mostrar meu mapa a…" e "Volto já" ficam como estavam.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

describe('PlayerPanel: aba Jogo enxuta', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
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
          onToggleDestination={() => {}}
          onClearDestination={() => {}}
          onToggleNote={() => {}}
          onRenameToken={() => {}}
          onChangeTokenPhoto={async () => {}}
          mapShare={{ peers: undefined, result: undefined, onAskPeers: () => {}, onShare: () => {}, onClose: () => {} }}
          markForm={{ result: undefined, onPlace: () => {}, onClose: () => {} }}
          onStepAway={() => {}}
        />,
      ),
    )
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function abaJogo(): HTMLElement {
    const achada = container.querySelector<HTMLElement>('[role="tabpanel"]:not([hidden])')
    if (!achada) throw new Error('sem a aba à vista')
    return achada
  }

  function botoes(): string[] {
    return Array.from(abaJogo().querySelectorAll('button')).map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim())
  }

  it('sem Centralizar no meu personagem, Bilhete nem Encontro', () => {
    const texto = abaJogo().textContent ?? ''
    for (const saiu of ['Centralizar no meu personagem', 'Bilhete', 'Escrever bilhete', 'Encontro', 'Esperar aqui', 'Por quem']) expect(texto).not.toContain(saiu)
    const titulos = Array.from(abaJogo().querySelectorAll('h2')).map((h) => h.textContent)
    expect(titulos).not.toContain('Bilhete')
    expect(titulos).not.toContain('Encontro')
    expect(titulos).toContain('Meus personagens')
  })

  it('"Marcações" no lugar dos três; Medir, Laser, Mostrar meu mapa a… e Volto já seguem soltos, na ordem', () => {
    const lista = botoes()
    for (const dentroDoMenu of ['Marcar destino', 'Anotar', 'Deixar marca aqui…']) expect(lista).not.toContain(dentroDoMenu)
    const ordem = ['Sinalizar', 'Marcações', 'Medir', 'Laser', 'Mostrar meu mapa a…', 'Volto já'].map((nome) => lista.indexOf(nome))
    expect(ordem.every((posicao) => posicao >= 0)).toBe(true)
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem)
  })
})
