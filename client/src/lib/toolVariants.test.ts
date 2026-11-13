import { describe, expect, it } from 'vitest'
import {
  DRAWING_SHAPE_GROUP,
  OBJETO_KIND_GROUP,
  PARTE_COM_O_ATALHO_DA_ARVORE,
  PARTES_DO_MENU_DE_OBJETO,
  SALA_SHAPE_GROUP,
  clusterOptionLabel,
  clusterVariantGroups,
  drawingClusterGroups,
  readyToolVariants,
  TOOL_VARIANTS,
  toolHasVariantAxis,
  variantEcho,
  type ToolVariantGroup,
} from './toolVariants'
import { TOOL_SHORTCUTS } from './keymap'
import { DRAWING_TOOLS, TOOL_CLUSTERS } from '../components/labels'
import type { DrawingTool } from '../types/tools'

/** Toda ferramenta com variante — pronta ou não — precisa existir em
 *  `types/tools.ts` (DrawingTool), senão o catálogo referencia uma
 *  ferramenta que não existe mais na barra. */
const ALL_TOOLS: DrawingTool[] = [
  'select', 'wall', 'door', 'light', 'region', 'room', 'roomCircle', 'roomPolygon', 'roomFree',
  'stair', 'token', 'prop', 'brush', 'line', 'circle', 'ellipse', 'rect', 'polygon',
  'curve', 'text', 'measure', 'eraser', 'floor', 'mobilia',
  // Construção (12/11/2026): ferramenta própria, com o catálogo das 19 construções.
  'construcao',
]

describe('TOOL_VARIANTS', () => {
  it('só referencia ferramentas que existem em DrawingTool', () => {
    for (const key of Object.keys(TOOL_VARIANTS)) {
      expect(ALL_TOOLS).toContain(key)
    }
  })

  it('a chave do catálogo bate com o campo `tool` da própria entrada', () => {
    for (const [key, entry] of Object.entries(TOOL_VARIANTS)) {
      expect(entry?.tool).toBe(key)
    }
  })

  it('toda entrada pronta tem pelo menos 1 grupo, e todo grupo tem pelo menos 2 opções', () => {
    for (const entry of readyToolVariants()) {
      expect(entry.groups.length).toBeGreaterThan(0)
      for (const group of entry.groups) {
        expect(group.options.length).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('toda opção tem id, label, description e value não-vazios (nenhum item de menu mudo)', () => {
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        for (const option of group.options) {
          expect(option.id.length).toBeGreaterThan(0)
          expect(option.label.length).toBeGreaterThan(0)
          expect(option.description.length).toBeGreaterThan(0)
          expect(option.value).not.toBeUndefined()
          expect(option.value).not.toBeNull()
        }
      }
    }
  })

  it('ids de opção são únicos dentro do mesmo grupo (senão key do React colide)', () => {
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        const ids = group.options.map((o) => o.id)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('storeKey de cada grupo é um dos eixos confirmados (dossiê F4 + Fase 5)', () => {
    const validKeys: ToolVariantGroup['storeKey'][] = [
      'doorKind', 'wallKind', 'regionFillPattern', 'polygonSides',
      'stairSizePreset', 'drawTexture', 'brushMode', 'eraseMode',
      'floorShapeKind', 'floorOp', 'floorPolygonSides', 'floorBrushSize', 'floorCamada',
      'roomFreeKind', 'roomFreeRounded', 'mobiliaTipo', 'wallFeitio', 'wallAcabamento', 'wallMaterial',
      // Construção (12/11/2026): eixo próprio, separado do Objeto.
      'construcaoTipo',
    ]
    for (const entry of readyToolVariants()) {
      for (const group of entry.groups) {
        expect(validKeys).toContain(group.storeKey)
      }
    }
  })

  it('toda entrada indisponível documenta o pedido E o que falta, sem string vazia', () => {
    for (const entry of Object.values(TOOL_VARIANTS)) {
      if (!entry || entry.available) continue
      expect(entry.requested.length).toBeGreaterThan(0)
      expect(entry.missing.length).toBeGreaterThan(0)
    }
  })

  it('wall tem wallKind (interior/exterior), Só linhas ou Com textura, o Material e o Desenho da parede (pedra/linha)', () => {
    const entry = TOOL_VARIANTS.wall
    expect(entry?.available).toBe(true)
    if (!entry || !entry.available) throw new Error('wall deveria estar disponível')
    expect(entry.groups.map((g) => g.storeKey)).toEqual(['wallKind', 'wallAcabamento', 'wallMaterial', 'wallFeitio'])
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['exterior', 'interior'])
    // Só linhas primeiro: o padrão é a linha de sempre (regra do usuário de 07/11/2026).
    expect(entry.groups[1].options.map((o) => o.value)).toEqual(['linhas', 'textura'])
    expect(entry.groups[3].options.map((o) => o.value)).toEqual(['pedra', 'linha'])
    // As Salas e a Sala livre não oferecem a textura: as paredes delas nascem Só linhas.
    for (const tool of ['room', 'roomCircle', 'roomPolygon', 'roomFree'] as const) {
      const sala = TOOL_VARIANTS[tool]
      if (!sala || !sala.available) throw new Error(`${tool} deveria estar disponível`)
      expect(sala.groups.map((g) => g.storeKey)).not.toContain('wallAcabamento')
    }
  })

  it('door tem exatamente as 3 variantes de doorKind (normal/double/gate)', () => {
    const entry = TOOL_VARIANTS.door
    if (!entry || !entry.available) throw new Error('door deveria estar disponível')
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['normal', 'double', 'gate'])
  })

  it('region/room/roomCircle usam a MESMA lista de opções de fillPattern (mesma preferência de store)', () => {
    const region = TOOL_VARIANTS.region
    const room = TOOL_VARIANTS.room
    const roomCircle = TOOL_VARIANTS.roomCircle
    if (!region?.available || !room?.available || !roomCircle?.available) {
      throw new Error('region/room/roomCircle deveriam estar disponíveis')
    }
    expect(region.groups[0].options).toEqual(room.groups[0].options)
    expect(region.groups[0].options).toEqual(roomCircle.groups[0].options)
  })

  it('roomPolygon tem os DOIS eixos: preenchimento e lados', () => {
    const entry = TOOL_VARIANTS.roomPolygon
    if (!entry || !entry.available) throw new Error('roomPolygon deveria estar disponível')
    const storeKeys = entry.groups.map((g) => g.storeKey)
    expect(storeKeys).toContain('regionFillPattern')
    expect(storeKeys).toContain('polygonSides')
  })

  it('polygonSides do roomPolygon respeita o intervalo 3–12 do slider existente (PolygonSidesControls)', () => {
    const entry = TOOL_VARIANTS.roomPolygon
    if (!entry || !entry.available) throw new Error('roomPolygon deveria estar disponível')
    const sidesGroup = entry.groups.find((g) => g.storeKey === 'polygonSides')
    if (!sidesGroup) throw new Error('roomPolygon deveria ter grupo polygonSides')
    for (const option of sidesGroup.options) {
      expect(option.value).toBeGreaterThanOrEqual(3)
      expect(option.value).toBeLessThanOrEqual(12)
    }
  })

  it('roomFree tem os eixos Criar (sala ou parede) e Arredondar, além do preenchimento', () => {
    const entry = TOOL_VARIANTS.roomFree
    if (!entry || !entry.available) throw new Error('roomFree deveria estar disponível')
    expect(entry.groups.map((g) => g.storeKey)).toEqual(['roomFreeKind', 'roomFreeRounded', 'regionFillPattern', 'wallFeitio'])

    const criar = entry.groups.find((g) => g.storeKey === 'roomFreeKind')
    const arredondar = entry.groups.find((g) => g.storeKey === 'roomFreeRounded')
    expect(criar?.options.map((o) => o.value)).toEqual(['sala', 'parede'])
    expect(arredondar?.options.map((o) => o.value)).toEqual([false, true])
  })

  it('na Sala livre, o preenchimento fica esmaecido no modo Parede e diz por quê', () => {
    const entry = TOOL_VARIANTS.roomFree
    if (!entry || !entry.available) throw new Error('roomFree deveria estar disponível')
    const preenchimento = entry.groups.find((g) => g.storeKey === 'regionFillPattern')
    expect(preenchimento?.inativoQuando).toMatchObject({ storeKey: 'roomFreeKind', value: 'parede' })
    expect(preenchimento?.inativoQuando?.motivo.trim()).not.toBe('')
  })

  it('na Região e nas outras salas o preenchimento vale sempre', () => {
    for (const tool of ['region', 'room', 'roomCircle', 'roomPolygon'] as const) {
      const entry = TOOL_VARIANTS[tool]
      if (!entry || !entry.available) throw new Error(`${tool} deveria estar disponível`)
      const preenchimento = entry.groups.find((g) => g.storeKey === 'regionFillPattern')
      expect(preenchimento).toBeDefined()
      expect(preenchimento?.inativoQuando).toBeUndefined()
    }
  })

  it('line está marcada como indisponível (Linha/Curva é escolha de Forma no botão Desenho, sem eixo próprio)', () => {
    const entry = TOOL_VARIANTS.line
    expect(entry?.available).toBe(false)
  })

  it('readyToolVariants() não inclui nenhuma entrada indisponível', () => {
    for (const entry of readyToolVariants()) {
      expect(entry.available).toBe(true)
    }
  })

  it('stair tem exatamente os 3 presets de tamanho (small/medium/large)', () => {
    const entry = TOOL_VARIANTS.stair
    if (!entry || !entry.available) throw new Error('stair deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['small', 'medium', 'large'])
  })

  it('brush tem o Modo (traço livre/balde) e as 3 texturas de traço (pen/pencil/marker)', () => {
    const entry = TOOL_VARIANTS.brush
    if (!entry || !entry.available) throw new Error('brush deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(2)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['traco', 'balde'])
    expect(entry.groups[1].options.map((o) => o.value)).toEqual(['pen', 'pencil', 'marker'])
  })

  it('eraser tem exatamente os 2 modos (objeto/parte)', () => {
    const entry = TOOL_VARIANTS.eraser
    if (!entry || !entry.available) throw new Error('eraser deveria estar disponível (Fase 5)')
    expect(entry.groups).toHaveLength(1)
    expect(entry.groups[0].options.map((o) => o.value)).toEqual(['objeto', 'parte'])
  })

  it('Objetos oferece os 11 móveis, as 9 peças novas da MT4, as 5 da MT5, o Fogo e as 14 peças de 28 e 29/10 na ordem do catálogo (o balde depois do Barril, pratos depois das mesas, sofá e poltrona depois da Cadeira, a cozinha depois do Armário, lareira e oficina depois do Fogo, troncos e feno no fim), com o nome que o mestre lê', () => {
    const entry = TOOL_VARIANTS.mobilia
    if (!entry || !entry.available) throw new Error('mobilia deveria estar disponível')
    expect(entry.groups).toHaveLength(1)
    const [grupo] = entry.groups
    expect(grupo.storeKey).toBe('mobiliaTipo')
    expect(grupo.label).toBe('Objeto')
    // CONSTRUÇÕES (12/11/2026, decisão do mestre, `14fef595`): as 19 construções (poço, chafariz, barraca, arco do
    // portão, cata-vento, moinho, pilar, estátua, mausoléu, antena, anjo de pedra, tenda de adivinha, galinheiro, os
    // três blocos de inscrições, tenda e as duas torres) saíram do Objeto para a ferramenta Construção, na mesma
    // ordem do catálogo. Ponte, píer, palco e ringue ficam (anda-se em cima deles). 176 - 19 = 157.
    expect(grupo.options.map((o) => o.value)).toEqual([
      'barril', 'balde', 'caixa', 'bau', 'catre', 'mesa', 'mesaQuadrada', 'mesaRedonda', 'pratos', 'cadeira', 'sofa', 'poltrona', 'cerca', 'sebe', 'jardineira',
      'armario', 'fogao', 'geladeira', 'pia', 'privada', 'aparador', 'balcao', 'fogueira', 'fogo', 'lareira', 'fornalha', 'bigorna', 'tapete', 'tapeteLongo',
      'lapide', 'cova', 'caixao', 'caixaoAberto', 'vaso', 'lampiao', 'quadroDeAvisos', 'ponte', 'carroca', 'placaDeSeta', 'troncos', 'feno',
      'cataVentoBrinquedo',
      'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'campinho',
      'bonecoDeTreino', 'altar', 'estanteDeLivros', 'sacosDeGrao', 'bancoDePraca', 'escombrosDePedra', 'canhao',
      'guardaRoupa', 'caldeirao', 'fornoDePao', 'prateleiraDeDeposito', 'pedrasERochas', 'alvoDeArcoEFlecha',
      'bancaDeFrutas', 'toldoListrado', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas', 'espantalho', 'cocho', 'ossos',
      'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
      'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
      'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
      'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
      'cruzDeMadeira', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
      'balancaDeMercador', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
      'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra', 'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
      'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
      'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe', 'armaduraDespedacada', 'armadura',
      'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico',
      'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
      'estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro',
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
      'teiaDeAranha', 'tochaDeParede', 'tochaDePe', 'cranio',
    ])
    expect(grupo.options).toHaveLength(157)
    expect(grupo.options.map((o) => o.label)).toEqual([
      'Barril', 'Balde de água', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Mesa quadrada', 'Mesa redonda', 'Pratos', 'Cadeira', 'Sofá', 'Poltrona', 'Cerca', 'Sebe', 'Jardineira',
      'Armário de cozinha', 'Fogão', 'Geladeira', 'Pia', 'Privada', 'Aparador', 'Balcão', 'Fogueira', 'Fogo', 'Lareira', 'Fornalha de ferreiro', 'Bigorna', 'Tapete', 'Tapete longo',
      'Lápide', 'Cova', 'Caixão', 'Caixão aberto', 'Vaso de planta', 'Lampião', 'Quadro de avisos', 'Ponte', 'Carroça', 'Placa de seta', 'Troncos', 'Feno',
      'Cata-vento de brinquedo',
      'Destroços de madeira', 'Sucata de metal: chapas', 'Sucata de metal: engrenagens', 'Sucata de metal: tambores', 'Campinho de futebol',
      'Boneco de treino', 'Altar', 'Estante de livros', 'Sacos de grão', 'Banco de praça', 'Escombros de pedra', 'Canhão',
      'Guarda-roupa', 'Caldeirão', 'Forno de pão', 'Prateleira de depósito', 'Pedras e rochas', 'Alvo de arco e flecha',
      'Banca de frutas', 'Toldo listrado', 'Bancada de ferramentas', 'Pedra de amolar', 'Suporte de armas', 'Espantalho', 'Cocho', 'Ossos',
      'Escrivaninha', 'Criado-mudo com vela', 'Cama de casal', 'Berço', 'Banqueta', 'Biombo', 'Piano', 'Candelabro de chão',
      'Banheira', 'Tina de madeira', 'Lavatório com jarro', 'Prateleira de potes', 'Mesa de corte', 'Gancho com carne pendurada',
      'Pilha de caixas', 'Barris deitados', 'Tonel de adega', 'Ânforas de barro', 'Cesto de vime', 'Cofre',
      'Varal de roupa', 'Horta', 'Canteiro de flores', 'Muro baixo de pedra', 'Toco de árvore', 'Carrinho de mão', 'Placa de loja pendurada',
      'Cruz de madeira', 'Cerca de ferro', 'Pá cravada na terra', 'Velas e oferendas', 'Árvore seca',
      'Balança de mercador', 'Gaiola com aves', 'Rolos de tecido', 'Palco de bardo', 'Barril de peixe',
      'Fole', 'Manequim com armadura', 'Pilha de lingotes', 'Serra', 'Colmeia', 'Arado', 'Toco com machado cravado', 'Plantação em fileiras',
      'Carroça quebrada', 'Barril quebrado', 'Viga caída', 'Armadura enferrujada', 'Mesa de jogo', 'Ringue de luta', 'Balanço', 'Mesa de sinuca',
      'Âncora', 'Cordas enroladas', 'Timão', 'Bote', 'Rede de pesca', 'Píer', 'Caixote de peixe', 'Armadura despedaçada', 'Armadura',
      'Braseiro', 'Cela com grade', 'Corrente', 'Armadilha de espinhos', 'Círculo mágico',
      'Potro de tortura', 'Dama de ferro', 'Tronco de prisioneiro', 'Gaiola suspensa', 'Cadeira de interrogatório', 'Mesa de instrumentos de tortura', 'Sangue no chão',
      'Estante de poções', 'Bola de cristal', 'Pedestal com livro aberto',
      'Barra de ouro', 'Monte de ouro', 'Moeda de ouro', 'Monte de moedas de ouro', 'Diamante', 'Monte de diamantes', 'Joia', 'Monte de joias',
      'Teia de aranha', 'Tocha de parede', 'Tocha de pé', 'Crânio',
    ])
    expect(grupo.options.find((o) => o.value === 'catre')?.description).toBe('Clique no mapa para pôr uma cama.')
    const novas = ['mesaQuadrada', 'mesaRedonda', 'lapide', 'vaso', 'lampiao', 'quadroDeAvisos', 'carroca']
    expect(novas.map((v) => grupo.options.find((o) => o.value === v)?.description)).toEqual([
      'Clique no mapa para pôr uma mesa quadrada.',
      'Clique no mapa para pôr uma mesa redonda.',
      'Clique no mapa para pôr uma lápide.',
      'Clique no mapa para pôr um vaso de planta.',
      'Clique no mapa para pôr um lampião.',
      'Clique no mapa para pôr um quadro de avisos.',
      'Clique no mapa para pôr uma carroça.',
    ])
    const mt5 = ['sebe', 'jardineira', 'tapeteLongo', 'placaDeSeta']
    expect(mt5.map((v) => grupo.options.find((o) => o.value === v)?.description)).toEqual([
      'Clique no mapa para pôr uma sebe.',
      'Clique no mapa para pôr uma jardineira.',
      'Clique no mapa para pôr um tapete longo.',
      'Clique no mapa para pôr uma placa de seta.',
    ])
    // O poço, a barraca e o arco do portão continuam com a mesma frase, agora na ferramenta Construção.
    const construcao = TOOL_VARIANTS.construcao
    if (!construcao || !construcao.available) throw new Error('construcao deveria estar disponível')
    const [daConstrucao] = construcao.groups
    expect(['poco', 'barraca', 'arcoDoPortao'].map((v) => daConstrucao.options.find((o) => o.value === v)?.description)).toEqual([
      'Clique no mapa para pôr um poço.',
      'Clique no mapa para pôr uma barraca de feira.',
      'Clique no mapa para pôr um arco do portão.',
    ])
    expect(grupo.options.some((o) => ['poco', 'barraca', 'arcoDoPortao'].includes(String(o.value)))).toBe(false)
    expect(grupo.options.find((o) => o.value === 'fogo')?.description).toBe('Clique no mapa para pôr um fogo.')
  })

  it('o menu do Objeto se divide nas 15 partes da ficha (Sala e quarto 21, Cozinha e banheiro 15, Armazenagem 11, Rua e jardim 18, Cemitério 9, Feira 10, Oficina 10, Fazenda 8, Destroços e sucata 12, Esporte e lazer 7, Porto e navio 8, Templo e masmorra 10, Sala de tortura 7, Magia e alquimia 3, Tesouro 8; grupo vazio não aparece) e todo tipo do catálogo cai em exatamente uma', () => {
    const entry = TOOL_VARIANTS.mobilia
    if (!entry || !entry.available) throw new Error('mobilia deveria estar disponível')
    const catalogo = entry.groups[0].options.map((o) => o.value)
    // CONSTRUÇÕES (12/11/2026): as 19 construções saíram das partes do Objeto (Rua e jardim -8, Cemitério -2,
    // Feira -2, Fazenda -3, Templo e masmorra -4) para as 4 partes da ferramenta Construção; nenhuma parte esvazia.
    expect(PARTES_DO_MENU_DE_OBJETO.map((p) => [p.titulo, p.tipos.length])).toEqual([
      ['Sala e quarto', 21],
      ['Cozinha e banheiro', 15],
      ['Armazenagem', 11],
      ['Rua e jardim', 18],
      ['Cemitério', 9],
      ['Feira', 10],
      ['Oficina', 10],
      ['Fazenda', 8],
      ['Destroços e sucata', 12],
      ['Esporte e lazer', 7],
      ['Porto e navio', 8],
      ['Templo e masmorra', 10],
      ['Sala de tortura', 7],
      ['Magia e alquimia', 3],
      ['Tesouro', 8],
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Cemitério')?.tipos).toEqual([
      'lapide', 'cova', 'caixao', 'caixaoAberto',
      'cruzDeMadeira', 'cercaDeFerro', 'paCravada', 'velasEOferendas', 'arvoreSeca',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Destroços e sucata')?.tipos).toEqual([
      'destrocosDeMadeira', 'sucataChapas', 'sucataEngrenagens', 'sucataTambores', 'escombrosDePedra', 'ossos',
      'carrocaQuebrada', 'barrilQuebrado', 'vigaCaida', 'armaduraEnferrujada', 'armaduraDespedacada', 'cranio',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Esporte e lazer')?.tipos).toEqual([
      'campinho', 'bonecoDeTreino', 'alvoDeArcoEFlecha',
      'mesaDeJogo', 'ringueDeLuta', 'balanco', 'mesaDeSinuca',
    ])
    // Os dois grupos novos de 11/11/2026 e o objeto novo de cada grupo antigo, no fim do grupo dele: os do
    // lote 1 e, depois deles, os do lote 2, os do lote 3, os do lote 4 (todos de Sala e quarto), os do lote 5
    // (todos de Cozinha e banheiro), os do lote 6 (todos de Armazenagem), os do lote 7 (todos de Rua e jardim), os
    // do lote 8 (todos de Cemitério), os do lote 9 (todos de Feira), os do lote 10 (os quatro primeiros de
    // Oficina, os cinco outros de Fazenda), os do lote 11 (os quatro primeiros de Destroços e sucata, os quatro
    // outros de Esporte e lazer), os do lote 12 (todos de Porto e navio), os do lote 15 (a armadura despedaçada
    // em Destroços e sucata, a armadura de pé em Templo e masmorra), os dos lotes 13 e 16 (todos de Templo e
    // masmorra, menos os três últimos do lote 13), nos dois últimos grupos novos de 11/11, o lote 14 (todos de
    // Sala de tortura) e os três últimos do lote 13 (todos de Magia e alquimia), e o lote 17 (12/11/2026): a
    // tenda e as duas torres em Rua e jardim, o crânio em Destroços e sucata, a teia e as duas tochas em Templo e
    // masmorra e os oito outros no grupo novo, o Tesouro.
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Porto e navio')?.tipos).toEqual([
      'canhao', 'ancora', 'cordasEnroladas', 'timao', 'bote', 'redeDePesca', 'pier', 'caixoteDePeixe',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Templo e masmorra')?.tipos).toEqual([
      'altar', 'armadura',
      'braseiro', 'celaComGrade', 'corrente', 'armadilhaDeEspinhos', 'circuloMagico',
      'teiaDeAranha', 'tochaDeParede', 'tochaDePe',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Tesouro')?.tipos).toEqual([
      'barraDeOuro', 'monteDeOuro', 'moedaDeOuro', 'monteDeMoedasDeOuro', 'diamante', 'monteDeDiamantes', 'joia', 'monteDeJoias',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Sala de tortura')?.tipos).toEqual([
      'potroDeTortura', 'damaDeFerro', 'troncoDePrisioneiro', 'gaiolaSuspensa', 'cadeiraDeInterrogatorio', 'mesaDeInstrumentos', 'sangueNoChao',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Magia e alquimia')?.tipos).toEqual(['estanteDePocoes', 'bolaDeCristal', 'pedestalComLivro'])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Sala e quarto')?.tipos.slice(-10)).toEqual([
      'estanteDeLivros', 'guardaRoupa', 'escrivaninha', 'criadoMudo', 'camaDeCasal', 'berco', 'banqueta', 'biombo', 'piano', 'candelabroDeChao',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Cozinha e banheiro')?.tipos.slice(-8)).toEqual([
      'caldeirao', 'fornoDePao', 'banheira', 'tinaDeMadeira', 'lavatorioComJarro', 'prateleiraDePotes', 'mesaDeCorte', 'ganchoComCarne',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Armazenagem')?.tipos.slice(-8)).toEqual([
      'sacosDeGrao', 'prateleiraDeDeposito', 'pilhaDeCaixas', 'barrisDeitados', 'tonelDeAdega', 'anforasDeBarro', 'cestoDeVime', 'cofre',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Rua e jardim')?.tipos.slice(-9)).toEqual([
      'bancoDePraca', 'pedrasERochas',
      'varalDeRoupa', 'horta', 'canteiroDeFlores', 'muroBaixoDePedra', 'tocoDeArvore', 'carrinhoDeMao', 'placaDeLoja',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Feira')?.tipos).toEqual([
      'carroca', 'quadroDeAvisos', 'cataVentoBrinquedo', 'bancaDeFrutas', 'toldoListrado',
      'balancaDeMercador', 'gaiolaComAves', 'rolosDeTecido', 'palcoDeBardo', 'barrilDePeixe',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Oficina')?.tipos).toEqual([
      'fornalha', 'bigorna', 'balde', 'bancadaDeFerramentas', 'pedraDeAmolar', 'suporteDeArmas',
      'fole', 'manequimComArmadura', 'pilhaDeLingotes', 'serra',
    ])
    expect(PARTES_DO_MENU_DE_OBJETO.find((p) => p.titulo === 'Fazenda')?.tipos).toEqual([
      'troncos', 'feno', 'espantalho', 'cocho',
      'colmeia', 'arado', 'tocoComMachado', 'plantacaoEmFileiras',
    ])
    const nasPartes = PARTES_DO_MENU_DE_OBJETO.flatMap((p) => p.tipos)
    expect(new Set(nasPartes).size).toBe(nasPartes.length)
    expect([...nasPartes].sort()).toEqual([...catalogo].sort())
    expect(PARTES_DO_MENU_DE_OBJETO.map((p) => p.titulo)).toContain(PARTE_COM_O_ATALHO_DA_ARVORE)
  })

  it('a escolha de Objetos ecoa na barra só com a ferramenta Objetos', () => {
    expect(variantEcho('mobiliaTipo', 'mesa')).toEqual({ subject: 'Próximo objeto', value: 'Mesa' })
    expect(variantEcho('mobiliaTipo', 'catre')).toEqual({ subject: 'Próximo objeto', value: 'Cama' })
    // Valor fora do catálogo não inventa rótulo.
    expect(variantEcho('mobiliaTipo', 'trono')).toBeNull()
    expect(toolHasVariantAxis('mobilia', 'mobiliaTipo')).toBe(true)
    expect(toolHasVariantAxis('prop', 'mobiliaTipo')).toBe(false)
  })
})

describe('DRAWING_SHAPE_GROUP e drawingClusterGroups (botão Desenho)', () => {
  it('Forma tem as 7 opções na ordem do usuário, o mesmo conjunto de DRAWING_TOOLS', () => {
    expect(DRAWING_SHAPE_GROUP.label).toBe('Forma')
    expect(DRAWING_SHAPE_GROUP.options.map((o) => o.value)).toEqual(['brush', 'line', 'curve', 'circle', 'ellipse', 'rect', 'polygon'])
    expect(new Set(DRAWING_SHAPE_GROUP.options.map((o) => o.value))).toEqual(new Set(DRAWING_TOOLS))
  })

  it('a descrição termina com a letra do atalho', () => {
    for (const option of DRAWING_SHAPE_GROUP.options) {
      expect(option.description.endsWith(`(${TOOL_SHORTCUTS[option.value]})`), option.id).toBe(true)
    }
  })

  it("drawingClusterGroups('brush') tem Forma + Modo + Textura do traço; ('line') tem só Forma", () => {
    expect(drawingClusterGroups('brush').map((g) => g.label)).toEqual(['Forma', 'Modo', 'Textura do traço'])
    expect(drawingClusterGroups('line').map((g) => g.label)).toEqual(['Forma'])
  })

  it('toda opção dos grupos do botão Desenho tem id, label, description e value não-vazios', () => {
    for (const shape of DRAWING_TOOLS) {
      for (const group of drawingClusterGroups(shape)) {
        expect(group.options.length).toBeGreaterThanOrEqual(2)
        for (const option of group.options) {
          expect(option.id.length).toBeGreaterThan(0)
          expect(option.label.length).toBeGreaterThan(0)
          expect(option.description.length).toBeGreaterThan(0)
          expect(option.value).not.toBeUndefined()
          expect(option.value).not.toBeNull()
        }
      }
    }
  })
})

describe('botões que agrupam ferramentas na barra (fatia 6: Sala e Objeto)', () => {
  it('Sala: Forma lista as quatro salas e a Região, na ordem do botão, com a letra de cada uma', () => {
    expect(SALA_SHAPE_GROUP.options.map((o) => o.value)).toEqual(TOOL_CLUSTERS.sala.tools)
    expect(SALA_SHAPE_GROUP.options.map((o) => o.label)).toEqual(['Retângulo', 'Circular', 'Polígono', 'Livre', 'Região'])
    for (const option of SALA_SHAPE_GROUP.options) {
      const letra = TOOL_SHORTCUTS[option.value]
      if (letra) expect(option.description, option.id).toContain(`(${letra})`)
      else expect(option.description, option.id).not.toContain('(')
    }
  })

  it('Objeto: Colocar tem o móvel e a imagem (a Peça, B)', () => {
    expect(OBJETO_KIND_GROUP.options.map((o) => o.value)).toEqual(TOOL_CLUSTERS.objeto.tools)
    expect(OBJETO_KIND_GROUP.options.map((o) => o.label)).toEqual(['Móvel', 'Imagem'])
    expect(clusterOptionLabel('objeto', 'prop')).toBe('Imagem')
  })

  it('o menu traz a escolha da ferramenta e, abaixo, as variantes prontas dela', () => {
    expect(clusterVariantGroups('sala', 'roomFree').map((g) => g.label)).toEqual(['Forma', 'Criar', 'Arredondar', 'Preenchimento', 'Desenho da parede'])
    expect(clusterVariantGroups('objeto', 'mobilia').map((g) => g.label)).toEqual(['Colocar', 'Objeto'])
    expect(clusterVariantGroups('objeto', 'prop').map((g) => g.label)).toEqual(['Colocar'])
    expect(clusterVariantGroups('drawing', 'line')).toEqual(drawingClusterGroups('line'))
  })
})
