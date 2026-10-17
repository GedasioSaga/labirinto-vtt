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
  | 'alertdialog' | 'button' | 'checkbox' | 'combobox' | 'dialog' | 'group' | 'heading' | 'list' | 'menuitem' | 'radio' | 'radiogroup'
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
  /** O alvo mora num pop aberto pelo caminho (Som, Convidar, Rede do topo da Sala): procurado na tela inteira, e Esc fecha depois. */
  readonly noPop?: boolean
  /** Destino no design consolidado, quando difere do destino do bloco. */
  readonly vai?: string
}

/**
 * Onde o caminho começa a procurar. Desde a fatia 2, `esquerda` é o livro do
 * mestre (lombada + página aberta) e `acoes` é o topo dele; desde a fatia 3,
 * `chip` é o chip da cena no alto do mapa (Voltar, nome e menu de cenas); desde
 * a fatia 4, `direita` é o livro da mesa (lombada, topo da Sala e a página
 * aberta). Item de menu (`menuitem`) e diálogo (`dialog`, `alertdialog`) são
 * procurados na tela inteira, porque abrem por cima de tudo.
 */
export type Escopo = 'esquerda' | 'barra' | 'acoes' | 'chip' | 'direita' | 'pagina'

export type Tela = 'mestre' | 'mestre-sala-aberta' | 'mestre-com-jogadores' | 'jogador'

/** Estado de partida do bloco, refeito antes de CADA linha. */
export interface Preparo {
  /** Botão da barra de ferramentas que fica armado. */
  readonly ferramenta?: string
  /** Item selecionado no mapa (o clique no item, feito pela store: o mapa é um canvas). */
  readonly selecao?: { readonly tipo: 'token' | 'wall' | 'light' | 'region' | 'stair' | 'prop' | 'drawing' | 'floor' | 'pin' | 'zona'; readonly id: string }[]
  /** Clique que abre o diálogo do bloco, quando ele não está aberto. */
  readonly abrir?: Alvo
  /** Antes do `abrir`, o clique que o põe à vista: o gatilho do menu (item de menu) ou o marcador da página onde ele mora, procurado no escopo dado. */
  readonly abrirDe?: { readonly escopo: Escopo; readonly gatilho: Alvo }
  /** Escape depois de cada linha (fecha o menu que a linha abriu). */
  readonly escape?: boolean
}

export interface Bloco {
  readonly tela: Tela
  readonly titulo: string
  /** De onde o bloco parte, em palavras. */
  readonly estado: string
  readonly escopo: Escopo
  /** O alvo é procurado DENTRO deste elemento do escopo (a ficha aberta de um jogador), depois do caminho: o mesmo nome em outro cartão não conta. */
  readonly dentro?: Alvo
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
// FICHA DO PINO (fatia 12): o essencial à vista, a aparência na ficha recolhida e os recursos pelo "+ Adicionar ao pino".
const PINO_ESSENCIAL: Alvo[] = [rg('Tipo do pino'), ['textbox', 'Nome do local'], ['textbox', 'Descrição · o jogador lê'], cx('Oculto para jogadores'), cx('Marco: todos veem'), cx('Ler só de perto')]
const PINO_APARENCIA: Alvo[] = [cx('Só o círculo, sem haste'), cx('Travado'), b('Escolher imagem...')]
const PINO_RECURSOS: Alvo[] = ['Animação do cenário', 'Item pegável', 'Fechadura com segredo', 'Peça de coleção', 'Loja com preços', 'Cabine contínua'].map((nome) => menu(nome))

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
      l('Engrenagem (Configurações do mapa)', b('Configurações do mapa')),
      { ...l('Faixa "Nada selecionado"', b('Nada selecionado'), marcador('Ficha')), vai: 'Página Ficha, vazio com atalhos (feito, fatia 7)' },
      { ...l('Neste mapa: um exemplo de cada tipo da cena', b('/^Goblin/'), marcador('Ficha')), vai: 'Página Ficha, vazio: "Neste mapa" (novo, fatia 7)' },
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
    tela: 'mestre', titulo: 'Chip da cena', estado: 'editor com aventura (Cripta, cena inicial)', escopo: 'chip',
    vai: 'Chip da cena no alto do mapa (feito)', fatia: '3',
    linhas: [
      l('Nome da cena aberta (abre o menu de cenas)', b('/^Cripta/')),
      l('Menu de cenas por pasta: a cena', menu('Cripta'), b('/^Cripta/')),
      l('Ver todas as cenas (antigo ícone de expandir)', menu('Ver todas as cenas'), b('/^Cripta/')),
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
    vai: 'Barra no pé do mapa: Escolher / Construir / Terreno / Esconder e revelar / Anotar (feito na fatia 6)', fatia: '6',
    linhas: [
      ...todos(['Selecionar', 'Parede', 'Porta', 'Luz', 'Sala', 'Chão', 'Caminho', 'Penhasco', 'Texturas', 'Carimbos', 'Escada', 'Objeto', 'Zona oculta', 'Pincel de revelar', 'Desenho', 'Texto', 'Pino', 'Medir', 'Borracha'].map(b)),
      // Desde a fatia 6 as salas e a Região moram no botão Sala, e o móvel e a Peça no botão Objeto.
      ...['Retângulo', 'Circular', 'Polígono', 'Livre', 'Região'].map((o) => l(`Sala: Forma ${o}`, ['radio', o], b('Opções de Sala'))),
      ...['Móvel', 'Imagem'].map((o) => l(`Objeto: Colocar ${o}`, ['radio', o], b('Opções de Objeto'))),
    ],
  },
  {
    tela: 'mestre', titulo: 'Variantes da barra (setinhas)', estado: 'editor aberto', escopo: 'pagina', preparo: { escape: true },
    vai: 'Cantinho do botão (clique direito ou segurar) + ficha da ferramenta', fatia: '6',
    linhas: [
      l('Parede: Tipo de parede', rg('Tipo de parede'), b('Opções de Parede')),
      l('Porta: Tipo de porta', rg('Tipo de porta'), b('Opções de Porta')),
      // Forma do botão Sala: o rádio arma e fecha o menu; reabrir mostra as opções da forma armada.
      l('Região: Preenchimento', rg('Preenchimento'), b('Opções de Sala'), ['radio', 'Região'], b('Opções de Sala')),
      l('Sala: Preenchimento', rg('Preenchimento'), b('Opções de Sala'), ['radio', 'Retângulo'], b('Opções de Sala')),
      l('Sala Circular: Preenchimento', rg('Preenchimento'), b('Opções de Sala'), ['radio', 'Circular'], b('Opções de Sala')),
      l('Polígono Regular: Lados do polígono', rg('Lados do polígono'), b('Opções de Sala'), ['radio', 'Polígono'], b('Opções de Sala')),
      l('Sala livre: Criar (Sala / Parede)', rg('Criar'), b('Opções de Sala'), ['radio', 'Livre'], b('Opções de Sala')),
      l('Sala livre: Arredondar', rg('Arredondar'), b('Opções de Sala'), ['radio', 'Livre'], b('Opções de Sala')),
      l('Chão: Forma', rg('Forma'), b('Opções de Chão')),
      l('Chão: Tinta', rg('Tinta'), b('Opções de Chão')),
      l('Chão: Tamanho do pincel', rg('Tamanho do pincel'), b('Opções de Chão')),
      l('Chão: Operação', rg('Operação'), b('Opções de Chão')),
      l('Escada: Tamanho', rg('Tamanho'), b('Opções de Escada')),
      ...['Barril', 'Caixa', 'Baú', 'Cama', 'Mesa', 'Cadeira', 'Cerca', 'Armário de cozinha', 'Aparador', 'Fogueira', 'Tapete'].map((o) => l(`Objetos: ${o}`, ['radio', o], b('Opções de Objeto'), ['radio', 'Móvel'], b('Opções de Objeto'))),
      l('Desenho: Forma (7 formas)', rg('Forma'), b('Opções de Desenho')),
      l('Desenho: Modo (Traço livre / Balde)', rg('Modo'), b('Opções de Desenho')),
      l('Desenho: Textura do traço', rg('Textura do traço'), b('Opções de Desenho')),
      l('Borracha: Modo', rg('Modo'), b('Opções de Borracha')),
    ],
  },

  // ─── Ficha da ferramenta (nada selecionado) ───────────────────────────
  // Fatia 7: a cabeça (heading "Ferramenta · X", com "X" à vista) e, no
  // cartão, os controles de sempre mais as variantes que só moravam no
  // cantinho da barra (Forma, Tinta, Modo...). O "Chão do mapa" saiu da Ficha:
  // a nota "Ir para Cena" leva até ele (última linha do bloco, que muda a página).
  ...([
    ['Parede', [['heading', 'Ferramenta · Parede'], cx('Parede interna'), rg('Espessura da parede'), ['slider', 'Ajuste fino'], b('Avançado')]],
    ['Porta', [['heading', 'Ferramenta · Porta'], rg('Abrir na parede'), rg('Tipo de porta')]],
    ['Luz', [['heading', 'Ferramenta · Luz']]],
    ['Região', [['heading', 'Ferramenta · Região'], rg('Forma'), ...REGIAO_ESTILO]],
    ['Sala', [['heading', 'Ferramenta · Sala'], rg('Forma'), ...REGIAO_ESTILO]],
    ['Chão', [['heading', 'Ferramenta · Chão'], rg('Forma'), rg('Tinta'), rg('Operação')]],
    ['Caminho', [['heading', 'Ferramenta · Caminho'], ['textbox', 'Cor deste caminho'], ['slider', 'Largura']]],
    ['Penhasco', [['heading', 'Ferramenta · Penhasco'], rg('Ao riscar'), rg('Largura do pincel'), rg('Altura do penhasco'), b('Ligar o relevo')]],
    ['Texturas', [['heading', 'Ferramenta · Texturas'], rg('Ao pintar'), rg('Textura'), ['region', 'Colar ou soltar a imagem da nova textura'], b('Escolher imagem…'), b('Procurar texturas novas'), ['slider', 'Tamanho do pincel'], ['slider', 'Força']]],
    ['Carimbos', [['heading', 'Ferramenta · Carimbos'], rg('Ao clicar'), rg('Objeto'), ['radio', 'Árvore'], ['region', 'Colar ou soltar a imagem do novo carimbo'], b('Escolher imagem…'), b('Procurar carimbos novos'), ['slider', 'Tamanho'], ['slider', 'Largura do spray'], ['slider', 'Densidade do spray']]],
    ['Escada', [['heading', 'Ferramenta · Escada'], rg('Tamanho')]],
    ['Peça', [['heading', 'Ferramenta · Peça'], rg('Colocar')]],
    ['Zona oculta', [['heading', 'Ferramenta · Zona oculta']]],
    ['Pincel de revelar', [['heading', 'Ferramenta · Pincel de revelar'], rg('Ao pintar'), rg('Largura do pincel')]],
    ['Objetos', [['heading', 'Ferramenta · Objetos'], rg('Colocar'), rg('Objeto')]],
    ['Desenho', [['heading', 'Ferramenta · Pincel'], rg('Forma'), rg('Modo'), rg('Textura do traço'), ['textbox', 'Cor'], ['slider', 'Espessura'], rg('Ponta da linha')]],
    ['Texto', [['heading', 'Ferramenta · Texto'], ['textbox', 'Cor'], ['slider', 'Tamanho da fonte'], ['combobox', 'Fonte']]],
    ['Pino', [['heading', 'Ferramenta · Pino'], rg('Tipo do pino'), rg('Ícone no mapa')]],
    ['Medir', [['heading', 'Ferramenta · Medir']]],
    ['Borracha', [['heading', 'Ferramenta · Borracha'], rg('Modo')]],
  ] as const).map(([nome, alvos]): Bloco => ({
    tela: 'mestre', titulo: `Ficha da ferramenta: ${nome}`, estado: `ferramenta ${nome} armada, nada selecionado`, escopo: 'esquerda', preparo: ferramenta(nome),
    vai: nome === 'Penhasco' || nome === 'Texturas' || nome === 'Carimbos' ? 'Página Ficha, ficha da ferramenta com a biblioteca em grade de cartões (feito)' : 'Página Ficha, ficha da ferramenta: cabeça com dica e tecla (feito)', fatia: '7',
    linhas: nome === 'Chão'
      ? [...todos(alvos), { ...l('Chão do mapa', b('Chão do mapa'), b('Ir para Cena')), vai: 'Página Cena, pela nota "Ir para Cena" da ficha do Chão (feito, fatia 7)' }]
      : todos(alvos),
  })),

  // ─── Ficha da seleção ─────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Cabeça da ficha da seleção', estado: 'token selecionado no mapa', escopo: 'esquerda', preparo: sel('token', 't1'),
    vai: 'Cabeça da ficha: retrato ou medalha, nome, tipo, Apagar e "Mais ações" (feito)', fatia: '8',
    linhas: [l('Apagar', b('Apagar token selecionado')), l('Mais ações', b('Mais ações'))],
  },
  {
    tela: 'mestre', titulo: 'Ficha do token', estado: 'token selecionado no mapa', escopo: 'esquerda',
    // Esc depois de cada linha: na sub-ficha de um cartão ele volta à ficha (o cartão seguinte fica à vista); fora dela, larga a seleção, que o preparo refaz.
    preparo: { ...sel('token', 't1'), escape: true },
    vai: 'Página Ficha: Tipo de ficha, Nome, Condições, No mapa, Levar para outra cena, cartões de Comportamento (feito)', fatia: '9',
    linhas: [
      ...todos([cx('Ficha de NPC'), cx('Ficha de jogador')]),
      ...todos([['textbox', 'Nome'], rg('Nome para os jogadores')]),
      // Condições nasce aberta (protótipo): as pastilhas à vista, sem clique.
      ...['Envenenado', 'Caído', 'Dormindo', 'Atordoado', 'Invisível'].map((c) => l(`Condição: ${c}`, b(c))),
      // "No mapa" nasce fechada; o nome do cabeçalho leva o resumo ("No mapa 1 quadrado") enquanto ela está fechada.
      // Trava e visibilidade: botões de ícone (cadeado, floco, olho fechado), como no protótipo.
      ...todos([b('Travado'), b('Congelado'), b('Oculto para jogadores'), rg('Tamanho da ficha'), rg('Cor da ficha'), b('Escolher imagem...'), b('Salvar no acervo')], b('/^No mapa/')),
      l('Avançado: Rotação', ['spinbutton', 'Rotação'], b('/^No mapa/'), b('Avançado')),
      l('Avançado: Oculto no editor', cx('Oculto no editor'), b('/^No mapa/'), b('Avançado')),
      // Os cartões de Comportamento abrem a sub-ficha; o nome do cartão leva o resumo ("Vigia Desligada").
      l('Personagem', ['combobox', 'Personagem'], b('/^Personagem/')),
      l('Vigia: Esta ficha vigia', cx('Esta ficha vigia'), b('/^Vigia/')),
      l('Patrulha: Marcar ponto aqui', b('Marcar ponto aqui'), b('/^Patrulha/')),
      l('Patrulha: Patrulhar sozinha', b('Patrulhar sozinha'), b('/^Patrulha/')),
      l('Patrulha: Avançar patrulha', b('Avançar patrulha'), b('/^Patrulha/')),
      l('Veículo: Esta ficha é um veículo', cx('Esta ficha é um veículo'), b('/^Veículo/')),
      l('Piso', ['spinbutton', 'Piso'], b('/^Piso/')),
      l('Voltar da sub-ficha', b('Voltar para Goblin'), b('/^Vigia/')),
    ],
  },
  {
    tela: 'mestre', titulo: 'Ficha do pino (!)', estado: 'pino de exclamação selecionado', escopo: 'esquerda', preparo: sel('pin', 'pin-e'),
    vai: 'Página Ficha do pino: essencial + "+ Adicionar ao pino" + Aparência, Na mesa (feito)', fatia: '12',
    linhas: [
      // O essencial, sem clique; o Excluir mora na cabeça da ficha.
      ...todos([...PINO_ESSENCIAL, b('Excluir ponto de interesse')]),
      // A ficha recolhida "Aparência" (o nome do cabeçalho leva o resumo, daí a expressão).
      ...todos([...PINO_APARENCIA, rg('Ícone no mapa')], b('/^Aparência/')),
      // Cada recurso entra pelo menu "+ Adicionar ao pino" e ganha ficha própria, com "Tirar do pino".
      ...todos(PINO_RECURSOS, b('Adicionar ao pino')),
    ],
  },
  {
    tela: 'mestre', titulo: 'Ficha do pino de viagem', estado: 'pino de viagem selecionado', escopo: 'esquerda', preparo: sel('pin', 'pin-v'),
    vai: 'Página Ficha do pino: destino e Passagem no essencial, o resto na ficha "Mais da viagem" (feito)', fatia: '12',
    linhas: [
      ...todos([b('Leva a…'), rg('Passagem'), b('Excluir pino de viagem')]),
      ...todos(
        [...TRANSICAO('Transição ao atravessar'), ['combobox', 'Preso à ficha'], ['combobox', 'Cabine (elevador, cesto)'], ['textbox', 'Nova cabine'], b('Criar cabine aqui')],
        b('/^Mais da viagem/'),
      ),
    ],
  },
  {
    tela: 'mestre', titulo: 'Ficha da alavanca', estado: 'alavanca selecionada', escopo: 'esquerda', preparo: sel('pin', 'pin-a'),
    vai: 'Página Ficha do pino (alavanca com "Acionar agora") (feito)', fatia: '12',
    linhas: todos([['combobox', 'Abre a porta'], b('Excluir alavanca')]),
  },
  {
    tela: 'mestre', titulo: 'Ficha da porta', estado: 'porta selecionada no mapa', escopo: 'esquerda', preparo: sel('wall', 'd1'),
    vai: 'Página Ficha da porta: Estado, Trancada, Secreta, Espiar + Quem abre, Aparência, Parede em volta, Depende do estado (feito)', fatia: '11',
    linhas: [
      // O essencial, sem clique: o Estado é um seg (Aberta/Fechada com ícone) e os interruptores de sempre.
      ...todos([rg('Estado'), ['radio', 'Aberta'], cx('Trancada'), cx('Secreta'), cx('Jogador pode espiar')]),
      // As fichas nascem fechadas; o nome do cabeçalho leva o resumo ("Quem abre Os dois lados").
      l('Quem abre: Abre por', rg('Abre por'), b('/^Quem abre/')),
      ...todos([rg('Tipo de porta'), ['combobox', 'Animação ao abrir'], b('Procurar animações novas')], b('/^Aparência/')),
      ...todos(PAREDE_ESTILO, b('/^Parede em volta/')),
      // "Mais ações" da cabeça: abrir, trancar e virar parede (o menu fica aberto entre as linhas).
      ...todos([menu('Abrir agora'), menu('Trancar'), menu('Virar parede sólida')], b('Mais ações')),
    ],
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
      { ...l('Mais ações: levar ao piso', ['menuitem', '/^Levar ao/'], b('Mais ações')), vai: '"Mais ações" da cabeça da ficha (feito, fatia 8)' },
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
    linhas: [
      { ...l('Endireitar', menu('Endireitar'), b('Mais ações')), vai: '"Mais ações" da cabeça da ficha (feito, fatia 8)' },
      ...todos([cx('Oculto para jogadores'), ['textbox', 'Cor'], ['slider', 'Espessura'], cx('Paredes ao redor')]),
    ],
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
    vai: 'Página Ficha com 2 ou mais itens: cabeça que conta quantos e o essencial com o que vale para todos (feito)', fatia: '8',
    linhas: todos([b('Apagar 2 itens selecionados'), b('Agrupar (Ctrl+G)'), b('Limpar seleção de área'), b('Alinhar à esquerda'), b('Alinhar ao centro'), b('Alinhar à direita'), b('Alinhar ao topo'), b('Alinhar ao meio'), b('Alinhar à base'), b('Distribuir na horizontal'), b('Distribuir na vertical'), cx('Oculto para jogadores (1)')]),
  },

  // ─── Diálogos ─────────────────────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Configurações do mapa', estado: 'diálogo aberto pela engrenagem', escopo: 'pagina', preparo: { abrir: b('Configurações do mapa') },
    vai: 'Mesmo diálogo, casca nova com navegação vertical', fatia: '20',
    linhas: todos([rg('Formato da grade'), ['textbox', 'Cor da grade'], ['slider', 'Opacidade'], ['slider', 'Espessura'], rg('Estilo da linha da grade'), ['heading', 'Alinhar grade à imagem'], ['spinbutton', 'Unidades por célula'], ['textbox', 'Unidade'], ['spinbutton', 'Casas decimais'], ['combobox', 'Modo de medição'], ['spinbutton', 'Passo máximo (quadrados)'], cx('Fichas ocupam espaço'), ['spinbutton', 'Largura (quadros)'], ['spinbutton', 'Altura (quadros)'], b('Aplicar 30 × 20'), ['textbox', 'Texto de chegada'], cx('Rostos só de perto'), ['spinbutton', 'Casas'], b('Escolher sistema…')]),
  },
  {
    tela: 'mestre', titulo: 'Configurar cena', estado: 'diálogo aberto pela engrenagem da cena (livro da mesa, página Cenas)', escopo: 'pagina', preparo: { abrir: b('Configurar Cripta'), abrirDe: { escopo: 'direita', gatilho: marcador('Cenas') } },
    vai: 'Configurar cena com navegação vertical; Relevo, Nomes dos lugares e Nuvens na seção "Mapa vivo"', fatia: '20',
    linhas: [
      ...todos([['spinbutton', 'Visão nesta cena (quadrados)'], cx('Cena escura'), rg('Tipo de mapa'), cx('Relevo'), cx('Nomes dos lugares'), cx('Nuvens')]),
      l('Grupo anda junto (caravana), em mapa Continente', cx('Grupo anda junto (caravana)'), ['radio', 'Continente']),
    ],
  },
  {
    tela: 'mestre', titulo: 'Todas as cenas', estado: 'aberto pelo menu do chip da cena, "Ver todas as cenas"', escopo: 'pagina',
    preparo: { abrir: menu('Ver todas as cenas'), abrirDe: { escopo: 'chip', gatilho: b('/^Cripta/') } },
    vai: 'Chip da cena, "Ver todas as cenas" (feito); a janela muda na 20', fatia: '3 e 20',
    linhas: [l('Miniatura da cena', b('/^Cripta, 1 token/'))],
  },
  {
    tela: 'mestre', titulo: 'Atalhos do teclado', estado: 'aberto pelo "?"', escopo: 'pagina', preparo: { abrir: b('Atalhos do teclado') },
    vai: 'Diálogo Atalhos com a lista nova', fatia: '20',
    linhas: [l('Lista de atalhos', ['dialog', 'Atalhos do teclado'])],
  },

  // ─── Livro da mesa (direita) ──────────────────────────────────────────
  {
    tela: 'mestre', titulo: 'Livro da mesa, sala fechada', estado: 'app do mestre, sala fechada', escopo: 'direita',
    vai: 'Livro da mesa: topo da Sala (sala fechada), páginas Grupo e Mesa (feito); Personagens e Contas viram fichas recolhidas no fim do Grupo (fatia 5, feito)', fatia: '4 e 5',
    linhas: [
      l('Marcador Grupo (a aba Jogo de antes)', marcador('Grupo')),
      l('Abrir sala', b('Abrir sala')),
      l('Visão de jogador', b('Visão de jogador')),
      { ...l('Rede local (a dica do firewall)', ['dialog', 'Rede local'], b('Rede')), noPop: true },
      l('Personagens: + Personagem', b('+ Personagem'), marcador('Grupo'), b('Personagens')),
      l('Personagens: Importar personagens', b('Importar personagens…'), marcador('Grupo'), b('Personagens')),
      l('Contas: Só com conta', cx('Só com conta'), marcador('Grupo'), b('Contas dos jogadores')),
      l('Contas: nome da nova conta', ['textbox', 'Nome do jogador'], marcador('Grupo'), b('Contas dos jogadores')),
      l('Contas: PIN', ['textbox', 'PIN'], marcador('Grupo'), b('Contas dos jogadores')),
      l('Contas: + Conta', b('+ Conta'), marcador('Grupo'), b('Contas dos jogadores')),
      l('Mesa: Teste secreto (sem jogadores, Pedir teste apagado)', b('Pedir teste'), marcador('Mesa')),
      l('Mesa: Visão de jogador', b('/^Visão de jogador.*Teste/'), marcador('Mesa')),
      l('Mesa: Som da mesa (volume)', ['slider', 'Volume'], marcador('Mesa'), b('/^Som da mesa/')),
      l('Mesa: Som da mesa (mudo)', b('Mudo'), marcador('Mesa'), b('/^Som da mesa/')),
      { ...l('Recolher a página (Esconder a coluna da direita de antes)', b('Recolher a página')), vai: 'Seta no pé da lombada (feito)' },
    ],
  },
  {
    tela: 'mestre', titulo: 'Chat do mestre', estado: 'sala fechada', escopo: 'direita', vai: 'Marcador Chat do livro da mesa (feito)', fatia: '4',
    linhas: [{ ...l('Chat sem sala: o convite com Abrir sala (no lugar do "Ir para Jogo")', ['region', 'Chat dos jogadores'], marcador('Chat')), vai: 'Página Chat, "O chat abre junto com a sala" + Abrir sala' }],
  },
  {
    tela: 'mestre', titulo: 'Cenas', estado: 'aventura aberta, livro da mesa', escopo: 'direita',
    vai: 'Marcador Cenas do livro da mesa (feito)', fatia: '4',
    linhas: [
      ...todos([b('Cripta'), b('Renomear Cripta'), b('Mover Cripta para…'), b('Planta de Cripta'), b('Configurar Cripta'), b('+ Nova cena'), b('Revisar aventura')], marcador('Cenas')),
      ...['Duplicar', 'Subir', 'Descer', 'É a cena inicial', 'Apagar cena…'].map((m) => l(`Mais ações da cena: ${m}`, ['menuitem', m], marcador('Cenas'), b('Mais ações de Cripta'))),
    ],
  },
  {
    tela: 'mestre-sala-aberta', titulo: 'Livro da mesa, sala aberta', estado: 'sala aberta (código ONDE01), página Grupo', escopo: 'direita',
    vai: 'Livro da mesa: topo da Sala (código, Mais da sala, Laser, Som, Convidar) e página Mesa (feito)', fatia: '4',
    linhas: [
      l('Código da sala (copia ao clicar)', b('/^Código da sala ONDE01/')),
      l('Laser do mestre', b('Laser')),
      { ...l('Som da mesa (pop do botão Som)', ['slider', 'Volume'], b('Som')), noPop: true },
      l('Grupo', ['heading', 'Grupo'], marcador('Grupo')),
      { ...l('Convidar jogadores: Tornar pública', b('Tornar pública'), b('Convidar')), noPop: true },
      { ...l('Convidar jogadores: o pop com o QR, os endereços na rede local e a dica do firewall', ['dialog', 'Convidar jogadores'], b('Convidar')), noPop: true },
      l('Mais da sala: Visão de jogador', menu('Visão de jogador…'), b('Mais da sala')),
      l('Mais da sala: Fechar sala', menu('Fechar sala…'), b('Mais da sala')),
      { ...l('Fechar sala: a confirmação', ['alertdialog', 'Fechar a sala?'], b('Mais da sala'), menu('Fechar sala…')), noPop: true },
      l('Mesa: Teste secreto', b('/^Teste secreto/'), marcador('Mesa')),
      l('Mesa: Ruído', b('Ruído'), marcador('Mesa'), b('/^Ruído/')),
      l('Mesa: Alcance do ruído', ['combobox', 'Alcance do ruído'], marcador('Mesa'), b('/^Ruído/')),
      l('Mesa: Diário de viagens', b('/^Diário de viagens/'), marcador('Mesa')),
      l('Mesa: Tela da mesa, Cena na tela', ['combobox', 'Cena na tela'], marcador('Mesa'), b('/^Tela da mesa/')),
    ],
  },

  // ─── Grupo com jogadores (fatia 5) ────────────────────────────────────
  {
    tela: 'mestre-com-jogadores', titulo: 'Grupo: alto, Chegando, cena e linha', estado: 'sala aberta; Ana na Cripta, Bruno chegando sem ficha, Caio fora', escopo: 'direita',
    vai: 'Busca com o chip Pedindo; Chegando aberto; cena com Ir à cena, Congelar e Pausar no título; linha com Ir lá e Recado; Congelar todos no pé', fatia: '5',
    linhas: [
      l('Buscar jogador', ['searchbox', 'Buscar jogador']),
      l('Pedindo (chip do alto)', b('/^Pedindo/')),
      l('Chegando: Atribuir a ficha livre', b('/Atribuir Goblin$/')),
      l('Chegando: lista Atribuir token', ['combobox', 'Atribuir token']),
      l('Chegando: Emprestar como ajudante', b('Emprestar como ajudante…')),
      l('Chegando: Expulsar', b('Expulsar')),
      l('Cena: recolher e abrir', b('/^Cripta.*jogadores/')),
      ...todos([b('Ir à cena Cripta'), b('Congelar a cena Cripta'), b('Pausar a cena Cripta')]),
      ...todos([b('Ir lá: Ana'), b('Recado para Ana')]),
      l('Congelar todos (pé)', b('Congelar todos')),
    ],
  },
  {
    tela: 'mestre-com-jogadores', titulo: 'Grupo: ficha de Ana, cada parte do seg', estado: 'Ana jogando na Cripta, ficha aberta', escopo: 'direita', dentro: ['group', 'Ficha de Ana'],
    vai: 'Seg Ações · Mochila · Visão · Ficha dentro da ficha aberta', fatia: '5',
    linhas: [
      ...todos([b('Seguir'), b('Mandar para…'), b('Ver tela de Ana'), b('Dar o que o grupo viu'), ['combobox', 'Passar o mapa de Ana a'], b('Dar um mapa a Ana'), b('Emprestar como ajudante…'), b('Expulsar')], b('/Ana — jogando/'), ['radio', 'Ações']),
      ...todos([b('Dar item a Ana'), b('Moedas de Ana'), b('Propor troca a Ana')], b('/Ana — jogando/'), ['radio', 'Mochila']),
      ...todos([['slider', 'Raio de visão'], ['slider', 'Fator de visão'], b('Revelar planta'), b('Esconder de novo')], b('/Ana — jogando/'), ['radio', 'Visão']),
      ...todos([b('Remover Guerreira'), ['combobox', 'Atribuir token']], b('/Ana — jogando/'), ['radio', 'Ficha']),
    ],
  },
  {
    tela: 'mestre-com-jogadores', titulo: 'Grupo: ficha de Caio, fora da mesa', estado: 'Caio desconectado com ficha na Cripta, ficha aberta', escopo: 'direita', dentro: ['group', 'Ficha de Caio'],
    vai: 'Parte Ações, blocos Ficha e Sair da mesa; parte Ficha', fatia: '5',
    linhas: [
      ...todos([b('Guardar ficha'), ['combobox', 'Emprestar ficha a'], ['combobox', 'Passar fichas e mapa a'], b('Dispensar')], b('/Caio — jogando/'), ['radio', 'Ações']),
      l('Remover Ladino', b('Remover Ladino'), b('/Caio — jogando/'), ['radio', 'Ficha']),
    ],
  },
  {
    tela: 'mestre-com-jogadores', titulo: 'Grupo: pé depois de congelar', estado: 'a mesa congelada pelo Congelar todos', escopo: 'direita',
    vai: 'Descongelar todos no pé do Grupo', fatia: '5',
    linhas: [l('Descongelar todos', b('Descongelar todos'), b('Congelar todos'))],
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
  ['Voltar à cena anterior (seta do chip da cena, fatia 3)', 'só aparece depois de viajar entre cenas; ChipDaCena.test.tsx cobre'],
  ['Menu Arquivo com imagem de fundo (Trocar imagem, Chão a partir da imagem, Linhas e portas, Recriar minimapa)', 'só com imagem de fundo; sem ela o item é "Importar imagem de fundo…" (coberto); LivroDoMestre.test.tsx cobre os quatro'],
  ['Configurações do mapa: "Esconder Aventura e Esta cena ao usar ferramenta" (Categorias do painel)', 'aposentada na fatia 2: Aventura e Cena viraram páginas do livro, e quem tinha a escolha salva não quebra (a chave sai do aparelho)'],
  ['Endireitar na sala ou parede solta', 'só com traço torto; coberto no desenho'],
  ['Marcas dos jogadores (MarcasDaCena)', 'só com marcas deixadas por jogadores'],
  ['Visto por / Ninguém vê (abaixo do tipo de ficha), Levar para outra cena (ficha), Rotina e Luzes (cartões de Comportamento) do token', 'pedem sala aberta, outra cena ou Estado do mundo com valores; PropertiesPanel.ficha.test.tsx abre Rotina e Luzes'],
  [
    'Vida do token (Vida atual, Vida máxima, Jogadores veem a barra)',
    'saiu da ficha do token na fatia 9 (D); desde a fatia 10 a barra no mapa lê o HP da ficha do sistema ligada no cartão "Personagem" (o ajuste é na própria ficha: "Abrir ficha" > HP). Mestre vê sempre; jogador vê a das fichas de jogador e das que controla, só a proporção. A vida antiga fica no arquivo sem uso. task-jornada-barra-de-vida.spec.ts cobre',
  ],
  ['Livro de regras (página Mesa; e Grupo com a sala fechada)', 'só com sistema de RPG que tem livro'],
  ['Divisor "Altura das Cenas" (coluna da direita)', 'saiu na fatia 4: as Cenas viraram uma página do livro da mesa e não há mais altura a repartir; a chave guardada sai do aparelho'],
  [
    'Grupo do mestre (fatia 5): sob o título de cada cena, o pedido de passagem ("Deixar ir: <nome>", "Não: <nome>")',
    'pede um jogador que viajou até um pino de passagem ligado a outra cena; GrupoCompacto.test.tsx e PartySection.test.tsx alcançam os dois botões sob o título da cena (o resto do Grupo com jogadores está no estado "mestre com jogadores")',
  ],
  ['Teste secreto com jogadores (Teste, Para quem, Pedir teste, Encerrar), na ficha Teste secreto da página Mesa', 'só com jogadores na sala; sem eles a ficha mostra o aviso e o Pedir teste apagado (coberto)'],
  ['Pausa geral dos NPCs (faixa no alto da página Grupo e "Pausar todos os NPCs" no "Mais da sala")', 'só com NPC andando; TopoDaSala.test.tsx cobre o item do menu'],
  ['Depende do estado (porta, luz, zona, pino)', 'só com Estado do mundo criado'],
  ['Jogador: Ficha, Grupo, Meus personagens em outra cena, abas Caderno/Lugares/Dados por dentro', 'pedem sistema de RPG, colegas ou histórico; as abas estão cobertas'],
]
