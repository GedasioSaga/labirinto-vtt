/**
 * REGISTRO ÚNICO DOS MINIGAMES (Fase B do pedido de 15/11/2026). Cada jogo
 * declara aqui: id, nome, aba (ação ou puzzle), ícone, onde o desafio pode ficar, como ele pode
 * começar, o desafio padrão, o recorte do jogador e os desfechos que produz.
 * Os pontos que antes repetiam a união dos jogos (o padrão e o nome em
 * `lib/pins.ts`, o recorte em `lib/fogFilter.ts`, a leitura em
 * `lib/mapFile.ts`, a página Jogos) leem daqui.
 *
 * Só dados e funções puras, sem React: o disco, o recorte e o host importam
 * este arquivo. O painel do mestre de cada jogo mora em
 * `components/MinigameControls.tsx`, e a leitura campo a campo do disco em
 * `lib/mapFile.ts`, cada um numa tabela com uma entrada por jogo deste
 * registro (`MinigamesPorJogo`): jogo novo sem painel ou sem leitor não compila.
 */
import type { TipoDoLugarDoDesafio } from '../types/map'
import { FALA_DO_CENARIO_BOLHA, MINIGAME_BOLHA_PADRAO, type MinigameBolha } from './bolha/tipos'
import { MINIGAME_PADRAO, type MinigameDanca } from './danca/tipos'
import type { TipoDeDesfecho } from './desfecho'
import { MINIGAME_FOGO_PADRAO, type MinigameFogo } from './fogo/tipos'
import { MINIGAME_PESCA_PADRAO, type MinigamePesca } from './pesca/tipos'
import { MINIGAME_TIRO_PADRAO, type MinigameTiro } from './tiro/tipos'
import { CONVITE_DA_CENA_ALAVANCA, MINIGAME_ALAVANCA_PADRAO, NOME_DO_DESAFIO_DA_CENA_ALAVANCA, type MinigameAlavanca } from './alavanca/tipos'
import type { JogoDoMinigame, MinigameDoPino, MinigameVisivel } from './tipos'
import { JOGOS_PORTADOS, type JogoDoObjeto } from './abrir/objeto'
import { puzzleDoModelo } from '../puzzles/padroes'
import { VERSAO_DO_PUZZLE, type MinigamePuzzle } from '../puzzles/tipos'

/** O desafio gravado de cada jogo, pelo id do jogo. */
export interface MinigamesPorJogo {
  danca: MinigameDanca
  pesca: MinigamePesca
  tiro: MinigameTiro
  fogo: MinigameFogo
  bolha: MinigameBolha
  alavanca: MinigameAlavanca
  puzzle: MinigamePuzzle
}

/** Como o desafio começa: o jogador encosta no selo e toca, ou o mestre convida. */
export type EntradaDoDesafio = 'pino' | 'mestre'

/**
 * A aba do jogo na página Jogos: os minigames de AÇÃO (dança, pesca, tiro,
 * fogo, bolha) ou os PUZZLES (plano dos puzzles, §0). Os jogos de objeto
 * (baú, caixa, barril) têm a aba deles e não moram neste registro.
 */
export type CategoriaDoJogo = 'acao' | 'puzzle'

export interface DefinicaoDoMinigame<J extends JogoDoMinigame> {
  id: J
  /** O nome do jogo para o mestre e no cartão ("Pesca", "Fogo na Floresta"). */
  nome: string
  /** O que o jogo é, em uma linha: a escolha do jogo da página Jogos (editor de 21/11/2026). */
  resumo: string
  categoria: CategoriaDoJogo
  /** O símbolo do selo e da lista (`minigames/simbolosDosJogos.ts`), um por jogo. */
  icone: J
  /** Onde o desafio deste jogo pode ficar. */
  lugares: readonly TipoDoLugarDoDesafio[]
  /** Como ele pode começar. A dança sempre começa pelo mestre. */
  entradas: readonly EntradaDoDesafio[]
  /** Cópia nova do desafio do protótipo do jogo (nunca a constante). */
  padrao: () => MinigamesPorJogo[J]
  /** Como começa o desafio gravado (o jogador encosta, ou o mestre chama). */
  entradaDe: (minigame: MinigamesPorJogo[J]) => EntradaDoDesafio
  /**
   * O pouco que vai ao JOGADOR (`MinigameVisivel`): o jogo e como começa; do
   * fogo e da bolha também quem pede ajuda e a fala, só com o selo legível.
   * Prêmio, consequência, música e porta nunca vão.
   */
  recorteDoJogador: (minigame: MinigamesPorJogo[J], legivel: boolean) => MinigameVisivel
  /** O que o fim do jogo pode fazer no estado do jogo (`minigames/desfecho.ts`). */
  desfechos: readonly TipoDeDesfecho[]
  /** O verbo do convite, depois de quem chama ("Dona Ziza desafia para uma dança"); vazio no puzzle, que não tem convite. */
  verbo: string
  /** Quando não há o que escolher em "Como começa", a regra em uma frase (a dança, o fogo e o puzzle). */
  regraDeEntrada?: string
  /** Três falas prontas para o convite, pela cena ou cenário do desafio (decisão 8 do editor). */
  falasSugeridas: (minigame: MinigamesPorJogo[J]) => readonly FalaSugerida[]
}

/** Uma fala pronta da escolha rápida do convite: o rótulo do botão e o texto. */
export interface FalaSugerida {
  rotulo: string
  texto: string
}

const TODOS_OS_LUGARES: readonly TipoDoLugarDoDesafio[] = ['ponto', 'objeto', 'nenhum']

/** A fala e quem pede ajuda vão ao cartão só com o selo legível, e só com texto. */
function comPedidoDeAjuda(visivel: MinigameVisivel, minigame: { npc: string; fala: string }, legivel: boolean): MinigameVisivel {
  if (legivel && typeof minigame.npc === 'string' && minigame.npc.trim() !== '') visivel.npc = minigame.npc
  if (legivel && typeof minigame.fala === 'string' && minigame.fala.trim() !== '') visivel.fala = minigame.fala
  return visivel
}

export const REGISTRO_DE_MINIGAMES: { readonly [J in JogoDoMinigame]: DefinicaoDoMinigame<J> } = {
  danca: {
    id: 'danca',
    resumo: 'Setas no ritmo da música.',
    nome: 'Dança',
    categoria: 'acao',
    icone: 'danca',
    lugares: TODOS_OS_LUGARES,
    entradas: ['mestre'],
    padrao: () => structuredClone(MINIGAME_PADRAO),
    entradaDe: () => 'mestre',
    recorteDoJogador: () => ({ jogo: 'danca', entrada: 'mestre' }),
    desfechos: ['abrir porta'],
    verbo: 'desafia para uma dança',
    regraDeEntrada: 'A dança começa quando você chama: todos entram juntos na música.',
    falasSugeridas: () => [
      { rotulo: 'Clássica', texto: MINIGAME_PADRAO.fala },
      { rotulo: 'Curta', texto: 'Quer passar? Então dança comigo.' },
      { rotulo: 'Provocadora', texto: 'Já vi estátua com mais molejo que vocês. Provem que estou errada.' },
    ],
  },
  pesca: {
    id: 'pesca',
    resumo: 'Lançar a linha e segurar o peixe.',
    nome: 'Pesca',
    categoria: 'acao',
    icone: 'pesca',
    lugares: TODOS_OS_LUGARES,
    entradas: ['pino', 'mestre'],
    padrao: () => structuredClone(MINIGAME_PESCA_PADRAO),
    entradaDe: (minigame) => (minigame.entrada === 'pino' ? 'pino' : 'mestre'),
    // O torto cai no mestre: o cartão nunca oferece começar sozinho por engano.
    recorteDoJogador: (minigame) => ({ jogo: 'pesca', entrada: minigame.entrada === 'pino' ? 'pino' : 'mestre' }),
    desfechos: [],
    verbo: 'convida para pescar',
    falasSugeridas: () => [
      { rotulo: 'Clássica', texto: MINIGAME_PESCA_PADRAO.fala },
      { rotulo: 'Curta', texto: 'Tem linha, tem isca, tem peixe. Só falta a sua mão.' },
      { rotulo: 'Misteriosa', texto: 'Tem coisa lá no fundo que não é peixe. Joga a linha e me diz o que puxou.' },
    ],
  },
  tiro: {
    id: 'tiro',
    resumo: 'Tiro ao alvo numa fileira que não para.',
    nome: 'Tiro',
    categoria: 'acao',
    icone: 'tiro',
    lugares: TODOS_OS_LUGARES,
    entradas: ['pino', 'mestre'],
    padrao: () => structuredClone(MINIGAME_TIRO_PADRAO),
    entradaDe: (minigame) => (minigame.entrada === 'pino' ? 'pino' : 'mestre'),
    recorteDoJogador: (minigame) => ({ jogo: 'tiro', entrada: minigame.entrada === 'pino' ? 'pino' : 'mestre' }),
    desfechos: [],
    verbo: 'chama para a barraca',
    falasSugeridas: () => [
      { rotulo: 'Clássica', texto: MINIGAME_TIRO_PADRAO.fala },
      { rotulo: 'Curta', texto: 'Doze balas, uma fileira que não para. Quem derruba mais leva o prêmio.' },
      { rotulo: 'Provocadora', texto: 'Todo mundo jura que tem mira até a fileira começar a andar. Vai tentar ou vai só olhar?' },
    ],
  },
  fogo: {
    id: 'fogo',
    resumo: 'Apagar o incêndio, sozinho ou em equipe.',
    nome: 'Fogo na Floresta',
    categoria: 'acao',
    icone: 'fogo',
    lugares: TODOS_OS_LUGARES,
    // "Apagar o fogo" começa sozinho no selo; a equipe vem do convite do mestre. Não há o que escolher:
    // o `entrada` gravado no fogo é de antes e não vale (`entradaDe`).
    entradas: ['pino'],
    padrao: () => structuredClone(MINIGAME_FOGO_PADRAO),
    entradaDe: () => 'pino',
    recorteDoJogador: (minigame, legivel) => comPedidoDeAjuda({ jogo: 'fogo', entrada: 'pino' }, minigame, legivel),
    desfechos: [],
    verbo: 'pede ajuda',
    regraDeEntrada: 'No selo, qualquer jogador apaga sozinho. A equipe, você chama.',
    falasSugeridas: () => [
      { rotulo: 'Urgente', texto: MINIGAME_FOGO_PADRAO.fala },
      { rotulo: 'Curta', texto: 'Fogo descendo o morro! Quem tiver água, areia ou coragem, vem comigo.' },
      { rotulo: 'Calma', texto: 'O fogo ainda está longe da vila, mas o vento não ajuda. Se formos agora, dá tempo.' },
    ],
  },
  bolha: {
    id: 'bolha',
    resumo: 'Apagar focos de fogo com bolhas.',
    nome: "Bolha d'Água",
    categoria: 'acao',
    icone: 'bolha',
    lugares: TODOS_OS_LUGARES,
    entradas: ['pino', 'mestre'],
    padrao: () => structuredClone(MINIGAME_BOLHA_PADRAO),
    entradaDe: (minigame) => (minigame.entrada === 'pino' ? 'pino' : 'mestre'),
    recorteDoJogador: (minigame, legivel) =>
      comPedidoDeAjuda({ jogo: 'bolha', entrada: minigame.entrada === 'pino' ? 'pino' : 'mestre' }, minigame, legivel),
    desfechos: [],
    verbo: 'pede ajuda',
    falasSugeridas: (minigame) =>
      minigame.cenario === 'casa'
        ? [
            { rotulo: 'Urgente', texto: FALA_DO_CENARIO_BOLHA.casa },
            { rotulo: 'Curta', texto: 'Fogo na cozinha! Faz bolha comigo, rápido.' },
            { rotulo: 'Calma', texto: 'A panela esqueceu de mim e eu dela. Uma bolha aqui, outra ali, e a casa fica de pé.' },
          ]
        : [
            { rotulo: 'Urgente', texto: FALA_DO_CENARIO_BOLHA.clareira },
            { rotulo: 'Curta', texto: 'Fogo no capim! Faz bolha comigo, rápido.' },
            { rotulo: 'Calma', texto: 'É só um foguinho, mas sozinha eu não alcanço tudo. Uma bolha aqui, outra ali, e pronto.' },
          ],
  },
  alavanca: {
    id: 'alavanca',
    resumo: 'Girar juntos sem parar: ponte ou canhão.',
    // O nome do jogo; o do desafio é o da cena ("Alavanca da ponte", "Alavanca do canhão": `nomeDoJogoDoDesafio`).
    nome: 'Alavanca',
    categoria: 'acao',
    icone: 'alavanca',
    lugares: TODOS_OS_LUGARES,
    // De 1 a 4 giram juntos: o mestre chama a equipe; com 'pino', quem encosta no selo gira sozinho.
    entradas: ['pino', 'mestre'],
    padrao: () => structuredClone(MINIGAME_ALAVANCA_PADRAO),
    entradaDe: (minigame) => (minigame.entrada === 'pino' ? 'pino' : 'mestre'),
    // A cena vai junto: o cartão do jogador fala da ponte ou do canhão (B6 das NOTAS do editor).
    recorteDoJogador: (minigame) => ({ jogo: 'alavanca', entrada: minigame.entrada === 'pino' ? 'pino' : 'mestre', cena: minigame.cena === 'canhao' ? 'canhao' : 'ponte' }),
    // A vitória abre a porta ligada do desafio (a ponte do mestre aplica, `net/hostBridge.ts`).
    desfechos: ['abrir porta'],
    verbo: 'chama para a alavanca',
    falasSugeridas: (minigame) =>
      minigame.cena === 'canhao'
        ? [
            { rotulo: 'Clássica', texto: CONVITE_DA_CENA_ALAVANCA.canhao.fala },
            { rotulo: 'Curta', texto: 'O canhão dorme debaixo das lajes. Girem a alavanca juntos e não parem.' },
            { rotulo: 'Tensa', texto: 'Os tambores do inimigo já se ouvem. O canhão só sobe se ninguém largar a alavanca.' },
          ]
        : [
            { rotulo: 'Clássica', texto: CONVITE_DA_CENA_ALAVANCA.ponte.fala },
            { rotulo: 'Curta', texto: 'A ponte está erguida. Girem a alavanca juntos e não parem.' },
            { rotulo: 'Tensa', texto: 'Do outro lado do fosso, algo se mexe. A ponte só desce se ninguém largar a alavanca.' },
          ],
  },
  puzzle: {
    id: 'puzzle',
    resumo: 'Peças, encaixes e combinações para examinar.',
    nome: 'Puzzle',
    categoria: 'puzzle',
    icone: 'puzzle',
    // Sem 'nenhum': o puzzle não vira convite do mestre nem pino ▷ antigo; o jogador encosta e examina.
    lugares: ['ponto', 'objeto'],
    entradas: ['pino'],
    padrao: puzzlePadrao,
    entradaDe: () => 'pino',
    // Só o jogo: a configuração e o progresso vão pela `VistaDoPuzzle`, a quem entra nele (`puzzles/recorte.ts`).
    recorteDoJogador: () => ({ jogo: 'puzzle', entrada: 'pino' }),
    desfechos: ['abrir porta', 'dar itens', 'dano'],
    verbo: '',
    regraDeEntrada: 'O jogador encosta no selo e examina. O puzzle não tem convite do mestre.',
    falasSugeridas: () => [],
  },
}

/** O puzzle novo da página Jogos: o primeiro modelo pronto (a Fonte), feito aqui e sem progresso. */
function puzzlePadrao(): MinigamePuzzle {
  return { jogo: 'puzzle', versao: VERSAO_DO_PUZZLE, npc: '', modeloId: null, puzzle: puzzleDoModelo('fonte') }
}

/** A ordem dos jogos na escolha do mestre (a mesma de `JOGOS_DO_MINIGAME`). */
export const ORDEM_DOS_JOGOS: readonly JogoDoMinigame[] = ['danca', 'pesca', 'tiro', 'fogo', 'bolha', 'alavanca', 'puzzle']

/** O jogo é um que este app conhece? (arquivo de versão futura pode trazer outro). */
export function ehJogoDoRegistro(valor: unknown): valor is JogoDoMinigame {
  return typeof valor === 'string' && Object.prototype.hasOwnProperty.call(REGISTRO_DE_MINIGAMES, valor)
}

export function nomeDoJogo(jogo: JogoDoMinigame): string {
  return REGISTRO_DE_MINIGAMES[jogo].nome
}

/** O nome do jogo como o desafio gravado o mostra: a alavanca na cena do canhão é a "Alavanca do canhão". */
export function nomeDoJogoDoDesafio(minigame: MinigameDoPino): string {
  if (minigame.jogo === 'alavanca') return NOME_DO_DESAFIO_DA_CENA_ALAVANCA[minigame.cena]
  return nomeDoJogo(minigame.jogo)
}

/** As falas prontas do convite deste desafio, pelo registro do jogo dele (e pela cena ou cenário). */
export function falasSugeridasDo(minigame: MinigameDoPino): readonly FalaSugerida[] {
  return falasPor(minigame.jogo, minigame)
}

function falasPor<J extends JogoDoMinigame>(jogo: J, minigame: MinigamesPorJogo[J]): readonly FalaSugerida[] {
  return REGISTRO_DE_MINIGAMES[jogo].falasSugeridas(minigame)
}

/** Cópia nova do desafio padrão do jogo. */
export function padraoDoJogo<J extends JogoDoMinigame>(jogo: J): MinigamesPorJogo[J] {
  return REGISTRO_DE_MINIGAMES[jogo].padrao()
}

function entradaPor<J extends JogoDoMinigame>(jogo: J, minigame: MinigamesPorJogo[J]): EntradaDoDesafio {
  return REGISTRO_DE_MINIGAMES[jogo].entradaDe(minigame)
}

function recortePor<J extends JogoDoMinigame>(jogo: J, minigame: MinigamesPorJogo[J], legivel: boolean): MinigameVisivel {
  return REGISTRO_DE_MINIGAMES[jogo].recorteDoJogador(minigame, legivel)
}

/** Como começa o desafio gravado, pelo registro do jogo dele. */
export function entradaDoMinigame(minigame: MinigameDoPino): EntradaDoDesafio {
  return entradaPor(minigame.jogo, minigame)
}

/**
 * O recorte do jogador de um desafio, pelo registro do jogo dele. Sem desafio
 * gravado, ou com um jogo que este app não conhece (mapa montado sem passar
 * pelo disco), vale a dança e o mestre: o cartão nunca oferece começar sozinho.
 */
export function recorteDoMinigame(minigame: MinigameDoPino | undefined, legivel: boolean): MinigameVisivel {
  if (minigame === undefined || !ehJogoDoRegistro(minigame.jogo)) return { jogo: 'danca', entrada: 'mestre' }
  return recortePor(minigame.jogo, minigame, legivel)
}

/**
 * JOGOS DE OBJETO (Fases C e D, 15/11/2026): abrir o baú, arrombar a caixa e
 * quebrar o barril. Não moram em desafio nem em pino: a ENTRADA é o objeto (o
 * jogador encosta no móvel e toca), o jogo vem do tipo do móvel e o conteúdo
 * mora no próprio objeto (`Prop.conteudo`, `lib/conteudoDoObjeto.ts`). Por
 * isso ficam fora de `MinigamesPorJogo`: não têm painel do mestre nem leitor
 * no disco (a ficha do objeto, seção Conteúdo, faz as vezes do painel).
 *
 * O desfecho da vitória (itens para a mochila, a picada e a pastilha) é UMA
 * gravação só no mapa e na ficha de personagem (`net/objetoNoHost.ts`,
 * `applyObjetoAberto`): três aplicadores separados escreveriam a mesma ficha
 * três vezes, e a última apagaria as outras.
 */
export interface DefinicaoDoJogoDeObjeto {
  id: JogoDoObjeto
  nome: string
  /** O móvel do catálogo que abre com este jogo. */
  objeto: JogoDoObjeto
  entrada: 'objeto'
  desfechos: readonly TipoDeDesfecho[]
}

export const REGISTRO_DE_JOGOS_DE_OBJETO: { readonly [J in JogoDoObjeto]: DefinicaoDoJogoDeObjeto & { id: J } } = {
  bau: { id: 'bau', nome: 'Abrir o baú', objeto: 'bau', entrada: 'objeto', desfechos: ['dar itens', 'dano', 'efeito'] },
  caixa: { id: 'caixa', nome: 'Arrombar a caixa', objeto: 'caixa', entrada: 'objeto', desfechos: ['dar itens', 'dano', 'efeito'] },
  barril: { id: 'barril', nome: 'Quebrar o barril', objeto: 'barril', entrada: 'objeto', desfechos: ['dar itens', 'dano', 'efeito'] },
}

/** O jogo de objeto deste móvel, se está no app; `null` = o móvel não abre (ainda). */
export function jogoDeObjetoDoMovel(tipo: string | undefined): JogoDoObjeto | null {
  return JOGOS_PORTADOS.find((jogo) => jogo === tipo) ?? null
}
