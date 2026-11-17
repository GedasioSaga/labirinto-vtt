import { compararTitulos, idNovo } from './enciclopedia'
import { estaNaLixeira } from './lixeira'
import type { IndiceDoPreparo, PastaDeVerbetes, TipoDeVerbete, Verbete } from './tipos'

/**
 * AS PASTAS DOS VERBETES (E3, pedido de 16/11: "os personagens têm que estar
 * nas pastas deles"), puras: quem lê e grava é `preludio/estado/preludio.ts`.
 *
 * - O verbete que veio do Grimório traz `organizacao` (os nomes das pastas
 *   onde morava). Sem `pastaId`, ele mora na pasta que esses nomes descrevem,
 *   com um id fixo (`g:…`): a pasta aparece sem que nada seja gravado, e o
 *   arquivo antigo abre igual.
 * - O Grimório que tinha 3 níveis chega como "NPCS" com a subpasta
 *   "Npc Neutros/Aliados › Bandidos" (o id derivado não muda com o tempo).
 * - Pasta dentro de pasta em quantos níveis o mestre quiser (pedido de 17/11:
 *   "pôr uma pasta dentro da outra com facilidade e desfazer com facilidade"):
 *   `pastaMovida` muda o pai e recusa o laço (a pasta dentro dela mesma ou de
 *   uma das de dentro dela).
 * - Antes de mudar qualquer pasta, a tela guarda no índice as pastas do tipo
 *   (`pastasDoTipo`): assim a pasta do Grimório renomeada ou movida fica como
 *   o mestre deixou, e a que ficou vazia não some.
 */

/** "Sem pasta" de propósito no `Verbete.pastaId` (o verbete tem `organizacao`, mas o mestre o tirou da pasta). */
export const SEM_PASTA = ''

/** Teto do nome da pasta: é título de linha, não texto. */
export const NOME_DA_PASTA_MAX = 60

const PREFIXO_DO_GRIMORIO = 'g:'
const SEPARADOR_DA_SUBPASTA = ' › '

/** Os nomes do `organizacao` que são texto de verdade (o campo veio do disco como lista de qualquer coisa). */
function nomesDoGrimorio(verbete: Verbete): string[] {
  const nomes: string[] = []
  for (const nome of verbete.organizacao ?? []) if (typeof nome === 'string' && nome.trim() !== '') nomes.push(nome.trim())
  return nomes
}

/** A pasta e a subpasta que os nomes descrevem. O `encodeURIComponent` tira a `/` do nome ("Npc Neutros/Aliados") de perto do separador. */
function pastasDosNomes(tipo: TipoDeVerbete, nomes: readonly string[]): PastaDeVerbetes[] {
  const [deCima, ...resto] = nomes
  if (deCima === undefined) return []
  const cima: PastaDeVerbetes = { id: `${PREFIXO_DO_GRIMORIO}${tipo}:${encodeURIComponent(deCima)}`, nome: deCima, tipo }
  if (resto.length === 0) return [cima]
  const nomeDaSub = resto.join(SEPARADOR_DA_SUBPASTA)
  return [cima, { id: `${cima.id}/${encodeURIComponent(nomeDaSub)}`, nome: nomeDaSub, tipo, paiId: cima.id }]
}

/** O id da pasta que o `organizacao` descreve; `null` = o verbete não morava em pasta. */
export function idDaPastaDoGrimorio(verbete: Verbete): string | null {
  const pastas = pastasDosNomes(verbete.tipo, nomesDoGrimorio(verbete))
  return pastas[pastas.length - 1]?.id ?? null
}

/** A pasta saiu do `organizacao` (o pontinho "veio do Grimório" da lista). */
export function veioDoGrimorio(pasta: PastaDeVerbetes): boolean {
  return pasta.id.startsWith(PREFIXO_DO_GRIMORIO)
}

/**
 * As pastas do tipo: as do índice e, depois, as do Grimório que nenhum
 * verbete tirou dali. A do Grimório que o mestre apagou não volta: os
 * verbetes dela ganharam `pastaId` ao sair, e a subpasta que ficou foi para o
 * índice sem a de cima. O verbete na Lixeira não faz pasta do Grimório
 * aparecer (ela ficaria vazia na tela); restaurado, a pasta volta com ele.
 */
export function pastasDoTipo(guardadas: readonly PastaDeVerbetes[], verbetes: Iterable<Verbete>, tipo: TipoDeVerbete): PastaDeVerbetes[] {
  const saida = guardadas.filter((pasta) => pasta.tipo === tipo)
  const ids = new Set(saida.map((pasta) => pasta.id))
  for (const verbete of verbetes) {
    if (verbete.tipo !== tipo || verbete.pastaId !== undefined || estaNaLixeira(verbete)) continue
    const dele = pastasDosNomes(tipo, nomesDoGrimorio(verbete))
    const ondeMora = dele[dele.length - 1]
    // A pasta dele já está no índice: o que está lá manda (inclusive a subpasta que virou pasta de cima).
    if (ondeMora === undefined || ids.has(ondeMora.id)) continue
    for (const pasta of dele) {
      if (ids.has(pasta.id)) continue
      ids.add(pasta.id)
      saida.push(pasta)
    }
  }
  return saida
}

/** A pasta onde o verbete mora agora; `null` = Sem pasta (inclusive quando a pasta dele não existe mais). */
export function pastaDoVerbete(verbete: Verbete, idsDasPastas: ReadonlySet<string>): string | null {
  const id = verbete.pastaId !== undefined ? verbete.pastaId : idDaPastaDoGrimorio(verbete)
  return id !== null && id !== SEM_PASTA && idsDasPastas.has(id) ? id : null
}

/**
 * O verbete na pasta (`null` = Sem pasta). Voltar à pasta que o `organizacao`
 * descreve tira o campo: o arquivo fica como era antes de qualquer mudança.
 * Já está lá: devolve o mesmo objeto (nada a gravar).
 */
export function comPasta(verbete: Verbete, pastaId: string | null): Verbete {
  const doGrimorio = idDaPastaDoGrimorio(verbete)
  const { pastaId: _antes, ...semPasta } = verbete
  const novo: Verbete = pastaId === doGrimorio ? semPasta : { ...semPasta, pastaId: pastaId ?? SEM_PASTA }
  return novo.pastaId === verbete.pastaId ? verbete : novo
}

/** O `pastaId` como estava (para o Desfazer): `undefined` tira o campo. */
export function comPastaIdComoEstava(verbete: Verbete, pastaId: string | undefined): Verbete {
  if (verbete.pastaId === pastaId) return verbete
  const { pastaId: _antes, ...semPasta } = verbete
  return pastaId === undefined ? semPasta : { ...semPasta, pastaId }
}

/** Uma linha da árvore: a pasta e o nível (0 = de cima, 1 = dentro dela, 2 = dentro desta…). */
export interface PastaNaArvore {
  readonly pasta: PastaDeVerbetes
  readonly nivel: number
}

/** O pai que vale: o `paiId` de uma pasta que existe; o que aponta para pasta apagada conta como "em cima". */
function paiQueVale(pasta: PastaDeVerbetes, ids: ReadonlySet<string>): string | null {
  return pasta.paiId !== undefined && ids.has(pasta.paiId) ? pasta.paiId : null
}

/**
 * As pastas em ordem de árvore, em quantos níveis houver: as de cima por nome
 * ("1.Almirante" antes de "2.Vice-Almirante") e, embaixo de cada uma, as de
 * dentro dela. A pasta cuja pasta de cima não existe mais aparece em cima; um
 * laço gravado por fora (A dentro de B e B dentro de A) também entra em cima,
 * pela primeira dele, em vez de sumir.
 */
export function arvoreDasPastas(pastas: readonly PastaDeVerbetes[]): PastaNaArvore[] {
  const ids = new Set(pastas.map((pasta) => pasta.id))
  const porNome = (a: PastaDeVerbetes, b: PastaDeVerbetes) => compararTitulos(a.nome, b.nome)
  const filhas = new Map<string, PastaDeVerbetes[]>()
  for (const pasta of pastas) {
    const pai = paiQueVale(pasta, ids)
    if (pai !== null) filhas.set(pai, [...(filhas.get(pai) ?? []), pasta])
  }
  const saida: PastaNaArvore[] = []
  const vistas = new Set<string>()
  const descer = (pasta: PastaDeVerbetes, nivel: number) => {
    if (vistas.has(pasta.id)) return
    vistas.add(pasta.id)
    saida.push({ pasta, nivel })
    for (const filha of (filhas.get(pasta.id) ?? []).sort(porNome)) descer(filha, nivel + 1)
  }
  for (const pasta of pastas.filter((uma) => paiQueVale(uma, ids) === null).sort(porNome)) descer(pasta, 0)
  for (const pasta of [...pastas].sort(porNome)) descer(pasta, 0)
  return saida
}

/** A pasta e todas as de dentro dela, em qualquer profundidade (a contagem e o filtro de uma pasta incluem as de dentro). */
export function pastaEDeDentro(pastas: readonly PastaDeVerbetes[], id: string): Set<string> {
  const saida = new Set([id])
  let cresceu = true
  while (cresceu) {
    cresceu = false
    for (const pasta of pastas) {
      if (pasta.paiId === undefined || !saida.has(pasta.paiId) || saida.has(pasta.id)) continue
      saida.add(pasta.id)
      cresceu = true
    }
  }
  return saida
}

/** As pastas por cima desta, da de cima até a mãe dela ("Marinha", "3.Capitães"). Vazio = está em cima. */
export function pastasAcimaDe(pastas: readonly PastaDeVerbetes[], id: string): PastaDeVerbetes[] {
  const porId = new Map(pastas.map((pasta) => [pasta.id, pasta]))
  const saida: PastaDeVerbetes[] = []
  const vistas = new Set([id])
  let pai = porId.get(id)?.paiId
  while (pai !== undefined && !vistas.has(pai)) {
    const pasta = porId.get(pai)
    if (pasta === undefined) break
    vistas.add(pai)
    saida.unshift(pasta)
    pai = pasta.paiId
  }
  return saida
}

/** Quantos moram em cada pasta, contando os das pastas de dentro dela (`ondeMoram` = a pasta de cada um). */
export function contasComAsDeDentro(pastas: readonly PastaDeVerbetes[], ondeMoram: Iterable<string>): Map<string, number> {
  const paiDe = new Map(pastas.map((pasta) => [pasta.id, pasta.paiId]))
  const contas = new Map<string, number>()
  for (const id of ondeMoram) {
    const vistas = new Set<string>()
    for (let pasta: string | undefined = id; pasta !== undefined && paiDe.has(pasta) && !vistas.has(pasta); pasta = paiDe.get(pasta)) {
      vistas.add(pasta)
      contas.set(pasta, (contas.get(pasta) ?? 0) + 1)
    }
  }
  return contas
}

/** Por que a pasta não pode ir para lá. */
export type RecusaDaPasta = 'nao-existe' | 'ela-mesma' | 'dentro-dela' | 'outro-tipo' | 'ja-esta'

/**
 * Por que a pasta `id` não pode ir para dentro de `novoPaiId` (`null` = para
 * cima, fora de todas); `null` = pode. O laço é recusado: a pasta dentro dela
 * mesma ou de uma das de dentro dela sumiria da árvore.
 */
export function recusaParaMoverAPasta(pastas: readonly PastaDeVerbetes[], id: string, novoPaiId: string | null): RecusaDaPasta | null {
  const pasta = pastas.find((uma) => uma.id === id)
  if (pasta === undefined) return 'nao-existe'
  const paiAgora = paiQueVale(pasta, new Set(pastas.map((uma) => uma.id)))
  if (novoPaiId === null) return paiAgora === null ? 'ja-esta' : null
  if (novoPaiId === id) return 'ela-mesma'
  const pai = pastas.find((uma) => uma.id === novoPaiId)
  if (pai === undefined) return 'nao-existe'
  if (pai.tipo !== pasta.tipo) return 'outro-tipo'
  if (pastaEDeDentro(pastas, id).has(novoPaiId)) return 'dentro-dela'
  return paiAgora === novoPaiId ? 'ja-esta' : null
}

/** A pasta movida (só ela muda; as de dentro vão junto, porque apontam para ela) e onde estava, para o Desfazer. */
export type PastaMovida = { readonly t: 'movida'; readonly pastas: PastaDeVerbetes[]; readonly paiAntes: string | null } | { readonly t: 'recusada'; readonly recusa: RecusaDaPasta }

export function pastaMovida(pastas: readonly PastaDeVerbetes[], id: string, novoPaiId: string | null): PastaMovida {
  const recusa = recusaParaMoverAPasta(pastas, id, novoPaiId)
  const movida = pastas.find((pasta) => pasta.id === id)
  if (recusa !== null || movida === undefined) return { t: 'recusada', recusa: recusa ?? 'nao-existe' }
  const { paiId: _antes, ...semPai } = movida
  const nova: PastaDeVerbetes = novoPaiId === null ? semPai : { ...semPai, paiId: novoPaiId }
  const paiAntes = paiQueVale(movida, new Set(pastas.map((pasta) => pasta.id)))
  return { t: 'movida', pastas: pastas.map((pasta) => (pasta.id === id ? nova : pasta)), paiAntes }
}

/** O nome limpo: sem espaço nas pontas e no teto. Vazio = desistiu. */
export function nomeDaPastaLimpo(bruto: string): string {
  return bruto.trim().replace(/\s+/g, ' ').slice(0, NOME_DA_PASTA_MAX)
}

export function pastaNova(tipo: TipoDeVerbete, nome: string, paiId?: string, gerarId: (prefixo: string) => string = idNovo): PastaDeVerbetes {
  const pasta: PastaDeVerbetes = { id: gerarId('pa'), nome, tipo }
  if (paiId !== undefined) pasta.paiId = paiId
  return pasta
}

/** Sem a pasta: as subpastas dela sobem (vão para a pasta de cima dela ou viram pasta de cima). Os verbetes, quem chama move. */
export function semAPasta(pastas: readonly PastaDeVerbetes[], id: string): PastaDeVerbetes[] {
  const apagada = pastas.find((pasta) => pasta.id === id)
  if (apagada === undefined) return [...pastas]
  return pastas
    .filter((pasta) => pasta.id !== id)
    .map((pasta) => {
      if (pasta.paiId !== id) return pasta
      const { paiId: _antes, ...semPai } = pasta
      return apagada.paiId === undefined ? semPai : { ...semPai, paiId: apagada.paiId }
    })
}

export function renomeada(pastas: readonly PastaDeVerbetes[], id: string, nome: string): PastaDeVerbetes[] {
  return pastas.map((pasta) => (pasta.id === id ? { ...pasta, nome } : pasta))
}

/** O índice com as pastas deste tipo trocadas; as dos outros tipos ficam. */
export function indiceComAsPastas(indice: IndiceDoPreparo, todas: readonly PastaDeVerbetes[]): IndiceDoPreparo {
  return todas.length === 0 && indice.pastas === undefined ? indice : { ...indice, pastas: [...todas] }
}

/** Todas as pastas com as deste tipo trocadas. */
export function comAsPastasDoTipo(todas: readonly PastaDeVerbetes[], tipo: TipoDeVerbete, doTipo: readonly PastaDeVerbetes[]): PastaDeVerbetes[] {
  return [...todas.filter((pasta) => pasta.tipo !== tipo), ...doTipo]
}

/** Criado ou mexido por último, em ms: as datas do Grimório e, no criado aqui, a hora que mora no id (`idNovo`). 0 = sem data. */
export function momentoDoVerbete(verbete: Verbete): number {
  for (const chave of ['modificadoEm', 'criadoEm']) {
    const data = verbete.extras?.[chave]
    const ms = typeof data === 'number' ? data : typeof data === 'string' ? Date.parse(data) : Number.NaN
    if (Number.isFinite(ms)) return ms
  }
  const hora = /^[a-z]+-([0-9a-z]+)-/.exec(verbete.id)?.[1]
  const ms = hora === undefined ? Number.NaN : Number.parseInt(hora, 36)
  return Number.isFinite(ms) ? ms : 0
}
