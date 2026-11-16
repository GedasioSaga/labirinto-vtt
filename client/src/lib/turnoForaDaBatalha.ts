import type { MapData, PrazoDeCondicao, Token } from '../types/map'
import { NOME_DO_MESTRE, aplicarAjustes } from './ajusteDaFicha'
import { chaveDaCondicao } from './condicaoPorNome'
import { condicoesPropriasOf, simboloDaCondicaoPropria } from './condicoesProprias'
import type { Personagem } from './personagem'
import { passarTurnoNoMapa, prazosDaFicha } from './prazoDaCondicao'
import type { SistemaDeRpg } from './sistemaDeRpg'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER, TOKEN_CONDITION_SYMBOLS, tokenConditionsOf, type ConditionSymbol } from './tokenConditions'
import { recursoDeVida, vidaDoPersonagem } from './vidaDaFicha'

/**
 * O "PASSAR TURNO" DO MESTRE FORA DA BATALHA (Fase C, item 4, 15/11/2026;
 * regra em `tmp/fase-3-condicoes/REGRA.md`). O botão mora no topo do Grupo
 * (`components/TurnoForaDaBatalha.tsx`) e conta, de uma vez, o turno de toda
 * ficha da cena com prazo: a vida do começo e o desconto do fim
 * (`passarTurnoNoMapa`). Aqui mora a conta inteira, sem store:
 *  - o mapa novo e, por ficha que mudou, as condições de antes e de depois
 *    (o Desfazer volta exatamente as de antes);
 *  - a vida que cada personagem perde, no recurso de vida do sistema
 *    (`recursoDeVida`), com o de-para para gravar e para desfazer;
 *  - a frase do resumo ("Brann perdeu 4 PV (Envenenado, faltam 2)").
 *
 * Puro: quem chama dá o mapa, os personagens e o sistema, e grava.
 */

/** Os campos da ficha que o turno mexe: a pastilha de fábrica, as criadas e o prazo. */
export type CondicoesDaFicha = Pick<Token, 'conditions' | 'condicoesProprias' | 'prazosDasCondicoes'>

/** Cópia rasa dos três campos; o ausente fica ausente (o Desfazer o apaga de novo). */
export function condicoesDaFicha(token: Token): CondicoesDaFicha {
  const campos: CondicoesDaFicha = {}
  if (token.conditions !== undefined) campos.conditions = token.conditions
  if (token.condicoesProprias !== undefined) campos.condicoesProprias = token.condicoesProprias
  if (token.prazosDasCondicoes !== undefined) campos.prazosDasCondicoes = token.prazosDasCondicoes
  return campos
}

function mesmasCondicoes(token: Token, campos: CondicoesDaFicha): boolean {
  return token.conditions === campos.conditions && token.condicoesProprias === campos.condicoesProprias && token.prazosDasCondicoes === campos.prazosDasCondicoes
}

/** A ficha com EXATAMENTE estes três campos (o que falta em `campos` sai da ficha). O resto da ficha (onde está, o nome) fica. */
export function comCondicoes(token: Token, campos: CondicoesDaFicha): Token {
  const { conditions: _fabrica, condicoesProprias: _criadas, prazosDasCondicoes: _prazos, ...resto } = token
  return { ...resto, ...campos }
}

/**
 * Troca as condições das fichas `porToken` e só elas; ficha que sumiu do mapa
 * fica de fora. Nada mudou = o MESMO mapa (o contrato de `applyPlayerChange`,
 * que reaplica isto em cada passo guardado do Ctrl+Z).
 */
export function trocarCondicoesNoMapa(map: MapData, porToken: ReadonlyMap<string, CondicoesDaFicha>): MapData {
  let mudou = false
  const tokens = map.tokens.map((token) => {
    const campos = porToken.get(token.id)
    if (campos === undefined || mesmasCondicoes(token, campos)) return token
    mudou = true
    return comCondicoes(token, campos)
  })
  return mudou ? { ...map, tokens } : map
}

/** A vida que um personagem perdeu no turno, no recurso de vida do sistema: `de` → `para`. */
export interface PerdaDeVida {
  personagemId: string
  recursoId: string
  de: number
  para: number
}

/** Um turno passado: o mapa novo, as condições de antes e de depois de cada ficha que mudou, a vida perdida e o resumo. */
export interface TurnoPassado {
  map: MapData
  antes: ReadonlyMap<string, CondicoesDaFicha>
  depois: ReadonlyMap<string, CondicoesDaFicha>
  perdas: PerdaDeVida[]
  /** Uma frase por ficha com prazo, na ordem do mapa ("Tomás: Lento faltam 1"). */
  partes: string[]
}

/** O nome da ficha no resumo: o do token, ou o do personagem ligado. */
function nomeNoResumo(token: Token, personagens: readonly Personagem[]): string {
  const doToken = token.name.trim()
  if (doToken !== '') return doToken
  return personagens.find((personagem) => personagem.id === token.characterId)?.nome.trim() || 'Ficha sem nome'
}

/** "faltam 2" ou "acabou", pelo prazo do mesmo nome na ficha DEPOIS do turno. */
function estadoDepois(prazo: PrazoDeCondicao, depois: readonly PrazoDeCondicao[]): string {
  const chave = chaveDaCondicao(prazo.nome)
  const ficou = depois.find((candidato) => chaveDaCondicao(candidato.nome) === chave)
  return ficou === undefined ? 'acabou' : `faltam ${ficou.turnos}`
}

/**
 * A frase de uma ficha. `perdeu` = PV que saíram de verdade (o piso 0 corta);
 * `null` = a ficha não tem onde a vida cair (sem personagem, sistema sem vida):
 * só os prazos. "Brann perdeu 4 PV (Envenenado, faltam 2), Lento faltam 1".
 */
export function fraseDaFicha(nome: string, antes: readonly PrazoDeCondicao[], depois: readonly PrazoDeCondicao[], perdeu: number | null): string {
  const tiram = antes.filter((prazo) => prazo.porVez !== undefined)
  if (perdeu === null || tiram.length === 0) return `${nome}: ${antes.map((prazo) => `${prazo.nome} ${estadoDepois(prazo, depois)}`).join(', ')}`
  const cabeca = `${nome} perdeu ${perdeu} PV (${tiram.map((prazo) => `${prazo.nome}, ${estadoDepois(prazo, depois)}`).join('; ')})`
  const outros = antes.filter((prazo) => prazo.porVez === undefined).map((prazo) => `${prazo.nome} ${estadoDepois(prazo, depois)}`)
  return outros.length === 0 ? cabeca : `${cabeca}, ${outros.join(', ')}`
}

/**
 * O turno inteiro fora da batalha. `null` = ninguém na cena tem prazo (nada
 * a passar). A vida sai em ordem de ficha: dois tokens do mesmo personagem
 * somam, e o piso 0 vale para a soma. `seguradas`: as chaves que uma batalha
 * ainda segura acesas na ficha (`chavesDaFichaNaBatalha`).
 */
export function passarTurnoForaDaBatalha(
  map: MapData,
  personagens: readonly Personagem[],
  sistema: SistemaDeRpg | null,
  seguradas?: (tokenId: string) => ReadonlySet<string>,
): TurnoPassado | null {
  const { map: novo, fichas } = passarTurnoNoMapa(map, seguradas)
  if (novo === map) return null
  const recurso = recursoDeVida(sistema)
  const danoPorToken = new Map(fichas.map((ficha) => [ficha.tokenId, ficha.dano]))
  const depoisPorId = new Map(novo.tokens.map((token) => [token.id, token]))
  const atualPorPersonagem = new Map<string, { de: number; para: number }>()
  const antes = new Map<string, CondicoesDaFicha>()
  const depois = new Map<string, CondicoesDaFicha>()
  const partes: string[] = []
  for (const token of map.tokens) {
    const tokenDepois = depoisPorId.get(token.id)
    if (tokenDepois === undefined || tokenDepois === token) continue
    antes.set(token.id, condicoesDaFicha(token))
    depois.set(token.id, condicoesDaFicha(tokenDepois))
    const prazosAntes = prazosDaFicha(token)
    // A ficha que só perdeu um prazo órfão (a pastilha já apagada à mão) muda, mas não é notícia.
    if (prazosAntes.length === 0) continue
    const dano = danoPorToken.get(token.id) ?? 0
    const personagem = token.characterId === null ? undefined : personagens.find((candidato) => candidato.id === token.characterId)
    const vida = personagem === undefined || recurso === null ? null : vidaDoPersonagem(personagem, recurso)
    let perdeu: number | null = null
    if (personagem !== undefined && vida !== null) {
      const conta = atualPorPersonagem.get(personagem.id) ?? { de: vida.atual, para: vida.atual }
      const para = Math.max(0, conta.para - dano)
      perdeu = conta.para - para
      atualPorPersonagem.set(personagem.id, { de: conta.de, para })
    }
    partes.push(fraseDaFicha(nomeNoResumo(token, personagens), prazosAntes, prazosDaFicha(tokenDepois), perdeu))
  }
  const perdas: PerdaDeVida[] =
    recurso === null ? [] : [...atualPorPersonagem].flatMap(([personagemId, { de, para }]) => (de === para ? [] : [{ personagemId, recursoId: recurso.id, de, para }]))
  return { map: novo, antes, depois, perdas, partes }
}

/**
 * Grava a perda no personagem de AGORA (`ajustarPersonagem` da aventura):
 * o valor `para`, dito a partir de `de`. Se outra coisa mexeu na vida no meio
 * (um golpe), vale a diferença (`ajusteSobreOAtual`). O Desfazer chama com
 * `de` e `para` trocados.
 */
export function personagemComAPerda(atual: Personagem, sistema: SistemaDeRpg, perda: Pick<PerdaDeVida, 'recursoId' | 'de' | 'para'>, quando: number): Personagem {
  return aplicarAjustes(atual, sistema, [{ parte: 'recurso', chave: perda.recursoId, valor: perda.para, de: perda.de }], NOME_DO_MESTRE, quando)
}

// ───────────────────────────────────────────────────────────────────────────
// As pastilhas acesas, com o prazo (a lista do Grupo e o editor da ficha)
// ───────────────────────────────────────────────────────────────────────────

/** Uma pastilha acesa na ficha, com os turnos que faltam (`null` = sem prazo, fica até alguém tirar). */
export interface PastilhaAcesa {
  chave: string
  nome: string
  symbol: ConditionSymbol
  prazo: PrazoDeCondicao | null
}

/** As pastilhas acesas: primeiro as de fábrica, na ordem do painel; depois as criadas pelo mestre. */
export function pastilhasAcesas(token: Token): PastilhaAcesa[] {
  const prazos = prazosDaFicha(token)
  const prazoDe = (nome: string): PrazoDeCondicao | null => {
    const chave = chaveDaCondicao(nome)
    return prazos.find((prazo) => chaveDaCondicao(prazo.nome) === chave) ?? null
  }
  const acesas = tokenConditionsOf(token)
  const deFabrica = TOKEN_CONDITION_ORDER.filter((condicao) => acesas.includes(condicao)).map((condicao) => {
    const nome = TOKEN_CONDITION_LABELS[condicao]
    return { chave: chaveDaCondicao(nome), nome, symbol: TOKEN_CONDITION_SYMBOLS[condicao], prazo: prazoDe(nome) }
  })
  const vistas = new Set(deFabrica.map((pastilha) => pastilha.chave))
  const criadas: PastilhaAcesa[] = []
  for (const propria of condicoesPropriasOf(token)) {
    const chave = chaveDaCondicao(propria.nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    criadas.push({ chave, nome: propria.nome, symbol: simboloDaCondicaoPropria(propria), prazo: prazoDe(propria.nome) })
  }
  return [...deFabrica, ...criadas]
}
