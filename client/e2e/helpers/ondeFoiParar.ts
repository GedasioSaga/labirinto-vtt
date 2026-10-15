/**
 * ONDE FOI PARAR CADA CONTROLE (fatia 0 do design consolidado,
 * docs/design/consolidado/PLANO.md §2).
 *
 * Uma linha por controle do inventário (docs/design/consolidado/inventario.md):
 * o nome acessível do controle e o caminho de cliques que o mestre (ou o
 * jogador) faz até ele, a partir do estado do bloco. Nasce com o layout de
 * HOJE; cada fatia do redesenho troca o caminho (e o `vai` vira o `hoje`).
 * Nenhuma linha pode sumir: controle que some da tela é controle perdido.
 *
 * É só DADO (sem import de valor) para duas pontas lerem a mesma lista:
 * `e2e/ui-onde-foi-parar.spec.ts` (alcança cada linha no app de verdade) e
 * `scripts/onde-foi-parar-doc.mjs` (gera `docs/ui-onde-foi-parar.md`).
 *
 * Nome entre barras (`/^Cripta, 1 token/`) é expressão regular; o resto é
 * nome EXATO.
 */

export type Papel =
  | 'button' | 'checkbox' | 'combobox' | 'dialog' | 'heading' | 'list' | 'menuitem' | 'radio' | 'radiogroup'
  | 'region' | 'searchbox' | 'separator' | 'slider' | 'spinbutton' | 'tab' | 'textbox'

/** [papel ARIA, nome acessível]. */
export type Alvo = readonly [Papel, string]

export interface Linha {
  /** O controle, nas palavras do inventário. */
  readonly controle: string
  /** O que o dedo faz até ele, a partir do estado do bloco. Seção recolhível que já está aberta não é clicada de novo. */
  readonly caminho: readonly Alvo[]
  /** Tecla apertada depois do caminho (atalho que leva ao controle). */
  readonly tecla?: string
  /** O controle em si: tem de estar visível (e focado, com `focado`). */
  readonly alvo: Alvo
  readonly focado?: boolean
  /** Destino no design consolidado, quando difere do destino do bloco. */
  readonly vai?: string
}

/**
 * Onde o caminho começa a procurar. Desde a fatia 2, `esquerda` é o livro do
 * mestre (lombada + página aberta) e `acoes` é o topo dele; item de menu
 * (`menuitem`) é procurado na tela inteira, porque o menu abre por cima de tudo.
 */
export type Escopo = 'esquerda' | 'barra' | 'acoes' | 'direita' | 'pagina'

export type Tela = 'mestre' | 'mestre-sala-aberta' | 'jogador'

/** Estado de partida do bloco, refeito antes de CADA linha. */
export interface Preparo {
  /** Botão da barra de ferramentas que fica armado. */
  readonly ferramenta?: string
  /** Item selecionado no mapa (o clique no item, feito pela store: o mapa é um canvas). */
  readonly selecao?: { readonly tipo: 'token' | 'wall' | 'light' | 'region' | 'stair' | 'prop' | 'drawing' | 'floor' | 'pin' | 'zona'; readonly id: string }[]
  /** Clique que abre o diálogo do bloco, quando ele não está aberto. */
  readonly abrir?: Alvo
  /** Escape depois de cada linha (fecha o menu que a linha abriu). */
  readonly escape?: boolean
}

export interface Bloco {
  readonly tela: Tela
  readonly titulo: string
  /** De onde o bloco parte, em palavras. */
  readonly estado: string
  readonly escopo: Escopo
  readonly preparo?: Preparo
  /** Para onde o bloco vai no design consolidado (protótipo, ONDE + PLANO §1). */
  readonly vai: string
  /** Fatia do PLANO que muda o caminho. */
  readonly fatia: string
  readonly linhas: readonly Linha[]
}

const b = (nome: string): Alvo => ['button', nome]
/** Marcador da lombada do livro do mestre (Ficha, Cena, Aventura, Acervo). */
const marcador = (nome: string): Alvo => ['tab', nome]
const menu = (nome: string): Alvo => ['menuitem', nome]
const cx = (nome: string): Alvo => ['checkbox', nome]
const rg = (nome: string): Alvo => ['radiogroup', nome]
const l = (controle: string, alvo: Alvo, ...caminho: Alvo[]): Linha => ({ controle, alvo, caminho })

/** Cada controle de uma lista, todos no mesmo caminho. */
const todos = (alvos: readonly Alvo[], ...caminho: Alvo[]): Linha[] => alvos.map((alvo) => ({ controle: alvo[1], alvo, caminho }))

const PAREDE_ESTILO: Alvo[] = [cx('Parede interna'), b('Pegar do mapa a cor da parede'), ['textbox', 'Cor da parede'], rg('Espessura da parede'), ['slider', 'Ajuste fino'], b('Avançado')]
const REGIAO_ESTILO: Alvo[] = [['textbox', 'Cor'], cx('Hachurado'), rg('Espessura do contorno'), ['slider', 'Ajuste fino'], cx('Preenchido'), b('Avançado')]
const OBJETO_COMUM: Alvo[] = [['spinbutton', 'Rotação'], cx('Travado'), cx('Oculto no editor'), cx('Oculto para jogadores'), rg('Camada do objeto selecionado'), ['textbox', 'Rótulo para jogadores'], cx('Mostrar imagem ao jogador')]
const TRANSICAO = (titulo: string): Alvo[] => [['heading', titulo], b('Nenhuma Chega direto'), b('Procurar animações novas')]
const PINO_COMUM: Alvo[] = [rg('Tipo do pino'), cx('Só o círculo, sem haste'), ['textbox', 'Nome do local'], ['textbox', 'Descrição · o jogador lê'], cx('Travado'), cx('Marco: todos veem'), cx('Ler só de perto'), cx('Fechadura com segredo'), cx('Peça de coleção'), b('Escolher imagem...'), cx('Oculto para jogadores')]

const sel = (tipo: NonNullable<Preparo['selecao']>[number]['tipo'], id: string): Preparo => ({ selecao: [{ tipo, id }] })
const ferramenta = (nome: string): Preparo => ({ ferramenta: nome })
const MOVEL = (id: string, extras: Alvo[]): Bloco => ({
  tela: 'mestre', titulo: `Ficha do objeto: ${id.replace('m-', '')}`, estado: `objeto "${id}" selecionado no mapa`, escopo: 'esquerda', preparo: sel('prop', id),
  vai: 'Página Ficha, gramática nova (decisão 4.1)', fatia: '16a',
  linhas: todos([['combobox', 'Tipo'], ...extras, ['textbox', 'Cor da linha'], ...OBJETO_COMUM]),
})

export const BLOCOS: readonly Bloco[] = [
  // ─── Coluna da esquerda ────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Cabeçalho da esquerda', estado: 'editor aberto, Selecionar, nada selecionado', escopo: 'esquerda',
    vai: 'Topo do livro do mestre (feito)', fatia: '2',
    linhas: [
      l('Logo e nome do app', ['heading', 'Labirinto']),
      l('+ Token', b('Adicionar token')),
      l('Campo do novo token', ['textbox', 'Nome do novo token'], b('Adicionar token')),
      l('Adicionar (novo token)', b('Adicionar'), b('Adicionar token')),
      l('Cancelar (novo token)', b('Cancelar'), b('Adicionar token')),
      { ...l('Ver todas as cenas (ícone de expandir)', b('Ver todas as cenas')), vai: 'Chip da cena, "Ver todas as cenas" (fatia 3)' },
      l('Engrenagem (Configurações do mapa)', b('Configurações do mapa')),
      { ...l('Faixa "Nada selecionado"', b('Nada selecionado'), marcador('Ficha')), vai: 'Página Ficha, vazio com atalhos (fatia 7)' },
    ],
  },
  {
    tela: 'mestre', titulo: 'Ações do mapa', estado: 'editor aberto', escopo: 'acoes',
    vai: 'Topo do livro do mestre (ícones) e menu Arquivo (feito)', fatia: '2',
    linhas: [
      l('Desfazer', b('Desfazer')),
      l('Refazer', b('Refazer')),
      l('Salvar', b('Salvar')),
      l('Abrir...', menu('Abrir…'), b('Arquivo')),
      l('Imagem de fundo (sem imagem: importar)', menu('Importar imagem de fundo…'), b('Arquivo')),
      l('Exportar mapa (pasta)', menu('Exportar mapa (pasta)…'), b('Arquivo')),
      l('Exportar imagem (PNG)', menu('Exportar imagem (PNG)…'), b('Arquivo')),
      l('Importar mapa (pasta)', menu('Importar mapa (pasta)…'), b('Arquivo')),
      l('Início', menu('Voltar ao início'), b('Arquivo')),
      l('Atalhos do teclado (?)', b('Atalhos do teclado')),
    ],
  },
  {
    tela: 'mestre', titulo: 'Grupo Aventura', estado: 'editor com aventura, nada selecionado', escopo: 'esquerda',
    vai: 'Marcador Aventura do livro do mestre (casca feita; restilo na 18)', fatia: '2 (casca) e 18 (restilo)',
    linhas: [
      l('Pinos: busca', ['searchbox', 'Buscar pino'], marcador('Aventura'), b('Pinos')),
      l('Pinos: pino da lista (abre a cena)', b('Altar Cripta'), marcador('Aventura'), b('Pinos')),
      l('Agenda: Próximo apito', b('Próximo apito'), marcador('Aventura'), b('Agenda')),
      l('Agenda: Próximo dia', b('Próximo dia'), marcador('Aventura'), b('Agenda')),
      l('Agenda: nome do evento', ['textbox', 'Evento'], marcador('Aventura'), b('Agenda')),
      l('Agenda: dia', ['spinbutton', 'Dia'], marcador('Aventura'), b('Agenda')),
      l('Agenda: apito', ['combobox', 'Apito'], marcador('Aventura'), b('Agenda')),
      l('Agenda: Soar alarme ao disparar', cx('Soar alarme ao disparar'), marcador('Aventura'), b('Agenda')),
      l('Agenda: Marcar', b('Marcar'), marcador('Aventura'), b('Agenda')),
      l('Estado do mundo: Novo estado', b('Novo estado'), marcador('Aventura'), b('Estado do mundo')),
    ],
  },
  {
    tela: 'mestre', titulo: 'Grupo Esta cena', estado: 'editor com aventura, Selecionar, nada selecionado', escopo: 'esquerda',
    vai: 'Marcador Cena do livro do mestre (casca feita; fichas recolhíveis na 18)', fatia: '2 (casca) e 18 (restilo)',
    linhas: [
      { ...l('Objetos do mapa: busca', ['searchbox', 'Buscar objeto'], marcador('Cena'), b('Objetos do mapa')), vai: 'Busca do topo do marcador Cena' },
      { controle: 'Objetos do mapa: Ctrl+K põe o cursor na busca', caminho: [], tecla: 'Control+k', alvo: ['searchbox', 'Buscar objeto'], focado: true, vai: 'Ctrl+K foca a busca da página Cena' },
      l('Objetos do mapa: item da lista (Ir até lá)', b('Goblin'), marcador('Cena'), b('Objetos do mapa')),
      l('Locais: sala da árvore (enquadra)', b('Salão'), marcador('Cena'), b('Locais')),
      l('Território: Quem manda aqui', cx('Quem manda aqui'), marcador('Cena'), b('Território')),
      l('Território: Alerta da cena', rg('Alerta da cena'), marcador('Cena'), b('Território')),
      l('Chão do mapa: Cor do chão', ['textbox', 'Cor do chão'], marcador('Cena'), b('Chão do mapa')),
      l('Chão do mapa: conta-gotas da cor', b('Pegar do mapa a cor do chão'), marcador('Cena'), b('Chão do mapa')),
      l('Chão do mapa: Contorno', cx('Contorno'), marcador('Cena'), b('Chão do mapa')),
      l('Camadas: Mostrar grade', cx('Mostrar grade'), marcador('Cena'), b('Camadas')),
      l('Camadas: Grudar Token no centro', cx('Grudar Token no centro'), marcador('Cena'), b('Camadas')),
      l('Camadas: Grudar Parede na grade', cx('Grudar Parede na grade'), marcador('Cena'), b('Camadas')),
      l('Camadas: Grudar Objeto na grade', cx('Grudar Objeto na grade'), marcador('Cena'), b('Camadas')),
      ...(['Paredes', 'Portas', 'Salas', 'Escadas', 'Objetos', 'Decoração', 'Iluminação', 'Tokens', 'Anotações'].flatMap((c) => [
        l(`Camadas: olho de ${c}`, b(`Ocultar ${c}`), marcador('Cena'), b('Camadas')),
        l(`Camadas: trava de ${c}`, b(`Travar ${c}`), marcador('Cena'), b('Camadas')),
      ])),
    ],
  },
  {
    tela: 'mestre', titulo: 'Camadas do chão', estado: 'peça de chão selecionada', escopo: 'esquerda', preparo: sel('floor', 'f1'),
    vai: 'Marcador Cena, ficha Camadas do chão (nota "ir: cena" com a ferramenta Chão)', fatia: '7 e 18',
    linhas: [l('Camadas do chão: lista das peças', ['heading', 'Camadas do chão'])],
  },
  {
    tela: 'mestre', titulo: 'Acervos', estado: 'editor aberto', escopo: 'esquerda',
    vai: 'Marcador Acervo (casca feita; Tokens e Itens com seg na 18)', fatia: '2 (casca) e 18 (restilo)',
    linhas: [
      l('Acervo de tokens', ['heading', 'Acervo de tokens'], marcador('Acervo')),
      l('Acervo de tokens: + Pasta', b('Nova pasta'), marcador('Acervo')),
      l('Acervo de itens', ['region', 'Itens'], marcador('Acervo')),
      l('Acervo de itens: Categorias', b('Categorias'), marcador('Acervo')),
      l('Acervo de itens: Novo item', b('Novo item'), marcador('Acervo')),
    ],
  },

  // ─── Barra de ferramentas ──────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Botões da barra', estado: 'editor aberto', escopo: 'barra',
    vai: 'Barra nova: Escolher / Construir / Terreno / Esconder e revelar / Anotar (Sala junta 5 formas, Objeto junta mobília e peça)', fatia: '6',
    linhas: todos(['Selecionar', 'Parede', 'Porta', 'Luz', 'Região', 'Sala', 'Sala Circular', 'Polígono Regular', 'Sala livre', 'Chão', 'Caminho', 'Penhasco', 'Texturas', 'Carimbos', 'Escada', 'Peça', 'Zona oculta', 'Pincel de revelar', 'Objetos', 'Desenho', 'Texto', 'Pino', 'Medir', 'Borracha'].map(b)),
  },
  {
    tela: 'mestre', titulo: 'Variantes da barra (setinhas)', estado: 'editor aberto', escopo: 'pagina', preparo: { escape: true },
    vai: 'Cantinho do botão (clique direito ou segurar) + ficha da ferramenta', fatia: '6',
    linhas: [
      l('Parede: Tipo de parede', rg('Tipo de parede'), b('Opções de Parede')),
      l('Porta: Tipo de porta', rg('Tipo de porta'), b('Opções de Porta')),
      l('Região: Preenchimento', rg('Preenchimento'), b('Opções de Região')),
      l('Sala: Preenchimento', rg('Preenchimento'), b('Opções de Sala')),
      l('Sala Circular: Preenchimento', rg('Preenchimento'), b('Opções de Sala Circular')),
      l('Polígono Regular: Lados do polígono', rg('Lados do polígono'), b('Opções de Polígono Regular')),
      l('Sala livre: Criar (Sala / Parede)', rg('Criar'), b('Opções de Sala livre')),
      l('Sala livre: Arredondar', rg('Arredondar'), b('Opções de Sala livre')),
      l('Chão: Forma', rg('Forma'), b('Opções de Chão')),
      l('Chão: Tinta', rg('Tinta'), b('Opções de Chão')),
      l('Chão: Tamanho do pincel', rg('Tamanho do pincel'), b('Opções de Chão')),
      l('Chão: Operação', rg('Operação'), b('Opções de Chão')),
      l('Escada: Tamanho', rg('Tamanho'), b('Opções de Escada')),
      ...['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira', 'Cerca', 'Armário de cozinha', 'Aparador', 'Fogueira', 'Tapete'].map((o) => l(`Objetos: ${o}`, ['radio', o], b('Opções de Objetos'))),
      l('Desenho: Forma (7 formas)', rg('Forma'), b('Opções de Desenho')),
      l('Desenho: Modo (Traço livre / Balde)', rg('Modo'), b('Opções de Desenho')),
      l('Desenho: Textura do traço', rg('Textura do traço'), b('Opções de Desenho')),
      l('Borracha: Modo', rg('Modo'), b('Opções de Borracha')),
    ],
  },

  // ─── Ficha da ferramenta (nada selecionado) ───────────────────────────
  ...([
    ['Parede', [['heading', 'Parede'], cx('Parede interna'), rg('Espessura da parede'), ['slider', 'Ajuste fino'], b('Avançado')]],
    ['Porta', [['heading', 'Ferramenta · Porta'], rg('Abrir na parede'), rg('Tipo de porta')]],
    ['Luz', [['heading', 'Ferramenta · Luz']]],
    ['Região', [['heading', 'Região'], ...REGIAO_ESTILO]],
    ['Sala', [['heading', 'Ferramenta · Sala'], ...REGIAO_ESTILO]],
    ['Chão', [['heading', 'Ferramenta · Chão'], b('Chão do mapa')]],
    ['Caminho', [['heading', 'Ferramenta · Caminho'], ['textbox', 'Cor deste caminho'], ['slider', 'Largura']]],
    ['Penhasco', [['heading', 'Ferramenta · Penhasco'], rg('Ao riscar'), rg('Largura do pincel'), rg('Altura do penhasco'), b('Ligar o relevo')]],
    ['Texturas', [['heading', 'Ferramenta · Texturas'], rg('Ao pintar'), rg('Textura'), ['region', 'Colar ou soltar a imagem da nova textura'], b('Escolher imagem…'), b('Procurar texturas novas'), ['slider', 'Tamanho do pincel'], ['slider', 'Força']]],
    ['Carimbos', [['heading', 'Ferramenta · Carimbos'], rg('Ao clicar'), rg('Objeto'), ['radio', 'Árvore'], ['region', 'Colar ou soltar a imagem do novo carimbo'], b('Escolher imagem…'), b('Procurar carimbos novos'), ['slider', 'Tamanho'], ['slider', 'Largura do spray'], ['slider', 'Densidade do spray']]],
    ['Escada', [['heading', 'Ferramenta · Escada']]],
    ['Peça', [['heading', 'Ferramenta · Peça']]],
    ['Zona oculta', [['heading', 'Ferramenta · Zona oculta']]],
    ['Pincel de revelar', [['heading', 'Ferramenta · Pincel de revelar'], rg('Ao pintar'), rg('Largura do pincel')]],
    ['Objetos', [['heading', 'Ferramenta · Objetos']]],
    ['Desenho', [['heading', 'Ferramenta · Pincel'], ['textbox', 'Cor'], ['slider', 'Espessura'], rg('Ponta da linha')]],
    ['Texto', [['heading', 'Ferramenta · Texto'], ['textbox', 'Cor'], ['slider', 'Tamanho da fonte'], ['combobox', 'Fonte']]],
    ['Pino', [['heading', 'Ferramenta · Pino'], rg('Tipo do pino'), rg('Ícone no mapa')]],
    ['Medir', [['heading', 'Ferramenta · Medir']]],
    ['Borracha', [['heading', 'Ferramenta · Borracha']]],
  ] as const).map(([nome, alvos]): Bloco => ({
    tela: 'mestre', titulo: `Ficha da ferramenta: ${nome}`, estado: `ferramenta ${nome} armada, nada selecionado`, escopo: 'esquerda', preparo: ferramenta(nome),
    vai: nome === 'Penhasco' || nome === 'Texturas' || nome === 'Carimbos' ? 'Página Ficha, ficha da ferramenta (biblioteca em grade de cartões)' : 'Página Ficha, ficha da ferramenta (cabeça com dica e kbd)', fatia: '7',
    linhas: todos(alvos),
  })),

  // ─── Ficha da seleção ─────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Faixa da seleção', estado: 'token selecionado no mapa', escopo: 'esquerda', preparo: sel('token', 't1'),
    vai: 'Cabeça da ficha (Apagar e "Mais ações")', fatia: '8',
    linhas: [l('Apagar', b('Apagar token selecionado')), l('Mais ações', b('Mais ações'))],
  },
  {
    tela: 'mestre', titulo: 'Ficha do token', estado: 'token selecionado no mapa', escopo: 'esquerda', preparo: sel('token', 't1'),
    vai: 'Página Ficha: Tipo de ficha, Nome, Condições, No mapa, Levar para outra cena, cartões de Comportamento', fatia: '9',
    linhas: [
      ...todos([['textbox', 'Nome'], rg('Nome para os jogadores')]),
      ...todos([['spinbutton', 'Vida atual'], ['spinbutton', 'Vida máxima']]).map((x) => ({ ...x, vai: 'Sai na fatia 9; a vida vem da ficha do sistema (fatia 10, D)' })),
      ...todos([rg('Tamanho da ficha')]),
      ...['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'].map((c) => l(`Condição: ${c}`, b(c), b('Condições'))),
      ...todos([cx('Travado'), cx('Congelado'), cx('Oculto para jogadores')]),
      l('Avançado: Rotação', ['spinbutton', 'Rotação'], b('Avançado')),
      l('Avançado: Oculto no editor', cx('Oculto no editor'), b('Avançado')),
      ...todos([rg('Cor da ficha'), b('Escolher imagem...'), b('Salvar no acervo'), cx('Ficha de NPC'), cx('Ficha de jogador'), ['combobox', 'Personagem'], cx('Esta ficha vigia')]),
      l('Patrulha: Marcar ponto aqui', b('Marcar ponto aqui'), b('Patrulha')),
      l('Patrulha: Patrulhar sozinha', b('Patrulhar sozinha'), b('Patrulha')),
      l('Patrulha: Avançar patrulha', b('Avançar patrulha'), b('Patrulha')),
      ...todos([cx('Esta ficha é um veículo'), ['spinbutton', 'Piso']]),
    ],
  },
  {
    tela: 'mestre', titulo: 'Ficha do pino (!)', estado: 'pino de exclamação selecionado', escopo: 'esquerda', preparo: sel('pin', 'pin-e'),
    vai: 'Página Ficha do pino: essencial + "+ Adicionar ao pino" + Mais da viagem, Aparência, Na mesa', fatia: '12',
    linhas: todos([...PINO_COMUM, rg('Ícone no mapa'), cx('Item pegável'), cx('Loja com preços'), ['combobox', 'Cabine contínua: leva a'], ['heading', 'Animação do Cenário'], b('Excluir ponto de interesse')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha do pino de viagem', estado: 'pino de viagem selecionado', escopo: 'esquerda', preparo: sel('pin', 'pin-v'),
    vai: 'Página Ficha do pino, ficha "Mais da viagem"', fatia: '12',
    linhas: todos([b('Leva a…'), rg('Passagem'), ...TRANSICAO('Transição ao atravessar'), ['combobox', 'Preso à ficha'], ['combobox', 'Cabine (elevador, cesto)'], ['textbox', 'Nova cabine'], b('Criar cabine aqui'), b('Excluir pino de viagem')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da alavanca', estado: 'alavanca selecionada', escopo: 'esquerda', preparo: sel('pin', 'pin-a'),
    vai: 'Página Ficha do pino (alavanca com "Acionar agora")', fatia: '12',
    linhas: todos([['combobox', 'Abre a porta'], b('Excluir alavanca')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da porta', estado: 'porta selecionada no mapa', escopo: 'esquerda', preparo: sel('wall', 'd1'),
    vai: 'Página Ficha da porta: Estado, Trancada, Secreta, Espiar + Quem abre, Aparência, Parede em volta, Depende do estado', fatia: '11',
    linhas: todos([b('Virar parede sólida'), cx('Aberta'), cx('Trancada'), cx('Jogador pode espiar'), cx('Secreta'), rg('Abre por'), ['combobox', 'Animação ao abrir'], b('Procurar animações novas'), rg('Tipo de porta'), ...PAREDE_ESTILO]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da parede', estado: 'parede selecionada no mapa', escopo: 'esquerda', preparo: sel('wall', 'w1'),
    vai: 'Página Ficha, gramática nova (decisão 4.1)', fatia: '16a',
    linhas: todos([...PAREDE_ESTILO, cx('Janela (vê, não passa)'), cx('Deixa passar (a ficha atravessa)'), cx('Deixa ver (a visão atravessa)'), b('Virar porta')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da escada', estado: 'escada selecionada no mapa', escopo: 'esquerda', preparo: sel('stair', 's1'),
    vai: 'Página Ficha da escada (Comprimento, Largura e Curva na ficha; alças no mapa)', fatia: '16b e 17',
    linhas: todos([rg('Sentido da escada'), rg('Forma da escada'), rg('Tamanho da escada'), ['textbox', 'Comprimento'], b('Diminuir o comprimento'), b('Aumentar o comprimento'), ['textbox', 'Largura'], b('Diminuir a largura'), b('Aumentar a largura'), ['slider', 'Curva'], ['combobox', 'Leva a'], rg('Passagem da escada'), b('Criar andar de cima'), ['spinbutton', 'Piso'], ['spinbutton', 'Leva ao piso'], ...TRANSICAO('Transição ao trocar de piso'), cx('Oculto para jogadores')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da sala', estado: 'sala selecionada no mapa', escopo: 'esquerda', preparo: sel('region', 'sala1'),
    vai: 'Página Ficha da sala: Sala, O que veem, Acrescentar, Aparência, Medidas e título, Trava', fatia: '15',
    linhas: [
      ...todos([['textbox', 'Nome'], cx('Fundo do título'), ['slider', 'Tamanho do título'], ['textbox', 'Cor do título'], rg('Orientação do título'), ['spinbutton', 'Largura'], ['spinbutton', 'Altura'], ['spinbutton', 'Rotação'], b('−90°'), b('+90°')]),
      ...todos([cx('Jogadores veem o nome'), cx('Teto fechado para jogadores'), cx('Cômodo: aparece só depois de visto'), cx('Sala escura'), cx('De dentro, vê lá fora'), cx('De fora, vê aqui dentro')]),
      ...todos([b('Ao entrar, o jogador lê'), b('Nota do mestre'), b('Facção'), b('Raio de visão aqui'), b('Perigo'), b('Esteira'), b('Criar sala dentro')]),
      ...todos([cx('Travado'), cx('Oculto para jogadores'), ...REGIAO_ESTILO, b('Criar parede na borda'), cx('Pintar parte da sala de outra cor')]),
      { ...l('Mais ações: levar ao piso', ['menuitem', '/^Levar ao/'], b('Mais ações')), vai: '"Mais ações" da cabeça da ficha (fatia 8)' },
    ],
  },
  {
    tela: 'mestre', titulo: 'Ficha da região (não sala)', estado: 'região selecionada no mapa', escopo: 'esquerda', preparo: sel('region', 'r1'),
    vai: 'Página Ficha, gramática nova', fatia: '16b',
    linhas: todos([cx('Travado'), cx('Oculto para jogadores'), ...REGIAO_ESTILO, b('Criar parede na borda')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da luz', estado: 'luz selecionada no mapa', escopo: 'esquerda', preparo: sel('light', 'l1'),
    vai: 'Página Ficha, gramática nova', fatia: '16a',
    linhas: todos([['textbox', 'Cor'], ['slider', 'Intensidade'], ['combobox', 'Prender na ficha'], cx('Vista de longe')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da peça (imagem)', estado: 'peça de imagem selecionada', escopo: 'esquerda', preparo: sel('prop', 'p-img'),
    vai: 'Página Ficha, gramática nova', fatia: '16a',
    linhas: todos(OBJETO_COMUM),
  },
  MOVEL('m-barril', [cx('Preencher'), ['textbox', 'Cor']]),
  MOVEL('m-catre', [cx('Preencher'), ['textbox', 'Cor'], ['textbox', 'Cor do travesseiro'], rg('Paleta: cor do travesseiro'), ['textbox', 'Cor do cobertor'], rg('Paleta: cor do cobertor')]),
  MOVEL('m-cerca', []),
  MOVEL('m-armario', [rg('Vista'), cx('Preencher'), ['textbox', 'Cor']]),
  MOVEL('m-aparador', [rg('Vista'), cx('Preencher'), ['textbox', 'Cor']]),
  MOVEL('m-fogueira', [rg('Vista'), cx('Preencher'), ['textbox', 'Cor']]),
  MOVEL('m-tapete', [rg('Vista'), rg('Forma'), cx('Preencher'), ['textbox', 'Cor']]),
  {
    tela: 'mestre', titulo: 'Ficha do desenho', estado: 'linha desenhada selecionada', escopo: 'esquerda', preparo: sel('drawing', 'dr1'),
    vai: 'Página Ficha, gramática nova (Endireitar no "Mais ações")', fatia: '16b',
    linhas: todos([b('Endireitar'), cx('Oculto para jogadores'), ['textbox', 'Cor'], ['slider', 'Espessura'], cx('Paredes ao redor')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha do texto', estado: 'texto selecionado', escopo: 'esquerda', preparo: sel('drawing', 'tx1'),
    vai: 'Página Ficha, gramática nova', fatia: '16b',
    linhas: todos([['heading', 'Rótulo de texto'], ['textbox', 'Cor'], ['slider', 'Tamanho da fonte'], ['combobox', 'Fonte'], cx('Oculto para jogadores')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da peça de chão', estado: 'peça de chão selecionada', escopo: 'esquerda', preparo: sel('floor', 'f1'),
    vai: 'Página Ficha, gramática nova', fatia: '16b',
    linhas: todos([b('Apagar peça de chão selecionada'), b('Mais ações')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da zona oculta', estado: 'zona oculta selecionada', escopo: 'esquerda', preparo: sel('zona', 'z1'),
    vai: 'Página Ficha, gramática nova', fatia: '16a',
    linhas: todos([['textbox', 'Nome'], cx('Revelar para jogadores'), b('Excluir zona')]),
  },
  {
    tela: 'mestre', titulo: 'Seleção múltipla', estado: 'token e parede selecionados juntos', escopo: 'esquerda', preparo: { selecao: [{ tipo: 'token', id: 't1' }, { tipo: 'wall', id: 'w1' }] },
    vai: 'Página Ficha com 2 ou mais itens', fatia: '8',
    linhas: todos([b('Apagar 2 itens selecionados'), b('Agrupar (Ctrl+G)'), b('Limpar seleção de área'), b('Alinhar à esquerda'), b('Alinhar ao centro'), b('Alinhar à direita'), b('Alinhar ao topo'), b('Alinhar ao meio'), b('Alinhar à base'), b('Distribuir na horizontal'), b('Distribuir na vertical'), cx('Oculto para jogadores (1)')]),
  },

  // ─── Diálogos ─────────────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Configurações do mapa', estado: 'diálogo aberto pela engrenagem', escopo: 'pagina', preparo: { abrir: b('Configurações do mapa') },
    vai: 'Mesmo diálogo, casca nova com navegação vertical', fatia: '20',
    linhas: todos([rg('Formato da grade'), ['textbox', 'Cor da grade'], ['slider', 'Opacidade'], ['slider', 'Espessura'], rg('Estilo da linha da grade'), ['heading', 'Alinhar grade à imagem'], ['spinbutton', 'Unidades por célula'], ['textbox', 'Unidade'], ['spinbutton', 'Casas decimais'], ['combobox', 'Modo de medição'], ['spinbutton', 'Passo máximo (quadrados)'], cx('Fichas ocupam espaço'), ['spinbutton', 'Largura (quadros)'], ['spinbutton', 'Altura (quadros)'], b('Aplicar 30 × 20'), ['textbox', 'Texto de chegada'], cx('Rostos só de perto'), ['spinbutton', 'Casas'], b('Escolher sistema…')]),
  },
  {
    tela: 'mestre', titulo: 'Configurar cena', estado: 'diálogo aberto pela engrenagem da cena (coluna da direita, Cenas)', escopo: 'pagina', preparo: { abrir: b('Configurar Cripta') },
    vai: 'Configurar cena com navegação vertical; Relevo, Nomes dos lugares e Nuvens na seção "Mapa vivo"', fatia: '20',
    linhas: [
      ...todos([['spinbutton', 'Visão nesta cena (quadrados)'], cx('Cena escura'), rg('Tipo de mapa'), cx('Relevo'), cx('Nomes dos lugares'), cx('Nuvens')]),
      l('Grupo anda junto (caravana), em mapa Continente', cx('Grupo anda junto (caravana)'), ['radio', 'Continente']),
    ],
  },
  {
    tela: 'mestre', titulo: 'Todas as cenas', estado: 'aberto pelo ícone "Ver todas as cenas"', escopo: 'pagina', preparo: { abrir: b('Ver todas as cenas') },
    vai: 'Chip da cena, "Ver todas as cenas"', fatia: '3 e 20',
    linhas: [l('Miniatura da cena', b('/^Cripta, 1 token/'))],
  },
  {
    tela: 'mestre', titulo: 'Atalhos do teclado', estado: 'aberto pelo "?"', escopo: 'pagina', preparo: { abrir: b('Atalhos do teclado') },
    vai: 'Diálogo Atalhos com a lista nova', fatia: '20',
    linhas: [l('Lista de atalhos', ['dialog', 'Atalhos do teclado'])],
  },

  // ─── Coluna da direita ────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Coluna da direita, sala fechada', estado: 'app do mestre, aba Jogo, sala fechada', escopo: 'direita',
    vai: 'Livro da mesa: topo da Sala (sala fechada) e marcadores Grupo e Mesa', fatia: '4 e 5',
    linhas: [
      l('Aba Jogo', ['tab', 'Jogo']),
      { ...l('Abrir sala', b('Abrir sala')), vai: 'Topo do livro da mesa' },
      { ...l('Visão de jogador', b('Visão de jogador')), vai: 'Topo do livro da mesa e marcador Mesa' },
      l('Personagens: + Personagem', b('+ Personagem'), b('Personagens')),
      l('Personagens: Importar personagens', b('Importar personagens…'), b('Personagens')),
      l('Contas: Só com conta', cx('Só com conta'), b('Contas dos jogadores')),
      l('Contas: nome da nova conta', ['textbox', 'Nome do jogador'], b('Contas dos jogadores')),
      l('Contas: PIN', ['textbox', 'PIN'], b('Contas dos jogadores')),
      l('Contas: + Conta', b('+ Conta'), b('Contas dos jogadores')),
      { ...l('Esconder a coluna da direita', b('Esconder a coluna da direita')), vai: 'Seta no pé da lombada' },
      { ...l('Divisor "Altura das Cenas"', ['separator', 'Altura das Cenas']), vai: 'Some: Cenas vira marcador próprio' },
    ],
  },
  {
    tela: 'mestre', titulo: 'Chat do mestre', estado: 'sala fechada', escopo: 'direita', vai: 'Marcador Chat do livro da mesa', fatia: '4',
    linhas: [l('Aba Chat: Ir para Jogo', b('Ir para Jogo'), ['tab', 'Chat'])],
  },
  {
    tela: 'mestre', titulo: 'Cenas', estado: 'aventura aberta, coluna da direita', escopo: 'direita',
    vai: 'Marcador Cenas do livro da mesa', fatia: '4',
    linhas: [
      ...todos([b('Cripta'), b('Renomear Cripta'), b('Mover Cripta para…'), b('Planta de Cripta'), b('Configurar Cripta'), b('+ Nova cena'), b('Revisar aventura')]),
      ...['Duplicar', 'Subir', 'Descer', 'É a cena inicial', 'Apagar cena…'].map((m) => l(`Mais ações da cena: ${m}`, ['menuitem', m], b('Mais ações de Cripta'))),
    ],
  },
  {
    tela: 'mestre-sala-aberta', titulo: 'Coluna da direita, sala aberta', estado: 'sala aberta (código ONDE01), aba Jogo', escopo: 'direita',
    vai: 'Livro da mesa: topo da Sala (código, Mais da sala, Laser, Som, Convidar) e página Mesa', fatia: '4',
    linhas: [
      { ...l('Código da sala', ['heading', 'Sala']), vai: 'Topo do livro da mesa, código para copiar' },
      { ...l('Laser do mestre', b('Laser')), vai: 'Topo do livro da mesa' },
      { ...l('Som da mesa', b('Som da mesa')), vai: 'Botão Som do topo e página Mesa' },
      { ...l('Ruído', b('Ruído')), vai: 'Página Mesa' },
      { ...l('Alcance do ruído', ['combobox', 'Alcance do ruído']), vai: 'Página Mesa' },
      { ...l('Grupo', ['heading', 'Grupo']), vai: 'Marcador Grupo', },
      { ...l('Diário de viagens', ['heading', 'Diário de viagens']), vai: 'Página Mesa' },
      { ...l('Tela da mesa: Cena na tela', ['combobox', 'Cena na tela']), vai: 'Página Mesa' },
      { ...l('Convidar jogadores: Tornar pública', b('Tornar pública')), vai: 'Botão Convidar do topo' },
      { ...l('Fechar sala', b('Fechar sala')), vai: 'Menu "Mais da sala" do topo, com confirmação' },
    ],
  },

  // ─── Tela do jogador ──────────────────────────────────────────────────
  {
    tela: 'jogador', titulo: 'Jogador: barra de cima e cantos', estado: 'jogador no celular (390 px), painel fechado', escopo: 'pagina',
    vai: 'Faixa de couro com 4 atalhos + mão flutuante de latão', fatia: '19',
    linhas: todos([b('Painel'), b('Minha ficha'), b('Inventário'), b('Aproximar'), b('Afastar'), b('Som'), b('Chamar o mestre')]),
  },
  {
    tela: 'jogador', titulo: 'Jogador: aba Jogo', estado: 'jogador no celular, painel aberto', escopo: 'pagina', preparo: { abrir: b('Painel') },
    vai: 'Folha com abas: "No mapa" (4 peças), 2 linhas, fichas Comigo, Grupo, Meu personagem, Visão; Sair no rodapé', fatia: '19',
    linhas: [
      ...todos([['tab', 'Jogo'], ['tab', 'Caderno'], ['tab', 'Lugares'], ['tab', 'Dados'], ['tab', 'Chat']]),
      ...todos([b('Centralizar em Heroi'), b('Sinalizar'), b('Marcações'), b('Medir'), b('Laser'), b('Mostrar meu mapa a…'), b('Volto já'), b('Sair')]),
      ...todos([['heading', 'Comigo'], ['textbox', 'Nome'], b('Foto'), b('Esconder')]),
      ...todos([['slider', 'Brilho do explorado 55%'], cx('Grade'), cx('Nomes'), cx('Câmera segue minha ficha'), cx('Efeitos do mapa')]),
    ],
  },
]

/** Controles do inventário que este estado de teste NÃO monta, e por quê (vão para a tabela do doc). */
export const FORA_DO_ESPECIFICADO: readonly (readonly [string, string])[] = [
  ['Voltar (cena anterior), no topo do livro do mestre até a fatia 3', 'só aparece depois de viajar entre cenas'],
  ['Menu Arquivo com imagem de fundo (Trocar imagem, Chão a partir da imagem, Linhas e portas, Recriar minimapa)', 'só com imagem de fundo; sem ela o item é "Importar imagem de fundo…" (coberto); LivroDoMestre.test.tsx cobre os quatro'],
  ['Configurações do mapa: "Esconder Aventura e Esta cena ao usar ferramenta" (Categorias do painel)', 'aposentada na fatia 2: Aventura e Cena viraram páginas do livro, e quem tinha a escolha salva não quebra (a chave sai do aparelho)'],
  ['Endireitar na sala ou parede solta', 'só com traço torto; coberto no desenho'],
  ['Marcas dos jogadores (MarcasDaCena)', 'só com marcas deixadas por jogadores'],
  ['Visto por / Ninguém vê, Levar para..., Rotina, Luzes nesta ficha (token)', 'pedem sala aberta, outra cena ou Estado do mundo com valores'],
  ['Livro de regras', 'só com sistema de RPG que tem livro'],
  ['Grupo do mestre: as 25+ ações por jogador, Pedindo, Chegando, Congelar/Pausar cena', 'pedem jogador conectado; ficam para a fatia 5, que traz o spec do grupo'],
  ['Teste secreto', 'só com jogadores na sala'],
  ['Pausa geral dos NPCs', 'só com NPC andando'],
  ['Depende do estado (porta, luz, zona, pino)', 'só com Estado do mundo criado'],
  ['Jogador: Ficha, Grupo, Meus personagens em outra cena, abas Caderno/Lugares/Dados por dentro', 'pedem sistema de RPG, colegas ou histórico; as abas estão cobertas'],
]
