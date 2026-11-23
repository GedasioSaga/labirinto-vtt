import { QUEDAS_MAX, USADAS_NO_RASTRO_MAX, chaveDaVez, type AlvoDoGolpe, type CombateDoPersonagem, type GolpeDaBatalha, type RastroDoCombate, type UltimaAcaoDoRastro } from './combate'
import type { TurnosDaCena } from './turnos'

/**
 * REQUISITOS, fase B3 (docs/design/habilidades/REQUISITOS.md §5): o RASTRO de cada personagem na
 * batalha (`CombateDoPersonagem.rastro`) e as quedas da batalha (`TurnosDaCena.jaCairam`), que os
 * requisitos de estado e de tempo leem (andou, acertou, errou, apanhou, a ação de antes, as já
 * usadas, o aliado que caiu). As lojas chamam isto onde o motor já aplica a ação, o golpe e o dano,
 * e guardam o antes e o depois na linha; o Desfazer volta campo a campo (`combateSemALinha`).
 *
 * As casas andadas na vez não moram aqui: `GastoDaVez.blocos` da carta já conta e zera a cada vez.
 * Os `caminhos` do mestre (`BatalhaDaCena.caminhos`) NÃO servem: somam desde que a batalha ligou
 * (ou desde o "Zerar caminhos") e não zeram por vez.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/** A vez de agora (`chaveDaVez`), ou `null` antes de começar. */
export function chaveDaVezDe(turnos: Pick<TurnosDaCena, 'rodada' | 'vez'>): string | null {
  return turnos.vez === null ? null : chaveDaVez(turnos.rodada, turnos.vez)
}

/** O rastro sem campo vazio; nada = `undefined` (o combate fica sem a chave). */
function rastroLimpo(rastro: RastroDoCombate): RastroDoCombate | undefined {
  const limpo: RastroDoCombate = {}
  if (rastro.vez !== undefined) limpo.vez = rastro.vez
  if (rastro.ultimoAtaque !== undefined) limpo.ultimoAtaque = rastro.ultimoAtaque
  if (rastro.ultimaAcao !== undefined) limpo.ultimaAcao = rastro.ultimaAcao
  if (rastro.usadas !== undefined && Object.keys(rastro.usadas).length > 0) limpo.usadas = rastro.usadas
  if (rastro.naRodada !== undefined && Object.keys(rastro.naRodada.usadas).length > 0) limpo.naRodada = rastro.naRodada
  if (rastro.danoDesdeAVez !== undefined && rastro.danoDesdeAVez > 0) limpo.danoDesdeAVez = rastro.danoDesdeAVez
  return Object.keys(limpo).length === 0 ? undefined : limpo
}

/** O combate com o rastro novo (vazio = sem a chave). */
function comRastro(combate: CombateDoPersonagem, rastro: RastroDoCombate): CombateDoPersonagem {
  const limpo = rastroLimpo(rastro)
  const { rastro: _antes, ...resto } = combate
  return limpo === undefined ? resto : { ...resto, rastro: limpo }
}

/** O começo da vez dele: o "apanhou desde a vez" (B6) volta a zero. Nada a zerar = o mesmo rastro. */
export function semODanoDaVez(rastro: RastroDoCombate | undefined): RastroDoCombate | undefined {
  if (rastro?.danoDesdeAVez === undefined) return rastro
  const { danoDesdeAVez: _dano, ...resto } = rastro
  return rastroLimpo(resto)
}

/** A contagem com mais um de `cartaoId`; cheia (`USADAS_NO_RASTRO_MAX` técnicas) e técnica nova = a mesma. */
function comMaisUma(usadas: Readonly<Record<string, number>> | undefined, cartaoId: string): Readonly<Record<string, number>> {
  const atual = usadas ?? {}
  const tinha = Object.hasOwn(atual, cartaoId) ? (atual[cartaoId] ?? 0) : 0
  if (tinha === 0 && Object.keys(atual).length >= USADAS_NO_RASTRO_MAX) return atual
  return { ...atual, [cartaoId]: tinha + 1 }
}

/** A técnica entra nas usadas da batalha (C3) e nas da rodada (G3). */
function comUsada(rastro: RastroDoCombate, cartaoId: string, rodada: number): RastroDoCombate {
  const daRodada = rastro.naRodada?.rodada === rodada ? rastro.naRodada.usadas : undefined
  return { ...rastro, usadas: comMaisUma(rastro.usadas, cartaoId), naRodada: { rodada, usadas: comMaisUma(daRodada, cartaoId) } }
}

/** A vez `chave` no rastro: a guardada, se é ela; senão, do zero. */
function vezDe(rastro: RastroDoCombate, chave: string): NonNullable<RastroDoCombate['vez']> {
  return rastro.vez?.chave === chave ? rastro.vez : { chave, acoes: 0 }
}

/**
 * Ele agiu (técnica, Atacar ou item): vira a ação de antes do C2, a técnica entra nas usadas e,
 * se `naVez` é a chave da vez DELE (a carta da vez é a dele), conta uma ação na vez (C4). Fora da
 * vez dele (o contra-ataque na vez de outro) = `null`: a vez dele não muda.
 */
export function comAcaoNoRastro(combate: CombateDoPersonagem, acao: UltimaAcaoDoRastro, rodada: number, naVez: string | null): CombateDoPersonagem {
  let rastro: RastroDoCombate = { ...(combate.rastro ?? {}), ultimaAcao: acao }
  if (acao.tipo === 'cartao') rastro = comUsada(rastro, acao.cartaoId, rodada)
  if (naVez !== null) {
    const vez = vezDe(rastro, naVez)
    rastro = { ...rastro, vez: { ...vez, acoes: vez.acoes + 1 } }
  }
  return comRastro(combate, rastro)
}

/** Usou a técnica na reação: entra nas usadas (C3, G3); a ação de antes e a vez não mudam. */
export function comReacaoNoRastro(combate: CombateDoPersonagem, cartaoId: string, rodada: number): CombateDoPersonagem {
  return comRastro(combate, comUsada(combate.rastro ?? {}, cartaoId, rodada))
}

/** Ele recebeu `valor` de dano (HP e Escudo) desde o começo da vez dele (B6). */
export function comDanoNoRastro(combate: CombateDoPersonagem, valor: number): CombateDoPersonagem {
  if (!(valor > 0)) return combate
  const rastro = combate.rastro ?? {}
  return comRastro(combate, { ...rastro, danoDesdeAVez: (rastro.danoDesdeAVez ?? 0) + valor })
}

/** O alvo é de ataque: o golpe tem dano para ele (a cura e a técnica de ajuda não contam). */
function ehAlvoDeAtaque(alvo: AlvoDoGolpe): boolean {
  return alvo.dano !== null
}

/** O alvo resolvido foi acertado: tomou o golpe (inteiro, metade, sem reagir). Esquivou, contra-atacou ou passou sem dano = não. */
export function acertouOAlvo(alvo: AlvoDoGolpe): boolean | null {
  if (alvo.saida === undefined) return null
  return alvo.saida !== 'esquiva' && alvo.saida !== 'contra' && alvo.semDano !== true
}

/** O que o golpe deu até agora: algum alvo de ataque acertado = acertou; resolvidos e nenhum acertado = errou; nenhum resolvido = `null`. */
export function resultadoDoGolpe(golpe: GolpeDaBatalha): 'acertou' | 'errou' | null {
  let algum = false
  for (const alvo of golpe.alvos) {
    if (!ehAlvoDeAtaque(alvo)) continue
    const acertou = acertouOAlvo(alvo)
    if (acertou === true) return 'acertou'
    if (acertou === false) algum = true
  }
  return algum ? 'errou' : null
}

/**
 * Os alvos de ataque que se resolveram de `antes` para `depois` (`antes` `null` = o golpe acabou
 * de nascer: todo resolvido conta).
 */
export function alvosResolvidosAgora(antes: GolpeDaBatalha | null, depois: GolpeDaBatalha): AlvoDoGolpe[] {
  return depois.alvos.filter((alvo) => {
    if (!ehAlvoDeAtaque(alvo) || alvo.saida === undefined) return false
    const deAntes = antes?.alvos.find((candidato) => candidato.tokenId === alvo.tokenId)
    return deAntes?.saida === undefined
  })
}

/**
 * O golpe dele se resolveu (de novo): o último ataque (B8) é o que o golpe deu; acertou e o golpe
 * é da vez de agora (`chaveDaVezDe` da cena) = "acertou na vez" (B7). O golpe de uma vez que já
 * passou (fechado na virada) só troca o último ataque.
 */
export function comGolpeNoRastro(combate: CombateDoPersonagem, golpe: GolpeDaBatalha, vezDeAgora: string | null): CombateDoPersonagem {
  const resultado = resultadoDoGolpe(golpe)
  if (resultado === null) return combate
  let rastro: RastroDoCombate = { ...(combate.rastro ?? {}), ultimoAtaque: resultado }
  const daVez = chaveDaVez(golpe.rodada, golpe.cartaId)
  if (resultado === 'acertou' && daVez === vezDeAgora) rastro = { ...rastro, vez: { ...vezDe(rastro, daVez), acertou: true } }
  return comRastro(combate, rastro)
}

/** Mais uma queda de `tokenId` na batalha (G5). Cheia (`QUEDAS_MAX`) = `null` (não entra, e a linha não guarda nada). */
export function comQueda(turnos: TurnosDaCena, tokenId: string): TurnosDaCena | null {
  const quedas = turnos.jaCairam ?? []
  if (quedas.length >= QUEDAS_MAX) return null
  return { ...turnos, jaCairam: [...quedas, tokenId] }
}

/** O Desfazer da queda: sai UMA entrada de `tokenId` (a última); a lista vazia sai da cena. */
export function semUmaQueda(turnos: TurnosDaCena, tokenId: string): TurnosDaCena {
  const quedas = turnos.jaCairam ?? []
  const indice = quedas.lastIndexOf(tokenId)
  if (indice < 0) return turnos
  const ficam = quedas.filter((_, i) => i !== indice)
  if (ficam.length > 0) return { ...turnos, jaCairam: ficam }
  const { jaCairam: _fora, ...resto } = turnos
  return resto
}

/** A ficha já caiu nesta batalha (G5: o montador pergunta pelos aliados). */
export function jaCaiuNaBatalha(turnos: Pick<TurnosDaCena, 'jaCairam'>, tokenId: string): boolean {
  return (turnos.jaCairam ?? []).includes(tokenId)
}
