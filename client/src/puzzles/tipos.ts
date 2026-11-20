/**
 * CONTRATO DOS PUZZLES (1ª leva, plano `docs/design/puzzles/PLANO.md` §1.2,
 * §1.3, §2.1 e §2.3; protótipo aprovado `docs/design/puzzles/prototipo-v2.html`).
 *
 * O puzzle é um jogo do registro de minigames (`'puzzle'`), guardado num
 * Desafio do mapa (`Desafio.minigame`); o progresso de todos mora ao lado, em
 * `Desafio.progressoDoPuzzle`, para que editar a cópia ou o Ctrl+Z do mestre
 * não apaguem o que os jogadores já puseram.
 *
 * Arquivo só de tipos e constantes: importa do app apenas TIPOS (`import type`),
 * para que `types/map.ts`, `minigames/tipos.ts`, a rede e as telas dependam
 * daqui sem ciclo em tempo de execução.
 *
 * O sufixo "DoPuzzle" é de propósito: `MapData.encaixeNaGrade` já existe e
 * quer dizer outra coisa.
 */
import type { CarriedItem, ItemNoConteudo } from '../types/map'

/** A versão do desafio gravado. O leitor (`puzzles/leitor.ts`) migra ao subir. */
export const VERSAO_DO_PUZZLE = 1

// ------------------------------------------------------------------ tetos

export const ENCAIXES_MAX = 12
export const NOME_DO_PUZZLE_MAX = 60
export const INSCRICAO_MAX = 80
/** Dica e texto do desfecho: o protótipo não tem teto; este cabe num cartão de leitura. */
export const TEXTO_DO_PUZZLE_MAX = 600
/** O texto do castigo ("Dardos saem das frestas do pedestal."). */
export const TEXTO_DO_CASTIGO_MAX = 140
/** Nome da peça inteira das metades (o nome de peça do protótipo tem 40). */
export const NOME_DA_PECA_MAX = 40
/** O tamanho do encaixe, em % da largura do quadro (a alça do editor do v2). */
export const TAMANHO_DO_ENCAIXE_MIN = 3
export const TAMANHO_DO_ENCAIXE_MAX = 22
/** O tamanho dos controles da combinação (v2), guardado já nesta leva. */
export const ESCALA_DO_CONTROLE_MIN = 0.6
export const ESCALA_DO_CONTROLE_MAX = 1.6
/** Troca de peso: o mostrador do v1 vai de 0 a 8. */
export const PESO_MIN = 1
export const PESO_MAX = 8
/** Pedras que cabem na bandeja: com peso mínimo 1, mais de 8 nunca acerta o pedido. */
export const BANDEJA_MAX = PESO_MAX
/** Peças com peso marcado num puzzle (as pedras do v1 são 3). */
export const PESOS_MAX = 24
/** PV do castigo: o campo do v2 vai de 1 a 20. */
export const PV_DO_CASTIGO_MAX = 20
/** Documentos dados ao resolver. */
export const DOCUMENTOS_DO_DESFECHO_MAX = 10

// ------------------------------------------------------------------ o desafio gravado

/** Desafio gravado: o que entra em `MinigamesPorJogo['puzzle']`. */
export interface MinigamePuzzle {
  jogo: 'puzzle'
  /** `VERSAO_DO_PUZZLE` nesta leva; uma versão maior (app mais novo) é guardada como veio. */
  versao: number
  /** Exigido por `nomePadraoDoDesafio`, que lê `minigame.npc`; sempre vazio. */
  npc: ''
  /** De qual "Meus puzzles" veio; `null` = feito aqui. */
  modeloId: string | null
  /** A cópia mudou depois de sair do modelo ("mudada só aqui"). */
  mudadaAqui?: true
  puzzle: Puzzle
}

export interface Puzzle {
  /** O nome do mestre, só dele. */
  nome: string
  /** O título que o jogador vê (pode ser vazio). */
  nomePublico: string
  regra: RegraDoPuzzle
  visual: VisualDoPuzzle
  /** De 0 a `ENCAIXES_MAX`. */
  encaixes: EncaixeDoPuzzle[]
  /** Troca de peso (v1: o pedestal e a bandeja); `null` = sem troca. */
  troca: TrocaDePeso | null
  dica: DicaDoPuzzle
  desfecho: DesfechoDoPuzzle
  castigo: CastigoDoPuzzle
  /** Posição dos controles da combinação (v2), em % do quadro; nesta leva só é guardada. */
  controle: { x: number; y: number; s: number }
  /** Levas 2 a 4 (§1.6). Nesta leva o editor nunca cria; o leitor guarda o que vier. */
  futuro?: MecanicaFutura
}

/**
 * `qualquerLugar`: qualquer peça do conjunto em qualquer encaixe (a Fonte).
 * `lugarCerto`: cada encaixe só aceita a dele (o Altar).
 * `ordem`: qualquer peça do conjunto entra em qualquer encaixe, e a tranca só
 * cede com cada uma no seu número (a Porta). Só aqui (e na troca) há erro: no
 * Encaixe a peça errada nem entra.
 */
export type RegraDoPuzzle = 'qualquerLugar' | 'lugarCerto' | 'ordem'
export const REGRAS_DO_PUZZLE: readonly RegraDoPuzzle[] = ['qualquerLugar', 'lugarCerto', 'ordem']

export type ModeloDoPuzzle = 'fonte' | 'porta' | 'cofre' | 'altar'
export const MODELOS_DO_PUZZLE: readonly ModeloDoPuzzle[] = ['fonte', 'porta', 'cofre', 'altar']

/** A moldura do modelo: o desenho dele, ou a porta de pedra com os encaixes no mesmo lugar (19/11 21h30). */
export type MolduraDoPuzzle = 'original' | 'porta'

export interface CoresDoModelo {
  parede: string
  chao: string
  objeto: string
}

export type VisualDoPuzzle =
  | { tipo: 'modelo'; modelo: ModeloDoPuzzle; cores: CoresDoModelo; inscricao: string; moldura: MolduraDoPuzzle }
  /** `imagem` = `midia:<id>`; `null` = o mestre ainda não escolheu ("Sem imagem ainda", v2). */
  | { tipo: 'imagem'; imagem: string | null }

export type FormaDoEncaixe = 'redondo' | 'brasao' | 'joia' | 'quadrado'
export const FORMAS_DO_ENCAIXE: readonly FormaDoEncaixe[] = ['redondo', 'brasao', 'joia', 'quadrado']

/** Posição e tamanho em % do quadro: o mesmo número serve o editor, o teste e a tela do jogador. */
interface LugarDoEncaixe {
  id: string
  x: number
  y: number
  /** Largura, em % da largura do quadro. */
  t: number
  forma: FormaDoEncaixe
}

export type EncaixeDoPuzzle =
  /** `itemId` = a peça certa, um `ItemDoCatalogo.id` do acervo; `null` = o mestre ainda não escolheu. */
  | (LugarDoEncaixe & { jeito: 'peca'; itemId: string | null })
  /**
   * Juntar peças: as duas metades entram no mesmo encaixe e viram uma peça só,
   * que existe só no puzzle (`vira`). Vale qualquer que seja a regra.
   */
  | (LugarDoEncaixe & { jeito: 'metades'; metades: [string | null, string | null]; vira: { nome: string; imagem: string | null } })

/** Troca de peso: a peça guardada sai do pedestal quando a bandeja pesa o pedido. */
export interface TrocaDePeso {
  /** O `itemId` do acervo que vai para a mochila de quem apertou "Trocar". */
  guarda: string
  /** De `PESO_MIN` a `PESO_MAX`. */
  peso: number
  /** `itemId` -> peso. Mora aqui, e não no item, para não mexer no esquema da mochila nem no lobby. */
  pesos: Record<string, number>
  /** O centro do pedestal e da bandeja, em % do quadro. */
  x: number
  y: number
}

export type DicaDoPuzzle = { tipo: 'texto'; texto: string } | { tipo: 'documento'; docId: string }

export interface DesfechoDoPuzzle {
  /** A escolha que VOLTOU (a decisão 17 do v2 foi desfeita): só o texto, ou a arte se mexe e depois vem o texto. */
  modo: 'texto' | 'cena'
  texto: string
  /** O mesmo tipo do conteúdo do baú. */
  itens: ItemNoConteudo[]
  moedas: number
  /** Ids da biblioteca "Documentos". */
  documentos: string[]
  /** Só com moldura Porta ou o modelo 'porta'; a parede é `Desafio.portaLigada`. */
  abrePorta: boolean
}

export type CastigoDoPuzzle =
  | { tipo: 'nada' }
  | { tipo: 'dano'; pv: number; texto: string }
  | { tipo: 'armadilha'; pv: number; texto: string }
  /** Avisa o mestre com toast. */
  | { tipo: 'barulho'; texto: string }

export type TipoDeCastigo = CastigoDoPuzzle['tipo']

// ------------------------------------------------------------------ levas 2 a 4 (só o lugar, §1.6)

/**
 * As mecânicas previstas, para a tela dizer qual é. Combinação (rodas de
 * números e de símbolos, relógio, sequência de botões, com a resposta só no
 * mestre e conferida no host pelo "Tentar"); peças giratórias; luzes (os
 * fusíveis são encaixes comuns); empurrar estátuas (no mapa, não na tela de perto).
 */
export type MecanicaPrevista = 'combinacao' | 'giratorias' | 'luzes' | 'estatuas'
export const MECANICAS_PREVISTAS: readonly MecanicaPrevista[] = ['combinacao', 'giratorias', 'luzes', 'estatuas']

/**
 * A mecânica de uma leva futura, guardada COMO VEIO: o objeto do disco
 * inteiro, e não `{ tipo, bruto }` embrulhado, porque o mapa é gravado por
 * `JSON.stringify` e o embrulho estragaria o arquivo para o app mais novo. Um
 * app desta leva não joga um puzzle com `futuro` ("Este puzzle é de uma versão
 * mais nova do app"), mas também não o apaga ao salvar.
 */
export interface MecanicaFutura {
  tipo: string
  readonly [campo: string]: unknown
}

// ------------------------------------------------------------------ o progresso (de todos, no mapa)

/** Quem pôs, tirou ou agiu. O nome vai ao jogador ("posto por Bento"); os ids, nunca. */
export interface QuemMexe {
  personagemId: string | null
  tokenId: string
  nome: string
}

export interface PecaPosta {
  /** A vaga inteira (com quantidade 1), para voltar igual à mochila de quem pôs. */
  vaga: CarriedItem
  por: QuemMexe
}

/** As metades de um encaixe `metades`; pelo menos uma está posta (o encaixe vazio é `null`). */
export interface MetadesPostas {
  a: PecaPosta | null
  b: PecaPosta | null
}

export interface ProgressoDoPuzzle {
  /** Sobe a cada mudança; a tela velha é recusada (`velho`). */
  rev: number
  /** Pelo id do encaixe; ausente ou `null` = vazio. */
  encaixes: Record<string, PecaPosta | MetadesPostas | null>
  /** Troca de peso, na ordem em que entraram. Depois da troca ficam presas. */
  bandeja: PecaPosta[]
  trocaFeita: boolean
  resolvido: { por: string; em: number } | null
  erros: number
  /**
   * Levas 2 a 4 (§1.6): os controles da combinação, as rotações das peças
   * giratórias e as luzes. Nesta leva o motor não mexe; o leitor guarda o que
   * vier, para um app desta leva não zerar o progresso de um puzzle mais novo.
   */
  controles?: Record<string, number | number[]>
  rotacoes?: number[]
  luzes?: boolean[]
}

// ------------------------------------------------------------------ "Meus puzzles" (§1.3)

export interface ModeloDePuzzle {
  id: string
  criadoEm: number
  mudadoEm: number
  puzzle: Puzzle
}

export interface IndiceDeMeusPuzzles {
  versao: 1
  modelos: ModeloDePuzzle[]
}

// ------------------------------------------------------------------ peças de puzzle (§1.4)

/** A categoria do acervo das peças de puzzle (e a pasta de mesmo nome). */
export const CATEGORIA_DA_PECA_DE_PUZZLE = 'Peça de puzzle'

/** As 13 peças desenhadas da biblioteca do v2 (`PECAS_BASE`); a arte mora em `puzzles/arte/pecas.ts`. */
export type IdDaPecaDesenhada =
  | 'bra-carvalho'
  | 'bra-lobo'
  | 'bra-lua'
  | 'bra-sol'
  | 'chave-jardim'
  | 'chave-latao'
  | 'engr-bronze'
  | 'engr-ferro'
  | 'joia-ambar'
  | 'joia-safira'
  | 'med-garca'
  | 'med-sapo'
  | 'med-junco'

// ------------------------------------------------------------------ o motor (§2.1)

export type AcaoNoPuzzle =
  /** `metade` só escolhe o lado quando as duas metades são o mesmo item. */
  | { tipo: 'por'; encaixeId: string; vagaId: string; metade?: 'a' | 'b' }
  | { tipo: 'tirar'; encaixeId: string }
  | { tipo: 'porNaBandeja'; vagaId: string }
  /** Tira a última pedra posta. */
  | { tipo: 'tirarDaBandeja' }
  | { tipo: 'trocar' }
// Leva 2: 'girar' (controle, passo) e 'tentar'.

/**
 * Por que o pedido não valeu. Os 6 primeiros são os da mensagem
 * `puzzle.recusado` (§2.2): `longe` e `velho` saem do host; o resto, do motor.
 */
export type MotivoDaRecusa =
  | 'longe'
  | 'ocupado'
  | 'velho'
  | 'mudou'
  | 'nao_encaixa'
  | 'resolvido'
  | 'vazio'
  | 'sem_vaga'
  | 'sem_peca_certa'
  | 'sem_peso'
  | 'bandeja_cheia'
  | 'troca_feita'
  | 'versao_nova'

/** O texto que o jogador lê na recusa (os do v2 e do v1). */
export const TEXTO_DA_RECUSA: Readonly<Record<MotivoDaRecusa, string>> = {
  longe: 'Você está longe demais.',
  ocupado: 'Já tem uma peça aqui. Tire-a antes.',
  velho: 'O puzzle mudou enquanto você mexia.',
  mudou: 'O mestre mudou este puzzle.',
  nao_encaixa: 'Não encaixa aqui.',
  resolvido: 'Preso: o puzzle já foi resolvido.',
  vazio: 'Não há nada aqui para tirar.',
  sem_vaga: 'Essa peça não está mais na mochila.',
  sem_peca_certa: 'Este encaixe ainda não tem peça certa: o mestre não escolheu.',
  sem_peso: 'Na bandeja só vão pedras com peso marcado.',
  bandeja_cheia: 'Não cabe mais nada na bandeja.',
  troca_feita: 'A troca já foi feita.',
  versao_nova: 'Este puzzle é de uma versão mais nova do app.',
}

/** O castigo que de fato faz algo (o `nada` não sai como efeito). */
export type CastigoQueAge = Exclude<CastigoDoPuzzle, { tipo: 'nada' }>

export type EfeitoDoPuzzle =
  | { tipo: 'recusado'; motivo: MotivoDaRecusa }
  /** As duas metades se juntaram neste encaixe. */
  | { tipo: 'juntou'; encaixeId: string }
  /** Tudo cheio na ordem errada, ou a bandeja com o peso errado. */
  | { tipo: 'errou'; em: 'ordem' }
  | { tipo: 'errou'; em: 'peso'; soma: number; pedido: number }
  | { tipo: 'resolveu' }
  /** A peça guardada saiu do pedestal e foi para a mochila de quem trocou. */
  | { tipo: 'trocou'; guarda: string }
  /**
   * Uma peça saiu do puzzle e é de OUTRA pessoa (a de quem age já voltou à
   * mochila devolvida pelo motor): quem chamou a põe na ficha dela.
   */
  | { tipo: 'devolver'; para: QuemMexe; vaga: CarriedItem }
  /** Só no jogo, nunca no teste: o desfecho a entregar a quem resolveu. */
  | { tipo: 'entregar'; para: QuemMexe; desfecho: DesfechoDoPuzzle }
  /** Só no jogo, nunca no teste: o castigo de quem errou. */
  | { tipo: 'castigar'; para: QuemMexe; castigo: CastigoQueAge }

/** O item do acervo como ele vai para a mochila (o mesmo formato de `ItemParaDar` em `lib/items.ts`). */
export type PecaDoAcervo = Omit<CarriedItem, 'id' | 'acesa'>

export interface ContextoDoMotor {
  quem: QuemMexe
  /** Relógio do host (ms desde 1970), para o `resolvido.em`. O motor não lê relógio. */
  agora: number
  /**
   * `teste`: o "Testar como jogador" do editor, com uma mochila de mentira. A
   * conta é a MESMA do jogo; só não saem `entregar` nem `castigar`.
   */
  modo: 'jogo' | 'teste'
  /** O item do acervo pelo id (a peça guardada da troca); `null` = o mestre o apagou. */
  pecaDoAcervo: (itemId: string) => PecaDoAcervo | null
  /** Id novo para uma vaga que entra na mochila. */
  novoId: () => string
}

export interface ResultadoDoMotor {
  progresso: ProgressoDoPuzzle
  /** A mochila de quem agiu, depois da ação. */
  mochila: CarriedItem[]
  efeitos: EfeitoDoPuzzle[]
}

// ------------------------------------------------------------------ o recorte do jogador (§2.3)

/** O que está num encaixe, como o jogador vê. */
export interface PostaNaVista {
  nome: string
  imagem: string | null
  /** Quem pôs ("Lara", ou "Lara e Bento" nas metades juntas). */
  por: string
}

export interface EncaixeNaVista {
  id: string
  x: number
  y: number
  t: number
  forma: FormaDoEncaixe
  jeito: 'peca' | 'metades'
  posta: PostaNaVista | null
  /** Só nas metades: quantas estão postas. */
  metadesPostas?: 0 | 1 | 2
}

export interface VagaNaVista {
  vagaId: string
  nome: string
  imagem: string | null
  /** Quantas a vaga tem (a pilha de peças iguais): é a mochila dele, nada a esconder. */
  quantidade: number
  /** É da categoria "Peça de puzzle" (as peças vêm primeiro). Nunca quer dizer "serve aqui". */
  peca: boolean
}

/**
 * O puzzle como vai ao jogador, montado por LISTA BRANCA em `puzzles/recorte.ts`.
 * Nunca vão: a peça certa de cada encaixe, a regra e a ordem certa, a peça
 * guardada da troca, os pesos, o castigo antes do erro, o desfecho antes de
 * resolver, a porta ligada, o `modeloId` e o nome do mestre.
 */
export interface VistaDoPuzzle {
  desafioId: string
  rev: number
  /** O `nomePublico`. */
  titulo: string
  /** A arte e a imagem: o que ele vê olhando. */
  visual: VisualDoPuzzle
  encaixes: EncaixeNaVista[]
  /** O peso pedido vai porque o mostrador do v1 o mostra. */
  troca: { x: number; y: number; pesoPedido: number; naBandeja: { nome: string; peso: number }[]; feita: boolean } | null
  /**
   * Num documento que ele não leu, só sabe que existe: `podeLer: false` e título vazio. O que ele já leu leva o
   * `docId`, que já está na lista dele, para o "Ler" reabrir pela lista (`documento.ler` com `daLista`).
   */
  dica: { tipo: 'texto'; texto: string } | { tipo: 'documento'; titulo: string; podeLer: true; docId: string } | { tipo: 'documento'; titulo: string; podeLer: false } | null
  resolvido: boolean
  contagem: { postos: number; total: number }
  /** A mochila DELE. */
  mochila: VagaNaVista[]
  /** O puzzle traz uma mecânica de uma leva que este app não joga. */
  versaoNova?: true
}
