import { gatilhoLido } from '../itens/pecasDoItem'
import {
  APAGA_MAX,
  COMO_SE_PAGA,
  CONTA_DA_VEZ,
  CONTA_DO_ATRIBUTO,
  DE_NOVO_DA_CONDICAO,
  FAZ_DA_VEZ,
  FAZ_DO_ATRIBUTO,
  MODOS_DO_PRAZO,
  O_QUE_SE_PAGA,
  QUANDO_DA_VEZ,
  QUEM_DA_AURA,
  QUEM_DA_MARCA,
  RECURSOS_DA_VEZ,
  RITMOS_DO_ATRIBUTO,
  TIPOS_DA_CONDICAO,
  ATRIBUTOS_DA_CONDICAO_MAX,
  AURA_DESTA_MESMA,
  BLOQUEIOS_DA_CONDICAO,
  CASAS_DA_AURA_MAX,
  CD_MAX,
  CD_MIN,
  MULT_DA_MARCA_MAX,
  MULT_DA_MARCA_MIN,
  PAGA_MAX,
  PECAS_DA_CONDICAO_MAX,
  PILHAS_MAX,
  PILHAS_MIN,
  PORCENTO_DO_DANO_MAX,
  PORCENTO_DO_DANO_MIN,
  PORCENTO_MAX,
  SAIDAS_DA_CONDICAO_MAX,
  TIPOS_DE_DANO,
  TURNOS_DO_PRAZO_MAX,
  VALOR_DA_VEZ_MAX,
  VALOR_DO_ATRIBUTO_MAX,
  A_PARTIR_DO_TURNO_MAX,
  ehIdDeCondicao,
  type BloqueioDaCondicao,
  type PecaDaCondicao,
  type PrazoDaCondicao,
  type SaidaDaCondicao,
  type TipoDaCondicao,
  type TipoDeDano,
} from './modelo'

/**
 * A LEITURA DAS PEÇAS, DO PRAZO E DAS SAÍDAS (rework das condições, PLANO.md §2, E1). O juiz único do que
 * vem do disco (`condicoes.json`, `rpg.json`, o catálogo do livro), do `localStorage` e do fio: o app, a
 * ficha e o Worker leem pelo mesmo leitor.
 *
 * Estrito: cada família aceita só as próprias chaves, e chave desconhecida (de um app mais novo, ou de
 * mão) faz a peça TORTA (`null`), em vez de a ler pela metade — uma peça lida pela metade mudaria a regra
 * sem ninguém ver. Valor fora do teto também é torto. O que é frouxo é só o "desligado": `direto: false`,
 * `espalha: false` e o bloqueio com `false` valem como ausentes (é o que o protótipo grava).
 *
 * A lista inteira é torta quando UMA peça é torta (ou passa do teto): quem lê (`lerCondicaoPropria`)
 * deixa a condição com o nome e a pastilha, sem as peças, e o "Confira". O objeto devolvido é sempre
 * novo, com as chaves numa ordem fixa (a comparação por JSON fica estável).
 *
 * Puro: sem store, sem Tauri, sem `lib/batalha/condicoes.ts`.
 *
 * API pública: `lerPecaDaCondicao`, `lerPecasDaCondicao`, `lerPrazoDaCondicao`, `lerSaidaDaCondicao`,
 * `lerSaidasDaCondicao`, `lerTipoDaCondicao`, `lerPilhas`, `ehIdDeAtributo`.
 */

type Registro = Record<string, unknown>

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

/** Só estas chaves (a ordem não importa). */
function soChaves(registro: Registro, permitidas: readonly string[]): boolean {
  return Object.keys(registro).every((chave) => permitidas.includes(chave))
}

function inteiroEntre(valor: unknown, min: number, max: number): number | null {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= min && valor <= max ? valor : null
}

function umDe<T extends string>(valor: unknown, opcoes: readonly T[]): T | null {
  return opcoes.find((opcao) => opcao === valor) ?? null
}

/** A marca opcional: `true` fica, `false` e ausente somem, qualquer outra coisa é torta (`'torta'`). */
function marcaOpcional(valor: unknown): true | undefined | 'torta' {
  if (valor === true) return true
  if (valor === undefined || valor === false) return undefined
  return 'torta'
}

const ID_DE_ATRIBUTO = /^[a-z][A-Za-z0-9_]{0,39}$/

/** Um id de atributo do sistema (`forca`) ou do status (`velocidade`, `ca`, `dano`, `alcance`), no teto do mod do selo. */
export function ehIdDeAtributo(valor: unknown): valor is string {
  return typeof valor === 'string' && ID_DE_ATRIBUTO.test(valor)
}

// ─── As peças ──────────────────────────────────────────────────────────────

function vezLida(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'quando', 'faz', 'v', 'conta', 'recurso', 'direto', 'rouba'])) return null
  const quando = umDe(cru.quando, QUANDO_DA_VEZ)
  const faz = umDe(cru.faz, FAZ_DA_VEZ)
  const conta = umDe(cru.conta, CONTA_DA_VEZ)
  const recurso = umDe(cru.recurso, RECURSOS_DA_VEZ)
  const direto = marcaOpcional(cru.direto)
  const rouba = marcaOpcional(cru.rouba)
  if (quando === null || faz === null || conta === null || recurso === null || direto === 'torta' || rouba === 'torta') return null
  const v = inteiroEntre(cru.v, 0, conta === 'fixo' ? VALOR_DA_VEZ_MAX : PORCENTO_MAX)
  if (v === null) return null
  return { tipo: 'vez', quando, faz, v, conta, recurso, ...(direto === true ? { direto } : {}), ...(rouba === true ? { rouba } : {}) }
}

function atributoLido(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'atr', 'faz', 'v', 'conta', 'ritmo', 'aPartirN', 'tetoN'])) return null
  const faz = umDe(cru.faz, FAZ_DO_ATRIBUTO)
  const conta = umDe(cru.conta, CONTA_DO_ATRIBUTO)
  const ritmo = umDe(cru.ritmo, RITMOS_DO_ATRIBUTO)
  if (!ehIdDeAtributo(cru.atr) || faz === null || conta === null || ritmo === null) return null
  const teto = conta === 'pct' ? PORCENTO_MAX : VALOR_DO_ATRIBUTO_MAX
  const v = inteiroEntre(cru.v, 0, teto)
  const aPartirN = cru.aPartirN === undefined ? undefined : inteiroEntre(cru.aPartirN, 1, A_PARTIR_DO_TURNO_MAX)
  const tetoN = cru.tetoN === undefined ? undefined : inteiroEntre(cru.tetoN, 1, teto)
  if (v === null || aPartirN === null || tetoN === null) return null
  return { tipo: 'atributo', atr: cru.atr, faz, v, conta, ritmo, ...(aPartirN === undefined ? {} : { aPartirN }), ...(tetoN === undefined ? {} : { tetoN }) }
}

function bloqueioLido(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'itens']) || !ehRegistro(cru.itens) || !soChaves(cru.itens, BLOQUEIOS_DA_CONDICAO)) return null
  const itens: Partial<Record<BloqueioDaCondicao, true>> = {}
  for (const bloqueio of BLOQUEIOS_DA_CONDICAO) {
    const ligado = marcaOpcional(cru.itens[bloqueio])
    if (ligado === 'torta') return null
    if (ligado === true) itens[bloqueio] = true
  }
  return { tipo: 'bloqueio', itens }
}

function danoCuraLido(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'recV', 'recTipo', 'cauV', 'curaV', 'cddV'])) return null
  const porcento = (valor: unknown): number | null | undefined => (valor === undefined ? undefined : inteiroEntre(valor, PORCENTO_DO_DANO_MIN, PORCENTO_DO_DANO_MAX))
  const recV = porcento(cru.recV)
  const cauV = porcento(cru.cauV)
  const curaV = porcento(cru.curaV)
  const cddV = cru.cddV === undefined ? undefined : inteiroEntre(cru.cddV, 1, PORCENTO_MAX)
  const recTipo: TipoDeDano | null | undefined = cru.recTipo === undefined ? undefined : umDe(cru.recTipo, TIPOS_DE_DANO)
  if (recV === null || cauV === null || curaV === null || cddV === null || recTipo === null) return null
  return {
    tipo: 'danoCura',
    ...(recV === undefined ? {} : { recV }),
    ...(recTipo === undefined ? {} : { recTipo }),
    ...(cauV === undefined ? {} : { cauV }),
    ...(curaV === undefined ? {} : { curaV }),
    ...(cddV === undefined ? {} : { cddV }),
  }
}

/** As chaves de cada peça do gatilho da 0.6.4 (`PecaDoGatilho`, lib/itens/modelo.ts). */
const CHAVES_DA_PECA_DO_GATILHO: Readonly<Record<string, readonly string[]>> = {
  condicao: ['tipo', 'nome', 'duracao', 'n'],
  dano: ['tipo', 'valor'],
  curar: ['tipo', 'fixo'],
  tirar: ['tipo', 'nome'],
}

/** O gatilho da 0.6.4 pelo leitor dele (`gatilhoLido`), mais o estrito daqui: nenhuma chave a mais e nenhuma peça deixada de fora. */
function gatilhoDaPecaLido(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'gatilho']) || !ehRegistro(cru.gatilho) || !soChaves(cru.gatilho, ['turnos', 'vezes', 'aoDisparar', 'pecas'])) return null
  const pecasCruas = cru.gatilho.pecas
  if (!Array.isArray(pecasCruas)) return null
  for (const peca of pecasCruas) {
    const chaves = ehRegistro(peca) && typeof peca.tipo === 'string' ? CHAVES_DA_PECA_DO_GATILHO[peca.tipo] : undefined
    if (!ehRegistro(peca) || chaves === undefined || !soChaves(peca, chaves)) return null
  }
  const gatilho = gatilhoLido(cru.gatilho)
  return gatilho === undefined || gatilho.pecas.length !== pecasCruas.length ? null : { tipo: 'gatilho', gatilho }
}

function marcaLida(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'mult', 'quem', 'sai', 'desvDesv'])) return null
  const mult = inteiroEntre(cru.mult, MULT_DA_MARCA_MIN, MULT_DA_MARCA_MAX)
  const quem = umDe(cru.quem, QUEM_DA_MARCA)
  if (mult === null || quem === null || typeof cru.sai !== 'boolean' || typeof cru.desvDesv !== 'boolean') return null
  return { tipo: 'marca', mult, quem, sai: cru.sai, desvDesv: cru.desvDesv }
}

function auraLida(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'casas', 'quem', 'cond', 'espalha'])) return null
  const casas = inteiroEntre(cru.casas, 1, CASAS_DA_AURA_MAX)
  const quem = umDe(cru.quem, QUEM_DA_AURA)
  const espalha = marcaOpcional(cru.espalha)
  if (casas === null || quem === null || espalha === 'torta' || (cru.cond !== AURA_DESTA_MESMA && !ehIdDeCondicao(cru.cond))) return null
  return { tipo: 'aura', casas, quem, cond: cru.cond, ...(espalha === true ? { espalha } : {}) }
}

function contraLida(cru: Registro): PecaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'apaga', 'impede']) || !Array.isArray(cru.apaga) || cru.apaga.length > APAGA_MAX || typeof cru.impede !== 'boolean') return null
  const apaga: string[] = []
  for (const id of cru.apaga) {
    if (!ehIdDeCondicao(id)) return null
    if (!apaga.includes(id)) apaga.push(id)
  }
  return { tipo: 'contra', apaga, impede: cru.impede }
}

/** Uma peça lida do disco ou do fio. `null` = torta (família desconhecida, chave a mais, valor fora do teto). */
export function lerPecaDaCondicao(cru: unknown): PecaDaCondicao | null {
  if (!ehRegistro(cru)) return null
  switch (cru.tipo) {
    case 'vez':
      return vezLida(cru)
    case 'atributo':
      return atributoLido(cru)
    case 'bloqueio':
      return bloqueioLido(cru)
    case 'danoCura':
      return danoCuraLido(cru)
    case 'gatilho':
      return gatilhoDaPecaLido(cru)
    case 'marca':
      return marcaLida(cru)
    case 'aura':
      return auraLida(cru)
    case 'contra':
      return contraLida(cru)
    default:
      return null
  }
}

/**
 * A lista de peças. `null` = torta: não é lista, passa de `PECAS_DA_CONDICAO_MAX` peças ou de
 * `ATRIBUTOS_DA_CONDICAO_MAX` Muda atributo, ou uma peça é torta. Lista vazia vale (a condição que só narra).
 */
export function lerPecasDaCondicao(cru: unknown): PecaDaCondicao[] | null {
  if (!Array.isArray(cru) || cru.length > PECAS_DA_CONDICAO_MAX) return null
  const pecas: PecaDaCondicao[] = []
  for (const crua of cru) {
    const peca = lerPecaDaCondicao(crua)
    if (peca === null) return null
    pecas.push(peca)
  }
  return pecas.filter((peca) => peca.tipo === 'atributo').length > ATRIBUTOS_DA_CONDICAO_MAX ? null : pecas
}

// ─── O prazo ───────────────────────────────────────────────────────────────

/** O prazo. `null` = torto (modo desconhecido, chave a mais, turnos ou teto fora do teto). */
export function lerPrazoDaCondicao(cru: unknown): PrazoDaCondicao | null {
  if (!ehRegistro(cru) || !soChaves(cru, ['modo', 'n', 'deNovo', 'teto'])) return null
  const modo = umDe(cru.modo, MODOS_DO_PRAZO)
  const deNovo = umDe(cru.deNovo, DE_NOVO_DA_CONDICAO)
  const n = cru.n === undefined ? undefined : inteiroEntre(cru.n, 1, TURNOS_DO_PRAZO_MAX)
  const teto = cru.teto === undefined ? undefined : inteiroEntre(cru.teto, PILHAS_MIN, PILHAS_MAX)
  if (modo === null || deNovo === null || n === null || teto === null) return null
  return { modo, ...(n === undefined ? {} : { n }), deNovo, ...(teto === undefined ? {} : { teto }) }
}

// ─── As saídas ─────────────────────────────────────────────────────────────

function pagarLido(cru: Registro): SaidaDaCondicao | null {
  if (!soChaves(cru, ['tipo', 'como', 'paga', 'v', 'atr', 'cd'])) return null
  const como = umDe(cru.como, COMO_SE_PAGA)
  const paga = umDe(cru.paga, O_QUE_SE_PAGA)
  const v = cru.v === undefined ? undefined : inteiroEntre(cru.v, 1, PAGA_MAX)
  const cd = cru.cd === undefined ? undefined : inteiroEntre(cru.cd, CD_MIN, CD_MAX)
  const atr = cru.atr === undefined ? undefined : ehIdDeAtributo(cru.atr) ? cru.atr : null
  if (como === null || paga === null || v === null || cd === null || atr === null) return null
  // O que o jeito de sair usa tem de estar lá: o quanto se paga (SP ou vida) e o teste (atributo e CD).
  if (como !== 'teste' && paga !== 'acao' && v === undefined) return null
  if (como !== 'pagar' && (atr === undefined || cd === undefined)) return null
  return { tipo: 'pagar', como, paga, ...(v === undefined ? {} : { v }), ...(atr === undefined ? {} : { atr }), ...(cd === undefined ? {} : { cd }) }
}

/** Uma saída. `null` = torta. */
export function lerSaidaDaCondicao(cru: unknown): SaidaDaCondicao | null {
  if (!ehRegistro(cru)) return null
  switch (cru.tipo) {
    case 'teste': {
      const cd = inteiroEntre(cru.cd, CD_MIN, CD_MAX)
      return soChaves(cru, ['tipo', 'atr', 'cd']) && ehIdDeAtributo(cru.atr) && cd !== null ? { tipo: 'teste', atr: cru.atr, cd } : null
    }
    case 'pagar':
      return pagarLido(cru)
    case 'cura':
      return soChaves(cru, ['tipo']) ? { tipo: 'cura' } : null
    case 'dano': {
      const dano = umDe(cru.dano, TIPOS_DE_DANO)
      return soChaves(cru, ['tipo', 'dano']) && dano !== null ? { tipo: 'dano', dano } : null
    }
    case 'agir':
      return soChaves(cru, ['tipo']) ? { tipo: 'agir' } : null
    default:
      return null
  }
}

/** As saídas. `null` = torta: não é lista, passa de `SAIDAS_DA_CONDICAO_MAX`, ou uma é torta. */
export function lerSaidasDaCondicao(cru: unknown): SaidaDaCondicao[] | null {
  if (!Array.isArray(cru) || cru.length > SAIDAS_DA_CONDICAO_MAX) return null
  const saidas: SaidaDaCondicao[] = []
  for (const crua of cru) {
    const saida = lerSaidaDaCondicao(crua)
    if (saida === null) return null
    saidas.push(saida)
  }
  return saidas
}

/** O tipo da condição; `null` = torto ou ausente (vale a negativa). */
export function lerTipoDaCondicao(cru: unknown): TipoDaCondicao | null {
  return umDe(cru, TIPOS_DA_CONDICAO)
}

/** As pilhas de uma condição posta (na ficha ou no selo): de 2 ao teto; `null` = ausente ou torta (vale 1). */
export function lerPilhas(cru: unknown): number | null {
  return inteiroEntre(cru, PILHAS_MIN, PILHAS_MAX)
}
