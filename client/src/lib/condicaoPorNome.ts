import type { CondicaoPropria, Token, TokenCondition } from '../types/map'
import { CONDICOES_POR_FICHA_MAX, condicoesPropriasOf } from './condicoesProprias'
import { TOKEN_CONDITION_LABELS, TOKEN_CONDITION_ORDER, tokenConditionsOf } from './tokenConditions'

/**
 * UMA CONDIÇÃO SÓ, PELO NOME (Fase 3 do plano de melhoria, 15/11/2026; regra
 * em `tmp/fase-3-condicoes/REGRA.md`). A condição existia em quatro lugares
 * que não se falavam: a pastilha de fábrica (`Token.conditions`), a criada
 * pelo mestre (`Token.condicoesProprias`), o selo da batalha One Piece e a
 * condição da batalha Dragon Ball. O que liga os quatro é o NOME: "Atordoado"
 * no selo, na condição do Dragon Ball e na pastilha são a mesma coisa.
 *
 * Aqui mora o pedaço que só mexe na PASTILHA: achar a marca de um nome,
 * acender e apagar. O prazo (turnos e vida por turno) mora em
 * `lib/prazoDaCondicao.ts`, e a ponte da batalha em `lib/ponteDasCondicoes.ts`.
 *
 * Puro: sem store, sem rede, sem Pixi.
 */

/**
 * A chave de um nome: sem acento, sem caixa, espaços enxugados. "Caído",
 * " caido " e "CAIDO" são a mesma condição. Chave de chave é ela mesma.
 */
export function chaveDaCondicao(nome: string): string {
  return nome.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

/** A pastilha que um nome acende: uma das de fábrica, ou uma criada pelo mestre. */
export type MarcaDoNome = { tipo: 'fabrica'; condicao: TokenCondition } | { tipo: 'propria'; condicao: CondicaoPropria }

/** A condição de fábrica com este nome ("Envenenado", "caido"); `null` = nenhuma. */
export function condicaoDeFabricaPeloNome(nome: string): TokenCondition | null {
  const chave = chaveDaCondicao(nome)
  return TOKEN_CONDITION_ORDER.find((condicao) => chaveDaCondicao(TOKEN_CONDITION_LABELS[condicao]) === chave) ?? null
}

/**
 * A pastilha que o nome acende. A de FÁBRICA vence: "Envenenado" é sempre a
 * gota verde, mesmo que o mestre tenha criado uma "Envenenado" (assim a regra
 * do Lento, presa à pastilha de fábrica, vale para qualquer "Lento" que chegue).
 * Sem a de fábrica, a primeira criada do catálogo com o mesmo nome. `null` =
 * nome sem pastilha ("Aéreo", se o mestre não criou uma).
 */
export function marcaDoNome(nome: string, catalogo: readonly CondicaoPropria[]): MarcaDoNome | null {
  const deFabrica = condicaoDeFabricaPeloNome(nome)
  if (deFabrica !== null) return { tipo: 'fabrica', condicao: deFabrica }
  const chave = chaveDaCondicao(nome)
  const propria = catalogo.find((candidata) => chaveDaCondicao(candidata.nome) === chave)
  return propria === undefined ? null : { tipo: 'propria', condicao: propria }
}

/** As chaves das pastilhas acesas na ficha: as de fábrica pelo rótulo, as criadas pelo nome. */
export function chavesAcesasNaFicha(token: { conditions?: unknown; condicoesProprias?: unknown }): Set<string> {
  const chaves = new Set(tokenConditionsOf(token).map((condicao) => chaveDaCondicao(TOKEN_CONDITION_LABELS[condicao])))
  for (const propria of condicoesPropriasOf(token)) chaves.add(chaveDaCondicao(propria.nome))
  return chaves
}

/** A ficha tem acesa uma pastilha com este nome (de fábrica ou criada)? */
export function fichaTemCondicao(token: { conditions?: unknown; condicoesProprias?: unknown }, nome: string): boolean {
  return chavesAcesasNaFicha(token).has(chaveDaCondicao(nome))
}

/** A ficha com exatamente estas condições de fábrica. Lista vazia APAGA o campo, como em `toggleTokenCondition`. */
function comDeFabrica(token: Token, condicoes: readonly TokenCondition[]): Token {
  const { conditions: _antigas, ...sem } = token
  return condicoes.length === 0 ? sem : { ...sem, conditions: [...condicoes] }
}

/** A ficha com exatamente estas condições criadas. Lista vazia APAGA o campo, como em `alternarCondicaoPropria`. */
function comProprias(token: Token, lista: readonly CondicaoPropria[]): Token {
  const { condicoesProprias: _antigas, ...sem } = token
  return lista.length === 0 ? sem : { ...sem, condicoesProprias: [...lista] }
}

/**
 * Acende a pastilha do nome na ficha. Devolve a MESMA ficha quando nada muda:
 * nome sem pastilha, pastilha já acesa (de fábrica ou uma criada com o mesmo
 * nome) ou ficha no teto das criadas (`CONDICOES_POR_FICHA_MAX`).
 */
export function acenderPeloNome(token: Token, nome: string, catalogo: readonly CondicaoPropria[]): Token {
  if (fichaTemCondicao(token, nome)) return token
  const marca = marcaDoNome(nome, catalogo)
  if (marca === null) return token
  if (marca.tipo === 'fabrica') {
    const atuais = tokenConditionsOf(token)
    return comDeFabrica(token, TOKEN_CONDITION_ORDER.filter((condicao) => condicao === marca.condicao || atuais.includes(condicao)))
  }
  const atuais = condicoesPropriasOf(token)
  if (atuais.length >= CONDICOES_POR_FICHA_MAX) return token
  return comProprias(token, [...atuais, marca.condicao])
}

/**
 * Apaga TODA pastilha com este nome: a de fábrica e as criadas com o mesmo
 * nome (o mestre pode ter marcado as duas à mão). Só a pastilha: o prazo é de
 * `tirarCondicaoDaFicha` (`lib/prazoDaCondicao.ts`). A MESMA ficha quando nada muda.
 */
export function apagarPeloNome(token: Token, nome: string): Token {
  const chave = chaveDaCondicao(nome)
  const deFabrica = tokenConditionsOf(token)
  const ficamDeFabrica = deFabrica.filter((condicao) => chaveDaCondicao(TOKEN_CONDITION_LABELS[condicao]) !== chave)
  const proprias = condicoesPropriasOf(token)
  const ficamProprias = proprias.filter((propria) => chaveDaCondicao(propria.nome) !== chave)
  if (ficamDeFabrica.length === deFabrica.length && ficamProprias.length === proprias.length) return token
  let ficha = token
  if (ficamDeFabrica.length !== deFabrica.length) ficha = comDeFabrica(ficha, ficamDeFabrica)
  if (ficamProprias.length !== proprias.length) ficha = comProprias(ficha, ficamProprias)
  return ficha
}
