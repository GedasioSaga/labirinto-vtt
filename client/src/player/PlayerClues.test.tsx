/**
 * MINHAS PISTAS na tela do jogador: a lista no Caderno (a mais nova em cima,
 * pelo título) e o cartão da pista — foto em cima, texto embaixo, "Mostrar
 * para…" com os colegas da mesma cena. O cartão que um colega mostra diz de
 * quem veio ("Gabi mostrou: Bilhete") e não oferece mostrar de novo.
 */
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClueEntry } from '../net/protocol'
import { PlayerClueCard, PlayerClueList, type ClueShareProps } from './PlayerClues'
import { DEFAULT_PLAYER_SETTINGS, PlayerPanel } from './PlayerPanel'

const FOTO = 'data:image/png;base64,QklMSEVURQ=='
const AS_21_15 = new Date(2026, 8, 23, 21, 15).getTime()
const AS_21_40 = new Date(2026, 8, 23, 21, 40).getTime()
const BILHETE: ClueEntry = { id: 'c1', title: 'Bilhete', text: 'Bilhete\nEncontre-me na torre.', image: FOTO, at: AS_21_15 }
const CHAVE: ClueEntry = { id: 'c2', title: 'Chave torta', text: 'Chave torta', image: null, at: AS_21_40, from: 'Ana' }

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
  vi.unstubAllGlobals()
})

function botao(nome: string | RegExp): HTMLButtonElement {
  const achado = Array.from(container.querySelectorAll('button')).find((b) =>
    typeof nome === 'string' ? b.textContent === nome : nome.test(b.textContent ?? ''),
  )
  if (!achado) throw new Error(`sem o botão ${String(nome)}`)
  return achado
}

function compartilhar(extra: Partial<ClueShareProps> = {}): ClueShareProps {
  return { peers: undefined, result: undefined, onAskPeers: () => {}, onShow: () => {}, ...extra }
}

describe('PlayerClueList', () => {
  it('lista vazia diz o que vai aparecer ali', () => {
    act(() => root.render(<PlayerClueList clues={[]} onOpen={() => {}} />))
    expect(container.textContent).toMatch(/Nenhuma pista ainda/)
    expect(container.querySelector('button')).toBeNull()
  })

  it('a mais nova em cima, pelo título, com a hora e quem mostrou; tocar abre a pista', () => {
    const onOpen = vi.fn()
    act(() => root.render(<PlayerClueList clues={[BILHETE, CHAVE]} onOpen={onOpen} />))
    const itens = Array.from(container.querySelectorAll('li')).map((li) => li.textContent)
    expect(itens).toEqual(['Chave torta21:40 · mostrada por Ana', 'Bilhete21:15'])
    act(() => botao(/^Bilhete/).click())
    expect(onOpen).toHaveBeenCalledWith('c1')
  })
})

describe('PlayerClueCard', () => {
  it('reabre com a foto em cima e o texto embaixo; título é o da pista', () => {
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar()} />))
    const dialogo = container.querySelector('[role="dialog"]')
    expect(dialogo?.getAttribute('aria-labelledby')).not.toBeNull()
    const img = container.querySelector('img')
    expect(img?.getAttribute('src')).toBe(FOTO)
    expect(container.querySelector('h2')?.textContent).toBe('Bilhete')
    expect(container.textContent).toContain('Encontre-me na torre.')
    // Foto antes do texto no DOM: a mesma ordem para quem enxerga e para quem ouve.
    const texto = container.querySelector('.pp-pincard__text')
    expect(img !== null && texto !== null && (img.compareDocumentPosition(texto) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0).toBe(true)
  })

  it('texto com HTML aparece literal', () => {
    act(() => root.render(<PlayerClueCard clue={{ ...BILHETE, text: '<b>x</b>' }} title="Bilhete" onClose={() => {}} />))
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>x</b>')
  })

  it('"Mostrar para…" pede os colegas; com a lista, tocar em Ana mostra para ela', () => {
    const onAskPeers = vi.fn()
    const onShow = vi.fn()
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ onAskPeers, onShow })} />))
    act(() => botao('Mostrar para…').click())
    expect(onAskPeers).toHaveBeenCalledTimes(1)
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ onAskPeers, onShow, peers: { phase: 'loading' } })} />))
    expect(container.textContent).toContain('Procurando quem está nesta cena…')
    act(() =>
      root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ onAskPeers, onShow, peers: { phase: 'ready', names: ['Ana'] } })} />),
    )
    act(() => botao('Ana').click())
    expect(onShow).toHaveBeenCalledWith('Ana')
  })

  it('ninguém na cena: diz isso em vez de uma lista vazia', () => {
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ peers: { phase: 'ready', names: [] } })} />))
    expect(container.textContent).toContain('Ninguém mais está nesta cena agora.')
  })

  it('resultado: "Mostrado para Ana." e, se falhou, diz por quê', () => {
    act(() =>
      root.render(
        <PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ peers: { phase: 'ready', names: ['Ana'] }, result: { to: 'Ana', phase: 'ok' } })} />,
      ),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Mostrado para Ana.')
    act(() =>
      root.render(
        <PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ peers: { phase: 'ready', names: ['Ana'] }, result: { to: 'Ana', phase: 'failed' } })} />,
      ),
    )
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Não deu para mostrar para Ana: não está mais nesta cena.')
  })

  it('o host pediu para esperar: diz "espere" (Bruno continua na cena) e o nome segue tocável', () => {
    act(() =>
      root.render(
        <PlayerClueCard
          clue={BILHETE}
          title="Bilhete"
          onClose={() => {}}
          share={compartilhar({ peers: { phase: 'ready', names: ['Ana', 'Bruno'] }, result: { to: 'Bruno', phase: 'too_soon' } })}
        />,
      ),
    )
    const status = container.querySelector('[role="status"]')?.textContent
    expect(status).toBe('Espere um instante e toque em Bruno de novo.')
    expect(status).not.toContain('não está mais nesta cena')
    expect(botao('Bruno').disabled).toBe(false)
  })

  it('enviando: os nomes ficam desligados até a resposta', () => {
    act(() =>
      root.render(
        <PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} share={compartilhar({ peers: { phase: 'ready', names: ['Ana'] }, result: { to: 'Ana', phase: 'sending' } })} />,
      ),
    )
    expect(botao('Ana').disabled).toBe(true)
  })

  it('cartão que um colega mostrou: título "Gabi mostrou: Bilhete" e sem "Mostrar para…"', () => {
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Gabi mostrou: Bilhete" onClose={() => {}} arrivedUnasked />))
    expect(container.querySelector('h2')?.textContent).toBe('Gabi mostrou: Bilhete')
    expect(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Mostrar para…')).toBe(false)
  })

  it('Escape e "Fechar" fecham', () => {
    const onClose = vi.fn()
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={onClose} />))
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => botao('Fechar').click())
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('aberto do Caderno: o foco entra no cartão e volta a quem abriu ao fechar', () => {
    const abridor = document.createElement('button')
    document.body.appendChild(abridor)
    abridor.focus()
    act(() => root.render(<PlayerClueCard clue={BILHETE} title="Bilhete" onClose={() => {}} />))
    expect(container.contains(document.activeElement)).toBe(true)
    act(() => root.render(<></>))
    expect(document.activeElement).toBe(abridor)
    abridor.remove()
  })
})

describe('PlayerPanel: pistas no Caderno', () => {
  it('aba Caderno mostra "Minhas pistas" e tocar numa pista pede para abri-la', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} }))
    const onOpenClue = vi.fn()
    act(() =>
      root.render(
        <PlayerPanel
          characters={[{ id: 't1', name: 'Gabi' }]}
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
          notebook={[]}
          notebookUnread={false}
          onReadNotebook={() => {}}
          clues={[BILHETE]}
          onOpenClue={onOpenClue}
        />,
      ),
    )
    const caderno = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find((b) => /Caderno/.test(b.textContent ?? ''))
    act(() => caderno?.click())
    const painel = container.querySelector('[role="tabpanel"]:not([hidden])')
    expect(painel?.textContent).toContain('Minhas pistas')
    act(() => botao(/^Bilhete/).click())
    expect(onOpenClue).toHaveBeenCalledWith('c1')
  })
})
