import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PartyMember } from '../lib/party'
import type { PlayerInfo } from '../net/hostSession'
import { BUSCA_LABEL, CHEGANDO_LABEL, FICHA_FECHA_MS, GrupoCompacto, NINGUEM_ACHADO, NINGUEM_PEDINDO, type GrupoCompactoProps } from './GrupoCompacto'
import { abrirFicha, botaoDaLinha, cartaoDoJogador, fichaDoJogador, linhaDoJogador } from './grupoTeste'
import type { PartySectionProps } from './PartySection'

/*
 * GRUPO COMPACTO: a mesa de 10 em três cenas, cada jogador numa linha de
 * 36 px. Na Cripta (aberta no editor) estão Saga e Maria (que pede passagem);
 * no Salão, Léo (caiu há 4 min) e a Ingrid (congelada); na Torre, o resto.
 * Enzo acabou de chegar e espera personagem.
 */

const CENAS = [
  { id: 's-salao', name: 'Salão' },
  { id: 's-cripta', name: 'Cripta' },
  { id: 's-torre', name: 'Torre' },
]
const NOME_DA_CENA: Record<string, string> = { 's-salao': 'Salão', 's-cripta': 'Cripta', 's-torre': 'Torre' }
const AGORA = 10 * 60_000
const NOME_LONGO = 'Maria Eduarda Albuquerque de Vasconcellos'
const PERSONAGEM_LONGO = 'Lyra da Névoa Prateada, Guardiã do Último Farol'

function jogador(playerId: string, name: string, sceneId: string | undefined, over: Partial<PlayerInfo> = {}): PlayerInfo {
  return {
    clientId: `c-${playerId}`,
    playerId,
    name,
    status: sceneId === undefined ? 'waiting' : 'playing',
    connected: true,
    tokenIds: sceneId === undefined ? [] : [`t-${playerId}`],
    visionRadius: 700,
    visionFactor: 1,
    ...(sceneId === undefined ? {} : { sceneId, sceneName: NOME_DA_CENA[sceneId] }),
    ...over,
  }
}

const JOGADORES: PlayerInfo[] = [
  jogador('saga', 'Saga', 's-cripta'),
  jogador('maria', NOME_LONGO, 's-cripta', { travelPending: true }),
  jogador('leo', 'Léo', 's-salao', { connected: false, clientId: null, disconnectedAt: AGORA - 4 * 60_000 }),
  jogador('ingrid', 'Ingrid', 's-salao'),
  jogador('caio', 'Caio', 's-torre'),
  jogador('dora', 'Dora', 's-torre'),
  jogador('fabi', 'Fabiana Cristina de Oliveira Montenegro', 's-torre'),
  jogador('gil', 'Gil', 's-torre'),
  jogador('hugo', 'Hugo', 's-torre'),
  jogador('enzo', 'Enzo', undefined),
]

function membro(player: PlayerInfo): PartyMember {
  const tokenId = player.tokenIds[0]
  return {
    playerId: player.playerId,
    name: player.name,
    connected: player.connected,
    sceneId: player.sceneId ?? null,
    sceneName: player.sceneName ?? null,
    token: tokenId === undefined ? null : { id: tokenId, color: '#3cff00', x: 0, y: 0 },
    travelPending: player.travelPending === true,
    mochila: [],
    ...(player.disconnectedAt === undefined ? {} : { offlineSince: player.disconnectedAt }),
    ...(player.playerId === 'ingrid' ? { congelado: true as const } : {}),
  }
}

const TOKENS = JOGADORES.flatMap((p) => p.tokenIds.map((id) => ({ id, name: p.playerId === 'maria' ? PERSONAGEM_LONGO : `Herói de ${p.name}` })))

describe('GrupoCompacto', () => {
  let container: HTMLDivElement
  let root: Root
  const spies = {
    onIrACena: vi.fn(),
    onCongelarCena: vi.fn(),
    onPausarCena: vi.fn(),
    onGoTo: vi.fn(),
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    vi.spyOn(Date, 'now').mockReturnValue(AGORA)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    for (const spy of Object.values(spies)) spy.mockClear()
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.restoreAllMocks()
  })

  function render(over: Partial<GrupoCompactoProps> = {}, players: PlayerInfo[] = JOGADORES): void {
    const noop = (): void => {}
    const party: PartySectionProps = { members: players.map(membro), destinations: [], onGoTo: spies.onGoTo, onSend: () => true }
    act(() =>
      root.render(
        <GrupoCompacto
          players={players}
          party={party}
          tokens={TOKENS}
          onAssign={noop}
          onUnassign={noop}
          onKick={noop}
          onVisionRadiusChange={noop}
          onVisionFactorChange={noop}
          onRevealPlan={noop}
          onHidePlan={noop}
          cenaAberta="s-cripta"
          ordemDasCenas={CENAS}
          onIrACena={spies.onIrACena}
          onCongelarCena={spies.onCongelarCena}
          pausedScenes={new Set(['s-torre'])}
          onPausarCena={spies.onPausarCena}
          {...over}
        />,
      ),
    )
  }

  function cenas(): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>('section.lb-grupo__cena'))
  }

  function cena(nome: string): HTMLElement {
    const achada = cenas().find((secao) => secao.querySelector('.lb-grupo__cena-nome')?.textContent === nome)
    if (!achada) throw new Error(`sem a cena "${nome}"`)
    return achada
  }

  function titulos(): string[] {
    return cenas().map((secao) => secao.querySelector('.lb-grupo__cena-nome')?.textContent ?? '')
  }

  function botao(escopo: Element, rotulo: string): HTMLButtonElement {
    const achado = Array.from(escopo.querySelectorAll<HTMLButtonElement>('button')).find((b) => (b.getAttribute('aria-label') ?? b.textContent?.trim()) === rotulo)
    if (!achado) throw new Error(`sem o botão "${rotulo}"`)
    return achado
  }

  function busca(): HTMLInputElement {
    const campo = container.querySelector<HTMLInputElement>(`input[aria-label="${BUSCA_LABEL}"]`)
    if (!campo) throw new Error('sem a busca')
    return campo
  }

  function digita(texto: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(busca(), texto)
      busca().dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function pedindo(): HTMLButtonElement {
    const chip = container.querySelector<HTMLButtonElement>('button.lb-grupo__pedindo')
    if (!chip) throw new Error('sem o chip "Pedindo"')
    return chip
  }

  function tecla(alvo: Element, key: string): KeyboardEvent {
    const evento = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    act(() => {
      alvo.dispatchEvent(evento)
    })
    return evento
  }

  it('agrupa por cena: a aberta no editor primeiro, depois a ordem da lista; quem chega vem antes, aberto', () => {
    render()
    expect(titulos()).toEqual(['Cripta', 'Salão', 'Torre'])
    expect(cena('Cripta').textContent).toContain('no editor')
    expect(cena('Salão').textContent).not.toContain('no editor')
    // "Chegando" no topo, com o cartão aberto: atribuir em um clique, sem abrir nada.
    const chegando = container.querySelector('.lb-grupo__chegando')
    expect(chegando?.querySelector('h4')?.textContent).toBe(CHEGANDO_LABEL)
    expect(chegando?.compareDocumentPosition(cenas()[0] as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    const enzo = cartaoDoJogador(container, 'Enzo')
    expect(chegando?.contains(enzo)).toBe(true)
    expect(enzo.querySelector('select')).not.toBeNull()
    expect(container.querySelector('.lb-party__count')?.textContent).toBe('1 esperando personagem')
  })

  it('10 jogadores com nomes longos: uma linha de um botão cada, nome e personagem inteiros no title, selos à vista', () => {
    render()
    expect(container.querySelectorAll('li.lb-grupo__item')).toHaveLength(9)
    for (const li of Array.from(container.querySelectorAll('li.lb-grupo__item'))) expect(li.querySelectorAll('button')).toHaveLength(1)
    const maria = linhaDoJogador(container, NOME_LONGO)
    expect(maria.querySelector('.lb-player__name')?.getAttribute('title')).toBe(NOME_LONGO)
    expect(maria.querySelector('.lb-grupo__personagem')?.getAttribute('title')).toBe(PERSONAGEM_LONGO)
    expect(maria.textContent).toContain('passagem')
    // Léo caiu há 4 min: fica na cena da ficha, apagado, com o selo.
    const leo = linhaDoJogador(container, 'Léo')
    expect(cena('Salão').contains(leo)).toBe(true)
    expect(leo.className).toContain('lb-party__item--away')
    expect(leo.textContent).toContain('fora 4 min')
    expect(leo.querySelector('.lb-grupo__presenca')?.getAttribute('data-presenca')).toBe('fora')
    expect(linhaDoJogador(container, 'Ingrid').querySelector('.lb-player__congelado')?.textContent).toBe('congelado')
  })

  it('a busca acha pelo nome do jogador ou do personagem, sem acento; Esc limpa e não chega ao editor', () => {
    render()
    digita('nevoa prateada')
    expect(container.querySelectorAll('li.lb-grupo__item')).toHaveLength(1)
    expect(titulos()).toEqual(['Cripta'])
    expect(container.querySelector('.lb-grupo__chegando')).toBeNull()
    digita('LEO')
    expect(titulos()).toEqual(['Salão'])
    digita('ninguém assim')
    expect(container.textContent).toContain(NINGUEM_ACHADO)
    const evento = tecla(busca(), 'Escape')
    expect(evento.defaultPrevented).toBe(true)
    expect(busca().value).toBe('')
    expect(container.querySelectorAll('li.lb-grupo__item')).toHaveLength(9)
  })

  it('"Pedindo N": conta quem pede algo e, ligado, mostra só eles', () => {
    render()
    expect(pedindo().textContent).toBe('Pedindo 2')
    expect(pedindo().getAttribute('aria-pressed')).toBe('false')
    act(() => pedindo().click())
    expect(pedindo().getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('li.lb-grupo__item')).toHaveLength(1)
    expect(linhaDoJogador(container, NOME_LONGO)).toBeDefined()
    expect(cartaoDoJogador(container, 'Enzo')).toBeDefined()
    act(() => pedindo().click())
    expect(container.querySelectorAll('li.lb-grupo__item')).toHaveLength(9)
  })

  it('ninguém pedindo: o chip fica indisponível; ligado e sem ninguém, a lista diz isso', () => {
    const calmos = JOGADORES.filter((p) => p.playerId !== 'maria' && p.playerId !== 'enzo')
    render({}, calmos)
    expect(pedindo().textContent).toBe('Pedindo 0')
    expect(pedindo().disabled).toBe(true)
    render({}, JOGADORES.filter((p) => p.playerId === 'enzo' || p.playerId === 'saga'))
    act(() => pedindo().click())
    render({}, JOGADORES.filter((p) => p.playerId === 'saga'))
    expect(container.textContent).toContain(NINGUEM_PEDINDO)
    expect(pedindo().disabled).toBe(false)
  })

  it('uma ficha aberta por vez; Esc fecha e devolve o foco à linha', () => {
    render()
    const fichaSaga = abrirFicha(container, 'Saga')
    abrirFicha(container, 'Caio')
    expect(fichaSaga.isConnected).toBe(false)
    expect(botaoDaLinha(container, 'Saga').getAttribute('aria-expanded')).toBe('false')
    expect(botaoDaLinha(container, 'Caio').getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.lb-grupo__ficha')).toHaveLength(1)
    const ficha = fichaDoJogador(container, 'Caio')
    const irLa = botao(ficha, 'Ir lá')
    act(() => irLa.focus())
    const evento = tecla(irLa, 'Escape')
    expect(evento.defaultPrevented).toBe(true)
    expect(ficha.isConnected).toBe(false)
    expect(document.activeElement).toBe(botaoDaLinha(container, 'Caio'))
  })

  it('pelo mouse a ficha fecha com animação: sai da árvore depois do fechar, sem aceitar clique no meio', async () => {
    render()
    const abre = botaoDaLinha(container, 'Saga')
    const clique = () => abre.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    act(() => {
      clique()
    })
    const ficha = fichaDoJogador(container, 'Saga')
    expect(ficha.hasAttribute('data-instant')).toBe(false)
    act(() => {
      clique()
    })
    expect(abre.getAttribute('aria-expanded')).toBe('false')
    expect(ficha.getAttribute('data-estado')).toBe('fechando')
    expect(ficha.hasAttribute('inert')).toBe(true)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, FICHA_FECHA_MS + 50))
    })
    expect(ficha.isConnected).toBe(false)
  })

  it('as abas da ficha andam pelas setas, e o foco vai junto', () => {
    render()
    const ficha = abrirFicha(container, 'Saga', 'mochila')
    const abas = Array.from(ficha.querySelectorAll<HTMLButtonElement>('[role="tab"]'))
    expect(abas.map((aba) => [aba.textContent, aba.getAttribute('aria-selected'), aba.tabIndex])).toEqual([
      ['Mochila', 'true', 0],
      ['Visão', 'false', -1],
      ['Ficha', 'false', -1],
    ])
    tecla(abas[0] as HTMLButtonElement, 'ArrowRight')
    const visao = Array.from(ficha.querySelectorAll<HTMLButtonElement>('[role="tab"]'))[1]
    expect(visao?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(visao)
    expect(ficha.querySelector('[role="tabpanel"]')?.textContent).toContain('Fator de visão')
    tecla(visao as HTMLButtonElement, 'End')
    expect(ficha.querySelector('[role="tabpanel"]')?.getAttribute('aria-labelledby')).toBe(Array.from(ficha.querySelectorAll('[role="tab"]'))[2]?.id)
    tecla(document.activeElement as Element, 'ArrowRight')
    expect(Array.from(ficha.querySelectorAll('[role="tab"]'))[0]?.getAttribute('aria-selected')).toBe('true')
  })

  it('atalhos da cena: Ir à cena, Congelar a cena e Pausar a cena chamam com a cena e as fichas dela', () => {
    render()
    const cripta = cena('Cripta')
    act(() => botao(cripta, 'Ir à cena Cripta').click())
    expect(spies.onIrACena).toHaveBeenCalledWith('s-cripta')
    act(() => botao(cripta, 'Congelar a cena Cripta').click())
    expect(spies.onCongelarCena).toHaveBeenCalledWith(['t-saga', 't-maria'], true)
    const pausar = botao(cripta, 'Pausar a cena Cripta')
    expect(pausar.getAttribute('aria-pressed')).toBe('false')
    act(() => pausar.click())
    expect(spies.onPausarCena).toHaveBeenCalledWith('s-cripta', true)
    // A Torre já está pausada: o mesmo botão solta.
    const pausarTorre = botao(cena('Torre'), 'Pausar a cena Torre')
    expect(pausarTorre.getAttribute('aria-pressed')).toBe('true')
    act(() => pausarTorre.click())
    expect(spies.onPausarCena).toHaveBeenLastCalledWith('s-torre', false)
  })

  it('com todas as fichas da cena congeladas, o botão vira "Descongelar a cena" e solta', () => {
    // Só a Ingrid (congelada) no Salão.
    render({}, JOGADORES.filter((p) => p.playerId === 'ingrid'))
    const salao = cena('Salão')
    act(() => botao(salao, 'Descongelar a cena Salão').click())
    expect(spies.onCongelarCena).toHaveBeenCalledWith(['t-ingrid'], false)
  })

  it('sem cena de aventura (mapa solto): o título leva o nome do mapa, sem Ir à cena nem Pausar', () => {
    const soltos = [jogador('ana', 'Ana', undefined, { status: 'playing', tokenIds: ['t-ana'] })]
    render({ cenaAberta: null, ordemDasCenas: [], mapName: 'Masmorra do Rei' }, soltos)
    expect(titulos()).toEqual(['Masmorra do Rei'])
    const nomes = Array.from(cena('Masmorra do Rei').querySelectorAll('button')).map((b) => b.getAttribute('aria-label') ?? '')
    expect(nomes).toContain('Congelar a cena Masmorra do Rei')
    expect(nomes.some((n) => n.startsWith('Ir à cena'))).toBe(false)
    expect(nomes.some((n) => n.startsWith('Pausar a cena'))).toBe(false)
  })

  it('o título recolhe a cena: aria-expanded, o corpo inerte, e reabre', () => {
    render()
    const salao = cena('Salão')
    const alterna = salao.querySelector<HTMLButtonElement>('.lb-grupo__cena-alterna')
    if (!alterna) throw new Error('sem o título recolhível')
    expect(alterna.getAttribute('aria-expanded')).toBe('true')
    act(() => alterna.click())
    expect(alterna.getAttribute('aria-expanded')).toBe('false')
    expect(salao.hasAttribute('data-recolhida')).toBe(true)
    expect(document.getElementById(alterna.getAttribute('aria-controls') ?? '')?.hasAttribute('inert')).toBe(true)
    // Recolher uma cena não mexe nas outras.
    expect(cena('Torre').hasAttribute('data-recolhida')).toBe(false)
    act(() => alterna.click())
    expect(alterna.getAttribute('aria-expanded')).toBe('true')
  })

  it('a ficha aberta: o pedido de passagem no topo e as cinco ações com o nome acessível de sempre', () => {
    render()
    const ficha = abrirFicha(container, NOME_LONGO)
    expect(ficha.querySelector('.lb-grupo__pendencia')?.textContent).toContain('Pediu passagem')
    act(() => botao(ficha, 'Ir lá').click())
    expect(spies.onGoTo).toHaveBeenCalledWith(expect.objectContaining({ playerId: 'maria' }))
  })
  it('quem acabou de ganhar ficha sai de Chegando com a ficha aberta na aba Ficha', () => {
    render()
    const enzoComFicha = JOGADORES.map((p) => (p.playerId === 'enzo' ? { ...p, status: 'playing' as const, tokenIds: ['t-enzo'], sceneId: 's-cripta', sceneName: 'Cripta' } : p))
    render({}, enzoComFicha)
    expect(botaoDaLinha(container, 'Enzo').getAttribute('aria-expanded')).toBe('true')
    const aba = fichaDoJogador(container, 'Enzo').querySelector('[role="tab"][aria-selected="true"]')
    expect(aba?.textContent).toBe('Ficha')
  })
})
