import type { ComponentType } from 'react'
import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FamiliaDaPeca, PecaDa } from '../../../../lib/batalha/mecanica/pecas'
import type { AcumuladorDaFicha } from '../../../../lib/batalha/requisitos/modelo'

/**
 * O REGISTRO DAS PEÇAS NA TELA (rework do editor de habilidades, E1; docs/design/habilidades-rework/PLANO.md
 * D1 e D9, `PECAS` do protótipo). O contrato de cada peça no editor: o nome, a frase curta do "o que
 * faz", o ícone, a cor e o componente que a edita. Nasce vazio: a E6 põe uma entrada por família.
 *
 * A peça guarda só o que é dela (`PecaDa<F>`, lib/batalha/mecanica/pecas.ts). O que mora fora dela e a
 * tela da peça mostra (os usos por batalha da forma, a defesa da reação que devolve) a tela muda pela
 * mecânica (`aoMudarAMecanica`). O Acumulador não é peça da mecânica: edita o `cartao.acumulador` (D9).
 *
 * API pública (estável para E6): `PropsDaPeca`, `PecaNaTela`, `PropsDoAcumulador`, `AcumuladorNaTela`,
 * `RegistroDasPecas`, `REGISTRO_DAS_PECAS`.
 */

/** O que o componente de uma peça recebe. */
export interface PropsDaPeca<F extends FamiliaDaPeca> {
  peca: PecaDa<F>
  /** A mecânica inteira (as outras peças, o uso, o limite), só para ler. */
  mecanica: MecanicaV1
  /** A peça mudou (o editor grava a mecânica com ela no lugar). */
  aoMudar: (peca: PecaDa<F>) => void
  /** Mudou o que mora fora da peça (`limite.usosPorBatalha`, `reacao.defesa`). */
  aoMudarAMecanica: (mecanica: MecanicaV1) => void
}

/** A entrada de uma família no registro (o `PECAS` do protótipo: nome, faz, ícone, cor, "novo"). */
export interface PecaNaTela<F extends FamiliaDaPeca> {
  familia: F
  /** "Pergunta na hora". */
  nome: string
  /** A frase curta do catálogo ("Antes de bater, pergunta; cada resposta muda o golpe"). */
  faz: string
  /** O nome do ícone do protótipo ("pergunta", "fogo", "gatilho" ...). */
  icone: string
  /** A cor da família, um token do tema ("var(--lb-latao)"). */
  cor: string
  /** Mostra o selo "novo" no catálogo. */
  novo: boolean
  Componente: ComponentType<PropsDaPeca<F>>
}

/** O que o componente do Acumulador recebe: o acumulador do cartão dono (ausente = ainda não tem). */
export interface PropsDoAcumulador {
  acumulador: AcumuladorDaFicha | undefined
  aoMudar: (acumulador: AcumuladorDaFicha) => void
}

/** A entrada do Acumulador no registro (fora da mecânica, D9). */
export interface AcumuladorNaTela {
  nome: string
  faz: string
  icone: string
  cor: string
  novo: boolean
  Componente: ComponentType<PropsDoAcumulador>
}

/** Uma entrada por família (cada uma com o tipo da própria peça) e a do Acumulador. */
export type RegistroDasPecas = { readonly [F in FamiliaDaPeca]?: PecaNaTela<F> } & { readonly acumulador?: AcumuladorNaTela }

/** O registro, vazio até a E6. */
export const REGISTRO_DAS_PECAS: RegistroDasPecas = {}
