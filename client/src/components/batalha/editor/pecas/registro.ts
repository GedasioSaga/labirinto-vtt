import type { ComponentType } from 'react'
import type { MecanicaV1 } from '../../../../lib/batalha/mecanica/modelo'
import type { FamiliaDaPeca, PecaDa } from '../../../../lib/batalha/mecanica/pecas'
import type { AcumuladorDaFicha, Referencia } from '../../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../../lib/personagem'
import { PecaAcumulador } from './PecaAcumulador'
import { PecaDevolve } from './PecaDevolve'
import { PecaDiminui } from './PecaDiminui'
import { PecaGatilho } from './PecaGatilho'
import { PecaImbuir } from './PecaImbuir'
import { PecaInvocacao } from './PecaInvocacao'
import { PecaMarca } from './PecaMarca'
import { PecaPergunta } from './PecaPergunta'
import { PecaRaca } from './PecaRaca'
import { PecaStatus } from './PecaStatus'
import { PecaTransformacao } from './PecaTransformacao'

/**
 * O REGISTRO DAS PEÇAS NA TELA (rework do editor de habilidades, E1 o contrato, E4 as entradas;
 * docs/design/habilidades-rework/PLANO.md D1 e D9, `PECAS` do protótipo). O contrato de cada peça no
 * editor: o nome, a frase curta do "o que faz", o ícone, a cor e o componente que edita o CORPO dela.
 * A moldura (o encaixe da cor, o medalhão, subir, descer e tirar) é a `MolduraDaPeca`, e a lista, a
 * ordem e o "Pôr peça" são do editor (E6).
 *
 * A peça guarda só o que é dela (`PecaDa<F>`, lib/batalha/mecanica/pecas.ts). O que mora fora dela e a
 * tela da peça mostra (os usos por batalha da forma, a defesa da reação que devolve) a tela muda pela
 * mecânica (`aoMudarAMecanica`). O Acumulador não é peça da mecânica: edita o `cartao.acumulador` (D9).
 * As ligações noutro cartão (D8: a técnica da forma, a técnica que o acumulador libera) a peça grava
 * pelo requisito do outro cartão (`ArredoresDaPeca.aoMudarOutroCartao`, ligacoes.ts).
 *
 * API pública (estável para E6): `PropsDaPeca`, `PecaNaTela`, `PropsDoAcumulador`, `AcumuladorNaTela`,
 * `RegistroDasPecas`, `REGISTRO_DAS_PECAS`, `ArredoresDaPeca`, `ORDEM_NA_TELA`, `entradaDaPeca`.
 */

/**
 * Opcional (E4): a ficha em volta do cartão editado. Sem ela (o catálogo do livro, a prévia), a peça
 * funciona igual, só sem as listas da ficha: mostra como ligar pelos Requisitos do outro cartão.
 */
export interface ArredoresDaPeca {
  /** O cartão que está sendo editado (o dono da peça). */
  cartao: Referencia
  /** A ficha: as técnicas que a peça cita, os outros acumuladores, as ligações já gravadas. */
  personagem: Pick<Personagem, 'abas'>
  /** Os atributos do sistema (o ganho por nível do acumulador); ausente = os 8 da ficha de One Piece. */
  atributos?: readonly Referencia[]
  /**
   * Grava outro cartão da ficha (a técnica com o B3 ou o A4 novo; pode ser um subcartão: o editor
   * troca pelo `id`). Ausente = a peça só mostra as ligações, sem mudar.
   */
  aoMudarOutroCartao?: (cartao: CartaoDaFicha) => void
}

/** O que o componente de uma peça recebe. */
export interface PropsDaPeca<F extends FamiliaDaPeca> {
  peca: PecaDa<F>
  /** A mecânica inteira (as outras peças, o uso, o limite), só para ler. */
  mecanica: MecanicaV1
  /** A peça mudou (o editor grava a mecânica com ela no lugar). */
  aoMudar: (peca: PecaDa<F>) => void
  /** Mudou o que mora fora da peça (`limite.usosPorBatalha`, `reacao.defesa`). */
  aoMudarAMecanica: (mecanica: MecanicaV1) => void
  /** E4, opcional: a ficha em volta (as ligações de D8). */
  arredores?: ArredoresDaPeca
}

/** A entrada de uma família no registro (o `PECAS` do protótipo: nome, faz, ícone, cor, "novo"). */
export interface PecaNaTela<F extends FamiliaDaPeca> {
  familia: F
  /** "Pergunta na hora". */
  nome: string
  /** A frase curta do catálogo ("Antes de bater, pergunta; cada resposta muda o golpe"). */
  faz: string
  /** O nome do ícone do protótipo ("pergunta", "fogo", "gatilho" ...; `Glifo`, glifos.tsx). */
  icone: string
  /** A cor da família, um token do tema ("var(--lb-peca-latao)", pecas.css). */
  cor: string
  /** Mostra o selo "novo" no catálogo. */
  novo: boolean
  Componente: ComponentType<PropsDaPeca<F>>
}

/** O que o componente do Acumulador recebe: o acumulador do cartão dono (ausente = ainda não tem). */
export interface PropsDoAcumulador {
  acumulador: AcumuladorDaFicha | undefined
  aoMudar: (acumulador: AcumuladorDaFicha) => void
  /** E4, opcional: a ficha em volta (o nome único, as técnicas que sobem e as que ele libera, D8). */
  arredores?: ArredoresDaPeca
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

/** Toda família da mecânica tem entrada (o tipo cobra, não só o leitor). */
type EntradasDasFamilias = { readonly [F in FamiliaDaPeca]: PecaNaTela<F> }

const FAMILIAS: EntradasDasFamilias = {
  pergunta: { familia: 'pergunta', nome: 'Pergunta na hora', faz: 'Antes de bater, a batalha pergunta; cada resposta muda o golpe.', icone: 'pergunta', cor: 'var(--lb-peca-latao)', novo: true, Componente: PecaPergunta },
  imbuir: { familia: 'imbuir', nome: 'Imbuir', faz: 'A cada golpe do dono, ele escolhe um elemento enquanto estiver ligado.', icone: 'fogo', cor: 'var(--lb-peca-dano)', novo: true, Componente: PecaImbuir },
  gatilho: { familia: 'gatilho', nome: 'Dispara sozinha', faz: 'Quando algo acontece, faz o efeito sem gastar ação.', icone: 'gatilho', cor: 'var(--lb-peca-cura)', novo: true, Componente: PecaGatilho },
  raca: { familia: 'raca', nome: 'Passiva de raça', faz: 'Sempre ligada: corta dano, soma dano, proíbe desviar.', icone: 'raca', cor: 'var(--lb-peca-couro)', novo: true, Componente: PecaRaca },
  transformacao: {
    familia: 'transformacao',
    nome: 'Transformação',
    faz: 'Dura alguns turnos: ações a mais, técnica nova, atributos, marca e fadiga no fim.',
    icone: 'forma',
    cor: 'var(--lb-peca-selo)',
    novo: true,
    Componente: PecaTransformacao,
  },
  status: { familia: 'status', nome: 'Muda atributo', faz: 'Soma ou tira atributo do dono ou de um aliado, fixo ou por fórmula.', icone: 'status', cor: 'var(--lb-peca-agua)', novo: true, Componente: PecaStatus },
  diminui: {
    familia: 'diminui',
    nome: 'Diminui atributo do alvo',
    faz: 'Ao acertar, o alvo perde atributo de uma vez, por turno ou a partir de um turno.',
    icone: 'desce',
    cor: 'var(--lb-peca-ameixa)',
    novo: true,
    Componente: PecaDiminui,
  },
  marca: { familia: 'marca', nome: 'Marca', faz: 'Deixa uma marca no alvo; o próximo golpe nela dá mais dano.', icone: 'marca', cor: 'var(--lb-peca-selo)', novo: false, Componente: PecaMarca },
  invocacao: { familia: 'invocacao', nome: 'Invocação', faz: 'Chama uma criatura com vida, dano e limite de quantas.', icone: 'invocacao', cor: 'var(--lb-peca-cura)', novo: false, Componente: PecaInvocacao },
  devolve: { familia: 'devolve', nome: 'Devolve o golpe', faz: 'Na reação: defende uma parte e devolve dano em quem bateu.', icone: 'devolve', cor: 'var(--lb-peca-couro)', novo: false, Componente: PecaDevolve },
}

/** O Acumulador: fora da mecânica, no `cartao.acumulador` (D9). */
const ACUMULADOR: AcumuladorNaTela = { nome: 'Acumulador', faz: 'Contador que sobe e desce na batalha e faz algo ao chegar a N.', icone: 'acum', cor: 'var(--lb-peca-musgo)', novo: true, Componente: PecaAcumulador }

/** O registro: as 10 famílias da mecânica e o Acumulador (as 11 do protótipo). */
export const REGISTRO_DAS_PECAS: RegistroDasPecas = { ...FAMILIAS, acumulador: ACUMULADOR }

/** A ordem do catálogo "Pôr peça" (`ORDEM_DAS_PECAS` do protótipo: o Acumulador entre o Diminui e a Marca). */
export const ORDEM_NA_TELA: readonly (FamiliaDaPeca | 'acumulador')[] = ['pergunta', 'imbuir', 'gatilho', 'raca', 'transformacao', 'status', 'diminui', 'acumulador', 'marca', 'invocacao', 'devolve']

/** A entrada de uma família, sempre presente (o registro está completo). */
export function entradaDaPeca<F extends FamiliaDaPeca>(familia: F): PecaNaTela<F> {
  return FAMILIAS[familia]
}
