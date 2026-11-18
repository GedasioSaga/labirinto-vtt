import type { ItemDoCatalogo } from './acervoDeItens'

/**
 * AS PASTAS DO ACERVO DE ITENS (pedido de 18/11/2026: "organizar melhor em
 * categorias e subcategorias"; resposta do mestre: "Pastas como no
 * Prelúdio"). Puras: quem lê e grava é `lib/acervoDeItens.ts`, quem mostra é
 * `AcervoDeItensPanel`.
 *
 * - Pasta dentro de pasta em quantos níveis o mestre quiser; a pasta mora no
 *   índice (`pastas`) e o item diz em qual mora (`ItemDoCatalogo.pasta`).
 *   Sem `pasta`, ou com a de uma pasta que não existe mais, ele fica "Sem pasta".
 * - Mover recusa o laço (a pasta dentro dela mesma ou de uma das de dentro
 *   dela), como `pastaMovida` do Prelúdio (`lib/preparo/pastasDeVerbetes.ts`).
 * - O índice de antes das pastas ganha uma pasta de cima por categoria que a
 *   lista mostrava (`pastasDasCategorias`): nenhum item muda de lugar.
 */

export interface PastaDeItens {
  id: string
  nome: string
  /** A pasta de cima; ausente = em cima, fora de todas. */
  paiId?: string
  /** Fechada na lista. Gravado: continua fechada na próxima vez. */
  recolhida?: boolean
}

/** Teto do nome: é título de linha, não texto. */
export const NOME_DA_PASTA_MAX = 60
/** Teto de pastas no índice (a árvore é de uma coluna estreita). */
export const PASTAS_MAX = 300
export const PASTA_SEM_NOME = 'Pasta sem nome'

const FORMA_DO_ID = /^[A-Za-z0-9_-]{1,80}$/

export function ehIdDePasta(valor: unknown): valor is string {
  return typeof valor === 'string' && FORMA_DO_ID.test(valor)
}

export function novoIdDePasta(): string {
  return `pasta_${crypto.randomUUID()}`
}

/** O nome limpo: sem espaço nas pontas, um espaço só entre as palavras, no teto. Vazio = desistiu. */
export function nomeDaPastaLimpo(bruto: string): string {
  return [...bruto.trim().replace(/\s+/g, ' ')].slice(0, NOME_DA_PASTA_MAX).join('')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** As pastas do índice; `null` = o índice é de antes das pastas (não tem a lista). Tolerante: a torta sai, a sem nome ganha um. */
export function pastasLidas(value: unknown): PastaDeItens[] | null {
  if (!Array.isArray(value)) return null
  const vistas = new Set<string>()
  const lidas: PastaDeItens[] = []
  for (const bruta of value) {
    if (!isRecord(bruta) || !ehIdDePasta(bruta.id) || vistas.has(bruta.id)) continue
    vistas.add(bruta.id)
    const pasta: PastaDeItens = { id: bruta.id, nome: (typeof bruta.nome === 'string' ? nomeDaPastaLimpo(bruta.nome) : '') || PASTA_SEM_NOME }
    if (ehIdDePasta(bruta.paiId) && bruta.paiId !== bruta.id) pasta.paiId = bruta.paiId
    if (bruta.recolhida === true) pasta.recolhida = true
    lidas.push(pasta)
    if (lidas.length >= PASTAS_MAX) break
  }
  return lidas
}

/**
 * O índice de antes das pastas: cada categoria que a lista mostrava (a de
 * algum item) vira uma pasta de cima com o mesmo nome, e o item vai para a
 * dela. Ids fixos (`pasta_categoria_1`…): ler o mesmo arquivo duas vezes dá
 * as mesmas pastas, sem gravar nada. O item sem categoria fica Sem pasta.
 */
export function pastasDasCategorias(itens: readonly ItemDoCatalogo[]): { pastas: PastaDeItens[]; itens: ItemDoCatalogo[] } {
  const idPorCategoria = new Map<string, string>()
  const pastas: PastaDeItens[] = []
  for (const item of itens) {
    if (item.categoria === '' || idPorCategoria.has(item.categoria) || pastas.length >= PASTAS_MAX) continue
    const id = `pasta_categoria_${pastas.length + 1}`
    idPorCategoria.set(item.categoria, id)
    pastas.push({ id, nome: nomeDaPastaLimpo(item.categoria) || PASTA_SEM_NOME })
  }
  return {
    pastas,
    itens: itens.map((item) => {
      const pasta = idPorCategoria.get(item.categoria)
      return pasta === undefined ? item : { ...item, pasta }
    }),
  }
}

/**
 * O pai que vale: o de uma pasta que existe e que não faz laço. Um laço
 * gravado por fora (A dentro de B e B dentro de A) põe as pastas dele em
 * cima, em vez de sumirem da árvore.
 */
function paisQueValem(pastas: readonly PastaDeItens[]): Map<string, string | null> {
  const porId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const pais = new Map<string, string | null>()
  for (const pasta of pastas) {
    let pai: string | null = pasta.paiId !== undefined && porId.has(pasta.paiId) ? pasta.paiId : null
    const vistas = new Set([pasta.id])
    for (let acima = pai === null ? undefined : porId.get(pai); acima !== undefined; acima = acima.paiId === undefined ? undefined : porId.get(acima.paiId)) {
      if (vistas.has(acima.id)) {
        pai = null
        break
      }
      vistas.add(acima.id)
    }
    pais.set(pasta.id, pai)
  }
  return pais
}

const ORDEM_DOS_NOMES = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })

/** As pastas por pai (`null` = as de cima), cada lista por nome: "1. Armas" antes de "2. Poções", "Ácido" junto de "Arco". */
export function pastasPorPai(pastas: readonly PastaDeItens[]): Map<string | null, PastaDeItens[]> {
  const pais = paisQueValem(pastas)
  const saida = new Map<string | null, PastaDeItens[]>()
  for (const pasta of pastas) {
    const pai = pais.get(pasta.id) ?? null
    saida.set(pai, [...(saida.get(pai) ?? []), pasta])
  }
  for (const lista of saida.values()) lista.sort((a, b) => ORDEM_DOS_NOMES.compare(a.nome, b.nome))
  return saida
}

/** A pasta onde o item mora; `null` = Sem pasta (inclusive quando a pasta dele não existe mais). */
export function pastaDoItem(item: Pick<ItemDoCatalogo, 'pasta'>, ids: ReadonlySet<string>): string | null {
  return item.pasta !== undefined && ids.has(item.pasta) ? item.pasta : null
}

/** A pasta e todas as de dentro dela, em qualquer profundidade. */
export function pastaEDeDentro(pastas: readonly PastaDeItens[], id: string): Set<string> {
  const pais = paisQueValem(pastas)
  const saida = new Set([id])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const [filha, pai] of pais) {
      if (pai === null || !saida.has(pai) || saida.has(filha)) continue
      saida.add(filha)
      cresceu = true
    }
  }
  return saida
}

/** As pastas por cima desta, da de cima até a mãe dela. Vazio = está em cima. */
export function pastasAcimaDe(pastas: readonly PastaDeItens[], id: string): PastaDeItens[] {
  const pais = paisQueValem(pastas)
  const porId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const saida: PastaDeItens[] = []
  for (let pai = pais.get(id) ?? null; pai !== null; pai = pais.get(pai) ?? null) {
    const pasta = porId.get(pai)
    if (pasta === undefined) break
    saida.unshift(pasta)
  }
  return saida
}

/** Quantos itens moram em cada pasta, contando os das pastas de dentro dela (`ondeMoram` = a pasta de cada item). */
export function contasComAsDeDentro(pastas: readonly PastaDeItens[], ondeMoram: Iterable<string | null>): Map<string, number> {
  const pais = paisQueValem(pastas)
  const contas = new Map<string, number>()
  for (const id of ondeMoram) {
    for (let pasta: string | null = id; pasta !== null && pais.has(pasta); pasta = pais.get(pasta) ?? null) contas.set(pasta, (contas.get(pasta) ?? 0) + 1)
  }
  return contas
}

/** Por que a pasta não pode ir para lá. */
export type RecusaDaPasta = 'nao-existe' | 'ela-mesma' | 'dentro-dela' | 'ja-esta'

export const FRASE_DA_RECUSA: Readonly<Record<RecusaDaPasta, string>> = {
  'nao-existe': 'Essa pasta não existe mais.',
  'ela-mesma': 'Uma pasta não entra nela mesma.',
  'dentro-dela': 'Uma pasta não entra numa das pastas de dentro dela.',
  'ja-esta': 'Já está aí.',
}

/** Por que a pasta `id` não pode ir para dentro de `novoPaiId` (`null` = para o topo); `null` = pode. */
export function recusaParaMoverAPasta(pastas: readonly PastaDeItens[], id: string, novoPaiId: string | null): RecusaDaPasta | null {
  const pais = paisQueValem(pastas)
  if (!pais.has(id)) return 'nao-existe'
  const paiAgora = pais.get(id) ?? null
  if (novoPaiId === null) return paiAgora === null ? 'ja-esta' : null
  if (novoPaiId === id) return 'ela-mesma'
  if (!pais.has(novoPaiId)) return 'nao-existe'
  if (pastaEDeDentro(pastas, id).has(novoPaiId)) return 'dentro-dela'
  return paiAgora === novoPaiId ? 'ja-esta' : null
}

/** A pasta em outro pai (só ela muda: as de dentro vão junto, porque apontam para ela). Quem chama confere a recusa antes. */
export function pastaMovida(pastas: readonly PastaDeItens[], id: string, novoPaiId: string | null): PastaDeItens[] {
  return pastas.map((pasta) => {
    if (pasta.id !== id) return pasta
    const { paiId: _antes, ...semPai } = pasta
    return novoPaiId === null ? semPai : { ...semPai, paiId: novoPaiId }
  })
}

/** As pastas com esta aberta, e as de cima dela também (a que recebeu o item aparece aberta). */
export function comAbertas(pastas: readonly PastaDeItens[], id: string): PastaDeItens[] {
  const abrir = new Set([id, ...pastasAcimaDe(pastas, id).map((pasta) => pasta.id)])
  return pastas.map((pasta) => (abrir.has(pasta.id) && pasta.recolhida === true ? semRecolhida(pasta) : pasta))
}

/** A pasta fechada ou aberta na lista. */
export function comRecolhida(pastas: readonly PastaDeItens[], id: string, recolhida: boolean): PastaDeItens[] {
  return pastas.map((pasta) => (pasta.id !== id ? pasta : recolhida ? { ...pasta, recolhida: true } : semRecolhida(pasta)))
}

/** As pastas de antes com o abrir e fechar de agora: o Desfazer não fecha a pasta que o mestre abriu depois da mudança. */
export function comORecolherDeAgora(antes: readonly PastaDeItens[], agora: readonly PastaDeItens[]): PastaDeItens[] {
  const fechadaAgora = new Map(agora.map((pasta) => [pasta.id, pasta.recolhida === true]))
  return antes.map((pasta) => {
    const fechada = fechadaAgora.get(pasta.id)
    if (fechada === undefined || fechada === (pasta.recolhida === true)) return pasta
    return fechada ? { ...pasta, recolhida: true } : semRecolhida(pasta)
  })
}

function semRecolhida(pasta: PastaDeItens): PastaDeItens {
  const { recolhida: _antes, ...aberta } = pasta
  return aberta
}

/**
 * Sem a pasta: as de dentro dela e os itens dela sobem um nível (para a pasta
 * de cima dela, ou para o topo / Sem pasta). Devolve as pastas e, por item
 * que muda, a pasta nova (`undefined` = Sem pasta).
 */
export function semAPasta(pastas: readonly PastaDeItens[], itens: readonly Pick<ItemDoCatalogo, 'id' | 'pasta'>[], id: string): { pastas: PastaDeItens[]; ondeMoram: Map<string, string | undefined> } {
  const paiDela = paisQueValem(pastas).get(id) ?? null
  const restantes = pastas
    .filter((pasta) => pasta.id !== id)
    .map((pasta) => {
      if (pasta.paiId !== id) return pasta
      const { paiId: _antes, ...semPai } = pasta
      return paiDela === null ? semPai : { ...semPai, paiId: paiDela }
    })
  const ondeMoram = new Map<string, string | undefined>()
  for (const item of itens) if (item.pasta === id) ondeMoram.set(item.id, paiDela ?? undefined)
  return { pastas: restantes, ondeMoram }
}

/**
 * Onde entra o item NOVO criado pelo "+ Item" de cima (sem pasta): na pasta
 * de cima com o nome da categoria dele, criada se não houver, como a
 * categoria nova fazia um grupo novo antes das pastas. Com pasta (o "Novo
 * item aqui" de uma pasta) ou sem categoria, fica onde está.
 */
export function lugarDoItemNovo(pastas: readonly PastaDeItens[], item: ItemDoCatalogo, gerarId: () => string = novoIdDePasta): { item: ItemDoCatalogo; pastas: PastaDeItens[] } {
  const nome = nomeDaPastaLimpo(item.categoria)
  const ids = new Set(pastas.map((pasta) => pasta.id))
  if (pastaDoItem(item, ids) !== null || nome === '') return { item, pastas: [...pastas] }
  const chave = nome.toLocaleLowerCase('pt-BR')
  const deCima = pastasPorPai(pastas).get(null) ?? []
  const achada = deCima.find((pasta) => pasta.nome.toLocaleLowerCase('pt-BR') === chave)
  if (achada !== undefined) return { item: { ...item, pasta: achada.id }, pastas: [...pastas] }
  if (pastas.length >= PASTAS_MAX) return { item, pastas: [...pastas] }
  const nova: PastaDeItens = { id: gerarId(), nome }
  return { item: { ...item, pasta: nova.id }, pastas: [...pastas, nova] }
}
