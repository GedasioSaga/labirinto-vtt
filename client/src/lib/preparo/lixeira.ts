import type { TipoDeVerbete, Verbete } from './tipos'

/**
 * A LIXEIRA DOS VERBETES (pedido de 17/11: "bote a opção de excluir o local";
 * o mestre escolheu "Lixeira + Desfazer", como nos Quadros).
 *
 * - Excluir não apaga nada: o verbete ganha `lixeira` (a data) e continua no
 *   disco, inteiro. As listas, a busca, as escolhas e o pacote do jogador
 *   passam a deixá-lo de fora (`estaNaLixeira`, `vivos`, `soOsVivos`).
 * - O que já aponta para ele (cartão de quadro, menção, evento da linha do
 *   tempo, pino) continua apontando: o verbete ainda existe, só está guardado.
 * - LUGAR DENTRO DE LUGAR: o que estava dentro de um lugar excluído sobe um
 *   nível (o `paiId` passa a ser o lugar vivo mais perto acima), e guarda em
 *   `paiNaLixeira` de onde saiu. Restaurar devolve cada um ao seu lugar. Regra
 *   única, conferida a cada plano (`assentar`):
 *     - na Lixeira: `paiId` = o lugar de cima de verdade, sem `paiNaLixeira`;
 *     - vivo: `paiId` = o lugar vivo mais perto acima; `paiNaLixeira` = o de
 *       cima de verdade, só enquanto ele estiver na Lixeira.
 * - "Apagar de vez" tira o arquivo (quem faz é a tela); aqui só o plano do que
 *   precisa mudar nos outros para ninguém ficar apontando para o vazio.
 *
 * Nada aqui grava: cada plano devolve os verbetes como ficam, e a tela os
 * passa à loja do Prelúdio (`mudarVerbete`), que grava sozinha.
 */

/** Os tipos que a tela deixa excluir. Página e sessão ficam de fora: levam junto o caderno, o quadro e a sessão em jogo. */
export const TIPOS_QUE_VAO_PARA_A_LIXEIRA: readonly TipoDeVerbete[] = ['personagem', 'lugar', 'item', 'faccao']

interface ComLixeira {
  readonly lixeira?: string
}

export function estaNaLixeira(verbete: ComLixeira | undefined): boolean {
  return verbete?.lixeira !== undefined
}

/** Só os que não estão na Lixeira, na mesma ordem. */
export function vivos<T extends ComLixeira>(verbetes: Iterable<T>): T[] {
  const saida: T[] = []
  for (const verbete of verbetes) if (!estaNaLixeira(verbete)) saida.push(verbete)
  return saida
}

const vivosGuardados = new WeakMap<ReadonlyMap<string, Verbete>, ReadonlyMap<string, Verbete>>()

/**
 * O mapa sem os da Lixeira, para quem lista ou procura. O mesmo mapa de entrada
 * devolve sempre o mesmo de saída (serve de dependência de `useMemo`); sem
 * ninguém na Lixeira, é o próprio mapa.
 */
export function soOsVivos(verbetes: ReadonlyMap<string, Verbete>): ReadonlyMap<string, Verbete> {
  const guardado = vivosGuardados.get(verbetes)
  if (guardado !== undefined) return guardado
  let algum = false
  for (const verbete of verbetes.values()) {
    if (!estaNaLixeira(verbete)) continue
    algum = true
    break
  }
  const saida = algum ? new Map([...verbetes].filter(([, verbete]) => !estaNaLixeira(verbete))) : verbetes
  vivosGuardados.set(verbetes, saida)
  return saida
}

/** Os que estão na Lixeira, o excluído por último primeiro (data que não se lê vai para o fim). */
export function naLixeira(verbetes: Iterable<Verbete>): Verbete[] {
  const saida: Verbete[] = []
  for (const verbete of verbetes) if (estaNaLixeira(verbete)) saida.push(verbete)
  const instante = (verbete: Verbete) => {
    const lido = Date.parse(verbete.lixeira ?? '')
    return Number.isNaN(lido) ? -Infinity : lido
  }
  return saida.sort((a, b) => instante(b) - instante(a) || a.titulo.localeCompare(b.titulo, 'pt-BR'))
}

// ─── Lugar dentro de lugar ───────────────────────────────────────────────────

/** Subir mais que isto é laço feito à mão no arquivo. */
const SUBIDA_MAXIMA = 64

/** O lugar de cima de verdade: o guardado, enquanto ele está na Lixeira; senão o `paiId`. */
export function paiDeVerdade(verbete: Verbete): string | undefined {
  return verbete.paiNaLixeira ?? verbete.paiId
}

function comOsPais(verbete: Verbete, paiId: string | undefined, paiNaLixeira: string | undefined): Verbete {
  if (verbete.paiId === paiId && verbete.paiNaLixeira === paiNaLixeira) return verbete
  const { paiId: _pai, paiNaLixeira: _guardado, ...semPais } = verbete
  return { ...semPais, ...(paiId === undefined ? {} : { paiId }), ...(paiNaLixeira === undefined ? {} : { paiNaLixeira }) }
}

/** O primeiro vivo subindo a partir de `id` (ele mesmo, se estiver vivo); `undefined` = não há (acabou, sumiu ou laço). */
function vivoMaisPerto(id: string | undefined, verbetes: ReadonlyMap<string, Verbete>): string | undefined {
  const vistos = new Set<string>()
  let atual = id
  while (atual !== undefined && !vistos.has(atual) && vistos.size < SUBIDA_MAXIMA) {
    vistos.add(atual)
    const verbete = verbetes.get(atual)
    if (verbete === undefined) return undefined
    if (!estaNaLixeira(verbete)) return atual
    atual = paiDeVerdade(verbete)
  }
  return undefined
}

/** O verbete vivo com o `paiId` e o `paiNaLixeira` que a regra pede, dado quem está na Lixeira agora. Sem mudança, o mesmo objeto. */
function assentar(verbete: Verbete, verbetes: ReadonlyMap<string, Verbete>): Verbete {
  const deVerdade = paiDeVerdade(verbete)
  const pai = deVerdade === undefined ? undefined : verbetes.get(deVerdade)
  // Sem lugar de cima, ou ele não existe mais: fica onde está, sem nada guardado.
  if (deVerdade === undefined || pai === undefined) return comOsPais(verbete, verbete.paiId, undefined)
  if (!estaNaLixeira(pai)) return comOsPais(verbete, deVerdade, undefined)
  return comOsPais(verbete, vivoMaisPerto(paiDeVerdade(pai), verbetes), deVerdade)
}

// ─── Os planos ───────────────────────────────────────────────────────────────

export type RecusaDaLixeira = 'so-leitura' | 'tipo'

export interface PlanoDaLixeira {
  /** Os verbetes como ficam, por id: os que entram (ou saem) e os que mudam de lugar de cima por causa disso. */
  readonly mudancas: ReadonlyMap<string, Verbete>
  /** Os que entram na Lixeira (ou saem dela), como ficam. */
  readonly alvos: readonly Verbete[]
  /** Os que não podem, com o porquê. */
  readonly recusados: readonly (readonly [Verbete, RecusaDaLixeira])[]
}

/** Aplica as trocas e põe cada vivo no lugar que a regra pede. O que abre só para leitura não muda. */
function planejar(
  verbetes: ReadonlyMap<string, Verbete>,
  trocas: ReadonlyMap<string, Verbete>,
  soLeitura: ReadonlyMap<string, string>,
  semEstes: ReadonlySet<string> = new Set(),
): Map<string, Verbete> {
  const depois = new Map(verbetes)
  for (const id of semEstes) depois.delete(id)
  for (const [id, verbete] of trocas) depois.set(id, verbete)
  const mudancas = new Map(trocas)
  for (const verbete of depois.values()) {
    if (estaNaLixeira(verbete) || soLeitura.has(verbete.id)) continue
    const assentado = assentar(verbete, depois)
    if (assentado !== verbete) mudancas.set(verbete.id, assentado)
  }
  return mudancas
}

/**
 * Excluir: `ids` vão para a Lixeira em `quando` (ISO). Quem já está lá é
 * ignorado. O que estava dentro de um lugar excluído sobe um nível.
 */
export function planoDeMandarParaALixeira(
  ids: readonly string[],
  verbetes: ReadonlyMap<string, Verbete>,
  quando: string,
  soLeitura: ReadonlyMap<string, string> = new Map(),
): PlanoDaLixeira {
  const trocas = new Map<string, Verbete>()
  const recusados: (readonly [Verbete, RecusaDaLixeira])[] = []
  for (const id of new Set(ids)) {
    const verbete = verbetes.get(id)
    if (verbete === undefined || estaNaLixeira(verbete)) continue
    if (soLeitura.has(id)) recusados.push([verbete, 'so-leitura'])
    else if (!TIPOS_QUE_VAO_PARA_A_LIXEIRA.includes(verbete.tipo)) recusados.push([verbete, 'tipo'])
    // Na Lixeira, o `paiId` volta a ser o lugar de cima de verdade.
    else trocas.set(id, { ...comOsPais(verbete, paiDeVerdade(verbete), undefined), lixeira: quando })
  }
  return { mudancas: planejar(verbetes, trocas, soLeitura), alvos: [...trocas.values()], recusados }
}

/** Restaurar (e o Desfazer do Excluir): `ids` saem da Lixeira, e o que tinha saído de dentro deles volta. */
export function planoDeRestaurar(ids: readonly string[], verbetes: ReadonlyMap<string, Verbete>, soLeitura: ReadonlyMap<string, string> = new Map()): PlanoDaLixeira {
  const trocas = new Map<string, Verbete>()
  const recusados: (readonly [Verbete, RecusaDaLixeira])[] = []
  for (const id of new Set(ids)) {
    const verbete = verbetes.get(id)
    if (verbete === undefined || !estaNaLixeira(verbete)) continue
    if (soLeitura.has(id)) {
      recusados.push([verbete, 'so-leitura'])
      continue
    }
    const { lixeira: _desde, ...vivo } = verbete
    trocas.set(id, vivo)
  }
  const mudancas = planejar(verbetes, trocas, soLeitura)
  return { mudancas, alvos: [...trocas.keys()].flatMap((id) => mudancas.get(id) ?? []), recusados }
}

/**
 * "Apagar de vez" um verbete da Lixeira: o que muda nos OUTROS para ninguém
 * ficar pendurado nele. Quem tinha saído de dentro dele fica onde está (ou
 * passa a esperar o lugar de cima dele, se esse também está na Lixeira).
 * `null` = não dá: ele não está na Lixeira.
 */
export function planoDeApagarDeVez(id: string, verbetes: ReadonlyMap<string, Verbete>, soLeitura: ReadonlyMap<string, string> = new Map()): ReadonlyMap<string, Verbete> | null {
  const apagado = verbetes.get(id)
  if (apagado === undefined || !estaNaLixeira(apagado)) return null
  const acima = paiDeVerdade(apagado)
  const trocas = new Map<string, Verbete>()
  for (const verbete of verbetes.values()) {
    if (verbete.id === id || paiDeVerdade(verbete) !== id || soLeitura.has(verbete.id)) continue
    // Na Lixeira, o de cima de verdade mora no `paiId`; vivo, no `paiNaLixeira` (o `planejar` resolve se ele está vivo).
    const paiVivo = verbete.paiId === id ? undefined : verbete.paiId
    trocas.set(verbete.id, estaNaLixeira(verbete) ? comOsPais(verbete, acima, undefined) : comOsPais(verbete, paiVivo, acima))
  }
  return planejar(verbetes, trocas, soLeitura, new Set([id]))
}
