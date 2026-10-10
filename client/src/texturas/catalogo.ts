import { IDS_DAS_EMBUTIDAS, TEXTURAS_EMBUTIDAS, type DefinicaoDeTextura } from './embutidas'

/**
 * CATÁLOGO DE TEXTURAS: a biblioteca embutida (`embutidas.ts`) mais as que
 * chegam pelo pacote do GitHub (`lib/pacoteDeAnimacoes.ts`, tipo `textura`),
 * no mesmo molde do registro das portas (`portas/animacoesDePorta.ts`). As
 * importadas pelo mestre não moram aqui: são do mapa (`MapData.texturasImportadas`).
 */

/** Id de textura do pacote: a mesma forma dos outros tipos do pacote. */
const ID_DO_PACOTE = /^[a-z0-9-]{1,40}$/
export const NOME_DE_TEXTURA_DO_PACOTE_MAX = 60
/** Faixa do lado do ladrilho, em px do protótipo do relevo (`DefinicaoDeTextura.escala`). */
export const ESCALA_MIN = 8
export const ESCALA_MAX = 200

export interface TexturaDoCatalogo extends DefinicaoDeTextura {
  origem: 'embutida' | 'pacote'
}

const EMBUTIDAS: readonly TexturaDoCatalogo[] = TEXTURAS_EMBUTIDAS.map((t) => ({ ...t, origem: 'embutida' }))

let lista: readonly TexturaDoCatalogo[] = EMBUTIDAS
const ouvintes = new Set<() => void>()

/** Todas as texturas do catálogo; a referência só muda quando o registro muda (`useSyncExternalStore`). */
export function listarTexturas(): readonly TexturaDoCatalogo[] {
  return lista
}

export function assinarTexturas(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
  }
}

/** Um cartão da biblioteca: uma textura sozinha, ou as formas de uma (Lajotas Clara e Escura). */
export interface GrupoDeFormas {
  /** O `forma.grupo` das formas; o id, na textura sozinha. */
  grupo: string
  /** O nome do cartão: o da primeira forma. */
  nome: string
  /** Na ordem da lista; a primeira é a que o cartão escolhe na primeira vez. */
  formas: readonly TexturaDoCatalogo[]
}

/**
 * Junta as formas de uma mesma textura num cartão só, na ordem da lista: o
 * grupo fica onde a primeira forma dele aparece. Textura sem `forma` é um
 * grupo de uma (as do pacote nunca declaram forma).
 */
export function agruparPorForma(texturas: readonly TexturaDoCatalogo[]): GrupoDeFormas[] {
  const grupos: Array<{ grupo: string; nome: string; formas: TexturaDoCatalogo[] }> = []
  const comForma = new Map<string, TexturaDoCatalogo[]>()
  for (const textura of texturas) {
    const chave = textura.forma?.grupo
    const existente = chave === undefined ? undefined : comForma.get(chave)
    if (existente !== undefined) {
      existente.push(textura)
      continue
    }
    const formas = [textura]
    if (chave !== undefined) comForma.set(chave, formas)
    grupos.push({ grupo: chave ?? textura.id, nome: textura.nome, formas })
  }
  return grupos
}

/** A textura do id, ou `null` (importada, ou de um pacote que este aparelho ainda não tem). */
export function texturaDoCatalogo(id: string): TexturaDoCatalogo | null {
  return lista.find((t) => t.id === id) ?? null
}

function trocarLista(nova: readonly TexturaDoCatalogo[]): void {
  lista = nova
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * Registra uma textura de FORA (pacote). Confere a forma em tempo de execução
 * e recusa (`false`) o que não serve; id da biblioteca é recusado (a embutida
 * ganha). A cor de fora roda por `Reflect.apply` e o que ela devolver de
 * estranho vira preto no ladrilho, não erro (`ladrilhos.ts` confere).
 */
export function registrarTexturaDoPacote(info: unknown): boolean {
  if (typeof info !== 'object' || info === null) return false
  if (!('id' in info) || typeof info.id !== 'string' || !ID_DO_PACOTE.test(info.id)) return false
  const id = info.id
  if (IDS_DAS_EMBUTIDAS.includes(id)) return false
  if (!('nome' in info) || typeof info.nome !== 'string') return false
  const nome = info.nome.trim()
  if (nome === '' || nome.length > NOME_DE_TEXTURA_DO_PACOTE_MAX) return false
  if (!('escala' in info) || typeof info.escala !== 'number' || !Number.isFinite(info.escala)) return false
  const escala = info.escala
  if (escala < ESCALA_MIN || escala > ESCALA_MAX) return false
  if (!('cor' in info) || typeof info.cor !== 'function') return false
  const corDeFora = info.cor
  const textura: TexturaDoCatalogo = {
    id,
    nome,
    escala,
    origem: 'pacote',
    cor: (u, v) => {
      const cor: unknown = Reflect.apply(corDeFora, undefined, [u, v])
      return typeof cor === 'number' && Number.isFinite(cor) ? cor : 0
    },
  }
  trocarLista([...lista.filter((t) => t.id !== id), textura])
  return true
}

/** Tira todas as do pacote (o pacote novo substitui o anterior inteiro). As embutidas ficam. */
export function esquecerTexturasDeFora(): void {
  if (lista === EMBUTIDAS) return
  trocarLista(EMBUTIDAS)
}

export { IDS_DAS_EMBUTIDAS }
