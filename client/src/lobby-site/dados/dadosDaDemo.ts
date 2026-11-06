import type { CarriedItem } from '../../types/map'
import { CONTA_DO_MESTRE, type FichaGuardada, type Membro } from '../../lib/nuvem/tipos'
import type { CartaoDaFicha, Personagem } from '../../lib/personagem'

/**
 * DADOS DA DEMO (`?demo=1`): TODOS INVENTADOS, no molde do protótipo aprovado
 * (docs/design/lobby/prototipo.html). Nenhuma ficha real: o repositório é
 * público. E-mails só `@example.com`. A ficha segue o sistema One Piece do
 * app (`lib/sistemaOnePiece.ts`: HP, SP, Escudo e os oito atributos).
 */

export const EMAIL_DA_DEMO = 'bia.souza@example.com'
const CONTA_DA_BIA = 'conta_bia'

interface Pessoa {
  contaId: string
  nome: string
  email: string
}

const BIA: Pessoa = { contaId: CONTA_DA_BIA, nome: 'Bia', email: EMAIL_DA_DEMO }
const CAIO: Pessoa = { contaId: 'conta_caio', nome: 'Caio', email: 'caio.rocha@example.com' }
const DUDA: Pessoa = { contaId: 'conta_duda', nome: 'Duda', email: 'duda.lins@example.com' }
const LEO: Pessoa = { contaId: 'conta_leo', nome: 'Léo', email: 'leo.prado@example.com' }
const GUI: Pessoa = { contaId: 'conta_gui', nome: 'Gui', email: 'gui.alves@example.com' }
const MEL: Pessoa = { contaId: 'conta_mel', nome: 'Mel', email: 'mel.costa@example.com' }

/** Ordem dos oito atributos do One Piece em `atr`. */
const ATRIBUTOS: readonly string[] = ['forca', 'agilidade', 'percepcao', 'resistencia', 'intuicao', 'espirito', 'carisma', 'determinacao']

/** `[nome, quantidade, descrição]` */
type ItemDaDemo = readonly [string, number, string]
/** `[nome, ação, custo, dano, descrição]` */
type HabilidadeDaDemo = readonly [string, string, string, string, string]

interface MoldeDaFicha {
  raca: string
  oficio: string
  hp: readonly [number, number]
  sp: readonly [number, number]
  escudo: number
  moedas: number
  atr: readonly number[]
  mochila: readonly ItemDaDemo[]
  habilidades: readonly HabilidadeDaDemo[]
}

/** Acento fora (o NFD separa a letra do acento) e o resto que não é letra nem número vira `_`: o id passa no segmento do caminho. */
function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase()
}

function itemDaMochila(fichaId: string, [nome, quantidade, descricao]: ItemDaDemo): CarriedItem {
  return { id: `vaga_${fichaId}_${slug(nome)}`, nome, itemId: `item_${slug(nome)}`, empilhavel: true, quantidade, descricao }
}

function habilidade(fichaId: string, [nome, acao, custo, dano, descricao]: HabilidadeDaDemo): CartaoDaFicha {
  return { id: `cart_${fichaId}_${slug(nome)}`, nome, campos: { descricao, acao, custo, dano }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

function ficha(curto: string, nome: string, dono: Pessoa | null, molde: MoldeDaFicha, extra: Partial<Personagem> = {}): Personagem {
  const id = `pers_${curto}`
  return {
    id,
    tipo: 'jogador',
    nome,
    descricao: `${molde.raca}, ${molde.oficio.toLowerCase()}.`,
    retrato: null,
    escolhas: { raca: molde.raca, oficio: molde.oficio },
    etiquetas: [],
    recursos: { hp: molde.hp[0], sp: molde.sp[0], escudo: molde.escudo },
    maximos: { hp: molde.hp[1], sp: molde.sp[1] },
    modificadoresDosRecursos: {},
    atributos: Object.fromEntries(ATRIBUTOS.map((atributo, i) => [atributo, molde.atr[i] ?? 0])),
    modificadoresDosAtributos: {},
    cartoesAtivos: [],
    historico: [],
    abas: { habilidades: molde.habilidades.map((h) => habilidade(curto, h)) },
    mochila: molde.mochila.map((item) => itemDaMochila(curto, item)),
    moedas: molde.moedas,
    ...(dono === null ? {} : { dono: dono.contaId }),
    ...extra,
  }
}

const SORA = ficha('sora', 'Sora Maretta', BIA, {
  raca: 'Humano',
  oficio: 'Navegador',
  hp: [34, 40],
  sp: [18, 25],
  escudo: 3,
  moedas: 750,
  atr: [34, 72, 90, 40, 88, 12, 60, 45],
  mochila: [
    ['Poção de maré', 4, 'Cura 2d6 de Vida. Gosto de alga.'],
    ['Bomba de fumaça', 2, 'Cobre 3 metros de fumaça cinza por uma rodada.'],
    ['Pão de bordo', 5, 'Duro como a âncora, mas alimenta.'],
    ['Bússola de vidro', 1, 'Aponta para o que você mais quer, nem sempre para o norte.'],
  ],
  habilidades: [
    ['Leitura do Vento', 'Bônus', '3 de Energia', '', 'Prevê a próxima rajada: o barco ganha 2 de deslocamento.'],
    ['Corte de Maré', 'Padrão', '5 de Energia', '2d8 + AGI', 'Um golpe em arco que acompanha a onda.'],
  ],
})

const TANUKI = ficha('tanuki', 'Tanuki Bento', BIA, {
  raca: 'Mink',
  oficio: 'Cozinheiro',
  hp: [36, 36],
  sp: [12, 20],
  escudo: 5,
  moedas: 310,
  atr: [55, 40, 33, 90, 41, 0, 70, 38],
  mochila: [
    ['Panela de ferro', 1, 'Pesa mais do que parece.'],
    ['Tempero do sul', 4, 'Uma pitada e o caldo cura mais 1.'],
  ],
  habilidades: [['Caldo Quente', 'Completa', '6 de Energia', '', 'Todos os aliados ao alcance recuperam 1d6 de Vida.']],
})

const GAEL = ficha('gael', 'Gael Ferrolho', CAIO, {
  raca: 'Humano',
  oficio: 'Ferreiro',
  hp: [18, 44],
  sp: [9, 22],
  escudo: 4,
  moedas: 820,
  atr: [96, 30, 41, 150, 22, 5, 18, 60],
  mochila: [['Lingote de ferro', 3, 'Vira lâmina com uma noite de forja.']],
  habilidades: [['Martelo de Brasa', 'Padrão', '4 de Energia', '2d6 + FOR', 'O martelo sai da forja ainda vermelho.']],
})

const IARA = ficha('iara', 'Iara Tormenta', DUDA, {
  raca: 'Tritão',
  oficio: 'Médico',
  hp: [27, 30],
  sp: [21, 28],
  escudo: 2,
  moedas: 540,
  atr: [25, 61, 80, 38, 130, 40, 52, 70],
  mochila: [['Bandagem de alga', 6, 'Estanca sangue e cheira a mar.']],
  habilidades: [['Pulso de Coral', 'Padrão', '4 de Energia', '', 'Toca o peito do aliado: ele recupera 2d6 de Vida.']],
})

const BARTO = ficha('barto', 'Bartô Cinzas', LEO, {
  raca: 'Humano',
  oficio: 'Gatuno',
  hp: [22, 32],
  sp: [15, 24],
  escudo: 1,
  moedas: 2040,
  atr: [30, 95, 66, 20, 50, 8, 81, 33],
  mochila: [['Gazua', 3, 'Abre quase tudo. Quase.']],
  habilidades: [['Mão Leve', 'Bônus', '2 de Energia', '', 'Tira um objeto pequeno de quem estiver ao lado sem ser visto.']],
})

/** Jogador sem conta (só o nome): os colegas veem, só o mestre edita (12.6). */
const ONDINO = ficha(
  'ondino',
  'Ondino Velho',
  null,
  {
    raca: 'Ogro',
    oficio: 'Carpinteiro',
    hp: [52, 60],
    sp: [10, 14],
    escudo: 8,
    moedas: 75,
    atr: [140, 12, 30, 240, 35, 2, 25, 90],
    mochila: [['Serrote', 1, 'Dentes gastos de tanto casco.']],
    habilidades: [['Remendo de Casco', 'Completa', '5 de Energia', '', 'Fecha um rombo no barco com o que tiver à mão.']],
  },
  { nomeDoJogador: 'Vô Nico' },
)

/** NPC do mestre: nunca chega ao jogador (a projeção some com ele). */
const CAPITAO = ficha(
  'capitao_ferrugem',
  'Capitão Ferrugem',
  null,
  { raca: 'Humano', oficio: 'Pirata', hp: [80, 80], sp: [30, 30], escudo: 6, moedas: 0, atr: [150, 60, 70, 200, 50, 30, 40, 90], mochila: [], habilidades: [] },
  { tipo: 'npc', notaDoMestre: 'Aparece no fim do arco das ilhas.' },
)

function arma(fichaId: string, nome: string, dano: string, descricao: string): CartaoDaFicha {
  return { id: `arma_${fichaId}_${slug(nome)}`, nome, campos: { descricao, dano }, extras: [], atributos: [], imagem: null, modificadores: [], subcartoes: [] }
}

/**
 * Os inimigos que o mestre liberou para o treino (T8, T7): a cópia que o app publica com `visivel: 'treino'`
 * e o id `treino_<id do NPC>`, sem nota do mestre, dono nem mochila. Um fraco e um forte, para dar escolha.
 */
function inimigoDoTreino(curto: string, nome: string, molde: MoldeDaFicha, armas: readonly CartaoDaFicha[]): FichaGuardada {
  const npc = ficha(curto, nome, null, molde, { tipo: 'npc' })
  const doc: Personagem = { ...npc, id: `treino_${npc.id}`, mochila: [], abas: { ...npc.abas, armas: [...armas] } }
  return { doc, apagada: false, visivel: 'treino', rev: 0 }
}

const RECRUTA = inimigoDoTreino(
  'recruta_da_marinha',
  'Recruta da Marinha',
  { raca: 'Humano', oficio: 'Marinheiro', hp: [30, 30], sp: [10, 10], escudo: 2, moedas: 0, atr: [25, 30, 25, 30, 20, 5, 10, 20], mochila: [], habilidades: [] },
  [arma('recruta_da_marinha', 'Cassetete', '6', 'Madeira dura, pintada de azul.')],
)

const TENENTE = inimigoDoTreino(
  'tenente_garra',
  'Tenente Garra',
  {
    raca: 'Humano',
    oficio: 'Oficial',
    hp: [70, 70],
    sp: [20, 20],
    escudo: 6,
    moedas: 0,
    atr: [60, 45, 40, 80, 35, 20, 30, 60],
    mochila: [],
    habilidades: [['Bote da Garra', 'Simples', '6 SP', 'Força + 10', 'Avança e crava a garra no mais fraco.']],
  },
  [arma('tenente_garra', 'Garra de aço', '12', 'Três lâminas curtas presas ao pulso.')],
)

const LUA = ficha('lua', 'Lua Pimenta', BIA, {
  raca: 'Skypean',
  oficio: 'Artista',
  hp: [24, 28],
  sp: [22, 26],
  escudo: 2,
  moedas: 600,
  atr: [20, 70, 55, 30, 60, 35, 95, 40],
  mochila: [['Rabeca', 1, 'Toca sozinha quando venta.']],
  habilidades: [],
})

const CASCO = ficha('casco', 'Casco Duro', GUI, {
  raca: 'Ogro',
  oficio: 'Carpinteiro',
  hp: [48, 50],
  sp: [8, 12],
  escudo: 7,
  moedas: 90,
  atr: [120, 10, 22, 200, 18, 0, 15, 70],
  mochila: [['Machado', 1, 'Cabo curto, lâmina larga.']],
  habilidades: [],
})

const NEVOA = ficha('nevoa', 'Névoa Sal', MEL, {
  raca: 'Lunariano',
  oficio: 'Cientista',
  hp: [20, 26],
  sp: [24, 30],
  escudo: 1,
  moedas: 410,
  atr: [18, 50, 70, 25, 140, 60, 40, 55],
  mochila: [['Lente de bolso', 1, 'Aumenta dez vezes.']],
  habilidades: [],
})

const VELA = ficha('vela', 'Vela Rubra', BIA, {
  raca: 'Humano',
  oficio: 'Navegador',
  hp: [26, 30],
  sp: [16, 20],
  escudo: 2,
  moedas: 100,
  atr: [30, 45, 60, 35, 50, 10, 40, 30],
  mochila: [['Luneta', 1, 'Vê o farol de longe.']],
  habilidades: [],
})

const RUIVO = ficha('ruivo', 'Ruivo Anzol', CAIO, {
  raca: 'Tritão',
  oficio: 'Gatuno',
  hp: [22, 24],
  sp: [14, 18],
  escudo: 1,
  moedas: 300,
  atr: [28, 66, 40, 22, 30, 5, 35, 25],
  mochila: [['Anzol de prata', 2, 'Pesca até bota.']],
  habilidades: [],
})

/** A vaga do item na mochila da ficha (erro de programa se não existir: os dados são fixos). */
function vagaDe(doc: Personagem, nome: string): string {
  const vaga = doc.mochila?.find((item) => item.nome === nome)
  if (vaga === undefined) throw new Error(`demo: ${doc.nome} sem "${nome}" na mochila`)
  return vaga.id
}

/** Uma mudança que já estava no log quando a página abriu (o histórico não nasce vazio). */
export interface MudancaAntiga {
  /** O `contaId` de quem mudou. */
  quem: string
  fichaId: string
  caminho: string[]
  acao: 'definir' | 'somar'
  valor?: number
  delta?: number
  minutosAtras: number
}

export interface CampanhaDaDemo {
  campanhaId: string
  nome: string
  membros: Membro[]
  fichas: FichaGuardada[]
  antigas: MudancaAntiga[]
}

function membro(pessoa: Pessoa): Membro {
  return { contaId: pessoa.contaId, email: pessoa.email, nome: pessoa.nome, papel: 'jogador', estado: 'ativo' }
}

function mestre(nome: string, email: string): Membro {
  return { contaId: CONTA_DO_MESTRE, email, nome, papel: 'mestre', estado: 'ativo' }
}

function naMesa(doc: Personagem): FichaGuardada {
  return { doc, apagada: false, visivel: 'mesa', rev: 0 }
}

/** As três mesas da Bia, do protótipo. Cada chamada monta tudo de novo (a demo começa igual a cada página aberta). */
export function campanhasDaDemo(): CampanhaDaDemo[] {
  return [
    {
      campanhaId: 'rota-das-ilhas',
      nome: 'Rota das Ilhas Partidas',
      membros: [mestre('Rafa', 'rafa.mestre@example.com'), membro(BIA), membro(CAIO), membro(DUDA), membro(LEO)],
      fichas: [naMesa(SORA), naMesa(TANUKI), naMesa(GAEL), naMesa(IARA), naMesa(BARTO), naMesa(ONDINO), { ...naMesa(CAPITAO), visivel: 'mestre' }, RECRUTA, TENENTE],
      antigas: [
        { quem: CONTA_DO_MESTRE, fichaId: SORA.id, caminho: ['moedas'], acao: 'somar', delta: 500, minutosAtras: 21 },
        { quem: CONTA_DO_MESTRE, fichaId: SORA.id, caminho: ['recursos', 'hp'], acao: 'definir', valor: 30, minutosAtras: 6 },
        { quem: CONTA_DA_BIA, fichaId: SORA.id, caminho: ['mochila', vagaDe(SORA, 'Poção de maré'), 'quantidade'], acao: 'somar', delta: -1, minutosAtras: 2 },
        { quem: CAIO.contaId, fichaId: GAEL.id, caminho: ['recursos', 'escudo'], acao: 'definir', valor: 6, minutosAtras: 30 },
      ],
    },
    {
      campanhaId: 'mar-de-cobre',
      nome: 'Mar de Cobre',
      membros: [mestre('Tati', 'tati.mestra@example.com'), membro(BIA), membro(GUI), membro(MEL)],
      fichas: [naMesa(LUA), naMesa(CASCO), naMesa(NEVOA)],
      antigas: [{ quem: CONTA_DA_BIA, fichaId: LUA.id, caminho: ['recursos', 'sp'], acao: 'definir', valor: 20, minutosAtras: 60 * 24 }],
    },
    {
      campanhaId: 'farol-sem-fundo',
      nome: 'O Farol Sem Fundo',
      membros: [mestre('Rafa', 'rafa.mestre@example.com'), membro(BIA), membro(CAIO)],
      fichas: [naMesa(VELA), naMesa(RUIVO)],
      antigas: [{ quem: CONTA_DO_MESTRE, fichaId: VELA.id, caminho: ['moedas'], acao: 'somar', delta: 50, minutosAtras: 60 * 24 * 12 }],
    },
  ]
}
