import { hashDoQuadro } from '../../lib/preparo/importar/reimportar'
import type { Quadro } from '../../lib/preparo/tipos'

/**
 * A GRAVAÇÃO DO QUADRO ABERTO (fatia F3a). O que vai ao disco é montado na
 * hora de gravar: a foto do tldraw e o nome de agora, o resto como abriu.
 *
 * - Sem mudança líquida desde a abertura (o mestre arrastou e deu Ctrl+Z), o
 *   arquivo não é tocado. A foto de agora nunca é igual à do arquivo importado:
 *   traz o esquema do Prelúdio, as migrações dos cartões e o `meta.midia` das
 *   imagens. Gravá-la mudaria o hash, e a reimportação daria o quadro como
 *   editado no Prelúdio, como se o mestre tivesse mexido. "Mudou" é o que a
 *   reimportação diz (`hashDoQuadro`, que ignora a vista). Se uma mudança já
 *   tinha ido ao disco, o quadro como abriu volta para lá.
 * - Uma gravação por quadro de cada vez, na ordem em que foram pedidas: o hash
 *   é assíncrono, e a foto velha não pode chegar ao disco depois da nova.
 */

export interface OpcoesDoGravador {
  readonly id: string
  /** O quadro como abriu: o do disco, ou o que o disco recusou da última vez. */
  readonly quadro: Quadro
  /** O arquivo tem exatamente `quadro`. Falso quando `quadro` é o que o disco recusou. */
  readonly noDisco: boolean
  /** A foto do tldraw de agora (`getSnapshot`). */
  readonly foto: () => unknown
  /** O nome de agora. */
  readonly nome: () => string
  readonly gravarNoDisco: (quadro: Quadro) => Promise<void>
}

export interface GravadorDoQuadro {
  /** Guarda o que o mestre vê ao abrir, com o tldraw já montado: a base do "nada mudou". */
  marcarAbertura: () => void
  /** Grava. Devolve o que foi ao disco, ou `null` quando nada mudou e o arquivo ficou como estava. */
  gravar: () => Promise<Quadro | null>
}

/** A última gravação pedida de cada quadro, aberto ou já fechado: a próxima espera por ela. */
const filas = new Map<string, Promise<unknown>>()

function naFila<T>(id: string, tarefa: () => Promise<T>): Promise<T> {
  const vez = (filas.get(id) ?? Promise.resolve()).then(tarefa)
  const fim = vez.catch(() => undefined)
  filas.set(id, fim)
  void fim.then(() => {
    if (filas.get(id) === fim) filas.delete(id)
  })
  return vez
}

export function criarGravadorDoQuadro({ id, quadro, noDisco, foto, nome, gravarNoDisco }: OpcoesDoGravador): GravadorDoQuadro {
  /** O hash do quadro ao abrir; `null` (sem abertura marcada, ou sem hash) faz toda gravação ir ao disco. */
  let base: Promise<string | null> = Promise.resolve(null)
  let discoComOQueAbriu = noDisco

  const igualAoQueAbriu = async (agora: Quadro): Promise<boolean> => {
    const daAbertura = await base
    if (daAbertura === null) return false
    try {
      return (await hashDoQuadro(agora)) === daAbertura
    } catch {
      // Sem hash para comparar, grava: na dúvida, o que o mestre vê vai para o disco.
      return false
    }
  }

  const gravarUmaVez = async (): Promise<Quadro | null> => {
    const agora: Quadro = { ...quadro, nome: nome(), tldraw: foto() }
    const semMudanca = await igualAoQueAbriu(agora)
    if (semMudanca && discoComOQueAbriu) return null
    const novo = semMudanca ? quadro : agora
    // Até o disco responder, não se sabe o que ficou lá.
    discoComOQueAbriu = false
    await gravarNoDisco(novo)
    discoComOQueAbriu = semMudanca
    return novo
  }

  return {
    marcarAbertura() {
      try {
        base = hashDoQuadro({ ...quadro, tldraw: foto() }).catch(() => null)
      } catch {
        base = Promise.resolve(null)
      }
    },
    gravar: () => naFila(id, gravarUmaVez),
  }
}
