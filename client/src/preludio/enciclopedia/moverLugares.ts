import { comPai, comPaiDeAntes, paiDeAntes, planoDeMudarDePai, type PaiDeAntes, type PlanoDoPai, type Recusa } from '../../lib/preparo/lugaresEmRegioes'
import type { Verbete } from '../../lib/preparo/tipos'
import { usePreludio } from '../estado/preludio'

/**
 * PÔR UM LUGAR DENTRO DE OUTRO, pela loja do Prelúdio: o que a lista de Lugares
 * (arrastar, "Mover para…", "Tirar de") e a página do lugar ("Fica dentro de")
 * fazem igual. Confere tudo de novo com a loja na hora (o que a tela leu pode
 * ter ficado para trás), muda só o `paiId` e devolve a frase do aviso e o
 * Desfazer.
 */

export function nomeDoLugar(verbete: Verbete | undefined): string {
  return verbete?.titulo || 'Sem nome'
}

export function fraseDaRecusa(lugar: Verbete, motivo: Recusa, destino: string): string {
  if (motivo === 'so-leitura') return `${nomeDoLugar(lugar)} abre só para leitura e não muda de lugar.`
  if (motivo === 'ele-mesmo') return `${nomeDoLugar(lugar)} não cabe dentro dele mesmo.`
  if (motivo === 'dentro-dele') return `${destino} fica dentro de ${nomeDoLugar(lugar)}: não dá para pôr ${nomeDoLugar(lugar)} lá.`
  return 'Um lugar só cabe dentro de outro lugar.'
}

/** O plano com a loja de agora. */
export function planoAgora(ids: readonly string[], destino: string | null): PlanoDoPai {
  const estado = usePreludio.getState()
  return planoDeMudarDePai(ids, destino, estado.verbetes, estado.soLeitura)
}

export interface LugaresMovidos {
  /** A frase do aviso: o que mudou, ou por que nada mudou. */
  readonly texto: string
  /** Quantos lugares mudaram de lugar de cima. */
  readonly mudaram: number
  /** Devolve cada um para onde estava; ausente quando nada mudou. */
  readonly desfazer?: () => void
}

function lugares(n: number): string {
  return `${n} ${n === 1 ? 'lugar' : 'lugares'}`
}

/** Põe os lugares dentro de `destino` (`null` = fora de todos). `null` = nada a dizer (travado, ou nenhum lugar no pedido). */
export function moverLugares(ids: readonly string[], destino: string | null): LugaresMovidos | null {
  const estado = usePreludio.getState()
  if (estado.travado) return null
  const { mudam, recusados, jaEstavam } = planoAgora(ids, destino)
  const nomeDoDestino = destino === null ? '' : nomeDoLugar(estado.verbetes.get(destino))
  const primeiraRecusa = recusados[0]
  if (mudam.length === 0) {
    if (primeiraRecusa !== undefined) return { texto: fraseDaRecusa(primeiraRecusa[0], primeiraRecusa[1], nomeDoDestino), mudaram: 0 }
    if (jaEstavam > 0) return { texto: destino === null ? 'Já estava fora de outros lugares.' : `Já estava dentro de ${nomeDoDestino}.`, mudaram: 0 }
    return null
  }
  const antes = mudam.map((lugar): [string, PaiDeAntes] => [lugar.id, paiDeAntes(lugar)])
  for (const lugar of mudam) estado.mudarVerbete(lugar.id, (agora) => comPai(agora, destino))
  const um = mudam[0]
  const quem = mudam.length === 1 && um !== undefined ? nomeDoLugar(um) : lugares(mudam.length)
  const deOnde = mudam.length === 1 && um?.paiId !== undefined ? nomeDoLugar(estado.verbetes.get(um.paiId)) : null
  const feito =
    destino === null
      ? deOnde === null
        ? `${quem} ${mudam.length === 1 ? 'saiu' : 'saíram'} de onde estava${mudam.length === 1 ? '' : 'm'}.`
        : `${quem} saiu de ${deOnde}.`
      : `${quem} ${mudam.length === 1 ? 'agora fica' : 'agora ficam'} dentro de ${nomeDoDestino}.`
  const sobra = primeiraRecusa === undefined ? '' : ` ${fraseDaRecusa(primeiraRecusa[0], primeiraRecusa[1], nomeDoDestino)}`
  return {
    texto: `${feito}${sobra}`,
    mudaram: mudam.length,
    desfazer: () => {
      const { mudarVerbete } = usePreludio.getState()
      for (const [id, pai] of antes) mudarVerbete(id, (agora) => comPaiDeAntes(agora, pai))
    },
  }
}
