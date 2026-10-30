/**
 * O RECADO ENTRE A PAREDE DESENHADA E AS PORTAS (lote 18, CONTRATO.md 11.16).
 *
 * No Desenhado a folha da porta parada é pintada pela parede (`paredesDesenhadas.ts`),
 * por cima do vão, na alvenaria do pacote. A camada das portas (`drawDoors.ts`, pelo
 * `animadorDePortas.ts`) continua dona do resto: a seleção, o anel e o cadeado da
 * trancada com cor própria, a seta de um lado, o ponto de atravessar e a animação.
 *
 * - A parede publica as portas cuja folha ela pinta, com a meia espessura da folha em
 *   px do mundo (a seleção e a animação acompanham a folha grossa).
 * - O animador publica as portas que andam: nelas a parede pinta só o vão e a folha é
 *   da animação, por cima.
 *
 * Cada lado publica com um dono (o pintor de um nó, o animador de um nó); a resposta é
 * a união. Os ouvintes só são chamados quando o conjunto muda (nada a cada quadro).
 */

type Ouvinte = () => void

const folhasPorDono = new Map<object, ReadonlyMap<string, number>>()
const animandoPorDono = new Map<object, ReadonlySet<string>>()
const ouvintesDasFolhas = new Set<Ouvinte>()
const ouvintesDaAnimacao = new Set<Ouvinte>()

function avisar(ouvintes: ReadonlySet<Ouvinte>): void {
  for (const f of [...ouvintes]) f()
}

function mesmasFolhas(a: ReadonlyMap<string, number> | undefined, b: ReadonlyMap<string, number>): boolean {
  if (a === undefined) return b.size === 0
  if (a.size !== b.size) return false
  for (const [id, meia] of b) if (a.get(id) !== meia) return false
  return true
}

function mesmosIds(a: ReadonlySet<string> | undefined, b: ReadonlySet<string>): boolean {
  if (a === undefined) return b.size === 0
  if (a.size !== b.size) return false
  for (const id of b) if (!a.has(id)) return false
  return true
}

/** A parede de um nó conta quais folhas pinta (vazio = nenhuma: o Atual, ou o pintor saiu). */
export function publicarFolhasDesenhadas(dono: object, folhas: ReadonlyMap<string, number>): void {
  if (mesmasFolhas(folhasPorDono.get(dono), folhas)) return
  if (folhas.size === 0) folhasPorDono.delete(dono)
  else folhasPorDono.set(dono, new Map(folhas))
  avisar(ouvintesDasFolhas)
}

/** A meia espessura da folha (px do mundo) que a parede Desenhada pinta nesta porta, ou `null`. */
export function folhaDesenhada(id: string): number | null {
  for (const folhas of folhasPorDono.values()) {
    const meia = folhas.get(id)
    if (meia !== undefined) return meia
  }
  return null
}

export function assinarFolhasDesenhadas(f: Ouvinte): () => void {
  ouvintesDasFolhas.add(f)
  return () => ouvintesDasFolhas.delete(f)
}

/** O animador de um nó conta quais portas andam agora. */
export function publicarPortasAnimando(dono: object, ids: Iterable<string>): void {
  const novo = new Set(ids)
  if (mesmosIds(animandoPorDono.get(dono), novo)) return
  if (novo.size === 0) animandoPorDono.delete(dono)
  else animandoPorDono.set(dono, novo)
  avisar(ouvintesDaAnimacao)
}

export function portaAnimando(id: string): boolean {
  for (const ids of animandoPorDono.values()) if (ids.has(id)) return true
  return false
}

export function assinarPortasAnimando(f: Ouvinte): () => void {
  ouvintesDaAnimacao.add(f)
  return () => ouvintesDaAnimacao.delete(f)
}
