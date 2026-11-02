import { valorDaParte, type Ajuste } from '../../ajusteDaFicha'
import type { Personagem } from '../../personagem'
import {
  REGISTRO_DBT_JOGADOR_MAX,
  REGISTRO_DBT_MAX,
  type AutorDBT,
  type LinhaDBT,
  type ParteDaFichaDBT,
  type TipoDaLinhaDBT,
} from './tipos'

/**
 * REGISTRO E DESFAZER (docs/planos/dbt-batalha.md, seção 14). Escrito aqui,
 * sem `lib/batalha/registro.ts`: aquele arquivo puxa regras do One Piece
 * (contador, passivas). Só PV e PK atual/máximo voltam pela ficha; o resto da
 * batalha volta pela foto do núcleo.
 */

const RECURSOS_DA_BATALHA = ['pv', 'pk'] as const satisfies readonly string[]
const PARTES_DA_BATALHA = ['recurso', 'maximo'] as const satisfies readonly ParteDaFichaDBT['parte'][]

/** Tipos que o jogador desfaz sozinho (sem d20 na linha). */
const DESFEITAS_PELO_JOGADOR: ReadonlySet<TipoDaLinhaDBT> = new Set<TipoDaLinhaDBT>(['movimento', 'voo', 'transformacao', 'acao', 'ficha'])

/** A linha nova no fim; passou do teto, as mais velhas saem. */
export function comLinhaDBT(registro: readonly LinhaDBT[], linha: LinhaDBT): LinhaDBT[] {
  return [...registro, linha].slice(-REGISTRO_DBT_MAX)
}

/** A última linha ainda de pé do registro (o Desfazer é LIFO). */
export function ultimaDePe(registro: readonly LinhaDBT[]): LinhaDBT | null {
  for (let i = registro.length - 1; i >= 0; i -= 1) if (registro[i].desfeita === undefined) return registro[i]
  return null
}

/**
 * Pode desfazer: é a última não desfeita E (mestre, OU o jogador autor dela,
 * sem d20 na linha, de um tipo que é só dele). Dado rolado só o mestre volta.
 */
export function podeDesfazerDBT(linha: LinhaDBT, quem: AutorDBT, registro: readonly LinhaDBT[]): boolean {
  if (ultimaDePe(registro)?.id !== linha.id) return false
  if (quem.tipo === 'mestre') return true
  return linha.autor.tipo === 'jogador' && linha.autor.playerId === quem.playerId && !linha.comD20 && DESFEITAS_PELO_JOGADOR.has(linha.tipo)
}

/** A linha como o jogador a vê: só o texto público (linha só do mestre não aparece). */
export interface LinhaDoJogadorDBT {
  id: string
  seq: number
  rodada: number
  tipo: TipoDaLinhaDBT
  texto: string
  detalhes: readonly string[]
  desfeita: boolean
  /** O autor é um jogador (o próprio, para o botão Desfazer). */
  playerId: string | null
}

export function linhasParaJogador(registro: readonly LinhaDBT[]): LinhaDoJogadorDBT[] {
  return registro
    .filter((linha) => linha.textoPublico !== '')
    .slice(-REGISTRO_DBT_JOGADOR_MAX)
    .map((linha) => ({
      id: linha.id,
      seq: linha.seq,
      rodada: linha.rodada,
      tipo: linha.tipo,
      texto: linha.textoPublico,
      detalhes: linha.detalhesPublicos,
      desfeita: linha.desfeita !== undefined,
      playerId: linha.autor.tipo === 'jogador' ? linha.autor.playerId : null,
    }))
}

/** O que o comando mudou na ficha (PV e PK, atual e máximo), de quanto para quanto. */
export function partesDaFichaDBT(antes: Personagem, depois: Personagem): ParteDaFichaDBT[] {
  const partes: ParteDaFichaDBT[] = []
  for (const parte of PARTES_DA_BATALHA) {
    for (const chave of RECURSOS_DA_BATALHA) {
      const de = valorDaParte(antes, parte, chave)
      const para = valorDaParte(depois, parte, chave)
      if (de !== para) partes.push({ parte, chave, de, para })
    }
  }
  return partes
}

/**
 * Os ajustes que desfazem as partes sobre a ficha de AGORA: volta só o delta
 * (o que mudou depois, por outra linha ou à mão, fica). Máximo antes do atual,
 * para o atual não ser preso pelo máximo velho.
 */
export function ajustesParaDesfazer(atual: Personagem, partes: readonly ParteDaFichaDBT[]): Ajuste[] {
  const ordenadas = [...partes].sort((a, b) => (a.parte === b.parte ? 0 : a.parte === 'maximo' ? -1 : 1))
  return ordenadas.map(({ parte, chave, de, para }) => ({ parte, chave, valor: valorDaParte(atual, parte, chave) - (para - de) }))
}
