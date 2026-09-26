import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RoomControls, type RoomControlsProps } from './RoomControls'

/**
 * O BLOCO DA SALA NA ORDEM DA TAREFA (painel de propriedades do Figma UI3):
 * Nome → Largura | Altura numa linha → Rotação → interruptores → o que se
 * acrescenta, cada opcional vazio numa linha só com "+" que abre o campo de
 * verdade já com o foco nele. Com valor, o campo nasce aberto.
 */

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

/** A sala como o App monta: todos os opcionais ligados, todos vazios. */
function props(overrides: Partial<RoomControlsProps> = {}): RoomControlsProps {
  return {
    name: 'Salao',
    onNameChange: vi.fn(),
    shape: 'rect',
    axisAligned: true,
    width: 260,
    height: 240,
    onWidthChange: vi.fn(),
    onHeightChange: vi.fn(),
    rotation: 0,
    onRotationChange: vi.fn(),
    onRotateBy: vi.fn(),
    locked: false,
    nameHiddenFromPlayers: false,
    onNameHiddenFromPlayersChange: vi.fn(),
    roof: false,
    onRoofChange: vi.fn(),
    comodo: false,
    onComodoChange: vi.fn(),
    dark: false,
    onDarkChange: vi.fn(),
    textoAoEntrar: '',
    onTextoAoEntrarChange: vi.fn(),
    notaDoMestre: '',
    onNotaDoMestreChange: vi.fn(),
    faccao: '',
    onFaccaoChange: vi.fn(),
    raioDeVisao: null,
    onRaioDeVisaoChange: vi.fn(),
    hazard: { kind: null, roomCount: 1, canAdvance: false, onKindChange: vi.fn(), onAdvance: vi.fn() },
    conveyor: { direction: null, stepCells: 3, canAdvance: false, onChange: vi.fn(), onAdvance: vi.fn() },
    onAddMobilia: vi.fn(),
    onCreateRoomInside: vi.fn(),
    ...overrides,
  }
}

function render(p: RoomControlsProps, key = 'salao'): RoomControlsProps {
  act(() => root.render(<RoomControls key={key} {...p} />))
  return p
}

/** Os opcionais, na ordem em que o mestre os lê. */
const OPCIONAIS = ['Ao entrar, o jogador lê', 'Nota do mestre', 'Facção', 'Raio de visão aqui', 'Perigo', 'Esteira', 'Mobília'] as const

/** A linha "+" de um opcional recolhido (o botão cujo texto é o nome do campo). */
function linha(rotulo: string): HTMLButtonElement | null {
  const achada = [...container.querySelectorAll('button')].find((b) => b.textContent === rotulo)
  return achada ?? null
}

function linhaObrigatoria(rotulo: string): HTMLButtonElement {
  const achada = linha(rotulo)
  if (achada === null) throw new Error(`o bloco da Sala não tem a linha "+" de "${rotulo}"`)
  return achada
}

/** O corpo que a linha controla (`aria-controls`), onde mora o campo de verdade. */
function corpoDe(botao: HTMLButtonElement): HTMLElement {
  const corpo = document.getElementById(botao.getAttribute('aria-controls') ?? '')
  if (corpo === null) throw new Error(`a linha "${botao.textContent}" não aponta para o campo que abre`)
  return corpo
}

/** Campo pelo rótulo que o mestre lê, como as jornadas procuram. */
function campo(rotulo: string): HTMLElement {
  const label = [...container.querySelectorAll('label')].find((l) => l.textContent?.trim() === rotulo)
  const alvo = label ? document.getElementById(label.htmlFor) : null
  if (alvo === null) throw new Error(`o bloco da Sala não tem o campo "${rotulo}"`)
  return alvo
}

function interruptor(rotulo: string): HTMLInputElement {
  const label = [...container.querySelectorAll('label.lb-switch')].find((l) => l.textContent?.trim() === rotulo)
  const input = label?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`o bloco da Sala não tem o interruptor "${rotulo}"`)
  return input
}

/** `a` vem antes de `b` na ordem do documento (a ordem de leitura e de Tab). */
function antes(a: Element, b: Element): boolean {
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
}

describe('RoomControls: a sala na ordem da tarefa', () => {
  it('Nome, Largura | Altura, Rotação, os quatro interruptores e, por último, o que se acrescenta', () => {
    render(props())
    const ordem: Element[] = [
      campo('Nome'),
      campo('Largura'),
      campo('Altura'),
      campo('Rotação'),
      interruptor('Jogadores veem o nome'),
      interruptor('Teto fechado para jogadores'),
      interruptor('Cômodo: aparece só depois de visto'),
      interruptor('Sala escura'),
      ...OPCIONAIS.map(linhaObrigatoria),
      linhaObrigatoria('Criar sala dentro'),
    ]
    ordem.slice(1).forEach((el, i) => {
      expect(antes(ordem[i] as Element, el), `fora de ordem: ${i} → ${i + 1}`).toBe(true)
    })
  })

  it('Largura e Altura moram no MESMO par, numa linha; Rotação, −90° e +90° dividem a linha seguinte', () => {
    render(props())
    const parDaLargura = campo('Largura').closest('.lb-room-dims')
    expect(parDaLargura).not.toBeNull()
    expect(campo('Altura').closest('.lb-room-dims')).toBe(parDaLargura)
    const linhaDaRotacao = campo('Rotação').closest('.lb-rotation')
    const botoes = [...(linhaDaRotacao?.querySelectorAll('button') ?? [])].map((b) => b.textContent)
    expect(botoes).toEqual(['−90°', '+90°'])
  })

  it('cada frase fica colada no interruptor dela, ligada por aria-describedby', () => {
    render(props())
    for (const rotulo of ['Teto fechado para jogadores', 'Cômodo: aparece só depois de visto', 'Sala escura']) {
      const input = interruptor(rotulo)
      const dica = document.getElementById(input.getAttribute('aria-describedby') ?? '')
      expect(dica?.classList.contains('lb-field__hint'), rotulo).toBe(true)
      expect(input.closest('label')?.nextElementSibling, rotulo).toBe(dica)
    }
  })
})

describe('RoomControls: opcional vazio = uma linha com "+"', () => {
  it('cada opcional vazio é um botão recolhido, com o nome do campo, que controla o campo escondido', () => {
    render(props())
    for (const rotulo of OPCIONAIS) {
      const botao = linhaObrigatoria(rotulo)
      expect(botao.type, rotulo).toBe('button')
      expect(botao.getAttribute('aria-expanded'), rotulo).toBe('false')
      // O "+" é desenho: quem dá nome à linha é o texto dela.
      expect(botao.querySelector('svg')?.closest('[aria-hidden="true"]'), rotulo).not.toBeNull()
      const corpo = corpoDe(botao)
      expect(corpo.hidden, rotulo).toBe(true)
      expect(corpo.textContent, rotulo).toContain(rotulo)
    }
  })

  it('clicar no "+" abre o campo de verdade, já com o foco, e a linha sai; digitar grava', () => {
    const p = render(props())
    const botao = linhaObrigatoria('Nota do mestre')
    const corpo = corpoDe(botao)
    act(() => botao.click())
    expect(corpo.hidden).toBe(false)
    expect(linha('Nota do mestre')).toBeNull()
    const nota = campo('Nota do mestre')
    expect(document.activeElement).toBe(nota)

    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
    act(() => {
      setter?.call(nota, 'Mímico na panela.')
      nota.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(p.onNotaDoMestreChange).toHaveBeenLastCalledWith('Mímico na panela.')
  })

  it('o foco vai para o controle de cada campo: caixa de texto, número, o perigo marcado, o primeiro móvel', () => {
    render(props())
    act(() => linhaObrigatoria('Ao entrar, o jogador lê').click())
    expect(document.activeElement).toBe(campo('Ao entrar, o jogador lê'))
    act(() => linhaObrigatoria('Facção').click())
    expect(document.activeElement).toBe(campo('Facção'))
    act(() => linhaObrigatoria('Raio de visão aqui').click())
    expect(document.activeElement).toBe(campo('Raio de visão aqui'))
    act(() => linhaObrigatoria('Perigo').click())
    expect(document.activeElement?.getAttribute('role')).toBe('radio')
    expect(document.activeElement?.textContent).toBe('Nenhum')
    act(() => linhaObrigatoria('Esteira').click())
    expect(document.activeElement?.getAttribute('role')).toBe('radio')
    expect(document.activeElement?.textContent).toBe('Nenhuma')
    expect(document.activeElement?.closest('[role="radiogroup"]')?.getAttribute('aria-label')).toBe('Esteira na sala')
    act(() => linhaObrigatoria('Mobília').click())
    expect(document.activeElement?.textContent).toBe('Catre')
    expect(document.activeElement?.closest('[role="group"]')?.getAttribute('aria-label')).toBe('Pôr mobília na sala')
  })

  it('campo com valor nasce aberto, sem a linha "+"; a mobília (ação, não valor) continua recolhida', () => {
    render(
      props({
        textoAoEntrar: 'Cheiro de pão.',
        notaDoMestre: 'Mímico na panela.',
        faccao: 'Guarda Carmesim',
        raioDeVisao: 700,
        hazard: { kind: 'fogo', roomCount: 1, canAdvance: true, onKindChange: vi.fn(), onAdvance: vi.fn() },
        conveyor: { direction: 'leste', stepCells: 2, canAdvance: true, onChange: vi.fn(), onAdvance: vi.fn() },
      }),
    )
    for (const rotulo of ['Ao entrar, o jogador lê', 'Nota do mestre', 'Facção', 'Raio de visão aqui', 'Perigo', 'Esteira']) {
      expect(linha(rotulo), rotulo).toBeNull()
    }
    expect((campo('Ao entrar, o jogador lê') as HTMLTextAreaElement).value).toBe('Cheiro de pão.')
    expect(campo('Nota do mestre').closest('[hidden]')).toBeNull()
    expect((campo('Raio de visão aqui') as HTMLInputElement).value).toBe('700')
    const fogo = container.querySelector('[role="radiogroup"][aria-label="Perigo na sala"] [aria-checked="true"]')
    expect(fogo?.textContent).toBe('Fogo')
    expect(fogo?.closest('[hidden]')).toBeNull()
    // Esteira ligada: a direção marcada, o passo e o "Avançar esteiras" à mão, sem o "+".
    const leste = container.querySelector('[role="radiogroup"][aria-label="Esteira na sala"] [aria-checked="true"]')
    expect(leste?.textContent).toBe('Leste')
    expect(leste?.closest('[hidden]')).toBeNull()
    expect((campo('Passo (casas)') as HTMLSelectElement).value).toBe('2')
    const avancar = [...container.querySelectorAll('button')].find((b) => b.textContent === 'Avançar esteiras')
    expect(avancar?.closest('[hidden]')).toBeNull()
    expect(avancar?.disabled).toBe(false)
    expect(linha('Mobília')).not.toBeNull()
  })

  it('só espaço não conta como texto: a linha continua recolhida', () => {
    render(props({ textoAoEntrar: '   ', notaDoMestre: '\n' }))
    expect(linha('Ao entrar, o jogador lê')).not.toBeNull()
    expect(linha('Nota do mestre')).not.toBeNull()
  })

  it('facção herdada do distrito conta como valor: o campo nasce aberto e diz de quem herda', () => {
    render(props({ faccao: '', faccaoHerdada: 'Guarda Carmesim' }))
    expect(linha('Facção')).toBeNull()
    const faccao = campo('Facção') as HTMLInputElement
    expect(faccao.placeholder).toBe('Guarda Carmesim')
    expect(document.getElementById(faccao.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Herda do distrito: Guarda Carmesim')
  })

  it('valor que chega depois (um desfazer) abre o campo sem roubar o foco de onde ele está', () => {
    const p = props()
    render(p)
    const nome = campo('Nome')
    act(() => nome.focus())
    render({ ...p, notaDoMestre: 'Voltou com o Ctrl+Z.' })
    expect(linha('Nota do mestre')).toBeNull()
    expect(campo('Nota do mestre').closest('[hidden]')).toBeNull()
    expect(document.activeElement).toBe(nome)
  })

  it('esvaziar um campo aberto não o fecha debaixo do cursor: apagar o texto, "Nenhum" no perigo, "Nenhuma" na esteira', () => {
    const fogo = { kind: 'fogo', roomCount: 1, canAdvance: true, onKindChange: vi.fn(), onAdvance: vi.fn() } as const
    const esteira = { direction: 'sul', stepCells: 3, canAdvance: true, onChange: vi.fn(), onAdvance: vi.fn() } as const
    const p = props({ notaDoMestre: 'Mímico na panela.', hazard: fogo, conveyor: esteira })
    render(p)
    const nota = campo('Nota do mestre')
    act(() => nota.focus())
    // O mestre apagou o texto todo (a store devolve a nota vazia), o perigo voltou a
    // "Nenhum" e a esteira a "Nenhuma".
    render({ ...p, notaDoMestre: '', hazard: { ...fogo, kind: null }, conveyor: { ...esteira, direction: null } })
    expect(linha('Nota do mestre')).toBeNull()
    expect(campo('Nota do mestre')).toBe(nota)
    expect(nota.closest('[hidden]')).toBeNull()
    expect(document.activeElement).toBe(nota)
    expect(linha('Perigo')).toBeNull()
    const nenhum = container.querySelector('[role="radiogroup"][aria-label="Perigo na sala"] [aria-checked="true"]')
    expect(nenhum?.textContent).toBe('Nenhum')
    expect(nenhum?.closest('[hidden]')).toBeNull()
    expect(linha('Esteira')).toBeNull()
    const nenhuma = container.querySelector('[role="radiogroup"][aria-label="Esteira na sala"] [aria-checked="true"]')
    expect(nenhuma?.textContent).toBe('Nenhuma')
    expect(nenhuma?.closest('[hidden]')).toBeNull()
  })

  it('a esteira aberta pelo "+" liga de verdade: escolher a direção chama a store com o passo de sempre', () => {
    const p = render(props())
    act(() => linhaObrigatoria('Esteira').click())
    const norte = [...container.querySelectorAll('[role="radiogroup"][aria-label="Esteira na sala"] [role="radio"]')].find(
      (r) => r.textContent === 'Norte',
    )
    if (!(norte instanceof HTMLButtonElement)) throw new Error('a esteira aberta não oferece "Norte"')
    act(() => norte.click())
    expect(p.conveyor?.onChange).toHaveBeenCalledWith({ direction: 'norte', stepCells: 3 })
  })

  it('aberto pelo "+" e ainda vazio, fica aberto; outra sala no painel volta ao que está gravado', () => {
    const p = props()
    render(p)
    act(() => linhaObrigatoria('Facção').click())
    render(p)
    expect(linha('Facção')).toBeNull()
    // O painel remonta a cada sala (`key` em PropertiesPanel): a outra sala, vazia, nasce recolhida.
    render({ ...p, name: 'Cripta' }, 'cripta')
    expect(linha('Facção')).not.toBeNull()
  })

  it('a dica do campo continua no DOM, ligada ao campo e à linha "+" pelo mesmo id', () => {
    render(props())
    const casos: Array<[string, string]> = [
      ['Ao entrar, o jogador lê', 'Aparece só para quem entra'],
      ['Nota do mestre', 'Nunca vai para a tela dos jogadores'],
      ['Facção', 'Quem manda aqui'],
      ['Raio de visão aqui', 'Vazio usa o raio do jogador'],
    ]
    for (const [rotulo, trecho] of casos) {
      const idDaLinha = linhaObrigatoria(rotulo).getAttribute('aria-describedby')
      expect(idDaLinha, rotulo).toBeTruthy()
      expect(campo(rotulo).getAttribute('aria-describedby'), rotulo).toBe(idDaLinha)
      const dica = document.getElementById(idDaLinha ?? '')
      expect(dica?.classList.contains('lb-field__hint'), rotulo).toBe(true)
      expect(dica?.textContent, rotulo).toContain(trecho)
    }
  })

  it('"Criar sala dentro" é uma linha "+" que age na hora, com o nome de sempre', () => {
    const p = render(props())
    const criar = linhaObrigatoria('Criar sala dentro')
    expect(criar.hasAttribute('aria-expanded')).toBe(false)
    act(() => criar.click())
    expect(p.onCreateRoomInside).toHaveBeenCalledTimes(1)
  })

  it('sem nenhum opcional ligado, não sobra lista vazia nem linha "+"', () => {
    render(
      props({
        onTextoAoEntrarChange: undefined,
        onNotaDoMestreChange: undefined,
        onFaccaoChange: undefined,
        onRaioDeVisaoChange: undefined,
        hazard: undefined,
        conveyor: undefined,
        onAddMobilia: undefined,
        onCreateRoomInside: undefined,
      }),
    )
    expect(container.querySelector('.lb-room-extras')).toBeNull()
    expect(container.querySelector('.lb-room-opt__add')).toBeNull()
  })
})
