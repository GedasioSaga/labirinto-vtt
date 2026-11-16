/**
 * "!" CENÁRIO e "?" FALAS E PISTAS (P4 e P5 do estudo de 15/11,
 * `tmp/preludio-integrado-2026-11-15/ESTUDO.md` §4). O pino é o lugar; o texto
 * tem um dono (o próprio pino ou uma seção do Prelúdio); a mesa escolhe como
 * e quando o jogador recebe.
 */

import type { FonteNoPreludio } from './map'

/**
 * Quando o texto do "!" abre para o jogador:
 * - `tocar`: quem toca no pino lê (o "!" de sempre);
 * - `chegar`: abre sozinho, uma vez, quando a ficha dele chega a N casas;
 * - `mandar`: o pino aparece, mas o texto só chega com o "Ler agora" do mestre.
 */
export type QuandoDoCenario = 'tocar' | 'chegar' | 'mandar'

/**
 * O que a MESA (o host) sabe que este jogador já recebeu nesta sessão. Mora só
 * na sessão do host (`net/hostSession.ts`): os ids de jogador nascem a cada
 * sala, então não vão ao disco. Ausente no recorte = nada lido: falha fechada.
 */
export interface LeiturasDoJogador {
  /** Pinos "!" que o mestre leu para ele ("Ler agora") ou que ele já leu inteiro. */
  readonly cenarios: ReadonlySet<string>
  /** Entradas de "?" ditas a ele ("Dizer agora"), como `chaveDaFala(pinoId, falaId)`. Ausente = nenhuma. */
  readonly falas?: ReadonlySet<string>
}

/** A etiqueta de uma entrada do "?" (P5). */
export type EtiquetaDaFala = 'Fala' | 'Pista' | 'Boato' | 'Pergunta'

/**
 * Uma entrada do "?" FALAS E PISTAS (P5): uma coisa para DIZER. Nasce oculta:
 * só chega a quem o mestre disse ("Dizer agora") ou a todos, se `livre`.
 * Só do mestre: o recorte manda `FalaParaJogador`, pela lista do que vai.
 */
export interface FalaDoPino {
  id: string
  etiqueta: EtiquetaDaFala
  /** Quem diz ("Bento"): o nome que o mestre escreve ou a cópia do nome do Personagem. Ausente = pista sem dono. */
  quem?: string
  /** O Personagem do Prelúdio que diz (o verbete). Só do mestre. */
  quemVerbeteId?: string
  /** O texto. Na entrada ligada (`fonte`), a cópia em dia da seção, já limpa. */
  texto: string
  /** A seção do Prelúdio de onde vem o texto ("O que ele sabe"). Só do mestre. */
  fonte?: FonteNoPreludio
  /** Qualquer um lê ao tocar, sem o mestre dizer. Ausente = oculta. */
  livre?: true
}

/** O que o jogador recebe de uma entrada dita a ele ou livre. */
export interface FalaParaJogador {
  id: string
  etiqueta: EtiquetaDaFala
  quem?: string
  texto: string
}

/** Por pino, por entrada: a quem foi dita, na ordem de entrada na sala. */
export type FalasDitas = Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>

/** Como o jogador está com um cenário que o mestre mandou: lendo agora, ou leu (com a hora, `Date.now()`). */
export interface LeituraDoCenario {
  readonly estado: 'lendo' | 'leu'
  readonly hora: number
}

/** Por pino, por jogador: o que a ficha do "!" e o "Ler junto" do mestre mostram. */
export type LeiturasDosCenarios = Readonly<Record<string, Readonly<Record<string, LeituraDoCenario>>>>
