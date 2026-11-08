import type { BatalhaDaCena } from '../../stores/batalhaFabrica'
import type { Casa } from './blocos'
import { lerJudgeNaCena } from './judge'
import type { LinhaDoRegistro } from './registro'
import { lerRegrasDaBatalha } from './regrasDoCampo'
import type { TurnosDaCena } from './turnos'

/**
 * A BATALHA SALVA (conserto das fichas F1, fatia S5; P8 do grilling em
 * docs/auditoria-fichas/respostas-do-grilling.md): a batalha em andamento
 * (ordem, recargas, usos, Overload, selos, golpes pendentes, registro) mora na
 * memória do app do mestre (decisão 1) e, desde o S5, também num arquivo ao
 * lado da aventura (ou do mapa solto), `batalha-em-andamento.json`. Fechar ou
 * atualizar o app no meio não zera mais nada: ao reabrir, o mestre escolhe
 * "Retomar a batalha" ou "Encerrar".
 *
 * Aqui só o formato, puro (sem disco): o texto com `versao`, como o
 * `rpg.json` das pastas e a cópia de recuperação. Quem lê e grava é
 * `batalhaSalvaNoDisco.ts`; quem decide quando é `stores/batalhaSalvaNaMesa.ts`.
 *
 * As animações (`efeitos`) não vão: tocam uma vez e não se desfazem. A
 * conexão do jogador zera o `seq` dela quando a lista chega vazia
 * (`EfeitosDaBatalha.tsx`), e o contador do módulo da store recomeça junto.
 */

export const VERSAO_DA_BATALHA_SALVA = 1
export const ARQUIVO_DA_BATALHA_SALVA = 'batalha-em-andamento.json'

export interface BatalhaSalva {
  /**
   * A mesa dona: o id da aventura, ou o do mapa solto (o mesmo do "Retomar a
   * mesa"). A cópia de uma aventura duplicada tem outro id e não herda a batalha.
   */
  mesaId: string
  /** Quando foi gravada (ms desde a época). */
  salvaEm: number
  /** Chave da cena (a de `tableSceneKey`) → a cena em batalha. */
  cenas: Readonly<Record<string, BatalhaDaCena>>
}

/** O que a leitura do texto deu. `versao-mais-nova` = gravada por um app mais novo: não volta e não se grava por cima. */
export type TextoDaBatalhaSalva = { ok: true; salva: BatalhaSalva } | { ok: false; motivo: 'ilegivel' | 'versao-mais-nova' }

/** A cena como vai ao arquivo: sem as animações. */
function cenaParaOArquivo(cena: BatalhaDaCena): BatalhaDaCena {
  const { efeitos: _animacoes, ...semEfeitos } = cena
  return semEfeitos
}

export function textoDaBatalhaSalva(salva: BatalhaSalva): string {
  const cenas = Object.fromEntries(Object.entries(salva.cenas).map(([chave, cena]) => [chave, cenaParaOArquivo(cena)]))
  return JSON.stringify({ versao: VERSAO_DA_BATALHA_SALVA, mesaId: salva.mesaId, salvaEm: salva.salvaEm, cenas })
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura. O arquivo é do próprio app, na pasta dele em `<appData>/maps`, mas
// pode chegar cortado (queda no meio) ou mexido à mão: o ESQUELETO que a store
// percorre (as listas, os registros, os números da vez) é conferido peça por
// peça; o miolo de cada peça (o combate de cada um, o selo, o golpe) é o que
// o próprio app gravou e volta como está.
// ───────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function ehTexto(valor: unknown): valor is string {
  return typeof valor === 'string'
}

function ehContagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor)
}

function listaDeObjetos(valor: unknown): boolean {
  return Array.isArray(valor) && valor.every(isRecord)
}

function registroDe(valor: unknown, item: (valor: unknown) => boolean): boolean {
  return isRecord(valor) && Object.values(valor).every(item)
}

/** Campo opcional: ausente, ou do jeito que `confere` pede. */
function ausenteOu(valor: unknown, confere: (valor: unknown) => boolean): boolean {
  return valor === undefined || confere(valor)
}

function ehCarta(valor: unknown): boolean {
  if (!isRecord(valor)) return false
  const { id, tokenId, personagemId, nome, extra, bando } = valor
  return ehTexto(id) && ehTexto(tokenId) && (personagemId === null || ehTexto(personagemId)) && ausenteOu(nome, ehTexto) && ausenteOu(extra, isRecord) && ausenteOu(bando, isRecord)
}

/**
 * O esqueleto da vez. Predicado de tipo de propósito: conferir o miolo de
 * cada peça (combate, selo, golpe, forma, invocado) seria reescrever a regra
 * inteira, e quem gravou foi este app (ver o comentário da seção).
 */
function ehTurnosSalvos(valor: unknown): valor is TurnosDaCena {
  if (!isRecord(valor)) return false
  const { cartas, vez, rodada, desempate, d20, empates, extras, gastos } = valor
  if (!Array.isArray(cartas) || !cartas.every(ehCarta)) return false
  if (vez !== null && !ehTexto(vez)) return false
  if (!ehContagem(rodada) || (desempate !== 'd20' && desempate !== 'manual')) return false
  if (!registroDe(d20, ehNumero) || !registroDe(empates, ehNumero) || !registroDe(extras, isRecord) || !registroDe(gastos, isRecord)) return false
  const listas = [valor.golpes, valor.contras, valor.selos, valor.invocados, valor.invocacoes, valor.lembretesDaMarca]
  if (!listas.every((lista) => ausenteOu(lista, listaDeObjetos))) return false
  return ausenteOu(valor.combate, (combate) => registroDe(combate, isRecord)) && ausenteOu(valor.formas, (formas) => registroDe(formas, isRecord))
}

function ehAutor(valor: unknown): boolean {
  if (!isRecord(valor)) return false
  if (valor.tipo === 'mestre') return true
  return valor.tipo === 'jogador' && ehTexto(valor.playerId) && ehTexto(valor.nome)
}

function ehListaDeTextos(valor: unknown): boolean {
  return Array.isArray(valor) && valor.every(ehTexto)
}

/** Uma linha do registro: o esqueleto que o painel e o Desfazer leem (mesma ressalva de `ehTurnosSalvos` para a `reversao`). */
function ehLinhaSalva(valor: unknown): valor is LinhaDoRegistro {
  if (!isRecord(valor)) return false
  const { id, seq, quando, rodada, autor, tipo, texto, envolve, reversao, desfeita } = valor
  if (!ehTexto(id) || !ehNumero(seq) || !ehNumero(quando) || !ehNumero(rodada) || !ehAutor(autor) || !ehTexto(tipo) || !ehTexto(texto)) return false
  if (!isRecord(envolve) || !ehListaDeTextos(envolve.tokenIds) || !ehListaDeTextos(envolve.personagemIds)) return false
  return isRecord(reversao) && ehTexto(reversao.tipo) && ausenteOu(desfeita, isRecord)
}

function ehCasa(valor: unknown): valor is Casa {
  return isRecord(valor) && ehNumero(valor.col) && ehNumero(valor.row)
}

/** Caminhos e trilhas por token. `null` = torto. `Object.fromEntries`: chave "__proto__" do arquivo vira chave comum, nunca protótipo. */
function caminhosDe(valor: unknown): Record<string, number> | null {
  if (!isRecord(valor)) return null
  const pares = Object.entries(valor)
  const lidos: [string, number][] = []
  for (const [tokenId, blocos] of pares) {
    if (!ehNumero(blocos) || blocos < 0) return null
    lidos.push([tokenId, blocos])
  }
  return Object.fromEntries(lidos)
}

function trilhasDe(valor: unknown): Record<string, readonly Casa[]> | null {
  if (!isRecord(valor)) return null
  const lidas: [string, Casa[]][] = []
  for (const [tokenId, casas] of Object.entries(valor)) {
    if (!Array.isArray(casas)) return null
    const lista = casas.filter(ehCasa)
    if (lista.length !== casas.length) return null
    lidas.push([tokenId, lista])
  }
  return Object.fromEntries(lidas)
}

/** Uma cena do arquivo, ou `null` (torta: fica de fora, as outras voltam). A regra do campo torta vira "nenhuma"; o Judge torto, "ainda não posto". */
function cenaDoArquivo(valor: unknown): BatalhaDaCena | null {
  if (!isRecord(valor)) return null
  const { turnos, registro, zerados, rev, turnosRev } = valor
  if (!ehTurnosSalvos(turnos)) return null
  if (!Array.isArray(registro)) return null
  const linhas = registro.filter(ehLinhaSalva)
  if (linhas.length !== registro.length) return null
  if (!ehContagem(zerados) || !ehContagem(rev) || !ehContagem(turnosRev)) return null
  const caminhos = caminhosDe(valor.caminhos)
  const trilhas = trilhasDe(valor.trilhas)
  if (caminhos === null || trilhas === null) return null
  const regras = valor.regras === null ? null : lerRegrasDaBatalha(valor.regras)
  const cena: BatalhaDaCena = { caminhos, trilhas, zerados, rev, turnosRev, turnos, registro: linhas, regras }
  const judge = valor.judge === undefined ? null : lerJudgeNaCena(valor.judge)
  if (judge !== null) cena.judge = judge
  return cena
}

/**
 * Lê o texto do arquivo. JSON cortado, mesa sem id ou versão desconhecida:
 * `ilegivel`; versão maior que a deste app: `versao-mais-nova`. Cena torta
 * fica de fora (as outras voltam).
 */
export function batalhaSalvaDoTexto(texto: string): TextoDaBatalhaSalva {
  let lido: unknown
  try {
    lido = JSON.parse(texto)
  } catch {
    return { ok: false, motivo: 'ilegivel' }
  }
  if (!isRecord(lido) || !ehNumero(lido.versao)) return { ok: false, motivo: 'ilegivel' }
  if (lido.versao > VERSAO_DA_BATALHA_SALVA) return { ok: false, motivo: 'versao-mais-nova' }
  const { mesaId, salvaEm, cenas } = lido
  if (lido.versao !== VERSAO_DA_BATALHA_SALVA || !ehTexto(mesaId) || mesaId.length === 0 || !ehNumero(salvaEm) || !isRecord(cenas)) return { ok: false, motivo: 'ilegivel' }
  const lidas: [string, BatalhaDaCena][] = []
  for (const [chave, bruta] of Object.entries(cenas)) {
    const cena = cenaDoArquivo(bruta)
    if (cena !== null) lidas.push([chave, cena])
  }
  return { ok: true, salva: { mesaId, salvaEm, cenas: Object.fromEntries(lidas) } }
}
