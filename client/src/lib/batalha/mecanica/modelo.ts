import { NOME_DO_SELO_MAX, TURNOS_DO_SELO_MAX, DANO_MAX, CUSTO_MAX, MODS_POR_SELO_MAX, type VantagemDoDado } from '../combate'
import type { EscopoDoAlcance, MudancaDoAlcance } from '../alcance/condicoes'
import type { GatilhoDaCondicao } from '../../itens/modelo'
import { gatilhoLido } from '../../itens/pecasDoItem'

/**
 * AS PEÇAS DA TÉCNICA MONTADA (construtor de mecânicas, fatia C1; seção 1 de
 * docs/planos/construtor-de-mecanicas-2026-11-08.md). O dado mora no próprio
 * cartão (`CartaoDaFicha.mecanica`), versionado como a ficha DBT: `versao` e
 * um leitor que recusa versão futura. Sem o campo, o cartão abre e joga igual
 * a hoje (as 11 fichas não migram: seguem a mecânica à mão da F2).
 *
 * Tudo ou nada por cartão: com peças, Custo, Dano e Efeito em texto viram só
 * descrição. Peça torta = "mecânica inválida" (o cartão vira à mão); versão
 * maior que a do app = "atualize o app". Nos dois casos NÃO volta para o
 * texto, que pode estar velho.
 *
 * Esta fatia aceita só as peças que o motor já executa. As fatias seguintes
 * (área num ponto livre e alcance, C6 perguntas)
 * acrescentam variantes opcionais; até lá, um cartão com elas é recusado
 * aqui, e não executado pela metade.
 *
 * Puro: sem store, sem rede.
 */

/**
 * A versão mais nova que este app LÊ (Fase 2 de docs/design/habilidades/SISTEMA.md:
 * a versão 2 é a 1 com mais peças; a 1 continua lida como sempre). Fase B do
 * alcance (docs/design/habilidades/ALCANCE.md §3.3): a 3 é a 2 com a cruz, o
 * leque, o anel (`alcanceMinimo`) e o selo que muda o alcance. Fase ED1 do
 * editor novo (docs/design/habilidades/EDITOR.md §3.1): a 4 é a 3 com o tipo do
 * golpe (`golpe`), guardado como escolha e virado peças só na leitura do motor
 * (`pecasParaOMotor`, golpe.ts).
 */
export const VERSAO_DA_MECANICA = 4

/** As versões que este app lê. A peça lida guarda a versão com que veio. */
export type VersaoDaMecanica = 1 | 2 | 3 | 4

/**
 * A versão que este app GRAVA numa mecânica nova (modelos, arma montada).
 * Continua 1 enquanto nenhuma peça da 2 roda: assim a mecânica que o mestre
 * monta agora abre no app de antes e no site do Lobby. A fase que abrir uma
 * peça só da 2 grava 2 nas mecânicas que a usarem (`migrarV1ParaV2`).
 */
export const VERSAO_GRAVADA = 1

/** Teto de uma fórmula ("(Força + Espírito) * 1,5 + 100"), na gramática de `lerDano`. */
export const FORMULA_MAX = 200
/** Teto de efeitos por técnica. */
export const EFEITOS_MAX = 8
/** Teto de custos (um por momento: ao usar, por vez, depois). */
export const CUSTOS_MAX = 3
/** Teto dos multiplicadores extras (furtivo, ponto vital, marca). */
export const EXTRAS_MAX = 4
/** Teto de um multiplicador extra (×10). */
export const VEZES_MAX = 10
/** Teto do texto de um lembrete à mão. */
export const TEXTO_A_MAO_MAX = 200
/** Teto da recarga e dos usos por batalha. */
export const LIMITE_MAX = 20
/** Teto de alvos, de casas e do lado do quadrado. */
export const CASAS_MAX = 20
/** Teto da CD fixa (construtor C4). */
export const CD_MAX = 99
/** Teto do id de atributo num teste (construtor C4). */
export const ATRIBUTO_MAX = 64

/** Um número da peça: fixo ou fórmula da ficha de quem usa. */
export type NumeroSimples = { fixo: number } | { formula: string }
/** Um número que muda com a Concentração guardada (carga 0, 1, 2 e 3). */
export type Numero = NumeroSimples | { porCarga: readonly [NumeroSimples, NumeroSimples, NumeroSimples, NumeroSimples] }
/** Fase 5: o que a cura recupera. */
export type Recurso = 'hp' | 'sp' | 'escudo'
/** Fase 5: teto de nomes no "tira estas condições". */
export const NOMES_QUE_TIRA_MAX = 4
/** Fase 5: teto do "gasta N da mochila". */
export const ITENS_POR_USO_MAX = 10

/** Quanto custa: `aoUsar` bloqueia sem o recurso; `porTurno` = técnica mantida (lembrete "Aplicar / pular"), só fixo; `depois` cobra sem bloquear, só HP fixo. */
export interface Custo {
  recurso: 'sp' | 'hp'
  quanto: NumeroSimples | { porcento: number; de: 'maximo' | 'atual' }
  quando: 'aoUsar' | 'porTurno' | 'depois'
}

/** A ação que a técnica gasta; `perguntar` = quem usa escolhe na hora (a mira pergunta). */
export type AcaoDaMecanica = 'simples' | 'bonus' | 'completa' | 'livre' | 'perguntar'

/** `overload`: herda as regras da F1 (1 por batalha, gasta a Completa, só outra Overload defende). */
export interface Limite {
  recarga?: number
  usosPorBatalha?: number
  overload?: true
}

/**
 * O desenho do alvo. `quadrado` com `centro: 'si'` = em volta de quem usa (lado ímpar: 3x3 = raio 1).
 * Fase 6: `centro: 'ponto'` = em volta de uma casa que quem usa escolhe (a granada; a casa do ponto
 * entra); no `raio`, `centro: 'alvo'` = em volta de uma ficha escolhida (ela entra). Ausente = 'si'.
 * Versão 3 (fase B do alcance): `cruz` = as 4 retas de quem usa, até `casas`; `leque` = à frente,
 * abrindo 1, 3, 5 casas por fileira, até `casas` fileiras. As duas saem de quem usa (o tamanho é o alcance).
 */
export type FormaDoAlvo =
  | { tipo: 'um' }
  | { tipo: 'varios'; max: number; dividirDano?: true }
  | { tipo: 'linha'; casas: number }
  | { tipo: 'quadrado'; lado: number; centro: 'si' | 'frente' | 'ponto' }
  | { tipo: 'raio'; casas: number; centro?: 'alvo' | 'ponto' }
  | { tipo: 'cruz'; casas: number }
  | { tipo: 'leque'; casas: number }

export type QuemOAlvoPega = 'inimigos' | 'aliados' | 'todos' | 'si' | 'escolha'

/** Fase 6: em quem a técnica vale pela vida. 'caido' = quem está com 0 de vida (o reviver); ausente = de pé. */
export type EstadoDoAlvo = 'dePe' | 'caido'

export interface AlvoDaMecanica {
  quem: QuemOAlvoPega
  forma: FormaDoAlvo
  /** Fase 5: só vale em quem tem este selo (a redoma da Florescer). Ausente = em qualquer um. */
  exigeSelo?: string
  /**
   * Fase 6: até quantas casas de quem usa (a distância do xadrez, da borda da ficha): o alvo
   * escolhido, ou a casa / a ficha no centro da área longe. Ausente = sem limite conferido (como hoje).
   */
  alcance?: number
  /**
   * Versão 3 (fase B do alcance): o anel. O alvo escolhido (um ou vários) fica de `alcanceMinimo`
   * a `alcance` casas, nunca mais perto. Só com `alcance`; de 2 até o `alcance`. Ausente = desde o colado.
   */
  alcanceMinimo?: number
  /** Fase 6: 'caido' só com o efeito reviver (e o reviver só com ele). Ausente = 'dePe'. */
  estado?: 'caido'
}

/** Fase 6: a área longe (em volta de um ponto ou de uma ficha escolhida); `null` = a área sai de quem usa, ou não há área. */
export function centroDaArea(forma: FormaDoAlvo): 'ponto' | 'alvo' | null {
  if (forma.tipo === 'quadrado') return forma.centro === 'ponto' ? 'ponto' : null
  if (forma.tipo === 'raio') return forma.centro ?? null
  return null
}

/** Um número da CD que muda com a Concentração; `automatico` = naquela carga pega sem teste. */
export type NumeroDaCd = NumeroSimples | 'automatico'

/**
 * A CD do teste (construtor C4): um número, uma fórmula na ficha de quem usa
 * ("12 + mod(Carisma)"), ou pela Concentração guardada (carga 0 a 3; na carga
 * 0 sempre há teste).
 */
export type CdDoTeste = NumeroSimples | { porCarga: readonly [NumeroSimples, NumeroDaCd, NumeroDaCd, NumeroDaCd] }

/** Quem rola num teste: o atributo (id do sistema) e, se houver, a vantagem (2 d20, fica o maior) ou a desvantagem (fica o menor). */
export interface QuemRolaNoTeste {
  atributo: string
  vantagem?: VantagemDoDado
}

/**
 * Como acerta. `reacao`: o alvo reage com o d20 de sempre. `naoErra`: sem
 * reação. Construtor C4, os dois testes que o app rola ao usar, no lugar da
 * reação: `resistencia` (o alvo rola d20 + mod do atributo contra a CD;
 * passou = nada, ou nada e a técnica não gasta) e `disputa` (d20 + mod de
 * quem usa contra d20 + mod do alvo; o empate fica com o alvo).
 */
export type Teste =
  | { tipo: 'reacao' }
  | { tipo: 'naoErra' }
  | { tipo: 'resistencia'; alvo: QuemRolaNoTeste; cd: CdDoTeste; sePassar: 'nada' | 'devolveCusto' | 'metade' }
  | { tipo: 'disputa'; usuario: QuemRolaNoTeste; alvo: QuemRolaNoTeste }

/** A fórmula do dano soma a arma (a padrão, ou a que a mira pergunta). */
export function danoUsaArma(dano: Pick<DanoDaMecanica, 'arma'> | undefined): boolean {
  return dano?.arma === 'padrao' || dano?.arma === 'perguntar'
}

/** O teste é rolado pelo app ao usar (resistência ou disputa)? */
export function testeRolado(teste: Teste): teste is Extract<Teste, { tipo: 'resistencia' | 'disputa' }> {
  return teste.tipo === 'resistencia' || teste.tipo === 'disputa'
}

/** Um multiplicador a mais, na ordem da lista, depois da Concentração e da Surpresa. */
export interface MultiplicadorExtra {
  nome: string
  vezes: number
}

export interface DanoDaMecanica {
  /** Fase 5 (B10): ou a parte da vida do alvo ("25% do HP máximo do alvo"), no lugar da fórmula. */
  base: NumeroSimples | Porcento
  /**
   * `padrao` = a arma padrão da ficha entra no "Dano da arma" (na arma montada, ela mesma);
   * `perguntar` (construtor C8, o Siegfried) = a mira pergunta qual das armas levadas, já
   * marcada a padrão; ausente ou `nenhuma` = sem arma.
   */
  arma?: 'nenhuma' | 'padrao' | 'perguntar'
  perfurante?: boolean
  /** Fase 5 (B13): de 1 a 99, só esta parte vai direto ao HP ("Perfurante 50%"); com ela, o golpe é perfurante. */
  perfuracao?: number
  /** Fase 5 (B17): outro golpe nos mesmos alvos, com a fração do dano, o perfurante dele e outra reação (o Rapid Dash). */
  segundoGolpe?: SegundoGolpeDaPeca
  multiplicadores: { concentracao: boolean; surpresa: boolean; extra?: readonly MultiplicadorExtra[] }
}

/** Fase 5: o 2º golpe das peças, como o `SegundoGolpeAMao` da tabela. */
export interface SegundoGolpeDaPeca {
  /** A parte do dano base que o 2º golpe leva (0,5 = metade), acima de 0 e até 1. */
  fracao: number
  perfurante: boolean
}

/**
 * Por quanto tempo o selo fica (construtor C5). O número conta na vez de quem
 * tem o selo, como a regra do sistema (`contarSelos`): desce 1 no fim de cada
 * vez dele, e a vez em que nasceu não conta (1 = até o fim da próxima vez
 * dele). `ateTirar` = até o mestre tirar; `proximoGolpe` = sai quando o
 * próximo golpe chega em quem o tem (a redoma da Orquídea).
 */
export type DuracaoDoSelo = number | 'ateTirar' | 'proximoGolpe'

/**
 * O que o selo tira no começo de cada vez de quem o tem (construtor C5:
 * Sangrando, Queimando N, um veneno de NPC). Sempre pelo lembrete "Aplicar /
 * pular" do mestre. Por enquanto só HP em número fixo, direto (sem o Escudo):
 * é o que o lembrete do sangramento aplica. A forma completa do plano
 * (`recurso` SP, fórmula, pelo Escudo) entra sem mudar a peça.
 */
export interface PorTurnoDoSelo {
  recurso: 'hp' | 'sp'
  quanto: { fixo: number }
  direto: true
  /**
   * Fase 5: 'da' = regeneração (no fim de cada vez de quem tem o selo, ganha
   * o número); ausente = 'tira' (o HP pelo lembrete, como sempre; o SP no fim
   * da vez, como as Chamas Celestes).
   */
  sinal?: 'tira' | 'da'
  /** Fase 5: só no SP tirado: o que quem usou a técnica ganha a cada vez (o dreno). */
  paraQuemUsa?: number
}

/** Versão 3 (fase B do alcance): como o selo mexe no alcance. 'soma' = +N ou -N casas; 'teto' = no máximo N casas. */
export type MexeNoAlcance = MudancaDoAlcance['mexe']

/** Versão 3: em que o selo mexe no alcance (o escopo, ALCANCE.md §3.3). */
export type ValeParaOAlcance = EscopoDoAlcance

/** Os escopos, na ordem da tela. */
export const VALES_DO_ALCANCE: readonly ValeParaOAlcance[] = ['tudo', 'armas', 'habilidades', 'itens']

/**
 * Versão 3 (fase B do alcance): o que o selo faz no alcance de quem o tem ("Ofuscado: -2 em tudo",
 * "Cego: no máximo 1"). É a MESMA forma que `alcanceComCondicoes` (lib/batalha/alcance/condicoes.ts)
 * lê: primeiro as somas, depois o menor teto, nunca abaixo de 1. Na soma, `n` nunca é 0; no teto, de 1 a `CASAS_MAX`.
 */
export type AlcanceDoSelo = MudancaDoAlcance

/** Fase 5: o número que o selo soma enquanto existe ("Força +20"). `alvo` = id de atributo, 'dano' ou 'reacao'; o fixo pode ser negativo (tira). */
export interface ModDaPeca {
  alvo: string
  delta: NumeroSimples
}

/** Fase 5: teto de selos no mesmo golpe (decisão C4). */
export const SELOS_NO_GOLPE_MAX = 3
/** Fase 7: curas no mesmo alvo, de recursos diferentes (o Elixir: HP e SP). */
export const CURAS_NO_ALVO_MAX = 2

/** Fase 6: com quanta vida o caído volta: "25% do HP máximo" (dele) ou um número / fórmula na ficha de quem usa. */
export type VoltaDoReviver = NumeroSimples | { porcento: number; de: 'hpMaximo'; deQuem: 'alvo' }

export type Efeito =
  /**
   * O comportamento do selo vem do NOME, pela tabela de `condicoes.ts` (a
   * mesma da F2): Atordoado trava a vez, Aéreo tira a esquiva e o contra, Cego
   * zera a Percepção, Queimando renova. Assim a regra chega também ao jogador,
   * que só recebe o nome. Nome fora da tabela = selo sem regra própria.
   */
  /** `em: 'atacante'` (fase 4): só na técnica de reação, o selo vai em quem bateu. Ausente = no alvo do golpe. */
  /** Fase 5: `em: 'quemUsa'` (a postura), `mods` (Força +20) e `regra` (dano e cura recebidos). Versão 3: `alcance` (o selo muda o alcance). */
  /** Versão 4 (fase ED4): `pega` = o teste do selo (o alvo acertado rola d20 + mod do atributo contra a CD; passou, o selo não entra). Só no selo do alvo. */
  /** Pedido de 26/11: `gatilho` = "depois de X turnos" da condição que o "Ao acertar" do item põe na ficha (lib/condicoes/gatilho.ts); o motor das técnicas não o lê. */
  | { tipo: 'selo'; nome: string; duracao: DuracaoDoSelo; natureza?: 'buff' | 'debuff'; porTurno?: PorTurnoDoSelo; em?: Exclude<EmQuem, 'alvo'>; mods?: readonly ModDaPeca[]; regra?: RegraDoSelo; alcance?: AlcanceDoSelo; pega?: TesteDoTipo; gatilho?: GatilhoDaCondicao }
  /** Fase 5: recuperar SP, dar Escudo (a Barreira) e curar quem usa (`em: 'quemUsa'`, o golpe que cura quem bate). */
  /** Fase 7: `quanto` pela parte do máximo do alvo (a Poção Suprema, 50% do HP máximo); HP e SP juntos no mesmo alvo (o Elixir). */
  | { tipo: 'cura'; recurso: Recurso; quanto: Numero | PorcentoDaCura; emQuem: 'alvo'; em?: 'quemUsa' }
  /** Fase 5: tirar pelo nome (o antídoto), as positivas ou todas. */
  | { tipo: 'tirarSelos'; quais: 'negativos' | 'positivos' | 'todos' | { nomes: readonly string[] } }
  /** Fase 5: roubo de vida: parte do dano que o golpe causou volta em HP para quem usa. */
  | { tipo: 'dreno'; recurso: 'hp'; porcentoDoDano: number }
  /** Fase 6 (H14): o caído volta com esta vida (a parte do HP máximo dele, ou um número / fórmula de quem usa). Só com `alvo.estado: 'caido'`. */
  | { tipo: 'reviver'; volta: VoltaDoReviver }
  /** Porta de escape: o app não executa nada, só lembra o mestre. */
  | { tipo: 'aMao'; texto: string }

/**
 * As peças lidas (versão 1 ou 2). A 2 é um SUPERCONJUNTO da 1 (decisão C2):
 * toda peça da 1 vale na 2 com o mesmo sentido, e as peças novas entram aqui
 * uma fase por vez, quando o motor passa a executá-las (`PECAS_QUE_AINDA_NAO_RODAM`).
 */
export interface MecanicaV2 {
  versao: VersaoDaMecanica
  acao: AcaoDaMecanica
  custos: readonly Custo[]
  limite: Limite
  alvo: AlvoDaMecanica
  teste: Teste
  dano?: DanoDaMecanica
  efeitos: readonly Efeito[]
  /** Fase 4: como entra em jogo; ausente = 'ativa' (toda mecânica da versão 1). */
  uso?: UsoDaMecanica
  /** Fase 4 (decisão M2): o que a técnica faz NO LUGAR da reação; só com `uso` de reação. */
  reacao?: ReacaoDaMecanica
  /** Fase 5: cada uso gasta isto da mochila (a Medicina gasta 1 Kit Médico); sem sobrar, a técnica fica apagada. */
  custoEmItem?: CustoEmItem
  /**
   * Versão 4 (fase ED1 do editor novo): o tipo do golpe, como o mestre escolheu. O motor nunca lê
   * este campo: lê as peças que `pecasParaOMotor` (golpe.ts) monta com ele. Ausente = sem tipo.
   */
  golpe?: GolpeDaMecanica
}

// ─── Versão 4: o tipo do golpe (EDITOR.md §3.1 e §3.2) ─────────────────────
// Guardado como ESCOLHA (o tipo e a regra que o mestre mudou), nunca como as
// peças soltas: assim a escolha não se perde e o mesmo selo não mora em dois
// lugares. Os padrões são os do protótipo aprovado (editor/prototipo.html,
// tabelas FISICOS e ELEMENTOS).

/** Quando o selo do tipo pega: sempre que o golpe acerta; com teste (o alvo rola para não pegar); ou só dá o nome ao golpe (o Caça às Bruxas é de fogo e não queima). */
export type QuandoOTipoPega = 'sempre' | 'teste' | 'soTipo'

/** O teste do "com teste": o alvo rola d20 + mod do atributo (id do sistema) contra a CD; passou, não pega. */
export interface TesteDoTipo {
  atributo: string
  cd: CdDoTeste
}

/** A parte da regra de todo tipo que põe uma condição: quando pega e por quantas vezes do alvo (a contagem do selo). */
export interface RegraQuePoeCondicao {
  quando: QuandoOTipoPega
  /** Só no "com teste". */
  teste?: TesteDoTipo
  vezes: number
}

/** A regra de cada tipo: o que o mestre pode mudar nele. */
export interface RegrasDosTipos {
  /** Atordoado; `casas` = empurra (0 = não empurra; o mestre move a ficha). */
  impacto: RegraQuePoeCondicao & { casas: number }
  /** Sangrando; `porVez` = HP tirado no começo de cada vez, direto. */
  cortante: RegraQuePoeCondicao & { porVez: number }
  /** A parte do dano que passa o Escudo (100 = tudo). Não põe condição. */
  perfurante: { porcento: number }
  queimadura: RegraQuePoeCondicao & { porVez: number }
  /** Envenenado; além do HP por vez, a cura que o alvo recebe cai pela metade. */
  veneno: RegraQuePoeCondicao & { porVez: number }
  /** Congelado; `casas` = quanto o alcance dele cai. Reage com desvantagem. */
  congelamento: RegraQuePoeCondicao & { casas: number }
  /** Eletrizado; `porVez` = SP perdido no fim de cada vez. */
  choque: RegraQuePoeCondicao & { porVez: number }
  /** Cego (a Percepção fica em 0, pela tabela dos selos). */
  cegueira: RegraQuePoeCondicao
  /** Enfraquecido; quanto a Força e o Dano caem. */
  enfraquecer: RegraQuePoeCondicao & { forca: number; dano: number }
  /** Uma condição com o nome que o mestre quiser e, se quiser, HP por vez. */
  outro: RegraQuePoeCondicao & { nome: string; porVez: number }
}

export type TipoDoGolpe = keyof RegrasDosTipos
/** Como o golpe bate: escolhe um. */
export type TipoQueBate = 'impacto' | 'cortante' | 'perfurante'
/** O que o golpe causa: vários, cada tipo uma vez. */
export type TipoQueCausa = Exclude<TipoDoGolpe, TipoQueBate>

/** Os tipos, na ordem da tela. */
export const TIPOS_QUE_BATEM: readonly TipoQueBate[] = ['impacto', 'cortante', 'perfurante']
export const TIPOS_QUE_CAUSAM: readonly TipoQueCausa[] = ['queimadura', 'veneno', 'congelamento', 'choque', 'cegueira', 'enfraquecer', 'outro']

/** Um tipo escolhido, com a regra dele. */
export type TipoComRegra<T extends TipoDoGolpe> = { [K in T]: { tipo: K; regra: RegrasDosTipos[K] } }[T]

export interface GolpeDaMecanica {
  bate?: TipoComRegra<TipoQueBate>
  causa?: readonly TipoComRegra<TipoQueCausa>[]
}

/** O teste de partida do "com teste": Resistência contra CD 12. */
export const TESTE_DO_TIPO_DE_PARTIDA: TesteDoTipo = { atributo: 'resistencia', cd: { fixo: 12 } }

/** A regra que cada tipo traz ao ser escolhido (os padrões aprovados no protótipo). A leitura completa com ela o que faltar. */
export const REGRA_DE_PARTIDA: { readonly [K in TipoDoGolpe]: RegrasDosTipos[K] } = {
  impacto: { quando: 'teste', teste: TESTE_DO_TIPO_DE_PARTIDA, vezes: 1, casas: 0 },
  cortante: { quando: 'sempre', vezes: 3, porVez: 10 },
  perfurante: { porcento: 100 },
  queimadura: { quando: 'sempre', vezes: 3, porVez: 10 },
  veneno: { quando: 'sempre', vezes: 3, porVez: 10 },
  congelamento: { quando: 'teste', teste: TESTE_DO_TIPO_DE_PARTIDA, vezes: 2, casas: 2 },
  choque: { quando: 'sempre', vezes: 2, porVez: 10 },
  cegueira: { quando: 'teste', teste: TESTE_DO_TIPO_DE_PARTIDA, vezes: 2 },
  enfraquecer: { quando: 'sempre', vezes: 2, forca: 20, dano: 10 },
  outro: { quando: 'sempre', vezes: 2, porVez: 0, nome: 'Marcado' },
}

/** O golpe com o que vale: sem tipo nenhum (nem como bate, nem o que causa) = `undefined` (o cartão não precisa da 4). */
export function golpeQueVale(golpe: GolpeDaMecanica | undefined): GolpeDaMecanica | undefined {
  if (golpe === undefined) return undefined
  const causa = golpe.causa === undefined || golpe.causa.length === 0 ? undefined : golpe.causa
  if (golpe.bate === undefined && causa === undefined) return undefined
  return { ...(golpe.bate === undefined ? {} : { bate: golpe.bate }), ...(causa === undefined ? {} : { causa }) }
}

/** Fase ED4: o selo com peça que só a 4 diz (o teste do selo, `pega`, ou o "reage com desvantagem" da regra, o Congelado). */
function seloDaVersao4(efeito: Efeito): boolean {
  return efeito.tipo === 'selo' && (efeito.pega !== undefined || efeito.regra?.reageComDesvantagem === true)
}

/**
 * Versão 4: a mecânica tem peça que só a 4 diz (fase ED1: o tipo do golpe; ED4: o teste do selo e o
 * "reage com desvantagem" nos Efeitos; o "+N" no acumulador mora na definição do acumulador, não
 * aqui). Quem grava usa a 4 só nesse caso: o app de antes (que lê até a 3) lê a 4 como "atualize o
 * app" e o cartão fica à mão sem perder nada; toda outra mecânica continua 1, 2 ou 3.
 */
export function precisaDaVersao4(mecanica: Pick<MecanicaV2, 'golpe' | 'efeitos'>): boolean {
  return golpeQueVale(mecanica.golpe) !== undefined || mecanica.efeitos.some(seloDaVersao4)
}

/** O nome da fatia C1, mantido para quem já o usa: são as mesmas peças lidas (`MecanicaV2`). */
export type MecanicaV1 = MecanicaV2

/**
 * A 1 vira 2: só a versão muda, o resto é igual (a 2 é superconjunto). Pura
 * e total. Quem grava chama quando a mecânica ganha uma peça só da 2.
 */
export function migrarV1ParaV2(mecanica: MecanicaV2): MecanicaV2 {
  return mecanica.versao === 2 ? mecanica : { ...mecanica, versao: 2 }
}

/**
 * A mecânica tem peça que só a versão 2 diz (fase 4: a reação montada, o selo
 * em quem atacou). Quem grava usa a 2 só nesse caso: o app de antes e o site do
 * Lobby leem a 2 como "atualize o app" (o cartão fica à mão, nada se perde), e
 * toda outra mecânica continua 1 e abre neles como sempre.
 */
export function precisaDaVersao2(mecanica: Pick<MecanicaV2, 'uso' | 'reacao' | 'efeitos' | 'alvo' | 'custoEmItem' | 'dano' | 'teste'>): boolean {
  if ((mecanica.uso !== undefined && mecanica.uso !== 'ativa') || mecanica.reacao !== undefined) return true
  // Fase 5: a perfuração parcial, o 2º golpe e a metade para quem passa.
  if (mecanica.dano?.perfuracao !== undefined || mecanica.dano?.segundoGolpe !== undefined) return true
  if (mecanica.dano !== undefined && 'porcento' in mecanica.dano.base) return true
  if (mecanica.teste.tipo === 'resistencia' && mecanica.teste.sePassar === 'metade') return true
  // Fase 5: as peças do lote A (o app de antes as recusa; com a 2 ele diz "atualize o app").
  if (mecanica.alvo.exigeSelo !== undefined || mecanica.custoEmItem !== undefined) return true
  if (mecanica.efeitos.some((efeito) => efeito.tipo === 'dreno' || (efeito.tipo === 'cura' && (efeito.recurso !== 'hp' || efeito.em !== undefined)) || (efeito.tipo === 'tirarSelos' && efeito.quais !== 'negativos'))) return true
  if (mecanica.efeitos.filter((efeito) => efeito.tipo === 'selo').length > 1) return true
  // Fase 7: a cura pela parte do máximo e duas curas no mesmo alvo (o Elixir).
  if (mecanica.efeitos.some((efeito) => efeito.tipo === 'cura' && 'porcento' in efeito.quanto)) return true
  if (mecanica.efeitos.filter((efeito) => efeito.tipo === 'cura' && efeito.em === undefined).length > 1) return true
  // Fase 6: a área longe, o alcance, o alvo caído e o reviver.
  if (mecanica.alvo.alcance !== undefined || mecanica.alvo.estado !== undefined || centroDaArea(mecanica.alvo.forma) !== null) return true
  if (mecanica.efeitos.some((efeito) => efeito.tipo === 'reviver')) return true
  return mecanica.efeitos.some((efeito) => efeito.tipo === 'selo' && seloDaVersao2(efeito))
}

/**
 * Versão 3 (fase B do alcance, ALCANCE.md §3.3): a mecânica tem peça que só a 3 diz (a cruz, o leque,
 * o anel, o selo que muda o alcance). Quem grava usa a 3 só nesse caso: o app de antes (que lê até a 2)
 * lê a 3 como "atualize o app" e o cartão fica à mão sem perder nada; toda outra mecânica continua 1 ou 2.
 */
export function precisaDaVersao3(mecanica: Pick<MecanicaV2, 'alvo' | 'efeitos'>): boolean {
  const { forma, alcanceMinimo } = mecanica.alvo
  if (forma.tipo === 'cruz' || forma.tipo === 'leque' || alcanceMinimo !== undefined) return true
  return mecanica.efeitos.some((efeito) => efeito.tipo === 'selo' && efeito.alcance !== undefined)
}

/** O selo com peça só da 2: em quem usa ou em quem atacou, com número, com regra, ou o "por vez" que não é o HP tirado. */
function seloDaVersao2(selo: Extract<Efeito, { tipo: 'selo' }>): boolean {
  const porTurno = selo.porTurno
  const porTurnoNovo = porTurno !== undefined && (porTurno.recurso !== 'hp' || porTurno.sinal !== undefined || porTurno.paraQuemUsa !== undefined)
  return selo.em !== undefined || selo.mods !== undefined || selo.regra !== undefined || porTurnoNovo
}

// ─── Versão 2: as peças novas, ainda sem motor ──────────────────────────────
// Os tipos da seção 2 do SISTEMA.md que as fases 4 a 8 abrem. Até a fase de
// cada uma, a leitura RECUSA a peça com "este app ainda não executa ..." (o
// cartão vira à mão, nunca roda pela metade). Quem abrir uma peça põe o campo
// na interface de cima, lê na `lerMecanica` e tira a linha da tabela de baixo.

/** Parte da vida ou do SP de alguém: "25% do HP máximo do alvo" (fase 5). */
export interface Porcento {
  porcento: number
  de: 'hpMaximo' | 'hpAtual' | 'hpQueFalta' | 'spMaximo'
  deQuem: 'alvo' | 'quemUsa'
}
/**
 * Fase 7 (itens): a cura pela parte do máximo DO ALVO, do mesmo recurso que ela
 * recupera ("50% do HP máximo"; 100% enche). Só no alvo, sem Concentração.
 */
export interface PorcentoDaCura {
  porcento: number
  de: 'hpMaximo' | 'spMaximo'
  deQuem: 'alvo'
}
/** O máximo que a cura pela parte lê, pelo recurso que ela recupera (o Escudo não tem máximo). */
export const MAXIMO_DA_CURA: Readonly<Record<'hp' | 'sp', PorcentoDaCura['de']>> = { hp: 'hpMaximo', sp: 'spMaximo' }
/** COMO entra em jogo (fase 4). Ausente = 'ativa' (toda mecânica da versão 1). */
export type UsoDaMecanica = 'ativa' | 'reacao' | 'ativaOuReacao'
/** Gastar coisa da mochila além do SP e do HP (fase 5). */
export interface CustoEmItem {
  nome: string
  itemId?: string
  quantos: number
}
/** Em quem o efeito cai; 'atacante' só na reação (fases 4 e 5). Ausente = 'alvo'. */
export type EmQuem = 'alvo' | 'quemUsa' | 'atacante'
/** O que o selo faz além do nome (fase 5). */
export interface RegraDoSelo {
  trava?: true
  tiraSaidas?: readonly ('esquiva' | 'contra')[]
  reageComDesvantagem?: true
  danoRecebido?: number
  curaRecebida?: number
}
/** A técnica usada NO LUGAR da reação (decisão M2, fase 4). */
export interface ReacaoDaMecanica {
  defesa: { tipo: 'anula' } | { tipo: 'fica'; porcento: number } | { tipo: 'rola'; atributos: readonly string[]; anulaCom: number } | { tipo: 'nenhuma' }
  /** O dano que ficou, dividido por este número, volta em quem atacou. Devolver por fórmula (seção 2 do SISTEMA) ainda é recusado. */
  devolve?: { divididoPor: number }
  curaDoQueChegava?: number
  valeContra?: readonly ('overload' | 'surpresa')[]
  soOMestre?: true
}

/**
 * As peças da versão 2 que a leitura conhece e ainda recusa, por lugar: a
 * chave e a frase que completa "este app ainda não executa ...". Chave de
 * fora desta tabela segue "que este app não conhece", como na versão 1.
 */
export const PECAS_QUE_AINDA_NAO_RODAM: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  limite: { porRodada: 'limite por rodada' },
  selo: { seJaTem: 'renovar o selo' },
}

/** Os efeitos da versão 2 que ainda não rodam, pelo tipo. */
const EFEITOS_QUE_AINDA_NAO_RODAM: Readonly<Record<string, string>> = { mover: 'empurrar e puxar' }

/** O que a leitura do campo `mecanica` dá. */
export type MecanicaLida =
  /** O cartão não tem o campo: segue pelo texto (as fichas de hoje). */
  | { tipo: 'nenhuma' }
  | { tipo: 'pecas'; mecanica: MecanicaV2 }
  /** Peça torta: o cartão vira à mão. `motivo` em português simples. */
  | { tipo: 'invalida'; motivo: string }
  /** Feita num app mais novo: o cartão vira à mão até atualizar. */
  | { tipo: 'futura'; versao: number }

/** O aviso do cartão com mecânica que este app não executa. */
export function avisoDaMecanica(lida: Extract<MecanicaLida, { tipo: 'invalida' | 'futura' }>): string {
  return lida.tipo === 'futura' ? 'Mecânica feita num app mais novo: atualize o app. Por enquanto, à mão.' : `Mecânica inválida (${lida.motivo}): à mão.`
}

// ─── Leitura ────────────────────────────────────────────────────────────────

/** A peça torta: sai da leitura com o motivo (nunca escapa de `lerMecanica`). */
class PecaTorta extends Error {}

function torta(motivo: string): never {
  throw new PecaTorta(motivo)
}

function registro(valor: unknown, onde: string): Record<string, unknown> {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) torta(`${onde} não é uma peça`)
  return { ...valor }
}

/**
 * Só as chaves conhecidas: chave de fatia futura não roda pela metade. A peça
 * da versão 2 que ainda não roda (`PECAS_QUE_AINDA_NAO_RODAM`, pelo `lugar`) diz isso.
 */
function soChaves(peca: Record<string, unknown>, permitidas: readonly string[], onde: string, lugar?: string): void {
  const sobra = Object.keys(peca).find((chave) => !permitidas.includes(chave))
  if (sobra === undefined) return
  const nova = lugar === undefined ? undefined : PECAS_QUE_AINDA_NAO_RODAM[lugar]?.[sobra]
  if (nova !== undefined) aindaNaoRoda(nova)
  torta(`${onde} tem "${sobra}", que este app não conhece`)
}

/** A peça da versão 2 que a leitura conhece e o motor ainda não executa: o cartão vira à mão com o porquê. */
function aindaNaoRoda(oQue: string): never {
  torta(`este app ainda não executa ${oQue}`)
}

/** Fase 5 (B10): o que a parte da vida lê do alvo, no nome que a fórmula de sempre entende ("25% da vida máxima do alvo"). */
export const VIDA_DO_PORCENTO: Readonly<Partial<Record<Porcento['de'], string>>> = { hpAtual: 'atual', hpMaximo: 'máxima' }

/** Fase 5 (B10): a base "N% da vida do alvo". Só a vida atual ou a máxima do alvo rodam (a fórmula de sempre lê as duas). */
function porcentoDaBase(peca: Record<string, unknown>): Porcento {
  soChaves(peca, ['porcento', 'de', 'deQuem'], 'dano pela vida')
  const de = umDe(peca.de, ['hpMaximo', 'hpAtual', 'hpQueFalta', 'spMaximo'] as const, 'dano pela vida (de quê)')
  if (VIDA_DO_PORCENTO[de] === undefined) aindaNaoRoda('dano pela vida que falta ou pelo SP')
  const deQuem = umDe(peca.deQuem ?? 'alvo', ['alvo', 'quemUsa'] as const, 'dano pela vida (de quem)')
  if (deQuem !== 'alvo') aindaNaoRoda('dano pela vida de quem usa')
  return { porcento: inteiro(peca.porcento, 1, 100, 'dano pela vida (%)'), de, deQuem }
}

/** Fase 7: a cura escrita como parte do máximo ("50% do HP máximo"). */
function curaPelaParte(valor: unknown): boolean {
  return typeof valor === 'object' && valor !== null && 'porcento' in valor
}

/** Fase 7: a parte do máximo do alvo, do MESMO recurso que a cura recupera (o HP pelo HP máximo, o SP pelo SP máximo). */
function porcentoDaCura(valor: unknown, recurso: Recurso, onde: string): PorcentoDaCura {
  const peca = registro(valor, `${onde} (quanto)`)
  soChaves(peca, ['porcento', 'de', 'deQuem'], `${onde} (parte do máximo)`)
  if (recurso === 'escudo') aindaNaoRoda('Escudo pela parte do máximo')
  const de = umDe(peca.de ?? MAXIMO_DA_CURA[recurso], ['hpMaximo', 'spMaximo'] as const, `${onde} (parte de quê)`)
  if (de !== MAXIMO_DA_CURA[recurso]) torta(`${onde}: a parte do máximo precisa ser do mesmo recurso que a cura recupera`)
  if ((peca.deQuem ?? 'alvo') !== 'alvo') aindaNaoRoda('cura pela parte do máximo de quem usa')
  return { porcento: inteiro(peca.porcento, 1, 100, `${onde} (parte do máximo, %)`), de, deQuem: 'alvo' }
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[], onde: string): T {
  const achada = opcoes.find((opcao) => opcao === valor)
  if (achada === undefined) torta(`${onde} fora da lista`)
  return achada
}

function inteiro(valor: unknown, minimo: number, maximo: number, onde: string): number {
  if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < minimo || valor > maximo) torta(`${onde} precisa ser inteiro de ${minimo} a ${maximo}`)
  return valor
}

function texto(valor: unknown, maximo: number, onde: string): string {
  if (typeof valor !== 'string' || valor.trim().length === 0 || valor.length > maximo || /[\r\n]/.test(valor)) torta(`${onde} precisa ter de 1 a ${maximo} letras, numa linha`)
  return valor
}

function lista(valor: unknown, maximo: number, onde: string): unknown[] {
  if (!Array.isArray(valor)) torta(`${onde} não é uma lista`)
  if (valor.length > maximo) torta(`${onde} passa de ${maximo}`)
  return valor
}

function numeroSimples(valor: unknown, maximo: number, onde: string): NumeroSimples {
  const peca = registro(valor, onde)
  if ('fixo' in peca) {
    soChaves(peca, ['fixo'], onde)
    return { fixo: inteiro(peca.fixo, 0, maximo, onde) }
  }
  soChaves(peca, ['formula'], onde)
  return { formula: texto(peca.formula, FORMULA_MAX, `${onde} (fórmula)`) }
}

function numero(valor: unknown, maximo: number, onde: string): Numero {
  const peca = registro(valor, onde)
  if (!('porCarga' in peca)) return numeroSimples(peca, maximo, onde)
  soChaves(peca, ['porCarga'], onde)
  const cargas = lista(peca.porCarga, 4, `${onde} por carga`).map((item, carga) => numeroSimples(item, maximo, `${onde} na carga ${carga}`))
  const [zero, um, dois, tres] = cargas
  if (zero === undefined || um === undefined || dois === undefined || tres === undefined) torta(`${onde} por carga precisa de 4 números (carga 0 a 3)`)
  return { porCarga: [zero, um, dois, tres] }
}

function quantoDoCusto(valor: unknown, onde: string): Custo['quanto'] {
  const quanto = registro(valor, `${onde} (quanto)`)
  if (!('porcento' in quanto)) return numeroSimples(quanto, CUSTO_MAX, onde)
  soChaves(quanto, ['porcento', 'de'], onde)
  return { porcento: inteiro(quanto.porcento, 1, 100, `${onde} (porcentagem)`), de: umDe(quanto.de, ['maximo', 'atual'] as const, `${onde} (de quê)`) }
}

function custo(valor: unknown, indice: number): Custo {
  const onde = `custo ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['recurso', 'quanto', 'quando'], onde)
  const lido = quantoDoCusto(peca.quanto, onde)
  const quando = umDe(peca.quando, ['aoUsar', 'porTurno', 'depois'] as const, `${onde} (quando)`)
  // A técnica mantida cobra o mesmo número a cada vez (`MantidaAMao.custoPorVez`): só o fixo cabe nela.
  if (quando === 'porTurno' && !('fixo' in lido)) torta(`${onde}: o custo por vez precisa ser um número fixo`)
  const recurso = umDe(peca.recurso, ['sp', 'hp'] as const, `${onde} (recurso)`)
  // O "depois" cobra pelo `custoEmHp` da linha (Sai Dai Rin): só HP fixo. Outro "depois" seria lido e nunca cobrado.
  if (quando === 'depois' && (recurso !== 'hp' || !('fixo' in lido))) torta(`${onde}: o custo depois de usar, por enquanto, só aceita HP em número fixo`)
  return { recurso, quanto: lido, quando }
}

function limite(valor: unknown): Limite {
  const peca = registro(valor ?? {}, 'limite')
  soChaves(peca, ['recarga', 'usosPorBatalha', 'overload'], 'limite', 'limite')
  const lido: Limite = {}
  if (peca.recarga !== undefined) lido.recarga = inteiro(peca.recarga, 1, LIMITE_MAX, 'recarga')
  if (peca.usosPorBatalha !== undefined) lido.usosPorBatalha = inteiro(peca.usosPorBatalha, 1, LIMITE_MAX, 'usos por batalha')
  // O motor guarda um Tempo só por técnica (`LeituraDoTempo`).
  if (lido.recarga !== undefined && lido.usosPorBatalha !== undefined) torta('recarga e usos por batalha juntos')
  if (peca.overload !== undefined) {
    if (peca.overload !== true) torta('overload só aceita "sim"')
    lido.overload = true
  }
  return lido
}

function forma(valor: unknown): FormaDoAlvo {
  const peca = registro(valor, 'forma do alvo')
  const tipo = umDe(peca.tipo, ['um', 'varios', 'linha', 'quadrado', 'raio', 'cruz', 'leque'] as const, 'forma do alvo')
  switch (tipo) {
    case 'um':
      soChaves(peca, ['tipo'], 'alvo')
      return { tipo }
    // Versão 3: as duas saem de quem usa, com o tamanho como alcance (a versão é conferida em `mecanicaLida`).
    case 'cruz':
    case 'leque':
      soChaves(peca, ['tipo', 'casas'], 'alvo')
      return { tipo, casas: inteiro(peca.casas, 1, CASAS_MAX, 'casas') }
    case 'varios': {
      soChaves(peca, ['tipo', 'max', 'dividirDano'], 'alvo')
      const lida: FormaDoAlvo = { tipo, max: inteiro(peca.max, 2, CASAS_MAX, 'máximo de alvos') }
      if (peca.dividirDano === true) lida.dividirDano = true
      else if (peca.dividirDano !== undefined) torta('dividir o dano só aceita "sim"')
      return lida
    }
    case 'linha':
      soChaves(peca, ['tipo', 'casas'], 'alvo')
      return { tipo, casas: inteiro(peca.casas, 1, CASAS_MAX, 'casas') }
    case 'raio': {
      soChaves(peca, ['tipo', 'casas', 'centro'], 'alvo')
      const lida: FormaDoAlvo = { tipo, casas: inteiro(peca.casas, 1, CASAS_MAX, 'casas') }
      // Fase 6: em volta de um ponto ou de uma ficha escolhida; 'si' (ou ausente) = em volta de quem usa, como sempre.
      const centro = umDe(peca.centro ?? 'si', ['si', 'alvo', 'ponto'] as const, 'centro da área')
      if (centro !== 'si') lida.centro = centro
      return lida
    }
    case 'quadrado': {
      soChaves(peca, ['tipo', 'lado', 'centro'], 'alvo')
      const lado = inteiro(peca.lado, 1, CASAS_MAX, 'lado do quadrado')
      const centro = umDe(peca.centro, ['si', 'frente', 'ponto'] as const, 'centro do quadrado')
      if (centro === 'si' && lado % 2 === 0) torta('o quadrado em volta de quem usa precisa de lado ímpar (3x3, 5x5)')
      if (centro === 'ponto' && lado % 2 === 0) torta('o quadrado em volta de um ponto precisa de lado ímpar (3x3, 5x5)')
      return { tipo, lado, centro }
    }
  }
}

function alvo(valor: unknown): AlvoDaMecanica {
  const peca = registro(valor, 'alvo')
  soChaves(peca, ['quem', 'forma', 'exigeSelo', 'alcance', 'alcanceMinimo', 'estado'], 'alvo', 'alvo')
  const quem = umDe(peca.quem, ['inimigos', 'aliados', 'todos', 'si', 'escolha'] as const, 'quem o alvo pega')
  const lida = forma(peca.forma)
  // Construtor C3: a área marca os inimigos, os aliados (a cura em área) ou todos; "em si" não tem área.
  if (quem === 'si' && lida.tipo !== 'um') torta('"em si" é um alvo só')
  const lido: AlvoDaMecanica = { quem, forma: lida }
  if (peca.exigeSelo !== undefined) lido.exigeSelo = texto(peca.exigeSelo, NOME_DO_SELO_MAX, 'o selo que o alvo precisa ter')
  if (peca.alcance !== undefined) {
    // Fase 6: o alcance mede o alvo escolhido, ou o centro da área longe; a área que sai de quem usa já tem o tamanho dela.
    const escolhido = lida.tipo === 'um' || lida.tipo === 'varios' || centroDaArea(lida) !== null
    if (quem === 'si' || !escolhido) torta('o alcance só vale no alvo escolhido ou no centro da área longe')
    lido.alcance = inteiro(peca.alcance, 1, CASAS_MAX, 'alcance (casas)')
  }
  if (peca.alcanceMinimo !== undefined) {
    // Versão 3 (o anel): só no alvo escolhido um a um; a área longe mede só até o centro.
    if (lido.alcance === undefined || (lida.tipo !== 'um' && lida.tipo !== 'varios')) torta('o alcance mínimo (o anel) só vale no alvo escolhido, junto com o alcance')
    lido.alcanceMinimo = inteiro(peca.alcanceMinimo, 2, lido.alcance, 'alcance mínimo (casas)')
  }
  if (peca.estado !== undefined && umDe(peca.estado, ['dePe', 'caido'] as const, 'estado do alvo') === 'caido') {
    // Fase 6 (decisão C18): o caído é escolhido um a um, entre os aliados (a área de hoje não marca quem caiu).
    if (quem !== 'aliados' || (lida.tipo !== 'um' && lida.tipo !== 'varios')) torta('o alvo caído é um aliado escolhido (um ou vários), sem área')
    lido.estado = 'caido'
  }
  return lido
}

function quemRola(valor: unknown, onde: string): QuemRolaNoTeste {
  const peca = registro(valor, onde)
  soChaves(peca, ['atributo', 'vantagem'], onde)
  const lido: QuemRolaNoTeste = { atributo: texto(peca.atributo, ATRIBUTO_MAX, `${onde} (atributo)`) }
  if (peca.vantagem !== undefined) lido.vantagem = umDe(peca.vantagem, ['vantagem', 'desvantagem'] as const, `${onde} (vantagem)`)
  return lido
}

function numeroDaCd(valor: unknown, onde: string): NumeroDaCd {
  return valor === 'automatico' ? valor : numeroSimples(valor, CD_MAX, onde)
}

function cd(valor: unknown): CdDoTeste {
  const peca = registro(valor, 'CD')
  if (!('porCarga' in peca)) return numeroSimples(peca, CD_MAX, 'CD')
  soChaves(peca, ['porCarga'], 'CD')
  const [zero, um, dois, tres] = lista(peca.porCarga, 4, 'CD por carga')
  if (zero === undefined || um === undefined || dois === undefined || tres === undefined) torta('a CD por carga precisa de 4 números (carga 0 a 3)')
  // Sem carga, sempre há teste: o "pega sem teste" só vale com a Concentração guardada.
  return { porCarga: [numeroSimples(zero, CD_MAX, 'CD sem carga'), numeroDaCd(um, 'CD na carga 1'), numeroDaCd(dois, 'CD na carga 2'), numeroDaCd(tres, 'CD na carga 3')] }
}

function teste(valor: unknown): Teste {
  const peca = registro(valor ?? { tipo: 'reacao' }, 'teste')
  const tipo = umDe(peca.tipo, ['reacao', 'naoErra', 'resistencia', 'disputa'] as const, 'teste')
  switch (tipo) {
    case 'reacao':
    case 'naoErra':
      soChaves(peca, ['tipo'], 'teste')
      return { tipo }
    case 'resistencia':
      soChaves(peca, ['tipo', 'alvo', 'cd', 'sePassar'], 'teste')
      return { tipo, alvo: quemRola(peca.alvo, 'quem testa'), cd: cd(peca.cd), sePassar: umDe(peca.sePassar ?? 'nada', ['nada', 'devolveCusto', 'metade'] as const, 'se o alvo passar') }
    case 'disputa':
      soChaves(peca, ['tipo', 'usuario', 'alvo'], 'teste')
      return { tipo, usuario: quemRola(peca.usuario, 'quem usa na disputa'), alvo: quemRola(peca.alvo, 'o alvo na disputa') }
  }
}

/**
 * As regras do teste rolado com o resto da mecânica: ajuda não testa, e a CD
 * pela Concentração pede a carga, que o dano sem Concentração não gasta.
 */
function conferirTeste(mecanica: Pick<MecanicaV2, 'teste' | 'alvo' | 'dano'>): void {
  const { teste: lido } = mecanica
  if (!testeRolado(lido)) return
  if (mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') torta('teste e disputa não valem em aliado nem em quem usa')
  if (lido.tipo === 'resistencia' && 'porCarga' in lido.cd && mecanica.dano !== undefined && !mecanica.dano.multiplicadores.concentracao) {
    torta('a CD pela Concentração precisa do dano que multiplica com a Concentração')
  }
}

function multiplicador(valor: unknown, indice: number): MultiplicadorExtra {
  const onde = `multiplicador ${indice + 1}`
  const peca = registro(valor, onde)
  soChaves(peca, ['nome', 'vezes'], onde)
  const vezes = peca.vezes
  if (typeof vezes !== 'number' || !Number.isFinite(vezes) || vezes <= 0 || vezes > VEZES_MAX) torta(`${onde}: vezes de 0 a ${VEZES_MAX}`)
  return { nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome)`), vezes }
}

function dano(valor: unknown): DanoDaMecanica {
  const peca = registro(valor, 'dano')
  soChaves(peca, ['base', 'arma', 'perfurante', 'perfuracao', 'segundoGolpe', 'multiplicadores'], 'dano', 'dano')
  const mult = registro(peca.multiplicadores ?? {}, 'multiplicadores')
  soChaves(mult, ['concentracao', 'surpresa', 'extra'], 'multiplicadores')
  const base = registro(peca.base, 'dano base')
  const lido: DanoDaMecanica = {
    base: 'porcento' in base ? porcentoDaBase(base) : numeroSimples(base, DANO_MAX, 'dano base'),
    multiplicadores: { concentracao: mult.concentracao !== false, surpresa: mult.surpresa !== false },
  }
  if (mult.extra !== undefined) lido.multiplicadores.extra = lista(mult.extra, EXTRAS_MAX, 'multiplicadores extras').map(multiplicador)
  if (peca.arma !== undefined) lido.arma = umDe(peca.arma, ['nenhuma', 'padrao', 'perguntar'] as const, 'arma')
  if (peca.perfurante !== undefined) {
    if (typeof peca.perfurante !== 'boolean') torta('perfurante só aceita sim ou não')
    lido.perfurante = peca.perfurante
  }
  // Fase 5 (B13): "Perfurante 50%"; a parte que perfura só existe no golpe perfurante.
  if (peca.perfuracao !== undefined) {
    if (lido.perfurante === false) torta('perfuração parcial só no golpe perfurante')
    lido.perfuracao = inteiro(peca.perfuracao, 1, 99, 'a parte que vai direto ao HP (%)')
  }
  if (peca.segundoGolpe !== undefined) lido.segundoGolpe = segundoGolpeDaPeca(peca.segundoGolpe)
  return lido
}

/** Fase 5 (B17): a fração do 2º golpe, acima de 0 e até 1 (o inteiro do dano sai para baixo na hora). */
function segundoGolpeDaPeca(valor: unknown): SegundoGolpeDaPeca {
  const peca = registro(valor, '2º golpe')
  soChaves(peca, ['fracao', 'perfurante'], '2º golpe')
  const { fracao } = peca
  if (typeof fracao !== 'number' || !Number.isFinite(fracao) || fracao <= 0 || fracao > 1) torta('2º golpe: a parte do dano vai de 0,01 a 1')
  if (peca.perfurante !== undefined && typeof peca.perfurante !== 'boolean') torta('2º golpe: perfurante só aceita sim ou não')
  return { fracao, perfurante: peca.perfurante === true }
}

/**
 * Construtor C5: o "tira X por vez" do selo, só fixo e direto (o HP pelo
 * lembrete "Aplicar" do mestre). Fase 5: o SP tirado no fim da vez (com o
 * `paraQuemUsa`, o dreno das Chamas Celestes) e o `sinal: 'da'` (regeneração
 * de HP ou SP no fim da vez de quem tem o selo).
 */
function porTurnoDoSelo(valor: unknown, onde: string): PorTurnoDoSelo {
  const peca = registro(valor, `${onde} (por vez)`)
  soChaves(peca, ['recurso', 'quanto', 'direto', 'sinal', 'paraQuemUsa'], `${onde} (por vez)`)
  if (peca.recurso === 'hp' && peca.direto !== true) torta(`${onde}: o selo que tira por vez, por enquanto, só tira HP direto (sem o Escudo)`)
  if (peca.direto !== true) torta(`${onde}: o selo que mexe por vez, por enquanto, só vai direto (sem o Escudo)`)
  const recurso = umDe(peca.recurso, ['hp', 'sp'] as const, `${onde} (recurso por vez)`)
  const quanto = registro(peca.quanto, `${onde} (quanto tira por vez)`)
  if (!('fixo' in quanto)) torta(`${onde}: o quanto tira por vez precisa ser um número fixo`)
  soChaves(quanto, ['fixo'], `${onde} (quanto tira por vez)`)
  const lido: PorTurnoDoSelo = { recurso, quanto: { fixo: inteiro(quanto.fixo, 1, DANO_MAX, `${onde} (quanto tira por vez)`) }, direto: true }
  if (peca.sinal !== undefined) lido.sinal = umDe(peca.sinal, ['tira', 'da'] as const, `${onde} (tira ou dá)`)
  if (peca.paraQuemUsa !== undefined) {
    // O dreno por vez é o das Chamas Celestes: o SP que sai do alvo, no fim da vez dele.
    if (recurso !== 'sp' || lido.sinal === 'da') aindaNaoRoda('dreno por vez que não seja de SP tirado')
    lido.paraQuemUsa = inteiro(peca.paraQuemUsa, 0, DANO_MAX, `${onde} (o que quem usa ganha por vez)`)
  }
  return lido
}

/** Teto da regra do selo em % (+200 = toma o triplo). */
const REGRA_DO_SELO_MAX = 200

/** Fase 5: a regra própria do selo. Travar e tirar saídas seguem pelo NOME (Atordoado, Aéreo); a peça abre o dano e a cura recebidos. */
function regraDoSelo(valor: unknown, onde: string): RegraDoSelo {
  const peca = registro(valor, `${onde} (regra)`)
  if (peca.trava !== undefined || peca.tiraSaidas !== undefined) aindaNaoRoda('travar ou tirar saídas pela regra do selo (use o nome: Atordoado, Aéreo)')
  soChaves(peca, ['danoRecebido', 'curaRecebida', 'reageComDesvantagem'], `${onde} (regra)`)
  const lida: RegraDoSelo = {}
  if (peca.danoRecebido !== undefined) lida.danoRecebido = inteiro(peca.danoRecebido, -100, REGRA_DO_SELO_MAX, `${onde} (dano recebido %)`)
  if (peca.curaRecebida !== undefined) lida.curaRecebida = inteiro(peca.curaRecebida, -100, REGRA_DO_SELO_MAX, `${onde} (cura recebida %)`)
  // Fase ED4: quem tem o selo rola a reação com desvantagem (o Congelado do tipo do golpe); a batalha lê no selo (`vantagemDaReacao`).
  if (peca.reageComDesvantagem !== undefined) {
    if (peca.reageComDesvantagem !== true) torta(`${onde} (reage com desvantagem): só "sim"`)
    lida.reageComDesvantagem = true
  }
  if ((lida.danoRecebido ?? 0) === 0 && (lida.curaRecebida ?? 0) === 0 && lida.reageComDesvantagem !== true) torta(`${onde}: a regra do selo precisa de um número diferente de 0`)
  return lida
}

/** Versão 3 (fase B do alcance): o selo que muda o alcance. A soma tira ou põe (nunca 0); o teto vai de 1 a `CASAS_MAX`; o escopo é obrigatório. */
function alcanceDoSelo(valor: unknown, onde: string): AlcanceDoSelo {
  const ondeDoAlcance = `${onde} (alcance)`
  const peca = registro(valor, ondeDoAlcance)
  soChaves(peca, ['mexe', 'n', 'vale'], ondeDoAlcance)
  const mexe = umDe(peca.mexe, ['soma', 'teto'] as const, `${ondeDoAlcance} (soma ou máximo)`)
  const n = mexe === 'teto' ? inteiro(peca.n, 1, CASAS_MAX, `${ondeDoAlcance} (máximo)`) : inteiro(peca.n, -CASAS_MAX, CASAS_MAX, `${ondeDoAlcance} (casas a mais ou a menos)`)
  if (n === 0) torta(`${onde}: o selo que soma no alcance precisa de um número diferente de 0`)
  return { mexe, n, vale: umDe(peca.vale, VALES_DO_ALCANCE, `${ondeDoAlcance} (vale para)`) }
}

/** O selo do alcance lido fora da mecânica (o fio do jogador, a tabela de condições), pelas mesmas regras da peça; `null` = torto. */
export function lerAlcanceDoSelo(valor: unknown): AlcanceDoSelo | null {
  try {
    return alcanceDoSelo(valor, 'selo')
  } catch (erro) {
    if (erro instanceof PecaTorta) return null
    throw erro
  }
}

/** Fase 5: os números do selo ("Força +20"); o fixo pode tirar (negativo), a fórmula é lida na ficha de quem usa. */
function modsDoSelo(valor: unknown, onde: string): ModDaPeca[] {
  const mods = lista(valor, MODS_POR_SELO_MAX, `${onde} (números do selo)`).map((item, indice): ModDaPeca => {
    const ondeDoMod = `${onde} (número ${indice + 1})`
    const peca = registro(item, ondeDoMod)
    soChaves(peca, ['alvo', 'delta'], ondeDoMod)
    const alvoDoMod = texto(peca.alvo, ATRIBUTO_MAX, `${ondeDoMod} (o que muda)`)
    const delta = registro(peca.delta, `${ondeDoMod} (quanto)`)
    if (!('fixo' in delta)) return { alvo: alvoDoMod, delta: numeroSimples(delta, DANO_MAX, `${ondeDoMod} (quanto)`) }
    soChaves(delta, ['fixo'], `${ondeDoMod} (quanto)`)
    const fixo = inteiro(delta.fixo, -DANO_MAX, DANO_MAX, `${ondeDoMod} (quanto)`)
    if (fixo === 0) torta(`${ondeDoMod}: o número do selo não pode ser 0`)
    return { alvo: alvoDoMod, delta: { fixo } }
  })
  if (mods.length === 0) torta(`${onde}: o selo com número precisa de pelo menos um`)
  return mods
}

function efeito(valor: unknown, indice: number): Efeito {
  const onde = `efeito ${indice + 1}`
  const peca = registro(valor, onde)
  const novo = typeof peca.tipo === 'string' && Object.hasOwn(EFEITOS_QUE_AINDA_NAO_RODAM, peca.tipo) ? EFEITOS_QUE_AINDA_NAO_RODAM[peca.tipo] : undefined
  if (novo !== undefined) aindaNaoRoda(novo)
  const tipo = umDe(peca.tipo, ['selo', 'cura', 'tirarSelos', 'dreno', 'reviver', 'aMao'] as const, onde)
  switch (tipo) {
    case 'selo': {
      soChaves(peca, ['tipo', 'nome', 'duracao', 'natureza', 'porTurno', 'em', 'mods', 'regra', 'alcance', 'pega', 'gatilho'], onde, 'selo')
      const duracao = peca.duracao === 'ateTirar' || peca.duracao === 'proximoGolpe' ? peca.duracao : inteiro(peca.duracao, 1, TURNOS_DO_SELO_MAX, `${onde} (duração)`)
      const lido: Efeito = { tipo, nome: texto(peca.nome, NOME_DO_SELO_MAX, `${onde} (nome do selo)`), duracao }
      if (peca.natureza !== undefined) lido.natureza = umDe(peca.natureza, ['buff', 'debuff'] as const, `${onde} (natureza)`)
      if (peca.porTurno !== undefined) lido.porTurno = porTurnoDoSelo(peca.porTurno, onde)
      // Fase 4: o selo em quem atacou (a reação confere que é dela). Fase 5: em quem usa (a postura); 'alvo' é o de sempre.
      const em = peca.em === undefined ? 'alvo' : umDe(peca.em, ['alvo', 'quemUsa', 'atacante'] as const, `${onde} (em quem)`)
      if (em !== 'alvo') lido.em = em
      if (peca.mods !== undefined) lido.mods = modsDoSelo(peca.mods, onde)
      if (peca.regra !== undefined) lido.regra = regraDoSelo(peca.regra, onde)
      if (peca.alcance !== undefined) lido.alcance = alcanceDoSelo(peca.alcance, onde)
      // Fase ED4: o teste do selo é do alvo acertado; o selo em quem usa ou em quem atacou não tem quem role.
      if (peca.pega !== undefined) {
        if (em !== 'alvo') torta(`${onde}: o teste da condição só vale no selo do alvo`)
        lido.pega = testeDoTipo(peca.pega, onde)
      }
      if (peca.gatilho !== undefined) {
        const gatilho = gatilhoLido(peca.gatilho)
        if (gatilho === undefined) torta(`${onde}: o "depois de X turnos" da condição está torto`)
        lido.gatilho = gatilho
      }
      return lido
    }
    case 'cura': {
      soChaves(peca, ['tipo', 'recurso', 'quanto', 'emQuem', 'em'], onde, 'cura')
      const recurso = umDe(peca.recurso, ['hp', 'sp', 'escudo'] as const, `${onde} (recurso)`)
      const quanto = curaPelaParte(peca.quanto) ? porcentoDaCura(peca.quanto, recurso, onde) : numero(peca.quanto, DANO_MAX, `${onde} (quanto)`)
      const lida: Efeito = { tipo, recurso, quanto, emQuem: umDe(peca.emQuem ?? 'alvo', ['alvo'] as const, `${onde} (em quem)`) }
      // Fase 5: a cura em quem usa (o golpe que cura quem bate); 'alvo' é a de sempre.
      if (peca.em !== undefined && umDe(peca.em, ['alvo', 'quemUsa'] as const, `${onde} (em quem)`) === 'quemUsa') lida.em = 'quemUsa'
      if (lida.em !== undefined && 'porcento' in quanto) aindaNaoRoda('cura pela parte do máximo em quem usa')
      return lida
    }
    case 'tirarSelos': {
      soChaves(peca, ['tipo', 'quais'], onde)
      if (typeof peca.quais === 'object' && peca.quais !== null) {
        const quais = registro(peca.quais, `${onde} (quais)`)
        soChaves(quais, ['nomes'], `${onde} (quais)`)
        const nomes = lista(quais.nomes, NOMES_QUE_TIRA_MAX, `${onde} (nomes)`).map((nome, indice) => texto(nome, NOME_DO_SELO_MAX, `${onde} (nome ${indice + 1})`))
        if (nomes.length === 0) torta(`${onde}: diga o nome da condição que tira`)
        return { tipo, quais: { nomes } }
      }
      return { tipo, quais: umDe(peca.quais, ['negativos', 'positivos', 'todos'] as const, `${onde} (quais)`) }
    }
    case 'dreno':
      soChaves(peca, ['tipo', 'recurso', 'porcentoDoDano'], onde)
      if (peca.recurso === 'sp') aindaNaoRoda('roubo de SP pelo dano')
      return { tipo, recurso: umDe(peca.recurso, ['hp'] as const, `${onde} (recurso)`), porcentoDoDano: inteiro(peca.porcentoDoDano, 1, 100, `${onde} (parte do dano que volta, %)`) }
    case 'reviver':
      soChaves(peca, ['tipo', 'volta'], onde)
      return { tipo, volta: voltaDoReviver(peca.volta, onde) }
    case 'aMao':
      soChaves(peca, ['tipo', 'texto'], onde)
      return { tipo, texto: texto(peca.texto, TEXTO_A_MAO_MAX, `${onde} (texto)`) }
  }
}

/** Fase 6: a vida com que o caído volta; a parte da vida é só do HP máximo dele, de 1% a 100%. */
function voltaDoReviver(valor: unknown, onde: string): VoltaDoReviver {
  const peca = registro(valor, `${onde} (com quanto volta)`)
  if (!('porcento' in peca)) return numeroSimples(peca, DANO_MAX, `${onde} (com quanto volta)`)
  soChaves(peca, ['porcento', 'de', 'deQuem'], `${onde} (com quanto volta)`)
  if ((peca.de ?? 'hpMaximo') !== 'hpMaximo' || (peca.deQuem ?? 'alvo') !== 'alvo') aindaNaoRoda('reviver com outra parte que não o HP máximo do caído')
  return { porcento: inteiro(peca.porcento, 1, 100, `${onde} (com quanto volta, %)`), de: 'hpMaximo', deQuem: 'alvo' }
}

/** Fase 6: o reviver pede o alvo caído e o alvo caído pede o reviver; ele não junta com dano, cura ou limpeza (a vida que volta é a dele). */
function conferirReviver(efeitos: readonly Efeito[], alvoLido: AlvoDaMecanica, temDano: boolean): void {
  const revive = efeitos.filter((item) => item.tipo === 'reviver').length
  if (revive > 1) torta('mais de um efeito "reviver"')
  if (revive === 1 && alvoLido.estado !== 'caido') torta('reviver só vale no alvo caído')
  if (revive === 0 && alvoLido.estado === 'caido') torta('o alvo caído só serve para reviver')
  if (revive === 1 && (temDano || efeitos.some((item) => item.tipo === 'cura' || item.tipo === 'tirarSelos' || item.tipo === 'dreno'))) torta('reviver não junta com dano, cura nem tirar condições')
}

/** Um de cada: selo, cura e tirar selos (a fatia C5 abre mais de um selo). */
function conferirEfeitos(efeitos: readonly Efeito[], quem: QuemOAlvoPega, temDano: boolean): void {
  for (const tipo of ['tirarSelos', 'dreno'] as const) {
    if (efeitos.filter((item) => item.tipo === tipo).length > 1) torta(`mais de um efeito "${tipo}"`)
  }
  // Fase 5: vários selos no mesmo golpe (até 3, decisão C4); em quem usa, um só.
  const selos = efeitos.filter((item) => item.tipo === 'selo')
  if (selos.length > SELOS_NO_GOLPE_MAX) torta(`mais de ${SELOS_NO_GOLPE_MAX} selos no mesmo golpe`)
  if (selos.filter((item) => item.em === 'quemUsa').length > 1) torta('mais de um selo em quem usa')
  // Fase 5: uma cura no alvo e uma em quem usa (o golpe que cura quem bate). Fase 7: no alvo, HP e SP juntos (o Elixir), cada recurso uma vez.
  const curas = efeitos.filter((item) => item.tipo === 'cura')
  const noAlvo = curas.filter((item) => item.em === undefined)
  if (noAlvo.length > CURAS_NO_ALVO_MAX || new Set(noAlvo.map((item) => item.recurso)).size !== noAlvo.length || curas.filter((item) => item.em === 'quemUsa').length > 1) torta('mais de um efeito "cura"')
  // A cura e a limpeza de hoje (`LimpezaAMao`) valem em quem usa ou num aliado.
  const limpa = efeitos.some((item) => (item.tipo === 'cura' && item.em === undefined) || item.tipo === 'tirarSelos')
  if (limpa && quem !== 'aliados' && quem !== 'si') torta('cura e tirar selos só pegam em quem usa ou num aliado')
  // O roubo de vida sai do dano que o golpe causou.
  if (efeitos.some((item) => item.tipo === 'dreno') && !temDano) torta('roubo de vida precisa de dano')
}

/** Fase 5: o item da mochila que cada uso gasta (pelo nome; o `itemId` do Acervo conta junto). */
function custoEmItemDaPeca(valor: unknown): CustoEmItem {
  const peca = registro(valor, 'custo em item')
  soChaves(peca, ['nome', 'itemId', 'quantos'], 'custo em item')
  const lido: CustoEmItem = { nome: texto(peca.nome, NOME_DO_SELO_MAX, 'o item que gasta'), quantos: inteiro(peca.quantos ?? 1, 1, ITENS_POR_USO_MAX, 'quantos itens por uso') }
  if (peca.itemId !== undefined) lido.itemId = texto(peca.itemId, NOME_DO_SELO_MAX * 2, 'o id do item')
  return lido
}

/** Teto de atributos da reação que rola (o maior modificador entre eles). */
export const ATRIBUTOS_DA_REACAO_MAX = 4
/** Teto do "devolve dividido por" (2 = metade). */
export const DEVOLVE_DIVIDIDO_MAX = 3

function defesaDaReacao(valor: unknown): ReacaoDaMecanica['defesa'] {
  const onde = 'defesa da reação'
  const peca = registro(valor, onde)
  const tipo = umDe(peca.tipo, ['anula', 'fica', 'rola', 'nenhuma'] as const, onde)
  switch (tipo) {
    case 'anula':
    case 'nenhuma':
      soChaves(peca, ['tipo'], onde)
      return { tipo }
    case 'fica':
      soChaves(peca, ['tipo', 'porcento'], onde)
      return { tipo, porcento: inteiro(peca.porcento, 1, 99, 'a parte do dano que fica (%)') }
    case 'rola': {
      soChaves(peca, ['tipo', 'atributos', 'anulaCom'], onde)
      const atributos = lista(peca.atributos, ATRIBUTOS_DA_REACAO_MAX, 'atributos da reação').map((atributo, indice) => texto(atributo, ATRIBUTO_MAX, `atributo ${indice + 1} da reação`))
      if (atributos.length === 0) torta('a reação que rola o dado precisa de um atributo')
      return { tipo, atributos, anulaCom: inteiro(peca.anulaCom, 1, CD_MAX, 'o total que anula') }
    }
  }
}

/** Fase 4: a técnica no lugar da reação. Devolver por fórmula fica para depois (o motor só divide o que ficou). */
function reacaoDaPeca(valor: unknown): ReacaoDaMecanica {
  const peca = registro(valor, 'reação')
  soChaves(peca, ['defesa', 'devolve', 'curaDoQueChegava', 'valeContra', 'soOMestre'], 'reação')
  const lida: ReacaoDaMecanica = { defesa: defesaDaReacao(peca.defesa) }
  if (peca.devolve !== undefined) {
    const devolve = registro(peca.devolve, 'devolve')
    if ('formula' in devolve) aindaNaoRoda('devolver dano por fórmula')
    soChaves(devolve, ['divididoPor'], 'devolve')
    lida.devolve = { divididoPor: inteiro(devolve.divididoPor, 1, DEVOLVE_DIVIDIDO_MAX, 'devolve dividido por') }
  }
  if (peca.curaDoQueChegava !== undefined) lida.curaDoQueChegava = inteiro(peca.curaDoQueChegava, 1, 100, 'a cura do dano que chegava (%)')
  if (peca.valeContra !== undefined) {
    const contra = lista(peca.valeContra, 2, 'vale contra').map((item) => umDe(item, ['overload', 'surpresa'] as const, 'vale contra'))
    if (new Set(contra).size !== contra.length) torta('vale contra repetido')
    lida.valeContra = contra
  }
  if (peca.soOMestre !== undefined) {
    if (peca.soOMestre !== true) torta('só o mestre só aceita "sim"')
    lida.soOMestre = true
  }
  // A reação que rola resolve pelo dado (anula ou toma inteiro): o motor ainda não devolve nem cura nela.
  if (lida.defesa.tipo === 'rola' && (lida.devolve !== undefined || lida.curaDoQueChegava !== undefined)) aindaNaoRoda('devolver ou curar na reação que rola o dado')
  return lida
}

/** As regras da reação com o resto (seção 2 do SISTEMA): uma pede a outra; o selo em quem atacou só existe nela. */
function conferirReacao(mecanica: Pick<MecanicaV2, 'uso' | 'reacao' | 'efeitos'>): void {
  const deReacao = mecanica.uso === 'reacao' || mecanica.uso === 'ativaOuReacao'
  if (mecanica.reacao !== undefined && !deReacao) torta('a reação montada precisa de "Quando usa": no lugar da reação')
  if (deReacao && mecanica.reacao === undefined) torta('"no lugar da reação" precisa dizer o que a técnica faz com o golpe')
  if (!deReacao && mecanica.efeitos.some((efeito) => efeito.tipo === 'selo' && efeito.em === 'atacante')) torta('selo em quem atacou só vale na técnica de reação')
  // Só no lugar da reação, a técnica nunca roda na vez: efeito da vez nela não faria nada (só o selo em quem atacou e o lembrete à mão).
  if (mecanica.uso === 'reacao' && mecanica.efeitos.some((efeito) => !(efeito.tipo === 'aMao' || (efeito.tipo === 'selo' && efeito.em === 'atacante')))) aindaNaoRoda('efeito da vez numa técnica só de reação')
}

// ─── Leitura da versão 4: o tipo do golpe ───────────────────────────────────

/** O teste do "com teste": o atributo e a CD, como no teste da técnica. */
function testeDoTipo(valor: unknown, onde: string): TesteDoTipo {
  const ondeDoTeste = `${onde} (teste)`
  const peca = registro(valor, ondeDoTeste)
  soChaves(peca, ['atributo', 'cd'], ondeDoTeste)
  return { atributo: texto(peca.atributo, ATRIBUTO_MAX, `${ondeDoTeste} (atributo)`), cd: cd(peca.cd) }
}

/** Quando pega e por quantas vezes; o que faltar vem da regra de partida do tipo. O teste só existe no "com teste". */
function regraQuePoeCondicao(peca: Record<string, unknown>, partida: RegraQuePoeCondicao, onde: string): RegraQuePoeCondicao {
  const quando = umDe(peca.quando ?? partida.quando, ['sempre', 'teste', 'soTipo'] as const, `${onde} (quando pega)`)
  const lida: RegraQuePoeCondicao = { quando, vezes: inteiro(peca.vezes ?? partida.vezes, 1, TURNOS_DO_SELO_MAX, `${onde} (vezes)`) }
  if (quando === 'teste') lida.teste = testeDoTipo(peca.teste ?? partida.teste ?? TESTE_DO_TIPO_DE_PARTIDA, onde)
  else if (peca.teste !== undefined) torta(`${onde}: o teste só vale no "com teste"`)
  return lida
}

/** O HP ou o SP por vez. Sangrando e Queimando tiram pelo nome se a peça não disser, então neles e no Choque o mínimo é 1. */
function porVezDoTipo(peca: Record<string, unknown>, partida: number, minimo: 0 | 1, onde: string): number {
  return inteiro(peca.porVez ?? partida, minimo, DANO_MAX, `${onde} (por vez)`)
}

/** A peça de um tipo: `tipo` e `regra` (sem `regra` = a de partida). */
function pecaDoTipo(valor: unknown, onde: string): { peca: Record<string, unknown>; regra: Record<string, unknown> } {
  const peca = registro(valor, onde)
  soChaves(peca, ['tipo', 'regra'], onde)
  return { peca, regra: registro(peca.regra ?? {}, `${onde} (regra)`) }
}

/** Como o golpe bate: Impacto, Cortante ou Perfurante. */
function tipoQueBate(valor: unknown): TipoComRegra<TipoQueBate> {
  const { peca, regra } = pecaDoTipo(valor, 'como o golpe bate')
  const tipo = umDe(peca.tipo, TIPOS_QUE_BATEM, 'como o golpe bate')
  const onde = `o golpe ${tipo}`
  switch (tipo) {
    case 'impacto': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'casas'], onde)
      const partida = REGRA_DE_PARTIDA.impacto
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), casas: inteiro(regra.casas ?? partida.casas, 0, CASAS_MAX, `${onde} (casas que empurra)`) } }
    }
    case 'cortante': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'porVez'], onde)
      const partida = REGRA_DE_PARTIDA.cortante
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), porVez: porVezDoTipo(regra, partida.porVez, 1, onde) } }
    }
    case 'perfurante':
      soChaves(regra, ['porcento'], onde)
      return { tipo, regra: { porcento: inteiro(regra.porcento ?? REGRA_DE_PARTIDA.perfurante.porcento, 1, 100, `${onde} (% que passa o Escudo)`) } }
  }
}

/** O que o golpe causa: uma condição por tipo (o Outro com o nome do mestre). */
function tipoQueCausa(valor: unknown, indice: number): TipoComRegra<TipoQueCausa> {
  const { peca, regra } = pecaDoTipo(valor, `o que o golpe causa ${indice + 1}`)
  const tipo = umDe(peca.tipo, TIPOS_QUE_CAUSAM, `o que o golpe causa ${indice + 1}`)
  const onde = `o golpe de ${tipo}`
  switch (tipo) {
    case 'queimadura':
    case 'choque': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'porVez'], onde)
      const partida = REGRA_DE_PARTIDA[tipo]
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), porVez: porVezDoTipo(regra, partida.porVez, 1, onde) } }
    }
    case 'veneno': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'porVez'], onde)
      const partida = REGRA_DE_PARTIDA.veneno
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), porVez: porVezDoTipo(regra, partida.porVez, 0, onde) } }
    }
    case 'congelamento': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'casas'], onde)
      const partida = REGRA_DE_PARTIDA.congelamento
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), casas: inteiro(regra.casas ?? partida.casas, 1, CASAS_MAX, `${onde} (casas a menos no alcance)`) } }
    }
    case 'cegueira':
      soChaves(regra, ['quando', 'teste', 'vezes'], onde)
      return { tipo, regra: regraQuePoeCondicao(regra, REGRA_DE_PARTIDA.cegueira, onde) }
    case 'enfraquecer': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'forca', 'dano'], onde)
      const partida = REGRA_DE_PARTIDA.enfraquecer
      const forca = inteiro(regra.forca ?? partida.forca, 0, DANO_MAX, `${onde} (Força a menos)`)
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), forca, dano: inteiro(regra.dano ?? partida.dano, 0, DANO_MAX, `${onde} (Dano a menos)`) } }
    }
    case 'outro': {
      soChaves(regra, ['quando', 'teste', 'vezes', 'nome', 'porVez'], onde)
      const partida = REGRA_DE_PARTIDA.outro
      const nome = texto(regra.nome ?? partida.nome, NOME_DO_SELO_MAX, `${onde} (nome da condição)`)
      return { tipo, regra: { ...regraQuePoeCondicao(regra, partida, onde), nome, porVez: porVezDoTipo(regra, partida.porVez, 0, onde) } }
    }
  }
}

/**
 * Versão 4: o tipo do golpe, lido como escolha. Vale só no golpe da vez em quem não é aliado (a ajuda
 * não tem tipo); o Perfurante precisa de dano e fica só aqui (não também no dano). Sem tipo nenhum =
 * `undefined`. O teto de 3 condições no mesmo golpe (tipo e Efeitos somados, sem repetir o nome) é
 * conferido quando o motor monta as peças (`pecasParaOMotor`), pela mesma leitura das peças.
 */
function golpeDaPeca(valor: unknown, mecanica: Pick<MecanicaV2, 'alvo' | 'uso' | 'dano'>): GolpeDaMecanica | undefined {
  const peca = registro(valor, 'tipo do golpe')
  soChaves(peca, ['bate', 'causa'], 'tipo do golpe')
  const lido: GolpeDaMecanica = {}
  if (peca.bate !== undefined) lido.bate = tipoQueBate(peca.bate)
  if (peca.causa !== undefined) {
    const causa = lista(peca.causa, TIPOS_QUE_CAUSAM.length, 'o que o golpe causa').map(tipoQueCausa)
    if (new Set(causa.map((item) => item.tipo)).size !== causa.length) torta('o mesmo tipo duas vezes no que o golpe causa')
    lido.causa = causa
  }
  const golpe = golpeQueVale(lido)
  if (golpe === undefined) return undefined
  if (mecanica.alvo.quem === 'aliados' || mecanica.alvo.quem === 'si') torta('o tipo do golpe não vale em aliado nem em quem usa')
  if (mecanica.uso === 'reacao') torta('o tipo do golpe não vale na técnica só de reação')
  if (golpe.bate?.tipo === 'perfurante') {
    if (mecanica.dano === undefined) torta('o golpe perfurante precisa de dano')
    if (mecanica.dano.perfurante === true || mecanica.dano.perfuracao !== undefined) torta('o perfurante fica só no tipo do golpe, não também no dano')
  }
  return golpe
}

function mecanicaLida(peca: Record<string, unknown>, versao: VersaoDaMecanica): MecanicaV2 {
  soChaves(peca, ['versao', 'acao', 'custos', 'limite', 'alvo', 'teste', 'dano', 'efeitos', 'uso', 'reacao', 'custoEmItem', 'golpe'], 'mecânica', 'mecânica')
  // Fase ED1: o tipo do golpe só existe na 4 (o app de antes lê a 4 como "atualize o app"; quem grava usa a 4 só com `precisaDaVersao4`).
  if (versao < 4 && peca.golpe !== undefined) torta(`o tipo do golpe só existe na versão 4 da mecânica, e esta é a ${versao}`)
  const custos = lista(peca.custos ?? [], CUSTOS_MAX, 'custos').map(custo)
  for (const quando of ['aoUsar', 'porTurno', 'depois'] as const) {
    if (custos.filter((item) => item.quando === quando).length > 1) torta('dois custos no mesmo momento')
  }
  const lidoAlvo = alvo(peca.alvo)
  const efeitos = lista(peca.efeitos ?? [], EFEITOS_MAX, 'efeitos').map(efeito)
  conferirEfeitos(efeitos, lidoAlvo.quem, peca.dano !== undefined)
  conferirReviver(efeitos, lidoAlvo, peca.dano !== undefined)
  const mecanica: MecanicaV2 = {
    versao,
    acao: umDe(peca.acao, ['simples', 'bonus', 'completa', 'livre', 'perguntar'] as const, 'ação'),
    custos,
    limite: limite(peca.limite),
    alvo: lidoAlvo,
    teste: teste(peca.teste),
    efeitos,
  }
  if (peca.dano !== undefined) mecanica.dano = dano(peca.dano)
  // A versão 1 é o que o app de antes lê: peça que só a 2 diz, nela, é arquivo torto (quem grava usa a 2, `precisaDaVersao2`).
  if (versao === 1 && (peca.uso !== undefined || peca.reacao !== undefined)) torta('"Quando usa" e a reação só existem na versão 2 da mecânica')
  if (peca.uso !== undefined) mecanica.uso = umDe(peca.uso, ['ativa', 'reacao', 'ativaOuReacao'] as const, 'quando usa')
  if (peca.reacao !== undefined) mecanica.reacao = reacaoDaPeca(peca.reacao)
  if (peca.custoEmItem !== undefined) mecanica.custoEmItem = custoEmItemDaPeca(peca.custoEmItem)
  if (peca.golpe !== undefined) {
    const golpe = golpeDaPeca(peca.golpe, mecanica)
    if (golpe !== undefined) mecanica.golpe = golpe
  }
  conferirTeste(mecanica)
  conferirReacao(mecanica)
  // Fase 5: a versão 1 é o que o app de antes lê; peça só da 2 nela é arquivo torto (quem grava usa a 2, `precisaDaVersao2`).
  if (versao === 1 && precisaDaVersao2(mecanica)) torta('peça da versão 2 numa mecânica da versão 1')
  // Fase B do alcance: o mesmo para a 3 (o app de antes lê a 3 como "atualize o app"; quem grava usa a 3 só com `precisaDaVersao3`).
  if (versao < 3 && precisaDaVersao3(mecanica)) torta(`peça da versão 3 numa mecânica da versão ${versao}`)
  // Fase ED4: o teste do selo e o "reage com desvantagem" só existem na 4 (o app de antes lê a 4 como "atualize o app").
  if (versao < 4 && efeitos.some(seloDaVersao4)) torta(`o teste da condição e o "reage com desvantagem" só existem na versão 4 da mecânica, e esta é a ${versao}`)
  return mecanica
}

/**
 * Lê o campo `mecanica` do cartão. Nunca lança. Ausente = `nenhuma` (segue o
 * texto); versão maior que `VERSAO_DA_MECANICA` = `futura`; qualquer peça
 * torta, chave desconhecida ou teto passado = `invalida` com o motivo.
 */
export function lerMecanica(valor: unknown): MecanicaLida {
  if (valor === undefined) return { tipo: 'nenhuma' }
  try {
    const peca = registro(valor, 'mecânica')
    const versao = inteiro(peca.versao, 1, Number.MAX_SAFE_INTEGER, 'versão')
    if (versao > VERSAO_DA_MECANICA) return { tipo: 'futura', versao }
    // A 1, a 2, a 3 e a 4 pelo mesmo leitor (cada uma é superconjunto da anterior); a peça guarda a versão com que veio.
    return { tipo: 'pecas', mecanica: mecanicaLida(peca, versao === 1 ? 1 : versao === 2 ? 2 : versao === 3 ? 3 : 4) }
  } catch (erro) {
    if (erro instanceof PecaTorta) return { tipo: 'invalida', motivo: erro.message }
    throw erro
  }
}
