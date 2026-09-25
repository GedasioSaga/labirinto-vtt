import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { partyDestinations, partyMembers } from '../lib/party'
import { createEmptyMap } from '../lib/mapFactory'
import type { TunnelState } from '../net/hostBridge'
import type { HostWorld, PlayerInfo } from '../net/hostSession'
import type { Token } from '../types/map'
import { PLAN_HINT, RoomPanel, roomPanelTokensOf } from './RoomPanel'

/*
 * A mesa de 7 da simulação (crime, fuga, mansão): seis jogam — um deles caiu
 * e outro está na Biblioteca — e Gina chegou por último, sem personagem. O
 * Livro, na Biblioteca, é a única ficha livre; o Mordomo é NPC.
 */
const COZINHA = 'Cozinha'
const BIBLIOTECA = 'Biblioteca'

function ficha(id: string, name: string, color: string, extra: Partial<Token> = {}): Token {
  return { id, characterId: null, name, x: 100, y: 100, size: 1, image: null, color, ...extra }
}

function mundo(): HostWorld {
  const cozinha = {
    ...createEmptyMap('m-cozinha', 'Casa', 20, 12, 50),
    tokens: [
      ficha('tok-lanterna', 'Lanterna', '#3cff00'),
      ficha('tok-machado', 'Machado', '#ff5a00'),
      ficha('tok-cajado', 'Cajado', '#1e90ff'),
      ficha('tok-arco', 'Arco', '#ffd700'),
      ficha('tok-adaga', 'Adaga', '#ff00aa'),
      ficha('tok-mordomo', 'Mordomo', '#888888', { npc: true }),
    ],
  }
  const biblioteca = { ...createEmptyMap('m-biblioteca', 'Casa', 20, 12, 50), tokens: [ficha('tok-escudo', 'Escudo', '#00ffee'), ficha('tok-livro', 'Livro', '#aa00ff')] }
  return { open: { sceneId: 's-cozinha', name: COZINHA, map: cozinha }, background: [{ sceneId: 's-biblioteca', name: BIBLIOTECA, map: biblioteca }] }
}

function jogador(over: Partial<PlayerInfo>): PlayerInfo {
  return { clientId: 'c', playerId: 'p', name: '?', status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, sceneId: 's-cozinha', sceneName: COZINHA, ...over }
}

const JOGADORES: PlayerInfo[] = [
  jogador({ clientId: 'c1', playerId: 'p1', name: 'Ana', tokenIds: ['tok-lanterna'] }),
  jogador({ clientId: 'c2', playerId: 'p2', name: 'Bruno', tokenIds: ['tok-machado'], visionRadius: 450 }),
  jogador({ clientId: 'c3', playerId: 'p3', name: 'Carla', tokenIds: ['tok-cajado'] }),
  jogador({ clientId: 'c4', playerId: 'p4', name: 'Duda', tokenIds: ['tok-arco'] }),
  jogador({ clientId: 'c5', playerId: 'p5', name: 'Enzo', tokenIds: ['tok-escudo'], sceneId: 's-biblioteca', sceneName: BIBLIOTECA }),
  // Caiu: sem conexão, e por isso sem Expulsar.
  jogador({ clientId: null, playerId: 'p6', name: 'Fabio', connected: false, tokenIds: ['tok-adaga'] }),
  jogador({ clientId: 'c7', playerId: 'p7', name: 'Gina', status: 'waiting', tokenIds: [], sceneId: undefined, sceneName: undefined }),
]
const NOMES = JOGADORES.map((j) => j.name)

const ROOM = { code: 'MESA07', urls: ['http://10.0.0.2:7777'], qrSvg: '<svg/>' }
const IDLE: TunnelState = { kind: 'idle' }

describe('aba Jogo compacta: 7 jogadores, 1 aguardando', () => {
  let container: HTMLDivElement
  let root: Root
  const spies = {
    onAssign: vi.fn(),
    onUnassign: vi.fn(),
    onKick: vi.fn(),
    onVisionRadiusChange: vi.fn(),
    onVisionFactorChange: vi.fn(),
    onRevealPlan: vi.fn(),
    onHidePlan: vi.fn(),
    onGoTo: vi.fn(),
    onToggleFollow: vi.fn(),
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
    act(() =>
      root.render(
        <RoomPanel
          room={ROOM}
          players={JOGADORES}
          tokens={roomPanelTokensOf(world)}
          party={{
            members: partyMembers(JOGADORES, world),
            destinations: partyDestinations(world),
            onGoTo: spies.onGoTo,
            onSend: () => true,
            followingId: null,
            onToggleFollow: spies.onToggleFollow,
          }}
          tunnel={IDLE}
          onStart={noop}
          onStop={noop}
          onStartTunnel={noop}
          onStopTunnel={noop}
          onAssign={spies.onAssign}
          onUnassign={spies.onUnassign}
          onKick={spies.onKick}
          onVisionRadiusChange={spies.onVisionRadiusChange}
          onVisionFactorChange={spies.onVisionFactorChange}
          onRevealPlan={spies.onRevealPlan}
          onHidePlan={spies.onHidePlan}
          onToggleLaser={noop}
          clues={{ rows: [], onCenter: noop, onToggle: noop }}
        />,
      ),
    )
  }

  /** A região "Grupo": a `<section>` do título "Grupo" (a mesma que a régua e2e acha pelo nome). */
  function grupo(): HTMLElement {
    const titulo = Array.from(container.querySelectorAll('h3')).find((h) => h.textContent === 'Grupo')
    const secao = titulo?.closest('section')
    if (!secao) throw new Error('sem a seção "Grupo"')
    return secao
  }

  /** Os cartões de um jogador: `.lb-field` com "<nome> —" (o gancho das jornadas de atribuir). */
  function cartoes(nome: string): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('.lb-field')).filter((el) => (el.textContent ?? '').includes(`${nome} —`))
  }

  function cartao(nome: string): HTMLElement {
    const achados = cartoes(nome)
    if (achados.length !== 1) throw new Error(`${achados.length} cartões de ${nome}`)
    return achados[0]
  }

  /** A linha do jogador no Grupo: o `<li>` do cartão dele. */
  function linha(nome: string): HTMLLIElement {
    const li = cartao(nome).closest('li')
    if (!li) throw new Error(`o cartão de ${nome} não é linha do Grupo`)
    return li
  }

  /** Nome acessível: `aria-label` ou o texto sem o que é `aria-hidden`. */
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

  /** O controle ligado ao `<label>` com esse texto, dentro do escopo. */
  function controle(escopo: Element, rotulo: string): HTMLElement {
    const label = Array.from(escopo.querySelectorAll('label')).find((l) => l.textContent?.trim() === rotulo)
    const alvo = label ? document.getElementById(label.htmlFor) : null
    if (!alvo || !escopo.contains(alvo)) throw new Error(`sem o controle "${rotulo}"`)
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

  function mudarFaixa(input: HTMLElement, valor: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(input, valor)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  /** Cor como o DOM guarda: a mesma conversão que o estilo em linha da bolinha sofre. */
  function corCss(hex: string): string {
    const amostra = document.createElement('span')
    amostra.style.background = hex
    return amostra.style.background
  }

  function ocorrencias(texto: string | null, trecho: string): number {
    return (texto ?? '').split(trecho).length - 1
  }

  function antes(a: Node, b: Node): boolean {
    return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  }

  it('uma lista só: o Grupo tem uma linha por jogador em jogo e quem aguarda vem num cartão aberto acima dela', () => {
    render()
    const secao = grupo()
    expect(secao.querySelectorAll('li').length).toBe(6)
    // Um cartão por pessoa: nada de a mesma mesa em duas listas.
    for (const nome of NOMES) expect(cartoes(nome).length).toBe(1)
    expect(secao.textContent).toContain('1 jogador esperando personagem')

    const gina = cartao('Gina')
    expect(secao.contains(gina)).toBe(true)
    expect(gina.closest('li')).toBeNull()
    const lista = secao.querySelector('ul')
    if (!lista) throw new Error('sem a lista do Grupo')
    expect(antes(gina, lista)).toBe(true)
    // Aberto: atribuir em um clique, a lista e o raio, sem abrir nada.
    expect(botoes(gina)).toContain('Biblioteca · Atribuir Livro')
    expect(controle(gina, 'Atribuir token').tagName).toBe('SELECT')
    expect(controle(gina, 'Raio de visão').getAttribute('type')).toBe('range')
  })

  it('a linha de quem joga mostra bolinha, nome, ficha, cena e status; raio, planta e Expulsar ficam fora dela', () => {
    render()
    const bruno = linha('Bruno')
    expect(bruno.textContent).toContain('Machado')
    expect(bruno.textContent).toContain(COZINHA)
    expect(bruno.textContent).toMatch(/\bonline\b/)
    expect(botoes(bruno)).toEqual(['Remover Machado', 'Ir lá', 'Seguir', 'Mandar para…', 'Mais de Bruno'])
    expect(bruno.querySelector('input, select')).toBeNull()
    expect(bruno.textContent).not.toContain('Revelar planta')
    expect(bruno.textContent).not.toContain('Expulsar')
    const bolinha = bruno.querySelector<HTMLElement>('.lb-party__dot')
    expect(bolinha?.style.background).toBe(corCss('#ff5a00'))

    // Quem caiu: "fora" à vista, e o status inteiro no cartão (leitor de tela e régua).
    const fabio = linha('Fabio')
    expect(fabio.textContent).toMatch(/\bfora\b/)
    expect(cartao('Fabio').textContent).toContain('Fabio — jogando · desconectado')
    // Quem está em outra cena diz qual.
    expect(linha('Enzo').textContent).toContain(BIBLIOTECA)
  })

  it('"Mais" na linha do Bruno abre raio, planta e Expulsar dele, e cada controle age no Bruno', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    expect(mais.getAttribute('aria-expanded')).toBe('false')
    clicar(mais)
    expect(mais.getAttribute('aria-expanded')).toBe('true')
    const painel = painelDe(mais)
    expect(linha('Bruno').contains(painel)).toBe(true)

    const raio = controle(painel, 'Raio de visão')
    expect((raio as HTMLInputElement).value).toBe('450')
    expect(painel.textContent).toContain('450 px')
    expect(botoes(painel)).toEqual(expect.arrayContaining(['Revelar planta', 'Esconder de novo', 'Expulsar']))
    // Só dele: as outras linhas continuam curtas.
    expect(linha('Ana').querySelector('input[type="range"]')).toBeNull()
    expect(botoes(linha('Ana'))).not.toContain('Expulsar')

    mudarFaixa(raio, '500')
    expect(spies.onVisionRadiusChange).toHaveBeenCalledWith('p2', 500)
    clicar(botao(painel, 'Revelar planta'))
    expect(spies.onRevealPlan).toHaveBeenCalledWith('p2')
    clicar(botao(painel, 'Esconder de novo'))
    expect(spies.onHidePlan).toHaveBeenCalledWith('p2')
    clicar(botao(painel, 'Expulsar'))
    expect(spies.onKick).toHaveBeenCalledWith('c2')
  })

  it('Esc fecha o "Mais", devolve o foco ao botão e não chega aos atalhos do editor', () => {
    render()
    const mais = botao(linha('Bruno'), 'Mais de Bruno')
    clicar(mais)
    const painel = painelDe(mais)
    const raio = controle(painel, 'Raio de visão')
    act(() => raio.focus())

    const atalhos = vi.fn()
    window.addEventListener('keydown', atalhos)
    try {
      act(() => {
        raio.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      })
    } finally {
      window.removeEventListener('keydown', atalhos)
    }

    expect(mais.getAttribute('aria-expanded')).toBe('false')
    expect(painel.isConnected).toBe(false)
    expect(document.activeElement).toBe(mais)
    expect(atalhos).not.toHaveBeenCalled()
  })

  it('um "Mais" aberto por vez, e a dica da planta aparece uma vez só', () => {
    render()
    expect(ocorrencias(container.textContent, PLAN_HINT)).toBe(0)
    clicar(botao(linha('Bruno'), 'Mais de Bruno'))
    clicar(botao(linha('Carla'), 'Mais de Carla'))
    expect(botao(linha('Bruno'), 'Mais de Bruno').getAttribute('aria-expanded')).toBe('false')
    expect(botao(linha('Carla'), 'Mais de Carla').getAttribute('aria-expanded')).toBe('true')
    expect(ocorrencias(container.textContent, PLAN_HINT)).toBe(1)

    // Quem aguarda também tem "Mais" (planta e Expulsar); o raio dele já está à vista e não se repete.
    const gina = cartao('Gina')
    const maisGina = botao(gina, 'Mais de Gina')
    clicar(maisGina)
    expect(botao(linha('Carla'), 'Mais de Carla').getAttribute('aria-expanded')).toBe('false')
    expect(botoes(painelDe(maisGina))).toEqual(expect.arrayContaining(['Revelar planta', 'Esconder de novo', 'Expulsar']))
    expect(gina.querySelectorAll('input[type="range"]').length).toBe(1)
    expect(ocorrencias(container.textContent, PLAN_HINT)).toBe(1)

    // Quem caiu não tem conexão para derrubar: a planta sim, Expulsar não.
    const maisFabio = botao(linha('Fabio'), 'Mais de Fabio')
    clicar(maisFabio)
    const painelFabio = painelDe(maisFabio)
    expect(botoes(painelFabio)).toContain('Revelar planta')
    expect(botoes(painelFabio)).not.toContain('Expulsar')
  })

  it('"Mandar para…" abre o envio abaixo da lista, um jogador por vez, e Cancelar fecha', () => {
    render()
    const mandarAna = botao(linha('Ana'), 'Mandar para…')
    clicar(mandarAna)
    expect(mandarAna.getAttribute('aria-expanded')).toBe('true')
    const envio = document.getElementById(mandarAna.getAttribute('aria-controls') ?? '')
    expect(envio?.querySelector('form')?.getAttribute('aria-label')).toBe('Mandar Ana para outra cena')
    expect(grupo().contains(envio)).toBe(true)

    const mandarBruno = botao(linha('Bruno'), 'Mandar para…')
    clicar(mandarBruno)
    expect(mandarAna.getAttribute('aria-expanded')).toBe('false')
    expect(mandarBruno.getAttribute('aria-expanded')).toBe('true')
    expect(grupo().querySelectorAll('form').length).toBe(1)
    expect(grupo().querySelector('form')?.getAttribute('aria-label')).toBe('Mandar Bruno para outra cena')

    clicar(botao(grupo(), 'Cancelar'))
    expect(grupo().querySelector('form')).toBeNull()
    expect(mandarBruno.getAttribute('aria-expanded')).toBe('false')
  })

  it('a aba começa pelo código, pelo Laser e pelo Grupo; convite (link, endereços, QR) e Fechar sala vêm depois', () => {
    render()
    const secao = grupo()
    const codigo = Array.from(container.querySelectorAll('strong')).find((s) => s.textContent === ROOM.code)
    if (!codigo) throw new Error('sem o código da sala')
    const qr = container.querySelector('img[alt="QR da sala"]')
    if (!qr) throw new Error('sem o QR da sala')
    expect(antes(codigo, secao)).toBe(true)
    expect(antes(botao(container, 'Laser'), secao)).toBe(true)
    expect(antes(secao, botao(container, 'Tornar pública'))).toBe(true)
    expect(antes(secao, qr)).toBe(true)
    expect(antes(secao, botao(container, 'Fechar sala'))).toBe(true)
  })
})
