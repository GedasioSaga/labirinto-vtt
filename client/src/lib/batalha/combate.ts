import type { AutorDaAcao } from './turnos'

/**
 * COMBATE DA BATALHA ONE PIECE, F2 (seção 2.2 de
 * docs/planos/batalha-one-piece-f2-plano.md, com as respostas Q1 a Q8 do
 * usuário no fim do plano): os tipos do golpe, da reação, do contra-ataque e
 * do estado de combate de cada personagem. Estado da SESSÃO do mestre
 * (`stores/batalhaStore.ts`); ao jogador sai só o recorte de
 * `vistaDoJogador.ts`.
 *
 * Puro: só tipos e constantes.
 */

/**
 * O que a reação deu. "naoReagiu" = escolheu Não reagir (antes do dado);
 * "passou" = rolou e preferiu Passar, tomando o golpe inteiro (no 1 natural
 * vira "critico": passar não foge do crítico); "semReacao" = Surpresa,
 * Overload ou golpe que o alvo não pode reagir.
 */
export type SaidaDaReacao = 'critico' | 'cheio' | 'metade' | 'esquiva' | 'contra' | 'naoReagiu' | 'passou' | 'semReacao'

/**
 * Tipos de habilidade, F1 (docs/planos/batalha-tipos-de-habilidade-plano.md,
 * seção 4f): o que a técnica de reação faz no lugar do d20. "rolar" = rola o
 * d20 de sempre COM a técnica (Giro da Lança: gasta custo e recarga e põe o
 * nome na linha); as outras resolvem o alvo na hora, sem dado.
 */
export type SaidaDaTecnica = 'esquiva' | 'metade' | 'contra' | 'cheio' | 'rolar'

/** As saídas que quem reage com técnica pode escolher (a lida vem marcada e é trocável, decisão 2). Enum fechado do fio. */
export const SAIDAS_DA_TECNICA: readonly SaidaDaTecnica[] = ['esquiva', 'metade', 'contra', 'cheio', 'rolar']

/** A técnica com que o alvo reagiu, como o golpe a guarda para o registro. `aMao` = trocou a saída que a ficha diz. */
export interface TecnicaDaReacao {
  cartaoId: string
  nome: string
  aMao?: true
}

/** A ação que a técnica gasta. "livre" não gasta nada. */
export type AcaoDaTecnica = 'simples' | 'completa' | 'bonus' | 'livre'

/** Estado de combate de UM personagem nesta batalha (por personagemId: duas fichas do mesmo personagem dividem). */
export interface CombateDoPersonagem {
  /** cartaoId → turnos que faltam para a técnica voltar (0 sai da lista). */
  recargas: Readonly<Record<string, number>>
  /** cartaoId → vezes usadas nesta batalha ("2 vezes por combate"). */
  usos: Readonly<Record<string, number>>
  /** Já usou um Overload nesta batalha: trava todos os Overload dele. */
  overload: boolean
  /** Concentração guardada para o PRÓXIMO golpe. */
  carga: 0 | 1 | 2 | 3
  /** "rodada:cartaId" da vez em que concentrou (uma vez por vez). */
  concentrouEm?: string
  /**
   * cartaoIds da aba Armas levados para a batalha; `null` = ainda não
   * escolheu. Troca quando quiser, sempre dentro do limite (Q8).
   */
  armas: readonly string[] | null
}

/** Um alvo como chega no pedido, ANTES da reação. `dano` null = golpe sem dano. */
export interface PedidoDeAlvo {
  tokenId: string
  dano: number | null
}

/**
 * O que quem age pede. `contraDe` = é o contra-ataque (Q6) ganho no golpe com
 * esse id: fora da vez, sem gastar ação da vez. `perfurante` (Q4) = o dano vai
 * direto ao HP, sem gastar o Escudo; liga sozinho quando a habilidade diz, e
 * quem ataca pode desligar. `perfuracao` = quanto do dano perfura (inteiro de
 * `PERFURACAO_MIN` a `PERFURACAO_MAX`); ausente com `perfurante` = 100 (tudo).
 */
export type PedidoDeAcao =
  /**
   * F3: `selo` = o sugerido pela habilidade, marcado na mira; pega só se o golpe acerta (Q6).
   * `balaId` = o tipo de bala da arma (subcartão "Tipos de bala"); exige `armaId`. Ausente = como antes.
   */
  | { tipo: 'atacar'; armaId: string | null; alvos: readonly PedidoDeAlvo[]; surpresa: boolean; perfurante: boolean; perfuracao?: number; contraDe?: string; selo?: SeloPedido; balaId?: string }
  | {
      tipo: 'habilidade'
      cartaoId: string
      armaId: string | null
      alvos: readonly PedidoDeAlvo[]
      surpresa: boolean
      perfurante: boolean
      perfuracao?: number
      /** O custo confirmado na tela; `null` = o da ficha. */
      custo: number | null
      /** Só quando a ficha não diz; `null` = a da ficha. */
      acao: AcaoDaTecnica | null
      contraDe?: string
      selo?: SeloPedido
    }
  | { tipo: 'concentrar' }
  /** Q6: o contra-ataque gasto em se mover. Só marca (e tira o atalho); o movimento em si é o arrasto de sempre. */
  | { tipo: 'mover'; contraDe: string }
  /**
   * F3: Ativar a forma pelo menu. `acao` = a escolhida na tela; `trocarImagem`
   * = a caixa "Trocar a imagem". Nunca é contra-ataque: `contraDe` existe só
   * como `undefined`, para quem lê `pedido.contraDe` sem olhar o tipo.
   */
  | { tipo: 'transformar'; cartaoId: string; acao: AcaoDaForma; trocarImagem: boolean; contraDe?: undefined }
  /** F3: "Desfazer a forma" (ação livre). Nunca é contra-ataque. */
  | { tipo: 'destransformar'; cartaoId: string; contraDe?: undefined }

/** Os tipos de pedido de ação, para o enum fechado do fio. */
export type TipoDoPedidoDeAcao = PedidoDeAcao['tipo']

export type PedidoDeReacao =
  /** `golpeId` null = reação livre (o botão Reação sem golpe esperando). */
  | { tipo: 'rolar'; golpeId: string | null; tokenId: string; modificador: number }
  | { tipo: 'rerolar'; golpeId: string; tokenId: string; modificador: number }
  /** Só uma das saídas que o dado liberou (`saidasPossiveis`). */
  | { tipo: 'escolher'; golpeId: string; tokenId: string; saida: SaidaDaReacao }
  | { tipo: 'naoReagir'; golpeId: string; tokenId: string }
  /** Só DEPOIS do dado: toma o golpe inteiro sem usar a reação (`saidaDoPassar`: o 1 natural continua crítico). */
  | { tipo: 'passar'; golpeId: string; tokenId: string }
  /**
   * Tipos de habilidade F1: reagir COM a técnica de reação `cartaoId`, antes do
   * d20 e sem ele. `saida` = a lida da ficha ou a trocada na tela (uma de
   * `SAIDAS_DA_TECNICA`); "rolar" rola o d20 do host com `modificador` (só
   * nela). Cobra o custo (`custo` = o confirmado na tela; `null` = o da
   * ficha), marca recarga, usos e Overload e não gasta ação da vez.
   * `seloNoAtacante` = o selo sugerido ("Marcado"), marcado na caixa.
   */
  | { tipo: 'tecnica'; golpeId: string; tokenId: string; cartaoId: string; saida: SaidaDaTecnica; custo: number | null; modificador?: number; seloNoAtacante?: SeloPedido }

/** O d20 da reação, rolado pelo HOST. `vezes` conta as rerolagens (1 = a primeira). */
export interface RolagemDaReacao {
  d20: number
  modificador: number
  total: number
  vezes: number
}

export interface AlvoDoGolpe {
  tokenId: string
  personagemId: string | null
  /** O que chega (já com concentração e Surpresa); `null` = golpe sem dano. */
  dano: number | null
  podeReagir: boolean
  rolagem?: RolagemDaReacao
  saida?: SaidaDaReacao
  /** Presente = resolvido. No contra-ataque (Q6) é 0. */
  danoFinal?: number
  /** Tipos de habilidade F1: reagiu com esta técnica (o registro diz "esquivou com Passo de Valsa"). */
  tecnica?: TecnicaDaReacao
}

export interface GolpeDaBatalha {
  /** `golpe_<uuid>`. */
  id: string
  /** A linha do registro que este golpe atualiza a cada alvo resolvido. */
  linhaId: string
  cartaId: string
  rodada: number
  atacanteTokenId: string
  atacantePersonagemId: string | null
  autor: AutorDaAcao
  /** Da arma, da habilidade, ou "Ataque". */
  nome: string
  surpresa: boolean
  overload: boolean
  /** Q4: o dano vai direto ao HP, sem gastar o Escudo. O mestre pode trocar enquanto há alvo esperando. */
  perfurante: boolean
  /** Quanto do dano perfura, de 1 a 100; ausente = 100. Só vale com `perfurante`. */
  perfuracao?: number
  /** O golpe é um contra-ataque ganho no golpe com este id. */
  contraDe?: string
  alvos: readonly AlvoDoGolpe[]
  /** F3: o selo que o golpe põe em cada alvo que ele acerta (Q6). Tipos de habilidade F2: com a natureza e a técnica que o pôs. */
  selo?: SeloDoGolpe
  /** A bala do Atacar (o registro diz "atira com Rosa Fúnebre (Bala de Prata)"); `efeito` vazio não vem. */
  bala?: BalaDoGolpe
}

/** A bala que o golpe usou, como o registro a mostra. */
export interface BalaDoGolpe {
  id: string
  nome: string
  efeito?: string
}

/**
 * Q6: quem tirou 20 (total) e escolheu Contra-atacar não recebe o dano e
 * ganha, na hora, uma ação a mais fora da vez: Atacar, Habilidade ou Mover.
 * Fica guardado até ser usado (`PedidoDeAcao` com `contraDe`), o golpe de
 * origem ser desfeito, ou a batalha acabar.
 */
export interface ContraAtaque {
  /** O golpe em que o contra-ataque nasceu. */
  golpeId: string
  /** A ficha que tirou 20 e ganhou a ação. */
  tokenId: string
  personagemId: string | null
  /** Quem a atacou (o atalho "Contra-atacar" sugere ele, mas o alvo é livre). */
  atacanteTokenId: string
  rodada: number
}

export type EfeitoDaBatalha =
  | { seq: number; tipo: 'golpe'; golpeId: string; atacanteTokenId: string; nome: string; alvos: readonly string[]; surpresa: boolean; overload: boolean }
  | { seq: number; tipo: 'reacao'; golpeId: string | null; tokenId: string; d20: number; modificador: number; total: number }
  | { seq: number; tipo: 'dano'; tokenId: string; valor: number; saida: SaidaDaReacao | 'direto' }
  /** F3 (fatia J): o MESTRE desfez uma linha e o Judge ergue a carta. Sem token: vai a todos na cena. */
  | { seq: number; tipo: 'judge'; gesto: 'carta' }
  /**
   * F3 (fatia T): a forma ligou. `imagem` = a da forma, se o dono quis trocar.
   * `numeros` (a prévia: "FOR 160 → 220") só sai a quem é dono ou aliado do
   * token (`efeitosParaJogador`); ausente = só o nome.
   */
  | { seq: number; tipo: 'transformacao'; tokenId: string; forma: string; imagem: string | null; numeros?: readonly NumeroDaForma[] }
  /** F3 (fatia T): desfez a forma (ação livre). Texto curto sobre o token. */
  | { seq: number; tipo: 'forma'; tokenId: string; forma: string; ligou: false }
  /** F3 (fatia T): um selo acabou ("ATORDOADO ACABOU"). */
  | { seq: number; tipo: 'selo'; tokenId: string; nome: string; acabou: true }

/** Um número que a forma muda: "FOR 160 → 220", "HP máx 1.200 → 1.800", "HP 900 → 1.500". */
export interface NumeroDaForma {
  rotulo: string
  de: number
  para: number
  nota?: string
}

/**
 * F3: a forma ativada PELO MENU nesta batalha, por personagemId
 * (`TurnosDaCena.formas`). `imagem` = `CartaoDaFicha.imagem` se o dono quis
 * trocar a do token e do retrato; vale só enquanto o cartão segue ligado
 * (`aparenciaDaForma`).
 */
export interface FormaNaBatalha {
  cartaoId: string
  imagem: string | null
}

/**
 * F3: um selo com duração na carta ("Atordoado 2"). Por TOKEN: a carta extra
 * mostra o mesmo. Conta na vez do alvo (Q4): desconta no fim da vez dele, no
 * máximo 1 vez por rodada.
 */
export interface SeloDaBatalha {
  /** `selo_<uuid>`. */
  id: string
  tokenId: string
  /** Até `NOME_DO_SELO_MAX`. */
  nome: string
  /** Os turnos que faltam; `null` = até o mestre tirar. */
  turnos: number | null
  total: number | null
  /** A rodada em que já descontou (1 vez por rodada). */
  contadoNaRodada?: number
  /** O nome da técnica que o pôs. */
  origem?: string
  /** Tipos de habilidade F2: o que o selo soma enquanto existe ("FOR +20"); ausente = nada. */
  mods?: readonly ModDoSelo[]
  /** Tipos de habilidade F2: o cartaoId da habilidade que o pôs; ausente = posto à mão. */
  cartaoId?: string
  /** Tipos de habilidade F2: a cor da pílula; ausente = "condicao" (como antes). */
  natureza?: NaturezaDoSelo
}

/** O selo como chega no pedido (o sugerido na mira, ou o do mestre). `turnos` null = até tirar. */
export interface SeloPedido {
  nome: string
  turnos: number | null
  /** Tipos de habilidade F2: as linhas "atributo / delta" da mira ou do "Pôr selo...". O host filtra pelo sistema (`seloPedidoValido`). */
  mods?: readonly ModDoSelo[]
}

/**
 * O selo que o golpe guarda para pôr em quem acerta: o do pedido mais o que
 * o HOST tira da técnica (nunca do fio): a natureza pelo Tipo (Buff, Debuff)
 * e o cartaoId.
 */
export interface SeloDoGolpe extends SeloPedido {
  natureza?: NaturezaDoSelo
  cartaoId?: string
}

/**
 * Tipos de habilidade F2 (Buff/Debuff, seções 3.3 e 4c do plano): o que um
 * selo soma enquanto existe. `alvo` = id de atributo do sistema,
 * `ALVO_DO_DANO` (soma no fim da sugestão do golpe) ou `ALVO_DA_REACAO`
 * (modificador inicial da caixa de reação). `delta` com sinal: "perde 15 de
 * Agilidade" = -15.
 */
export interface ModDoSelo {
  alvo: string
  delta: number
}

/** A cor da pílula do selo: buff verde, debuff roxo, passiva dourada, condicao como sempre. */
export type NaturezaDoSelo = 'buff' | 'debuff' | 'passiva' | 'condicao'

/** As naturezas, para o enum fechado do fio. */
export const NATUREZAS_DO_SELO: readonly NaturezaDoSelo[] = ['buff', 'debuff', 'passiva', 'condicao']

/** Um pedaço do bônus como a conta o mostra: "+20 (Fúria)". `nome` = o nome do selo. */
export interface ParteDoBonus {
  nome: string
  delta: number
}

/**
 * O que os selos de UMA ficha somam agora (`bonusDaBatalha`): alvo do mod →
 * as partes, na ordem em que os selos foram postos. Sem selo com mod = `{}`.
 * O mesmo objeto para o menu, a mira, o painel do NPC e a caixa de reação.
 */
export type BonusDaBatalha = Readonly<Record<string, readonly ParteDoBonus[]>>

/** O alvo do mod que soma no dano sugerido do golpe ("+30 de dano"). */
export const ALVO_DO_DANO = 'dano'
/** O alvo do mod que soma no modificador da reação ("+3 na reação"). */
export const ALVO_DA_REACAO = 'reacao'

/** F3: a ação que Ativar a forma gasta (o campo Ação; vazio = Completa). */
export type AcaoDaForma = 'simples' | 'completa' | 'bonus'

/** Alvos num golpe. */
export const ALVOS_MAX = 12
/** Armas levadas para uma batalha (teto do fio; o limite da ficha vai até 6). */
export const ARMAS_NA_BATALHA_MAX = 20
/** Golpes esperando reação numa cena (e no recorte do jogador). */
export const GOLPES_PENDENTES_MAX = 20
/** Contra-ataques guardados numa cena. */
export const CONTRAS_MAX = 20
/** Efeitos guardados por cena: os mais novos. */
export const EFEITOS_GUARDADOS = 50
/** Efeitos numa mensagem `batalha.efeitos`. */
export const EFEITOS_POR_MENSAGEM = 20
export const CARGA_MAX = 3
/** Livro: Atenção 1, 2 e 3 = 1,5x, 2,0x e 3,5x. */
export const MULTIPLICADOR_DA_CARGA = [1, 1.5, 2, 3.5] as const
export const MULTIPLICADOR_DA_SURPRESA = 1.5
export const MULTIPLICADOR_DO_CRITICO = 1.5
/** A porcentagem do Perfurante: de 1% a 100% do dano vai direto ao HP. */
export const PERFURACAO_MIN = 1
export const PERFURACAO_MAX = 100
/** = `DICE_MODIFIER_LIMIT` (lib/dice.ts). */
export const MODIFICADOR_DA_REACAO_MAX = 99
/** Teto de um dano (no pedido, no efeito e no dano livre). */
export const DANO_MAX = 1_000_000
/** Teto de um custo confirmado na tela. */
export const CUSTO_MAX = 1_000_000
/** Teto do nome do golpe (o da arma ou da habilidade) no fio. */
export const NOME_DO_GOLPE_MAX = 80
/** F3: teto do nome de um selo. */
export const NOME_DO_SELO_MAX = 24
/** F3: teto dos turnos de um selo. */
export const TURNOS_DO_SELO_MAX = 99
/** F3: selos numa ficha (e numa carta no fio). */
export const SELOS_POR_TOKEN_MAX = 8
/** F3: selos numa cena. */
export const SELOS_MAX = 120
/** Tipos de habilidade F2: linhas "atributo / delta" num selo. O delta fica dentro de ±`DANO_MAX`. */
export const MODS_POR_SELO_MAX = 4
/** Tipos de habilidade F2: teto do alvo de um mod no fio (um id de atributo, "dano" ou "reacao"). */
export const ALVO_DO_MOD_MAX = 40
/** F3: linhas na prévia da forma (e no efeito). */
export const NUMEROS_DA_FORMA_MAX = 16
/** F3: teto do rótulo e da nota de um número da forma no fio. */
export const ROTULO_DO_NUMERO_MAX = 40
/** F3: teto do nome da forma (o nome do cartão) no fio. */
export const NOME_DA_FORMA_MAX = 80
/** F3: teto de um número da forma no fio (o mesmo do dano). */
export const NUMERO_DA_FORMA_MAX = DANO_MAX

/** O combate de quem ainda não fez nada nesta batalha. */
export function combateVazio(): CombateDoPersonagem {
  return { recargas: {}, usos: {}, overload: false, carga: 0, armas: null }
}

/** A chave da vez para `concentrouEm`. */
export function chaveDaVez(rodada: number, cartaId: string): string {
  return `${rodada}:${cartaId}`
}
