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
  /** Posição e tamanho dos controles da combinação (v2), em % do quadro. */
  controle: { x: number; y: number; s: number }
  /**
   * A mecânica que não é de encaixe (§1.6), no lugar que o plano previu: a
   * Combinação (`tipo: 'combinacao'`), que este app joga, ou a de uma leva
   * futura, guardada como veio. Lida sempre por `combinacaoDoPuzzle`
   * (`puzzles/combinacao.ts`): o que ela não reconhece é "versão nova".
   */
  futuro?: CombinacaoDoPuzzle | GiratoriasDoPuzzle | MecanicaFutura
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
  | VisualDoRelevo

// ------------------------------------------------------------------ o painel em relevo (28/11, PEDIDOS item 2)

/**
 * O PAINEL EM RELEVO: um quadro de metal na parede, cortado em placas
 * (`COLUNAS_DO_RELEVO` x `LINHAS_DO_RELEVO`); as placas que faltam são os
 * encaixes (cada um com a `placa` dele) e as peças certas são itens do
 * acervo, um por placa, que os jogadores acham no mapa. A regra é sempre a
 * do lugar certo: a placa errada nem entra.
 *
 * `cena` = um relevo de fábrica (`puzzles/relevo/arte.ts`); `null` = a imagem
 * do mestre (`imagem`, `midia:<id>`; `null` = ainda sem imagem) cortada nas
 * mesmas placas. `metal` pinta a moldura e o relevo.
 */
export interface VisualDoRelevo {
  tipo: 'relevo'
  cena: CenaDoRelevo | null
  imagem: string | null
  metal: MetalDoRelevo
}

export type CenaDoRelevo = 'cavaleiro' | 'dragao' | 'navio' | 'leao' | 'serpente' | 'solELua'
export const CENAS_DO_RELEVO: readonly CenaDoRelevo[] = ['cavaleiro', 'dragao', 'navio', 'leao', 'serpente', 'solELua']

export type MetalDoRelevo = 'bronze' | 'ferro' | 'prata'
export const METAIS_DO_RELEVO: readonly MetalDoRelevo[] = ['bronze', 'ferro', 'prata']

/** As placas do painel: 4 colunas por 3 linhas, numeradas linha a linha (0 a 11). */
export const COLUNAS_DO_RELEVO = 4
export const LINHAS_DO_RELEVO = 3
export const PLACAS_DO_RELEVO = COLUNAS_DO_RELEVO * LINHAS_DO_RELEVO
/** Quantas placas faltam: de 3 a 6 (o pedido do dono). */
export const LACUNAS_DO_RELEVO_MIN = 3
export const LACUNAS_DO_RELEVO_MAX = 6
export const LACUNAS_DO_RELEVO_PADRAO = 4

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
  /**
   * Só no painel em relevo: a placa que falta aqui (0 a `PLACAS_DO_RELEVO` - 1).
   * O desenho do vão sai dela; `x`, `y` e `t` ficam no meio da placa, para o
   * app que não conhece o relevo mostrar ao menos um encaixe no lugar.
   */
  placa?: number
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

// ------------------------------------------------------------------ a combinação (leva 2, antecipada em 20/11)

/** Os 4 tipos do grilling de 19/11: rodas de números, rodas de símbolos, ponteiros de relógio e sequência de botões. */
export type FormaDaCombinacao = 'numeros' | 'simbolos' | 'relogio' | 'botoes'
export const FORMAS_DA_COMBINACAO: readonly FormaDaCombinacao[] = ['numeros', 'simbolos', 'relogio', 'botoes']

/** Os 6 glifos das rodas de símbolos do v2 (`SIMBOLOS`), nesta ordem: a roda gira por eles. */
export type SimboloDaRoda = 'ancora' | 'estrela' | 'peixe' | 'coroa' | 'chave' | 'olho'
export const SIMBOLOS_DA_RODA: readonly SimboloDaRoda[] = ['ancora', 'estrela', 'peixe', 'coroa', 'chave', 'olho']

/** O editor do v2: de 3 a 6 rodas, de 2 a 6 botões e uma sequência de até 12 toques. */
export const RODAS_MIN = 3
export const RODAS_MAX = 6
export const BOTOES_MIN = 2
export const BOTOES_MAX = 6
export const SEQUENCIA_MAX = 12
/** O nome de um botão ("IV", "Lua"): cabe no botão redondo do v2. */
export const ROTULO_DO_BOTAO_MAX = 12
/** O relógio guarda a hora em minutos depois das 12h (0 a 715), de 5 em 5, como o mostrador do v2. */
export const MINUTOS_NO_MOSTRADOR = 720
export const PASSO_DO_RELOGIO = 5

/**
 * A combinação, como o mestre a guarda (o `futuro` do plano §1.6, agora
 * jogado): a resposta mora SÓ aqui, e nunca vai ao jogador (o recorte manda o
 * número de rodas, os nomes dos botões e o tamanho da sequência). A hora é em
 * minutos depois das 12h (`2:50` = 170). Os botões são pelo índice em `rotulos`.
 * `type`, e não `interface`, para caber no `futuro` guardado como veio.
 */
export type CombinacaoDoPuzzle =
  | { tipo: 'combinacao'; forma: 'numeros'; resposta: number[] }
  | { tipo: 'combinacao'; forma: 'simbolos'; resposta: SimboloDaRoda[] }
  | { tipo: 'combinacao'; forma: 'relogio'; resposta: number }
  | { tipo: 'combinacao'; forma: 'botoes'; rotulos: string[]; resposta: number[] }

/** O controle como o jogador o vê (lista branca do recorte): onde está, e o que está nele agora. */
export type CombinacaoNaVista = { x: number; y: number; s: number } & (
  /** `rodas` = o algarismo de cada roda; nos símbolos, o índice em `SIMBOLOS_DA_RODA`. */
  | { forma: 'numeros' | 'simbolos'; rodas: number[] }
  | { forma: 'relogio'; minutos: number }
  /** `total` = os toques da sequência (as luzes do v2); `certos` = quantos já acenderam. */
  | { forma: 'botoes'; rotulos: string[]; total: number; certos: number }
)

// ------------------------------------------------------------------ as peças giratórias (28/11, 2º da fila de puzzles)

/**
 * AS PEÇAS GIRATÓRIAS (`docs/design/puzzles/FILA.md`): um medalhão na parede
 * com 3 a 6 anéis em volta de um miolo fixo. Cada anel gira de 45 em 45 graus
 * (`PASSOS_DO_GIRO` posições); o puzzle cede com todos na posição certa. Mora
 * no `futuro`, como a combinação (o app de antes guarda "como veio").
 *
 * O desenho gravado nos anéis: uma cena de fábrica (as do painel em relevo,
 * recortadas num círculo), uma imagem do mestre (`imagem`, `midia:<id>`) ou
 * símbolos (cada anel com os 8 de `SIMBOLOS_DO_ANEL`; `simbolos[k]` é o que o
 * anel `k` precisa mostrar na marca de cima). Os anéis contam de fora para dentro.
 *
 * `vizinhas`: girar um anel leva junto os dois vizinhos (o modo difícil).
 * `embaralho`: a semente do começo; o começo sai dela por giros de verdade,
 * então sempre tem solução. A posição certa e o começo ficam só no host.
 */
export interface GiratoriasDoPuzzle {
  tipo: 'giratorias'
  desenho: DesenhoDasGiratorias
  cena: CenaDoRelevo
  imagem: string | null
  material: MaterialDasGiratorias
  aneis: number
  simbolos: SimboloDoAnel[]
  vizinhas: boolean
  embaralho: number
}

export type DesenhoDasGiratorias = 'cena' | 'imagem' | 'simbolos'
export const DESENHOS_DAS_GIRATORIAS: readonly DesenhoDasGiratorias[] = ['cena', 'imagem', 'simbolos']

export type MaterialDasGiratorias = 'bronze' | 'ferro' | 'prata' | 'pedra'
export const MATERIAIS_DAS_GIRATORIAS: readonly MaterialDasGiratorias[] = ['bronze', 'ferro', 'prata', 'pedra']

/** Os 8 símbolos de cada anel, um por posição. */
export type SimboloDoAnel = 'sol' | 'lua' | 'estrela' | 'olho' | 'peixe' | 'coroa' | 'chave' | 'ancora'
export const SIMBOLOS_DO_ANEL: readonly SimboloDoAnel[] = ['sol', 'lua', 'estrela', 'olho', 'peixe', 'coroa', 'chave', 'ancora']

/** Quantas posições um anel tem numa volta (de 45 em 45 graus). */
export const PASSOS_DO_GIRO = 8
export const ANEIS_MIN = 3
export const ANEIS_MAX = 6
export const ANEIS_PADRAO = 4

/**
 * O medalhão como o jogador o vê (lista branca do recorte): o desenho, o
 * material e onde cada anel está agora. Nunca vão a posição certa nem o começo.
 * `giros[k]` = a posição do anel `k` (de fora para dentro), em passos no
 * sentido horário; nos símbolos, o que está na marca sai dela (`simboloNaMarca`).
 */
export interface GiratoriasNaVista {
  desenho: DesenhoDasGiratorias
  /** Só no desenho `cena`. */
  cena: CenaDoRelevo | null
  /** Só no desenho `imagem` (`null` = o mestre ainda não escolheu). */
  imagem: string | null
  material: MaterialDasGiratorias
  giros: number[]
  vizinhas: boolean
}

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
   * Os controles da combinação (`rodas`, `relogio` em minutos, `sequencia` =
   * toques certos até agora), e, das levas 3 e 4, as rotações das peças
   * giratórias e as luzes, que o leitor só guarda. Ausente = como nasceu.
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

/**
 * As peças desenhadas da biblioteca: as 13 do v2 (`PECAS_BASE`) e as do
 * catálogo grande de 21/11 ("vastos itens, tanto para colocar em um lugar,
 * quanto para combinar quanto chaves"). A arte mora em `puzzles/arte/`. O id
 * é para sempre: o item do acervo é `item_peca_<id>` e os puzzles gravados
 * apontam para ele.
 */
export type IdDaPecaDesenhada = IdDaPecaDoV2 | IdDaPecaDeEncaixe | IdDaMetade | IdDaChave

/** Para que serve a peça: pôr num encaixe, juntar com a outra metade, ou abrir (as chaves). Agrupa a biblioteca. */
export type TipoDaPecaDesenhada = 'encaixe' | 'metade' | 'chave'

/** As peças novas para pôr num encaixe (medalhões, joias, engrenagens, olhos, brasões, estatuetas, orbes, máscaras) e as peças inteiras das metades. */
export type IdDaPecaDeEncaixe =
  | 'med-cervo'
  | 'med-coruja'
  | 'med-peixe'
  | 'med-serpente'
  | 'joia-esmeralda'
  | 'joia-rubi'
  | 'joia-ametista'
  | 'joia-onix'
  | 'engr-latao'
  | 'engr-cobre'
  | 'olho-jade'
  | 'olho-obsidiana'
  | 'bra-torre'
  | 'bra-corvo'
  | 'bra-rosa'
  | 'fig-cavalo'
  | 'fig-gato'
  | 'manivela'
  | 'orbe-cristal'
  | 'orbe-sombra'
  | 'placa-runas'
  | 'mascara-ouro'
  | 'mascara-prata'
  | 'tabua-runas'
  | 'disco-eclipse'
  | 'espelho-bronze'
  | 'selo-real'
  | 'estrela-prata'
  | 'coroa-bronze'

/** As metades: duas a duas, num encaixe de "Duas metades", viram a peça inteira (`puzzles/arte/metades.ts`). */
export type IdDaMetade =
  | 'metade-tabua-esq'
  | 'metade-tabua-dir'
  | 'metade-disco-sol'
  | 'metade-disco-lua'
  | 'metade-espelho-esq'
  | 'metade-espelho-dir'
  | 'metade-selo-esq'
  | 'metade-selo-dir'
  | 'metade-estrela-esq'
  | 'metade-estrela-dir'
  | 'metade-coroa-esq'
  | 'metade-coroa-dir'
  | 'metade-cervo-esq'
  | 'metade-cervo-dir'
  | 'metade-mascara-esq'
  | 'metade-mascara-dir'
  | 'metade-torre-esq'
  | 'metade-torre-dir'
  | 'metade-chave-argola'
  | 'metade-chave-haste'

/** As chaves novas: seis matérias (ferro, bronze, prata, ouro, pedra, osso) e uma argola com desenho em cada. */
export type IdDaChave =
  | 'chave-espadas'
  | 'chave-copas'
  | 'chave-ouros'
  | 'chave-paus'
  | 'chave-sol'
  | 'chave-lua'
  | 'chave-estrela'
  | 'chave-aguia'
  | 'chave-serpente'
  | 'chave-coroa'
  | 'chave-pedra'
  | 'chave-osso'
  | 'chave-cranio'
  | 'chave-mestra'
  | 'chave-roda'

/** As 13 peças desenhadas da biblioteca do v2 (`PECAS_BASE`). */
export type IdDaPecaDoV2 =
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
  /**
   * Combinação: a roda `roda` anda um passo (para cima, +1). Relativo: dois jogadores girando somam.
   * Peças giratórias: o anel `roda` (de fora para dentro) anda um passo; +1 = sentido horário.
   */
  | { tipo: 'girar'; roda: number; passo: 1 | -1 }
  /** Combinação: os ponteiros param em `minutos` depois das 12h (de 5 em 5; o arrasto manda só ao soltar). */
  | { tipo: 'ponteiro'; minutos: number }
  /** Combinação: aperta o botão `botao` (índice nos nomes). Cada toque conta na sequência. */
  | { tipo: 'apertar'; botao: number }
  /** Combinação de rodas ou de relógio: confere o que está nos controles agora. */
  | { tipo: 'tentar' }

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
  /**
   * Tudo cheio na ordem errada, ou a bandeja com o peso errado; na combinação,
   * o "Tentar" com as rodas erradas, a hora errada, ou o botão fora da sequência.
   */
  | { tipo: 'errou'; em: 'ordem' | 'combinacao' | 'hora' | 'sequencia' }
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
  /** Só no painel em relevo: a placa que falta aqui (o desenho do vão). */
  placa?: number
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
  /** O controle da combinação; ausente = o puzzle é de encaixes (que, na combinação, não vão). */
  combinacao?: CombinacaoNaVista
  /** O medalhão das peças giratórias; ausente = não é desse tipo (e então os encaixes não vão). */
  giratorias?: GiratoriasNaVista
  /** O puzzle traz uma mecânica de uma leva que este app não joga. */
  versaoNova?: true
}
