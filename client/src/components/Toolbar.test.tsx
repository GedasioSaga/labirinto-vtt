import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DrawingTool } from '../types/tools'
import { Toolbar } from './Toolbar'
import type { ToolVariantBindings } from './ToolVariantMenu'
import { TOOL_CLUSTERS, TOOL_LABELS } from './labels'

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

function bindings(activeTool: DrawingTool, onSelectTool: (tool: DrawingTool) => void): ToolVariantBindings {
  return {
    doorKind: { value: 'normal', onChange: vi.fn() },
    wallKind: { value: undefined, onChange: vi.fn() },
    wallFeitio: { value: 'pedra', onChange: vi.fn() },
    estiloDoMapa: { value: 'atual' },
    regionFillPattern: { value: 'solid', onChange: vi.fn() },
    polygonSides: { value: 6, onChange: vi.fn() },
    stairSizePreset: { value: 'medium', onChange: vi.fn() },
    drawTexture: { value: 'pen', onChange: vi.fn() },
    brushMode: { value: 'traco', onChange: vi.fn() },
    eraseMode: { value: 'objeto', onChange: vi.fn() },
    floorShapeKind: { value: 'rect', onChange: vi.fn() },
    floorOp: { value: 'add', onChange: vi.fn() },
    floorPolygonSides: { value: 6, onChange: vi.fn() },
  floorBrushSize: { value: 1, onChange: vi.fn() },
  floorCamada: { value: 'chao', onChange: vi.fn() },
    mobiliaTipo: { value: 'mesa', onChange: vi.fn() },
    roomFreeKind: { value: 'sala', onChange: vi.fn() },
    roomFreeRounded: { value: false, onChange: vi.fn() },
    drawShape: { value: activeTool, onChange: onSelectTool },
  }
}

function render(
  activeTool: DrawingTool,
  lastDrawingTool: DrawingTool,
  onSelectTool = vi.fn(),
  overrides: Partial<ToolVariantBindings> = {},
) {
  act(() =>
    root.render(
      <Toolbar
        activeTool={activeTool}
        onSelectTool={onSelectTool}
        lastDrawingTool={lastDrawingTool}
        variantBindings={{ ...bindings(activeTool, onSelectTool), ...overrides }}
      />,
    ),
  )
  return onSelectTool
}


const buttonsNamed = (name: string) =>
  Array.from(document.body.querySelectorAll<HTMLButtonElement>('button')).filter((b) => b.getAttribute('aria-label') === name)

const botao = (name: string) => {
  const [button] = buttonsNamed(name)
  if (!button) throw new Error(`botão ${name} ausente`)
  return button
}

const desenho = () => botao('Desenho')

/**
 * O balão do grimório de um botão da barra: o foco pelo teclado abre na hora
 * (no jsdom todo foco conta como de teclado). Devolve o texto e a tecla.
 */
function balaoDe(button: HTMLButtonElement): { texto: string; tecla: string | null } {
  // Um Tab antes do foco: depois de um clique, o jsdom deixa de contar o foco como de teclado.
  act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    button.focus()
  })
  const balao = document.body.querySelector('[role="tooltip"].gr-balao')
  const lido = { texto: balao?.querySelector('span')?.textContent ?? '', tecla: balao?.querySelector('kbd')?.textContent ?? null }
  act(() => button.blur())
  return lido
}

// O menu fechado ainda sai por 120 ms (`ComSaida`), inerte e com `gr-sai`: esse não conta como aberto.
const menu = (nome: string) => document.body.querySelector(`[role="group"][aria-label="Opções de ${nome}"]:not(.gr-sai)`)
const gruposDoMenu = (nome: string) =>
  Array.from(menu(nome)?.querySelectorAll('[role="radiogroup"]') ?? []).map((g) => g.getAttribute('aria-label'))
const radiosDe = (nome: string, grupo: string) =>
  Array.from(menu(nome)?.querySelectorAll<HTMLButtonElement>(`[role="radiogroup"][aria-label="${grupo}"] [role="radio"]`) ?? [])
/** Os objetos do menu do Objeto, nas 3 partes (MT5), na ordem de leitura. */
const radiosDoObjeto = () => ['Dentro de casa', 'Rua e jardim', 'Feira', 'Oficina', 'Fazenda'].flatMap((parte) => radiosDe('Objeto', parte))

describe('Toolbar — grupos do protótipo consolidado (fatia 6)', () => {
  it('5 grupos com nome, na ordem: Escolher, Construir, Terreno, Esconder e revelar, Anotar', () => {
    render('select', 'brush')
    const grupos = Array.from(document.body.querySelectorAll('.lb-toolbar [role="group"]'))
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['Escolher', 'Construir', 'Terreno', 'Esconder e revelar', 'Anotar'])
    const nomes = grupos.map((g) => Array.from(g.querySelectorAll('.lb-ferr')).map((b) => b.getAttribute('aria-label')))
    expect(nomes).toEqual([
      ['Selecionar'],
      ['Parede', 'Porta', 'Sala', 'Chão', 'Escada', 'Caminho', 'Objeto', 'Luz'],
      ['Penhasco', 'Barranco', 'Texturas', 'Carimbos'],
      ['Zona oculta', 'Pincel de revelar'],
      ['Desenho', 'Texto', 'Pino', 'Medir', 'Borracha'],
    ])
  })

  it('a placa de latão é uma só, decorativa, e só aparece depois de posta', () => {
    render('wall', 'brush')
    const placas = document.body.querySelectorAll('.lb-toolbar__placa')
    expect(placas).toHaveLength(1)
    expect(placas[0]?.getAttribute('aria-hidden')).toBe('true')
  })
})

describe('Toolbar — botão Desenho', () => {
  it('não existe botão com nome de forma, e existe 1 "Desenho" com 1 cantinho', () => {
    render('select', 'brush')
    for (const shape of TOOL_CLUSTERS.drawing.tools) {
      expect(buttonsNamed(TOOL_LABELS[shape] ?? shape), shape).toHaveLength(0)
    }
    expect(buttonsNamed('Desenho')).toHaveLength(1)
    expect(buttonsNamed('Opções de Desenho')).toHaveLength(1)
    // Token escondido (FEATURES.tokenTool) e Texto/Medir/Borracha continuam soltos.
    expect(buttonsNamed('Token')).toHaveLength(0)
    expect(buttonsNamed('Texto')).toHaveLength(1)
  })

  it('activeTool=line: aria-pressed e balão "Desenho: Linha" com a tecla L', () => {
    render('line', 'brush')
    expect(desenho().getAttribute('aria-pressed')).toBe('true')
    expect(balaoDe(desenho())).toEqual({ texto: 'Desenho: Linha', tecla: 'L' })
  })

  it('com Selecionar ativo e lastDrawingTool=rect, o botão não está pressionado e o clique ativa rect', () => {
    const onSelectTool = render('select', 'rect')
    expect(desenho().getAttribute('aria-pressed')).toBe('false')
    expect(balaoDe(desenho())).toEqual({ texto: 'Desenho: Retângulo', tecla: 'R' })
    act(() => desenho().click())
    expect(onSelectTool).toHaveBeenCalledWith('rect')
  })

  it('o cantinho abre "Opções de Desenho" com Forma (7, com ícone) e, no Pincel, Modo e Textura do traço', () => {
    render('brush', 'brush')
    act(() => botao('Opções de Desenho').click())
    expect(menu('Desenho')).not.toBeNull()
    expect(gruposDoMenu('Desenho')).toEqual(['Forma', 'Modo', 'Textura do traço'])
    const shapes = radiosDe('Desenho', 'Forma')
    expect(shapes.map((r) => r.getAttribute('aria-label'))).toEqual(['Pincel', 'Linha', 'Curva', 'Círculo', 'Elipse', 'Retângulo', 'Polígono'])
    expect(shapes.every((r) => r.querySelector('svg'))).toBe(true)
  })

  it('com a Linha, o menu só tem Forma; escolher Elipse ativa a ferramenta e fecha', () => {
    const onSelectTool = render('line', 'line')
    act(() => botao('Opções de Desenho').click())
    expect(gruposDoMenu('Desenho')).toEqual(['Forma'])
    act(() => radiosDe('Desenho', 'Forma').find((r) => r.getAttribute('aria-label') === 'Elipse')?.click())
    expect(onSelectTool).toHaveBeenCalledWith('ellipse')
    expect(menu('Desenho')).toBeNull()
  })

  it('a descrição da opção vai para aria-describedby, fora do nome acessível (D10)', () => {
    render('line', 'line')
    act(() => botao('Opções de Desenho').click())
    const line = document.body.querySelector<HTMLButtonElement>('[role="radio"][aria-label="Linha"]')
    const descId = line?.getAttribute('aria-describedby')
    expect(descId).toBeTruthy()
    expect(document.getElementById(descId ?? '')?.textContent).toBe('Reta entre dois pontos (L)')
  })
})

describe('Toolbar — botão Sala (as quatro salas e a Região)', () => {
  it('não existe botão com nome de forma de sala; existe 1 "Sala" com 1 cantinho', () => {
    render('select', 'brush')
    for (const shape of TOOL_CLUSTERS.sala.tools.filter((tool) => tool !== 'room')) {
      expect(buttonsNamed(TOOL_LABELS[shape] ?? shape), shape).toHaveLength(0)
    }
    expect(buttonsNamed('Sala')).toHaveLength(1)
    expect(buttonsNamed('Opções de Sala')).toHaveLength(1)
  })

  it('o menu tem Forma com os nomes curtos; escolher Circular arma a Sala Circular e fecha', () => {
    const onSelectTool = render('select', 'brush')
    act(() => botao('Opções de Sala').click())
    expect(gruposDoMenu('Sala')).toEqual(['Forma', 'Preenchimento', 'Desenho da parede'])
    expect(radiosDe('Sala', 'Forma').map((r) => r.getAttribute('aria-label'))).toEqual(['Retângulo', 'Circular', 'Polígono', 'Livre', 'Região'])
    act(() => radiosDe('Sala', 'Forma').find((r) => r.getAttribute('aria-label') === 'Circular')?.click())
    expect(onSelectTool).toHaveBeenCalledWith('roomCircle')
    expect(menu('Sala')).toBeNull()
  })

  it('a última forma usada (até pela tecla) é a que o clique no botão arma de novo', () => {
    const onSelectTool = render('roomPolygon', 'brush')
    expect(botao('Sala').getAttribute('aria-pressed')).toBe('true')
    render('select', 'brush', onSelectTool)
    expect(botao('Sala').getAttribute('aria-pressed')).toBe('false')
    act(() => botao('Sala').click())
    expect(onSelectTool).toHaveBeenCalledWith('roomPolygon')
  })

  it('com o Polígono, o menu traz também os lados; com a Região, o preenchimento', () => {
    render('roomPolygon', 'brush')
    act(() => botao('Opções de Sala').click())
    // "Desenho da parede" (pedra ou linha, 29/10) fecha o menu das salas que fazem parede.
    expect(gruposDoMenu('Sala')).toEqual(['Forma', 'Preenchimento', 'Lados do polígono', 'Desenho da parede'])
  })
})

describe('Toolbar — dica de ferramenta sem atalho', () => {
  // Sala livre, Caminho e Objetos nasceram sem letra (lib/keymap.ts). A dica dizia
  // "Sala: Sala livre ()": o parêntese vazio sugeria um atalho que não existe.
  it.each<[DrawingTool, string]>([
    ['roomFree', 'Sala'],
    ['path', 'Caminho'],
    ['mobilia', 'Objeto'],
  ])('%s: o balão não promete tecla', (tool, nomeDoBotao) => {
    render(tool, 'brush')
    const lido = balaoDe(botao(nomeDoBotao))
    expect(lido.texto).not.toContain('()')
    expect(lido.tecla).toBeNull()
  })

  it('ferramenta com atalho mostra a letra como tecla', () => {
    render('line', 'brush')
    expect(balaoDe(desenho()).tecla).toBe('L')
  })
})

describe('Toolbar — Sala livre: Parede e Arredondar', () => {
  it('com a Sala livre, o menu da Sala oferece Criar (Sala ou Parede) e Arredondar, acima do preenchimento', () => {
    render('roomFree', 'brush')
    act(() => botao('Opções de Sala').click())
    expect(gruposDoMenu('Sala')).toEqual(['Forma', 'Criar', 'Arredondar', 'Preenchimento', 'Desenho da parede'])
    expect(radiosDe('Sala', 'Criar').map((r) => r.getAttribute('aria-label'))).toEqual(['Sala', 'Parede'])
    expect(radiosDe('Sala', 'Arredondar').map((r) => r.getAttribute('aria-label'))).toEqual(['Desligado', 'Ligado'])
    // O padrão é o de hoje: Sala, cantos vivos.
    expect(radiosDe('Sala', 'Criar').map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    expect(radiosDe('Sala', 'Arredondar').map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
  })

  it('escolher Parede e ligar Arredondar escreve nas preferências e fecha o menu', () => {
    const roomFreeKind: ToolVariantBindings['roomFreeKind'] = { value: 'sala', onChange: vi.fn() }
    const roomFreeRounded: ToolVariantBindings['roomFreeRounded'] = { value: false, onChange: vi.fn() }
    render('roomFree', 'brush', vi.fn(), { roomFreeKind, roomFreeRounded })
    act(() => botao('Opções de Sala').click())
    act(() => radiosDe('Sala', 'Criar').find((r) => r.getAttribute('aria-label') === 'Parede')?.click())
    expect(roomFreeKind.onChange).toHaveBeenCalledWith('parede')
    expect(menu('Sala')).toBeNull()
    act(() => botao('Opções de Sala').click())
    act(() => radiosDe('Sala', 'Arredondar').find((r) => r.getAttribute('aria-label') === 'Ligado')?.click())
    expect(roomFreeRounded.onChange).toHaveBeenCalledWith(true)
  })

  it('no modo Parede, a dica ensina a traçar parede (linha aberta, 2 pontos), não sala', () => {
    render('roomFree', 'brush', vi.fn(), { roomFreeKind: { value: 'parede', onChange: vi.fn() } })
    const dica = document.body.querySelector('.lb-hint')?.textContent ?? ''
    expect(dica).toContain('parede')
    expect(dica).toContain('2 pontos')
    expect(dica).not.toContain('sala')
  })
})

describe('Toolbar — Objeto (o móvel desenhado e a imagem)', () => {
  it('1 botão "Objeto" com 1 cantinho, na construção; Objetos e Peça não são mais botões', () => {
    render('select', 'brush')
    expect(buttonsNamed('Objeto')).toHaveLength(1)
    expect(buttonsNamed('Opções de Objeto')).toHaveLength(1)
    expect(buttonsNamed('Objetos')).toHaveLength(0)
    expect(buttonsNamed('Peça')).toHaveLength(0)
    expect(botao('Objeto').closest('[role="group"]')?.getAttribute('aria-label')).toBe('Construir')
  })

  it('o cantinho abre "Opções de Objeto" com Colocar e os 40 objetos em 5 partes (Dentro de casa, Rua e jardim, Feira, Oficina, Fazenda), cada um com o próprio desenho, e Mesa marcada', () => {
    render('select', 'brush')
    act(() => botao('Opções de Objeto').click())
    expect(gruposDoMenu('Objeto')).toEqual(['Colocar', 'Dentro de casa', 'Rua e jardim', 'Feira', 'Oficina', 'Fazenda'])
    expect(radiosDe('Objeto', 'Colocar').map((r) => r.getAttribute('aria-label'))).toEqual(['Móvel', 'Imagem'])
    const radios = radiosDoObjeto()
    // Lidos em pares (a grade tem 2 colunas): Mesa ao lado da Cadeira, as mesas novas juntas, os dois tapetes juntos;
    // a casa de 28/10 (sofá, cozinha, privada) e a lareira em Dentro de casa; a oficina e a fazenda de 29/10 no fim.
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira', 'Mesa quadrada', 'Mesa redonda', 'Sofá', 'Poltrona', 'Armário de cozinha', 'Aparador',
      'Balcão', 'Pratos', 'Fogão', 'Geladeira', 'Pia', 'Privada', 'Tapete', 'Tapete longo', 'Lareira',
      'Cerca', 'Sebe', 'Jardineira', 'Vaso de planta', 'Arco do portão', 'Placa de seta', 'Poço', 'Lampião', 'Fogueira', 'Fogo', 'Lápide',
      'Barraca de feira', 'Carroça', 'Quadro de avisos',
      'Fornalha de ferreiro', 'Bigorna', 'Balde de água',
      'Troncos', 'Feno',
    ])
    const desenhos = radios.map((r) => r.querySelector('svg')?.innerHTML ?? '')
    expect(desenhos.every((svg) => svg !== '')).toBe(true)
    expect(new Set(desenhos).size).toBe(40)
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(radios.map((_, i) => (i === 4 ? 'true' : 'false')))
  })

  it('escolher Barril muda a preferência, fecha o menu, não troca de ferramenta, e a barra ecoa "Próximo objeto Barril"', () => {
    const mobiliaTipo: ToolVariantBindings['mobiliaTipo'] = { value: 'mesa', onChange: vi.fn() }
    const onSelectTool = render('select', 'brush', vi.fn(), { mobiliaTipo })
    act(() => botao('Opções de Objeto').click())
    act(() => radiosDoObjeto().find((r) => r.getAttribute('aria-label') === 'Barril')?.click())
    expect(mobiliaTipo.onChange).toHaveBeenCalledWith('barril')
    expect(menu('Objeto')).toBeNull()
    expect(onSelectTool).not.toHaveBeenCalled()
    // O App grava a escolha no mapStore e a barra re-renderiza com o valor novo.
    render('select', 'brush', onSelectTool, { mobiliaTipo: { value: 'barril', onChange: mobiliaTipo.onChange } })
    const balao = document.body.querySelector('.lb-hint')?.textContent ?? ''
    expect(balao).toContain('Próximo objeto')
    expect(balao).toContain('Barril')
  })

  it('o botão ativa o móvel; ativo, fica pressionado e a dica ensina o clique no mapa', () => {
    const onSelectTool = render('select', 'brush')
    act(() => botao('Objeto').click())
    expect(onSelectTool).toHaveBeenCalledWith('mobilia')
    render('mobilia', 'brush', onSelectTool)
    expect(botao('Objeto').getAttribute('aria-pressed')).toBe('true')
    expect(document.body.querySelector('.lb-hint')?.textContent).toContain('clique no mapa')
  })

  it('Imagem arma a Peça (B), e o botão passa a mostrar a Peça', () => {
    const onSelectTool = render('select', 'brush')
    act(() => botao('Opções de Objeto').click())
    act(() => radiosDe('Objeto', 'Colocar').find((r) => r.getAttribute('aria-label') === 'Imagem')?.click())
    expect(onSelectTool).toHaveBeenCalledWith('prop')
    render('prop', 'brush', onSelectTool)
    expect(balaoDe(botao('Objeto'))).toEqual({ texto: 'Objeto: Imagem', tecla: 'B' })
  })
})

describe('Toolbar — clique direito e segurar abrem as variantes', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('clique direito no botão abre o menu e arma a ferramenta', () => {
    const onSelectTool = render('select', 'brush')
    const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    act(() => botao('Porta').dispatchEvent(evento))
    expect(evento.defaultPrevented).toBe(true)
    expect(menu('Porta')).not.toBeNull()
    expect(onSelectTool).toHaveBeenCalledWith('door')
  })

  it('ferramenta sem variantes deixa o clique direito em paz', () => {
    render('select', 'brush')
    const evento = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    act(() => botao('Luz').dispatchEvent(evento))
    expect(evento.defaultPrevented).toBe(false)
  })

  it('segurar o botão abre o menu; soltar antes do tempo é só um clique', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    render('wall', 'brush')
    act(() => botao('Parede').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })))
    act(() => vi.advanceTimersByTime(300))
    act(() => botao('Parede').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' })))
    act(() => vi.advanceTimersByTime(600))
    expect(menu('Parede')).toBeNull()
    act(() => botao('Parede').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' })))
    act(() => vi.advanceTimersByTime(450))
    expect(menu('Parede')).not.toBeNull()
  })
})
