import type { Personagem } from '../../../client/src/lib/personagem'
import type { SistemaDeRpg } from '../../../client/src/lib/sistemaDeRpg'
import { GRADES_DA_ARENA, type TamanhoDaGrade } from '../../../client/src/lib/arena/grade'
import { arbitrarNaLuta } from '../../../client/src/lib/treino/arbitroDaLuta'
import { validarAjustesDoJuiz } from '../../../client/src/lib/treino/juiz'
import {
  aplicarJogadaNaLuta,
  CONTAS_POR_LUTA_MAX,
  criarLuta,
  marcarAusenteNaLuta,
  marcarPresenteNaLuta,
  participanteDaConta,
  prazoDaLuta,
  sairDaLuta,
  tirarAusentes,
  VERSAO_DO_MOTOR_DA_LUTA,
  type CriacaoDaLuta,
  type EstadoDaLuta,
  type FimDaLutaV4,
  type InscricaoNaLuta,
  type MarcoDaLuta,
  type ModoDaLuta,
  type PapelNaLuta,
  type ParticipanteDaLuta,
  type ResultadoNaLuta,
} from '../../../client/src/lib/treino/luta'
import {
  ehLadoDaLuta,
  ESPERA_DA_LUTA_MS,
  LUTA_ACABADA_FICA_MS,
  resumoDaLuta,
  type ContaNaLuta,
  type EsperaDaLuta,
  type FimDaEspera,
  type LutaAcontecendo,
  type MensagemDaLutaDoServidor,
  type MotivoDaLutaRecusada,
  type PedidoDaLuta,
  type TipoDoPedidoDaLuta,
} from '../../../client/src/lib/treino/lutaDoLobby'
import { VAGAS_POR_LADO_MAX, type CasaDoTreino, type LadoDaLuta, type LutadoresDaLuta } from '../../../client/src/lib/treino/mesaEmMemoria'
import type { GolpesDaVez } from '../../../client/src/lib/treino/lutaAutomatica'
import type { BatalhaDaCena } from '../../../client/src/stores/batalhaFabrica'
import { lutaParaAConta, lutaParaTodos } from '../../../client/src/lib/treino/vistaDaLuta'
import { lerFicha, membroPorConta } from './banco'
import { fichasDaConta, gravarComCota, motorDe, sistemaDoDuelo, type SalaDoDuelo } from './duelo'
import { gravarNoHistorico, lutaDoHistorico, paginaDoHistorico } from './historicoDeLutas'
import { ErroDoBanco, numero, texto, textoOuNulo, type Linha } from './linhas'
import { bytesDoTexto, ehRegistro, lerJsonSeguro, membroAtivo, proprio, type Membro } from './nucleo'
import { enviar } from './sala'

/**
 * LUTA DE N LADOS NO DO CAMPANHA (Arena multijogador, fatia F4 de
 * docs/planos/arena-multijogador-2026-11-07.md §2, §3 e §6), pela mesma
 * conexão WebSocket do duelo. A regra é a do motor v4 (`lib/treino/luta.ts`,
 * `arbitroDaLuta.ts`: o servidor recalcula dano e custo, exige o `seq`); o
 * protocolo está em `lutaDoLobby.ts`. Aqui ficam o SQLite, a sala de espera,
 * o relógio de quem caiu, o histórico e a difusão.
 *
 * - Uma linha por luta em `lutas`; a sala de espera é a mesma linha antes de
 *   começar (`status 'espera'`, o mesmo id), e some sem começar em
 *   `ESPERA_DA_LUTA_MS`. A acabada fica `LUTA_ACABADA_FICA_MS` e é apagada; o
 *   resumo dela já foi ao histórico (`historicoDeLutas.ts`).
 * - `participantes` é o índice de quem está em cada luta: 1 luta por conta
 *   (a espera que vale e que a conta criou ou aceitou, ou a luta em andamento
 *   em que ela ainda conta; o convite pendente não prende ninguém), e a lista
 *   de quem joga. Na espera ele é a fonte do papel e do lado; depois, segue o
 *   estado quando quem está muda, gravando só a diferença (a conta que entrou,
 *   saiu ou trocou de papel ou lado). Não a cada jogada nem a cada queda e
 *   volta: o `ausenteDesde` fica só no estado (§7).
 * - O DO tem UM alarme (achado Tr4): o `alarm()` da campanha chama
 *   `vencerPrazosDasLutas` e reagenda para o menor (`proximoPrazoDasLutas`).
 * - Ausente só quando a CONTA fica sem nenhum socket (achado Tr9). Quem joga
 *   fora 3 min sai da ordem e a luta segue (`tirarAusentes`); quem assiste e
 *   fica sem socket deixa de assistir na hora (a vaga das 12 volta).
 * - Luta gravada por outra versão do motor não continua: sai da tabela na
 *   primeira vez que esta instância do DO mexe nas lutas.
 * - O d20 é do `crypto` do servidor (`motorDe`), nunca do cliente.
 * - Só os sockets que já falaram `luta.*` recebem o que sai daqui
 *   (`SalaDaLuta.ouvintes`): o site de antes da F5 não conhece estes frames.
 *   Cada conta da luta recebe o estado do papel DELA (`lutaParaTodos`): quem
 *   joga o do lado dele, quem assiste sem o combate de ninguém, o árbitro tudo.
 *   Sem teto na saída: o de 64 KiB é só do cliente para o DO.
 * - Ritmo em todo frame (campanha.ts); criar, aceitar, começar, assistir,
 *   cada jogada e cada pedido do árbitro aceitos contam na cota do dia (§6.5),
 *   o criar por conta convidada (cada uma é uma linha no índice). Sair,
 *   recusar e parar também contam (senão assistir e parar em laço gravariam
 *   de graça), mas nunca são recusados por ela: a cota cheia não prende
 *   ninguém numa luta (cheia, a saída grava sem contar; `gravarNaSaida`).
 */

/** O que a luta usa do DO: o mesmo do duelo, com `ouvintes` só dos sockets que já falaram `luta.*`. */
export type SalaDaLuta = SalaDoDuelo

type StatusDaLuta = 'espera' | 'andamento' | 'fim'

interface LinhaDaLuta {
  id: string
  status: StatusDaLuta
  modo: ModoDaLuta
  estadoJson: string
  seq: number
  versaoDoMotor: number
  prazo: number | null
  apagarEm: number | null
}

interface LinhaDoParticipante {
  contaId: string
  papel: PapelNaLuta
  lado: LadoDaLuta | null
}

/** O aceite de uma conta na espera: as fichas (ids) e, do mestre como Judge, os ajustes como vieram (relidos com o sistema no começo). */
interface AceiteGuardado {
  contaId: string
  fichas: string[]
  ajustes: Record<string, unknown> | null
}

/** O `estadoJson` da linha na espera: quem criou, os lados, quando e os aceites. O papel e o lado de cada conta ficam em `participantes`. */
interface EsperaGuardada {
  criador: string
  lados: LadoDaLuta[]
  criadoEm: number
  aceites: AceiteGuardado[]
}

const PAPEIS: readonly PapelNaLuta[] = ['jogador', 'juiz', 'arbitro', 'espectador']

// ── Linhas ──────────────────────────────────────────────────────────────────

function statusDe(valor: string): StatusDaLuta {
  if (valor === 'espera' || valor === 'andamento' || valor === 'fim') return valor
  throw new ErroDoBanco(`status de luta desconhecido: ${valor}`)
}

function modoDe(valor: string): ModoDaLuta {
  if (valor === 'times' || valor === 'todos') return valor
  throw new ErroDoBanco(`modo de luta desconhecido: ${valor}`)
}

function papelDe(valor: string): PapelNaLuta {
  const papel = PAPEIS.find((candidato) => candidato === valor)
  if (papel === undefined) throw new ErroDoBanco(`papel na luta desconhecido: ${valor}`)
  return papel
}

function numeroOuNulo(linha: Linha, coluna: string): number | null {
  return linha[coluna] === null ? null : numero(linha, coluna)
}

function linhaDaLuta(linha: Linha): LinhaDaLuta {
  return {
    id: texto(linha, 'id'),
    status: statusDe(texto(linha, 'status')),
    modo: modoDe(texto(linha, 'modo')),
    estadoJson: texto(linha, 'estadoJson'),
    seq: numero(linha, 'seq'),
    versaoDoMotor: numero(linha, 'versaoDoMotor'),
    prazo: numeroOuNulo(linha, 'prazo'),
    apagarEm: numeroOuNulo(linha, 'apagarEm'),
  }
}

function linhaDoParticipante(linha: Linha): LinhaDoParticipante {
  const lado = textoOuNulo(linha, 'lado')
  if (lado !== null && !ehLadoDaLuta(lado)) throw new ErroDoBanco(`lado de luta desconhecido: ${lado}`)
  return { contaId: texto(linha, 'contaId'), papel: papelDe(texto(linha, 'papel')), lado }
}

function linhaPorId(sql: SqlStorage, id: string): LinhaDaLuta | undefined {
  for (const linha of sql.exec('SELECT * FROM lutas WHERE id = ?', id)) return linhaDaLuta(linha)
  return undefined
}

function participantesDaLinha(sql: SqlStorage, lutaId: string): LinhaDoParticipante[] {
  return sql.exec('SELECT * FROM participantes WHERE lutaId = ? ORDER BY rowid', lutaId).toArray().map(linhaDoParticipante)
}

function lutasDaConta(sql: SqlStorage, contaId: string): LinhaDaLuta[] {
  return sql.exec('SELECT lutas.* FROM lutas JOIN participantes ON participantes.lutaId = lutas.id WHERE participantes.contaId = ? ORDER BY lutas.id', contaId).toArray().map(linhaDaLuta)
}

function apagarLuta(sql: SqlStorage, id: string): void {
  sql.exec('DELETE FROM participantes WHERE lutaId = ?', id)
  sql.exec('DELETE FROM lutas WHERE id = ?', id)
}

// ── A espera guardada ───────────────────────────────────────────────────────

function idsLidos(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null
  const ids: string[] = []
  for (const id of valor) {
    if (typeof id !== 'string') return null
    ids.push(id)
  }
  return ids
}

function aceiteLido(valor: unknown): AceiteGuardado | null {
  if (!ehRegistro(valor)) return null
  const contaId = proprio(valor, 'contaId')
  const fichas = idsLidos(proprio(valor, 'fichas'))
  const ajustes = proprio(valor, 'ajustes')
  if (typeof contaId !== 'string' || fichas === null || (ajustes !== null && !ehRegistro(ajustes))) return null
  return { contaId, fichas, ajustes }
}

/** A espera do `estadoJson`; `null` = torta (a sala some sem lançar). */
function esperaGuardada(linha: LinhaDaLuta): EsperaGuardada | null {
  let valor: unknown
  try {
    valor = lerJsonSeguro(linha.estadoJson)
  } catch {
    return null
  }
  if (!ehRegistro(valor)) return null
  const criador = proprio(valor, 'criador')
  const lados = proprio(valor, 'lados')
  const criadoEm = proprio(valor, 'criadoEm')
  const aceites = proprio(valor, 'aceites')
  if (typeof criador !== 'string' || typeof criadoEm !== 'number' || !Array.isArray(lados) || !Array.isArray(aceites)) return null
  const ladosLidos: LadoDaLuta[] = []
  for (const lado of lados) {
    if (!ehLadoDaLuta(lado)) return null
    ladosLidos.push(lado)
  }
  const aceitesLidos: AceiteGuardado[] = []
  for (const bruto of aceites) {
    const aceite = aceiteLido(bruto)
    if (aceite === null) return null
    aceitesLidos.push(aceite)
  }
  return { criador, lados: ladosLidos, criadoEm, aceites: aceitesLidos }
}

// ── O estado gravado, relido ────────────────────────────────────────────────

function contagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function participanteGravado(valor: unknown): ParticipanteDaLuta | null {
  if (!ehRegistro(valor)) return null
  const contaId = proprio(valor, 'contaId')
  const nome = proprio(valor, 'nome')
  const papel = proprio(valor, 'papel')
  const lado = proprio(valor, 'lado')
  const ausenteDesde = proprio(valor, 'ausenteDesde')
  const robo = proprio(valor, 'robo')
  const lido = PAPEIS.find((candidato) => candidato === papel)
  if (typeof contaId !== 'string' || typeof nome !== 'string' || lido === undefined) return null
  if ((lado !== null && !ehLadoDaLuta(lado)) || (ausenteDesde !== null && typeof ausenteDesde !== 'number') || (robo !== undefined && robo !== true)) return null
  return { contaId, nome, papel: lido, lado, ausenteDesde, ...(robo === true ? { robo } : {}) }
}

function participantesGravados(valor: unknown): ParticipanteDaLuta[] | null {
  if (!Array.isArray(valor)) return null
  const lidos: ParticipanteDaLuta[] = []
  for (const bruto of valor) {
    const participante = participanteGravado(bruto)
    if (participante === null) return null
    lidos.push(participante)
  }
  return lidos
}

/** Os tokens das vagas, se os lutadores têm por fora a forma de `LutadoresDaLuta`; senão `null`. */
function tokensDosLutadores(valor: unknown): string[] | null {
  if (!ehRegistro(valor)) return null
  const vagas = proprio(valor, 'vagas')
  const personagens = proprio(valor, 'personagens')
  if (!Array.isArray(vagas) || !Array.isArray(personagens)) return null
  const tokens: string[] = []
  for (const vaga of vagas) {
    if (!ehRegistro(vaga)) return null
    const tokenId = proprio(vaga, 'tokenId')
    const contaId = proprio(vaga, 'contaId')
    const fora = proprio(vaga, 'fora')
    if (typeof tokenId !== 'string' || typeof proprio(vaga, 'personagemId') !== 'string' || !ehLadoDaLuta(proprio(vaga, 'lado'))) return null
    if ((contaId !== undefined && typeof contaId !== 'string') || (fora !== undefined && fora !== true)) return null
    tokens.push(tokenId)
  }
  return personagens.every((copia) => ehRegistro(copia) && typeof proprio(copia, 'id') === 'string') ? tokens : null
}

function tamanhoGravado(valor: unknown): TamanhoDaGrade | null {
  return valor === 'pequena' || valor === 'media' ? valor : null
}

/** Uma casa por token das vagas e nenhuma a mais, cada uma dentro da grade da luta. */
function posicoesGravadas(valor: unknown, tokens: readonly string[], tamanho: TamanhoDaGrade): Record<string, CasaDoTreino> | null {
  if (!ehRegistro(valor) || Object.keys(valor).length !== tokens.length) return null
  const grade = GRADES_DA_ARENA[tamanho]
  const posicoes: Record<string, CasaDoTreino> = {}
  for (const tokenId of tokens) {
    const casa = proprio(valor, tokenId)
    if (!ehRegistro(casa)) return null
    const col = proprio(casa, 'col')
    const row = proprio(casa, 'row')
    if (!contagem(col) || !contagem(row) || col >= grade.colunas || row >= grade.linhas) return null
    posicoes[tokenId] = { col, row }
  }
  return posicoes
}

/** O fim gravado; `null` = não acabou; `undefined` = torto. */
function fimGravado(valor: unknown): FimDaLutaV4 | null | undefined {
  if (valor === null) return null
  if (!ehRegistro(valor)) return undefined
  const vencedor = proprio(valor, 'vencedor')
  switch (proprio(valor, 'tipo')) {
    case 'vitoria':
      return ehLadoDaLuta(vencedor) ? { tipo: 'vitoria', vencedor } : undefined
    case 'todosCaidos':
      return { tipo: 'todosCaidos' }
    case 'tempo': {
      const teto = proprio(valor, 'teto')
      return teto === 'rodadas' || teto === 'passos' ? { tipo: 'tempo', teto } : undefined
    }
    case 'arbitro':
      return vencedor === null || ehLadoDaLuta(vencedor) ? { tipo: 'arbitro', vencedor } : undefined
    default:
      return undefined
  }
}

/** Os marcos do árbitro; ausente = `null` (nenhum); `undefined` = torto. */
function marcosGravados(valor: unknown): MarcoDaLuta[] | null | undefined {
  if (valor === undefined) return null
  if (!Array.isArray(valor)) return undefined
  const marcos: MarcoDaLuta[] = []
  for (const marco of valor) {
    if (!ehRegistro(marco)) return undefined
    const seq = proprio(marco, 'seq')
    const tipo = proprio(marco, 'tipo')
    const quando = proprio(marco, 'quando')
    if (!contagem(seq) || typeof quando !== 'number' || (tipo !== 'pausar' && tipo !== 'retomar' && tipo !== 'encerrar')) return undefined
    marcos.push({ seq, tipo, quando })
  }
  return marcos
}

/** Os golpes do robô na vez; ausente = `null`; `undefined` = torto. */
function golpesGravados(valor: unknown): GolpesDaVez | null | undefined {
  if (valor === undefined) return null
  if (!ehRegistro(valor)) return undefined
  const chave = proprio(valor, 'chave')
  const golpes = proprio(valor, 'golpes')
  return typeof chave === 'string' && contagem(golpes) ? { chave, golpes } : undefined
}

/** A cena por fora: a ordem (`turnos`, com as cartas e a rodada) e o registro, que o fio, a vista e a lista leem antes da store. */
function cenaNaForma(valor: unknown): boolean {
  if (!ehRegistro(valor)) return false
  const turnos = proprio(valor, 'turnos')
  return ehRegistro(turnos) && Array.isArray(proprio(turnos, 'cartas')) && typeof proprio(turnos, 'rodada') === 'number' && Array.isArray(proprio(valor, 'registro'))
}

/** O `EstadoDaLuta` do `estadoJson`, relido campo a campo onde o DO lê direto; `null` = linha torta. Nunca lança. */
function lutaGravadaDoJson(estadoJson: string, id: string): EstadoDaLuta | null {
  let valor: unknown
  try {
    valor = lerJsonSeguro(estadoJson)
  } catch {
    return null
  }
  if (!ehRegistro(valor) || proprio(valor, 'versao') !== VERSAO_DO_MOTOR_DA_LUTA || proprio(valor, 'id') !== id) return null
  const modo = proprio(valor, 'modo')
  const lutadores = proprio(valor, 'lutadores')
  const cena = proprio(valor, 'cena')
  const seq = proprio(valor, 'seq')
  const passos = proprio(valor, 'passos')
  const montagem = proprio(valor, 'montagem')
  const pausada = proprio(valor, 'pausada')
  const tamanho = tamanhoGravado(proprio(valor, 'tamanho'))
  const participantes = participantesGravados(proprio(valor, 'participantes'))
  const tokens = tokensDosLutadores(lutadores)
  const posicoes = tokens === null || tamanho === null ? null : posicoesGravadas(proprio(valor, 'posicoes'), tokens, tamanho)
  const fim = fimGravado(proprio(valor, 'fim'))
  const marcos = marcosGravados(proprio(valor, 'marcos'))
  const golpesDoRobo = golpesGravados(proprio(valor, 'golpesDoRobo'))
  if ((modo !== 'times' && modo !== 'todos') || tamanho === null || participantes === null || posicoes === null || typeof montagem !== 'boolean') return null
  if (!contagem(seq) || !contagem(passos) || fim === undefined || marcos === undefined || golpesDoRobo === undefined || (pausada !== undefined && pausada !== true) || !cenaNaForma(cena)) return null
  return {
    versao: VERSAO_DO_MOTOR_DA_LUTA,
    id,
    modo,
    participantes,
    lutadores: lutadores as LutadoresDaLuta, // as: forma conferida por fora (tokensDosLutadores); as cópias não têm leitor sem normalizar (personagemDoArquivo mudaria a cópia), e só gravarLuta escreve aqui
    tamanho,
    posicoes,
    montagem,
    cena: cena as BatalhaDaCena, // as: forma conferida por fora (cenaNaForma); a cena da batalha não tem leitor, e só gravarLuta a escreve (JSON.stringify do estado da store, que volta igual)
    seq,
    passos,
    fim,
    ...(pausada === true ? { pausada } : {}),
    ...(marcos === null ? {} : { marcos }),
    ...(golpesDoRobo === null ? {} : { golpesDoRobo }),
  }
}

/** A luta da linha; `null` = espera, outra versão do motor, ou linha torta: não continua e não aparece, sem lançar. */
function lutaDaLinha(linha: LinhaDaLuta): EstadoDaLuta | null {
  if (linha.status === 'espera' || linha.versaoDoMotor !== VERSAO_DO_MOTOR_DA_LUTA) return null
  return lutaGravadaDoJson(linha.estadoJson, linha.id)
}

// ── Gravar ──────────────────────────────────────────────────────────────────

/** Quem está na luta, como o índice `participantes` guarda (sem o `ausenteDesde`: queda e volta não mexem no índice). */
function chaveDosParticipantes(luta: EstadoDaLuta): string {
  return JSON.stringify(luta.participantes.map(({ contaId, papel, lado }) => [contaId, papel, lado]))
}

/**
 * O índice segue o estado gravando só a diferença: entra a conta que chegou,
 * sai a que deixou a luta, e muda o papel ou o lado de quem trocou. Cada linha
 * (e cada índice dela) conta no teto de gravações do dia: refazer as N a cada
 * espectador que entra ou sai estourava a cota (revisão da F4).
 */
function sincronizarParticipantes(sql: SqlStorage, luta: EstadoDaLuta): void {
  const gravados = new Map(participantesDaLinha(sql, luta.id).map((gravado) => [gravado.contaId, gravado]))
  for (const { contaId, papel, lado } of luta.participantes) {
    const gravado = gravados.get(contaId)
    gravados.delete(contaId)
    if (gravado === undefined) sql.exec('INSERT INTO participantes (lutaId, contaId, papel, lado) VALUES (?, ?, ?, ?)', luta.id, contaId, papel, lado)
    else if (gravado.papel !== papel || gravado.lado !== lado) sql.exec('UPDATE participantes SET papel = ?, lado = ? WHERE lutaId = ? AND contaId = ?', papel, lado, luta.id, contaId)
  }
  // O que sobrou no mapa já não está na luta.
  for (const contaId of gravados.keys()) sql.exec('DELETE FROM participantes WHERE lutaId = ? AND contaId = ?', luta.id, contaId)
}

/**
 * A luta vai à linha: o prazo do motor (`prazoDaLuta`); acabada, sem prazo,
 * com a hora de ser apagada (a primeira que valeu) e, na primeira vez, o
 * resumo no histórico. O índice só é refeito quando quem está mudou
 * (`antes` null = a luta acabou de sair da espera).
 */
function gravarLuta(sql: SqlStorage, antes: EstadoDaLuta | null, luta: EstadoDaLuta, linha: Pick<LinhaDaLuta, 'status' | 'apagarEm'>, agora: number): void {
  const acabou = luta.fim !== null
  sql.exec(
    'UPDATE lutas SET status = ?, estadoJson = ?, seq = ?, versaoDoMotor = ?, prazo = ?, apagarEm = ?, atualizadoEm = ? WHERE id = ?',
    acabou ? 'fim' : 'andamento',
    JSON.stringify(luta),
    luta.seq,
    luta.versao,
    prazoDaLuta(luta),
    acabou ? (linha.apagarEm ?? agora + LUTA_ACABADA_FICA_MS) : null,
    agora,
    luta.id,
  )
  if (antes === null || chaveDosParticipantes(antes) !== chaveDosParticipantes(luta)) sincronizarParticipantes(sql, luta)
  const resumo = acabou && linha.status !== 'fim' ? resumoDaLuta(luta, agora) : null
  if (resumo !== null) gravarNoHistorico(sql, resumo)
}

/**
 * A saída (sair, recusar, parar de assistir, o criador que desiste) conta uma
 * op na cota do dia, mas nunca é recusada por ela: a cota cheia não prende
 * ninguém numa luta. Cheia, grava sem contar (o `gravarComCota` recusado não
 * gravou nada).
 */
function gravarNaSaida(sala: SalaDaLuta, contaId: string, bytes: number, agora: number, gravar: () => void): void {
  if (!gravarComCota(sala, contaId, bytes, agora, gravar).ok) sala.transacao(gravar)
}

/** As instâncias do DO que já tiraram as lutas de outra versão: a versão só muda num deploy, que traz instância nova. */
const SEM_OUTRA_VERSAO = new WeakSet<SqlStorage>()

/** Luta (em andamento ou acabada) de outra versão do motor sai: não anda, não vence e prenderia as contas. A espera fica (só guarda ids). */
function semLutasDeOutraVersao(sql: SqlStorage): void {
  if (SEM_OUTRA_VERSAO.has(sql)) return
  sql.exec(`DELETE FROM lutas WHERE status <> 'espera' AND versaoDoMotor <> ?`, VERSAO_DO_MOTOR_DA_LUTA)
  sql.exec('DELETE FROM participantes WHERE lutaId NOT IN (SELECT id FROM lutas)')
  SEM_OUTRA_VERSAO.add(sql)
}

/** A conta ainda conta na luta: quem joga, com ficha que não saiu; quem arbitra ou assiste, enquanto está na lista. */
function contaAindaNaLuta(luta: EstadoDaLuta, contaId: string): boolean {
  const participante = participanteDaConta(luta, contaId)
  if (participante === null) return false
  if (participante.papel === 'arbitro' || participante.papel === 'espectador') return true
  return luta.lutadores.vagas.some((vaga) => vaga.contaId === contaId && vaga.fora !== true)
}

/** Na espera, prende quem a criou e quem já aceitou; o convite pendente não (senão uma sala com 11 convidados prenderia todos por 5 min). */
function esperaPrende(linha: LinhaDaLuta, contaId: string, agora: number): boolean {
  if (linha.prazo !== null && linha.prazo <= agora) return false
  const espera = esperaGuardada(linha)
  return espera !== null && (espera.criador === contaId || espera.aceites.some((aceite) => aceite.contaId === contaId))
}

/**
 * 1 luta por conta (plano §2): numa espera que ainda vale e que ela criou ou
 * aceitou, ou numa luta em andamento em que ainda conta. `exceto` = a luta do
 * próprio pedido (quem aceita de novo a mesma sala não está ocupado por ela).
 */
function contaOcupada(sql: SqlStorage, contaId: string, agora: number, exceto: string | null): boolean {
  return lutasDaConta(sql, contaId).some((linha) => {
    if (linha.id === exceto) return false
    if (linha.status === 'espera') return esperaPrende(linha, contaId, agora)
    const luta = linha.status === 'andamento' ? lutaDaLinha(linha) : null
    return luta !== null && contaAindaNaLuta(luta, contaId)
  })
}

// ── Respostas e difusão ────────────────────────────────────────────────────

/** `texto` = o motivo que a regra da batalha deu (R1); campo a mais no frame, que o site de antes ignora (N-1). */
function recusar(ws: WebSocket, pedido: TipoDoPedidoDaLuta | 'luta', motivo: MotivoDaLutaRecusada, extra: { id?: string; tentarDepoisDe?: number; texto?: string } = {}): void {
  const resposta: MensagemDaLutaDoServidor = { t: 'luta.recusado', pedido, motivo }
  if (extra.id !== undefined) resposta.id = extra.id
  if (extra.tentarDepoisDe !== undefined) resposta.tentarDepoisDe = extra.tentarDepoisDe
  if (extra.texto !== undefined) resposta.texto = extra.texto
  enviar(ws, resposta)
}

export function recusarPedidoDaLuta(ws: WebSocket, pedido: TipoDoPedidoDaLuta | 'luta', motivo: MotivoDaLutaRecusada, id?: string): void {
  recusar(ws, pedido, motivo, id === undefined ? {} : { id })
}

function idDoPedido(pedido: PedidoDaLuta): { id?: string } {
  switch (pedido.t) {
    case 'luta.criar':
    case 'luta.lista':
      return {}
    case 'luta.historico':
      return pedido.id === undefined ? {} : { id: pedido.id }
    default:
      return { id: pedido.id }
  }
}

/** O pedido acima do ritmo: recusado com a hora de tentar de novo. */
export function recusarLutaPorRitmo(ws: WebSocket, pedido: PedidoDaLuta, tentarDepoisDe: number): void {
  recusar(ws, pedido.t, 'ritmo', { ...idDoPedido(pedido), tentarDepoisDe })
}

function contaNaLuta(sql: SqlStorage, contaId: string): ContaNaLuta {
  // Conta que saiu da campanha continua com o nome que tinha; sem linha nenhuma, o próprio contaId.
  return { contaId, nome: membroPorConta(sql, contaId)?.nome ?? contaId }
}

function paraAsContas(sala: SalaDaLuta, contas: readonly string[], mensagem: MensagemDaLutaDoServidor): void {
  for (const { ws, contaId } of sala.ouvintes()) if (contas.includes(contaId)) enviar(ws, mensagem)
}

/** Cada conta da luta recebe a do papel dela; a de quem assiste é montada uma vez para todos (`lutaParaTodos`). */
function difundirEstado(sala: SalaDaLuta, luta: EstadoDaLuta): void {
  const porConta = lutaParaTodos(luta, sistemaDoDuelo(sala.sql))
  for (const { ws, contaId } of sala.ouvintes()) {
    const daConta = porConta.get(contaId)
    if (daConta !== undefined) enviar(ws, { t: 'luta.estado', luta: daConta })
  }
}

/** Só para este socket: o estado de agora, do papel da conta (quem jogou sobre um estado velho, ou depois do fim). */
function enviarEstadoA(sql: SqlStorage, ws: WebSocket, luta: EstadoDaLuta, contaId: string): void {
  const daConta = lutaParaAConta(luta, contaId, sistemaDoDuelo(sql))
  if (daConta !== null) enviar(ws, { t: 'luta.estado', luta: daConta })
}

function esperaParaOFio(sql: SqlStorage, linha: LinhaDaLuta, espera: EsperaGuardada): EsperaDaLuta {
  const aceites = new Map(espera.aceites.map((aceite) => [aceite.contaId, aceite]))
  return {
    id: linha.id,
    criador: contaNaLuta(sql, espera.criador),
    modo: linha.modo,
    lados: espera.lados,
    contas: participantesDaLinha(sql, linha.id).map(({ contaId, papel, lado }) => {
      const aceite = aceites.get(contaId)
      return { ...contaNaLuta(sql, contaId), papel, lado, aceitou: aceite !== undefined, fichas: aceite?.fichas ?? [] }
    }),
    criadoEm: espera.criadoEm,
    venceEm: linha.prazo ?? espera.criadoEm + ESPERA_DA_LUTA_MS,
  }
}

/** As salas de espera que ainda valem e em que a conta está. A torta fica de fora (o alarme a apaga no prazo). */
function convitesDaConta(sql: SqlStorage, contaId: string, agora: number): EsperaDaLuta[] {
  return lutasDaConta(sql, contaId).flatMap((linha) => {
    if (linha.status !== 'espera' || (linha.prazo !== null && linha.prazo <= agora)) return []
    const espera = esperaGuardada(linha)
    return espera === null ? [] : [esperaParaOFio(sql, linha, espera)]
  })
}

/** As lutas acontecendo agora (§6), para qualquer membro: os lados com as contas, a rodada, quantos assistem e quantos ainda cabem. */
function lutasAcontecendo(sql: SqlStorage): LutaAcontecendo[] {
  const linhas = sql.exec(`SELECT * FROM lutas WHERE status = 'andamento' AND versaoDoMotor = ? ORDER BY atualizadoEm DESC`, VERSAO_DO_MOTOR_DA_LUTA).toArray().map(linhaDaLuta)
  return linhas.flatMap((linha) => {
    const luta = lutaDaLinha(linha)
    if (luta === null) return []
    const lados = [...new Set(luta.lutadores.vagas.map((vaga) => vaga.lado))].sort().map((lado) => ({
      lado,
      contas: luta.participantes.filter((participante) => participante.lado === lado).map(({ contaId, nome }) => ({ contaId, nome })),
    }))
    const assistindo = luta.participantes.filter((participante) => participante.papel === 'espectador').length
    return [{ id: luta.id, modo: luta.modo, lados, rodada: luta.cena.turnos.rodada, assistindo, vagas: CONTAS_POR_LUTA_MAX - luta.participantes.length, pausada: luta.pausada === true }]
  })
}

/** A lista a todos os sockets que falam `luta.*`, cada um com as salas de espera dele: uma luta começou, acabou, ou mudou quem assiste. */
function difundirLista(sala: SalaDaLuta, agora: number): void {
  const acontecendo = lutasAcontecendo(sala.sql)
  const convites = new Map<string, EsperaDaLuta[]>()
  for (const { ws, contaId } of sala.ouvintes()) {
    let daConta = convites.get(contaId)
    if (daConta === undefined) {
      daConta = convitesDaConta(sala.sql, contaId, agora)
      convites.set(contaId, daConta)
    }
    enviar(ws, { t: 'luta.lista', convites: daConta, acontecendo })
  }
}

function difundirEspera(sala: SalaDaLuta, linha: LinhaDaLuta): void {
  const espera = esperaGuardada(linha)
  if (espera === null) return
  const fio = esperaParaOFio(sala.sql, linha, espera)
  paraAsContas(
    sala,
    fio.contas.map((conta) => conta.contaId),
    { t: 'luta.espera', espera: fio },
  )
}

/** Quem fecha a espera pedindo (o criador que desiste): a saída dele conta na cota. */
interface QuemFecha {
  contaId: string
  bytes: number
  agora: number
}

/** A espera acaba para todos (some da tabela). `quem` null = venceu o prazo (ninguém pediu, nada a contar). */
function fecharEspera(sala: SalaDaLuta, linha: LinhaDaLuta, motivo: FimDaEspera, quem: QuemFecha | null): void {
  const contas = participantesDaLinha(sala.sql, linha.id).map((participante) => participante.contaId)
  const apagar = (): void => apagarLuta(sala.sql, linha.id)
  if (quem === null) sala.transacao(apagar)
  else gravarNaSaida(sala, quem.contaId, quem.bytes, quem.agora, apagar)
  paraAsContas(sala, contas, { t: 'luta.fechada', id: linha.id, motivo })
}

function quantosAssistem(luta: EstadoDaLuta): number {
  return luta.participantes.filter((participante) => participante.papel === 'espectador').length
}

/** Depois de gravar: o estado a todos da luta; a lista a todos quando a luta acaba ou muda quem assiste. */
function avisar(sala: SalaDaLuta, antes: EstadoDaLuta, depois: EstadoDaLuta, linha: LinhaDaLuta, agora: number): void {
  difundirEstado(sala, depois)
  if ((depois.fim !== null && linha.status !== 'fim') || quantosAssistem(antes) !== quantosAssistem(depois)) difundirLista(sala, agora)
}

// ── Aceite e fichas ─────────────────────────────────────────────────────────

/** Os docs das fichas liberadas para o treino (os inimigos do mestre como Judge); `null` = alguma não está liberada. */
function fichasDoTreino(sql: SqlStorage, ids: readonly string[]): Personagem[] | null {
  const docs: Personagem[] = []
  for (const id of ids) {
    const ficha = lerFicha(sql, id)
    if (ficha === undefined || ficha.apagada || ficha.visivel !== 'treino') return null
    docs.push(ficha.doc)
  }
  return docs
}

/** A ficha que o Judge copia, como a mesa a tem agora: a da mesa ou a do treino; a do mestre nunca (é segredo dele). `null` = o boneco. */
function baseDoJuiz(sql: SqlStorage, baseFichaId: string | null): Personagem | null {
  if (baseFichaId === null) return null
  const ficha = lerFicha(sql, baseFichaId)
  return ficha === undefined || ficha.apagada || ficha.visivel === 'mestre' ? null : ficha.doc
}

/** O aceite serve para o papel? As fichas de quem joga (dele, na mesa), os inimigos e os ajustes do Judge; quem arbitra ou assiste, sem nada. */
function motivoDoAceite(sql: SqlStorage, sistema: SistemaDeRpg, contaId: string, papel: PapelNaLuta, fichas: readonly string[], ajustes: Record<string, unknown> | null): MotivoDaLutaRecusada | null {
  switch (papel) {
    case 'jogador':
      return fichas.length > 0 && fichasDaConta(sql, contaId, fichas) !== null ? null : 'fichas'
    case 'juiz':
      if (ajustes === null || validarAjustesDoJuiz(ajustes, sistema) === null) return 'formato'
      // O Judge ocupa uma das vagas do lado.
      return fichas.length < VAGAS_POR_LADO_MAX && fichasDoTreino(sql, fichas) !== null ? null : 'fichas'
    case 'arbitro':
    case 'espectador':
      return fichas.length === 0 && ajustes === null ? null : 'papel'
  }
}

/** A inscrição do motor para quem aceitou, com os docs lidos agora; `null` = as fichas já não servem. */
function inscricaoDoAceite(sql: SqlStorage, sistema: SistemaDeRpg, participante: LinhaDoParticipante, aceite: AceiteGuardado): InscricaoNaLuta | null {
  const { contaId, papel, lado } = participante
  if (motivoDoAceite(sql, sistema, contaId, papel, aceite.fichas, aceite.ajustes) !== null) return null
  const { nome } = contaNaLuta(sql, contaId)
  switch (papel) {
    case 'jogador': {
      const fichas = fichasDaConta(sql, contaId, aceite.fichas)
      return fichas === null ? null : { contaId, nome, papel, lado, fichas }
    }
    case 'juiz': {
      const fichas = fichasDoTreino(sql, aceite.fichas)
      const ajustes = aceite.ajustes === null ? null : validarAjustesDoJuiz(aceite.ajustes, sistema)
      if (fichas === null || ajustes === null) return null
      // A base que sumiu da mesa (ou é do mestre) vira o boneco: `fichaDoJuiz` com `base` null.
      return { contaId, nome, papel, lado, fichas, juiz: { ajustes, base: baseDoJuiz(sql, ajustes.baseFichaId) } }
    }
    case 'arbitro':
    case 'espectador':
      return { contaId, nome, papel, lado: null, fichas: [] }
  }
}

function motivoDaCriacao(criacao: Exclude<CriacaoDaLuta, { ok: true }>): MotivoDaLutaRecusada {
  switch (criacao.motivo) {
    case 'cheia':
      return 'cheia'
    case 'contaRepetida':
    case 'papel':
      return 'papel'
    case 'ladoRepetido':
    case 'poucosLados':
    case 'vazio':
      return 'lados'
    case 'semFicha':
    case 'naoEDono':
    case 'demais':
    case 'cheio':
      return 'fichas'
  }
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

export function atenderPedidoDaLuta(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: PedidoDaLuta, agora: number): void {
  semLutasDeOutraVersao(sala.sql)
  switch (pedido.t) {
    case 'luta.criar':
      return criar(sala, ws, eu, pedido, agora)
    case 'luta.aceitar':
      return aceitar(sala, ws, eu, pedido, agora)
    case 'luta.recusar':
      return recusarEspera(sala, ws, eu, pedido.id, pedido.t, bytesDoTexto(JSON.stringify(pedido)), agora)
    case 'luta.comecar':
      return comecar(sala, ws, eu, pedido, agora)
    case 'luta.jogar':
    case 'luta.arbitrar':
      return mexer(sala, ws, eu, pedido, agora)
    case 'luta.sair':
      return sair(sala, ws, eu, pedido, agora)
    case 'luta.assistir':
      return assistir(sala, ws, eu, pedido, agora)
    case 'luta.parar':
      return parar(sala, ws, eu, pedido, agora)
    case 'luta.lista':
      return lista(sala, ws, eu, agora)
    case 'luta.historico':
      return historico(sala, ws, pedido)
  }
}

/** Os convites conferidos contra a campanha e o modo; `null` = servem. */
function motivoDosConvidados(sql: SqlStorage, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.criar' }>): MotivoDaLutaRecusada | null {
  const { convidados, lados, modo } = pedido
  if (convidados.length > CONTAS_POR_LUTA_MAX) return 'cheia'
  if (!convidados.some((convidado) => convidado.contaId === eu.contaId)) return 'papel'
  if (new Set(convidados.map((convidado) => convidado.contaId)).size !== convidados.length) return 'papel'
  let doMestre = 0
  const ladosDeQuemJoga: LadoDaLuta[] = []
  for (const { contaId, papel, lado } of convidados) {
    const membro = membroPorConta(sql, contaId)
    if (!membroAtivo(membro)) return 'nao-existe'
    const comLado = papel === 'jogador' || papel === 'juiz'
    // O Judge e o árbitro são do mestre, e um dos dois por luta (o mestre é um só).
    if (papel === 'juiz' || papel === 'arbitro') {
      if (membro.papel !== 'mestre') return 'papel'
      doMestre += 1
    }
    if (comLado !== (lado !== null)) return 'papel'
    if (lado !== null) {
      if (!lados.includes(lado)) return 'lados'
      ladosDeQuemJoga.push(lado)
    }
  }
  if (doMestre > 1) return 'papel'
  // Todo lado da lista tem alguém; em todos contra todos, cada conta num lado só dela.
  if (!lados.every((lado) => ladosDeQuemJoga.includes(lado))) return 'lados'
  if (modo === 'todos' && new Set(ladosDeQuemJoga).size !== ladosDeQuemJoga.length) return 'lados'
  return null
}

function criar(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.criar' }>, agora: number): void {
  const { sql } = sala
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema')
  const motivo = motivoDosConvidados(sql, eu, pedido)
  if (motivo !== null) return recusar(ws, pedido.t, motivo)
  const meu = pedido.convidados.find((convidado) => convidado.contaId === eu.contaId)
  if (meu === undefined) return recusar(ws, pedido.t, 'papel')
  const ajustes = pedido.ajustes ?? null
  const doAceite = motivoDoAceite(sql, sistema, eu.contaId, meu.papel, pedido.fichas, ajustes)
  if (doAceite !== null) return recusar(ws, pedido.t, doAceite)
  if (pedido.convidados.some((convidado) => contaOcupada(sql, convidado.contaId, agora, null))) return recusar(ws, pedido.t, 'ocupado')
  const id = `luta_${crypto.randomUUID()}`
  const espera: EsperaGuardada = { criador: eu.contaId, lados: pedido.lados, criadoEm: agora, aceites: [{ contaId: eu.contaId, fichas: pedido.fichas, ajustes }] }
  const gravar = (): void => {
    sql.exec(
      `INSERT INTO lutas (id, status, modo, estadoJson, seq, versaoDoMotor, prazo, apagarEm, atualizadoEm) VALUES (?, 'espera', ?, ?, 0, ?, ?, NULL, ?)`,
      id,
      pedido.modo,
      JSON.stringify(espera),
      VERSAO_DO_MOTOR_DA_LUTA,
      agora + ESPERA_DA_LUTA_MS,
      agora,
    )
    for (const { contaId, papel, lado } of pedido.convidados) {
      sql.exec('INSERT INTO participantes (lutaId, contaId, papel, lado) VALUES (?, ?, ?, ?)', id, contaId, papel, lado)
    }
  }
  // Uma op por conta convidada: cada uma é uma linha (e dois índices) no `participantes`; criar e desistir em laço pagam o que gravam.
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, gravar, pedido.convidados.length)
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { tentarDepoisDe: gravado.tentarDepoisDe })
  const linha = linhaPorId(sql, id)
  if (linha === undefined) throw new ErroDoBanco('luta gravada e não achada')
  difundirEspera(sala, linha)
}

/** A espera da conta que ainda vale; a vencida fecha para todos aqui mesmo. `null` = não há (já respondido). */
function esperaDaConta(sala: SalaDaLuta, ws: WebSocket, eu: Membro, id: string, pedido: TipoDoPedidoDaLuta, agora: number): { linha: LinhaDaLuta; espera: EsperaGuardada; meu: LinhaDoParticipante } | null {
  const linha = linhaPorId(sala.sql, id)
  const meu = linha === undefined ? undefined : participantesDaLinha(sala.sql, id).find((participante) => participante.contaId === eu.contaId)
  const espera = linha === undefined || linha.status !== 'espera' ? null : esperaGuardada(linha)
  if (linha === undefined || meu === undefined || espera === null) {
    recusar(ws, pedido, 'nao-existe', { id })
    return null
  }
  if (linha.prazo !== null && linha.prazo <= agora) {
    fecharEspera(sala, linha, 'expirou', null)
    return null
  }
  return { linha, espera, meu }
}

/** O lado do aceite: `null` fica o do convite; no time, outro da lista troca de time; em todos contra todos, só o do convite. `undefined` = não serve. */
function ladoDoAceite(linha: LinhaDaLuta, espera: EsperaGuardada, meu: LinhaDoParticipante, pedido: LadoDaLuta | null): LadoDaLuta | null | undefined {
  if (pedido === null || pedido === meu.lado) return meu.lado
  if (meu.lado === null || linha.modo === 'todos' || !espera.lados.includes(pedido)) return undefined
  return pedido
}

function aceitar(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.aceitar' }>, agora: number): void {
  const { sql } = sala
  const achada = esperaDaConta(sala, ws, eu, pedido.id, pedido.t, agora)
  if (achada === null) return
  const { linha, espera, meu } = achada
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema', { id: pedido.id })
  const lado = ladoDoAceite(linha, espera, meu, pedido.lado)
  if (lado === undefined) return recusar(ws, pedido.t, 'lados', { id: pedido.id })
  const ajustes = pedido.ajustes ?? null
  const motivo = motivoDoAceite(sql, sistema, eu.contaId, meu.papel, pedido.fichas, ajustes)
  if (motivo !== null) return recusar(ws, pedido.t, motivo, { id: pedido.id })
  // O convite pendente não prende: é no aceite que a conta fica nesta luta, então ela não pode estar em outra.
  if (contaOcupada(sql, eu.contaId, agora, linha.id)) return recusar(ws, pedido.t, 'ocupado', { id: pedido.id })
  const nova: EsperaGuardada = { ...espera, aceites: [...espera.aceites.filter((aceite) => aceite.contaId !== eu.contaId), { contaId: eu.contaId, fichas: pedido.fichas, ajustes }] }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => {
    sql.exec('UPDATE lutas SET estadoJson = ?, atualizadoEm = ? WHERE id = ?', JSON.stringify(nova), agora, linha.id)
    sql.exec('UPDATE participantes SET lado = ? WHERE lutaId = ? AND contaId = ?', lado, linha.id, eu.contaId)
  })
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  difundirEspera(sala, { ...linha, estadoJson: JSON.stringify(nova) })
}

/** Quem foi convidado recusa (ou sai da espera); quem criou desiste da sala inteira. As duas contam na cota sem ser recusadas (`gravarNaSaida`). */
function recusarEspera(sala: SalaDaLuta, ws: WebSocket, eu: Membro, id: string, pedido: TipoDoPedidoDaLuta, bytes: number, agora: number): void {
  const achada = esperaDaConta(sala, ws, eu, id, pedido, agora)
  if (achada === null) return
  const { linha, espera } = achada
  if (espera.criador === eu.contaId) return fecharEspera(sala, linha, 'desistiu', { contaId: eu.contaId, bytes, agora })
  const nova: EsperaGuardada = { ...espera, aceites: espera.aceites.filter((aceite) => aceite.contaId !== eu.contaId) }
  gravarNaSaida(sala, eu.contaId, bytes, agora, () => {
    sala.sql.exec('UPDATE lutas SET estadoJson = ?, atualizadoEm = ? WHERE id = ?', JSON.stringify(nova), agora, linha.id)
    sala.sql.exec('DELETE FROM participantes WHERE lutaId = ? AND contaId = ?', linha.id, eu.contaId)
  })
  paraAsContas(sala, [eu.contaId], { t: 'luta.fechada', id: linha.id, motivo: 'recusou' })
  difundirEspera(sala, { ...linha, estadoJson: JSON.stringify(nova) })
}

function comecar(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.comecar' }>, agora: number): void {
  const { sql } = sala
  const achada = esperaDaConta(sala, ws, eu, pedido.id, pedido.t, agora)
  if (achada === null) return
  const { linha, espera } = achada
  if (espera.criador !== eu.contaId) return recusar(ws, pedido.t, 'so-criador', { id: pedido.id })
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema', { id: pedido.id })
  const aceites = new Map(espera.aceites.map((aceite) => [aceite.contaId, aceite]))
  const inscricoes: InscricaoNaLuta[] = []
  const semVoce: string[] = []
  for (const participante of participantesDaLinha(sql, linha.id)) {
    const aceite = aceites.get(participante.contaId)
    // Quem não aceitou, ou cujas fichas já não servem (apagadas, mudaram de dono), fica de fora.
    const inscricao = aceite === undefined || !membroAtivo(membroPorConta(sql, participante.contaId)) ? null : inscricaoDoAceite(sql, sistema, participante, aceite)
    if (inscricao === null) semVoce.push(participante.contaId)
    else inscricoes.push(inscricao)
  }
  const criada = criarLuta({ id: linha.id, modo: linha.modo, inscricoes }, motorDe(sistema))
  if (!criada.ok) return recusar(ws, pedido.t, motivoDaCriacao(criada), { id: pedido.id })
  // Quem aceitou e fechou tudo enquanto esperava: os 3 minutos dele começam já.
  const luta = inscricoes.reduce((atual, { contaId }) => (sala.contaConectada(contaId, null) ? atual : marcarAusenteNaLuta(atual, contaId, agora)), criada.luta)
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarLuta(sql, null, luta, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  paraAsContas(sala, semVoce, { t: 'luta.fechada', id: linha.id, motivo: 'semVoce' })
  difundirEstado(sala, luta)
  difundirLista(sala, agora)
}

/** A luta em andamento (ou acabada) em que a conta está; `null` = não há (já respondido). */
function lutaDaConta(sala: SalaDaLuta, ws: WebSocket, eu: Membro, id: string, pedido: TipoDoPedidoDaLuta): { linha: LinhaDaLuta; luta: EstadoDaLuta } | null {
  const linha = linhaPorId(sala.sql, id)
  const luta = linha === undefined ? null : lutaDaLinha(linha)
  if (linha === undefined || luta === null || participanteDaConta(luta, eu.contaId) === null) {
    recusar(ws, pedido, 'nao-existe', { id })
    return null
  }
  return { linha, luta }
}

/** A jogada de quem joga e o pedido do árbitro: o motor confere tudo; aceito, conta na cota e vai a todos. */
function mexer(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.jogar' | 'luta.arbitrar' }>, agora: number): void {
  const { sql } = sala
  const achada = lutaDaConta(sala, ws, eu, pedido.id, pedido.t)
  if (achada === null) return
  const { linha, luta } = achada
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema', { id: pedido.id })
  const motor = motorDe(sistema)
  const feito: ResultadoNaLuta = pedido.t === 'luta.jogar' ? aplicarJogadaNaLuta(luta, motor, eu.contaId, pedido.jogada) : arbitrarNaLuta(luta, motor, eu.contaId, pedido.pedido, agora)
  if (!feito.ok) {
    recusar(ws, pedido.t, feito.motivo, feito.texto === undefined ? { id: pedido.id } : { id: pedido.id, texto: feito.texto })
    // Sobre estado velho (ou luta já acabada): quem mandou recebe o de agora para jogar de novo.
    if (feito.motivo === 'seqVelho' || feito.motivo === 'acabou') enviarEstadoA(sql, ws, luta, eu.contaId)
    return
  }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarLuta(sql, luta, feito.luta, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  avisar(sala, luta, feito.luta, linha, agora)
}

/** Na espera, sair é recusar. Na luta, as fichas de quem joga saem da ordem e a luta segue; quem arbitra ou assiste deixa a lista e recebe o fechamento. */
function sair(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.sair' }>, agora: number): void {
  const linha = linhaPorId(sala.sql, pedido.id)
  const bytes = bytesDoTexto(JSON.stringify(pedido))
  if (linha?.status === 'espera') return recusarEspera(sala, ws, eu, pedido.id, pedido.t, bytes, agora)
  deixar(sala, ws, eu, pedido.id, pedido.t, bytes, agora)
}

function deixar(sala: SalaDaLuta, ws: WebSocket, eu: Membro, id: string, pedido: TipoDoPedidoDaLuta, bytes: number, agora: number): void {
  const { sql } = sala
  const achada = lutaDaConta(sala, ws, eu, id, pedido)
  if (achada === null) return
  const { linha, luta } = achada
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido, 'sistema', { id })
  const feito = sairDaLuta(luta, motorDe(sistema), eu.contaId, agora)
  if (!feito.ok) {
    recusar(ws, pedido, feito.motivo, { id })
    if (feito.motivo === 'acabou') enviarEstadoA(sql, ws, luta, eu.contaId)
    return
  }
  gravarNaSaida(sala, eu.contaId, bytes, agora, () => gravarLuta(sql, luta, feito.luta, linha, agora))
  if (participanteDaConta(feito.luta, eu.contaId) === null) paraAsContas(sala, [eu.contaId], { t: 'luta.fechada', id, motivo: 'recusou' })
  avisar(sala, luta, feito.luta, linha, agora)
}

function parar(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.parar' }>, agora: number): void {
  const linha = linhaPorId(sala.sql, pedido.id)
  const luta = linha === undefined ? null : lutaDaLinha(linha)
  const meu = luta === null ? null : participanteDaConta(luta, eu.contaId)
  if (meu === null) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  if (meu.papel !== 'espectador') return recusar(ws, pedido.t, 'papel', { id: pedido.id })
  deixar(sala, ws, eu, pedido.id, pedido.t, bytesDoTexto(JSON.stringify(pedido)), agora)
}

/** Qualquer membro assiste a uma luta em andamento, sem lado e sem ficha, até a 12ª conta; quem já está nela só recebe o estado. */
function assistir(sala: SalaDaLuta, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDaLuta, { t: 'luta.assistir' }>, agora: number): void {
  const { sql } = sala
  const linha = linhaPorId(sql, pedido.id)
  const luta = linha === undefined || linha.status !== 'andamento' ? null : lutaDaLinha(linha)
  if (linha === undefined || luta === null) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  if (participanteDaConta(luta, eu.contaId) !== null) return enviarEstadoA(sql, ws, luta, eu.contaId)
  if (luta.participantes.length >= CONTAS_POR_LUTA_MAX) return recusar(ws, pedido.t, 'cheia', { id: pedido.id })
  if (contaOcupada(sql, eu.contaId, agora, null)) return recusar(ws, pedido.t, 'ocupado', { id: pedido.id })
  const novo: ParticipanteDaLuta = { contaId: eu.contaId, nome: eu.nome, papel: 'espectador', lado: null, ausenteDesde: null }
  // Assistir não muda o `seq`: a jogada que alguém mandou sobre o estado de antes continua valendo.
  const depois: EstadoDaLuta = { ...luta, participantes: [...luta.participantes, novo] }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarLuta(sql, luta, depois, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  avisar(sala, luta, depois, linha, agora)
}

/** Só para este socket: as salas de espera da conta e as lutas acontecendo; depois, o estado de cada luta dela (em andamento e as acabadas que ainda ficam). */
function lista(sala: SalaDaLuta, ws: WebSocket, eu: Membro, agora: number): void {
  const { sql } = sala
  enviar(ws, { t: 'luta.lista', convites: convitesDaConta(sql, eu.contaId, agora), acontecendo: lutasAcontecendo(sql) })
  for (const linha of lutasDaConta(sql, eu.contaId)) {
    const luta = lutaDaLinha(linha)
    if (luta !== null) enviarEstadoA(sql, ws, luta, eu.contaId)
  }
}

/** Qualquer membro lê o histórico (a vista pública); com `id`, uma luta só, com o registro final. */
function historico(sala: SalaDaLuta, ws: WebSocket, pedido: Extract<PedidoDaLuta, { t: 'luta.historico' }>): void {
  if (pedido.id !== undefined) {
    const luta = lutaDoHistorico(sala.sql, pedido.id)
    enviar(ws, { t: 'luta.historico', lista: luta === null ? [] : [luta], temMais: false })
    return
  }
  enviar(ws, { t: 'luta.historico', ...paginaDoHistorico(sala.sql, pedido.antesDe, pedido.limite) })
}

// ── Entrar, sair e o relógio ───────────────────────────────────────────────

/**
 * Depois do `ola` (a conta tem socket): quem estava ausente volta (o relógio
 * dos 3 minutos para; o mestre retoma o Judge do robô); passou do prazo e o
 * alarme ainda não rodou = sai agora, como o alarme faria. Nada vai a este
 * socket aqui: a lista sai no `luta.lista` que o site novo pede.
 */
export function lutasNoOla(sala: SalaDaLuta, eu: Membro, agora: number): void {
  const { sql } = sala
  semLutasDeOutraVersao(sql)
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return
  for (const linha of lutasDaConta(sql, eu.contaId)) {
    const luta = linha.status === 'andamento' ? lutaDaLinha(linha) : null
    if (luta === null) continue
    const depois = marcarPresenteNaLuta(tirarAusentes(luta, motorDe(sistema), agora), eu.contaId)
    if (depois === luta) continue
    sala.transacao(() => gravarLuta(sql, luta, depois, linha, agora))
    avisar(sala, luta, depois, linha, agora)
  }
}

/**
 * A conta ficou sem nenhum socket (achado Tr9): em cada luta em andamento,
 * quem joga ou arbitra começa a contar os 3 minutos e os outros veem na hora;
 * quem assiste deixa de assistir já. Devolve se algum prazo nasceu (quem
 * chama reagenda o alarme).
 */
export function contaSaiuDasLutas(sala: SalaDaLuta, contaId: string, agora: number): boolean {
  const { sql } = sala
  semLutasDeOutraVersao(sql)
  const sistema = sistemaDoDuelo(sql)
  let nasceuPrazo = false
  for (const linha of lutasDaConta(sql, contaId)) {
    const luta = linha.status === 'andamento' ? lutaDaLinha(linha) : null
    const participante = luta === null ? null : participanteDaConta(luta, contaId)
    if (luta === null || participante === null) continue
    let depois = marcarAusenteNaLuta(luta, contaId, agora)
    if (participante.papel === 'espectador' && sistema !== null) {
      const saiu = sairDaLuta(luta, motorDe(sistema), contaId, agora)
      depois = saiu.ok ? saiu.luta : luta
    }
    if (depois === luta) continue
    sala.transacao(() => gravarLuta(sql, luta, depois, linha, agora))
    avisar(sala, luta, depois, linha, agora)
    nasceuPrazo ||= prazoDaLuta(depois) !== null
  }
  return nasceuPrazo
}

/**
 * O que venceu até `agora` (o `alarm()` do DO): a espera sem começar some
 * (`expirou`); quem passou dos 3 minutos sai da ordem e a luta segue
 * (`tirarAusentes`); a acabada que já ficou o bastante é apagada. Linha
 * vencida que este motor não lê é apagada: nunca fica um prazo vencido para
 * trás (o alarme tocaria em laço).
 */
export function vencerPrazosDasLutas(sala: SalaDaLuta, agora: number): void {
  const { sql } = sala
  semLutasDeOutraVersao(sql)
  const sistema = sistemaDoDuelo(sql)
  const vencidas = sql.exec('SELECT * FROM lutas WHERE prazo IS NOT NULL AND prazo <= ? ORDER BY id', agora).toArray().map(linhaDaLuta)
  for (const linha of vencidas) {
    if (linha.status === 'espera') {
      fecharEspera(sala, linha, 'expirou', null)
      continue
    }
    const luta = lutaDaLinha(linha)
    if (luta === null || sistema === null) {
      sala.transacao(() => apagarLuta(sql, linha.id))
      continue
    }
    const depois = tirarAusentes(luta, motorDe(sistema), agora)
    // Gravado mesmo sem mudar: o `prazo` da linha volta a ser o do estado (nunca fica um vencido para trás).
    sala.transacao(() => gravarLuta(sql, luta, depois, linha, agora))
    if (depois !== luta) avisar(sala, luta, depois, linha, agora)
  }
  sala.transacao(() => {
    sql.exec('DELETE FROM participantes WHERE lutaId IN (SELECT id FROM lutas WHERE apagarEm IS NOT NULL AND apagarEm <= ?)', agora)
    sql.exec('DELETE FROM lutas WHERE apagarEm IS NOT NULL AND apagarEm <= ?', agora)
  })
}

/** O menor `prazo` ou `apagarEm` das lutas: a próxima vez que o alarme precisa acordar por elas. `null` = nenhuma. */
export function proximoPrazoDasLutas(sql: SqlStorage): number | null {
  const consulta = `SELECT MIN(quando) AS n FROM (
    SELECT MIN(prazo) AS quando FROM lutas WHERE status = 'espera' OR versaoDoMotor = ?
    UNION ALL SELECT MIN(apagarEm) AS quando FROM lutas)`
  for (const linha of sql.exec(consulta, VERSAO_DO_MOTOR_DA_LUTA)) {
    return linha.n === null ? null : numero(linha, 'n')
  }
  return null
}
