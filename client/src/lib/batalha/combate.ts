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
 * O que a reação deu. "naoReagiu" = escolheu Não reagir; "semReacao" =
 * Surpresa, Overload ou golpe que o alvo não pode reagir.
 */
export type SaidaDaReacao = 'critico' | 'cheio' | 'metade' | 'esquiva' | 'contra' | 'naoReagiu' | 'semReacao'

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
 * quem ataca pode desligar.
 */
export type PedidoDeAcao =
  | { tipo: 'atacar'; armaId: string | null; alvos: readonly PedidoDeAlvo[]; surpresa: boolean; perfurante: boolean; contraDe?: string }
  | {
      tipo: 'habilidade'
      cartaoId: string
      armaId: string | null
      alvos: readonly PedidoDeAlvo[]
      surpresa: boolean
      perfurante: boolean
      /** O custo confirmado na tela; `null` = o da ficha. */
      custo: number | null
      /** Só quando a ficha não diz; `null` = a da ficha. */
      acao: AcaoDaTecnica | null
      contraDe?: string
    }
  | { tipo: 'concentrar' }
  /** Q6: o contra-ataque gasto em se mover. Só marca (e tira o atalho); o movimento em si é o arrasto de sempre. */
  | { tipo: 'mover'; contraDe: string }

/** Os tipos de pedido de ação, para o enum fechado do fio. */
export type TipoDoPedidoDeAcao = PedidoDeAcao['tipo']

export type PedidoDeReacao =
  /** `golpeId` null = reação livre (o botão Reação sem golpe esperando). */
  | { tipo: 'rolar'; golpeId: string | null; tokenId: string; modificador: number }
  | { tipo: 'rerolar'; golpeId: string; tokenId: string; modificador: number }
  /** Só uma das saídas que o dado liberou (`saidasPossiveis`). */
  | { tipo: 'escolher'; golpeId: string; tokenId: string; saida: SaidaDaReacao }
  | { tipo: 'naoReagir'; golpeId: string; tokenId: string }

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
  /** O golpe é um contra-ataque ganho no golpe com este id. */
  contraDe?: string
  alvos: readonly AlvoDoGolpe[]
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
/** = `DICE_MODIFIER_LIMIT` (lib/dice.ts). */
export const MODIFICADOR_DA_REACAO_MAX = 99
/** Teto de um dano (no pedido, no efeito e no dano livre). */
export const DANO_MAX = 1_000_000
/** Teto de um custo confirmado na tela. */
export const CUSTO_MAX = 1_000_000
/** Teto do nome do golpe (o da arma ou da habilidade) no fio. */
export const NOME_DO_GOLPE_MAX = 80

/** O combate de quem ainda não fez nada nesta batalha. */
export function combateVazio(): CombateDoPersonagem {
  return { recargas: {}, usos: {}, overload: false, carga: 0, armas: null }
}

/** A chave da vez para `concentrouEm`. */
export function chaveDaVez(rodada: number, cartaId: string): string {
  return `${rodada}:${cartaId}`
}
