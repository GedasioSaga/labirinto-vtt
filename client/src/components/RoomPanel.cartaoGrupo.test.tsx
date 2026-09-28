import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyDestinations, partyMembers } from '../lib/party'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo, PlayerNoteDelivery, TradeProposeResult } from '../net/hostSession'
import type { Token } from '../types/map'
import { GROUP_VIEW_LABEL, RoomPanel, roomPanelTokensOf, type GiftScene } from './RoomPanel'

/*
 * CARTÃO DO JOGADOR NO GRUPO (pedido 13, "melhora esse design"): o mestre bate
 * o olho e acha a ação. Bar: o menu de membro do Discord. O que se usa a cada
 * cena fica à vista; o resto mora no "…", em seções com título e divisória, e
 * o que derruba alguém vem por último, separado do resto.
 */

const SALAO = 'Salão'

function ficha(id: string, name: string, color: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 100, y: 100, size: 1, image: null, color, ...extra }
}

/** Bruno joga no Salão com o Machado, que leva uma corda e 5 moedas; a Cripta é para onde mandar. */
function mundo(): HostWorld {
  const salao = { ...createEmptyMap('m-salao', 'Casa', 20, 12, 50), tokens: [ficha('machado', 'Machado', '#ff5a00', { mochila: [{ id: 'corda', nome: 'Corda' }], moedas: 5 })] }
  return { open: { sceneId: 's-salao', name: SALAO, map: salao }, background: [{ sceneId: 's-cripta', name: 'Cripta', map: createEmptyMap('m-cripta', 'Casa', 20, 12, 50) }] }
}

const BRUNO: PlayerInfo = { clientId: 'c-bruno', playerId: 'p-bruno', name: 'Bruno', status: 'playing', connected: true, tokenIds: ['machado'], visionRadius: 700, visionFactor: 1, sceneId: 's-salao', sceneName: SALAO }
const IDLE: TunnelState = { kind: 'idle' }
/** Uma Sala na Cripta: o bastante para "Dar um mapa a Bruno" aparecer no "…". */
const CENAS_DE_PAPEL: GiftScene[] = [{ sceneId: 's-cripta', name: 'Cripta', rooms: [{ id: 'r-porao', name: 'Porão' }] }]

describe('cartão do jogador no Grupo: ações agrupadas por intenção', () => {
  let container: HTMLDivElement
  let root: Root
  const spies = {
    onItem: vi.fn(() => true),
    onGiveGroupView: vi.fn(() => 2),
    onUnassign: vi.fn(),
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    for (const spy of Object.values(spies)) spy.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function render(): void {
    const world = mundo()
    const noop = (): void => {}
    const onNote = (): PlayerNoteDelivery => 'sent'
    const onTrade = (): TradeProposeResult => 'sent'
    act(() =>
      root.render(
        <RoomPanel
          room={{ code: 'CARTAO', urls: [], qrSvg: '<svg/>' }}
          players={[BRUNO]}
          tokens={roomPanelTokensOf(world)}
          party={{
            members: partyMembers([BRUNO], world),
            destinations: partyDestinations(world),
            onGoTo: noop,
            onSend: () => true,
            followingId: null,
            onToggleFollow: noop,
            mirroringId: null,
            onToggleMirror: noop,
            onItem: spies.onItem,
            onNote,
            onTrade,
          }}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={noop}
          onUnassign={spies.onUnassign}
          onLend={noop}
          onKick={noop}
          onVisionRadiusChange={noop}
          onVisionFactorChange={noop}
          onRevealPlan={noop}
          onHidePlan={noop}
          onGiveGroupView={spies.onGiveGroupView}
          giftScenes={CENAS_DE_PAPEL}
          onGiveMap={(_p, _s, salas) => salas.length}
          onToggleLaser={noop}
          clues={{ rows: [], onCenter: noop, onToggle: noop }}
        />,
      ),
    )
  }

  /** O cartão do jogador: `.lb-field` com "<nome> —" (o mesmo gancho das jornadas e2e). */
  function linha(nome: string): HTMLLIElement {
    const achados = Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).filter((el) => (el.textContent ?? '').includes(`${nome} —`))
    if (achados.length !== 1) throw new Error(`${achados.length} cartões de ${nome}`)
    const li = achados[0].closest('li')
    if (!li) throw new Error(`o cartão de ${nome} não é linha do Grupo`)
    return li
  }

  /** Nome acessível: `aria-label`, ou o texto sem o que é `aria-hidden`. */
  function nomeAcessivel(el: Element): string {
    const rotulo = el.getAttribute('aria-label')
    if (rotulo !== null) return rotulo
    const copia = el.cloneNode(true)
    if (!(copia instanceof Element)) return ''
    copia.querySelectorAll('[aria-hidden="true"]').forEach((e) => e.remove())
    return (copia.textContent ?? '').replace(/\s+/g, ' ').trim()
  }

  function botoes(escopo: Element): string[] {
    return Array.from(escopo.querySelectorAll('button')).map(nomeAcessivel)
  }

  function botao(escopo: Element, nome: string): HTMLButtonElement {
    const achado = Array.from(escopo.querySelectorAll('button')).find((b) => nomeAcessivel(b) === nome)
    if (!achado) throw new Error(`sem o botão "${nome}"; há ${JSON.stringify(botoes(escopo))}`)
    return achado
  }

  function campo(escopo: Element, rotulo: string): HTMLInputElement {
    const label = Array.from(escopo.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)
    const alvo = label ? document.getElementById(label.htmlFor) : null
    if (!(alvo instanceof HTMLInputElement) || !escopo.contains(alvo)) throw new Error(`sem o campo "${rotulo}"`)
    return alvo
  }

  function painelDe(mais: HTMLButtonElement): HTMLElement {
    const painel = document.getElementById(mais.getAttribute('aria-controls') ?? '')
    if (!painel) throw new Error(`"${nomeAcessivel(mais)}" não abriu painel nenhum`)
    return painel
  }

  function clicar(el: HTMLElement): void {
    act(() => el.click())
  }

  function digitar(alvo: HTMLInputElement, texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(alvo, texto)
      alvo.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function esc(alvo: Element | null): void {
    if (alvo === null) throw new Error('nada em foco para receber o Esc')
    act(() => {
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
  }

  /** O foco volta ao botão que abriu num requestAnimationFrame. */
  async function proximoQuadro(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
    })
  }

  it('à vista, só o que se usa a cada cena: a ficha, acompanhar, mandar, recado e o "…"', () => {
    render()
    expect(botoes(linha('Bruno'))).toEqual(['Remover Machado', 'Ir lá', 'Seguir', 'Ver tela de Bruno', 'Mandar para…', 'Recado para Bruno', 'Mais de Bruno'])
  })

  it('"Remover" sai da linha do nome e das ações: é o × discreto no chip da ficha', () => {
    render()
    const li = linha('Bruno')
    const remover = botao(li, 'Remover Machado')
    const chip = remover.closest('.lb-chip')
    expect(chip?.textContent).toContain('Machado')
    expect(li.querySelector('.lb-player__line')?.contains(remover)).toBe(false)
    expect(remover.closest('.lb-player__line--acoes')).toBeNull()
    // O × não diz nada sozinho: a dica do mouse e o texto para leitor de tela dizem.
    expect(remover.title).toBe('Remover Machado')
    expect(remover.textContent?.trim()).toBe('Remover Machado')
    clicar(remover)
    expect(spies.onUnassign).toHaveBeenCalledWith('p-bruno', 'machado')
  })

  it('bolsa e mochila numa linha só de leitura, sem botão no meio', () => {
    render()
    const estado = linha('Bruno').querySelector('.lb-player__estado')
    expect(estado?.textContent).toBe('Bolsa: 5 moedas · Mochila: 1 — Corda')
    expect(estado?.querySelector('button')).toBeNull()
  })

  it('Ir lá, Seguir e Ver tela ficam juntos, num grupo com nome', () => {
    render()
    const acompanhar = linha('Bruno').querySelector('[role="group"][aria-label="Acompanhar Bruno"]')
    if (acompanhar === null) throw new Error('sem o grupo "Acompanhar Bruno"')
    expect(botoes(acompanhar)).toEqual(['Ir lá', 'Seguir', 'Ver tela de Bruno'])
  })

  it('o "…" traz o resto em seções com título, e Expulsar por último, fora delas', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    clicar(mais)
    const painel = painelDe(mais)
    const secoes = Array.from(painel.querySelectorAll('.lb-player__secao'))
    const titulos = secoes.map((secao) => document.getElementById(secao.getAttribute('aria-labelledby') ?? '')?.textContent)
    expect(titulos).toEqual(['Mochila e bolsa', 'Visão e mapa', 'Ficha'])
    for (const secao of secoes) expect(secao.getAttribute('role')).toBe('group')
    const nomes = botoes(painel)
    for (const nome of ['Dar item a Bruno', 'Moedas de Bruno', 'Propor troca a Bruno', 'Tirar Corda de Bruno', 'Devolver ao chão Corda de Bruno', GROUP_VIEW_LABEL, 'Emprestar como ajudante…']) {
      expect(nomes).toContain(nome)
    }
    expect(nomes[nomes.length - 1]).toBe('Expulsar')
    const expulsar = botao(painel, 'Expulsar')
    expect(expulsar.closest('.lb-player__secao')).toBeNull()
    expect(expulsar.closest('.lb-player__perigo')).not.toBeNull()
  })

  it('no "…", o que abre formulário tem cara de botão: compacto e sólido, nunca texto solto', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    clicar(mais)
    const painel = painelDe(mais)
    for (const nome of [GROUP_VIEW_LABEL, 'Dar um mapa a Bruno', 'Emprestar como ajudante…']) {
      const acao = botao(painel, nome)
      expect(`${nome}: ${acao.className}`).toContain('lb-btn--compact')
      expect(`${nome}: ${acao.className}`).not.toContain('lb-btn--ghost')
    }
  })

  it('as ações do "…" agem: Dar item entrega; "Dar o que o grupo viu" avisa ali mesmo', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    clicar(mais)
    clicar(botao(painelDe(mais), 'Dar item a Bruno'))
    const item = campo(painelDe(mais), 'Item para Bruno')
    expect(document.activeElement).toBe(item)
    digitar(item, 'Tocha')
    clicar(botao(painelDe(mais), 'Dar'))
    expect(spies.onItem).toHaveBeenLastCalledWith({ kind: 'dar', nome: 'Tocha', member: expect.objectContaining({ playerId: 'p-bruno' }) })
    clicar(botao(painelDe(mais), GROUP_VIEW_LABEL))
    expect(spies.onGiveGroupView).toHaveBeenCalledWith('p-bruno')
    expect(painelDe(mais).querySelector('[role="status"]')?.textContent).toBe('Bruno recebeu o que 2 colegas viram')
  })

  it('Esc em dois tempos: fecha o formulário e volta ao botão; de novo, fecha o "…" e volta a ele', async () => {
    render()
    const chegouNoCanvas = vi.fn()
    window.addEventListener('keydown', chegouNoCanvas)
    try {
      const mais = botao(linha('Bruno'), 'Mais de Bruno')
      clicar(mais)
      const painel = painelDe(mais)
      clicar(botao(painel, 'Dar item a Bruno'))
      esc(campo(painel, 'Item para Bruno'))
      expect(painel.querySelector('form[aria-label="Item novo para Bruno"]')).toBeNull()
      expect(painel.isConnected).toBe(true)
      await proximoQuadro()
      expect(document.activeElement).toBe(botao(painel, 'Dar item a Bruno'))
      esc(document.activeElement)
      expect(painel.isConnected).toBe(false)
      expect(mais.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(mais)
      expect(chegouNoCanvas).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', chegouNoCanvas)
    }
  })

  it('fechar o "…" fecha o formulário junto; reabrir começa limpo', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    clicar(mais)
    clicar(botao(painelDe(mais), 'Moedas de Bruno'))
    expect(painelDe(mais).querySelector('form[aria-label="Moedas de Bruno"]')).not.toBeNull()
    clicar(mais)
    expect(container.querySelector('form[aria-label="Moedas de Bruno"]')).toBeNull()
    clicar(mais)
    expect(painelDe(mais).querySelector('form')).toBeNull()
    expect(botao(painelDe(mais), 'Moedas de Bruno').getAttribute('aria-expanded')).toBe('false')
  })

  it('aberto pelo teclado, o "…" aparece sem animação; pelo mouse, anima', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    // Enter e Espaço num botão disparam um clique sem contagem de cliques (detail 0), como el.click().
    clicar(mais)
    expect(painelDe(mais).hasAttribute('data-instant')).toBe(true)
    clicar(mais)
    act(() => {
      mais.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(painelDe(mais).hasAttribute('data-instant')).toBe(false)
  })
})
