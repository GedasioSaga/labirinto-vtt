import type { CondicaoPropria, MapData, PrazoDeCondicao, Token } from '../types/map'
import { acenderPeloNome, apagarPeloNome, chaveDaCondicao, chavesAcesasNaFicha, fichaTemCondicao } from './condicaoPorNome'

/**
 * PRAZO DA CONDIÇÃO (Fase 3 do plano de melhoria, 15/11/2026; regra também em
 * `tmp/fase-3-condicoes/REGRA.md`): quantos turnos a pastilha ainda dura e
 * quanta vida ela tira por turno. É o modelo que a armadilha do baú (Fase C)
 * usa: cobra = dano + "Envenenado" 3 turnos tirando 4 por turno; aranha = dano
 * + "Lento" 2 turnos.
 *
 * O MODELO é o mesmo do selo da batalha One Piece (`SeloDaBatalha.turnos` e
 * `.porVez`): turnos que faltam e vida por vez. O prazo mora NA FICHA
 * (`Token.prazosDasCondicoes`), uma entrada por nome, e só vale enquanto a
 * pastilha de mesmo nome está acesa.
 *
 * QUEM CONTA OS TURNOS:
 *  - FORA DA BATALHA: o botão "Passar turno" do mestre (Fase C) chama
 *    `passarTurnoNoMapa`: cada ficha com prazo perde a vida do turno e desconta
 *    1 turno, de uma vez.
 *  - NA BATALHA (One Piece ou Dragon Ball): a vez da ficha. No COMEÇO da vez,
 *    `vidaDoComecoDaVez` diz quanto tirar (o mesmo momento do lembrete do
 *    Sangrando); no FIM da vez, `contarFimDaVez` desconta 1 turno (o mesmo
 *    momento em que o selo desconta, `contarSelos`). Assim "Lento 2" vale as
 *    duas vezes inteiras seguintes, como o "Atordoado 2" do selo.
 *  - "Passar turno" = começo + fim de uma vez (`passarTurnoDaFicha`): o total
 *    é o mesmo (Envenenado 3 x 4 tira 12 nos dois caminhos).
 *
 * QUEM TIRA A VIDA não é este arquivo: ele só diz quanto. A vida mora na ficha
 * de personagem; fora da batalha passa por `aplicarAjuste`
 * (`lib/ajusteDaFicha.ts`), na batalha pelo caminho de dano dela.
 *
 * QUANDO ACABA: os turnos chegam a 0 (a pastilha apaga junto), o mestre tira a
 * pastilha (o prazo órfão morre no próximo desconto, sem tirar vida), ou quem
 * chama tira pelo nome (`tirarCondicaoDaFicha`: a cura, o mestre).
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** Teto dos turnos de um prazo: arquivo editado à mão não vira condição eterna disfarçada. */
export const PRAZO_TURNOS_MAX = 99
/** Teto da vida por turno. */
export const PRAZO_POR_VEZ_MAX = 999
/** Quantos prazos uma ficha leva: um por pastilha (as de fábrica mais as criadas). */
const PRAZOS_POR_FICHA_MAX = 16

function inteiroEntre(valor: unknown, minimo: number, maximo: number): number | null {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= minimo && valor <= maximo ? valor : null
}

/** Guarda de leitura de um prazo cru (disco, rede). Nome vazio, turnos fora de 1..99 = não é prazo; vida por turno torta só some. */
export function lerPrazo(valor: unknown): PrazoDeCondicao | null {
  if (typeof valor !== 'object' || valor === null) return null
  const nome: unknown = Reflect.get(valor, 'nome')
  const turnos = inteiroEntre(Reflect.get(valor, 'turnos'), 1, PRAZO_TURNOS_MAX)
  if (typeof nome !== 'string' || chaveDaCondicao(nome) === '' || turnos === null) return null
  const porVez = inteiroEntre(Reflect.get(valor, 'porVez'), 1, PRAZO_POR_VEZ_MAX)
  const prazo: PrazoDeCondicao = { nome: nome.trim(), turnos }
  if (porVez !== null) prazo.porVez = porVez
  return prazo
}

/**
 * Os prazos que valem na ficha: limpos, um por nome (o primeiro fica) e só os
 * de pastilha ACESA. O parâmetro é cru pelo mesmo motivo de `tokenConditionsOf`:
 * o mapa do disco chega sem passar por guarda.
 */
export function prazosDaFicha(token: { conditions?: unknown; condicoesProprias?: unknown; prazosDasCondicoes?: unknown }): PrazoDeCondicao[] {
  const cru = token.prazosDasCondicoes
  if (!Array.isArray(cru)) return []
  const acesas = chavesAcesasNaFicha(token)
  const vistas = new Set<string>()
  const prazos: PrazoDeCondicao[] = []
  for (const item of cru) {
    const prazo = lerPrazo(item)
    if (prazo === null) continue
    const chave = chaveDaCondicao(prazo.nome)
    if (vistas.has(chave) || !acesas.has(chave)) continue
    vistas.add(chave)
    prazos.push(prazo)
    if (prazos.length === PRAZOS_POR_FICHA_MAX) break
  }
  return prazos
}

/** O prazo da condição `nome` na ficha; `null` = sem prazo (fica até alguém tirar). */
export function prazoDaCondicao(token: Token, nome: string): PrazoDeCondicao | null {
  const chave = chaveDaCondicao(nome)
  return prazosDaFicha(token).find((prazo) => chaveDaCondicao(prazo.nome) === chave) ?? null
}

/** A ficha com exatamente estes prazos. Lista vazia APAGA o campo: a ficha volta a ser a de antes. */
function comPrazos(token: Token, prazos: readonly PrazoDeCondicao[]): Token {
  const { prazosDasCondicoes: _antigos, ...sem } = token
  return prazos.length === 0 ? sem : { ...sem, prazosDasCondicoes: [...prazos] }
}

/** O que `porCondicaoNaFicha` recebe além do nome: turnos e vida por turno. Sem isto, a condição fica até alguém tirar. */
export interface PrazoPedido {
  turnos: number
  porVez?: number
}

/**
 * O CAMINHO ÚNICO PARA PÔR UMA CONDIÇÃO NA FICHA fora da batalha (a armadilha,
 * o mestre): acende a pastilha do nome e, com `prazo`, grava os turnos e a vida
 * por turno. Pôr de novo o mesmo nome RENOVA o prazo (a segunda picada de cobra
 * recomeça os 3 turnos), não soma outro. Sem `prazo`, um prazo antigo do mesmo
 * nome sai (a condição passa a durar até alguém tirar).
 *
 * Nome sem pastilha (nem de fábrica, nem criada no `catalogo`), prazo torto ou
 * ficha no teto das criadas: devolve a MESMA ficha, nada aceso.
 */
export function porCondicaoNaFicha(token: Token, nome: string, catalogo: readonly CondicaoPropria[], prazo?: PrazoPedido): Token {
  const acesa = acenderPeloNome(token, nome, catalogo)
  if (!fichaTemCondicao(acesa, nome)) return token
  const chave = chaveDaCondicao(nome)
  const outros = prazosDaFicha(acesa).filter((candidato) => chaveDaCondicao(candidato.nome) !== chave)
  if (prazo === undefined) return outros.length === prazosDaFicha(acesa).length ? acesa : comPrazos(acesa, outros)
  const lido = lerPrazo({ nome, ...prazo })
  if (lido === null) return token
  return comPrazos(acesa, [...outros, lido])
}

/** Tira a condição pelo nome: a pastilha (de fábrica e as criadas com o mesmo nome) e o prazo dela. A MESMA ficha quando nada muda. */
export function tirarCondicaoDaFicha(token: Token, nome: string): Token {
  const apagada = apagarPeloNome(token, nome)
  const chave = chaveDaCondicao(nome)
  const prazos = Array.isArray(apagada.prazosDasCondicoes) ? apagada.prazosDasCondicoes : []
  const ficam = prazos.filter((prazo) => chaveDaCondicao(lerPrazo(prazo)?.nome ?? '') !== chave)
  return ficam.length === prazos.length ? apagada : comPrazos(apagada, ficam.map(lerPrazo).filter((prazo): prazo is PrazoDeCondicao => prazo !== null))
}

/** O mapa com a ficha `tokenId` trocada por `mudar`; o MESMO mapa quando a ficha não existe ou não muda. */
export function mudarFichaNoMapa(map: MapData, tokenId: string, mudar: (token: Token) => Token): MapData {
  const indice = map.tokens.findIndex((token) => token.id === tokenId)
  if (indice === -1) return map
  const antes = map.tokens[indice]
  const depois = mudar(antes)
  if (depois === antes) return map
  const tokens = map.tokens.slice()
  tokens[indice] = depois
  return { ...map, tokens }
}

// ───────────────────────────────────────────────────────────────────────────
// O TIQUE: vida no começo da vez, desconto no fim
// ───────────────────────────────────────────────────────────────────────────

/** Uma condição que tirou vida neste turno. */
export interface VidaDoTurno {
  nome: string
  dano: number
}

/**
 * COMEÇO DA VEZ (ou do turno fora da batalha): quanto a ficha perde agora,
 * somando toda condição com vida por turno. Não mexe na ficha: o desconto é
 * de `contarFimDaVez`. `dano` 0 = nada a tirar.
 */
export function vidaDoComecoDaVez(token: Token): { dano: number; danos: VidaDoTurno[] } {
  const danos = prazosDaFicha(token).flatMap((prazo) => (prazo.porVez === undefined ? [] : [{ nome: prazo.nome, dano: prazo.porVez }]))
  return { dano: danos.reduce((soma, parte) => soma + parte.dano, 0), danos }
}

/**
 * FIM DA VEZ (ou do turno fora da batalha): cada prazo desconta 1 turno; o
 * que chega a 0 sai, e a pastilha dele apaga. `seguradas` = chaves de nome que
 * a BATALHA ainda segura acesas na ficha (selo ou condição do Dragon Ball de
 * mesmo nome, `chavesDaFichaNaBatalha`): o prazo sai, a pastilha fica. Prazo
 * órfão (o mestre apagou a pastilha à mão) sai sem contar. Nada mudou = a
 * MESMA ficha.
 */
export function contarFimDaVez(token: Token, seguradas: ReadonlySet<string> = new Set()): { token: Token; acabaram: string[] } {
  const cru = token.prazosDasCondicoes
  if (!Array.isArray(cru) || cru.length === 0) return { token, acabaram: [] }
  const acabaram: string[] = []
  const ficam: PrazoDeCondicao[] = []
  for (const prazo of prazosDaFicha(token)) {
    if (prazo.turnos <= 1) acabaram.push(prazo.nome)
    else ficam.push({ ...prazo, turnos: prazo.turnos - 1 })
  }
  let ficha = comPrazos(token, ficam)
  for (const nome of acabaram) if (!seguradas.has(chaveDaCondicao(nome))) ficha = apagarPeloNome(ficha, nome)
  return { token: ficha, acabaram }
}

/** Um turno inteiro de uma ficha: o que ela perde de vida e o que acabou. */
export interface TiqueDaFicha {
  token: Token
  /** Vida a tirar agora, somada; 0 = nenhuma. */
  dano: number
  danos: VidaDoTurno[]
  /** Os nomes que acabaram neste turno (a pastilha apagou, salvo a segurada pela batalha). */
  acabaram: string[]
}

/** Um turno inteiro (o "Passar turno" do mestre): a vida do começo e o desconto do fim, nesta ordem. */
export function passarTurnoDaFicha(token: Token, seguradas?: ReadonlySet<string>): TiqueDaFicha {
  const { dano, danos } = vidaDoComecoDaVez(token)
  const fim = contarFimDaVez(token, seguradas)
  return { token: fim.token, dano, danos, acabaram: fim.acabaram }
}

/** O que mudou numa ficha no "Passar turno" do mapa. */
export interface TiqueNoMapa extends Omit<TiqueDaFicha, 'token'> {
  tokenId: string
  /** A ficha de personagem ligada (onde a vida mora); `null` = token sem ficha (a vida não tem onde cair). */
  characterId: string | null
}

/**
 * O "PASSAR TURNO" DO MESTRE (fora da batalha): toda ficha com prazo passa um
 * turno. Devolve o mapa novo (o MESMO quando ninguém tinha prazo) e, por
 * ficha que mudou, a vida a tirar e o que acabou. Quem chama tira a vida pela
 * ficha de personagem (`aplicarAjuste`) e grava o mapa num passo só.
 * `seguradas(tokenId)`: as chaves que uma batalha ainda segura na ficha.
 */
export function passarTurnoNoMapa(map: MapData, seguradas?: (tokenId: string) => ReadonlySet<string>): { map: MapData; fichas: TiqueNoMapa[] } {
  const fichas: TiqueNoMapa[] = []
  let mudou = false
  const tokens = map.tokens.map((token) => {
    if (!Array.isArray(token.prazosDasCondicoes)) return token
    const tique = passarTurnoDaFicha(token, seguradas?.(token.id))
    if (tique.token !== token) mudou = true
    // O prazo órfão que só foi limpo muda a ficha, mas não é notícia para o mestre.
    if (tique.dano > 0 || tique.acabaram.length > 0) fichas.push({ tokenId: token.id, characterId: token.characterId, dano: tique.dano, danos: tique.danos, acabaram: tique.acabaram })
    return tique.token
  })
  return { map: mudou ? { ...map, tokens } : map, fichas }
}
