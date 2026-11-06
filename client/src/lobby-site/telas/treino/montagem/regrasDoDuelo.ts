import { EQUIPE_DO_LADO, type CasaDaArena } from '../../../../lib/arena/grade'
import { GRADE_DO_TREINO, type LadoDoTreino, type VagaDoTreino } from '../../../../lib/treino/mesaEmMemoria'
import { casaLivreNoLado, ladoDaCasa, moverNaGrade, porNaGrade, recusaDaCasa, tirarDaGrade, type MudancaDaMontagem, type PecaNaGrade, type RegrasDaMontagem } from './regrasDaMontagem'

/**
 * A MONTAGEM DO DUELO (pendência da fatia J): a lista tem só os seus
 * personagens e eles entram só na sua metade (quem desafia é o Lado A, quem
 * aceita é o Lado B). Cada um entra uma vez, na casa livre onde for solto.
 *
 * A casa chega ao servidor pela jogada `montar` (`lib/treino/duelo.ts`): o
 * duelo nasce com as casas de largada da Arena, na ordem das fichas do pedido
 * (`fichasDaMontagem`), e, enquanto ninguém agiu, a tela leva cada ficha à
 * casa escolhida aqui (`alvosDaMontagem` e `proximaMontagem`, uma jogada por vez).
 *
 * Puro: sem DOM, sem React.
 */

/** Os ids das fichas na ordem do pedido ao servidor (a ordem das vagas: a1, a2...). */
export function fichasDaMontagem(lista: readonly PecaNaGrade[]): string[] {
  return lista.map((peca) => peca.pecaId)
}

function jaEntrou(lista: readonly PecaNaGrade[], pecaId: string): boolean {
  return lista.some((peca) => peca.pecaId === pecaId)
}

function mesmaCasa(a: CasaDaArena, b: CasaDaArena): boolean {
  return a.col === b.col && a.row === b.row
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
      const recusa = recusaDaCasa(lista, casa)
      return { casa, situacao: recusa === null ? 'livre' : recusa === 'cheio' ? 'cheio' : 'ocupada' }
    },
    por(lista, peca, casa) {
      if (ladoDaCasa(casa) !== lado) return { ok: false, motivo: 'outroLado' }
      if (jaEntrou(lista, peca.id)) return { ok: false, motivo: 'repetida' }
      return porNaGrade(lista, peca.id, casa)
    },
    porSemArrasto(lista, peca) {
      if (jaEntrou(lista, peca.id)) return { ok: false, motivo: 'repetida' }
      const casa = casaLivreNoLado(lista, lado)
      return casa === null ? { ok: false, motivo: 'cheio' } : porNaGrade(lista, peca.id, casa)
    },
    mover: (lista, chave, casa): MudancaDaMontagem => (ladoDaCasa(casa) !== lado ? { ok: false, motivo: 'outroLado' } : moverNaGrade(lista, chave, casa)),
    rotuloDoAlvo: (casa) => (ladoDaCasa(casa) === lado ? EQUIPE_DO_LADO[lado].nome : `Lado de ${nomeDoOutro}`),
    dicaDaLista: `Puxe para a sua metade, o ${EQUIPE_DO_LADO[lado].nome}: cada um começa na casa onde você soltar.`,
    dicaDaGrade: 'Arraste para mudar de casa na sua metade, ou use as setas. Delete tira da grade; arrastar de volta para a lista também.',
    tirar: tirarDaGrade,
    nomesDasMetades: lado === 'a' ? { a: voce, b: doOutro } : { a: doOutro, b: voce },
  }
}

/**
 * A casa escolhida de cada ficha do lado, pelo token do duelo (a vaga guarda
 * a ficha de origem). `null` = a montagem não é a deste duelo (outras fichas).
 */
export function alvosDaMontagem(vagas: readonly VagaDoTreino[], lista: readonly PecaNaGrade[], lado: LadoDoTreino): Map<string, CasaDaArena> | null {
  const doLado = vagas.filter((vaga) => vaga.lado === lado)
  if (doLado.length !== lista.length) return null
  const alvos = new Map<string, CasaDaArena>()
  for (const vaga of doLado) {
    const peca = lista.find((candidata) => candidata.pecaId === vaga.origem)
    if (peca === undefined) return null
    alvos.set(vaga.tokenId, peca.casa)
  }
  return alvos
}

/** As casas da metade do lado, da borda para o meio. */
function casasDaMetade(lado: LadoDoTreino): CasaDaArena[] {
  const casas: CasaDaArena[] = []
  for (let col = 0; col < GRADE_DO_TREINO.colunas; col += 1) {
    for (let row = 0; row < GRADE_DO_TREINO.linhas; row += 1) if (ladoDaCasa({ col, row }) === lado) casas.push({ col, row })
  }
  return lado === 'a' ? casas : casas.reverse()
}

/**
 * O próximo `montar` para levar as fichas às casas escolhidas: a primeira fora
 * do lugar cuja casa está livre. Se toda casa escolhida está ocupada (duas
 * fichas trocando de casa), a primeira passa antes por uma casa livre da metade
 * que ninguém escolheu. `null` = todas no lugar (ou nenhuma casa para passar).
 */
export function proximaMontagem(posicoes: Readonly<Record<string, CasaDaArena>>, alvos: ReadonlyMap<string, CasaDaArena>, lado: LadoDoTreino): { tokenId: string; casa: CasaDaArena } | null {
  const ocupadas = Object.values(posicoes)
  const livre = (casa: CasaDaArena): boolean => !ocupadas.some((outra) => mesmaCasa(outra, casa))
  const foraDoLugar = [...alvos].filter(([tokenId, casa]) => {
    const agora = posicoes[tokenId]
    return agora !== undefined && !mesmaCasa(agora, casa)
  })
  const primeira = foraDoLugar[0]
  if (primeira === undefined) return null
  const direta = foraDoLugar.find(([, casa]) => livre(casa))
  if (direta !== undefined) return { tokenId: direta[0], casa: direta[1] }
  const escolhidas = [...alvos.values()]
  const passagem = casasDaMetade(lado).find((casa) => livre(casa) && !escolhidas.some((escolhida) => mesmaCasa(escolhida, casa)))
  return passagem === undefined ? null : { tokenId: primeira[0], casa: passagem }
}
