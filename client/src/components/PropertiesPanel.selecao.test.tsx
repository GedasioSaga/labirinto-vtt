import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyMap } from '../lib/mapFactory'
import { EMPTY_SELECTION } from '../lib/selectionModel'
import { relevantPropertyGroups } from '../lib/toolProperties'
import { useMapStore } from '../stores/mapStore'
import type { FloorPiece, Region, Token, Wall } from '../types/map'
import { PropertiesPanel, type PisosWiring } from './PropertiesPanel'
import { propsDoPainel, type PainelProps } from './propertiesPanelTestProps'
import type { SelectionSummary } from './SelectionControls'

/*
 * A faixa da seleção e a ordem por tarefa no painel DE VERDADE (a costura com o
 * `PropertiesPanel`, não a faixa solta): Apagar numa instância só, no topo do
 * corpo; "Levar ao piso" fora da coluna, no menu; e cada item na ordem da
 * tarefa (sala: Travado e "Jogadores" logo depois do bloco Sala; porta: Porta e
 * Tipo antes de Parede; ficha: Rotação/Travado/Oculto logo depois de Condições).
 */

const SALA: Region = {
  id: 'salao',
  points: [{ x: 0, y: 0 }, { x: 256, y: 0 }, { x: 256, y: 256 }, { x: 0, y: 256 }],
  tag: '',
  fillColor: '#8a6a5a',
  fillPattern: 'solid',
  data: {},
  room: { shape: 'rect', name: 'Salao' },
}
const GUARDA: Token = { id: 'guarda', characterId: null, name: 'Guarda', x: 320, y: 320, size: 1, image: null }
const PAREDE: Wall = { id: 'aresta', x1: 256, y1: 0, x2: 256, y2: 256, blocksLight: true, blocksMove: true, door: null }
const PORTA: Wall = { ...PAREDE, door: { open: false, locked: false, kind: 'normal' } }

const nada = (): void => {}

function selecao(summary: SelectionSummary | null, onRemoveSelected: () => void = nada): PainelProps['selection'] {
  return { selection: summary, defaultTokenName: 'Token 1', onAddToken: nada, onRemoveSelected }
}

function pisosNoTerreo(onLevarSelecaoAoPiso: (piso: number) => void = nada): PisosWiring {
  return { onTokenPisoChange: nada, onStairPisosChange: nada, pisoAtivo: 0, onEditarPiso: nada, onLevarSelecaoAoPiso }
}

describe('painel de propriedades — faixa da seleção e ordem por tarefa', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    useMapStore.setState({
      map: { ...createEmptyMap('m1', 'Casa', 30, 20, 64), regions: [SALA], tokens: [GUARDA], walls: [PORTA] },
      camera: { x: 0, y: 0, scale: 1 },
      selection: EMPTY_SELECTION,
      past: [],
      future: [],
    })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function renderPainel(props: PainelProps): void {
    act(() => root.render(<PropertiesPanel {...props} />))
  }

  const corpo = () => container.querySelector<HTMLElement>('.lb-inspector__body')
  /** Títulos de seção em ordem de DOM — a ordem do leitor de tela e da coluna. */
  const titulos = () => Array.from(container.querySelectorAll('.lb-inspector__body h2')).map((h) => (h.textContent ?? '').trim())
  const botoesComTexto = (texto: RegExp) => Array.from(container.querySelectorAll('button')).filter((b) => texto.test(b.textContent ?? ''))
  /** Botões pelo nome acessível (o `aria-label`, senão o texto) — o que o `getByRole` das jornadas lê. */
  const botoesComNome = (nome: RegExp) =>
    Array.from(container.querySelectorAll('button')).filter((b) => nome.test(b.getAttribute('aria-label') ?? b.textContent ?? ''))
  /** A seção do Acervo, como as jornadas a acham: a `section` do título "Acervo de tokens". */
  const acervo = () =>
    Array.from(container.querySelectorAll('.lb-inspector__body h2'))
      .find((h) => h.textContent === 'Acervo de tokens')
      ?.closest('section') ?? null
  /** O cabeçalho do inspetor: fora do corpo que rola, sempre à vista. */
  const cabecalho = () => container.querySelector<HTMLElement>('.lb-inspector__head')
  /** O "+ Token" do painel, pelo nome que as jornadas clicam. */
  const maisToken = () => botoesComNome(/^Adicionar token$/)[0] ?? null
  const campoNovoToken = () => container.querySelector<HTMLInputElement>('input#lb-new-token-name')
  /** A coluna "rolada" até `inicio` px (o jsdom não rola: a posição fica guardada aqui). */
  function rolarCorpo(inicio: number): { valor: () => number } {
    let rolagem = inicio
    Object.defineProperty(corpo(), 'scrollTop', {
      configurable: true,
      get: () => rolagem,
      set: (valor: number) => {
        rolagem = valor
      },
    })
    return { valor: () => rolagem }
  }
  /** `a` vem antes de `b` no documento. */
  const antes = (a: Node | null | undefined, b: Node | null | undefined) =>
    a !== null && a !== undefined && b !== null && b !== undefined && (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

  function painelDaFicha(extra: Partial<PainelProps> = {}): PainelProps {
    return propsDoPainel(GUARDA, {
      selection: selecao({ kind: 'token', count: 1 }),
      // Os quatro controles da transformação, como o App liga (`tokenTransform`).
      tokenTransform: { onRotationChange: nada, onLockedChange: nada, onHiddenChange: nada, onSecretChange: nada },
      ...extra,
    })
  }

  function painelDaSala(extra: Partial<PainelProps> = {}): PainelProps {
    return propsDoPainel(null, {
      groups: relevantPropertyGroups('select', { region: true, regionIsRoom: true }),
      selectedRegion: SALA,
      selection: selecao({ kind: 'region', count: 1 }),
      // Com os dois campos do Avançado ligados, como o App faz com uma região selecionada.
      regionStyle: {
        color: SALA.fillColor,
        onColorChange: nada,
        pattern: 'solid',
        onPatternChange: nada,
        strokeJoin: 'round',
        onStrokeJoinChange: nada,
        onSmoothRegion: nada,
      },
      playerSecret: { secret: false, onSecretChange: nada },
      areaTrigger: { kind: null, revealed: false, onKindChange: nada, onRevealedChange: nada },
      perigoDaSala: (
        <section className="lb-section" aria-label="Perigo">
          <h2 className="lb-eyebrow">Perigo</h2>
        </section>
      ),
      ...extra,
    })
  }

  it('com seleção, a faixa é o primeiro filho do corpo, com o tipo e o nome, e o único Apagar do painel', () => {
    const onRemoveSelected = vi.fn()
    renderPainel(painelDaFicha({ selection: selecao({ kind: 'token', count: 1 }, onRemoveSelected) }))

    const faixa = corpo()?.firstElementChild
    expect(faixa?.getAttribute('role')).toBe('toolbar')
    expect(faixa?.getAttribute('aria-label')).toBe('Ações da seleção')
    expect(faixa?.textContent).toContain('Guarda')
    expect(faixa?.textContent).toContain('Token')

    const apagar = botoesComTexto(/^Apagar token selecionado$/)
    expect(apagar).toHaveLength(1)
    expect(faixa?.contains(apagar[0] ?? null)).toBe(true)
    expect(botoesComTexto(/Nada selecionado/)).toHaveLength(0)

    act(() => apagar[0]?.click())
    expect(onRemoveSelected).toHaveBeenCalledTimes(1)
  })

  it('com seleção, sem "Seleção" nem "Nada selecionado": o "+ Token" é um só no painel, no cabeçalho, à vista sem rolar', () => {
    renderPainel(painelDaFicha())
    expect(titulos()).not.toContain('Seleção')
    expect(botoesComTexto(/Nada selecionado/)).toHaveLength(0)
    // As jornadas clicam o trecho sem `exact`: um botão só cujo nome o contém.
    const adicionar = botoesComNome(/adicionar token/i)
    expect(adicionar).toHaveLength(1)
    expect(adicionar[0]?.getAttribute('aria-label')).toBe('Adicionar token')
    expect((adicionar[0]?.textContent ?? '').replace(/\s+/g, ' ').trim()).toBe('+ Token')
    // No cabeçalho, fora do corpo que rola: com a ficha comprida, o Acervo
    // fica 1500 px abaixo, e o "+ Token" continua onde estava.
    expect(cabecalho()?.contains(adicionar[0] ?? null)).toBe(true)
    expect(corpo()?.contains(adicionar[0] ?? null)).toBe(false)
    expect(acervo()?.querySelectorAll('button[aria-label="Adicionar token"]')).toHaveLength(0)
    // A engrenagem continua na ponta: o "+ Token" vem antes dela.
    expect(cabecalho()?.lastElementChild?.getAttribute('aria-label')).toBe('Configurações do mapa')
    expect(cabecalho()?.lastElementChild?.previousElementSibling).toBe(adicionar[0])
    // O nome do mapa cede o espaço e corta antes das medidas: o ponteiro lê a linha inteira.
    expect(cabecalho()?.querySelector('.lb-inspector__mapname')?.getAttribute('title')).toBe('Casa · 30×20 · 64px')
  })

  it('"+ Token" com algo selecionado: o campo abre no topo do corpo, logo abaixo da faixa; criar volta a coluna ao topo e devolve o foco ao "+ Token"', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    renderPainel(painelDaFicha({ selection: { ...selecao({ kind: 'token', count: 1 }), onAddToken } }))
    const rolagem = rolarCorpo(640)

    act(() => maisToken()?.click())
    const campo = campoNovoToken()
    expect(campo?.value).toBe('Token 1')
    expect(document.activeElement).toBe(campo)
    // Logo abaixo da faixa da seleção, antes da ficha — e não no pé da coluna.
    expect(corpo()?.children[1]?.contains(campo)).toBe(true)
    expect(acervo()?.contains(campo)).toBe(false)

    act(() => campo?.form?.requestSubmit())
    expect(onAddToken).toHaveBeenCalledWith('Token 1')
    expect(campoNovoToken()).toBeNull()
    // A ficha do token novo nasce no topo do corpo: a coluna volta para lá.
    expect(rolagem.valor()).toBe(0)
    // O foco não cai no body: volta a quem abriu, pronto para o próximo token.
    expect(document.activeElement).toBe(maisToken())
  })

  it('sem seleção, criar pelo "+ Token" seleciona o token novo e o foco continua no "+ Token" — não cai no body quando a faixa troca', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: { ...selecao(null), onAddToken } }))
    const botao = maisToken()
    act(() => botao?.click())
    act(() => campoNovoToken()?.form?.requestSubmit())
    expect(onAddToken).toHaveBeenCalledWith('Token 1')
    // O App seleciona o token que nasceu: a faixa vazia dá lugar à faixa dele.
    renderPainel(painelDaFicha({ selection: { ...selecao({ kind: 'token', count: 1 }), onAddToken } }))
    expect(corpo()?.firstElementChild?.getAttribute('role')).toBe('toolbar')
    // O mesmo botão, no mesmo lugar, com o foco.
    expect(maisToken()).toBe(botao)
    expect(document.activeElement).toBe(botao)
  })

  it('"+ Token" com o campo já aberto leva o foco de volta ao campo, sem fechar nem abrir um segundo', () => {
    renderPainel(painelDaFicha())
    act(() => maisToken()?.click())
    const campo = campoNovoToken()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campo, 'Goblin')
      campo?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    // O "+ Token" não some com o campo aberto: o cabeçalho não muda de desenho.
    expect(maisToken()).not.toBeNull()
    // O foco foi para outro lugar (um Tab, um clique na coluna)...
    act(() => maisToken()?.focus())
    expect(document.activeElement).toBe(maisToken())
    act(() => maisToken()?.click())
    // ...e o "+ Token" o traz de volta, com o que já estava escrito.
    expect(container.querySelectorAll('input#lb-new-token-name')).toHaveLength(1)
    expect(document.activeElement).toBe(campo)
    expect(campo?.value).toBe('Goblin')
  })

  it('o campo aberto não depende da seleção: trocar o que está selecionado não apaga o nome digitado', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: selecao(null) }))
    act(() => maisToken()?.click())
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    act(() => {
      setter?.call(campoNovoToken(), 'Goblin')
      campoNovoToken()?.dispatchEvent(new Event('input', { bubbles: true }))
    })
    renderPainel(painelDaFicha())
    expect(campoNovoToken()?.value).toBe('Goblin')
    expect(corpo()?.children[1]?.contains(campoNovoToken())).toBe(true)
  })

  it('"Levar ao piso" saiu da coluna: só aparece no menu "Mais ações", e leva a seleção', () => {
    const onLevar = vi.fn<(piso: number) => void>()
    renderPainel(painelDaFicha({ pisos: pisosNoTerreo(onLevar) }))
    expect(botoesComTexto(/^Levar ao/)).toHaveLength(0)

    act(() => container.querySelector<HTMLButtonElement>('button[aria-label="Mais ações"]')?.click())
    const itens = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    expect(itens.map((item) => item.textContent)).toEqual(['Levar ao 1º piso', 'Levar ao 1º subsolo'])
    act(() => itens[0]?.click())
    expect(onLevar).toHaveBeenCalledWith(1)
  })

  it('sem a ligação de pisos (mapa sem aventura montada), o "Mais ações" não aparece', () => {
    renderPainel(painelDaFicha({ pisos: undefined }))
    expect(container.querySelector('button[aria-label="Mais ações"]')).toBeNull()
    expect(botoesComTexto(/^Apagar token selecionado$/)).toHaveLength(1)
  })

  it('ficha: Travado e Oculto logo depois de Condições, Rotação no Avançado da mesma seção; Chão do mapa e Camadas saem, o Acervo fica por último', () => {
    renderPainel(painelDaFicha())
    const lista = titulos()
    // Condições é uma linha "+" sem título (peça ficha-em-ordem-de-tarefa): a
    // âncora é o bloco dela, e o bloco seguinte é o da transformação, com o
    // título que não repete o "Token" do Nome (peça ux-ficha-grupos).
    const condicoes = container.querySelector('.lb-inspector__body [aria-label="Condições da ficha"]')?.closest('section')
    expect(condicoes).toBeTruthy()
    const transformacao = condicoes?.nextElementSibling
    expect(transformacao?.querySelector('h2')?.textContent).toBe('Trava e visibilidade')
    expect(antes(container.querySelector('.lb-inspector__body h2'), condicoes)).toBe(true)
    const interruptores = Array.from(transformacao?.querySelectorAll(':scope > label.lb-switch') ?? []).map((l) => (l.textContent ?? '').trim())
    expect(interruptores).toEqual(['Travado', 'Oculto para jogadores'])
    // Rotação e "Oculto no editor", raros numa ficha, no Avançado recolhido da própria seção.
    const avancado = transformacao?.querySelector('h3 > button')
    expect(avancado?.textContent).toBe('Avançado')
    expect(avancado?.getAttribute('aria-expanded')).toBe('false')
    const recolhido = document.getElementById(avancado?.getAttribute('aria-controls') ?? 'sem-id')
    expect(recolhido?.textContent).toContain('Rotação')
    expect(recolhido?.textContent).toContain('Oculto no editor')
    // "Ficha de jogador" foi para junto de "Ficha de NPC", fora dos gestos de mesa.
    expect(transformacao?.textContent).not.toContain('Ficha de jogador')
    const rotulo = (texto: string) => Array.from(container.querySelectorAll('label')).find((l) => (l.textContent ?? '').includes(texto))
    expect(antes(rotulo('Ficha de NPC'), rotulo('Ficha de jogador'))).toBe(true)

    // Um item só, sem lote: não há seção "Seleção" entre o item e o mapa inteiro.
    expect(lista).not.toContain('Seleção')
    // Com um item selecionado o painel é do item: nada do mapa inteiro.
    expect(lista).not.toContain('Chão do mapa')
    expect(lista).not.toContain('Camadas')
    expect(lista).not.toContain('Território')
    expect(lista.at(-1)).toBe('Acervo de tokens')
  })

  it('sala: Travado e Oculto para jogadores num bloco só, logo depois do bloco Sala; depois Região, Preenchimento, Gatilho, Perigo e o Avançado', () => {
    const onSecretChange = vi.fn<(secret: boolean) => void>()
    renderPainel(painelDaSala({ playerSecret: { secret: false, onSecretChange } }))
    const lista = titulos()
    expect(lista.slice(0, 4)).toEqual(['Sala', 'Sala', 'Região', 'Preenchimento'])
    // Na região o "Oculto para jogadores" não traz mais nada: sem o bloco "Jogadores" à parte.
    expect(lista).not.toContain('Jogadores')
    const h2 = Array.from(container.querySelectorAll('.lb-inspector__body h2'))
    const travado = h2[1]?.closest('section')
    const interruptores = Array.from(travado?.querySelectorAll('label.lb-switch') ?? []).map((l) => (l.textContent ?? '').trim())
    expect(interruptores).toEqual(['Travado', 'Oculto para jogadores'])
    // Um "Oculto para jogadores" só no painel, e é ele que grava o segredo.
    const ocultos = Array.from(container.querySelectorAll('label.lb-switch')).filter((l) => (l.textContent ?? '').includes('Oculto para jogadores'))
    expect(ocultos).toHaveLength(1)
    act(() => ocultos[0]?.querySelector('input')?.click())
    expect(onSecretChange).toHaveBeenCalledWith(true)

    const preenchimento = h2[3]
    const gatilho = container.querySelector('[role="radiogroup"][aria-label="Gatilho da área"]')
    const perigo = h2.find((h) => h.textContent === 'Perigo')
    const avancado = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.includes('Avançado'))
    expect(antes(preenchimento, gatilho)).toBe(true)
    expect(antes(gatilho, perigo)).toBe(true)
    expect(antes(perigo, avancado)).toBe(true)
    // Pedido 03/10/2026: a Sala selecionada não mostra o chão do MAPA.
    expect(h2.find((h) => h.textContent === 'Chão do mapa')).toBeUndefined()
    expect(h2.find((h) => h.textContent === 'Camadas')).toBeUndefined()
    expect(container.querySelector('input[type="color"][aria-label*="chão" i]')).toBeNull()

    const faixa = corpo()?.firstElementChild
    expect(faixa?.textContent).toContain('Salao')
    expect(faixa?.textContent).toContain('Sala')
    expect(botoesComTexto(/^Apagar região selecionada$/)).toHaveLength(1)
  })

  it('peça do chão selecionada: sem "Chão do mapa" nem Camadas, mas "Camadas do chão" (das peças) fica; nada selecionado mostra os dois', () => {
    const peca: FloorPiece = { id: 'p1', shape: { kind: 'rect', cx: 100, cy: 100, w: 64, h: 64 }, op: 'add', modifiers: {} }
    const floorLayers = {
      floor: [peca],
      floorFillColor: '#888888',
      selectedPieceId: 'p1',
      onSelect: nada,
      onToggleLock: nada,
      onColorChange: nada,
      onReorder: nada,
    }
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { floorPiece: true }),
        selectedFloorPiece: peca,
        selection: selecao({ kind: 'floor', count: 1 }),
        floorLayers,
      }),
    )
    expect(titulos()).not.toContain('Chão do mapa')
    expect(titulos()).not.toContain('Camadas')
    expect(titulos()).toContain('Camadas do chão')

    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), floorLayers: { ...floorLayers, selectedPieceId: null } }))
    expect(titulos()).toContain('Chão do mapa')
    expect(titulos()).toContain('Camadas do chão')
    expect(titulos()).toContain('Camadas')
  })

  it('fora da região (texto, escada, pino), o "Jogadores" continua no bloco dele', () => {
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { textLabel: true }),
        selectedTextLabel: { id: 'placa', kind: 'text', x: 0, y: 0, text: 'Cuidado', color: '#ffffff', fontSize: 16 },
        selection: selecao({ kind: 'drawing', count: 1 }),
        playerSecret: { secret: false, onSecretChange: nada },
      }),
    )
    const jogadores = Array.from(container.querySelectorAll('.lb-inspector__body h2')).find((h) => h.textContent === 'Jogadores')
    expect(jogadores?.closest('section')?.textContent).toContain('Oculto para jogadores')
    expect(corpo()?.firstElementChild?.textContent).toContain('Cuidado')
  })

  it('porta: Porta e Tipo de porta antes de Parede; parede lisa continua Parede antes de Porta', () => {
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { wall: true, wallHasDoor: true }),
        selectedWall: PORTA,
        selection: selecao({ kind: 'wall', count: 1 }),
      }),
    )
    expect(titulos().slice(0, 3)).toEqual(['Porta', 'Tipo de porta', 'Parede'])
    expect(corpo()?.firstElementChild?.textContent).toContain('Porta')
    expect(botoesComTexto(/^Apagar parede selecionada$/)).toHaveLength(1)

    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select', { wall: true, wallHasDoor: false }),
        selectedWall: PAREDE,
        selection: selecao({ kind: 'wall', count: 1 }),
      }),
    )
    expect(titulos().slice(0, 2)).toEqual(['Parede', 'Porta'])
  })

  it('vários itens: a faixa conta quantos e apaga todos de uma vez', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: selecao({ kind: 'token', count: 3 }) }))
    const faixa = corpo()?.firstElementChild
    expect(faixa?.textContent).toContain('3 itens')
    expect(botoesComTexto(/^Apagar 3 itens selecionados$/)).toHaveLength(1)
  })

  it('vários itens com o "Oculto para jogadores" em lote: a seção "Seleção" volta, só com ele', () => {
    renderPainel(
      propsDoPainel(null, {
        groups: relevantPropertyGroups('select'),
        selection: { ...selecao({ kind: 'token', count: 3 }), secret: { state: 'mixed', count: 3, onChange: nada } },
      }),
    )
    const selecaoH2 = Array.from(container.querySelectorAll('.lb-inspector__body h2')).find((h) => h.textContent === 'Seleção')
    expect(selecaoH2?.closest('section')?.textContent).toContain('Oculto para jogadores (3)')
    expect(selecaoH2?.closest('section')?.querySelectorAll('button')).toHaveLength(0)
  })

  it('nada selecionado: a faixa vazia ocupa o topo do corpo, só com "Nada selecionado" desabilitado; o "+ Token" fica no cabeçalho', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: selecao(null) }))
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
    const faixa = corpo()?.firstElementChild
    expect(faixa?.classList.contains('lb-semsel')).toBe(true)
    // O texto exato, o papel de botão e o desabilitado são o contrato das jornadas (clique no vazio).
    const nadaSel = botoesComTexto(/Nada selecionado/)
    expect(nadaSel).toHaveLength(1)
    expect(nadaSel[0]?.textContent).toBe('Nada selecionado')
    expect(nadaSel[0]?.disabled).toBe(true)
    expect(faixa?.contains(nadaSel[0] ?? null)).toBe(true)
    expect(faixa?.querySelectorAll('button')).toHaveLength(1)
    // O "+ Token" no mesmo lugar de quando há seleção — e um só no painel (o Acervo não repete).
    const adicionar = botoesComNome(/adicionar token/i)
    expect(adicionar).toHaveLength(1)
    expect(cabecalho()?.contains(adicionar[0] ?? null)).toBe(true)
    expect(titulos()).not.toContain('Seleção')
    expect(botoesComTexto(/Apagar/)).toHaveLength(0)
  })

  it('"+ Token" sem seleção: o campo abre logo abaixo da faixa vazia, e Enter cria com o nome sugerido', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: { ...selecao(null), onAddToken } }))
    act(() => maisToken()?.click())
    const campo = campoNovoToken()
    expect(campo?.value).toBe('Token 1')
    expect(document.activeElement).toBe(campo)
    // Logo abaixo da faixa, antes do resto da coluna.
    expect(corpo()?.children[1]?.contains(campo)).toBe(true)
    act(() => campo?.form?.requestSubmit())
    expect(onAddToken).toHaveBeenCalledWith('Token 1')
    expect(document.activeElement).toBe(maisToken())
  })

  it('"+ Token": Esc fecha o campo sem criar, não mexe na coluna, e o foco volta ao "+ Token"', () => {
    const onAddToken = vi.fn<(nome: string) => void>()
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select'), selection: { ...selecao(null), onAddToken } }))
    const rolagem = rolarCorpo(120)
    act(() => maisToken()?.click())
    act(() => {
      document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    })
    expect(campoNovoToken()).toBeNull()
    expect(onAddToken).not.toHaveBeenCalled()
    expect(rolagem.valor()).toBe(120)
    expect(document.activeElement).toBe(maisToken())
  })

  it('ferramenta armada sem seleção: a faixa vazia no topo, e o primeiro título continua o da ferramenta', () => {
    renderPainel(propsDoPainel(null, { activeTool: 'room', groups: relevantPropertyGroups('room'), selection: selecao(null) }))
    expect(container.querySelector('[role="toolbar"]')).toBeNull()
    expect(corpo()?.firstElementChild?.classList.contains('lb-semsel')).toBe(true)
    expect(botoesComTexto(/^Nada selecionado$/)).toHaveLength(1)
    expect(titulos()[0]).toBe('Ferramenta · Sala')
  })

  it('pino selecionado (fora do resumo da seleção): a faixa não diz "Nada selecionado", e o "+ Token" continua no cabeçalho', () => {
    renderPainel(propsDoPainel(null, { groups: relevantPropertyGroups('select', { pin: true }), selection: selecao(null), pinSelected: true }))
    expect(botoesComTexto(/Nada selecionado/)).toHaveLength(0)
    expect(container.querySelector('.lb-semsel')).toBeNull()
    const adicionar = botoesComNome(/adicionar token/i)
    expect(adicionar).toHaveLength(1)
    expect(cabecalho()?.contains(adicionar[0] ?? null)).toBe(true)
  })
})

/** Um CSS como está no disco, relativo a esta pasta (o mesmo jeito de `PropertiesPanel.botoes.test.ts`). */
async function lerCss(relativo: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), relativo), 'utf8')
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
  return new Map()
}

describe('PropertiesPanel.css — o "+ Token" no cabeçalho', () => {
  it('encosta na engrenagem pela direita, com o alvo de 36 px dela; a engrenagem perde o empurrão que a levava à ponta', async () => {
    const css = await lerCss('./PropertiesPanel.css')
    const mais = regra(css, '.lb-inspector__head > .lb-mais')
    expect(mais.get('margin-left')).toBe('auto')
    expect(mais.get('min-height')).toBe('36px')
    // main.css dá `margin-left: auto` à engrenagem (0,1,0); com duas margens
    // automáticas o "+ Token" ficaria boiando no meio do cabeçalho.
    expect(regra(css, '.lb-inspector__head > .lb-mais + .lb-inspector__settings').get('margin-left')).toBe('0')
  })
})
