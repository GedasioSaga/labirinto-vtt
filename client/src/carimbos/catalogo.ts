import { CARIMBOS_EMBUTIDOS, IDS_DOS_EMBUTIDOS, type DefinicaoDeCarimbo, type SombraDoCarimbo } from './embutidos'

/**
 * CATÁLOGO DE CARIMBOS: a biblioteca embutida (`embutidos.ts`) mais os que
 * chegam pelo pacote do GitHub (`lib/pacoteDeAnimacoes.ts`, tipo `carimbo`),
 * no mesmo molde do catálogo das texturas (`texturas/catalogo.ts`). Os
 * importados pelo mestre não moram aqui: são do mapa (`MapData.carimbosImportados`).
 */

const ID_DO_PACOTE = /^[a-z0-9-]{1,40}$/
export const NOME_DE_CARIMBO_DO_PACOTE_MAX = 60
/** Faixa do tamanho natural, em px do protótipo do relevo (`DefinicaoDeCarimbo.tamanho`). */
export const TAMANHO_NATURAL_MIN = 2
export const TAMANHO_NATURAL_MAX = 80

export interface CarimboDoCatalogo extends DefinicaoDeCarimbo {
  origem: 'embutido' | 'pacote'
}

const EMBUTIDOS: readonly CarimboDoCatalogo[] = CARIMBOS_EMBUTIDOS.map((c) => ({ ...c, origem: 'embutido' }))

let lista: readonly CarimboDoCatalogo[] = EMBUTIDOS
let versao = 0
const ouvintes = new Set<() => void>()

/** Todos os carimbos do catálogo; a referência só muda quando o registro muda (`useSyncExternalStore`). */
export function listarCarimbos(): readonly CarimboDoCatalogo[] {
  return lista
}

/** Muda a cada troca do registro: quem assou um desenho do pacote sabe que precisa assar de novo. */
export function versaoDoCatalogoDeCarimbos(): number {
  return versao
}

export function assinarCarimbos(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** O carimbo do id, ou `null` (importado, ou de um pacote que este aparelho ainda não tem). */
export function carimboDoCatalogo(id: string): CarimboDoCatalogo | null {
  return lista.find((c) => c.id === id) ?? null
}

function trocarLista(nova: readonly CarimboDoCatalogo[]): void {
  lista = nova
  versao += 1
  for (const ouvinte of ouvintes) ouvinte()
}

export function ehSombraDeCarimbo(valor: unknown): valor is SombraDoCarimbo {
  return valor === 'em-pe' || valor === 'baixa' || valor === 'nenhuma'
}

/**
 * Registra um carimbo de FORA (pacote). Confere a forma em tempo de execução
 * e recusa (`false`) o que não serve; id da biblioteca é recusado (o
 * embutido ganha). O desenho de fora roda por `Reflect.apply`, e o erro dele
 * só deixa o desenho vazio (quem assa confere — `arte.ts`).
 */
export function registrarCarimboDoPacote(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || typeof info.id !== 'string' || !ID_DO_PACOTE.test(info.id)) return false
  const id = info.id
  if (IDS_DOS_EMBUTIDOS.includes(id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_CARIMBO_DO_PACOTE_MAX) return false
  if (!('tamanho' in info) || typeof info.tamanho !== 'number' || !Number.isFinite(info.tamanho)) return false
  const tamanho = info.tamanho
  if (tamanho < TAMANHO_NATURAL_MIN || tamanho > TAMANHO_NATURAL_MAX) return false
  if (!('sombra' in info) || !ehSombraDeCarimbo(info.sombra)) return false
  const sombra = info.sombra
  if (!('desenhar' in info) || typeof info.desenhar !== 'function') return false
  const desenhoDeFora = info.desenhar
  const carimbo: CarimboDoCatalogo = {
    id,
    nome,
    tamanho,
    sombra,
    origem: 'pacote',
    desenhar: (g, giro, semente) => {
      Reflect.apply(desenhoDeFora, undefined, [g, giro, semente])
    },
  }
  trocarLista([...lista.filter((c) => c.id !== id), carimbo])
  return true
}

/** Tira todos os do pacote (o pacote novo substitui o anterior inteiro). Os embutidos ficam. */
export function esquecerCarimbosDeFora(): void {
  if (lista === EMBUTIDOS) return
  trocarLista(EMBUTIDOS)
}

export { IDS_DOS_EMBUTIDOS }
