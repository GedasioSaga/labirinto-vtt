import { segmentoValido } from '../../lib/nuvem/caminho'

/**
 * O `clienteId` DESTA ABA. Para o servidor, cada aba é um aparelho: a
 * autoria que decide o conflito é `clienteId` + conta (§5.2, `conflito.ts`).
 * Com o mesmo `clienteId` em duas abas, a mudança velha de uma (feita sem
 * rede e reenviada depois) passaria por cima da nova da outra sem aviso; com
 * um por aba, as duas se avisam como o celular e o PC da mesma pessoa (§5.7).
 * O envelope da op (§4.6) dizia "um por navegador+conta"; a §5.6 ("duas abas
 * não se atropelam") e a §5.7 pedem o aviso, e é por isso que ele é por aba.
 *
 * Mora no `sessionStorage`: sobrevive ao recarregar a mesma aba (as ops dela
 * que estão na fila e as novas saem do mesmo aparelho, em sequência, sem
 * conflito consigo mesma) e não passa para as outras. A exceção é a aba
 * DUPLICADA, que herda uma cópia do `sessionStorage`: por isso cada aba segura
 * uma trava (Web Locks) com o nome do seu id enquanto está aberta, e a que
 * achar o id já travado por outra aba viva gera um novo.
 *
 * Na dúvida, o id é novo: o pior caso de um id novo é um aviso de conflito a
 * mais (visível); o de um id repetido é uma mudança apagada em silêncio.
 */

const CHAVE_DA_ABA = 'labirinto-lobby:aba'
const PREFIXO_DA_TRAVA = 'labirinto-lobby:aba:'

/** O que a aba oferece. Cada peça pode faltar: armazenamento bloqueado, navegador sem Web Locks. */
export interface AmbienteDaAba {
  /** O `sessionStorage`; `null` = bloqueado ou indisponível. */
  guarda: Pick<Storage, 'getItem' | 'setItem'> | null
  /** O `navigator.locks`; `null` = o navegador não tem Web Locks. */
  travas: Pick<LockManager, 'request'> | null
  novoId(): string
}

function lerDaGuarda(guarda: AmbienteDaAba['guarda']): string | null {
  if (guarda === null) return null
  try {
    const guardado = guarda.getItem(CHAVE_DA_ABA)
    return segmentoValido(guardado) ? guardado : null
  } catch {
    return null
  }
}

function gravarNaGuarda(guarda: AmbienteDaAba['guarda'], clienteId: string): void {
  if (guarda === null) return
  try {
    guarda.setItem(CHAVE_DA_ABA, clienteId)
  } catch {
    // Cota cheia ou bloqueado: o id vale até esta página recarregar, e a próxima gera outro (aviso a mais, nunca perda).
  }
}

/**
 * Tenta travar o id para esta aba até ela fechar ou recarregar (o navegador
 * solta sozinho). `true` = o id é desta aba; `false` = outra aba viva o tem.
 * Sem Web Locks, ou com o pedido recusado, não há como saber: vale o id.
 */
function segurar(travas: AmbienteDaAba['travas'], clienteId: string): Promise<boolean> {
  if (travas === null) return Promise.resolve(true)
  return new Promise((resolve) => {
    travas
      .request(PREFIXO_DA_TRAVA + clienteId, { ifAvailable: true }, (trava) => {
        resolve(trava !== null)
        // A promessa que nunca termina é o que mantém a trava presa a esta aba.
        return trava === null ? undefined : new Promise<never>(() => undefined)
      })
      .catch(() => resolve(true))
  })
}

export async function clienteIdDaAba(ambiente: AmbienteDaAba): Promise<string> {
  const guardado = lerDaGuarda(ambiente.guarda)
  if (guardado !== null && (await segurar(ambiente.travas, guardado))) return guardado
  const novo = ambiente.novoId()
  // Id recém-criado, ninguém mais o tem: a trava é para a aba que for duplicada DESTA depois.
  await segurar(ambiente.travas, novo)
  gravarNaGuarda(ambiente.guarda, novo)
  return novo
}
