/**
 * AS MUNIÇÕES QUE A ARMA DO ACERVO ACEITA (pedido de 16/11/2026: "cada arma
 * pode usar certos de munição"): a lista `municoes` de cada arma do Acervo de
 * itens (`lib/acervoDeItens.ts`), com o nome de cada munição, para a leitura
 * da ficha (`armasDe`) mostrar cada uma como bala da arma ligada àquele item.
 *
 * O Acervo mora no disco do app do MESTRE: quem o lê (`stores/acervoDeItensStore.ts`)
 * põe a lista aqui a cada mudança. No mestre (e no host, que confere o tiro do
 * jogador) a arma tem as balas; no app do jogador a lista fica vazia, e o
 * host escolhe a munição do tiro dele (`balaDoPedido`, em `golpe.ts`).
 */

export interface MunicaoAceita {
  itemId: string
  nome: string
}

/** O tiro que a munição do Acervo declara (`ItemDoCatalogo.tiro`): o dano e o efeito da bala. */
export interface TiroDoAcervo {
  dano: string
  efeito: string
}

/** O que a lista precisa de cada item do Acervo. */
export interface ItemComMunicoes {
  id: string
  nome: string
  municoes?: readonly string[]
  tiro?: TiroDoAcervo
}

const NENHUMA: readonly MunicaoAceita[] = []
let porArma: ReadonlyMap<string, readonly MunicaoAceita[]> = new Map()
let tiros: ReadonlyMap<string, TiroDoAcervo> = new Map()
let nomesNoAcervo: ReadonlyMap<string, string> = new Map()
let versao = 0

/** Troca a lista inteira pela do Acervo de agora. Munição que saiu do Acervo sai da arma. */
export function definirMunicoesDasArmas(itens: readonly ItemComMunicoes[]): void {
  const nomes = new Map(itens.map((item) => [item.id, item.nome]))
  const novo = new Map<string, readonly MunicaoAceita[]>()
  for (const item of itens) {
    const aceitas = (item.municoes ?? []).flatMap((itemId) => {
      const nome = nomes.get(itemId)
      return nome === undefined ? [] : [{ itemId, nome }]
    })
    if (aceitas.length > 0) novo.set(item.id, aceitas)
  }
  porArma = novo
  nomesNoAcervo = nomes
  const novosTiros = new Map<string, TiroDoAcervo>()
  for (const item of itens) if (item.tiro !== undefined) novosTiros.set(item.id, item.tiro)
  tiros = novosTiros
  versao += 1
}

/** As munições que a arma do Acervo `itemId` aceita; nenhuma = a arma não declara (ou não é do Acervo). */
export function municoesDaArma(itemId: string | undefined): readonly MunicaoAceita[] {
  return itemId === undefined ? NENHUMA : (porArma.get(itemId) ?? NENHUMA)
}

/**
 * MUNIÇÃO COMO FONTE ÚNICA (decisão do dono de 25/11/2026): o tiro que a munição `itemId` do Acervo
 * declara. `undefined` = o item não declara (ou não é do Acervo, ou é o app do jogador, que não o vê):
 * a bala fica com o dano e o efeito que tinha.
 */
export function tiroDaMunicao(itemId: string | undefined): TiroDoAcervo | undefined {
  return itemId === undefined ? undefined : tiros.get(itemId)
}

/**
 * O nome de AGORA do item `itemId` no Acervo (a vaga da mochila guarda o nome da hora em que foi dada).
 * `undefined` = fora do Acervo, ou o app do jogador, que não o vê.
 */
export function nomeNoAcervo(itemId: string | undefined): string | undefined {
  return itemId === undefined ? undefined : nomesNoAcervo.get(itemId)
}

/** Muda a cada `definirMunicoesDasArmas`: a leitura guardada das armas (`armasDe`) é refeita. */
export function versaoDasMunicoes(): number {
  return versao
}
