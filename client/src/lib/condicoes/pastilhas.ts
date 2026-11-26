import type { CondicaoPropria, Token, TokenCondition } from '../../types/map'
import { chaveDaCondicao } from '../condicaoPorNome'
import { CONDICOES_POR_FICHA_MAX, condicoesPropriasOf } from '../condicoesProprias'
import type { CondicaoNaFicha } from '../itens/modelo'
import type { Personagem } from '../personagem'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER, tokenConditionsOf } from '../tokenConditions'
import { condicaoDoCatalogo } from './catalogo'

/**
 * AS PASTILHAS DE UM TOKEN (sistema de itens refeito, PLANO §1.5; etapa E4a): o que o mapa e o
 * recorte do jogador desenham em cima da ficha, lido da FICHA DE PERSONAGEM ligada
 * (`Personagem.condicoes`; no NPC, a cópia daquele token, então o Zumbi 1 não acende o Zumbi 2).
 *
 * Sai no formato que o desenho já conhece (`pixi/drawTokenConditions.ts` e a tela de quem joga):
 * as seis de fábrica pelo id (`conditions`) e as outras inteiras, no molde das criadas
 * (`condicoesProprias`). Assim nem o desenho nem o jogador mudam.
 *
 * PASSAGEM (até a E7 tirar as condições do token com ficha): o que ainda está gravado no próprio
 * token (`Token.conditions`, `condicoesProprias`) continua aceso junto, sem repetir nome. Token sem
 * ficha continua só com o dele (A3).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

export interface PastilhasDoToken {
  conditions: TokenCondition[]
  condicoesProprias: CondicaoPropria[]
}

/** Por tokenId, as pastilhas que a ficha ligada acende (montado pelo host, que tem os personagens). */
export type PastilhasDasFichas = ReadonlyMap<string, PastilhasDoToken>

const NENHUMA: readonly CondicaoNaFicha[] = []

/**
 * Junta as pastilhas na ordem do painel: de fábrica (pela ordem de sempre) e as outras pela
 * ordem em que chegam, sem repetir nome e no teto das criadas por ficha.
 */
function juntar(deFabrica: ReadonlySet<TokenCondition>, outras: readonly CondicaoPropria[]): PastilhasDoToken {
  const conditions = TOKEN_CONDITION_ORDER.filter((condicao) => deFabrica.has(condicao))
  const vistas = new Set(conditions.map((condicao) => chaveDaCondicao(TOKEN_CONDITION_LABELS[condicao])))
  const condicoesProprias: CondicaoPropria[] = []
  for (const propria of outras) {
    const chave = chaveDaCondicao(propria.nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    condicoesProprias.push(propria)
    if (condicoesProprias.length === CONDICOES_POR_FICHA_MAX) break
  }
  return { conditions, condicoesProprias }
}

function separar(condicoes: readonly CondicaoNaFicha[], criadas: readonly CondicaoPropria[], deFabrica: Set<TokenCondition>, outras: CondicaoPropria[]): void {
  for (const condicao of condicoes) {
    const doCatalogo = condicaoDoCatalogo(condicao.condId, criadas)
    // A criada que o mestre apagou do catálogo não tem desenho: fica na ficha, não acende.
    if (doCatalogo === null) continue
    if (doCatalogo.pastilha.tipo === 'fabrica') deFabrica.add(doCatalogo.pastilha.condicao)
    else outras.push(doCatalogo.pastilha.condicao)
  }
}

/** As pastilhas das condições de uma ficha. */
export function pastilhasDaFicha(condicoes: readonly CondicaoNaFicha[] | undefined, criadas: readonly CondicaoPropria[]): PastilhasDoToken {
  const deFabrica = new Set<TokenCondition>()
  const outras: CondicaoPropria[] = []
  separar(condicoes ?? NENHUMA, criadas, deFabrica, outras)
  return juntar(deFabrica, outras)
}

/**
 * As pastilhas de um token: as da ficha ligada (`personagem`, quando há) mais as que ainda estão
 * gravadas no token (a passagem). `personagem` ausente = token sem ficha, ou ficha que não abriu.
 */
export function pastilhasDoToken(token: Pick<Token, 'conditions' | 'condicoesProprias'>, personagem: Pick<Personagem, 'condicoes'> | undefined, criadas: readonly CondicaoPropria[]): PastilhasDoToken {
  const deFabrica = new Set<TokenCondition>(tokenConditionsOf(token))
  const outras: CondicaoPropria[] = []
  if (personagem !== undefined) separar(personagem.condicoes ?? NENHUMA, criadas, deFabrica, outras)
  outras.push(...condicoesPropriasOf(token))
  return juntar(deFabrica, outras)
}

/**
 * Por token do mapa, as pastilhas de quem tem ficha com condição (as do token entram junto). Token
 * sem ficha, ou ficha sem condição, fica de fora: quem lê usa as do próprio token, como antes.
 * `undefined` = nenhuma ficha do mapa tem condição (nada é montado).
 */
export function pastilhasDasFichasDoMapa(tokens: readonly Token[], personagens: readonly Personagem[], criadas: readonly CondicaoPropria[]): PastilhasDasFichas | undefined {
  let pastilhas: Map<string, PastilhasDoToken> | undefined
  let porId: ReadonlyMap<string, Personagem> | undefined
  for (const token of tokens) {
    if (token.characterId === null) continue
    porId ??= new Map(personagens.map((personagem) => [personagem.id, personagem]))
    const personagem = porId.get(token.characterId)
    if (personagem?.condicoes === undefined) continue
    pastilhas ??= new Map()
    pastilhas.set(token.id, pastilhasDoToken(token, personagem, criadas))
  }
  return pastilhas
}

function mesmaPastilha(a: PastilhasDoToken, b: PastilhasDoToken): boolean {
  return (
    a.conditions.length === b.conditions.length &&
    a.conditions.every((condicao, i) => condicao === b.conditions[i]) &&
    a.condicoesProprias.length === b.condicoesProprias.length &&
    a.condicoesProprias.every((propria, i) => {
      const outra = b.condicoesProprias[i]
      return propria.id === outra.id && propria.nome === outra.nome && propria.cor === outra.cor && propria.simbolo === outra.simbolo && propria.texto === outra.texto
    })
  )
}

/** Mesmo conteúdo (o host compara para saber se o recorte do jogador sairia igual). */
export function mesmasPastilhas(a: PastilhasDasFichas | undefined, b: PastilhasDasFichas | undefined): boolean {
  if (a === b) return true
  if (a === undefined || b === undefined || a.size !== b.size) return false
  for (const [tokenId, pastilhas] of a) {
    const outra = b.get(tokenId)
    if (outra === undefined || !mesmaPastilha(pastilhas, outra)) return false
  }
  return true
}
