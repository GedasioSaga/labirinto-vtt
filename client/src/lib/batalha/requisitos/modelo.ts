/**
 * REQUISITOS: O MODELO (fase A de docs/design/habilidades/REQUISITOS.md §3.1; a lista aprovada é
 * REQUISITOS-LISTA.md, A1 a J2). O que precisa estar certo para usar uma técnica, uma arma ou um
 * item, para ligar uma forma e para evoluir. Mora no campo `requisitos` do cartão (e da entrada do
 * catálogo, do item do Acervo e da vaga da mochila), fora da mecânica: a mecânica continua na
 * versão 3 e nenhum cartão muda de leitura.
 *
 * A forma é de um nível só (decisão do dono, 23/11): a raiz é sempre "Todos estes"; dentro dela,
 * grupos "Um destes" sem grupo dentro de grupo. Quantos requisitos: "isso cabe ao jogador" (o teto
 * daqui é só de segurança contra arquivo torto, `PECAS_NA_RAIZ_MAX`).
 *
 * Quem lê o disco é `ler.ts` (tolerante: peça torta ou de app mais novo nunca derruba o resto);
 * quem escreve as frases é `frases.ts`. Quem julga (o avaliador) é a fase B.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** A versão do bloco. Maior que esta = bloco de app mais novo ("atualize o app"). */
export const VERSAO_DOS_REQUISITOS = 1

/**
 * Teto de segurança da raiz e de cada "Um destes" (o dono não quer limite de quantidade: estes
 * números só barram arquivo torto, nenhuma ficha real chega perto).
 */
export const PECAS_NA_RAIZ_MAX = 64
export const OPCOES_NO_UM_DESTES_MAX = 16
/** As técnicas que ligam a forma (`soLigaPor`). */
export const LIGA_POR_MAX = 8
/** O id de um requisito ou de um "Um destes": curto, porque vira a chave `req.<id>` das respostas do pedido (teto 40). */
export const ID_DO_REQUISITO_MAX = 32
/** O id guardado numa referência (`cart_<uuid>`, `item_<uuid>`, o id do atributo). */
export const ID_DA_REFERENCIA_MAX = 64
/** O texto do requisito personalizado (J1) e do "o mestre decide" (J2). */
export const TEXTO_DO_REQUISITO_MAX = 120
/** A categoria da arma (F2, "Branca", "Fogo"). */
export const CATEGORIA_MAX = 40
/** Números de recurso (SP, HP, Escudo), de casas, de rodada, de quantidade e de CD. */
export const RECURSO_DO_REQUISITO_MAX = 1_000_000
export const CASAS_DO_REQUISITO_MAX = 99
export const RODADA_DO_REQUISITO_MAX = 999
export const QUANTIDADE_DO_REQUISITO_MAX = 999
export const CD_DO_REQUISITO_MAX = 999
export const PESSOAS_DO_REQUISITO_MAX = 99

/** As marcas de um cartão (`CartaoDaFicha.marcas`, "Fogo"): o G2 lista só os aliados com a marca pedida. */
export const MARCAS_MAX = 8
export const MARCA_MAX = 24

/** As respostas do pedido (`perguntaNaHora.ts`): a caixa J1 vai em `req.<id>` = `RESPOSTA_SIM`; a escolha do "Um destes", em `req.<id do grupo>` = o id da opção. */
export const PREFIXO_DA_RESPOSTA = 'req.'
export const RESPOSTA_SIM = 'sim'

/** A chave da resposta de um requisito ou de um "Um destes" no campo `respostas` do pedido. */
export function chaveDaResposta(id: string): string {
  return `${PREFIXO_DA_RESPOSTA}${id}`
}

/**
 * Uma referência a um cartão, a um item do Acervo ou a um atributo: o `id` quando é da mesma
 * ficha (ou do Acervo, ou do sistema); o `nome` sempre (o que a frase mostra, e o que casa
 * quando o bloco veio do catálogo ou de outra ficha).
 */
export interface Referencia {
  id?: string
  nome: string
}

/** O lado de uma porcentagem de vida (A2, D2). */
export type LadoDaVida = 'abaixo' | 'acima'
/** O tipo do alvo (D5). */
export type TipoDoAlvo = 'npc' | 'jogador' | 'invocacao'
/** O recurso que se pede ao aliado (G1). */
export type RecursoDoAliado = 'sp' | 'hp' | 'escudo'
/** O teste antes (H1, H2) que falha: perde a ação (e o custo), ou não usa e não gasta nada. */
export type SeFalhar = 'perdeAAcao' | 'naoGasta'

/** `nao`: o contrário ("sem Escudo", "não Atordoado"). Só nos tipos de `ACEITA_NAO`. */
type ComNao = { nao?: true }
/** `gasta`: além de exigir, gasta o número ao usar. Só nos tipos de recurso de `ACEITA_GASTA`. */
type ComGasto = { gasta?: true }
type ComId = { id: string }

/** Quanto o A6 paga: a porcentagem do HP máximo ou um número de HP, um dos dois. */
export type QuantoPagaDeVida = { porcento: number; hp?: undefined } | { hp: number; porcento?: undefined }

/**
 * Um requisito. A letra é a da lista (REQUISITOS-LISTA.md). Os números de cada tipo:
 *
 * - A1 `sp`: N de SP ou mais. A2 `vida`: vida abaixo/acima de X%. A3 `escudo`: com o Escudo de pé.
 *   A4 `contador`: o acumulador (`AcumuladorDaFicha`, "Polaridade", pelo id e o nome) no nível N ou mais. A5
 *   `concentracao`: N cargas ou mais (0 a 3). A6 `pagaVida`: paga X% do HP máximo ou N de HP
 *   (sempre gasta). A7 `reacaoLivre`: a reação livre (sempre gasta).
 * - B1 `ligada`: a técnica ou passiva `cartao` ligada (na opção `opcao`, a `chave` da variante;
 *   ausente = qualquer opção). B2 `selo`: um selo em si. B3 `naForma`: na forma `forma` (ausente =
 *   qualquer forma). B4 `parado`: não andou nesta vez. B5 `andou`: andou N casas ou mais nesta vez.
 *   B6 `apanhou`: recebeu dano desde a última vez. B7 `acertou`: acertou alguém nesta vez. B8
 *   `errou`: errou o último ataque.
 * - C1 `rodada`: a partir da rodada N (`ate`: até a rodada N). C2 `depoisDe`: logo depois de usar
 *   `cartao` (a ação anterior dele). C3 `jaUsada`: `cartao` já usado nesta batalha. C4
 *   `ordemNaVez`: a primeira (ou a última) ação da vez.
 * - D1 `alvoComSelo`, D2 `alvoVida`, D3 `alvoMarcado` (pela marca de quem usa), D5 `alvoTipo`, D6
 *   `alvoJaAgiu` (nesta rodada).
 * - E1 `aliadoPerto`: um aliado a até N casas. E2 `sozinho`: nenhum aliado a até N casas. E3
 *   `semInimigoColado`. E4 `inimigosPerto`: N inimigos ou mais a até `casas` (ausente = no alcance
 *   da técnica). E5 `luz`: na luz ou no escuro.
 * - F1 `item`: `quantidade` do item na mochila. F2 `armaNaMao`: a arma `arma`, ou uma da
 *   `categoria`, ou qualquer arma. F3 `municao`: N balas.
 * - G1 `pedirAoAliado`: N de SP, HP ou Escudo de um aliado (que aceita na tela dele). G2
 *   `ajudaDeAliado`: a ajuda de um aliado com a `marca` (o app lista quem tem; quem pede escolhe).
 *   G3 `aliadoUsou`: um aliado usou `cartao` nesta rodada. G4 `aliadosDePe`: N aliados (ou todos)
 *   de pé. G5 `aliadoCaiu`: um aliado caiu nesta batalha.
 * - H1 `teste`: passar num teste de `atributo` (atributo ou perícia do sistema) com a CD. H2
 *   `disputa`: vencer o alvo numa disputa de `atributo` (contra `doAlvo`; ausente = o mesmo).
 * - J1 `personalizado`: o texto; ao usar, a caixa "Cumpriu: <texto>?". J2 `mestreDecide`: o
 *   pedido espera o mestre.
 */
export type Requisito = ComId &
  (
    | ({ tipo: 'sp'; n: number } & ComNao & ComGasto)
    | { tipo: 'vida'; porcento: number; lado: LadoDaVida }
    | ({ tipo: 'escudo' } & ComNao)
    | ({ tipo: 'contador'; acumulador: Referencia; nivel: number } & ComNao & ComGasto)
    | ({ tipo: 'concentracao'; n: number } & ComNao & ComGasto)
    | ({ tipo: 'pagaVida' } & QuantoPagaDeVida)
    | { tipo: 'reacaoLivre' }
    | ({ tipo: 'ligada'; cartao: Referencia; opcao?: string } & ComNao)
    | ({ tipo: 'selo'; nome: string } & ComNao)
    | ({ tipo: 'naForma'; forma?: Referencia } & ComNao)
    | { tipo: 'parado' }
    | { tipo: 'andou'; casas: number }
    | ({ tipo: 'apanhou' } & ComNao)
    | ({ tipo: 'acertou' } & ComNao)
    | ({ tipo: 'errou' } & ComNao)
    | { tipo: 'rodada'; n: number; ate?: true }
    | ({ tipo: 'depoisDe'; cartao: Referencia } & ComNao)
    | ({ tipo: 'jaUsada'; cartao: Referencia } & ComNao)
    | ({ tipo: 'ordemNaVez'; qual: 'primeira' | 'ultima' } & ComNao)
    | ({ tipo: 'alvoComSelo'; nome: string } & ComNao)
    | { tipo: 'alvoVida'; porcento: number; lado: LadoDaVida }
    | ({ tipo: 'alvoMarcado' } & ComNao)
    | ({ tipo: 'alvoTipo'; quem: TipoDoAlvo } & ComNao)
    | ({ tipo: 'alvoJaAgiu' } & ComNao)
    | { tipo: 'aliadoPerto'; casas: number }
    | { tipo: 'sozinho'; casas: number }
    | ({ tipo: 'semInimigoColado' } & ComNao)
    | { tipo: 'inimigosPerto'; n: number; casas?: number }
    | { tipo: 'luz'; onde: 'luz' | 'escuro' }
    | ({ tipo: 'item'; item: Referencia; quantidade: number } & ComNao & ComGasto)
    | ({ tipo: 'armaNaMao'; arma?: Referencia; categoria?: string } & ComNao)
    | ({ tipo: 'municao'; n: number } & ComGasto)
    | ({ tipo: 'pedirAoAliado'; recurso: RecursoDoAliado; n: number } & ComGasto)
    | { tipo: 'ajudaDeAliado'; marca: string }
    | ({ tipo: 'aliadoUsou'; cartao: Referencia } & ComNao)
    | { tipo: 'aliadosDePe'; quantos: number | 'todos' }
    | ({ tipo: 'aliadoCaiu' } & ComNao)
    | { tipo: 'teste'; atributo: Referencia; cd: number; seFalhar: SeFalhar }
    | { tipo: 'disputa'; atributo: Referencia; doAlvo?: Referencia; seFalhar: SeFalhar }
    | { tipo: 'personalizado'; texto: string }
    | { tipo: 'mestreDecide'; texto?: string }
  )

export type TipoDeRequisito = Requisito['tipo']

/** Um requisito de um tipo só (`RequisitoDo<'sp'>`). */
export type RequisitoDo<T extends TipoDeRequisito> = Extract<Requisito, { tipo: T }>

/**
 * A peça que o leitor não entendeu, guardada como veio (`bruto`) para o app regravar sem apagar:
 * - `appNovo`: tipo, chave ou marca que este app não conhece (bloco de app mais novo): o cartão
 *   fica cinza "Requisito de app mais novo: atualize o app" e o mestre pode forçar;
 * - `torto`: número fora da faixa, texto vazio, contradição: o editor avisa "refaça".
 */
export interface RequisitoNaoLido {
  id: string
  tipo: 'naoLido'
  /** O `tipo` que veio no arquivo; `null` = nem isso. */
  tipoLido: string | null
  porque: 'appNovo' | 'torto'
  /** O que estava errado, para o aviso do editor. */
  motivo: string
  bruto: ValorJson
}

/** Uma opção de um "Um destes": um requisito, ou a peça não lida no lugar dele. */
export type OpcaoDoUmDestes = Requisito | RequisitoNaoLido

/** O grupo "Um destes" (de um nível: sem grupo dentro). Vale se uma opção vale; se mais de uma vale e gasta, quem usa escolhe. */
export interface UmDestes {
  id: string
  umDestes: readonly OpcaoDoUmDestes[]
}

/** Uma peça da raiz "Todos estes". */
export type PecaDoGrupo = Requisito | RequisitoNaoLido | UmDestes

/** A raiz "Todos estes": tudo aqui tem de valer. Vazia = nada pedido. */
export interface GrupoDeRequisitos {
  todos: readonly PecaDoGrupo[]
}

/**
 * O bloco do cartão (§3.1):
 * - `usar`: técnica, arma e item, para usar; forma, para ligar;
 * - `evoluir` (I3): só na base de uma evolução; cumprido, o Evoluir vira a versão super até ela
 *   ser usada uma vez (`dura: 'umUso'`);
 * - `aoUsar.sobeParte` (I1): a técnica sobe uma Parte a forma de onde ela vem;
 * - `forma` (I2): uma Parte por vez (`partesEmOrdem`); só liga pela técnica listada (`soLigaPor`).
 */
export interface RequisitosDoCartao {
  v: typeof VERSAO_DOS_REQUISITOS
  usar?: GrupoDeRequisitos
  evoluir?: { grupo: GrupoDeRequisitos; dura: 'umUso' }
  aoUsar?: { sobeParte: true }
  forma?: { partesEmOrdem?: true; soLigaPor?: readonly Referencia[] }
}

/** O JSON que o disco e o fio guardam. */
export type ValorJson = null | boolean | number | string | ValorJson[] | { [chave: string]: ValorJson }
export type ObjetoJson = { [chave: string]: ValorJson }

/** A peça é um "Um destes". */
export function ehUmDestes(peca: PecaDoGrupo): peca is UmDestes {
  return 'umDestes' in peca
}

/** A peça é um requisito que o leitor não entendeu. */
export function ehNaoLido(peca: PecaDoGrupo): peca is RequisitoNaoLido {
  return 'tipo' in peca && peca.tipo === 'naoLido'
}

/**
 * Como cada tipo se confere (a coluna "Confere" da lista):
 * - `auto`: o app confere sozinho;
 * - `pergunta`: espera alguém (o aliado, ou o mestre): não vale na reação nem no treino do Lobby;
 * - `caixa`: quem usa declara ("Cumpriu?"), o registro diz "(declarou: ...)";
 * - `teste`: o host rola o d20 na hora do pedido.
 */
export type ComoConfere = 'auto' | 'pergunta' | 'caixa' | 'teste'

/** A letra da lista, o "não ter" e o "gasta" de cada tipo, e como ele se confere. */
export interface FichaDoTipo {
  letra: string
  confere: ComoConfere
  aceitaNao: boolean
  aceitaGasta: boolean
}

const auto = (letra: string, aceitaNao = false, aceitaGasta = false): FichaDoTipo => ({ letra, confere: 'auto', aceitaNao, aceitaGasta })

/** Os 41 tipos, na ordem da lista. `nao` e `gasta` fora daqui = peça de app mais novo. */
export const TIPOS_DE_REQUISITO: Readonly<Record<TipoDeRequisito, FichaDoTipo>> = {
  sp: auto('A1', true, true),
  vida: auto('A2'),
  escudo: auto('A3', true),
  contador: auto('A4', true, true),
  concentracao: auto('A5', true, true),
  pagaVida: auto('A6'),
  reacaoLivre: auto('A7'),
  ligada: auto('B1', true),
  selo: auto('B2', true),
  naForma: auto('B3', true),
  parado: auto('B4'),
  andou: auto('B5'),
  apanhou: auto('B6', true),
  acertou: auto('B7', true),
  errou: auto('B8', true),
  rodada: auto('C1'),
  depoisDe: auto('C2', true),
  jaUsada: auto('C3', true),
  ordemNaVez: auto('C4', true),
  alvoComSelo: auto('D1', true),
  alvoVida: auto('D2'),
  alvoMarcado: auto('D3', true),
  alvoTipo: auto('D5', true),
  alvoJaAgiu: auto('D6', true),
  aliadoPerto: auto('E1'),
  sozinho: auto('E2'),
  semInimigoColado: auto('E3', true),
  inimigosPerto: auto('E4'),
  luz: auto('E5'),
  item: auto('F1', true, true),
  armaNaMao: auto('F2', true),
  municao: auto('F3', false, true),
  pedirAoAliado: { letra: 'G1', confere: 'pergunta', aceitaNao: false, aceitaGasta: true },
  ajudaDeAliado: { letra: 'G2', confere: 'pergunta', aceitaNao: false, aceitaGasta: false },
  aliadoUsou: auto('G3', true),
  aliadosDePe: auto('G4'),
  aliadoCaiu: auto('G5', true),
  teste: { letra: 'H1', confere: 'teste', aceitaNao: false, aceitaGasta: false },
  disputa: { letra: 'H2', confere: 'teste', aceitaNao: false, aceitaGasta: false },
  personalizado: { letra: 'J1', confere: 'caixa', aceitaNao: false, aceitaGasta: false },
  mestreDecide: { letra: 'J2', confere: 'pergunta', aceitaNao: false, aceitaGasta: false },
}

/** O texto é um tipo de requisito que este app conhece. */
export function ehTipoDeRequisito(valor: string): valor is TipoDeRequisito {
  return Object.hasOwn(TIPOS_DE_REQUISITO, valor)
}

/* ---------------------------------------------------------------------------------------------
 * O ACUMULADOR (acréscimo do dono de 23/11 à fase A): um medidor genérico que qualquer ficha
 * define (Polaridade, Fúria, Cargas): o nome, o nível máximo, como sobe, como cai e o que cada
 * nível dá. O requisito A4 (`contador`) aponta um acumulador; a peça de efeito "+N <acumulador>"
 * o sobe. O motor (subir, cair, somar o ganho) é de fase posterior; aqui só o modelo.
 *
 * O contador de hoje (`lib/batalha/contador.ts`, os extras do Vagn) cabe inteiro aqui:
 * - extra "Contador" (ou "Polaridade" achado no texto) = `nome`;
 * - extra "Nível máximo" (ou "vai até N" no texto) = `maximo`;
 * - extra "Dano por nível": "10" = `ganho: { ganho: 'dano', cada: 10 }` (nível x 10); "10, 20, 30"
 *   (ou as linhas "Nível 1: + 10 de dano") = `ganho: { ganho: 'dano', niveis: [10, 20, 30] }`, o
 *   mesmo `LeituraDoContador.danoPorNivel`;
 * - "gastar a reação sobe 1 nível" (fixo hoje no motor) = `sobe: [{ quando: 'gastaReacao', quanto: 1 }]`;
 * - "dura até a batalha acabar" = `desce: [{ quando: 'fimDaBatalha' }]` (o mestre zerar continua à mão);
 * - o "gasta 2" da Chuva é o requisito A4 com `gasta`, não uma regra do acumulador (vale sempre).
 * O `id` é novo: quem migrar dá um por ficha (ex.: `acu_polaridade`).
 * ------------------------------------------------------------------------------------------- */

/** A versão da definição do acumulador. */
export const VERSAO_DO_ACUMULADOR = 1
/** O maior nível de um acumulador (o contador de hoje para em 10; Fúria e Cargas podem ir além). */
export const NIVEL_DO_ACUMULADOR_MAX = 99
/** O nome ("Polaridade"), o mesmo teto do contador de hoje. */
export const NOME_DO_ACUMULADOR_MAX = 40
/** Quantas regras de subir e de cair. */
export const REGRAS_DO_ACUMULADOR_MAX = 8
/** Quanto uma regra sobe ou cai de uma vez, e quanto a peça "+N" sobe. */
export const PASSO_DO_ACUMULADOR_MAX = 99

/** Quando sobe (`quanto` níveis de cada vez). */
export type QuandoSobe =
  | { quando: 'gastaReacao' }
  | { quando: 'acerta' }
  | { quando: 'apanha' }
  /** Fase ED4: `seAcertar` = só quando o golpe da técnica acerta alguém (uma vez por golpe); ausente = ao usar. */
  | { quando: 'usaTecnica'; tecnica: Referencia; seAcertar?: true }
  | { quando: 'comecoDaVez' }
  | { quando: 'derruba' }
  | { quando: 'esquiva' }
  | { quando: 'gastaSp'; cada: number }

export type SubidaDoAcumulador = QuandoSobe & { quanto: number }

/** Quando cai, além do requisito A4 com "gasta" (que vale sempre). */
export type DescidaDoAcumulador =
  | { quando: 'fimDaBatalha' }
  | { quando: 'rodadaSemUso'; quanto: number }
  | { quando: 'apanha'; quanto: number | 'tudo' }

/** O valor de cada nível: `cada` x o nível, ou o total de cada nível (`niveis[0]` é o do nível 1; o tamanho é o máximo). */
export type ValorPorNivel = { cada: number; niveis?: undefined } | { niveis: readonly number[]; cada?: undefined }

/** O que cada nível dá: dano a mais em todo golpe que acerta, um atributo a mais, ou nada (só conta). */
export type GanhoDoAcumulador = { ganho: 'nada' } | ({ ganho: 'dano' } & ValorPorNivel) | ({ ganho: 'atributo'; atributo: Referencia } & ValorPorNivel)

/** A regra (de subir, de cair, ou o ganho) que o leitor não entendeu, guardada como veio. */
export interface RegraNaoLida {
  porque: 'appNovo' | 'torto'
  motivo: string
  bruto: ValorJson
}

/** A definição do acumulador. */
export interface AcumuladorDaFicha {
  v: typeof VERSAO_DO_ACUMULADOR
  /** Único na ficha: o requisito A4 e a peça "+N" o apontam por ele. */
  id: string
  nome: string
  maximo: number
  /** Fase ED4: o nível com que começa toda batalha (de 1 ao máximo); ausente = 0. */
  inicial?: number
  sobe: readonly (SubidaDoAcumulador | ({ quando: 'naoLida' } & RegraNaoLida))[]
  desce: readonly (DescidaDoAcumulador | ({ quando: 'naoLida' } & RegraNaoLida))[]
  ganho: GanhoDoAcumulador | ({ ganho: 'naoLido' } & RegraNaoLida)
}

/** A peça de efeito "+N <acumulador>" (o motor a liga a uma mecânica em fase posterior). */
export interface PecaDoAcumulador {
  tipo: 'acumulador'
  acumulador: Referencia
  quanto: number
}

/* ---------------------------------------------------------------------------------------------
 * O PEDIDO AO ALIADO (§7; os tipos ficam aqui para as fases E e G não esperarem). Uma pendência
 * no estado da batalha (`turnos.pedidosDeAjuda`, no molde da `FormaPendente`): nada é gasto antes
 * do aceite; o aceite roda o pedido congelado pelo portão inteiro de novo; nunca é salva.
 * ------------------------------------------------------------------------------------------- */

/** O prazo do aliado responder. O mestre não tem prazo. */
export const PRAZO_DA_AJUDA_MS = 60_000
/** O prefixo do id da pendência (`ajuda_<uuid>`). */
export const PREFIXO_DA_AJUDA = 'ajuda_'

/**
 * A pendência de ajuda. `Acao` é o pedido de ação congelado (o tipo do pedido da batalha: a fase E
 * o instancia; fica genérico para este arquivo não puxar o motor).
 */
export interface PedidoDeAjuda<Acao> {
  /** `ajuda_<uuid>`. */
  id: string
  /** O pedido de quem usa, como chegou: o aceite o roda de novo pelo portão. */
  acao: Acao
  /** Quem pede. */
  deTokenId: string
  dePersonagemId: string
  /** O aliado pedido; `null` = o mestre (NPC aliado e o J2). */
  paraTokenId: string | null
  /** O requisito G1, G2 ou J2 que pede a ajuda. */
  requisitoId: string
  /** A frase para os dois lados ("Vagn pede 30 SP para Chuva", `fraseDoPedidoDeAjuda`). */
  frase: string
  /** Quando nasceu e quando vence (ms do relógio do host); `venceEm` `null` = sem prazo (o mestre). */
  criadoEm: number
  venceEm: number | null
}

/** O aliado pedido (ou o mestre) responde. */
export interface RespostaDaAjuda {
  tipo: 'responderAjuda'
  ajudaId: string
  aceita: boolean
}

/** Quem pediu (ou o mestre) desiste. */
export interface CancelamentoDaAjuda {
  tipo: 'cancelarAjuda'
  ajudaId: string
}
