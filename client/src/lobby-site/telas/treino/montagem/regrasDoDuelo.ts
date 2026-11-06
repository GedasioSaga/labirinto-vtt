import { casasDoLado, EQUIPE_DO_LADO, type CasaDaArena } from '../../../../lib/arena/grade'
import { GRADE_DO_TREINO, VAGAS_POR_LADO_MAX, type LadoDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import { ladoDaCasa, tirarDaGrade, type MudancaDaMontagem, type PecaNaGrade, type RegrasDaMontagem } from './regrasDaMontagem'

/**
 * A MONTAGEM DO DUELO (pendência da fatia J): a lista tem só os seus
 * personagens e eles entram só na sua metade (quem desafia é o Lado A, quem
 * aceita é o Lado B). Cada um entra uma vez.
 *
 * A casa é a que o servidor vai usar: o duelo nasce com as casas de largada
 * da Arena (`casasDoLado`, em `criarDuelo` de `lib/treino/duelo.ts`), na
 * ordem das fichas do pedido, e essa ordem é a desta lista. Então o token cai
 * na casa de largada de quem entra por último, e a casa sob o ponteiro não
 * conta. Outra casa de largada exigiria uma jogada de montagem conferida pelo
 * servidor; a única jogada de posição que existe, o `andar` da M1, só vale na
 * vez da ficha e soma no MOV, então não serve de largada.
 *
 * Puro: sem DOM, sem React.
 */

const LIMITE = 'A casa de cada um é a de largada da Arena, na ordem em que entrou: escolher outra casa ainda não chega ao servidor.'

/** Cada peça na casa de largada da posição dela na lista (a conta do servidor). */
export function naLargada(lista: readonly PecaNaGrade[], lado: LadoDoTreino): PecaNaGrade[] {
  const casas = casasDoLado(lista.length, lado, GRADE_DO_TREINO)
  return lista.map((peca, i) => {
    const casa = casas[i] ?? peca.casa
    return peca.casa.col === casa.col && peca.casa.row === casa.row ? peca : { ...peca, casa }
  })
}

/** A casa de largada de quem entrar agora; `null` = o lado está cheio. */
export function proximaLargada(lista: readonly PecaNaGrade[], lado: LadoDoTreino): CasaDaArena | null {
  if (lista.length >= VAGAS_POR_LADO_MAX) return null
  return casasDoLado(lista.length + 1, lado, GRADE_DO_TREINO)[lista.length] ?? null
}

/** Os ids das fichas na ordem do pedido ao servidor (a mesma das casas). */
export function fichasDaMontagem(lista: readonly PecaNaGrade[]): string[] {
  return lista.map((peca) => peca.pecaId)
}

function entrar(lista: readonly PecaNaGrade[], pecaId: string, lado: LadoDoTreino): MudancaDaMontagem {
  if (lista.some((peca) => peca.pecaId === pecaId)) return { ok: false, motivo: 'repetida' }
  const casa = proximaLargada(lista, lado)
  if (casa === null) return { ok: false, motivo: 'cheio' }
  return { ok: true, lista: naLargada([...lista, { chave: `${pecaId}#1`, pecaId, casa }], lado) }
}

export function regrasDoDuelo(lado: LadoDoTreino, nomeDoOutro: string): RegrasDaMontagem {
  const outroLado: LadoDoTreino = lado === 'a' ? 'b' : 'a'
  const voce = `${EQUIPE_DO_LADO[lado].nome}: você`
  const doOutro = `${EQUIPE_DO_LADO[outroLado].nome}: ${nomeDoOutro}`
  return {
    realce(lista, peca, casa) {
      if (ladoDaCasa(casa) !== lado) return { casa, situacao: 'ocupada', texto: `Lado de ${nomeDoOutro}` }
      const ja = lista.find((candidata) => candidata.pecaId === peca.id)
      if (ja !== undefined) return { casa: ja.casa, situacao: 'ocupada', texto: 'Já está na grade' }
      const largada = proximaLargada(lista, lado)
      // O realce vai para a casa onde o token vai cair, não para a do ponteiro.
      return largada === null ? { casa, situacao: 'cheio' } : { casa: largada, situacao: 'livre', texto: 'Largada' }
    },
    por: (lista, peca, casa) => (ladoDaCasa(casa) !== lado ? { ok: false, motivo: 'outroLado' } : entrar(lista, peca.id, lado)),
    porSemArrasto: (lista, peca) => entrar(lista, peca.id, lado),
    mover: () => ({ ok: false, motivo: 'largada' }),
    rotuloDoAlvo: () => 'Solte na lista para tirar',
    dicaDaLista: `Puxe para a sua metade, o ${EQUIPE_DO_LADO[lado].nome}.`,
    dicaDaGrade: 'A casa é a de largada da Arena. Delete tira da grade; arrastar de volta para a lista também.',
    tirar: (lista, chave) => naLargada(tirarDaGrade(lista, chave), lado),
    nomesDasMetades: lado === 'a' ? { a: voce, b: doOutro } : { a: doOutro, b: voce },
    aviso: LIMITE,
  }
}
