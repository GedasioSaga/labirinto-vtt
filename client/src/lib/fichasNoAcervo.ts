import type { Personagem } from './personagem'
import { grupoDaFicha, NOME_DO_GRUPO, pastaDaFicha, raizDaCopia, textoDeBusca, type LinhaDeFicha, type PastaDeFichas } from './pastasDeFichas'
import type { PastaDoAcervo } from './tokenLibrary'

/**
 * NPCs NO ACERVO (pedido de 21/11/2026: "do lado direito eu não quero ter os
 * npcs com fichas eu quero eles aqui [Acervo de tokens]"). Plano aprovado em
 * docs/design/acervo/NOTAS.md. Tudo aqui é conta pura, sem disco nem store.
 *
 * A FICHA NÃO MUDA DE LUGAR: continua em `personagens[]` do dono das fichas
 * (o `rpg.json` da pasta de mapas, ou o `adventure.json`). O acervo só a
 * MOSTRA numa pasta, e o lugar dela mora num mapa novo do mesmo dono,
 * `fichasNoAcervo` (ficha → pasta do acervo). A cópia (`combate.modeloId`)
 * nunca tem entrada: anda embaixo do modelo.
 */

/** Onde a ficha aparece no acervo. */
export interface LugarDaFicha {
  /** `id` da pasta do acervo; `null` = Sem pasta. */
  pasta: string | null
  /**
   * O nome da pasta e o da mãe dela: noutro PC (ou depois do Lobby) o `id` da
   * pasta é outro, e a ficha volta para a pasta de mesmo nome dentro da mesma
   * mãe. O app nunca cria pasta sozinho ao abrir noutro PC.
   */
  nomeDaPasta?: string
  nomeDaMae?: string
  /** `id` da peça do acervo de onde a ficha nasceu (decisão 9: a 2ª vez faz cópia dela, não ficha nova). */
  daPeca?: string
}

export type LugaresDasFichas = Readonly<Record<string, LugarDaFicha>>

/** A pasta padrão onde toda ficha de NPC sem lugar aparece (`id` fixo de `lib/tokenLibrary.ts`). */
export const ID_DA_PASTA_NPCS = 'npcs'

const ID_MAX = 200
const NOME_MAX = 80
/** Mais entradas que isso é arquivo mexido à mão. */
const LUGARES_MAX = 5000

function textoCurto(valor: unknown, teto: number): string | undefined {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= teto ? valor : undefined
}

/**
 * `fichasNoAcervo` como veio do disco, no molde de `pastasDeFichasDoArquivo`:
 * entrada torta sai, e o resto fica. `undefined` = o arquivo não tem o campo
 * (a aventura ainda não migrou: a existência do campo É a marca).
 */
export function lugaresDasFichasDoArquivo(valor: unknown): Record<string, LugarDaFicha> | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined
  const lugares: Record<string, LugarDaFicha> = {}
  let quantos = 0
  for (const [fichaId, bruto] of Object.entries(valor)) {
    if (quantos >= LUGARES_MAX) break
    if (fichaId.length === 0 || fichaId.length > ID_MAX) continue
    if (typeof bruto !== 'object' || bruto === null) continue
    const { pasta, nomeDaPasta, nomeDaMae, daPeca } = bruto as Record<string, unknown> // fronteira do JSON: já é objeto, e cada campo é conferido abaixo antes do uso
    const id = pasta === null ? null : textoCurto(pasta, ID_MAX)
    if (id === undefined) continue
    const nome = textoCurto(nomeDaPasta, NOME_MAX)
    const mae = textoCurto(nomeDaMae, NOME_MAX)
    const peca = textoCurto(daPeca, ID_MAX)
    lugares[fichaId] = { pasta: id, ...(nome === undefined ? {} : { nomeDaPasta: nome }), ...(mae === undefined ? {} : { nomeDaMae: mae }), ...(peca === undefined ? {} : { daPeca: peca }) }
    quantos += 1
  }
  return lugares
}

/** A ficha mora no acervo: NPC (inimigo, "Só no cenário", criado na batalha) e nunca o invocado temporário. Jogador fica na coluna da direita. */
export function ehFichaDoAcervo(personagem: Personagem): boolean {
  return personagem.tipo !== 'jogador' && personagem.combate?.invocadoPor === undefined
}

/** O papel na linha de baixo: "Inimigo · 2 no mapa". */
export function papelDaFicha(personagem: Personagem): string {
  if (personagem.soCenario === true) return 'Só no cenário'
  return grupoDaFicha(personagem) === 'inimigos' ? 'Inimigo' : 'NPC'
}

function nomeDaMaeDe(pasta: PastaDoAcervo, pastas: readonly PastaDoAcervo[]): string | undefined {
  if (pasta.dentroDe === undefined) return undefined
  return pastas.find((outra) => outra.id === pasta.dentroDe)?.nome
}

/**
 * A pasta em que a ficha aparece agora. Pelo `id`; noutro PC, pelo nome dentro
 * da mesma mãe; sem achar, em NPCs; sem NPCs (o mestre a apagou), Sem pasta.
 */
export function pastaDaFichaNoAcervo(lugar: LugarDaFicha | undefined, pastas: readonly PastaDoAcervo[]): string | null {
  const npcs = pastas.some((pasta) => pasta.id === ID_DA_PASTA_NPCS) ? ID_DA_PASTA_NPCS : null
  if (lugar === undefined) return npcs
  if (lugar.pasta === null) return null
  if (pastas.some((pasta) => pasta.id === lugar.pasta)) return lugar.pasta
  if (lugar.nomeDaPasta !== undefined) {
    const achada = pastas.find((pasta) => pasta.nome === lugar.nomeDaPasta && nomeDaMaeDe(pasta, pastas) === lugar.nomeDaMae)
    if (achada !== undefined) return achada.id
  }
  return npcs
}

/** O lugar gravado para a ficha em `pastaId`, com os nomes que a acham noutro PC. */
export function lugarNaPasta(pastaId: string | null, pastas: readonly PastaDoAcervo[], daPeca?: string): LugarDaFicha {
  const pasta = pastaId === null ? undefined : pastas.find((outra) => outra.id === pastaId)
  const mae = pasta === undefined ? undefined : nomeDaMaeDe(pasta, pastas)
  return {
    pasta: pasta === undefined ? null : pasta.id,
    ...(pasta === undefined ? {} : { nomeDaPasta: pasta.nome }),
    ...(mae === undefined ? {} : { nomeDaMae: mae }),
    ...(daPeca === undefined ? {} : { daPeca }),
  }
}

const PORTUGUES = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

/** O nome como a linha o mostra (e a busca o compara). */
export function nomeDaFicha(personagem: Personagem): string {
  return personagem.nome.trim() || 'NPC sem nome'
}

export interface FichasNasPastas {
  /** Pasta do acervo (`null` = Sem pasta) → linhas, em ordem de nome. */
  porPasta: Map<string | null, LinhaDeFicha[]>
  /** Modelos e cópias que a busca deixou na tela. */
  vistas: number
  /** Modelos e cópias do acervo, sem busca. */
  total: number
}

/**
 * As fichas do acervo por pasta. Cópia anda embaixo do modelo; com a busca,
 * o modelo aparece se ele ou uma cópia dele bate (a que bate fica à vista).
 */
export function fichasNasPastas(
  personagens: readonly Personagem[],
  lugares: LugaresDasFichas,
  pastas: readonly PastaDoAcervo[],
  bate: (nome: string) => boolean,
): FichasNasPastas {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const copiasDe = new Map<string, Personagem[]>()
  const modelos: Personagem[] = []
  for (const personagem of personagens) {
    if (!ehFichaDoAcervo(personagem)) continue
    const raiz = raizDaCopia(personagem, porId)
    if (raiz === null) {
      modelos.push(personagem)
      continue
    }
    const lista = copiasDe.get(raiz.id) ?? []
    lista.push(personagem)
    copiasDe.set(raiz.id, lista)
  }
  const porNome = (a: Personagem, b: Personagem) => PORTUGUES.compare(nomeDaFicha(a), nomeDaFicha(b))
  const porPasta = new Map<string | null, LinhaDeFicha[]>()
  let vistas = 0
  let total = 0
  for (const modelo of modelos.sort(porNome)) {
    const todas = (copiasDe.get(modelo.id) ?? []).sort(porNome)
    total += 1 + todas.length
    const modeloBate = bate(nomeDaFicha(modelo))
    const copias = modeloBate ? todas : todas.filter((copia) => bate(nomeDaFicha(copia)))
    if (!modeloBate && copias.length === 0) continue
    vistas += 1 + copias.length
    const pastaId = pastaDaFichaNoAcervo(lugares[modelo.id], pastas)
    const linhas = porPasta.get(pastaId) ?? []
    linhas.push({ personagem: modelo, copias, totalDeCopias: todas.length })
    porPasta.set(pastaId, linhas)
  }
  return { porPasta, vistas, total }
}

/**
 * Decisão 9: a ficha que a peça do acervo `pecaId` já tem nesta aventura (o
 * modelo, não uma cópia; a ficha de jogador do "Criar ficha" numa peça da pasta
 * Jogadores também conta), ou `null` = é a 1ª vez, e a peça cria a ficha.
 */
export function fichaQueNasceuDaPeca(pecaId: string, personagens: readonly Personagem[], lugares: LugaresDasFichas | undefined): Personagem | null {
  if (lugares === undefined) return null
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  return personagens.find((personagem) => lugares[personagem.id]?.daPeca === pecaId && personagem.combate?.invocadoPor === undefined && raizDaCopia(personagem, porId) === null) ?? null
}

/**
 * As fichas que ganham linha própria no acervo: tira a família (modelo e
 * cópias) cuja ficha nasceu de uma peça que ainda está na estante. A linha da
 * PEÇA já a representa (o clique abre a ficha, o selo diz "Tem ficha"); duas
 * linhas com o mesmo nome confundiriam. Peça apagada devolve a linha à ficha.
 */
export function fichasSemPecaNaEstante(personagens: readonly Personagem[], lugares: LugaresDasFichas, pecas: ReadonlySet<string>): Personagem[] {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  return personagens.filter((personagem) => {
    const raiz = raizDaCopia(personagem, porId) ?? personagem
    const pecaId = lugares[raiz.id]?.daPeca
    return pecaId === undefined || !pecas.has(pecaId)
  })
}

/** Peça do acervo → a ficha dela nesta aventura, para o painel achar sem varrer a lista a cada linha. */
export function fichasDasPecas(personagens: readonly Personagem[], lugares: LugaresDasFichas): Map<string, Personagem> {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const mapa = new Map<string, Personagem>()
  for (const personagem of personagens) {
    const pecaId = lugares[personagem.id]?.daPeca
    if (pecaId === undefined || mapa.has(pecaId) || personagem.combate?.invocadoPor !== undefined || raizDaCopia(personagem, porId) !== null) continue
    mapa.set(pecaId, personagem)
  }
  return mapa
}

/** O nome da cópia nova: "Goblin 2", "Goblin 3"… a partir do nome do modelo-raiz, sem repetir nome da lista. */
export function nomeDaProximaCopia(ficha: Personagem, personagens: readonly Personagem[]): string {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const raiz = raizDaCopia(ficha, porId) ?? ficha
  const base = raiz.nome.trim() || 'NPC'
  const usados = new Set(personagens.map((personagem) => textoDeBusca(personagem.nome)))
  let n = 2
  while (usados.has(textoDeBusca(`${base} ${n}`))) n += 1
  return `${base} ${n}`
}

/** O que a migração fez, para o aviso de uma vez só. */
export interface ResumoDaMigracao {
  fichas: number
  inimigos: number
  /** As pastas do mestre (coluna da direita) que viraram subpasta. */
  pastasDoMestre: string[]
  /** O nome da pasta que recebeu tudo ("NPCs"); `null` = ela não existe mais, as subpastas ficaram de cima. */
  nomeDaMae: string | null
}

export interface MigracaoDasFichas {
  /** As subpastas que faltam no acervo (com `id` novo). Vazia = o acervo já tem todas. */
  pastasNovas: PastaDoAcervo[]
  lugares: Record<string, LugarDaFicha>
  resumo: ResumoDaMigracao
}

/** Há ficha de NPC no dono e ele ainda não tem o campo: a migração deve rodar. */
export function precisaMigrar(personagens: readonly Personagem[], lugares: LugaresDasFichas | undefined): boolean {
  if (lugares !== undefined) return false
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  return personagens.some((personagem) => ehFichaDoAcervo(personagem) && raizDaCopia(personagem, porId) === null)
}

/**
 * MIGRAÇÃO, uma vez por aventura (NOTAS §Migração): ficha numa pasta do
 * mestre X → subpasta X de NPCs (a de mesmo nome é reaproveitada); inimigo →
 * NPCs › Inimigos; o resto → raiz de NPCs. Jogador, cópia e invocado ficam de
 * fora. Só PROPÕE: quem chama cria as `pastasNovas` e roda de novo com as
 * pastas gravadas, e aí `pastasNovas` volta vazia e os `id`s são os do disco.
 */
export function migrarFichasParaOAcervo(
  personagens: readonly Personagem[],
  pastasDeFichas: readonly PastaDeFichas[],
  pastasDoAcervo: readonly PastaDoAcervo[],
  novoId: () => string = () => crypto.randomUUID(),
): MigracaoDasFichas {
  const mae = pastasDoAcervo.find((pasta) => pasta.id === ID_DA_PASTA_NPCS) ?? null
  const pastasNovas: PastaDoAcervo[] = []
  const subpasta = (nome: string): string => {
    const todas = [...pastasDoAcervo, ...pastasNovas]
    const achada = todas.find((pasta) => pasta.nome === nome && (pasta.dentroDe ?? null) === (mae?.id ?? null))
    if (achada !== undefined) return achada.id
    const nova: PastaDoAcervo = { id: novoId(), nome, recolhida: false, ...(mae === null ? {} : { dentroDe: mae.id }) }
    pastasNovas.push(nova)
    return nova.id
  }
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const destinos: [string, string | null][] = []
  const pastasDoMestre = new Set<string>()
  let inimigos = 0
  for (const personagem of personagens) {
    if (!ehFichaDoAcervo(personagem) || raizDaCopia(personagem, porId) !== null) continue
    const doMestre = pastaDaFicha(pastasDeFichas, personagem.id)
    if (doMestre !== null) {
      pastasDoMestre.add(doMestre.nome)
      destinos.push([personagem.id, subpasta(doMestre.nome)])
    } else if (grupoDaFicha(personagem) === 'inimigos') {
      inimigos += 1
      destinos.push([personagem.id, subpasta(NOME_DO_GRUPO.inimigos)])
    } else {
      destinos.push([personagem.id, mae?.id ?? null])
    }
  }
  const todas = [...pastasDoAcervo, ...pastasNovas]
  const lugares: Record<string, LugarDaFicha> = {}
  for (const [fichaId, pastaId] of destinos) lugares[fichaId] = lugarNaPasta(pastaId, todas)
  return { pastasNovas, lugares, resumo: { fichas: destinos.length, inimigos, pastasDoMestre: [...pastasDoMestre], nomeDaMae: mae?.nome ?? null } }
}

/** "As fichas de NPC desta aventura agora ficam aqui. Os 14 inimigos estão em NPCs › Inimigos; a pasta Marinha virou subpasta. Nenhuma ficha mudou." */
export function textoDoAvisoDaMigracao(resumo: ResumoDaMigracao): string {
  const onde = (nome: string) => (resumo.nomeDaMae === null ? nome : `${resumo.nomeDaMae} › ${nome}`)
  const partes: string[] = []
  if (resumo.inimigos > 0) partes.push(resumo.inimigos === 1 ? `O inimigo está em ${onde(NOME_DO_GRUPO.inimigos)}` : `Os ${resumo.inimigos} inimigos estão em ${onde(NOME_DO_GRUPO.inimigos)}`)
  const pastas = resumo.pastasDoMestre
  if (pastas.length === 1) partes.push(`a pasta ${pastas[0]} virou subpasta`)
  else if (pastas.length > 1) partes.push(`as pastas ${pastas.slice(0, -1).join(', ')} e ${pastas[pastas.length - 1]} viraram subpastas`)
  const meio = partes.length === 0 ? '' : ` ${partes.join('; ').replace(/^./, (letra) => letra.toUpperCase())}.`
  return `As fichas de NPC desta aventura agora ficam aqui.${meio} Nenhuma ficha mudou.`
}
