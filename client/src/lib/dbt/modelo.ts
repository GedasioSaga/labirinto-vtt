/**
 * DRAGON BALL TALES — o CONTRATO de tipos do sistema (fase 0 do plano
 * docs/planos/sistema-dragon-ball.md). Puro: sem React, sem store, sem rede,
 * sem import de regra do One Piece. Quem depende dele: lib/dbt/dados/
 * (catálogos gerados do livro), lib/dbt/regras/ (contas), a costura
 * (`Personagem.dbt`, disco, rede) e as telas.
 *
 * ONDE MORA CADA NÚMERO DA FICHA
 *  - Os 7 atributos ficam nos campos GENÉRICOS do Personagem:
 *    `atributos[id]` com os ids de `IDS_DOS_ATRIBUTOS` (for des con int sab
 *    pod pre). O valor guardado é o FINAL, já com os aumentos dos marcos de
 *    30.000 PDL; `FichaDBT.aumentos` só registra o que foi gasto (para contar
 *    marcos e devolver pontos). `modificadoresDosAtributos` continua sendo o
 *    ajuste temporário genérico.
 *  - PV e PK atuais em `recursos.pv` / `recursos.pk`; máximos em
 *    `maximos.pv` / `maximos.pk` (`IDS_DOS_RECURSOS`). As regras gravam o
 *    máximo ali quando a base muda: barra do token, ajuste rápido, disco e
 *    rede funcionam sem saber de Dragon Ball.
 *  - O resto (raça, PDL, EP inicial, perícias, técnicas...) é estruturado e
 *    mora em `Personagem.dbt` com a forma `FichaDBT`. Derivados (CA, ST, EP
 *    base, carga, deslocamento) não são guardados: saem de lib/dbt/regras/,
 *    salvo o valor à mão em `FichaDBT.ajustes`.
 *
 * Disco e rede leem a ficha só por `lerFichaDBT` (tolerante, nunca lança).
 * Páginas citadas = número impresso do Livro do Jogador V0.5.
 */

// ───────────────────────────────────────────────────────────────────────────
// Constantes e ids fixos
// ───────────────────────────────────────────────────────────────────────────

export const ID_SISTEMA_DBT = 'dragon-ball-tales'

/** Versão da forma de `FichaDBT`. Ficha com versão maior é recusada (app antigo não adivinha campo novo). */
export const VERSAO_DA_FICHA_DBT = 1

/** Na ordem do livro (2.1.1 a 2.1.7, p. 6-7). */
export const IDS_DOS_ATRIBUTOS = ['for', 'des', 'con', 'int', 'sab', 'pod', 'pre'] as const
export type IdAtributoDBT = (typeof IDS_DOS_ATRIBUTOS)[number]

/** Todo atributo começa em 8 na criação (3.0.2, p. 12): é o valor de uma ficha nova. */
export const ATRIBUTO_INICIAL = 8

/** PV (tom vida) e PK (tom energia), ambos com atual e máximo. */
export const IDS_DOS_RECURSOS = ['pv', 'pk'] as const
export type IdRecursoDBT = (typeof IDS_DOS_RECURSOS)[number]

/** Ranks de técnica, do mais fraco ao mais forte (6.0.2, p. 58). Também é o rank de referência do NPC. */
export const RANKS = ['E', 'D', 'C', 'B', 'A', 'Z'] as const
export type RankDBT = (typeof RANKS)[number]

/** As 13 perícias, na ordem do livro (8.1.2, p. 98). */
export const IDS_DAS_PERICIAS = [
  'atletismo',
  'acrobacia',
  'furtividade',
  'controle-de-ki',
  'analise',
  'ciencia',
  'conhecimento',
  'percepcao',
  'sentido-de-ki',
  'sobrevivencia',
  'intimidacao',
  'persuasao',
  'enganacao',
] as const
export type IdPericiaDBT = (typeof IDS_DAS_PERICIAS)[number]

/** O atributo de cada perícia (8.1.2, p. 98). Não há perícia de CON. */
export const ATRIBUTO_DA_PERICIA: Readonly<Record<IdPericiaDBT, IdAtributoDBT>> = {
  atletismo: 'for',
  acrobacia: 'des',
  furtividade: 'des',
  'controle-de-ki': 'pod',
  analise: 'int',
  ciencia: 'int',
  conhecimento: 'int',
  percepcao: 'sab',
  'sentido-de-ki': 'sab',
  sobrevivencia: 'sab',
  intimidacao: 'pre',
  persuasao: 'pre',
  enganacao: 'pre',
}

/** O tipo é o rótulo base obrigatório da técnica (6.0.1, p. 61). */
export const TIPOS_DE_TECNICA = ['fisica', 'ki', 'magica', 'hibrida'] as const
export type TipoDeTecnicaDBT = (typeof TIPOS_DE_TECNICA)[number]

/** Atributo de acerto padrão do tipo (p. 61). A híbrida usa o do tipo base: o jogador escolhe. */
export const ATRIBUTO_DO_TIPO: Readonly<Record<TipoDeTecnicaDBT, IdAtributoDBT>> = {
  fisica: 'for',
  ki: 'int',
  magica: 'pre',
  hibrida: 'for',
}

/** Categoria do NPC (Livro do Narrador 4.0.2): escolhe a linha da tabela de vida por golpe. */
export const CATEGORIAS_DE_NPC = ['comum', 'elite', 'chefao'] as const
export type CategoriaDeNpcDBT = (typeof CATEGORIAS_DE_NPC)[number]

/** Coleções de NPCs prontos: cada uma é um módulo de lib/dbt/dados/ carregado por import dinâmico. */
export const COLECOES_DE_NPC_PRONTO = ['saiyajins', 'freeza', 'super-heroes', 'zero-humanos', 'broly', 'enma'] as const
export type ColecaoDeNpcProntoDBT = (typeof COLECOES_DE_NPC_PRONTO)[number]

/** Derivados que o mestre pode fixar à mão (`FichaDBT.ajustes`). */
export const DERIVADOS_AJUSTAVEIS = ['pvMax', 'pkMax', 'ca', 'st', 'epBase', 'deslocamento', 'carga'] as const
export type DerivadoAjustavelDBT = (typeof DERIVADOS_AJUSTAVEIS)[number]

/**
 * Tetos da ficha lida do disco ou da rede: texto passou, é cortado; lista
 * passou, os de depois saem. Nome e texto seguem os tetos do cartão da ficha
 * genérica (`PERSONAGEM_ROTULO_MAX` 120 e `PERSONAGEM_TEXTO_MAX` 8000 em
 * net/protocoloDoPersonagem.ts). Garantem memória limitada, não que a ficha
 * caiba numa mensagem do jogador (64 KiB): quem envia ainda mede os bytes.
 */
export const LIMITES_DBT = {
  id: 120,
  nome: 120,
  /** Alcance, origem, nota do rótulo, tamanho/idade/personalidade. */
  textoCurto: 300,
  /** Descrição e efeito de cada técnica, item, talento, transformação. */
  texto: 8000,
  historia: 20_000,
  notas: 20_000,
  tecnicas: 100,
  rotulosPorTecnica: 40,
  transformacoes: 40,
  inventario: 200,
  talentos: 80,
  movimentos: 80,
  caracteristicas: 40,
  aumentos: 100,
  contadores: 30,
  passivas: 40,
} as const

// ───────────────────────────────────────────────────────────────────────────
// Catálogo do livro (o que lib/dbt/dados/ exporta)
// ───────────────────────────────────────────────────────────────────────────

/** Livro básico (Livro do Jogador) ou um suplemento de fã (raças, sagas, Enma Daioh). */
export type FonteDBT = 'basico' | 'suplemento'

export interface AtributoDBT {
  id: IdAtributoDBT
  /** "Força". */
  nome: string
  /** "FOR". */
  abreviacao: string
  /** CON (PV) e POD (PK) entram pelo VALOR; os outros pelo modificador floor((v − 10) / 2) (p. 6, pelos exemplos). */
  usa: 'valor' | 'modificador'
  descricao: string
  usos: string[]
  pagina: number
}

export interface PericiaDBT {
  id: IdPericiaDBT
  nome: string
  atributo: IdAtributoDBT
  descricao: string
  pagina: number
}

/** Traço racial, característica especial ou passiva: nome e o texto do livro. */
export interface TracoDBT {
  nome: string
  efeito: string
  /** Condição para valer ("PDL 30.000", "cauda intacta"); null = sempre. */
  requisito: string | null
}

export interface VarianteDeRacaDBT {
  /** Único dentro da raça ("saiyajin-puro"). */
  id: string
  nome: string
  descricao: string
  tracos: TracoDBT[]
}

/**
 * Transformação do catálogo (de raça ou de NPC pronto). O livro dá a regra
 * geral EP = estágio e Ki = 3 × estágio (p. 92-93), mas os exemplos impressos
 * fogem dela (Super Saiyajin: EP +2/+3/+4, Ki 6/9/12): aqui vale o impresso.
 */
export interface TransformacaoDBT {
  id: string
  nome: string
  /** 1, 2, 3...; null quando o livro não numera ("Estágio Especial", forma única). */
  estagio: number | null
  /** Como impresso ("Estágio 1", "Estágio Especial"). */
  estagioTexto: string
  /** EP bônus; null quando o livro não dá ("-"). */
  ep: number | null
  /** Ki para ativar; null quando não é número fixo. */
  custoKi: number | null
  /** Como impresso ("[KI: 06]", "Variável"). */
  custoTexto: string
  requisito: string
  duracao: string
  efeitos: string[]
  pagina: number | null
}

/** Três estágios de efeito da técnica: mínimo (¼), médio (½), completo (inteiro). */
export interface FaixaDeDanoDBT {
  minimo: number
  medio: number
  completo: number
}

/** O que a faixa de três números mede ("[Dano: …]", "[Mitigação: …]", "[Cura: …]", "[CA: +01]"). */
export type EfeitoDaFaixaDBT = 'dano' | 'mitigacao' | 'cura' | 'ca'

export type CategoriaDeTecnicaProntaDBT = 'ofensiva' | 'defensiva' | 'especial' | 'magia-negra'

/** Rótulos de uma técnica pronta como impressos: o orçamento entre parênteses e os nomes. */
export interface RotulosDaTecnicaProntaDBT {
  /** O número entre parênteses (nos suplementos é o teto do rank, não a soma). null = não impresso. */
  pontos: number | null
  /** Nomes como impressos; quem quiser o `RotuloDBT` procura pelo nome. */
  nomes: string[]
}

/** Técnica já montada no livro: dos pacotes de raça e das fichas de NPC pronto. */
export interface TecnicaProntaDBT {
  nome: string
  categoria: CategoriaDeTecnicaProntaDBT
  /** null quando o rank impresso não é E..Z ("Variável", "God", "Fusão Potara"). */
  rank: RankDBT | null
  rankTexto: string
  custoKi: number | null
  /** Como impresso ("08", "Variável", "12, +01 Acumulável por Nova Ação"). */
  custoTexto: string
  /** Os três números impressos (podem fugir de ¼/½: "14-22-44"); null = sem faixa. */
  faixa: FaixaDeDanoDBT | null
  efeitoDaFaixa: EfeitoDaFaixaDBT | null
  /** Como impresso ("08-17-34"). */
  faixaTexto: string
  alcance: string
  rotulosPositivos: RotulosDaTecnicaProntaDBT
  rotulosNegativos: RotulosDaTecnicaProntaDBT
  descricao: string
  /** Texto de regra além da descrição (as técnicas especiais). */
  efeito: string
  pagina: number | null
}

export type TipoDeTalentoDBT = 'passiva' | 'ativa' | 'passiva-ativa'

export interface TalentoDBT {
  /** "tl01" no livro básico; slug nos suplementos. */
  id: string
  nome: string
  /** null quando o livro não diz. "Ativa/Passiva" e "Passiva/Ativa" viram 'passiva-ativa'. */
  tipo: TipoDeTalentoDBT | null
  tipoTexto: string
  requisito: string | null
  efeito: string
  pagina: number | null
  fonte: FonteDBT
}

export interface MovimentoMarcialDBT {
  /** "mm01". */
  id: string
  nome: string
  /** Com * pode ir junto de técnica ofensiva física (vermelho) ou de Ki (azul); null = ação separada. */
  combinaCom: 'fisico' | 'ki' | null
  /** null = "Variável" ou sem custo impresso (Nódulo de Supressão). */
  custoKi: number | null
  custoTexto: string
  requisito: string | null
  /** Testes citados ("Sabedoria vs Acerto do Usuário"). */
  testes: string[]
  efeito: string
  pagina: number | null
}

export type TipoDeRacaDBT = 'raca' | 'variante' | 'subraca' | 'clan' | 'pacote-de-tecnicas'

/**
 * Raça do livro básico ou de suplemento. Um "pacote de técnicas" (Androide do
 * Furto de Ki, Terráqueo Vital...) também é uma entrada daqui, com
 * `tipo: 'pacote-de-tecnicas'` e `racaBase`: não é escolhível como raça, só
 * oferece técnicas prontas para quem já é da raça base.
 */
export interface RacaDBT {
  /** "saiyajin", "saiyajin-potencial". */
  id: string
  nome: string
  fonte: FonteDBT
  /** Arquivo de origem (PDF do livro ou do suplemento). */
  arquivo: string
  tipo: TipoDeRacaDBT
  /** Id da raça do livro básico de que esta deriva (variante, sub-raça, pacote). */
  racaBase?: string
  /** PV extras a cada 10.000 PDL (também somados no PDL 0, p. 13); null = o texto não diz (Purrlian, pacote). */
  vidaPor10k: number | null
  descricao: string
  /** Vazia quando a raça tem uma variação só: aí os traços estão em `tracos`. */
  variantes: VarianteDeRacaDBT[]
  /** Traços que valem para toda variante. */
  tracos: TracoDBT[]
  caracteristicasEspeciais: TracoDBT[]
  transformacoes: TransformacaoDBT[]
  tecnicas: TecnicaProntaDBT[]
  /** Talentos e passivas raciais (Saiyajin do Potêncial). */
  talentos: TalentoDBT[]
  /** Regra que não cabe nos campos acima (recurso novo, tabela de sentimento, bônus por tamanho). */
  outros: { titulo: string; texto: string }[]
  pagina: number | null
}

export type CategoriaDeRotuloDBT = 'base' | 'tipo_dano' | 'ki' | 'generico' | 'negativo'

/**
 * Custo do rótulo em pontos (6.0.3, p. 60). Negativo devolve pontos (valor < 0).
 *  - fixo: "2", "-4";
 *  - faixa: "-1 a -2" (o jogador escolhe dentro; `minimo`/`maximo` como impressos);
 *  - variavel: "2 a Variável" (`minimo` 2) ou "Variável" (`minimo` null);
 *  - consome-tudo: "?" — custa todos os pontos positivos base do rank;
 *  - igual-ao-efeito-negativo: "-?" — devolve o valor da condição escolhida.
 */
export type CustoDoRotuloDBT =
  | { tipo: 'fixo'; pontos: number }
  | { tipo: 'faixa'; minimo: number; maximo: number }
  | { tipo: 'variavel'; minimo: number | null }
  | { tipo: 'consome-tudo' }
  | { tipo: 'igual-ao-efeito-negativo' }

/** Efeito do rótulo no Ki da técnica. Campo null = o rótulo não mexe nisso. */
export interface ModificadorDeKiDoRotuloDBT {
  /** Ki somado ao escolher o rótulo (Engolfante +3). */
  inicial: number | null
  /** Ki por ponto extra investido no rótulo variável. */
  porPontoExtra: number | null
  /** Ki por cópia do rótulo (Aumentar Precisão +4). */
  porRotulo: number | null
  /** Ki por ponto negativo (Dreno de Ki +3). */
  porPontoNegativo: number | null
  /** Multiplica o Ki no uso (Exaustiva ×2). */
  multiplicador: number | null
  /** O resto, pela chave do livro (carga com Ki, nova rolagem, raio extra, ativação...). */
  outros: Record<string, number | string>
  /** Divergência do livro anotada ("o exemplo 6.7 usa +4"). */
  nota: string | null
}

export interface AlcanceDoRotuloDBT {
  /** "cone_a_partir_do_usuario", "projetil_alvo_unico"... */
  forma: string
  inicialM: number | null
  porPontoExtraM: number | null
  /** Outras medidas em metros (raio_m, raio_externo_m, faixa_segura_m...). */
  medidasM: Record<string, number>
}

export interface RotuloDBT {
  /** Slug do nome ("alcance-engolfante"): o livro não tem id. */
  id: string
  nome: string
  categoria: CategoriaDeRotuloDBT
  custo: CustoDoRotuloDBT
  /** Como impresso ("2 a Variável", "?", "-1 a -2"). */
  custoTexto: string
  modificadorDeKi: ModificadorDeKiDoRotuloDBT | null
  /** Aceita pontos extras ou valor escolhido (custo variável/faixa). */
  variavel: boolean
  /** Pode entrar mais de uma vez na técnica; null = o texto não diz. */
  acumula: boolean | null
  alcance: AlcanceDoRotuloDBT | null
  restricoes: string[]
  efeito: string
  pagina: number
}

/** Uma linha da tabela de rank (6.0.2, p. 58; ST da p. 109; Ki mínimo da especial p. 88-89). */
export interface RankDeTecnica {
  rank: RankDBT
  /** "Técnica Básica". */
  nome: string
  /** PDL mínimo recomendado para aprender. */
  pdl: number
  danoMin: number
  danoMax: number
  kiMin: number
  kiMax: number
  /** Pontos de rótulo positivos grátis do rank. */
  pontosDeRotuloBase: number
  /** Teto com negativos (2 × base). */
  pontosDeRotuloMax: number
  /** Slots de Técnica para manter ativa. */
  slots: number
  kiMinimoDaEspecial: number
  pagina: number
}

export interface ItemDBT {
  id: string
  nome: string
  /** "Narrativo", "Especial", "Acessório", "Armadura"; null = o livro não diz. */
  tipo: string | null
  /** Slots de carga de uma unidade. */
  carga: number
  efeito: string
  /** Só armadura (8.3, p. 103); 0 nos outros. */
  bonusCA: number
  /** Só armadura: "-5 Ki por turno" = 5. */
  kiPorTurno: number
  observacoes: string
  pagina: number
}

/**
 * Quando a condição acaba (9.7, p. 120-123):
 *  - fim-da-rodada: Atordoado;
 *  - fim-do-proximo-turno: Silenciado, Paralisado, Cego, Alucinação, Desequilibrado, Quebra de Guarda;
 *  - inicio-do-proximo-turno: Exposto (se não foi atingido);
 *  - teste: sai passando no teste (Desnorteado, Intimidado, Enraizado, Envenenado...);
 *  - contagem: dura `turnos` turnos de ação (Lacuna Mental: 2);
 *  - evento: sai por algo que acontece (Sobrecarregado, Caído, Controle Mental);
 *  - fim-do-combate: Quebrado.
 */
export type ExpiracaoDaCondicaoDBT = 'fim-da-rodada' | 'fim-do-proximo-turno' | 'inicio-do-proximo-turno' | 'teste' | 'contagem' | 'evento' | 'fim-do-combate'

export interface CondicaoDBT {
  id: string
  nome: string
  /** O número entre parênteses ("Atordoado (5)"): custo da condição no rótulo Efeito Negativo. */
  valor: number | null
  efeito: string
  /** Como impresso. */
  duracao: string
  expira: ExpiracaoDaCondicaoDBT
  /** Atributos do teste para sair (Desnorteado: SAB ou CON); vazio = sem teste. */
  atributosDoTeste: IdAtributoDBT[]
  /** Só `expira: 'contagem'`. */
  turnos: number | null
  comoRemover: string | null
  pagina: number
}

/** Em que momento do turno a ação acontece (9.2-9.5). */
export type MomentoDaAcaoDBT = 'acao' | 'reacao' | 'livre' | 'situacao' | 'automatica'

export interface AcaoDeCombateDBT {
  id: string
  nome: string
  /** Como impresso ("Turno de Ação (livre)", "Reação (a Técnica de Ki ou física)"). */
  tipoDeAcao: string
  momento: MomentoDaAcaoDBT
  /** Como impresso ("1 Ki por 1,5m além do deslocamento"). */
  custo: string
  /** Só quando o custo é número fixo (Voo: 4). */
  custoKi: number | null
  efeito: string
  pagina: number
}

export const IDS_DOS_ESTAGIOS = ['erro', 'minimo', 'medio', 'completo'] as const
export type IdEstagioDeDanoDBT = (typeof IDS_DOS_ESTAGIOS)[number]

/** Estágio de dano pela margem acerto − CA, sem diferença de EP (8.4, p. 103-104). */
export interface EstagioDeDanoDBT {
  id: IdEstagioDeDanoDBT
  nome: string
  /** null = sem piso (erro). */
  margemMin: number | null
  /** null = sem teto (completo). */
  margemMax: number | null
  /** 0, 0,25, 0,5, 1. */
  fracao: number
  efeito: string
}

/** PV por golpe do NPC: PV = ND × tabela[categoria][rank] (Livro do Narrador 4.0.2, p. 17-18). */
export type TabelaVidaPorGolpe = Readonly<Record<CategoriaDeNpcDBT, Readonly<Record<RankDBT, number>>>>

/** "Passivas e Ativas Únicas" de um NPC pronto. */
export interface PassivaDBT {
  nome: string
  /** "Passiva", "Ativa/Passiva", "Ação/Reação". */
  tipo: string
  texto: string
  pagina: number | null
}

/**
 * Ficha de NPC pronto (sagas e Enma Daioh). PV não vem: o livro deixa em
 * branco de propósito (o mestre escolhe o ND). Os atributos guardam só o
 * valor; o modificador impresso às vezes foge da fórmula e é refeito pelas regras.
 */
export interface NpcProntoDBT {
  /** "<colecao>/<slug do nome>" ("saiyajins/son-goku"). */
  id: string
  nome: string
  colecao: ColecaoDeNpcProntoDBT
  /** "Saga Saiyajin"; null = sem saga (Enma Daioh, Broly). */
  saga: string | null
  /** Arquivo de origem. */
  fonte: string
  /** Autor da ficha no concurso (Enma Daioh). */
  criador: string | null
  categoria: CategoriaDeNpcDBT
  rank: RankDBT
  atributos: Record<IdAtributoDBT, number>
  pk: number
  ca: number
  /** Deslocamento em metros (9,0 em todas as fichas). */
  vel: number
  ep: number
  tecnicas: TecnicaProntaDBT[]
  transformacoes: TransformacaoDBT[]
  passivas: PassivaDBT[]
  /** Background / texto de abertura. */
  historia: string
  /** Notas do transcritor e texto fora de entrada. */
  notas: string[]
  pagina: number | null
}

// ───────────────────────────────────────────────────────────────────────────
// A ficha (Personagem.dbt)
// ───────────────────────────────────────────────────────────────────────────

/** Raça feita pelo mestre, fora do catálogo (a ficha de fã tinha "Identificação" + "PV / 10K PDL"). */
export interface RacaLivreDBT {
  nome: string
  vidaPor10k: number
}

/**
 * Um aumento gasto num marco de 30.000 PDL: +2 em um atributo ou +1 em dois
 * (3.0.11, p. 14). O valor do atributo no Personagem JÁ inclui o aumento;
 * esta lista é o registro (marco, para onde foi). Dois aumentos de +1 no
 * mesmo marco são duas linhas com o mesmo `marco`.
 */
export interface AumentoDeAtributoDBT {
  /** 1 = o de 30.000, 2 = o de 60.000... */
  marco: number
  atributo: IdAtributoDBT
  pontos: 1 | 2
}

/** Talento, movimento marcial, característica racial ou passiva na ficha: do livro (por id) ou livre. */
export interface HabilidadeDaFichaDBT {
  /** Único dentro da lista. */
  id: string
  /** Id no catálogo (`TalentoDBT.id`, `MovimentoMarcialDBT.id`...); null = livre. */
  livroId: string | null
  /** Do livro: cópia do nome (a ficha continua legível se o catálogo mudar). */
  nome: string
  /** Livre: o texto inteiro. Do livro: vazio = vale o do catálogo; preenchido = anotação da mesa. */
  efeito: string
  /** Ki por uso quando é livre; null = do livro ou sem custo. */
  custoKi: number | null
}

/**
 * Um rótulo escolhido na técnica. Rótulo que acumula (`RotuloDBT.acumula`)
 * entra repetido na lista, uma linha por cópia.
 */
export interface RotuloEscolhidoDBT {
  /** `RotuloDBT.id`. */
  rotuloId: string
  /** Pontos investidos acima do mínimo num rótulo "X a Variável" (cada um amplia e soma Ki). */
  pontosExtras: number
  /** Pontos escolhidos quando o custo é "Variável", faixa ou "-?" (com sinal; negativo devolve). null = custo fixo. */
  variavel: number | null
  /** Unidades compradas com Ki fora dos pontos (Ki do Aumentar Dano por Ki, degraus de 1,5 m da Fragmentação). */
  investimento: number
  /** Escolha em texto: a condição do Efeito Negativo, o atributo da Salvaguarda, o elemento. */
  nota: string
}

export type MomentoDaEspecialDBT = 'acao' | 'reacao' | 'acao-ou-reacao' | 'passiva'

/**
 * Técnica especial (p. 87-92): o que nenhum rótulo cobre. Não usa orçamento
 * de rótulos nem gasta ST. Ofensiva só o narrador cria; não ofensiva o
 * jogador cria com aprovação (1 por ponto de EP).
 */
export interface TecnicaEspecialDBT {
  ofensiva: boolean
  momento: MomentoDaEspecialDBT
  efeito: string
  /** O mestre aprovou. A ficha do jogador mostra "aguardando o mestre" até lá. */
  aprovada: boolean
}

export interface TecnicaDBT {
  id: string
  nome: string
  rank: RankDBT
  tipo: TipoDeTecnicaDBT
  /** Atributo da rolagem de acerto; padrão em `ATRIBUTO_DO_TIPO`. */
  atributo: IdAtributoDBT
  rotulos: RotuloEscolhidoDBT[]
  /** Texto do alcance; vazio = sai dos rótulos. */
  alcance: string
  descricao: string
  /** Preparada: ocupa ST (troca só em descanso longo). */
  ativa: boolean
  especial: TecnicaEspecialDBT | null
  /** O que a faixa mede: dano, mitigação (Técnica Defensiva), cura. */
  efeitoDaFaixa: EfeitoDaFaixaDBT
  /** Valor à mão: quando não é null vale no lugar da conta (técnica de NPC pronto, regra da mesa). */
  kiManual: number | null
  danoManual: FaixaDeDanoDBT | null
}

export interface TransformacaoDaFichaDBT {
  id: string
  /** `TransformacaoDBT.id` quando veio do catálogo; null = criada com o mestre. */
  livroId: string | null
  nome: string
  estagio: number
  /** EP bônus enquanto ativa (não soma na CA, p. 13). */
  ep: number
  /** Ki para ativar. */
  custoKi: number
  /** Desgaste opcional: Ki por rodada para manter (p. 94); 0 = sem. */
  kiPorRodada: number
  efeitos: string
  /** Como destravou (raça, evento, treino): texto. */
  origem: string
}

export interface ItemDaFichaDBT {
  id: string
  /** `ItemDBT.id`; null = livre. */
  livroId: string | null
  nome: string
  quantidade: number
  /** Slots de UMA unidade. */
  carga: number
  equipado: boolean
  descricao: string
  /** Armadura equipada: soma na CA. 0 nos outros. */
  bonusCA: number
  /** Armadura equipada: Ki a menos por turno. 0 nos outros. */
  kiPorTurno: number
}

/** Contador persistente da ficha (Magia Negra, Tempo Perdido, Energia Negativa, cargas...). */
export interface ContadorDBT {
  id: string
  nome: string
  atual: number
  /** null = sem teto. */
  maximo: number | null
}

/** Só NPC: o PV sai de ND × vida por golpe (`TabelaVidaPorGolpe`). */
export interface NpcDaFichaDBT {
  /** Quantos golpes do rank ele aguenta; null = o mestre ainda não escolheu (fichas prontas vêm assim). */
  nd: number | null
  categoria: CategoriaDeNpcDBT
  rank: RankDBT
  /** "Passivas e Ativas Únicas". */
  passivas: HabilidadeDaFichaDBT[]
  /** `NpcProntoDBT.id` de onde a ficha saiu; null = feita do zero. */
  prontoId: string | null
}

export interface FichaDBT {
  versao: typeof VERSAO_DA_FICHA_DBT
  /** `RacaDBT.id`; '' = sem raça (ou raça livre). */
  raca: string
  /** `VarianteDeRacaDBT.id`; '' = sem variante. */
  variante: string
  racaLivre: RacaLivreDBT | null
  /** Poder de Luta base (o que destrava marcos). */
  pdl: number
  /** Escala de Poder base inicial dada pelo mestre; EP base = epInicial + floor(PDL / 40.000). */
  epInicial: number
  aumentos: AumentoDeAtributoDBT[]
  periciasTreinadas: IdPericiaDBT[]
  talentos: HabilidadeDaFichaDBT[]
  movimentos: HabilidadeDaFichaDBT[]
  tecnicas: TecnicaDBT[]
  transformacoes: TransformacaoDaFichaDBT[]
  /** Id em `transformacoes` da forma ligada agora; null = forma normal. */
  transformacaoAtiva: string | null
  inventario: ItemDaFichaDBT[]
  /** As da variante vêm do catálogo; aqui ficam as escolhidas (híbrido, Bio-Androide) e as livres. */
  caracteristicas: HabilidadeDaFichaDBT[]
  contadores: ContadorDBT[]
  /** Campos da ficha oficial (p. 127). */
  tamanho: string
  idade: string
  personalidade: string
  historia: string
  notas: string
  /** PK bloqueado pela exaustão (8.5.1): só sai com descanso longo. */
  kiBloqueado: number
  /** Valor à mão de um derivado; chave ausente = a regra calcula. */
  ajustes: Partial<Record<DerivadoAjustavelDBT, number>>
  /** Só NPC; ausente no jogador. */
  npc?: NpcDaFichaDBT
}

// ───────────────────────────────────────────────────────────────────────────
// Ficha nova e ids
// ───────────────────────────────────────────────────────────────────────────

const SEM_NOME = 'Sem nome'

/** Id novo para um item de lista da ficha ("tec", "tra", "item", "tal", "mov", "car", "cont", "pas"). */
export function novoIdDBT(prefixo: string): string {
  return `${prefixo}_${crypto.randomUUID()}`
}

/** Ficha vazia: PDL 0 e EP inicial 1, o recomendado pelo livro (3.0.2, p. 13). */
export function fichaDBTVazia(): FichaDBT {
  return {
    versao: VERSAO_DA_FICHA_DBT,
    raca: '',
    variante: '',
    racaLivre: null,
    pdl: 0,
    epInicial: 1,
    aumentos: [],
    periciasTreinadas: [],
    talentos: [],
    movimentos: [],
    tecnicas: [],
    transformacoes: [],
    transformacaoAtiva: null,
    inventario: [],
    caracteristicas: [],
    contadores: [],
    tamanho: '',
    idade: '',
    personalidade: '',
    historia: '',
    notas: '',
    kiBloqueado: 0,
    ajustes: {},
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura tolerante (disco e rede)
// ───────────────────────────────────────────────────────────────────────────

/** Faixas dos números lidos: fora delas o valor é preso na borda. */
const PDL_MAX = 1_000_000_000_000
const EP_MAX = 100
const KI_MAX = 1_000_000
const PV_MAX = 10_000_000
const ESTAGIO_MAX = 99
const MARCO_MAX = 1000
const QUANTIDADE_MAX = 99_999
const CARGA_MAX = 1000
const CA_ITEM_MAX = 100
const ND_MAX = 1000
const PONTOS_DE_ROTULO_MAX = 100
const INVESTIMENTO_MAX = 1000
const VIDA_POR_10K_MAX = 1000
const DESLOCAMENTO_MAX = 1000
/** Ajuste à mão de CA/ST/EP pode ser negativo (penalidade); PV/PK não. */
const AJUSTE_MIN = -PV_MAX
/** Quantas entradas tortas a leitura de uma lista atravessa antes de desistir: protege contra lista gigante. */
const VARREDURA_POR_ITEM = 4

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor)
}

/** Corta em `max` unidades UTF-16 sem deixar meio emoji no fim (mesma regra de lib/personagem.ts). */
function cortado(valor: string, max: number): string {
  if (valor.length <= max) return valor
  const ultima = valor.charCodeAt(max - 1)
  return valor.slice(0, ultima >= 0xd800 && ultima <= 0xdbff ? max - 1 : max)
}

function texto(valor: unknown, max: number): string {
  return typeof valor === 'string' ? cortado(valor, max) : ''
}

function nome(valor: unknown): string {
  return texto(valor, LIMITES_DBT.nome).trim() || SEM_NOME
}

/** Id de catálogo: texto não vazio até o teto; o resto é "não tem". */
function idOuNulo(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return limpo.length > 0 && limpo.length <= LIMITES_DBT.id ? limpo : null
}

function inteiro(valor: unknown, min: number, max: number, padrao: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return padrao
  return Math.min(max, Math.max(min, Math.round(valor)))
}

function inteiroOuNulo(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? inteiro(valor, min, max, min) : null
}

function umDe<T extends string>(opcoes: readonly T[], valor: unknown, padrao: T): T {
  return opcoes.find((opcao) => opcao === valor) ?? padrao
}

/**
 * Lê uma lista: entrada torta sai, passou de `max` os de depois saem. Lê no
 * máximo `max × VARREDURA_POR_ITEM` entradas, para uma lista de um milhão de
 * lixos vinda da rede não travar o host.
 */
function lista<T>(valor: unknown, max: number, ler: (item: unknown) => T | null): T[] {
  if (!Array.isArray(valor)) return []
  const lidos: T[] = []
  const fim = Math.min(valor.length, max * VARREDURA_POR_ITEM)
  for (let i = 0; i < fim && lidos.length < max; i += 1) {
    const item = ler(valor[i])
    if (item !== null) lidos.push(item)
  }
  return lidos
}

/** Id do item como veio; '' = ausente ou torto (`comIdsUnicos` dá um). */
function idDoItem(valor: unknown): string {
  return idOuNulo(valor) ?? ''
}

/**
 * Dá a cada item um id único na lista: id vazio ou repetido vira
 * `<prefixo>_<posição>` (determinístico, para duas leituras do mesmo arquivo
 * darem a mesma ficha); se até esse já existir, o item sai.
 */
function comIdsUnicos<T extends { id: string }>(itens: T[], prefixo: string): T[] {
  const usados = new Set<string>()
  const saida: T[] = []
  itens.forEach((item, posicao) => {
    const id = item.id.length > 0 && !usados.has(item.id) ? item.id : `${prefixo}_${posicao + 1}`
    if (usados.has(id)) return
    usados.add(id)
    saida.push({ ...item, id })
  })
  return saida
}

function racaLivreDoArquivo(valor: unknown): RacaLivreDBT | null {
  if (!ehRegistro(valor)) return null
  const nomeDaRaca = texto(valor.nome, LIMITES_DBT.nome).trim()
  if (nomeDaRaca.length === 0) return null
  return { nome: nomeDaRaca, vidaPor10k: inteiro(valor.vidaPor10k, 0, VIDA_POR_10K_MAX, 0) }
}

function aumentoDoArquivo(valor: unknown): AumentoDeAtributoDBT | null {
  if (!ehRegistro(valor)) return null
  const atributo = IDS_DOS_ATRIBUTOS.find((id) => id === valor.atributo)
  const pontos = valor.pontos === 1 ? 1 : valor.pontos === 2 ? 2 : null
  // Marco fora da faixa é torto e sai (não existe marco 0): preso na borda, viraria um aumento a mais
  // no marco 1, passando do "+2 em um ou +1 em dois" por marco (3.0.11, p. 14).
  const brutoDoMarco = valor.marco
  const marco = typeof brutoDoMarco === 'number' && Number.isInteger(brutoDoMarco) && brutoDoMarco >= 1 && brutoDoMarco <= MARCO_MAX ? brutoDoMarco : null
  if (atributo === undefined || pontos === null || marco === null) return null
  return { marco, atributo, pontos }
}

/** Perícias conhecidas, sem repetir, na ordem em que vieram. */
function periciasDoArquivo(valor: unknown): IdPericiaDBT[] {
  if (!Array.isArray(valor)) return []
  const vistas = new Set<IdPericiaDBT>()
  for (const bruto of valor.slice(0, IDS_DAS_PERICIAS.length * VARREDURA_POR_ITEM)) {
    const id = IDS_DAS_PERICIAS.find((pericia) => pericia === bruto)
    if (id !== undefined) vistas.add(id)
  }
  return [...vistas]
}

function habilidadeDoArquivo(valor: unknown): HabilidadeDaFichaDBT | null {
  if (!ehRegistro(valor)) return null
  return {
    id: idDoItem(valor.id),
    livroId: idOuNulo(valor.livroId),
    nome: nome(valor.nome),
    efeito: texto(valor.efeito, LIMITES_DBT.texto),
    custoKi: inteiroOuNulo(valor.custoKi, 0, KI_MAX),
  }
}

function habilidadesDoArquivo(valor: unknown, max: number, prefixo: string): HabilidadeDaFichaDBT[] {
  return comIdsUnicos(lista(valor, max, habilidadeDoArquivo), prefixo)
}

function rotuloEscolhidoDoArquivo(valor: unknown): RotuloEscolhidoDBT | null {
  if (!ehRegistro(valor)) return null
  const rotuloId = idOuNulo(valor.rotuloId)
  if (rotuloId === null) return null
  return {
    rotuloId,
    pontosExtras: inteiro(valor.pontosExtras, 0, PONTOS_DE_ROTULO_MAX, 0),
    variavel: inteiroOuNulo(valor.variavel, -PONTOS_DE_ROTULO_MAX, PONTOS_DE_ROTULO_MAX),
    investimento: inteiro(valor.investimento, 0, INVESTIMENTO_MAX, 0),
    nota: texto(valor.nota, LIMITES_DBT.textoCurto),
  }
}

function especialDoArquivo(valor: unknown): TecnicaEspecialDBT | null {
  if (!ehRegistro(valor)) return null
  return {
    ofensiva: valor.ofensiva === true,
    momento: umDe<MomentoDaEspecialDBT>(['acao', 'reacao', 'acao-ou-reacao', 'passiva'], valor.momento, 'acao'),
    efeito: texto(valor.efeito, LIMITES_DBT.texto),
    aprovada: valor.aprovada === true,
  }
}

/** Faixa à mão: só com os três números; faltou um, é "sem valor à mão". */
function faixaDoArquivo(valor: unknown): FaixaDeDanoDBT | null {
  if (!ehRegistro(valor)) return null
  const minimo = inteiroOuNulo(valor.minimo, 0, PV_MAX)
  const medio = inteiroOuNulo(valor.medio, 0, PV_MAX)
  const completo = inteiroOuNulo(valor.completo, 0, PV_MAX)
  if (minimo === null || medio === null || completo === null) return null
  return { minimo, medio, completo }
}

function tecnicaDoArquivo(valor: unknown): TecnicaDBT | null {
  if (!ehRegistro(valor)) return null
  const tipo = umDe(TIPOS_DE_TECNICA, valor.tipo, 'ki')
  return {
    id: idDoItem(valor.id),
    nome: nome(valor.nome),
    rank: umDe(RANKS, valor.rank, 'E'),
    tipo,
    atributo: umDe(IDS_DOS_ATRIBUTOS, valor.atributo, ATRIBUTO_DO_TIPO[tipo]),
    rotulos: lista(valor.rotulos, LIMITES_DBT.rotulosPorTecnica, rotuloEscolhidoDoArquivo),
    alcance: texto(valor.alcance, LIMITES_DBT.textoCurto),
    descricao: texto(valor.descricao, LIMITES_DBT.texto),
    ativa: valor.ativa === true,
    especial: especialDoArquivo(valor.especial),
    efeitoDaFaixa: umDe<EfeitoDaFaixaDBT>(['dano', 'mitigacao', 'cura', 'ca'], valor.efeitoDaFaixa, 'dano'),
    kiManual: inteiroOuNulo(valor.kiManual, 0, KI_MAX),
    danoManual: faixaDoArquivo(valor.danoManual),
  }
}

function transformacaoDoArquivo(valor: unknown): TransformacaoDaFichaDBT | null {
  if (!ehRegistro(valor)) return null
  return {
    id: idDoItem(valor.id),
    livroId: idOuNulo(valor.livroId),
    nome: nome(valor.nome),
    estagio: inteiro(valor.estagio, 1, ESTAGIO_MAX, 1),
    ep: inteiro(valor.ep, -EP_MAX, EP_MAX, 0),
    custoKi: inteiro(valor.custoKi, 0, KI_MAX, 0),
    kiPorRodada: inteiro(valor.kiPorRodada, 0, KI_MAX, 0),
    efeitos: texto(valor.efeitos, LIMITES_DBT.texto),
    origem: texto(valor.origem, LIMITES_DBT.textoCurto),
  }
}

function itemDoArquivo(valor: unknown): ItemDaFichaDBT | null {
  if (!ehRegistro(valor)) return null
  return {
    id: idDoItem(valor.id),
    livroId: idOuNulo(valor.livroId),
    nome: nome(valor.nome),
    quantidade: inteiro(valor.quantidade, 0, QUANTIDADE_MAX, 1),
    carga: inteiro(valor.carga, 0, CARGA_MAX, 0),
    equipado: valor.equipado === true,
    descricao: texto(valor.descricao, LIMITES_DBT.texto),
    bonusCA: inteiro(valor.bonusCA, -CA_ITEM_MAX, CA_ITEM_MAX, 0),
    kiPorTurno: inteiro(valor.kiPorTurno, 0, KI_MAX, 0),
  }
}

function contadorDoArquivo(valor: unknown): ContadorDBT | null {
  if (!ehRegistro(valor)) return null
  return {
    id: idDoItem(valor.id),
    nome: nome(valor.nome),
    atual: inteiro(valor.atual, -PV_MAX, PV_MAX, 0),
    maximo: inteiroOuNulo(valor.maximo, 0, PV_MAX),
  }
}

/** Ajuste à mão: só chave conhecida com número; deslocamento aceita meio metro (passos de 1,5 m). */
function ajustesDoArquivo(valor: unknown): Partial<Record<DerivadoAjustavelDBT, number>> {
  if (!ehRegistro(valor)) return {}
  const ajustes: Partial<Record<DerivadoAjustavelDBT, number>> = {}
  for (const chave of DERIVADOS_AJUSTAVEIS) {
    const bruto = valor[chave]
    if (typeof bruto !== 'number' || !Number.isFinite(bruto)) continue
    if (chave === 'deslocamento') ajustes[chave] = Math.min(DESLOCAMENTO_MAX, Math.max(0, Math.round(bruto * 10) / 10))
    else if (chave === 'pvMax' || chave === 'pkMax' || chave === 'carga') ajustes[chave] = inteiro(bruto, 0, PV_MAX, 0)
    else ajustes[chave] = inteiro(bruto, AJUSTE_MIN, PV_MAX, 0)
  }
  return ajustes
}

function npcDoArquivo(valor: unknown): NpcDaFichaDBT | undefined {
  if (!ehRegistro(valor)) return undefined
  return {
    nd: inteiroOuNulo(valor.nd, 1, ND_MAX),
    categoria: umDe(CATEGORIAS_DE_NPC, valor.categoria, 'comum'),
    rank: umDe(RANKS, valor.rank, 'E'),
    passivas: habilidadesDoArquivo(valor.passivas, LIMITES_DBT.passivas, 'pas'),
    prontoId: idOuNulo(valor.prontoId),
  }
}

/**
 * `Personagem.dbt` como veio do disco ou da rede. Não é objeto = `null`
 * (o personagem fica sem ficha Dragon Ball); versão maior que a deste app =
 * `null` (não adivinha campo novo). O resto é tolerante: campo torto vira o
 * padrão de `fichaDBTVazia`, texto e lista passam pelos `LIMITES_DBT`,
 * perícia ou atributo desconhecido sai, id repetido ganha outro, e a
 * transformação ativa que não está na lista vira "nenhuma". Nunca lança.
 */
export function lerFichaDBT(valor: unknown): FichaDBT | null {
  if (!ehRegistro(valor)) return null
  if (typeof valor.versao === 'number' && valor.versao > VERSAO_DA_FICHA_DBT) return null
  const padrao = fichaDBTVazia()
  const transformacoes = comIdsUnicos(lista(valor.transformacoes, LIMITES_DBT.transformacoes, transformacaoDoArquivo), 'tra')
  const ativa = idOuNulo(valor.transformacaoAtiva)
  const npc = npcDoArquivo(valor.npc)
  return {
    versao: VERSAO_DA_FICHA_DBT,
    raca: idOuNulo(valor.raca) ?? padrao.raca,
    variante: idOuNulo(valor.variante) ?? padrao.variante,
    racaLivre: racaLivreDoArquivo(valor.racaLivre),
    pdl: inteiro(valor.pdl, 0, PDL_MAX, padrao.pdl),
    epInicial: inteiro(valor.epInicial, 0, EP_MAX, padrao.epInicial),
    aumentos: lista(valor.aumentos, LIMITES_DBT.aumentos, aumentoDoArquivo),
    periciasTreinadas: periciasDoArquivo(valor.periciasTreinadas),
    talentos: habilidadesDoArquivo(valor.talentos, LIMITES_DBT.talentos, 'tal'),
    movimentos: habilidadesDoArquivo(valor.movimentos, LIMITES_DBT.movimentos, 'mov'),
    tecnicas: comIdsUnicos(lista(valor.tecnicas, LIMITES_DBT.tecnicas, tecnicaDoArquivo), 'tec'),
    transformacoes,
    transformacaoAtiva: ativa !== null && transformacoes.some((forma) => forma.id === ativa) ? ativa : null,
    inventario: comIdsUnicos(lista(valor.inventario, LIMITES_DBT.inventario, itemDoArquivo), 'item'),
    caracteristicas: habilidadesDoArquivo(valor.caracteristicas, LIMITES_DBT.caracteristicas, 'car'),
    contadores: comIdsUnicos(lista(valor.contadores, LIMITES_DBT.contadores, contadorDoArquivo), 'cont'),
    tamanho: texto(valor.tamanho, LIMITES_DBT.textoCurto),
    idade: texto(valor.idade, LIMITES_DBT.textoCurto),
    personalidade: texto(valor.personalidade, LIMITES_DBT.textoCurto),
    historia: texto(valor.historia, LIMITES_DBT.historia),
    notas: texto(valor.notas, LIMITES_DBT.notas),
    kiBloqueado: inteiro(valor.kiBloqueado, 0, KI_MAX, padrao.kiBloqueado),
    ajustes: ajustesDoArquivo(valor.ajustes),
    // Só a chave: jogador nunca grava `npc: undefined` de volta.
    ...(npc !== undefined ? { npc } : {}),
  }
}
