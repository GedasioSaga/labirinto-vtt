import { segmentoValido } from '../../lib/nuvem/caminho'
import { ehRegistro, lerJsonSeguro, proprio } from '../../lib/nuvem/json'
import { VERSAO_DO_FORMATO, type OpGravada } from '../../lib/nuvem/tipos'
import { personagensDoArquivo, type Personagem } from '../../lib/personagem'
import type { PastaNoDisco } from './discoDaNuvem'

/**
 * OS ARQUIVOS PEQUENOS DA CAMPANHA NO APP (docs/planos/lobby-jogadores-2026-11-05.md
 * §4.4, fatia A5): `estado.json`, `base.json` (a base confirmada, 8.1.1 item
 * 3), o diário por mês e a lista `<appData>/nuvem/campanhas.json`.
 *
 * Leitura tolerante (o que não se entende fica de fora, nunca derruba o app);
 * gravação inteira pela troca segura (`reescrever`) ou por append (diário).
 */

export const ARQUIVO_DO_ESTADO = 'estado.json'
export const ARQUIVO_DA_BASE = 'base.json'
export const ARQUIVO_DAS_NEGADAS = 'negadas.jsonl'
export const ARQUIVO_DAS_CAMPANHAS = 'campanhas.json'
const PREFIXO_DO_DIARIO = 'diario-'
const SUFIXO_DO_DIARIO = '.jsonl'

function ehRev(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function lerJson(texto: string | null): unknown {
  if (texto === null) return undefined
  try {
    return lerJsonSeguro(texto)
  } catch (erro) {
    if (erro instanceof SyntaxError) return undefined
    throw erro
  }
}

// ── estado.json ─────────────────────────────────────────────────────────────

export interface EstadoDaCampanha {
  campanhaId: string
  pastaId: string
  /** Até onde as ops confirmadas chegaram ao diário e à base (`GET desde/:revRecebida`). */
  revRecebida: number
  /** Até onde o `rpg.json` da pasta foi acertado com a vista. */
  revNoRpg: number
  /** Uma por instalação do app (§4.6): a chave de autoria do conflito. */
  clienteId: string
  versaoDoFormato: number
}

export function estadoDoArquivo(valor: unknown): EstadoDaCampanha | null {
  if (!ehRegistro(valor)) return null
  const campanhaId = proprio(valor, 'campanhaId')
  const pastaId = proprio(valor, 'pastaId')
  const revRecebida = proprio(valor, 'revRecebida')
  const revNoRpg = proprio(valor, 'revNoRpg')
  const clienteId = proprio(valor, 'clienteId')
  const versaoDoFormato = proprio(valor, 'versaoDoFormato')
  if (!segmentoValido(campanhaId) || typeof pastaId !== 'string' || !ehRev(revRecebida) || !ehRev(revNoRpg)) return null
  if (!segmentoValido(clienteId) || !ehRev(versaoDoFormato)) return null
  return { campanhaId, pastaId, revRecebida, revNoRpg, clienteId, versaoDoFormato }
}

export async function lerEstado(pasta: PastaNoDisco): Promise<EstadoDaCampanha | null> {
  return estadoDoArquivo(lerJson(await pasta.ler(ARQUIVO_DO_ESTADO)))
}

export function gravarEstado(pasta: PastaNoDisco, estado: EstadoDaCampanha): Promise<void> {
  return pasta.reescrever(ARQUIVO_DO_ESTADO, JSON.stringify(estado))
}

export function estadoNovo(campanhaId: string, pastaId: string, clienteId: string): EstadoDaCampanha {
  return { campanhaId, pastaId, revRecebida: 0, revNoRpg: 0, clienteId, versaoDoFormato: VERSAO_DO_FORMATO }
}

// ── base.json ───────────────────────────────────────────────────────────────

/**
 * A BASE CONFIRMADA (8.1.1, item 3): as fichas como o servidor as tem na rev
 * `rev`, sem nenhuma op local por cima. É dela que a fila abre — nunca do
 * `rpg.json`, que é a vista (já tem as pendentes; a soma pendente entraria
 * duas vezes). `apagadas` = fichas que o servidor apagou: o acerto do
 * `rpg.json` tira do app só a ficha que a nuvem conhecia.
 */
export interface BaseGuardada {
  rev: number
  fichas: Personagem[]
  apagadas: string[]
}

export const BASE_INICIAL: BaseGuardada = { rev: 0, fichas: [], apagadas: [] }

export function baseDoArquivo(valor: unknown): BaseGuardada | null {
  if (!ehRegistro(valor)) return null
  const rev = proprio(valor, 'rev')
  const fichas = personagensDoArquivo(proprio(valor, 'fichas'))
  const apagadas = proprio(valor, 'apagadas')
  if (!ehRev(rev) || fichas === undefined || !Array.isArray(apagadas)) return null
  const lista: readonly unknown[] = apagadas
  return { rev, fichas, apagadas: lista.filter(segmentoValido) }
}

/** `null` = arquivo danificado (a fila não abre com base inventada: o sincronizador avisa e não liga). */
export async function lerBase(pasta: PastaNoDisco): Promise<BaseGuardada | null> {
  const texto = await pasta.ler(ARQUIVO_DA_BASE)
  if (texto === null) return BASE_INICIAL
  return baseDoArquivo(lerJson(texto))
}

export function gravarBase(pasta: PastaNoDisco, base: BaseGuardada): Promise<void> {
  return pasta.reescrever(ARQUIVO_DA_BASE, JSON.stringify(base))
}

// ── Diário ──────────────────────────────────────────────────────────────────

/** O mês da op pela hora do SERVIDOR (UTC): a mesma op cai sempre no mesmo arquivo. */
export function mesDoDiario(quando: number): string {
  const data = new Date(quando)
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nomeDoDiario(mes: string): string {
  return `${PREFIXO_DO_DIARIO}${mes}${SUFIXO_DO_DIARIO}`
}

/** As linhas de cada arquivo do diário: só rev depois de `jaGravada`, na ordem, sem repetir. */
export function linhasDoDiario(ops: readonly OpGravada[], jaGravada: number): { porArquivo: Map<string, string>; ultima: number } {
  const porArquivo = new Map<string, string>()
  let ultima = jaGravada
  for (const op of [...ops].sort((a, b) => a.rev - b.rev)) {
    if (op.rev <= ultima) continue
    ultima = op.rev
    const nome = nomeDoDiario(mesDoDiario(op.quando))
    porArquivo.set(nome, `${porArquivo.get(nome) ?? ''}${JSON.stringify(op)}\n`)
  }
  return { porArquivo, ultima }
}

/**
 * O DIÁRIO (§4.4): cópia completa do log no disco do mestre, só acrescenta,
 * na ordem da rev; rev repetida é ignorada. Quem lê o diário também pula rev
 * repetida: a queda entre o diário e a base pode gravar a mesma op duas vezes.
 */
export interface Diario {
  ultimaRev(): number
  acrescentar(ops: readonly OpGravada[]): Promise<void>
}

export function criarDiario(pasta: PastaNoDisco, jaGravada: number): Diario {
  let ultima = jaGravada
  return {
    ultimaRev: () => ultima,
    async acrescentar(ops) {
      const linhas = linhasDoDiario(ops, ultima)
      for (const [nome, texto] of linhas.porArquivo) await pasta.acrescentar(nome, texto)
      ultima = linhas.ultima
    },
  }
}

// ── campanhas.json ──────────────────────────────────────────────────────────

/** Uma pasta publicada no Lobby. */
export interface CampanhaPublicada {
  campanhaId: string
  pastaId: string
  nome: string
}

export function campanhasDoArquivo(valor: unknown): CampanhaPublicada[] {
  const lista = ehRegistro(valor) ? proprio(valor, 'campanhas') : undefined
  if (!Array.isArray(lista)) return []
  const brutas: readonly unknown[] = lista
  return brutas.flatMap((bruta): CampanhaPublicada[] => {
    if (!ehRegistro(bruta)) return []
    const campanhaId = proprio(bruta, 'campanhaId')
    const pastaId = proprio(bruta, 'pastaId')
    const nome = proprio(bruta, 'nome')
    return segmentoValido(campanhaId) && typeof pastaId === 'string' && typeof nome === 'string' ? [{ campanhaId, pastaId, nome }] : []
  })
}

export async function lerCampanhas(raiz: PastaNoDisco): Promise<CampanhaPublicada[]> {
  return campanhasDoArquivo(lerJson(await raiz.ler(ARQUIVO_DAS_CAMPANHAS)))
}

/** Acrescenta (ou atualiza o nome de) uma campanha na lista. Uma campanha por pasta. */
export async function registrarCampanha(raiz: PastaNoDisco, campanha: CampanhaPublicada): Promise<CampanhaPublicada[]> {
  const atuais = await lerCampanhas(raiz)
  const outras = atuais.filter((atual) => atual.campanhaId !== campanha.campanhaId && atual.pastaId !== campanha.pastaId)
  const novas = [...outras, campanha]
  await raiz.reescrever(ARQUIVO_DAS_CAMPANHAS, JSON.stringify({ versao: 1, campanhas: novas }))
  return novas
}
