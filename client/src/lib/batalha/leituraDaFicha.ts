import type { CartaoDaFicha, Personagem } from '../personagem'
import type { SistemaDeRpg } from '../sistemaDeRpg'
import type { AcaoDaTecnica } from './combate'

/**
 * LEITURA DA FICHA PARA A BATALHA, F2 (seção 3.1 de
 * docs/planos/batalha-one-piece-f2-plano.md): custo, ação, tempo, Overload,
 * Perfurante (Q4), armas e técnicas, lidos do texto livre dos cartões One
 * Piece. Leitura leve: minúsculas, sem acento, espaços juntados; "-" ou vazio
 * = nada. Na dúvida, "pergunta" (o jogador confirma na tela) — leitura errada
 * é pior que vazia.
 *
 * FASE 0 (contrato): as leituras de texto têm corpo provisório honesto (não
 * entendem nada e perguntam); a fase 1 troca os corpos sem mudar as
 * assinaturas. `armasDe` e `limiteDeArmas` já valem.
 *
 * Puro: sem store, sem rede.
 */

/** A aba da ficha One Piece com as armas (`lib/sistemaOnePiece.ts`). */
export const ABA_DAS_ARMAS = 'armas'
/** A escolha do sistema "Armas por batalha" ("1 arma" a "6 armas"; vazio = sem limite). */
export const ESCOLHA_DAS_ARMAS = 'armasPorBatalha'
/** O maior limite que a escolha oferece. */
export const LIMITE_DE_ARMAS_MAX = 6

export type LeituraDoCusto =
  | { tipo: 'nada' }
  | { tipo: 'valor'; recurso: 'sp' | 'hp'; valor: number; porTurno: boolean }
  | { tipo: 'pergunta'; recurso: 'sp' | 'hp'; sugestao: number | null; texto: string }

export interface LeituraDaAcao {
  acao: AcaoDaTecnica | 'passiva' | null
  overload: boolean
  transformacao: boolean
  tambemReacao: boolean
}

export type LeituraDoTempo = { tipo: 'livre' } | { tipo: 'recarga'; turnos: number } | { tipo: 'usos'; vezes: number } | { tipo: 'overload' } | { tipo: 'texto'; texto: string }

/** O custo do cartão ("-35 de SP", "15SP", "20 HP", "10% do Hp..."). Fase 0: sempre pergunta. */
export function lerCusto(texto: string, _personagem: Personagem): LeituraDoCusto {
  return { tipo: 'pergunta', recurso: 'sp', sugestao: null, texto }
}

/** A ação do cartão ("Ação Simples", "Completa", "Bonus", "OVERLOAD | TRANSFORMAÇÃO"). Fase 0: não sabe (a tela pergunta). */
export function lerAcao(_texto: string): LeituraDaAcao {
  return { acao: null, overload: false, transformacao: false, tambemReacao: false }
}

/** O tempo do cartão ("2", "3 turnos", "2 Vezes por Combate", "OVERLOAD"). Fase 0: o texto, sem contador. */
export function lerTempo(texto: string): LeituraDoTempo {
  return { tipo: 'texto', texto }
}

/** Ação, tempo ou extra de NOME "OVERLOAD". Fase 0: não. */
export function ehOverload(_cartao: CartaoDaFicha): boolean {
  return false
}

/**
 * Q4: o golpe é PERFURANTE (dano direto ao HP, sem gastar o Escudo) quando a
 * habilidade diz ("perfurante", "ignorando armaduras", "direto na vida"). É o
 * valor inicial do interruptor; quem ataca e o mestre podem trocar. Fase 0: não.
 */
export function ehPerfurante(_cartao: CartaoDaFicha): boolean {
  return false
}

/** As técnicas que o menu mostra: Habilidades + subcartões das transformações LIGADAS. Fase 0: nenhuma. */
export function tecnicasDe(_personagem: Personagem, _sistema: SistemaDeRpg): CartaoDaFicha[] {
  return []
}

/** Os cartões da aba Armas. */
export function armasDe(personagem: Personagem): CartaoDaFicha[] {
  return personagem.abas[ABA_DAS_ARMAS] ?? []
}

/** O limite da escolha "Armas por batalha", pelo número do começo ("2 armas" = 2). Vazio ou torto = sem limite (`null`). */
export function limiteDeArmas(personagem: Personagem): number | null {
  const escolha = personagem.escolhas[ESCOLHA_DAS_ARMAS]
  if (escolha === undefined) return null
  const numero = /^\s*(\d+)/.exec(escolha)?.[1]
  if (numero === undefined) return null
  const limite = Number.parseInt(numero, 10)
  return limite >= 1 && limite <= LIMITE_DE_ARMAS_MAX ? limite : null
}
