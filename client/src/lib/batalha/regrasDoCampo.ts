/**
 * REGRAS DO CAMPO (decisão 7 de docs/planos/batalha-one-piece-2026-10-30.md):
 * texto que vale só na batalha e o número de blocos que cada rank de
 * Agilidade anda ("blocos por rank", padrão 1, para o "Mov 2/4" da F2).
 *
 * Duas formas:
 *  - a BIBLIOTECA global, como a de sons: `<appData>/batalha/regras-do-campo.json`,
 *    lida e gravada por `regrasDoCampoNoDisco.ts`; vale para toda aventura;
 *  - a CÓPIA da batalha (`RegrasDaBatalha`): ao iniciar, o mestre escolhe uma
 *    da biblioteca (ou nenhuma) e ajusta. Mora só na sessão; mudar a cópia não
 *    mexe na biblioteca, e apagar a regra da biblioteca não mexe na batalha.
 *
 * Puro: sem disco, sem store. Leitura campo a campo: texto vem do arquivo do
 * mestre ou do fio (o jogador lê a cópia em `batalha.estado`).
 */

/** Uma regra guardada na biblioteca global. */
export interface RegraDoCampo {
  id: string
  nome: string
  blocosPorRank: number
  texto: string
}

/** A cópia que vale nesta batalha. `origemId` = a regra da biblioteca de onde veio; `null` = escrita na hora. */
export interface RegrasDaBatalha {
  origemId: string | null
  nome: string
  blocosPorRank: number
  texto: string
}

export const BLOCOS_POR_RANK_PADRAO = 1
export const BLOCOS_POR_RANK_MIN = 1
export const BLOCOS_POR_RANK_MAX = 10
export const TEXTO_DA_REGRA_MAX = 4000
export const NOME_DA_REGRA_MAX = 60
export const REGRAS_MAX = 100
/** Id de regra: o do app é `regra_<uuid>` (42); folga para o que vier editado à mão. */
export const ID_DA_REGRA_MAX = 80
export const VERSAO_DA_BIBLIOTECA_DE_REGRAS = 1
export const NOME_DA_REGRA_PADRAO = 'Regra sem nome'

export interface BibliotecaDeRegras {
  versao: typeof VERSAO_DA_BIBLIOTECA_DE_REGRAS
  regras: RegraDoCampo[]
}

/**
 * O texto do arquivo como biblioteca. `ilegivel` = não é JSON de biblioteca
 * (quem chama guarda uma cópia e não grava por cima); `versao-mais-nova` =
 * gravado por um app mais novo, que este não deve regravar.
 */
export type TextoDaBibliotecaDeRegras =
  | { ok: true; biblioteca: BibliotecaDeRegras }
  | { ok: false; motivo: 'ilegivel' | 'versao-mais-nova' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function novoIdDeRegra(): string {
  return `regra_${crypto.randomUUID()}`
}

export function bibliotecaDeRegrasVazia(): BibliotecaDeRegras {
  return { versao: VERSAO_DA_BIBLIOTECA_DE_REGRAS, regras: [] }
}

/** Inteiro entre 1 e 10; qualquer outra coisa vira o padrão — a regra continua legível. */
export function blocosPorRankValido(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= BLOCOS_POR_RANK_MIN && value <= BLOCOS_POR_RANK_MAX
    ? value
    : BLOCOS_POR_RANK_PADRAO
}

function nomeDaRegra(value: unknown): string {
  const nome = typeof value === 'string' ? value.trim().slice(0, NOME_DA_REGRA_MAX) : ''
  return nome.length > 0 ? nome : NOME_DA_REGRA_PADRAO
}

function textoDaRegra(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, TEXTO_DA_REGRA_MAX) : ''
}

function idDaRegra(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= ID_DA_REGRA_MAX
}

/** Uma regra da biblioteca lida do arquivo. Sem id: fora. Nome, texto e blocos tortos viram o padrão (cortados no teto). */
export function lerRegraDoCampo(value: unknown): RegraDoCampo | null {
  if (!isRecord(value) || !idDaRegra(value.id)) return null
  return { id: value.id, nome: nomeDaRegra(value.nome), blocosPorRank: blocosPorRankValido(value.blocosPorRank), texto: textoDaRegra(value.texto) }
}

/**
 * A cópia da batalha vinda do FIO (o `batalha.estado` do jogador): aqui não
 * se conserta nada — campo torto ou acima do teto recusa a regra inteira,
 * porque o host só manda o que já passou por `lerRegraDoCampo` e pelos tetos.
 */
export function lerRegrasDaBatalha(value: unknown): RegrasDaBatalha | null {
  if (!isRecord(value)) return null
  const { origemId, nome, blocosPorRank, texto } = value
  if (origemId !== null && !idDaRegra(origemId)) return null
  if (typeof nome !== 'string' || nome.trim().length === 0 || nome.length > NOME_DA_REGRA_MAX) return null
  if (typeof texto !== 'string' || texto.length > TEXTO_DA_REGRA_MAX) return null
  if (blocosPorRankValido(blocosPorRank) !== blocosPorRank) return null
  return { origemId, nome, blocosPorRank: blocosPorRankValido(blocosPorRank), texto }
}

/**
 * A cópia como vai no fio: nome vazio vira o padrão, blocos fora de 1..10
 * viram o padrão, texto cortado no teto, origem longa demais vira `null`. O
 * host passa por aqui antes de mandar, e `lerRegrasDaBatalha` aceita tudo o
 * que sai daqui — o mestre que apagou o nome não derruba a faixa do jogador.
 */
export function regrasParaOFio(regras: RegrasDaBatalha): RegrasDaBatalha {
  return {
    origemId: regras.origemId !== null && idDaRegra(regras.origemId) ? regras.origemId : null,
    nome: nomeDaRegra(regras.nome),
    blocosPorRank: blocosPorRankValido(regras.blocosPorRank),
    texto: textoDaRegra(regras.texto),
  }
}

/** A cópia que a batalha leva de uma regra da biblioteca. */
export function regrasDaBatalhaDe(regra: RegraDoCampo): RegrasDaBatalha {
  return { origemId: regra.id, nome: regra.nome, blocosPorRank: regra.blocosPorRank, texto: regra.texto }
}

/** O `regras-do-campo.json` como biblioteca. Id repetido: fica a primeira. Passou de `REGRAS_MAX`: o resto sai. */
export function bibliotecaDeRegrasDoTexto(texto: string): TextoDaBibliotecaDeRegras {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return { ok: false, motivo: 'ilegivel' }
  }
  if (!isRecord(bruto) || typeof bruto.versao !== 'number') return { ok: false, motivo: 'ilegivel' }
  if (bruto.versao > VERSAO_DA_BIBLIOTECA_DE_REGRAS) return { ok: false, motivo: 'versao-mais-nova' }
  if (bruto.versao !== VERSAO_DA_BIBLIOTECA_DE_REGRAS || !Array.isArray(bruto.regras)) return { ok: false, motivo: 'ilegivel' }
  const regras: RegraDoCampo[] = []
  const ids = new Set<string>()
  for (const valor of bruto.regras) {
    if (regras.length >= REGRAS_MAX) break
    const regra = lerRegraDoCampo(valor)
    if (regra === null || ids.has(regra.id)) continue
    ids.add(regra.id)
    regras.push(regra)
  }
  return { ok: true, biblioteca: { versao: VERSAO_DA_BIBLIOTECA_DE_REGRAS, regras } }
}

export function serializarBibliotecaDeRegras(biblioteca: BibliotecaDeRegras): string {
  return `${JSON.stringify(biblioteca, null, 2)}\n`
}
