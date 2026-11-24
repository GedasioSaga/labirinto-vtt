/**
 * CARACTERÍSTICAS ESPECIAIS DA FICHA (protótipo aprovado em 23/11/2026,
 * docs/design/caracteristicas/): o bloco na coluna da esquerda da ficha, abaixo
 * dos atributos. Duas por enquanto:
 *  - Companion: um GRUPO de fichas (NPC ou invocação do livro) que andam com o
 *    personagem, com nome e limite próprios ("Lovecats, leva até 3"). A ficha
 *    pode ter vários grupos. Cada ligada tem ficha, vida e nível próprios.
 *  - Cegueira: a visão cai pela metade; quem fica entre a metade e o raio normal
 *    vira uma onda no chão (a frente da Cegueira lê só `temCegueira`).
 *
 * Só o mestre cria, muda ou tira (a edição do jogador parte da ficha gravada,
 * `net/edicaoDoPersonagem.ts`). Vai ao jogador junto com a ficha: ele vê os
 * chips e escolhe quem leva para a batalha.
 *
 * Este arquivo não importa `lib/personagem.ts` (que o importa): fica sem ciclo.
 */

/** Quantas características uma ficha guarda; passou disso, o leitor corta. */
export const CARACTERISTICAS_MAX = 12
/** Quantas fichas um grupo de companion liga. */
export const LIGADOS_MAX = 40
/** O maior "Leva para a batalha até". */
export const LIMITE_DO_GRUPO_MAX = 20
/** O nome do grupo, como o nome do personagem. */
export const NOME_DO_GRUPO_MAX = 80
/** Teto de um id lido do disco ou do fio. */
const ID_MAX = 120

/** "Luta no campo" ou "Dá efeito": o que o companion faz na vez dele (os dois têm vez própria). */
export type ModoDoCompanion = 'luta' | 'efeito'

export interface CompanionLigado {
  /** O id da ficha ligada (NPC ou invocação do livro, `Personagem.id`). */
  personagemId: string
  modo: ModoDoCompanion
  /**
   * O nível que o mestre deu ("Evoluir"), de 1 a `NIVEL_MAX`. Só o número: a
   * vida e o resto vêm da ficha do NPC como o mestre a editar (decisão do dono,
   * 23/11 21h59: nada de "+20 HP por nível").
   */
  nivel: number
}

/** O maior nível de um companion. */
export const NIVEL_MAX = 99

export interface CaracteristicaCompanion {
  tipo: 'companion'
  id: string
  /** O nome do grupo ("Lovecats"); vazio no disco vira "Companion". */
  nome: string
  /** Quantos o dono leva para a batalha, de 1 a `LIMITE_DO_GRUPO_MAX`. */
  limite: number
  ligados: CompanionLigado[]
  /**
   * Quem foi na última batalha (ids de `ligados`): o padrão da próxima escolha.
   * Ausente = nunca escolheu (vêm as primeiras de pé, até o limite).
   */
  ultimaEscolha?: string[]
}

export interface CaracteristicaCegueira {
  tipo: 'cegueira'
  id: string
}

export type Caracteristica = CaracteristicaCompanion | CaracteristicaCegueira

export type TipoDeCaracteristica = Caracteristica['tipo']

/** O nome que o grupo sem nome ganha na tela e no disco. */
export const NOME_PADRAO_DO_GRUPO = 'Companion'

/** A ficha tem Cegueira? (a frente do mapa lê só isto). */
export function temCegueira(caracteristicas: readonly Caracteristica[] | undefined): boolean {
  return caracteristicas?.some((caracteristica) => caracteristica.tipo === 'cegueira') === true
}

/** Os grupos de companion da ficha, na ordem do bloco. */
export function gruposDeCompanion(caracteristicas: readonly Caracteristica[] | undefined): CaracteristicaCompanion[] {
  if (caracteristicas === undefined) return []
  return caracteristicas.filter((caracteristica): caracteristica is CaracteristicaCompanion => caracteristica.tipo === 'companion')
}

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function idBom(valor: unknown): valor is string {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= ID_MAX
}

function limiteDoArquivo(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 1
  return Math.min(LIMITE_DO_GRUPO_MAX, Math.max(1, Math.round(valor)))
}

function ligadosDoArquivo(valor: unknown): CompanionLigado[] {
  if (!Array.isArray(valor)) return []
  const vistos = new Set<string>()
  const ligados: CompanionLigado[] = []
  for (const item of valor) {
    if (!ehRegistro(item) || !idBom(item.personagemId) || vistos.has(item.personagemId)) continue
    vistos.add(item.personagemId)
    const nivel = typeof item.nivel === 'number' && Number.isFinite(item.nivel) ? Math.min(NIVEL_MAX, Math.max(1, Math.round(item.nivel))) : 1
    ligados.push({ personagemId: item.personagemId, modo: item.modo === 'efeito' ? 'efeito' : 'luta', nivel })
    if (ligados.length >= LIGADOS_MAX) break
  }
  return ligados
}

function companionDoArquivo(valor: Record<string, unknown>, id: string): CaracteristicaCompanion {
  const nome = typeof valor.nome === 'string' ? valor.nome.trim().slice(0, NOME_DO_GRUPO_MAX) : ''
  const ligados = ligadosDoArquivo(valor.ligados)
  const doGrupo = new Set(ligados.map((ligado) => ligado.personagemId))
  const grupo: CaracteristicaCompanion = { tipo: 'companion', id, nome: nome || NOME_PADRAO_DO_GRUPO, limite: limiteDoArquivo(valor.limite), ligados }
  if (Array.isArray(valor.ultimaEscolha)) {
    // Só quem ainda está ligado; repetido sai.
    grupo.ultimaEscolha = [...new Set(valor.ultimaEscolha.filter((item): item is string => typeof item === 'string' && doGrupo.has(item)))]
  }
  return grupo
}

/**
 * A lista do disco ou do fio, conferida: tipo desconhecido sai, id repetido
 * sai, a Cegueira entra uma vez só. Vazia, torta ou ausente = `undefined`
 * (a chave nem aparece na ficha: nada de `caracteristicas: undefined`).
 */
export function lerCaracteristicas(valor: unknown): Caracteristica[] | undefined {
  if (!Array.isArray(valor)) return undefined
  const ids = new Set<string>()
  const lidas: Caracteristica[] = []
  let cega = false
  for (const item of valor) {
    if (lidas.length >= CARACTERISTICAS_MAX) break
    if (!ehRegistro(item) || !idBom(item.id) || ids.has(item.id)) continue
    if (item.tipo === 'companion') lidas.push(companionDoArquivo(item, item.id))
    else if (item.tipo === 'cegueira' && !cega) {
      cega = true
      lidas.push({ tipo: 'cegueira', id: item.id })
    } else continue
    ids.add(item.id)
  }
  return lidas.length === 0 ? undefined : lidas
}
