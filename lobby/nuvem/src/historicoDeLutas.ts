import type { LinhaParaJogador } from '../../../client/src/lib/batalha/registro'
import { ehLadoDaLuta, HISTORICO_DE_LUTAS_MAX, type ContaNaLuta, type LadoNoHistorico, type LutaNoHistorico } from '../../../client/src/lib/treino/lutaDoLobby'
import { numero, texto, textoOuNulo, type Linha } from './linhas'
import { ehRegistro, lerJsonSeguro, proprio } from './nucleo'

/**
 * HISTÓRICO DE LUTAS (Arena multijogador, fatia F4, §6 do plano
 * docs/planos/arena-multijogador-2026-11-07.md): ao fim de cada luta (e do
 * duelo 1x1), um resumo na tabela `historicoDeLutas`, só as últimas
 * `HISTORICO_DE_LUTAS_MAX` da campanha. A vista é pública (qualquer membro lê):
 * quem lutou em cada lado, o vencedor, o motivo do fim, as rodadas e o
 * registro final como o espectador o vê (sem combate nem segredo, montado em
 * `resumoDaLuta`/`resumoDoDuelo`). Fica fora de `luta.ts` para o duelo gravar
 * aqui sem o `luta.ts` e o `duelo.ts` importarem um ao outro.
 */

const MOTIVOS: readonly LutaNoHistorico['motivo'][] = ['vitoria', 'todosCaidos', 'tempo', 'arbitro', 'ausencia', 'desistencia']

function ehMotivo(valor: unknown): valor is LutaNoHistorico['motivo'] {
  return MOTIVOS.some((motivo) => motivo === valor)
}

function ehModo(valor: unknown): valor is LutaNoHistorico['modo'] {
  return valor === 'times' || valor === 'todos' || valor === 'duelo'
}

/**
 * O resumo vai à tabela uma vez só (o mesmo id não entra duas vezes: o fim
 * gravado de novo não duplica) e as mais velhas que passam do teto saem.
 */
export function gravarNoHistorico(sql: SqlStorage, resumo: LutaNoHistorico): void {
  sql.exec(
    `INSERT OR IGNORE INTO historicoDeLutas (id, fim, modo, ladosJson, vencedor, motivo, rodadas, registroJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    resumo.id,
    resumo.fim,
    resumo.modo,
    JSON.stringify(resumo.lados),
    resumo.vencedor,
    resumo.motivo,
    resumo.rodadas,
    JSON.stringify(resumo.registro ?? []),
  )
  sql.exec(`DELETE FROM historicoDeLutas WHERE id NOT IN (SELECT id FROM historicoDeLutas ORDER BY fim DESC, id DESC LIMIT ?)`, HISTORICO_DE_LUTAS_MAX)
}

function contasLidas(valor: unknown): ContaNaLuta[] | null {
  if (!Array.isArray(valor)) return null
  const contas: ContaNaLuta[] = []
  for (const conta of valor) {
    if (!ehRegistro(conta)) return null
    const contaId = proprio(conta, 'contaId')
    const nome = proprio(conta, 'nome')
    if (typeof contaId !== 'string' || typeof nome !== 'string') return null
    contas.push({ contaId, nome })
  }
  return contas
}

function nomesLidos(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null
  const nomes: string[] = []
  for (const nome of valor) {
    if (typeof nome !== 'string') return null
    nomes.push(nome)
  }
  return nomes
}

/** Os lados guardados; `null` = coluna torta. */
function ladosLidos(json: string): LadoNoHistorico[] | null {
  let valor: unknown
  try {
    valor = lerJsonSeguro(json)
  } catch {
    return null
  }
  if (!Array.isArray(valor)) return null
  const lados: LadoNoHistorico[] = []
  for (const bruto of valor) {
    if (!ehRegistro(bruto)) return null
    const lado = proprio(bruto, 'lado')
    const contas = contasLidas(proprio(bruto, 'contas'))
    const fichas = nomesLidos(proprio(bruto, 'fichas'))
    if (!ehLadoDaLuta(lado) || contas === null || fichas === null) return null
    lados.push({ lado, contas, fichas })
  }
  return lados
}

/** O registro final guardado; `null` = coluna torta. */
function registroLido(json: string): readonly LinhaParaJogador[] | null {
  let valor: unknown
  try {
    valor = lerJsonSeguro(json)
  } catch {
    return null
  }
  if (!Array.isArray(valor) || !valor.every((linha) => ehRegistro(linha) && typeof proprio(linha, 'id') === 'string' && typeof proprio(linha, 'texto') === 'string')) return null
  return valor as readonly LinhaParaJogador[] // as: forma conferida por fora (id e texto de cada linha); só gravarNoHistorico escreve aqui (JSON.stringify da cauda do registro, que volta igual)
}

/** A linha da tabela no fio; `null` = linha torta (fica de fora, sem derrubar a página). Com `comRegistro`, leva o registro final. */
function lutaDaLinha(linha: Linha, comRegistro: boolean): LutaNoHistorico | null {
  const modo = texto(linha, 'modo')
  const motivo = texto(linha, 'motivo')
  const vencedor = textoOuNulo(linha, 'vencedor')
  const lados = ladosLidos(texto(linha, 'ladosJson'))
  if (!ehModo(modo) || !ehMotivo(motivo) || (vencedor !== null && !ehLadoDaLuta(vencedor)) || lados === null) return null
  const resumo: LutaNoHistorico = { id: texto(linha, 'id'), fim: numero(linha, 'fim'), modo, lados, vencedor, motivo, rodadas: numero(linha, 'rodadas') }
  if (!comRegistro) return resumo
  const registro = registroLido(texto(linha, 'registroJson'))
  return registro === null ? null : { ...resumo, registro }
}

/** Uma página, das mais novas para as mais velhas, antes de `antesDe` (ms do fim); sem o registro (o site abre uma luta pelo id). */
export function paginaDoHistorico(sql: SqlStorage, antesDe: number | null, limite: number): { lista: LutaNoHistorico[]; temMais: boolean } {
  const linhas = sql.exec(`SELECT * FROM historicoDeLutas WHERE fim < ? ORDER BY fim DESC, id DESC LIMIT ?`, antesDe ?? Number.MAX_SAFE_INTEGER, limite + 1).toArray()
  const lista = linhas.slice(0, limite).flatMap((linha) => {
    const lida = lutaDaLinha(linha, false)
    return lida === null ? [] : [lida]
  })
  return { lista, temMais: linhas.length > limite }
}

/** Uma luta do histórico, com o registro final; `null` = não existe (ou está torta). */
export function lutaDoHistorico(sql: SqlStorage, id: string): LutaNoHistorico | null {
  for (const linha of sql.exec('SELECT * FROM historicoDeLutas WHERE id = ?', id)) return lutaDaLinha(linha, true)
  return null
}
