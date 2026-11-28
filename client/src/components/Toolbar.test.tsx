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
    wallAcabamento: { value: 'linhas', onChange: vi.fn() },
    wallMaterial: { value: 'castelo', onChange: vi.fn() },
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
    construcaoTipo: { value: 'torreDePedra', onChange: vi.fn() },
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
/** As partes do menu do Objeto, as mesmas da ficha da ferramenta (10/11/2026). */
const PARTES_DO_OBJETO = ['Sala e quarto', 'Cozinha', 'Banheiro', 'Armazenagem', 'Rua e jardim', 'Cemitério', 'Feira', 'Oficina', 'Fazenda', 'Destroços e sucata', 'Esporte e lazer', 'Porto e navio', 'Templo e masmorra', 'Sala de tortura', 'Magia e alquimia', 'Necrotério e laboratório', 'Tesouro', 'Castelo', 'Cerco e defesa', 'Base militar', 'Mar e piratas', 'Taverna e festa', 'Descanso e brincadeira', 'Cidade e vila']
/** Os objetos do menu do Objeto, nas partes, na ordem de leitura. */
const radiosDoObjeto = () => PARTES_DO_OBJETO.flatMap((parte) => radiosDe('Objeto', parte))

describe('Toolbar — grupos do protótipo consolidado (fatia 6)', () => {
  it('5 grupos com nome, na ordem: Escolher, Construir, Terreno, Esconder e revelar, Anotar', () => {
    render('select', 'brush')
    const grupos = Array.from(document.body.querySelectorAll('.lb-toolbar [role="group"]'))
    expect(grupos.map((g) => g.getAttribute('aria-label'))).toEqual(['Escolher', 'Construir', 'Terreno', 'Esconder e revelar', 'Anotar'])
    const nomes = grupos.map((g) => Array.from(g.querySelectorAll('.lb-ferr')).map((b) => b.getAttribute('aria-label')))
    expect(nomes).toEqual([
      ['Selecionar'],
      // 12/11/2026 (decisões do mestre): o Caminho saiu da barra (o Chão traça o caminho), a Construção
      // tem botão próprio colado no Objeto, a Água entra depois das Texturas e a Neblina virou Ambiente.
      ['Parede', 'Porta', 'Sala', 'Chão', 'Escada', 'Objeto', 'Construção', 'Luz'],
      // 16/11/2026 (Fase 6): o Ambiente virou Clima, e o Penhasco e o Barranco viraram um botão, o Desnível.
      ['Desnível', 'Texturas', 'Água', 'Carimbos', 'Clima'],
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

describe('Toolbar — botão Desnível (Barranco e Penhasco, Fase 6)', () => {
  it('um botão "Desnível" no lugar dos dois; o primeiro clique arma o Barranco', () => {
    const onSelectTool = render('select', 'brush')
    expect(buttonsNamed('Penhasco')).toHaveLength(0)
    expect(buttonsNamed('Barranco')).toHaveLength(0)
    act(() => botao('Desnível').click())
    expect(onSelectTool).toHaveBeenCalledWith('barranco')
  })

  it('o menu oferece as três caras; escolher Penhasco arma o Penhasco, e o botão fica marcado com ele', () => {
    const onSelectTool = render('barranco', 'brush')
    act(() => botao('Opções de Desnível').click())
    // 16/11/2026: a terceira cara, o Abismo (`lib/abismo.ts`).
    expect(radiosDe('Desnível', 'Cara').map((r) => r.getAttribute('aria-label'))).toEqual(['Barranco', 'Penhasco', 'Abismo'])
    act(() => radiosDe('Desnível', 'Cara').find((r) => r.getAttribute('aria-label') === 'Penhasco')?.click())
    expect(onSelectTool).toHaveBeenCalledWith('penhasco')
    render('penhasco', 'brush', onSelectTool)
    expect(botao('Desnível').getAttribute('aria-pressed')).toBe('true')
  })

  it('escolher Abismo arma o Abismo, e o botão fica marcado com ele', () => {
    const onSelectTool = render('barranco', 'brush')
    act(() => botao('Opções de Desnível').click())
    act(() => radiosDe('Desnível', 'Cara').find((r) => r.getAttribute('aria-label') === 'Abismo')?.click())
    expect(onSelectTool).toHaveBeenCalledWith('abismo')
    render('abismo', 'brush', onSelectTool)
    expect(botao('Desnível').getAttribute('aria-pressed')).toBe('true')
  })
})

describe('Toolbar — dica de ferramenta sem atalho', () => {
  // Sala livre, Caminho e Objetos nasceram sem letra (lib/keymap.ts). A dica dizia
  // "Sala: Sala livre ()": o parêntese vazio sugeria um atalho que não existe.
  it.each<[DrawingTool, string]>([
    ['roomFree', 'Sala'],
    // O Caminho saiu da barra em 12/11/2026; a Construção e a Água nasceram sem letra.
    ['mobilia', 'Objeto'],
    ['construcao', 'Construção'],
    ['agua', 'Água'],
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

  it('o cantinho abre "Opções de Objeto" com Colocar e os 371 objetos nas 24 partes da ficha (lib/mobilia/gruposDoObjeto.ts), cada um com o próprio desenho, e Mesa marcada', () => {
    render('select', 'brush')
    act(() => botao('Opções de Objeto').click())
    expect(gruposDoMenu('Objeto')).toEqual(['Colocar', ...PARTES_DO_OBJETO])
    expect(radiosDe('Objeto', 'Colocar').map((r) => r.getAttribute('aria-label'))).toEqual(['Móvel', 'Imagem'])
    const radios = radiosDoObjeto()
    // As mesmas partes da ficha da ferramenta (10/11/2026): a casa em Sala e quarto, Cozinha (e, desde 15/11/2026, Banheiro) e Armazenagem.
    // CONSTRUÇÕES (12/11/2026, decisão do mestre): as 19 construções (torres, moinho, mausoléu, poço, chafariz,
    // estátua, tendas...) saíram do Objeto para a ferramenta Construção (`lib/mobilia/construcoes.ts`): 176 - 19 = 157.
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Mesa', 'Cadeira', 'Mesa quadrada', 'Mesa redonda', 'Sofá', 'Poltrona', 'Cama', 'Aparador', 'Tapete', 'Tapete longo', 'Lareira', 'Estante de livros', 'Guarda-roupa',
      'Escrivaninha', 'Criado-mudo com vela', 'Cama de casal', 'Berço', 'Banqueta', 'Biombo', 'Piano', 'Candelabro de chão',
      // As referências (16/11/2026) entram no fim do grupo onde o mestre as procuraria: aqui, as duas da sala de jantar.
      'Cadeira de espaldar alto', 'Centro de mesa',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Sala e quarto: +9.
      'Catre desarrumado', 'Cama de caixotes', 'Mesa de caixote', 'Cadeira remendada', 'Cortina de passagem', 'Cadeira de plástico',
      'Mesa com computador', 'Vela no pires', 'Cama de trapos',
      // A Cozinha e o Banheiro se separaram em 15/11/2026, com as 12 peças do banheiro moderno.
      'Armário de cozinha', 'Balcão', 'Fogão', 'Geladeira', 'Pia', 'Pratos', 'Caldeirão', 'Forno de pão',
      'Prateleira de potes', 'Mesa de corte', 'Gancho com carne pendurada',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Cozinha: +1.
      'Fogareiro de ferro',
      'Privada', 'Vaso sanitário moderno', 'Bidê', 'Suporte de papel',
      'Banheira', 'Banheira moderna', 'Tina de madeira', 'Box de chuveiro', 'Tapete de banheiro', 'Toalheiro',
      'Lavatório com jarro', 'Gabinete de banheiro',
      'Armário de banheiro', 'Prateleira de frascos', 'Cesto de roupa', 'Lixeira de pedal',
      'Prateleira de toalhas',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Banheiro: +3.
      'Vaso com pia de aço', 'Chuveiro coletivo', 'Máquina de lavar',
      'Barril', 'Caixa', 'Baú', 'Sacos de grão', 'Prateleira de depósito',
      'Pilha de caixas', 'Barris deitados', 'Tonel de adega', 'Ânforas de barro', 'Cesto de vime', 'Cofre',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Armazenagem: +1.
      'Trouxa de roupa',
      // A natureza com carimbo (pedras e rochas, toco de árvore, árvore seca e a sebe) saiu para o Carimbo na Fase 6.
      'Cerca', 'Jardineira', 'Vaso de planta', 'Placa de seta', 'Lampião', 'Fogueira', 'Fogo', 'Muro de fogo', 'Ponte', 'Banco de praça',
      'Varal de roupa', 'Horta', 'Canteiro de flores', 'Muro baixo de pedra', 'Carrinho de mão', 'Placa de loja pendurada',
      'Deck de madeira',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Rua e jardim: +2.
      'Mesa de pátio', 'Cerca de alambrado',
      // A onda 3 (L07), no fim de Rua e jardim.
      'Banco de tronco',
      'Lápide', 'Cova', 'Caixão', 'Caixão aberto',
      'Cruz de madeira', 'Cerca de ferro', 'Pá cravada na terra', 'Velas e oferendas',
      'Túmulo de pedra', 'Lápide torta',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Cemitério: +10.
      'Sarcófago entreaberto', 'Sarcófago de bronze', 'Caixão de ferro', 'Laje tumular', 'Nicho funerário', 'Urna funerária',
      'Sarcófago de cristais', 'Relicário de cristal', 'Laje tumular acesa', 'Ossário',
      'Carroça', 'Quadro de avisos', 'Cata-vento de brinquedo', 'Banca de frutas', 'Toldo listrado',
      'Balança de mercador', 'Gaiola com aves', 'Rolos de tecido', 'Palco de bardo', 'Barril de peixe', 'Trenó',
      'Fornalha de ferreiro', 'Bigorna', 'Balde de água', 'Bancada de ferramentas', 'Pedra de amolar', 'Suporte de armas',
      'Fole', 'Manequim com armadura', 'Pilha de lingotes', 'Serra', 'Carrinho de mina', 'Trilho de mina', 'Escora de mina', 'Pilha de minério',
      'Troncos', 'Feno', 'Espantalho', 'Cocho',
      'Colmeia', 'Arado', 'Toco com machado cravado', 'Plantação em fileiras', 'Roda de carroça', 'Casinha de cachorro',
      'Destroços de madeira', 'Sucata de metal: chapas', 'Sucata de metal: engrenagens', 'Sucata de metal: tambores', 'Escombros de pedra', 'Ossos',
      'Carroça quebrada', 'Barril quebrado', 'Caixa quebrada', 'Viga caída', 'Armadura enferrujada', 'Armadura despedaçada', 'Crânio',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Destroços e sucata: +1.
      'Monte de entulho',
      'Campinho de futebol', 'Boneco de treino', 'Alvo de arco e flecha',
      'Mesa de jogo', 'Ringue de luta', 'Balanço', 'Mesa de sinuca',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Esporte e lazer: +2.
      'Armário de vestiário', 'Balaustrada de camarote',
      // Os quatro grupos novos de 11/11/2026: Porto e navio (o canhão e o lote 12), Templo e masmorra (o pilar, o
      // altar, a armadura do lote 15 e os dos lotes 13 e 16), Sala de tortura (o lote 14) e Magia e alquimia (os
      // três últimos do lote 13). E o Tesouro (12/11/2026), com os oito do lote 17 que não foram para um grupo antigo.
      'Canhão', 'Âncora', 'Cordas enroladas', 'Timão', 'Bote', 'Rede de pesca', 'Píer', 'Caixote de peixe',
      'Altar', 'Armadura',
      'Braseiro', 'Cela com grade', 'Corrente', 'Armadilha de espinhos', 'Círculo mágico',
      'Teia de aranha', 'Tocha de parede', 'Tocha de pé',
      'Coluna quebrada', 'Altar redondo', 'Laje de sacrifício', 'Alçapão',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Templo e masmorra: +32.
      'Cadeira de ferro', 'Mesa de ferro', 'Catre de ferro', 'Esteira de palha', 'Balde de dejetos', 'Grilhões de parede',
      'Bola de ferro com corrente', 'Latrina de cela', 'Banco de pedra', 'Mesa do carcereiro', 'Quadro de chaves', 'Jaula de chão',
      'Baú de ferro', 'Grade de corredor', 'Corpo amortalhado', 'Pertences confiscados', 'Pilar com braseiro', 'Lanterna gradeada de parede',
      'Selo de órbitas', 'Coluna lisa', 'Pilastra quadrada', 'Pedestal com cristal', 'Arandela de cristal', 'Braseiro de chama fria',
      'Selo de cristal', 'Muro em ruína', 'Pedestal entalhado', 'Coluna com glifos', 'Estela entalhada', 'Cabeça colossal',
      'Ídolo dourado', 'Mesinha de cela', 'Placa de pressão', 'Escada de mão', 'Corrente pendurada', 'Portão de jaula', 'Lâmina pendular',
      // A onda 3 (L09), no fim de Templo e masmorra.
      'Respiradouro vulcânico', 'Estaca com crânio', 'Pilar de ossos',
      'Potro de tortura', 'Dama de ferro', 'Tronco de prisioneiro', 'Gaiola suspensa', 'Cadeira de interrogatório', 'Mesa de instrumentos de tortura', 'Sangue no chão',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Sala de tortura: +10.
      'Ralo de masmorra', 'Tábua de pregos', 'Cepo do carrasco', 'Poste de açoite', 'Prancha de tortura', 'Braseiro com ferros de marcar',
      'Roda de tortura', 'Guilhotina', 'Guincho de corrente', 'Poço de sangue',
      'Estante de poções', 'Bola de cristal', 'Pedestal com livro aberto',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Magia e alquimia: +1.
      'Globo de luz rubra', 'Portal mágico',
      // O Necrotério e laboratório (16/11/2026), o lote L1 das referências.
      'Mesa de autópsia', 'Maca com lençol', 'Câmara frigorífica', 'Bandeja de instrumentos', 'Esterilizador', 'Panelas e bacias',
      'Mesa de laboratório', 'Luminária articulada', 'Cadeira giratória', 'Máquina de escrever',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Necrotério e laboratório: +1.
      'Leito hospitalar',
      'Barra de ouro', 'Monte de ouro', 'Moeda de ouro', 'Monte de moedas de ouro', 'Diamante', 'Monte de diamantes', 'Joia', 'Monte de joias',
      // Os grupos novos de 14/11/2026: Castelo (os lotes L01 e L02), Cerco e defesa (o L03 e a primeira metade do L04),
      // Base militar (a segunda metade do L04, o L05 e o L06), Mar e piratas (o L07 e o L08), Taverna e festa (o L09 e o
      // L10), Descanso e brincadeira (o L11, o L12 e o começo do L13) e Cidade e vila (o resto do L13, o L14 e a ponte
      // levadiça do L02 no fim, onde a lista do dia a pôs). 157 + 83 = 240.
      'Trono', 'Cama de dossel', 'Estandarte de pé', 'Tapeçaria de parede', 'Lustre de velas', 'Panóplia',
      'Mesa de banquete posta', 'Bancos de capela', 'Mesa de guerra', 'Poleiro de falcão', 'Aljavas e feixes de flechas',
      // A estátua de cavalo (21/11/2026), com e sem o pedestal, no fim do Castelo: 272 + 2 = 274.
      'Estátua de cavalo', 'Estátua de cavalo sem pedestal', 'Peça de xadrez gigante',
      'Catapulta', 'Balista', 'Aríete com teto', 'Escada de cerco', 'Cavalo de frisa', 'Pilha de balas de canhão', 'Tacho de óleo quente',
      'Sacos de areia', 'Caixas de munição', 'Ouriço antitanque',
      'Arame farpado em rolo', 'Barreira de concreto', 'Cancela listrada', 'Beliche', 'Armário de ferro', 'Rádio de campanha',
      'Holofote', 'Rede de camuflagem', 'Metralhadora no tripé', 'Paletes de madeira', 'Gerador', 'Mastro com bandeira',
      'Caracol-telefone', 'Caracol-câmera', 'Caracol-telefone dourado', 'Cartaz de procurado', 'Fruta de espirais', 'Bandeira pirata',
      'Mesa de navegação', 'Laranjeira em canteiro',
      'Prato de carne no osso', 'Prancha do navio', 'Esqueleto de peixe gigante', 'Navio na garrafa', 'Concha mágica', 'Lanterna de pedra japonesa',
      'Balcão de taverna', 'Alvo de dardos', 'Mesa de queda de braço', 'Varal de bandeirinhas', 'Varal de lanternas', 'Mastro de fitas',
      'Caixa de fogos de artifício', 'Barraca de jogos da feira', 'Barraca de comida com fogareiro', 'Churrasqueira', 'Harpa', 'Tambores',
      // A leva de 24/11/2026 (docs/design/objetos-24-11/LISTA.md), no fim de Taverna e festa: +1.
      'Banco corrido',
      'Rede de dormir', 'Guarda-sol com espreguiçadeira', 'Toalha de piquenique', 'Xadrez gigante de jardim', 'Boliche de grama', 'Gangorra',
      'Escorregador', 'Aquário', 'Ofurô', 'Telescópio', 'Globo terrestre', 'Pebolim',
      'Arquibancada de torneio', 'Liça de justa', 'Boneco de neve',
      'Poste de amarrar cavalos', 'Bueiro', 'Relógio de sol', 'Sino no suporte',
      'Tear', 'Roca de fiar', 'Lagar', 'Mó de pedra', 'Liteira', 'Ponte levadiça',
      'Elevador antigo', 'Carro antigo', 'Cano', 'Saída de esgoto', 'Comporta', 'Fonte de parede',
    ])
    const desenhos = radios.map((r) => r.querySelector('svg')?.innerHTML ?? '')
    expect(desenhos.every((svg) => svg !== '')).toBe(true)
    // 275 menos a natureza que foi para o Carimbo na Fase 6 (pedras e rochas, toco de árvore, árvore seca e a sebe),
    // mais a caixa quebrada (16/11/2026) e as duas estátuas de cavalo (21/11/2026): cada um com um desenho diferente.
    expect(new Set(desenhos).size).toBe(371)
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(radios.map((_, i) => (i === 0 ? 'true' : 'false')))
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
