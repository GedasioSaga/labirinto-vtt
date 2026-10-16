import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { partyDestinations, partyMembers } from '../lib/party'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo, PlayerNoteDelivery, TradeProposeResult } from '../net/hostSession'
import type { Token } from '../types/map'
import { abrirFicha, botaoDaLinha, escolherAba, fichaDoJogador, linhaDoJogador } from './grupoTeste'
import { GROUP_VIEW_LABEL, groupCountLabel, RoomPanel, roomPanelTokensOf, type GiftScene } from './RoomPanel'

/*
 * CARTÃO DO JOGADOR NO GRUPO (pedido 13, "melhora esse design"; Grupo compacto,
 * 07/10/2026): o mestre bate o olho e acha a ação. Fechada, a linha é um botão
 * só; aberta, a ficha traz as ações de toda cena no topo e o resto em abas
 * (Mochila · Visão · Ficha), com o que derruba alguém por último, separado.
 */

const SALAO = 'Salão'

function ficha(id: string, name: string, color: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 100, y: 100, size: 1, image: null, color, ...extra }
}

/**
 * Bruno joga no Salão com o Machado, que leva uma corda e 5 moedas; a Cripta é
 * para onde mandar. `extra` põe mais fichas no Salão.
 */
function mundo(extra: Token[] = []): HostWorld {
  const salao = { ...createEmptyMap('m-salao', 'Casa', 20, 12, 50), tokens: [ficha('machado', 'Machado', '#ff5a00', { mochila: [{ id: 'corda', nome: 'Corda' }], moedas: 5 }), ...extra] }
  return { open: { sceneId: 's-salao', name: SALAO, map: salao }, background: [{ sceneId: 's-cripta', name: 'Cripta', map: createEmptyMap('m-cripta', 'Casa', 20, 12, 50) }] }
}

const BRUNO: PlayerInfo = { clientId: 'c-bruno', playerId: 'p-bruno', name: 'Bruno', status: 'playing', connected: true, tokenIds: ['machado'], visionRadius: 700, visionFactor: 1, sceneId: 's-salao', sceneName: SALAO }
/** Saga joga no Salão com o Vagner, que não leva nada: nem moeda, nem item. */
const SAGA: PlayerInfo = { ...BRUNO, clientId: 'c-saga', playerId: 'p-saga', name: 'Saga', tokenIds: ['vagner'] }
const VAGNER = ficha('vagner', 'Vagner', '#3cff00')
/** Carla joga no Salão com o Cajado: 3 moedas na bolsa e a mochila vazia. */
const CARLA: PlayerInfo = { ...BRUNO, clientId: 'c-carla', playerId: 'p-carla', name: 'Carla', tokenIds: ['cajado'] }
const CAJADO = ficha('cajado', 'Cajado', '#2a4dff', { moedas: 3 })
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

  function render(jogadores: PlayerInfo[] = [BRUNO], extra: Token[] = []): void {
    const world = mundo(extra)
    const noop = (): void => {}
    const onNote = (): PlayerNoteDelivery => 'sent'
    const onTrade = (): TradeProposeResult => 'sent'
    act(() =>
      root.render(
        <RoomPanel
          room={{ code: 'CARTAO', urls: [], qrSvg: '<svg/>' }}
          players={jogadores}
          tokens={roomPanelTokensOf(world)}
          party={{
            members: partyMembers(jogadores, world),
            destinations: partyDestinations(world),
            onGoTo: noop,
            onSend: () => true,
            followingId: null,
            onToggleFollow: noop,
            onViewScreen: noop,
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
    return linhaDoJogador(container, nome)
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

  /** O painel da aba escolhida na ficha. */
  function painelDaAba(ficha: HTMLElement): HTMLElement {
    // A parte escolhida no seg da ficha (fatia 5).
    const painel = ficha.querySelector<HTMLElement>('.gr-jogador__parte')
    if (!painel) throw new Error('a ficha não tem a parte escolhida')
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

  it('fechada, a linha é um botão só com Ir lá e Recado ao lado; aberta, o seg Ações · Mochila · Visão · Ficha', () => {
    render()
    const rapidas = linha('Bruno').querySelector('.gr-jogador__rapidas')
    if (rapidas === null) throw new Error('sem as ações rápidas da linha')
    expect(botoes(rapidas)).toEqual(['Ir lá: Bruno', 'Recado para Bruno'])
    expect(botoes(linha('Bruno'))).toHaveLength(3)
    const ficha = abrirFicha(container, 'Bruno', 'acoes')
    const partes = Array.from(ficha.querySelectorAll('[role="radiogroup"] [role="radio"]')).map((parte) => parte.textContent)
    expect(partes).toEqual(['Ações', 'Mochila', 'Visão', 'Ficha'])
    // As ações de toda cena, na parte Ações, na ordem do protótipo: mover, ver.
    const nomes = botoes(painelDaAba(ficha))
    expect(nomes.slice(0, 3)).toEqual(['Seguir', 'Mandar para…', 'Ver tela de Bruno'])
  })

  it('"Remover" é o × discreto no chip da ficha, longe da linha e das ações', () => {
    render()
    const li = linha('Bruno')
    const ficha = abrirFicha(container, 'Bruno', 'ficha')
    const remover = botao(ficha, 'Remover Machado')
    const chip = remover.closest('.lb-chip')
    expect(chip?.textContent).toContain('Machado')
    expect(li.querySelector('.lb-grupo__linha')?.contains(remover)).toBe(false)
    expect(remover.closest('.lb-grupo__acoes')).toBeNull()
    expect(remover.closest('.lb-player__line--acoes')).toBeNull()
    // O × não diz nada sozinho: a dica do mouse e o texto para leitor de tela dizem.
    expect(remover.title).toBe('Remover Machado')
    expect(remover.textContent?.trim()).toBe('Remover Machado')
    clicar(remover)
    expect(spies.onUnassign).toHaveBeenCalledWith('p-bruno', 'machado')
  })

  it('bolsa e mochila numa linha só de leitura, sem botão no meio, no alto da aba Mochila', () => {
    render()
    const estado = abrirFicha(container, 'Bruno', 'mochila').querySelector('.lb-player__estado')
    expect(estado?.textContent).toBe('Bolsa: 5 moedas · Mochila: 1 — Corda')
    expect(estado?.querySelector('button')).toBeNull()
  })

  it('bolsa e mochila vazias também se dizem, um tom abaixo: sem a linha, o mestre não sabe se está vazia ou se sumiu', () => {
    render([BRUNO, SAGA, CARLA], [VAGNER, CAJADO])
    const vazios = (estado: Element | null): string[] => Array.from(estado?.querySelectorAll('.lb-player__vazio') ?? []).map((el) => el.textContent ?? '')

    const daSaga = abrirFicha(container, 'Saga', 'mochila').querySelector('.lb-player__estado')
    expect(daSaga?.textContent).toBe('Bolsa vazia · Mochila vazia')
    expect(vazios(daSaga)).toEqual(['Bolsa vazia', 'Mochila vazia'])

    // Metade cheia, metade vazia: só a vazia desce de tom.
    const daCarla = abrirFicha(container, 'Carla', 'mochila').querySelector('.lb-player__estado')
    expect(daCarla?.textContent).toBe('Bolsa: 3 moedas · Mochila vazia')
    expect(vazios(daCarla)).toEqual(['Mochila vazia'])

    const doBruno = abrirFicha(container, 'Bruno', 'mochila').querySelector('.lb-player__estado')
    expect(doBruno?.textContent).toBe('Bolsa: 5 moedas · Mochila: 1 — Corda')
    expect(vazios(doBruno)).toEqual([])
  })

  it('Seguir e Mandar para… ficam juntos em "Mover"; Ver tela e o que se dá de mapa, em "Ver"', () => {
    render()
    const ficha = abrirFicha(container, 'Bruno', 'acoes')
    const bloco = (titulo: string) => Array.from(ficha.querySelectorAll('.gr-jogador__bloco')).find((b) => b.querySelector('.gr-jogador__h')?.textContent === titulo)
    const mover = bloco('Mover')
    if (mover === undefined) throw new Error('sem o bloco "Mover"')
    expect(botoes(mover)).toEqual(['Seguir', 'Mandar para…'])
    const ver = bloco('Ver')
    if (ver === undefined) throw new Error('sem o bloco "Ver"')
    expect(botoes(ver)).toContain('Ver tela de Bruno')
    expect(botoes(ver)).toContain(GROUP_VIEW_LABEL)
  })

  it('a ficha traz o resto em partes com nome, e Expulsar por último em Ações, no bloco "Sair da mesa"', () => {
    render()
    const ficha = abrirFicha(container, 'Bruno')
    expect(ficha.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Parte da ficha de Bruno')

    escolherAba(ficha, 'mochila')
    const mochila = painelDaAba(ficha)
    expect(mochila.getAttribute('data-parte')).toBe('mochila')
    for (const nome of ['Dar item a Bruno', 'Moedas de Bruno', 'Propor troca a Bruno', 'Tirar Corda de Bruno', 'Devolver ao chão Corda de Bruno']) {
      expect(botoes(mochila)).toContain(nome)
    }

    escolherAba(ficha, 'acoes')
    const nomes = botoes(painelDaAba(ficha))
    expect(nomes).toContain(GROUP_VIEW_LABEL)
    expect(nomes).toContain('Emprestar como ajudante…')
    expect(nomes[nomes.length - 1]).toBe('Expulsar')
    const expulsar = botao(painelDaAba(ficha), 'Expulsar')
    expect(expulsar.closest('.gr-jogador__bloco')?.querySelector('.gr-jogador__h')?.textContent).toBe('Sair da mesa')
  })

  it('nas partes, o que abre formulário tem cara de botão: compacto e sólido, nunca texto solto', () => {
    render()
    const ficha = abrirFicha(container, 'Bruno', 'acoes')
    // O botão do Grimório (gr-bt pequeno) e os de antes (lb-btn compacto), nunca o fantasma.
    const solido = (nome: string) => {
      const classe = botao(ficha, nome).className
      expect(`${nome}: ${classe}`).toMatch(/gr-bt--p|lb-btn--compact/)
      expect(`${nome}: ${classe}`).not.toMatch(/lb-btn--ghost|gr-bt--fantasma/)
    }
    for (const nome of [GROUP_VIEW_LABEL, 'Dar um mapa a Bruno', 'Emprestar como ajudante…']) solido(nome)
  })

  it('as ações das abas agem: Dar item entrega; "Dar o que o grupo viu" avisa ali mesmo', () => {
    render()
    const ficha = abrirFicha(container, 'Bruno', 'mochila')
    clicar(botao(ficha, 'Dar item a Bruno'))
    const item = campo(ficha, 'Item para Bruno')
    expect(document.activeElement).toBe(item)
    digitar(item, 'Tocha')
    clicar(botao(ficha, 'Dar'))
    expect(spies.onItem).toHaveBeenLastCalledWith({ kind: 'dar', nome: 'Tocha', member: expect.objectContaining({ playerId: 'p-bruno' }) })
    escolherAba(ficha, 'acoes')
    clicar(botao(ficha, GROUP_VIEW_LABEL))
    expect(spies.onGiveGroupView).toHaveBeenCalledWith('p-bruno')
    expect(painelDaAba(ficha).querySelector('[role="status"]')?.textContent).toBe('Bruno recebeu o que 2 colegas viram')
  })

  it('Esc em dois tempos: fecha o formulário e volta ao botão; de novo, fecha a ficha e volta à linha', async () => {
    render()
    const chegouNoCanvas = vi.fn()
    window.addEventListener('keydown', chegouNoCanvas)
    try {
      const abre = botaoDaLinha(container, 'Bruno')
      const ficha = abrirFicha(container, 'Bruno', 'mochila')
      clicar(botao(ficha, 'Dar item a Bruno'))
      esc(campo(ficha, 'Item para Bruno'))
      expect(ficha.querySelector('form[aria-label="Item novo para Bruno"]')).toBeNull()
      expect(ficha.isConnected).toBe(true)
      await proximoQuadro()
      expect(document.activeElement).toBe(botao(ficha, 'Dar item a Bruno'))
      esc(document.activeElement)
      expect(ficha.isConnected).toBe(false)
      expect(abre.getAttribute('aria-expanded')).toBe('false')
      expect(document.activeElement).toBe(abre)
      expect(chegouNoCanvas).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('keydown', chegouNoCanvas)
    }
  })

  it('fechar a ficha fecha o formulário junto; reabrir começa limpo', () => {
    render()
    const abre = botaoDaLinha(container, 'Bruno')
    clicar(botao(abrirFicha(container, 'Bruno', 'mochila'), 'Moedas de Bruno'))
    expect(fichaDoJogador(container, 'Bruno').querySelector('form[aria-label="Moedas de Bruno"]')).not.toBeNull()
    clicar(abre)
    expect(container.querySelector('form[aria-label="Moedas de Bruno"]')).toBeNull()
    const ficha = abrirFicha(container, 'Bruno', 'mochila')
    expect(ficha.querySelector('form')).toBeNull()
    expect(botao(ficha, 'Moedas de Bruno').getAttribute('aria-expanded')).toBe('false')
  })

  it('aberta pelo teclado, a ficha aparece sem animação; pelo mouse, anima', () => {
    render()
    const abre = botaoDaLinha(container, 'Bruno')
    // Enter e Espaço num botão disparam um clique sem contagem de cliques (detail 0), como el.click().
    clicar(abre)
    expect(fichaDoJogador(container, 'Bruno').hasAttribute('data-instant')).toBe(true)
    clicar(abre)
    act(() => {
      abre.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    })
    expect(fichaDoJogador(container, 'Bruno').hasAttribute('data-instant')).toBe(false)
  })
})

/**
 * O main.css como está no disco (mesmo caminho de `Toggle.test.tsx`): o Vitest
 * troca todo `.css` importado por string vazia, e `new URL(..., import.meta.url)`
 * vira endereço de asset no jsdom.
 */
async function lerMainCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'main.css'), 'utf8')
}

/** As declarações da PRIMEIRA regra cujo seletor é exatamente `seletor`: propriedade → valor. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletores.trim() !== seletor) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  throw new Error(`o main.css não tem a regra "${seletor}"`)
}

/*
 * O CABEÇALHO DO GRUPO numa linha só, no trilho de 240 a 320 px. Em 262 px, com
 * gente esperando, "GRUPO" quebrava em "GRUP/O" e a contagem saía cortada em
 * "3 jogadores esperando persona…". O jsdom não faz layout, então a prova aqui
 * tem duas metades: o texto da contagem (curto o bastante para caber) e a regra
 * do main.css (o título não cede largura). A largura medida fica nos prints.
 */
describe('cabeçalho do Grupo: título e contagem numa linha', () => {
  it('quem espera cabe ao lado do título: "N esperando personagem"; quem são, os cartões logo abaixo dizem', () => {
    expect(groupCountLabel(3, 3)).toBe('3 esperando personagem')
    expect(groupCountLabel(3, 1)).toBe('1 esperando personagem')
    expect(groupCountLabel(3, 0)).toBe('3 jogadores')
    expect(groupCountLabel(1, 0)).toBe('1 jogador')
  })

  it('no main.css, o título "Grupo" não encolhe nem quebra: o overflow-wrap do painel da sala é para nome de jogador, não para ele', async () => {
    const titulo = regra(await lerMainCss(), '.lb-party__head > .lb-eyebrow')
    expect(titulo.get('flex'), 'encolhendo, o título divide a falta de espaço com a contagem e quebra no meio da palavra').toBe('none')
    expect(titulo.get('white-space')).toBe('nowrap')
  })
})
