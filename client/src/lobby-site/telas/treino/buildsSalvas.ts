import { recursoDoEscudo } from '../../../lib/batalha/leituraDaFicha'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import { ID_DO_JUIZ, recursoDaEnergia, type AjustesDoJuiz } from '../../../lib/treino/juiz'
import { lerTecnicasDeTreino, type TecnicaDeTreino } from '../../../lib/treino/tecnicaDeTreino'
import { recursoDeVida } from '../../../lib/vidaDaFicha'
import { NUMERO_DO_RASCUNHO_MAX, rascunhoVazio, type RascunhoDeTreino } from './rascunhoDeTreino'

/**
 * AS BUILDS SALVAS (F1 da Arena multijogador, pedido de 07/11/2026: "na parte
 * de ajustar o judge poder colocar a copia de outros jogadores ou salvar builds
 * para testar"). Uma build é um rascunho com nome: a DIFERENÇA sobre uma ficha
 * de base (atributos, máximos, os recursos de um número só e as técnicas de
 * treino), nunca a ficha inteira. A base é uma ficha minha, a de um colega ou o
 * boneco do Judge. Guardadas SÓ neste navegador, por mesa e por conta (o
 * mestre no "Ver como" não lê nem grava as dele na vista do jogador), até 30.
 * Base que saiu da mesa = build desligada, com aviso; ela volta a valer se a
 * ficha voltar.
 */

const VERSAO = 1
const PREFIXO = 'labirinto.lobby.builds'
export const BUILDS_MAX = 30
export const NOME_DA_BUILD_MAX = 40
/** O id mais comprido que uma base aceita (os da mesa são bem menores). */
const ID_DA_FICHA_MAX = 128

export type TipoDaBase = 'minha' | 'colega' | 'juiz'

export interface BaseDaBuild {
  tipo: TipoDaBase
  /** A ficha da mesa; no Judge, `ID_DO_JUIZ`. */
  fichaId: string
}

/** Os números de uma build: o mesmo que o rascunho de treino guarda. */
export interface DiferencaDaBuild {
  /** Só os que mudaram: atributo → valor. */
  atributos: Record<string, number>
  /** Só os que mudaram: recurso → máximo. */
  maximos: Record<string, number>
  /** Só os que mudaram, dos recursos de um número só (o Escudo): recurso → valor. */
  recursos: Record<string, number>
  tecnicas: TecnicaDeTreino[]
}

export interface BuildSalva extends DiferencaDaBuild {
  id: string
  nome: string
  base: BaseDaBuild
  salvoEm: number
}

export type ResultadoDaBuild = { ok: true; builds: BuildSalva[]; build: BuildSalva; trocou: boolean } | { ok: false; motivo: 'sem-nome' | 'cheia' }

function chave(campanhaId: string, contaId: string, demo: boolean): string {
  return `${PREFIXO}.${demo ? 'demo.' : ''}${campanhaId}.${contaId}`
}

function registroDe(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor) ? { ...valor } : null
}

function lerNumeros(valor: unknown): Record<string, number> | null {
  const registro = registroDe(valor)
  if (registro === null) return null
  const lidos: Record<string, number> = {}
  for (const [id, numero] of Object.entries(registro)) {
    if (typeof numero !== 'number' || !Number.isSafeInteger(numero) || numero < 0 || numero > NUMERO_DO_RASCUNHO_MAX) return null
    lidos[id] = numero
  }
  return lidos
}

function tipoLido(valor: unknown): TipoDaBase | null {
  return valor === 'minha' || valor === 'colega' || valor === 'juiz' ? valor : null
}

function lerBase(valor: unknown): BaseDaBuild | null {
  const registro = registroDe(valor)
  if (registro === null) return null
  const tipo = tipoLido(registro.tipo)
  const { fichaId } = registro
  if (tipo === null || typeof fichaId !== 'string' || fichaId.length === 0 || fichaId.length > ID_DA_FICHA_MAX) return null
  return { tipo, fichaId }
}

function lerBuild(valor: unknown): BuildSalva | null {
  const registro = registroDe(valor)
  if (registro === null) return null
  const { id, nome, salvoEm } = registro
  const base = lerBase(registro.base)
  const atributos = lerNumeros(registro.atributos)
  const maximos = lerNumeros(registro.maximos)
  const recursos = lerNumeros(registro.recursos)
  const tecnicas = lerTecnicasDeTreino(registro.tecnicas)
  if (typeof id !== 'string' || !/^b\d{1,4}$/.test(id) || typeof nome !== 'string' || limparNome(nome) === '' || nome.length > NOME_DA_BUILD_MAX) return null
  if (base === null || atributos === null || maximos === null || recursos === null || tecnicas === null || typeof salvoEm !== 'number') return null
  return { id, nome, base, atributos, maximos, recursos, tecnicas, salvoEm }
}

/** As builds do texto guardado. Texto torto = nenhuma; uma build torta ou de id repetido fica de fora sem levar as outras. */
export function lerBuildsDoTexto(texto: string): BuildSalva[] {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return []
  }
  const registro = registroDe(bruto)
  if (registro === null || registro.versao !== VERSAO || !Array.isArray(registro.builds)) return []
  const lidas: BuildSalva[] = []
  for (const item of registro.builds) {
    const build = lerBuild(item)
    if (build !== null && !lidas.some((outra) => outra.id === build.id) && lidas.length < BUILDS_MAX) lidas.push(build)
  }
  return lidas
}

/** As builds desta conta nesta mesa; nenhuma, tortas ou sem armazenamento = lista vazia. */
export function lerBuilds(campanhaId: string, contaId: string, demo: boolean): BuildSalva[] {
  try {
    const texto = window.localStorage.getItem(chave(campanhaId, contaId, demo))
    return texto === null ? [] : lerBuildsDoTexto(texto)
  } catch {
    return []
  }
}

/** Guarda a lista inteira; `false` = o navegador não deixou (modo privado, cheio ou bloqueado). */
export function guardarBuilds(campanhaId: string, contaId: string, demo: boolean, builds: readonly BuildSalva[]): boolean {
  try {
    window.localStorage.setItem(chave(campanhaId, contaId, demo), JSON.stringify({ versao: VERSAO, builds }))
    return true
  } catch {
    return false
  }
}

/** O nome como fica guardado: sem espaço nas pontas nem repetido. */
export function limparNome(texto: string): string {
  return texto.trim().replace(/\s+/g, ' ')
}

function mesmoNome(a: string, b: string): boolean {
  return limparNome(a).toLocaleLowerCase('pt-BR') === limparNome(b).toLocaleLowerCase('pt-BR')
}

function idDeBuildNova(builds: readonly BuildSalva[]): string {
  let n = builds.length + 1
  while (builds.some((build) => build.id === `b${n}`)) n += 1
  return `b${n}`
}

/**
 * A lista com a build guardada no alto. Nome igual (sem contar maiúscula e
 * espaço) troca a de antes, mantendo o id; nome novo com 30 na lista = `cheia`.
 */
export function comBuild(builds: readonly BuildSalva[], nome: string, base: BaseDaBuild, diferenca: DiferencaDaBuild, agora: number): ResultadoDaBuild {
  const limpo = limparNome(nome).slice(0, NOME_DA_BUILD_MAX)
  if (limpo === '') return { ok: false, motivo: 'sem-nome' }
  const antiga = builds.find((build) => mesmoNome(build.nome, limpo))
  if (antiga === undefined && builds.length >= BUILDS_MAX) return { ok: false, motivo: 'cheia' }
  const build: BuildSalva = {
    id: antiga?.id ?? idDeBuildNova(builds),
    nome: limpo,
    base: { ...base },
    ...copiaDaDiferenca(diferenca),
    salvoEm: agora,
  }
  return { ok: true, builds: [build, ...builds.filter((outra) => outra !== antiga)], build, trocou: antiga !== undefined }
}

export function semBuild(builds: readonly BuildSalva[], id: string): BuildSalva[] {
  return builds.filter((build) => build.id !== id)
}

/** A base saiu da mesa? A build fica na lista, desligada, até a ficha voltar. O Judge nunca sai. */
export function buildDesligada(build: BuildSalva, existeNaMesa: (fichaId: string) => boolean): boolean {
  return build.base.tipo !== 'juiz' && !existeNaMesa(build.base.fichaId)
}

/** Uma cópia só dos números (o rascunho e a build guardam os mesmos quatro campos). */
function copiaDaDiferenca(fonte: DiferencaDaBuild): DiferencaDaBuild {
  return { atributos: { ...fonte.atributos }, maximos: { ...fonte.maximos }, recursos: { ...fonte.recursos }, tecnicas: [...fonte.tecnicas] }
}

/** Os números do rascunho de agora; sem rascunho = a ficha como está. */
export function diferencaDoRascunho(rascunho: RascunhoDeTreino | null): DiferencaDaBuild {
  return copiaDaDiferenca(rascunho ?? rascunhoVazio(''))
}

/** O rascunho de treino da ficha da base com os números da build (para o Testar build). */
export function rascunhoDaBuild(build: BuildSalva, agora: number): RascunhoDeTreino {
  return { ...rascunhoVazio(build.base.fichaId), ...copiaDaDiferenca(build), salvoEm: agora }
}

/** A base de uma build guardada do Judge: o boneco, ou a ficha que ele copia. */
export function baseDoJuiz(ajustes: AjustesDoJuiz, ehMinha: (fichaId: string) => boolean): BaseDaBuild {
  if (ajustes.baseFichaId === null) return { tipo: 'juiz', fichaId: ID_DO_JUIZ }
  return { tipo: ehMinha(ajustes.baseFichaId) ? 'minha' : 'colega', fichaId: ajustes.baseFichaId }
}

/**
 * Os ajustes do Judge como build: a vida e a energia viram máximos, o Escudo
 * vira recurso. "Quando leva um golpe" fica de fora: é do Judge, não da build.
 */
export function diferencaDoJuiz(ajustes: AjustesDoJuiz, sistema: SistemaDeRpg): DiferencaDaBuild {
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  const maximos: Record<string, number> = {}
  const recursos: Record<string, number> = {}
  if (vida !== null && ajustes.hp !== null) maximos[vida.id] = ajustes.hp
  if (energia !== null && ajustes.sp !== null) maximos[energia.id] = ajustes.sp
  if (escudo !== null && ajustes.escudo !== null) recursos[escudo.id] = ajustes.escudo
  return { atributos: { ...ajustes.atributos }, maximos, recursos, tecnicas: [...ajustes.tecnicas] }
}

/**
 * O Judge vestindo a build: a base dela (o boneco, ou a cópia da ficha) e os
 * números por cima. O "Quando leva um golpe" de agora fica. Máximo e recurso
 * que não são a vida, a energia nem o Escudo não cabem no Judge e ficam de fora.
 */
export function juizDaBuild(build: BuildSalva, sistema: SistemaDeRpg, atual: AjustesDoJuiz, agora: number): AjustesDoJuiz {
  const vida = recursoDeVida(sistema)
  const energia = recursoDaEnergia(sistema)
  const escudo = recursoDoEscudo(sistema)
  const hp = vida === null ? undefined : build.maximos[vida.id]
  const sp = energia === null ? undefined : build.maximos[energia.id]
  const valorDoEscudo = escudo === null ? undefined : build.recursos[escudo.id]
  return {
    ...atual,
    baseFichaId: build.base.tipo === 'juiz' ? null : build.base.fichaId,
    // A vida do Judge nunca é 0: a build de um rascunho pode ter o máximo zerado.
    hp: hp === undefined ? null : Math.max(1, hp),
    sp: sp ?? null,
    escudo: valorDoEscudo ?? null,
    atributos: { ...build.atributos },
    tecnicas: [...build.tecnicas],
    salvoEm: agora,
  }
}
