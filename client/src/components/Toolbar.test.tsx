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
const PARTES_DO_OBJETO = ['Sala e quarto', 'Cozinha e banheiro', 'Armazenagem', 'Rua e jardim', 'Cemitério', 'Feira', 'Oficina', 'Fazenda', 'Destroços e sucata', 'Esporte e lazer', 'Porto e navio', 'Templo e masmorra', 'Sala de tortura', 'Magia e alquimia', 'Tesouro', 'Castelo', 'Cerco e defesa', 'Base militar', 'Mar e piratas', 'Taverna e festa']
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
      ['Penhasco', 'Barranco', 'Texturas', 'Água', 'Carimbos', 'Ambiente'],
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

  it('o cantinho abre "Opções de Objeto" com Colocar e os 211 objetos nas 20 partes da ficha (lib/mobilia/gruposDoObjeto.ts), cada um com o próprio desenho, e Mesa marcada', () => {
    render('select', 'brush')
    act(() => botao('Opções de Objeto').click())
    expect(gruposDoMenu('Objeto')).toEqual(['Colocar', ...PARTES_DO_OBJETO])
    expect(radiosDe('Objeto', 'Colocar').map((r) => r.getAttribute('aria-label'))).toEqual(['Móvel', 'Imagem'])
    const radios = radiosDoObjeto()
    // As mesmas partes da ficha da ferramenta (10/11/2026): a casa em Sala e quarto, Cozinha e banheiro e Armazenagem.
    // CONSTRUÇÕES (12/11/2026, decisão do mestre): as 19 construções (torres, moinho, mausoléu, poço, chafariz,
    // estátua, tendas...) saíram do Objeto para a ferramenta Construção (`lib/mobilia/construcoes.ts`): 176 - 19 = 157.
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual([
      'Mesa', 'Cadeira', 'Mesa quadrada', 'Mesa redonda', 'Sofá', 'Poltrona', 'Cama', 'Aparador', 'Tapete', 'Tapete longo', 'Lareira', 'Estante de livros', 'Guarda-roupa',
      'Escrivaninha', 'Criado-mudo com vela', 'Cama de casal', 'Berço', 'Banqueta', 'Biombo', 'Piano', 'Candelabro de chão',
      'Armário de cozinha', 'Balcão', 'Fogão', 'Geladeira', 'Pia', 'Pratos', 'Privada', 'Caldeirão', 'Forno de pão',
      'Banheira', 'Tina de madeira', 'Lavatório com jarro', 'Prateleira de potes', 'Mesa de corte', 'Gancho com carne pendurada',
      'Barril', 'Caixa', 'Baú', 'Sacos de grão', 'Prateleira de depósito',
      'Pilha de caixas', 'Barris deitados', 'Tonel de adega', 'Ânforas de barro', 'Cesto de vime', 'Cofre',
      'Cerca', 'Sebe', 'Jardineira', 'Vaso de planta', 'Placa de seta', 'Lampião', 'Fogueira', 'Fogo', 'Ponte', 'Banco de praça', 'Pedras e rochas',
      'Varal de roupa', 'Horta', 'Canteiro de flores', 'Muro baixo de pedra', 'Toco de árvore', 'Carrinho de mão', 'Placa de loja pendurada',
      'Lápide', 'Cova', 'Caixão', 'Caixão aberto',
      'Cruz de madeira', 'Cerca de ferro', 'Pá cravada na terra', 'Velas e oferendas', 'Árvore seca',
      'Carroça', 'Quadro de avisos', 'Cata-vento de brinquedo', 'Banca de frutas', 'Toldo listrado',
      'Balança de mercador', 'Gaiola com aves', 'Rolos de tecido', 'Palco de bardo', 'Barril de peixe',
      'Fornalha de ferreiro', 'Bigorna', 'Balde de água', 'Bancada de ferramentas', 'Pedra de amolar', 'Suporte de armas',
      'Fole', 'Manequim com armadura', 'Pilha de lingotes', 'Serra',
      'Troncos', 'Feno', 'Espantalho', 'Cocho',
      'Colmeia', 'Arado', 'Toco com machado cravado', 'Plantação em fileiras',
      'Destroços de madeira', 'Sucata de metal: chapas', 'Sucata de metal: engrenagens', 'Sucata de metal: tambores', 'Escombros de pedra', 'Ossos',
      'Carroça quebrada', 'Barril quebrado', 'Viga caída', 'Armadura enferrujada', 'Armadura despedaçada', 'Crânio',
      'Campinho de futebol', 'Boneco de treino', 'Alvo de arco e flecha',
      'Mesa de jogo', 'Ringue de luta', 'Balanço', 'Mesa de sinuca',
      // Os quatro grupos novos de 11/11/2026: Porto e navio (o canhão e o lote 12), Templo e masmorra (o pilar, o
      // altar, a armadura do lote 15 e os dos lotes 13 e 16), Sala de tortura (o lote 14) e Magia e alquimia (os
      // três últimos do lote 13). E o Tesouro (12/11/2026), com os oito do lote 17 que não foram para um grupo antigo.
      'Canhão', 'Âncora', 'Cordas enroladas', 'Timão', 'Bote', 'Rede de pesca', 'Píer', 'Caixote de peixe',
      'Altar', 'Armadura',
      'Braseiro', 'Cela com grade', 'Corrente', 'Armadilha de espinhos', 'Círculo mágico',
      'Teia de aranha', 'Tocha de parede', 'Tocha de pé',
      'Potro de tortura', 'Dama de ferro', 'Tronco de prisioneiro', 'Gaiola suspensa', 'Cadeira de interrogatório', 'Mesa de instrumentos de tortura', 'Sangue no chão',
      'Estante de poções', 'Bola de cristal', 'Pedestal com livro aberto',
      'Barra de ouro', 'Monte de ouro', 'Moeda de ouro', 'Monte de moedas de ouro', 'Diamante', 'Monte de diamantes', 'Joia', 'Monte de joias',
      // Os grupos novos de 14/11/2026: Castelo (os lotes L01 e L02, com a ponte levadiça no fim), Cerco e defesa (o L03
      // e a primeira metade do L04), Base militar (a segunda metade do L04, o L05 e o L06), Mar e piratas (o L07 e o
      // L08) e Taverna e festa (o L09). 157 + 54 = 211.
      'Trono', 'Cama de dossel', 'Estandarte de pé', 'Tapeçaria de parede', 'Lustre de velas', 'Panóplia',
      'Mesa de banquete posta', 'Bancos de capela', 'Mesa de guerra', 'Poleiro de falcão', 'Aljavas e feixes de flechas', 'Ponte levadiça',
      'Catapulta', 'Balista', 'Aríete com teto', 'Escada de cerco', 'Cavalo de frisa', 'Pilha de balas de canhão', 'Tacho de óleo quente',
      'Sacos de areia', 'Caixas de munição', 'Ouriço antitanque',
      'Arame farpado em rolo', 'Barreira de concreto', 'Cancela listrada', 'Beliche', 'Armário de ferro', 'Rádio de campanha',
      'Holofote', 'Rede de camuflagem', 'Metralhadora no tripé', 'Paletes de madeira', 'Gerador', 'Mastro com bandeira',
      'Caracol-telefone', 'Caracol-câmera', 'Caracol-telefone dourado', 'Cartaz de procurado', 'Fruta de espirais', 'Bandeira pirata',
      'Mesa de navegação', 'Laranjeira em canteiro',
      'Prato de carne no osso', 'Prancha do navio', 'Esqueleto de peixe gigante', 'Navio na garrafa', 'Concha mágica', 'Lanterna de pedra japonesa',
      'Balcão de taverna', 'Alvo de dardos', 'Mesa de queda de braço', 'Varal de bandeirinhas', 'Varal de lanternas', 'Mastro de fitas',
    ])
    const desenhos = radios.map((r) => r.querySelector('svg')?.innerHTML ?? '')
    expect(desenhos.every((svg) => svg !== '')).toBe(true)
    expect(new Set(desenhos).size).toBe(211)
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
