import type { Personagem } from './personagem'

/**
 * PAINEL PERSONAGENS ORGANIZADO (pedido de 09/11/2026: "melhor criar algo mais
 * organizado que isso"). Três peças, todas sem estado:
 *
 *  - GRUPOS que fecham (Jogadores, NPCs, Inimigos), lidos da própria ficha;
 *  - PASTAS DO MESTRE ("Floresta", "Marinha"): só uma lista de ids por pasta,
 *    guardada no mesmo dono dos personagens (o `rpg.json` da pasta de mapas,
 *    ou o `adventure.json`), no molde do treino do Lobby — mover uma ficha não
 *    muda a ficha, e apagar a pasta não apaga ninguém;
 *  - a BUSCA pelo nome, sem acento e sem caixa.
 *
 * As CÓPIAS (variações de um modelo, `combate.modeloId`: os "monstros iguais",
 * cada token com a própria vida) não viram linhas soltas: andam embaixo do
 * modelo, onde quer que ele esteja.
 */

export interface PastaDeFichas {
  id: string
  /** O nome que o mestre deu, aparado e no teto `NOME_DA_PASTA_DE_FICHAS_MAX`. */
  nome: string
  /** Ids dos personagens, na ordem em que entraram. Id que não acha ficha fica quieto (a ficha foi apagada). */
  fichas: string[]
}

export const PASTAS_DE_FICHAS_MAX = 60
export const NOME_DA_PASTA_DE_FICHAS_MAX = 40
const ID_DA_PASTA_MAX = 80
const ID_DA_FICHA_MAX = 200
/** Teto de ids por pasta lida do disco: mais que isso é arquivo mexido à mão. */
const FICHAS_POR_PASTA_MAX = 2000

export type GrupoDeFichas = 'jogadores' | 'npcs' | 'inimigos'

export const GRUPOS_DE_FICHAS: readonly GrupoDeFichas[] = ['jogadores', 'npcs', 'inimigos']

export const NOME_DO_GRUPO: Readonly<Record<GrupoDeFichas, string>> = {
  jogadores: 'Jogadores',
  npcs: 'NPCs',
  inimigos: 'Inimigos',
}

/** O nome como a pasta o guarda: aparado e cortado no teto; vazio vira "Pasta nova". */
export function nomeDaPastaLimpo(nome: string): string {
  const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, NOME_DA_PASTA_DE_FICHAS_MAX).trim()
  return limpo.length === 0 ? 'Pasta nova' : limpo
}

/** As pastas como vieram do disco: entrada torta sai, id repetido sai, ficha em duas pastas fica só na primeira. */
export function pastasDeFichasDoArquivo(valor: unknown): PastaDeFichas[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const pastas: PastaDeFichas[] = []
  const ids = new Set<string>()
  const fichasVistas = new Set<string>()
  for (const item of valor) {
    if (pastas.length >= PASTAS_DE_FICHAS_MAX) break
    if (typeof item !== 'object' || item === null) continue
    const { id, nome, fichas } = item as Record<string, unknown>
    if (typeof id !== 'string' || id.length === 0 || id.length > ID_DA_PASTA_MAX || ids.has(id)) continue
    if (typeof nome !== 'string') continue
    const lista = Array.isArray(fichas) ? fichas : []
    const proprias: string[] = []
    for (const fichaId of lista) {
      if (proprias.length >= FICHAS_POR_PASTA_MAX) break
      if (typeof fichaId !== 'string' || fichaId.length === 0 || fichaId.length > ID_DA_FICHA_MAX || fichasVistas.has(fichaId)) continue
      fichasVistas.add(fichaId)
      proprias.push(fichaId)
    }
    ids.add(id)
    pastas.push({ id, nome: nomeDaPastaLimpo(nome), fichas: proprias })
  }
  return pastas
}

export function novoIdDePastaDeFichas(): string {
  return `pfi_${crypto.randomUUID()}`
}

/** A pasta nova entra no fim. No teto, a lista volta igual. */
export function comPastaNova(lista: readonly PastaDeFichas[], pasta: PastaDeFichas): PastaDeFichas[] {
  if (lista.length >= PASTAS_DE_FICHAS_MAX) return [...lista]
  return [...lista, { ...pasta, nome: nomeDaPastaLimpo(pasta.nome) }]
}

export function renomearPastaDeFichas(lista: readonly PastaDeFichas[], pastaId: string, nome: string): PastaDeFichas[] {
  return lista.map((pasta) => (pasta.id === pastaId ? { ...pasta, nome: nomeDaPastaLimpo(nome) } : pasta))
}

/** Apagar a pasta solta as fichas dela: elas voltam ao grupo de cada uma. Nenhuma ficha é apagada. */
export function apagarPastaDeFichas(lista: readonly PastaDeFichas[], pastaId: string): PastaDeFichas[] {
  return lista.filter((pasta) => pasta.id !== pastaId)
}

/** A pasta do mestre em que a ficha está, ou `null` (fica no grupo dela). */
export function pastaDaFicha(lista: readonly PastaDeFichas[], fichaId: string): PastaDeFichas | null {
  return lista.find((pasta) => pasta.fichas.includes(fichaId)) ?? null
}

/**
 * A ficha sai de toda pasta e entra em `pastaId` (no fim); `null` = volta ao
 * grupo dela. Já estava lá: a MESMA lista (nada a gravar).
 */
export function moverFichaParaPasta(lista: readonly PastaDeFichas[], fichaId: string, pastaId: string | null): readonly PastaDeFichas[] {
  const atual = pastaDaFicha(lista, fichaId)
  if ((atual?.id ?? null) === pastaId) return lista
  if (pastaId !== null && !lista.some((pasta) => pasta.id === pastaId)) return lista
  return lista.map((pasta) => {
    const sem = pasta.fichas.filter((id) => id !== fichaId)
    if (pasta.id === pastaId) return { ...pasta, fichas: [...sem, fichaId] }
    return sem.length === pasta.fichas.length ? pasta : { ...pasta, fichas: sem }
  })
}

/**
 * O grupo da ficha: jogador; INIMIGO = NPC de combate marcado (força do
 * bestiário, variação, criado na batalha) que não é "Só no cenário" nem o
 * invocado temporário de alguém; o resto é NPC.
 */
export function grupoDaFicha(personagem: Personagem): GrupoDeFichas {
  if (personagem.tipo === 'jogador') return 'jogadores'
  const marca = personagem.combate
  if (marca !== undefined && personagem.soCenario !== true && marca.invocadoPor === undefined) return 'inimigos'
  return 'npcs'
}

/** O texto como a busca o compara: sem acento, sem caixa, espaços juntos. */
export function textoDeBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * As fichas que o "Ligar ficha ›" oferece, em ordem de nome: os modelos (a
 * cópia é de um token só) e nunca o invocado temporário de alguém.
 */
export function fichasParaLigar(personagens: readonly Personagem[], busca: string): Personagem[] {
  const ids = new Set(personagens.map((personagem) => personagem.id))
  const termo = textoDeBusca(busca)
  return personagens
    .filter((personagem) => {
      const modeloId = personagem.combate?.modeloId
      const ehCopia = modeloId !== undefined && modeloId !== personagem.id && ids.has(modeloId)
      if (ehCopia || personagem.combate?.invocadoPor !== undefined) return false
      return termo.length === 0 || textoDeBusca(personagem.nome).includes(termo)
    })
    .sort(porNome)
}

export interface LinhaDeFicha {
  personagem: Personagem
  /** As cópias (variações) deste modelo que a busca deixa ver, em ordem de nome. */
  copias: Personagem[]
  /** Quantas cópias o modelo tem ao todo (com a busca, pode ser mais que `copias`). */
  totalDeCopias: number
}

export interface FichasOrganizadas {
  pastas: { pasta: PastaDeFichas; linhas: LinhaDeFicha[] }[]
  grupos: { grupo: GrupoDeFichas; linhas: LinhaDeFicha[] }[]
  /** Quantas fichas (modelos e cópias) a busca deixou na tela. */
  vistas: number
}

const PORTUGUES = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true })

function porNome(a: Personagem, b: Personagem): number {
  return PORTUGUES.compare(a.nome, b.nome)
}

/** O modelo-raiz da cópia que está na lista, ou `null` (não é cópia, ou o modelo sumiu). Ciclo de arquivo torto = `null`. */
function raizDaCopia(personagem: Personagem, porId: ReadonlyMap<string, Personagem>): Personagem | null {
  const vistos = new Set<string>([personagem.id])
  let modeloId = personagem.combate?.modeloId
  let raiz: Personagem | null = null
  while (modeloId !== undefined) {
    if (vistos.has(modeloId)) return null
    const modelo = porId.get(modeloId)
    if (modelo === undefined) return raiz
    vistos.add(modeloId)
    raiz = modelo
    modeloId = modelo.combate?.modeloId
  }
  return raiz
}

/**
 * As fichas como o painel as mostra: primeiro as pastas do mestre (na ordem
 * dele, até as vazias, que são lugar de soltar), depois os três grupos com o
 * que não está em pasta. Dentro de cada um, em ordem de nome. Com `busca`,
 * só o que bate (o modelo aparece se ele ou uma cópia dele bate), e o grupo
 * que fica sem nada some.
 */
export function organizarFichas(personagens: readonly Personagem[], pastas: readonly PastaDeFichas[], busca: string): FichasOrganizadas {
  const porId = new Map(personagens.map((personagem) => [personagem.id, personagem]))
  const copiasDe = new Map<string, Personagem[]>()
  const modelos: Personagem[] = []
  for (const personagem of personagens) {
    const raiz = raizDaCopia(personagem, porId)
    if (raiz === null) {
      modelos.push(personagem)
      continue
    }
    const lista = copiasDe.get(raiz.id) ?? []
    lista.push(personagem)
    copiasDe.set(raiz.id, lista)
  }

  const termo = textoDeBusca(busca)
  const bate = (personagem: Personagem) => termo.length === 0 || textoDeBusca(personagem.nome).includes(termo)
  let vistas = 0
  const linhaDe = (modelo: Personagem): LinhaDeFicha | null => {
    const todas = (copiasDe.get(modelo.id) ?? []).slice().sort(porNome)
    const modeloBate = bate(modelo)
    const copias = modeloBate ? todas : todas.filter(bate)
    if (!modeloBate && copias.length === 0) return null
    vistas += 1 + copias.length
    return { personagem: modelo, copias, totalDeCopias: todas.length }
  }

  const naPasta = new Map<string, string>()
  for (const pasta of pastas) for (const fichaId of pasta.fichas) if (!naPasta.has(fichaId)) naPasta.set(fichaId, pasta.id)

  const ordenados = modelos.slice().sort(porNome)
  const linhasDaPasta = new Map<string, LinhaDeFicha[]>(pastas.map((pasta) => [pasta.id, []]))
  const linhasDoGrupo = new Map<GrupoDeFichas, LinhaDeFicha[]>(GRUPOS_DE_FICHAS.map((grupo) => [grupo, []]))
  for (const modelo of ordenados) {
    const linha = linhaDe(modelo)
    if (linha === null) continue
    const pastaId = naPasta.get(modelo.id)
    const daPasta = pastaId === undefined ? undefined : linhasDaPasta.get(pastaId)
    if (daPasta !== undefined) daPasta.push(linha)
    else linhasDoGrupo.get(grupoDaFicha(modelo))?.push(linha)
  }

  return {
    pastas: pastas
      .map((pasta) => ({ pasta, linhas: linhasDaPasta.get(pasta.id) ?? [] }))
      // Buscando, a pasta sem nada que bate some; sem busca, a vazia fica (é lugar de soltar).
      .filter((item) => termo.length === 0 || item.linhas.length > 0),
    grupos: GRUPOS_DE_FICHAS.map((grupo) => ({ grupo, linhas: linhasDoGrupo.get(grupo) ?? [] })).filter((item) => item.linhas.length > 0),
    vistas,
  }
}
