import { secureRollDie } from '../../../client/src/lib/dice'
import type { Personagem } from '../../../client/src/lib/personagem'
import { lerSistemaDeRpg, type SistemaDeRpg } from '../../../client/src/lib/sistemaDeRpg'
import {
  aplicarJogada,
  criarDuelo,
  desistirDoDuelo,
  marcarAusente,
  marcarPresente,
  prazoDoDuelo,
  vencerAusencia,
  VERSAO_DO_MOTOR_DO_DUELO,
  type DueloGravado,
  type FimDoDuelo,
  type JogadorDoDuelo,
  type MotorDoDuelo,
} from '../../../client/src/lib/treino/duelo'
import { GRADE_DO_TREINO, type CasaDoTreino, type LadoDoTreino, type LutadoresDoTreino } from '../../../client/src/lib/treino/mesaEmMemoria'
import type { BatalhaDaCena } from '../../../client/src/stores/batalhaFabrica'
import {
  CONVITE_VALE_MS,
  DUELO_ACABADO_FICA_MS,
  type ConviteDoDuelo,
  type FimDoConvite,
  type MensagemDoDueloDoServidor,
  type MotivoDoDueloRecusado,
  type PedidoDoDuelo,
  type TipoDoPedidoDoDuelo,
} from '../../../client/src/lib/treino/dueloDoLobby'
import { dueloParaOLado, dueloParaOsLados, ladoDaContaNoDuelo, type DueloDoLado } from '../../../client/src/lib/treino/vistaDoDuelo'
import { gravarCota, lerCota, lerFicha, lerSistema, membroPorConta } from './banco'
import type { Ouvinte } from './chat'
import { ErroDoBanco, jsonDoTexto, numero, texto, type Linha } from './linhas'
import { bytesDoTexto, cabeNaCota, chaveDaCotaDaCampanha, chaveDaCotaDaConta, comOpContada, ehRegistro, lerJsonSeguro, membroAtivo, proprio, type Membro } from './nucleo'
import { enviar } from './sala'

/**
 * DUELO NO DO CAMPANHA (plano do Lobby §4.5 e §8.2, fatia T6), pela mesma
 * conexão WebSocket das fichas, do chat e do mural. A regra da luta é a da
 * T5 (`client/src/lib/treino/duelo.ts`: o servidor recalcula dano e custo,
 * exige o `seq`); o protocolo está em `dueloDoLobby.ts`. Aqui ficam o SQLite,
 * o relógio de quem caiu e a difusão.
 *
 * - Uma linha por duelo na tabela `duelos`; o convite é a mesma linha antes
 *   de começar (`status 'convite'`, o mesmo id), e é apagado se ninguém
 *   aceita. O duelo acabado fica `DUELO_ACABADO_FICA_MS` e é apagado.
 * - `prazo` = quando algo vence (o convite; os 3 minutos de quem caiu, 12.15);
 *   `apagarEm` = quando o acabado sai. O DO tem UM alarme (achado Tr4): o
 *   `alarm()` da campanha chama `vencerPrazosDosDuelos` e reagenda para o
 *   menor dos dois (`proximoPrazoDosDuelos`).
 * - Ausente só quando a CONTA fica sem nenhum socket (achado Tr9): a segunda
 *   aba aberta segura o duelo. Sem tempo limite por turno (12.15): quem não
 *   quer esperar o outro jogar sai pelo `duelo.desistir` (o outro vence).
 * - Duelo gravado por outra versão do motor (a versão subiu num deploy) não
 *   continua: sai da tabela na primeira vez que esta instância do DO mexe nos
 *   duelos (`semDuelosDeOutraVersao`), e nem conta como `ocupado` nem como prazo.
 * - O d20 é do `crypto` do servidor (`secureRollDie`), nunca do cliente.
 * - Só as duas contas do duelo recebem o estado, cada uma o do lado DELA
 *   (`dueloParaOLado`, fatia M2): o fio (fichas projetadas, cauda do
 *   registro) e a vista dela (`vistaParaJogador`, o HUD da Arena), montada
 *   aqui porque o Escudo cheio lê o registro completo, que só o DO tem.
 *   Sem teto na saída: o de 64 KiB é só do cliente para o DO.
 * - Ritmo em todo frame (campanha.ts); convidar, aceitar e cada jogada aceita
 *   contam na cota do dia (§6.5), como a mensagem do chat.
 */

/** O que o duelo usa do DO: o SQLite, a transação, os sockets prontos e se a conta ainda tem socket. */
export interface SalaDoDuelo {
  sql: SqlStorage
  transacao<T>(passo: () => T): T
  ouvintes(): Ouvinte[]
  /** A conta tem algum socket aberto além de `exceto`? */
  contaConectada(contaId: string, exceto: WebSocket | null): boolean
}

type StatusDoDuelo = 'convite' | 'andamento' | 'fim'

/** Uma linha de `duelos` (plano §4.5). `estadoJson` = o `ConviteGuardado` no convite, o `DueloGravado` depois. */
interface LinhaDoDuelo {
  id: string
  status: StatusDoDuelo
  jogadorA: string
  jogadorB: string
  estadoJson: string
  seq: number
  versaoDoMotor: number
  prazo: number | null
  apagarEm: number | null
}

/** O que o convite guarda além das colunas: as fichas de quem convidou e quando. */
interface ConviteGuardado {
  fichasA: string[]
  criadoEm: number
}

const D20 = 20

// ── Linhas ──────────────────────────────────────────────────────────────────

function statusDe(valor: string): StatusDoDuelo {
  if (valor === 'convite' || valor === 'andamento' || valor === 'fim') return valor
  throw new ErroDoBanco(`status de duelo desconhecido: ${valor}`)
}

function numeroOuNulo(linha: Linha, coluna: string): number | null {
  return linha[coluna] === null ? null : numero(linha, coluna)
}

function linhaDoDuelo(linha: Linha): LinhaDoDuelo {
  return {
    id: texto(linha, 'id'),
    status: statusDe(texto(linha, 'status')),
    jogadorA: texto(linha, 'jogadorA'),
    jogadorB: texto(linha, 'jogadorB'),
    estadoJson: texto(linha, 'estadoJson'),
    seq: numero(linha, 'seq'),
    versaoDoMotor: numero(linha, 'versaoDoMotor'),
    prazo: numeroOuNulo(linha, 'prazo'),
    apagarEm: numeroOuNulo(linha, 'apagarEm'),
  }
}

function linhaPorId(sql: SqlStorage, id: string): LinhaDoDuelo | undefined {
  for (const linha of sql.exec('SELECT * FROM duelos WHERE id = ?', id)) return linhaDoDuelo(linha)
  return undefined
}

function linhasDaConta(sql: SqlStorage, contaId: string): LinhaDoDuelo[] {
  return sql.exec('SELECT * FROM duelos WHERE jogadorA = ? OR jogadorB = ? ORDER BY id', contaId, contaId).toArray().map(linhaDoDuelo)
}

function conviteGuardado(linha: LinhaDoDuelo): ConviteGuardado {
  const valor = jsonDoTexto(linha.estadoJson)
  const fichasA = ehRegistro(valor) ? proprio(valor, 'fichasA') : undefined
  const criadoEm = ehRegistro(valor) ? proprio(valor, 'criadoEm') : undefined
  if (!Array.isArray(fichasA) || typeof criadoEm !== 'number') throw new ErroDoBanco('convite de duelo fora do formato')
  return {
    criadoEm,
    fichasA: fichasA.map((id) => {
      if (typeof id !== 'string') throw new ErroDoBanco('convite de duelo fora do formato')
      return id
    }),
  }
}

// ── O duelo gravado, relido ─────────────────────────────────────────────────

/** Inteiro de 0 em diante: `seq`, `passos`, a coluna e a linha da casa. */
function contagem(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0
}

function ehLado(valor: unknown): valor is LadoDoTreino {
  return valor === 'a' || valor === 'b'
}

function jogadorGravado(valor: unknown): JogadorDoDuelo | null {
  if (!ehRegistro(valor)) return null
  const contaId = proprio(valor, 'contaId')
  const nome = proprio(valor, 'nome')
  const ausenteDesde = proprio(valor, 'ausenteDesde')
  if (typeof contaId !== 'string' || typeof nome !== 'string') return null
  if (ausenteDesde !== null && typeof ausenteDesde !== 'number') return null
  return { contaId, nome, ausenteDesde }
}

/** Um leitor por tipo de fim: um tipo novo em `FimDoDuelo` não compila sem o leitor dele aqui. */
const LEITORES_DO_FIM: { [Tipo in FimDoDuelo['tipo']]: (fim: Record<string, unknown>) => Extract<FimDoDuelo, { tipo: Tipo }> | null } = {
  vitoria: (fim) => {
    const vencedor = proprio(fim, 'vencedor')
    return ehLado(vencedor) ? { tipo: 'vitoria', vencedor } : null
  },
  todosCaidos: () => ({ tipo: 'todosCaidos' }),
  tempo: (fim) => {
    const teto = proprio(fim, 'teto')
    return teto === 'rodadas' || teto === 'passos' ? { tipo: 'tempo', teto } : null
  },
  ausencia: (fim) => {
    const vencedor = proprio(fim, 'vencedor')
    return vencedor === null || ehLado(vencedor) ? { tipo: 'ausencia', vencedor } : null
  },
  desistencia: (fim) => {
    const vencedor = proprio(fim, 'vencedor')
    return ehLado(vencedor) ? { tipo: 'desistencia', vencedor } : null
  },
}

function ehTipoDoFim(tipo: unknown): tipo is FimDoDuelo['tipo'] {
  return typeof tipo === 'string' && Object.hasOwn(LEITORES_DO_FIM, tipo)
}

/** O fim gravado; `null` = o duelo não acabou; `undefined` = fim torto. */
function fimGravado(valor: unknown): FimDoDuelo | null | undefined {
  if (valor === null) return null
  if (!ehRegistro(valor)) return undefined
  const tipo = proprio(valor, 'tipo')
  if (!ehTipoDoFim(tipo)) return undefined
  return LEITORES_DO_FIM[tipo](valor) ?? undefined
}

/** Os tokens das vagas, se os lutadores têm por fora a forma de `LutadoresDoTreino` (vagas com lado e ids, cópias com id); senão `null`. */
function tokensDosLutadores(valor: unknown): string[] | null {
  if (!ehRegistro(valor)) return null
  const vagas = proprio(valor, 'vagas')
  const personagens = proprio(valor, 'personagens')
  if (!Array.isArray(vagas) || !Array.isArray(personagens)) return null
  const listaDeVagas: readonly unknown[] = vagas
  const copias: readonly unknown[] = personagens
  const tokens: string[] = []
  for (const vaga of listaDeVagas) {
    if (!ehRegistro(vaga)) return null
    const tokenId = proprio(vaga, 'tokenId')
    if (typeof tokenId !== 'string' || typeof proprio(vaga, 'personagemId') !== 'string' || !ehLado(proprio(vaga, 'lado'))) return null
    tokens.push(tokenId)
  }
  return copias.every((copia) => ehRegistro(copia) && typeof proprio(copia, 'id') === 'string') ? tokens : null
}

/**
 * As casas das fichas: uma por token das vagas e nenhuma a mais, cada uma
 * dentro da grade (`GRADE_DO_TREINO`). O `andar` lê `posicoes[tokenId]` e
 * conta as outras como ocupadas: casa faltando, sobrando ou fora da grade é linha torta.
 */
function posicoesGravadas(valor: unknown, tokens: readonly string[]): Record<string, CasaDoTreino> | null {
  if (!ehRegistro(valor) || Object.keys(valor).length !== tokens.length) return null
  const posicoes: Record<string, CasaDoTreino> = {}
  for (const tokenId of tokens) {
    const casa = proprio(valor, tokenId)
    if (!ehRegistro(casa)) return null
    const col = proprio(casa, 'col')
    const row = proprio(casa, 'row')
    if (!contagem(col) || !contagem(row) || col >= GRADE_DO_TREINO.colunas || row >= GRADE_DO_TREINO.linhas) return null
    posicoes[tokenId] = { col, row }
  }
  return posicoes
}

/** A cena por fora: a ordem (`turnos`, com as cartas) e o registro, que o fio e a vista leem antes da store. */
function cenaNaForma(valor: unknown): boolean {
  if (!ehRegistro(valor)) return false
  const turnos = proprio(valor, 'turnos')
  return ehRegistro(turnos) && Array.isArray(proprio(turnos, 'cartas')) && Array.isArray(proprio(valor, 'registro'))
}

/**
 * O `DueloGravado` do `estadoJson`, relido campo a campo onde o DO lê direto
 * (versão, id, jogadores, posições, `seq`, `passos`, fim); `null` = linha torta.
 * Nunca lança: a linha torta não derruba o `ola`, a jogada nem o alarme.
 */
function dueloGravadoDoJson(estadoJson: string, id: string): DueloGravado | null {
  let valor: unknown
  try {
    valor = lerJsonSeguro(estadoJson)
  } catch {
    return null
  }
  if (!ehRegistro(valor) || proprio(valor, 'versao') !== VERSAO_DO_MOTOR_DO_DUELO || proprio(valor, 'id') !== id) return null
  const lutadores = proprio(valor, 'lutadores')
  const cena = proprio(valor, 'cena')
  const jogadores = proprio(valor, 'jogadores')
  const seq = proprio(valor, 'seq')
  const passos = proprio(valor, 'passos')
  const tokens = tokensDosLutadores(lutadores)
  const posicoes = tokens === null ? null : posicoesGravadas(proprio(valor, 'posicoes'), tokens)
  const a = ehRegistro(jogadores) ? jogadorGravado(proprio(jogadores, 'a')) : null
  const b = ehRegistro(jogadores) ? jogadorGravado(proprio(jogadores, 'b')) : null
  const fim = fimGravado(proprio(valor, 'fim'))
  if (posicoes === null || a === null || b === null || !contagem(seq) || !contagem(passos) || fim === undefined || !cenaNaForma(cena)) return null
  return {
    versao: VERSAO_DO_MOTOR_DO_DUELO,
    id,
    jogadores: { a, b },
    lutadores: lutadores as LutadoresDoTreino, // as: forma conferida por fora (tokensDosLutadores); as cópias não têm leitor sem normalizar (personagemDoArquivo mudaria a cópia), e só gravarDuelo escreve aqui
    posicoes,
    cena: cena as BatalhaDaCena, // as: forma conferida por fora (cenaNaForma); a cena da batalha não tem leitor, e só gravarDuelo a escreve (JSON.stringify do estado da store, que volta igual)
    seq,
    passos,
    fim,
  }
}

/**
 * O duelo da linha; `null` = convite, estado de outra versão do motor, ou
 * linha torta (`dueloGravadoDoJson`): não continua e não aparece, sem lançar.
 */
function dueloDaLinha(linha: LinhaDoDuelo): DueloGravado | null {
  if (linha.status === 'convite' || linha.versaoDoMotor !== VERSAO_DO_MOTOR_DO_DUELO) return null
  return dueloGravadoDoJson(linha.estadoJson, linha.id)
}

/** O duelo vai à linha: o prazo de quem caiu; acabado, sem prazo e com a hora de ser apagado (a primeira que valeu). */
function gravarDuelo(sql: SqlStorage, duelo: DueloGravado, linha: Pick<LinhaDoDuelo, 'jogadorA' | 'jogadorB' | 'apagarEm'>, agora: number): void {
  const acabou = duelo.fim !== null
  sql.exec(
    `INSERT INTO duelos (id, status, jogadorA, jogadorB, estadoJson, seq, versaoDoMotor, prazo, apagarEm, atualizadoEm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET status = excluded.status, estadoJson = excluded.estadoJson, seq = excluded.seq, versaoDoMotor = excluded.versaoDoMotor,
       prazo = excluded.prazo, apagarEm = excluded.apagarEm, atualizadoEm = excluded.atualizadoEm`,
    duelo.id,
    acabou ? 'fim' : 'andamento',
    linha.jogadorA,
    linha.jogadorB,
    JSON.stringify(duelo),
    duelo.seq,
    duelo.versao,
    prazoDoDuelo(duelo),
    acabou ? (linha.apagarEm ?? agora + DUELO_ACABADO_FICA_MS) : null,
    agora,
  )
}

function apagarLinha(sql: SqlStorage, id: string): void {
  sql.exec('DELETE FROM duelos WHERE id = ?', id)
}

/** Só o duelo desta versão do motor prende a conta: o de outra não anda (`dueloDaLinha` = null). */
function emAndamento(sql: SqlStorage, contaId: string): boolean {
  return (
    sql
      .exec(`SELECT 1 AS achou FROM duelos WHERE status = 'andamento' AND versaoDoMotor = ? AND (jogadorA = ? OR jogadorB = ?) LIMIT 1`, VERSAO_DO_MOTOR_DO_DUELO, contaId, contaId)
      .toArray().length > 0
  )
}

/** As instâncias do DO (por SQLite) que já tiraram os duelos de outra versão: a versão só muda num deploy, que traz instância nova. */
const SEM_OUTRA_VERSAO = new WeakSet<SqlStorage>()

/**
 * Duelo (em andamento ou acabado) de outra versão do motor sai da tabela: o
 * estado dele não é lido por este motor, então não anda, não aparece e não
 * vence nunca; parado ali, deixaria as duas contas `ocupado` para sempre. O
 * convite fica: guarda só fichas e hora, e o aceite monta o duelo no motor de
 * agora. Uma vez por instância, antes de qualquer coisa que mexe nos duelos.
 */
function semDuelosDeOutraVersao(sql: SqlStorage): void {
  if (SEM_OUTRA_VERSAO.has(sql)) return
  sql.exec(`DELETE FROM duelos WHERE status <> 'convite' AND versaoDoMotor <> ?`, VERSAO_DO_MOTOR_DO_DUELO)
  SEM_OUTRA_VERSAO.add(sql)
}

function conviteEsperando(sql: SqlStorage, contaId: string, agora: number): boolean {
  return sql.exec(`SELECT 1 AS achou FROM duelos WHERE status = 'convite' AND jogadorA = ? AND prazo > ? LIMIT 1`, contaId, agora).toArray().length > 0
}

// ── Sistema, fichas e motor ────────────────────────────────────────────────

/** O sistema lido de `meta`, por DO (o mesmo isolado pode ter várias campanhas). `null` = não é do motor do One Piece. */
const SISTEMAS = new WeakMap<SqlStorage, SistemaDeRpg | null>()

function sistemaDoDuelo(sql: SqlStorage): SistemaDeRpg | null {
  const guardado = SISTEMAS.get(sql)
  if (guardado !== undefined) return guardado
  const lido = lerSistemaDeRpg(lerSistema(sql))
  // O duelo é a batalha do One Piece (motor padrão); o Dragon Ball Tales tem outra regra.
  const sistema = lido.ok && lido.sistema.motor === undefined ? lido.sistema : null
  SISTEMAS.set(sql, sistema)
  return sistema
}

/** A campanha publicou de novo: o sistema pode ter mudado. */
export function esquecerSistemaDoDuelo(sql: SqlStorage): void {
  SISTEMAS.delete(sql)
}

function motorDe(sistema: SistemaDeRpg): MotorDoDuelo {
  return { sistema, rolarD20: () => secureRollDie(D20) }
}

/** Os docs COMPLETOS das fichas (com o `dono`, achado Tr5), se todas são da conta, estão na mesa e não foram apagadas; senão `null`. */
function fichasDaConta(sql: SqlStorage, contaId: string, ids: readonly string[]): Personagem[] | null {
  const docs: Personagem[] = []
  for (const id of ids) {
    const ficha = lerFicha(sql, id)
    if (ficha === undefined || ficha.apagada || ficha.visivel !== 'mesa' || ficha.doc.dono !== contaId) return null
    docs.push(ficha.doc)
  }
  return docs
}

// ── Respostas e difusão ────────────────────────────────────────────────────

function recusar(ws: WebSocket, pedido: TipoDoPedidoDoDuelo | 'duelo', motivo: MotivoDoDueloRecusado, extra: { id?: string; tentarDepoisDe?: number } = {}): void {
  const resposta: MensagemDoDueloDoServidor = { t: 'duelo.recusado', pedido, motivo }
  if (extra.id !== undefined) resposta.id = extra.id
  if (extra.tentarDepoisDe !== undefined) resposta.tentarDepoisDe = extra.tentarDepoisDe
  enviar(ws, resposta)
}

export function recusarPedidoDoDuelo(ws: WebSocket, pedido: TipoDoPedidoDoDuelo | 'duelo', motivo: MotivoDoDueloRecusado, id?: string): void {
  recusar(ws, pedido, motivo, id === undefined ? {} : { id })
}

function idDoPedido(pedido: PedidoDoDuelo): { id?: string } {
  return pedido.t === 'duelo.convidar' ? {} : { id: pedido.id }
}

/** O pedido acima do ritmo: recusado com a hora de tentar de novo. */
export function recusarDueloPorRitmo(ws: WebSocket, pedido: PedidoDoDuelo, tentarDepoisDe: number): void {
  recusar(ws, pedido.t, 'ritmo', { ...idDoPedido(pedido), tentarDepoisDe })
}

/** Para os sockets prontos das duas contas. */
function difundirAsDuas(sala: SalaDoDuelo, contas: readonly string[], mensagem: MensagemDoDueloDoServidor): void {
  for (const { ws, contaId } of sala.ouvintes()) if (contas.includes(contaId)) enviar(ws, mensagem)
}

/** Cada conta do duelo recebe o do lado dela (o fio e a vista dela); a vista do outro nunca vai junto. */
function difundirEstado(sala: SalaDoDuelo, duelo: DueloGravado): void {
  const lados = dueloParaOsLados(duelo, sistemaDoDuelo(sala.sql))
  for (const { ws, contaId } of sala.ouvintes()) {
    const lado = ladoDaContaNoDuelo(duelo, contaId)
    if (lado !== null) enviar(ws, { t: 'duelo.estado', duelo: lados[lado] })
  }
}

/** O duelo do lado da conta (o fio e a vista dela); `null` = a conta não joga este duelo. */
function dueloDaConta(sql: SqlStorage, duelo: DueloGravado, contaId: string): DueloDoLado | null {
  const lado = ladoDaContaNoDuelo(duelo, contaId)
  return lado === null ? null : dueloParaOLado(duelo, lado, sistemaDoDuelo(sql))
}

/** Só para este socket: o estado de agora, do lado da conta (quem jogou sobre um estado velho, ou depois do fim). */
function enviarEstadoA(sql: SqlStorage, ws: WebSocket, duelo: DueloGravado, contaId: string): void {
  const doLado = dueloDaConta(sql, duelo, contaId)
  if (doLado !== null) enviar(ws, { t: 'duelo.estado', duelo: doLado })
}

function fecharConvite(sala: SalaDoDuelo, linha: LinhaDoDuelo, motivo: FimDoConvite): void {
  sala.transacao(() => apagarLinha(sala.sql, linha.id))
  difundirAsDuas(sala, [linha.jogadorA, linha.jogadorB], { t: 'duelo.fechado', id: linha.id, motivo })
}

function contaNoDuelo(sql: SqlStorage, contaId: string): { contaId: string; nome: string } {
  // Conta que saiu da campanha continua com o nome que tinha; sem linha nenhuma, o próprio contaId.
  return { contaId, nome: membroPorConta(sql, contaId)?.nome ?? contaId }
}

function conviteDaLinha(sql: SqlStorage, linha: LinhaDoDuelo): ConviteDoDuelo {
  const { fichasA, criadoEm } = conviteGuardado(linha)
  return { id: linha.id, de: contaNoDuelo(sql, linha.jogadorA), para: contaNoDuelo(sql, linha.jogadorB), fichasDe: fichasA, criadoEm, venceEm: linha.prazo ?? criadoEm + CONVITE_VALE_MS }
}

/** Grava com a cota do dia da conta e da campanha contada (§6.5); sem cota, nada é gravado. */
function gravarComCota(sala: SalaDoDuelo, contaId: string, bytes: number, agora: number, gravar: () => void): { ok: true } | { ok: false; tentarDepoisDe: number } {
  const { sql } = sala
  return sala.transacao(() => {
    const chaveDaConta = chaveDaCotaDaConta(contaId, agora)
    const chaveDaCampanha = chaveDaCotaDaCampanha(agora)
    const daConta = lerCota(sql, chaveDaConta)
    const daCampanha = lerCota(sql, chaveDaCampanha)
    const cabe = cabeNaCota(daConta, daCampanha, contaId, bytes, agora)
    if (!cabe.ok) return { ok: false, tentarDepoisDe: cabe.tentarDepoisDe }
    gravarCota(sql, chaveDaConta, comOpContada(daConta, bytes))
    gravarCota(sql, chaveDaCampanha, comOpContada(daCampanha, bytes))
    gravar()
    return { ok: true }
  })
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

export function atenderPedidoDoDuelo(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: PedidoDoDuelo, agora: number): void {
  semDuelosDeOutraVersao(sala.sql)
  switch (pedido.t) {
    case 'duelo.convidar':
      return convidar(sala, ws, eu, pedido, agora)
    case 'duelo.aceitar':
      return aceitar(sala, ws, eu, pedido, agora)
    case 'duelo.recusar':
      return recusarConvite(sala, ws, eu, pedido, agora)
    case 'duelo.jogar':
      return jogar(sala, ws, eu, pedido, agora)
    case 'duelo.desistir':
      return desistir(sala, ws, eu, pedido, agora)
  }
}

function convidar(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoDuelo, { t: 'duelo.convidar' }>, agora: number): void {
  const { sql } = sala
  if (sistemaDoDuelo(sql) === null) return recusar(ws, pedido.t, 'sistema')
  const outro = membroPorConta(sql, pedido.para)
  if (pedido.para === eu.contaId || !membroAtivo(outro)) return recusar(ws, pedido.t, 'nao-existe')
  if (fichasDaConta(sql, eu.contaId, pedido.fichas) === null) return recusar(ws, pedido.t, 'fichas')
  if (emAndamento(sql, eu.contaId) || emAndamento(sql, outro.contaId) || conviteEsperando(sql, eu.contaId, agora)) return recusar(ws, pedido.t, 'ocupado')
  const id = `duelo_${crypto.randomUUID()}`
  const guardado: ConviteGuardado = { fichasA: pedido.fichas, criadoEm: agora }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => {
    sql.exec(
      `INSERT INTO duelos (id, status, jogadorA, jogadorB, estadoJson, seq, versaoDoMotor, prazo, apagarEm, atualizadoEm) VALUES (?, 'convite', ?, ?, ?, 0, ?, ?, NULL, ?)`,
      id,
      eu.contaId,
      outro.contaId,
      JSON.stringify(guardado),
      VERSAO_DO_MOTOR_DO_DUELO,
      agora + CONVITE_VALE_MS,
      agora,
    )
  })
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { tentarDepoisDe: gravado.tentarDepoisDe })
  const linha = linhaPorId(sql, id)
  if (linha === undefined) throw new ErroDoBanco('convite gravado e não achado')
  difundirAsDuas(sala, [eu.contaId, outro.contaId], { t: 'duelo.convite', convite: conviteDaLinha(sql, linha) })
}

function aceitar(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoDuelo, { t: 'duelo.aceitar' }>, agora: number): void {
  const { sql } = sala
  const linha = linhaPorId(sql, pedido.id)
  if (linha === undefined || linha.status !== 'convite' || linha.jogadorB !== eu.contaId) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  if (linha.prazo !== null && linha.prazo <= agora) return fecharConvite(sala, linha, 'expirou')
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema', { id: pedido.id })
  const minhas = fichasDaConta(sql, eu.contaId, pedido.fichas)
  if (minhas === null) return recusar(ws, pedido.t, 'fichas', { id: pedido.id })
  if (emAndamento(sql, eu.contaId) || emAndamento(sql, linha.jogadorA)) return recusar(ws, pedido.t, 'ocupado', { id: pedido.id })
  const quemConvidou = membroPorConta(sql, linha.jogadorA)
  if (!membroAtivo(quemConvidou)) return fecharConvite(sala, linha, 'desistiu')
  // As fichas de quem convidou são relidas agora: apagada ou de outro dono desde o convite = o convite não serve mais.
  const deles = fichasDaConta(sql, linha.jogadorA, conviteGuardado(linha).fichasA)
  if (deles === null) return fecharConvite(sala, linha, 'fichas')
  const criado = criarDuelo({ id: linha.id, a: { contaId: quemConvidou.contaId, nome: quemConvidou.nome, fichas: deles }, b: { contaId: eu.contaId, nome: eu.nome, fichas: minhas } }, motorDe(sistema))
  if (!criado.ok) return criado.motivo !== 'mesmaConta' && criado.lado === 'a' ? fecharConvite(sala, linha, 'fichas') : recusar(ws, pedido.t, 'fichas', { id: pedido.id })
  // Quem convidou pode ter fechado tudo enquanto esperava: os 3 minutos dele começam já.
  const duelo = sala.contaConectada(linha.jogadorA, null) ? criado.duelo : marcarAusente(criado.duelo, linha.jogadorA, agora)
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarDuelo(sql, duelo, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  difundirEstado(sala, duelo)
}

function recusarConvite(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoDuelo, { t: 'duelo.recusar' }>, agora: number): void {
  const linha = linhaPorId(sala.sql, pedido.id)
  if (linha === undefined || linha.status !== 'convite' || (linha.jogadorA !== eu.contaId && linha.jogadorB !== eu.contaId)) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  const venceu = linha.prazo !== null && linha.prazo <= agora
  fecharConvite(sala, linha, venceu ? 'expirou' : linha.jogadorA === eu.contaId ? 'desistiu' : 'recusado')
}

function jogar(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoDuelo, { t: 'duelo.jogar' }>, agora: number): void {
  const { sql } = sala
  const linha = linhaPorId(sql, pedido.id)
  const duelo = linha === undefined ? null : dueloDaLinha(linha)
  if (linha === undefined || duelo === null || (linha.jogadorA !== eu.contaId && linha.jogadorB !== eu.contaId)) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  const sistema = sistemaDoDuelo(sql)
  if (sistema === null) return recusar(ws, pedido.t, 'sistema', { id: pedido.id })
  const feito = aplicarJogada(duelo, motorDe(sistema), eu.contaId, pedido.jogada)
  if (!feito.ok) {
    recusar(ws, pedido.t, feito.motivo, { id: pedido.id })
    // Jogada sobre estado velho (ou duelo já acabado): quem mandou recebe o de agora para jogar de novo.
    if (feito.motivo === 'seqVelho' || feito.motivo === 'acabou') enviarEstadoA(sql, ws, duelo, eu.contaId)
    return
  }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarDuelo(sql, feito.duelo, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
  difundirEstado(sala, feito.duelo)
}

/**
 * Quem está no duelo desiste e o outro vence: a saída de quem não quer esperar
 * o outro jogar (sem tempo por turno, 12.15), e o fim das duas contas
 * `ocupado`. Fora da cota do dia de propósito: acontece uma vez por duelo e a
 * cota cheia não pode prender ninguém num duelo (o ritmo de todo frame vale).
 */
function desistir(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoDuelo, { t: 'duelo.desistir' }>, agora: number): void {
  const { sql } = sala
  const linha = linhaPorId(sql, pedido.id)
  const duelo = linha === undefined ? null : dueloDaLinha(linha)
  if (linha === undefined || duelo === null || (linha.jogadorA !== eu.contaId && linha.jogadorB !== eu.contaId)) return recusar(ws, pedido.t, 'nao-existe', { id: pedido.id })
  const feito = desistirDoDuelo(duelo, eu.contaId)
  if (!feito.ok) {
    recusar(ws, pedido.t, feito.motivo, { id: pedido.id })
    // Já acabou (o outro desistiu antes, ou o alarme): quem mandou recebe o fim.
    if (feito.motivo === 'acabou') enviarEstadoA(sql, ws, duelo, eu.contaId)
    return
  }
  sala.transacao(() => gravarDuelo(sql, feito.duelo, linha, agora))
  difundirEstado(sala, feito.duelo)
}

// ── Entrar, sair e o relógio ───────────────────────────────────────────────

/**
 * Depois do `ola` (a conta tem socket): quem estava ausente volta (o relógio
 * dos 3 minutos para; passou do prazo e o alarme ainda não rodou = perde
 * agora, como o alarme faria). Depois, só para este socket, a lista: os
 * convites que ainda valem e os duelos dele.
 */
export function duelosNoOla(sala: SalaDoDuelo, ws: WebSocket, eu: Membro, agora: number): void {
  const { sql } = sala
  semDuelosDeOutraVersao(sql)
  const convites: ConviteDoDuelo[] = []
  const duelos: DueloDoLado[] = []
  for (const linha of linhasDaConta(sql, eu.contaId)) {
    if (linha.status === 'convite') {
      if (linha.prazo === null || linha.prazo > agora) convites.push(conviteDaLinha(sql, linha))
      continue
    }
    const duelo = dueloDaLinha(linha)
    if (duelo === null) continue
    const vencido = vencerAusencia(duelo, agora)
    const depois = vencido.fim === null ? marcarPresente(vencido, eu.contaId) : vencido
    if (depois !== duelo) {
      sala.transacao(() => gravarDuelo(sql, depois, linha, agora))
      difundirEstado(sala, depois)
    }
    // A linha é da conta (jogadorA ou jogadorB), então ela tem lado: o duelo vai do lado dela.
    const doLado = dueloDaConta(sql, depois, eu.contaId)
    if (doLado !== null) duelos.push(doLado)
  }
  enviar(ws, { t: 'duelo.lista', convites, duelos })
}

/**
 * A conta ficou sem nenhum socket (achado Tr9: por conta, não por socket):
 * cada duelo em andamento dela começa a contar os 3 minutos (12.15) e o outro
 * lado vê na hora. Devolve se algum prazo nasceu (quem chama reagenda o alarme).
 */
export function contaSaiuDosDuelos(sala: SalaDoDuelo, contaId: string, agora: number): boolean {
  const { sql } = sala
  semDuelosDeOutraVersao(sql)
  let nasceuPrazo = false
  for (const linha of linhasDaConta(sql, contaId)) {
    const duelo = linha.status === 'andamento' ? dueloDaLinha(linha) : null
    if (duelo === null) continue
    const ausente = marcarAusente(duelo, contaId, agora)
    if (ausente === duelo) continue
    sala.transacao(() => gravarDuelo(sql, ausente, linha, agora))
    difundirEstado(sala, ausente)
    nasceuPrazo = true
  }
  return nasceuPrazo
}

/**
 * O que venceu até `agora` (o `alarm()` do DO): convite sem resposta some
 * (`expirou`); quem passou dos 3 minutos perde (`vencerAusencia`); o duelo
 * acabado que já ficou o bastante é apagado. Linha vencida que este motor não
 * lê é apagada: nunca fica um prazo vencido para trás (o alarme tocaria em laço).
 */
export function vencerPrazosDosDuelos(sala: SalaDoDuelo, agora: number): void {
  const { sql } = sala
  semDuelosDeOutraVersao(sql)
  const vencidas = sql.exec('SELECT * FROM duelos WHERE prazo IS NOT NULL AND prazo <= ? ORDER BY id', agora).toArray().map(linhaDoDuelo)
  for (const linha of vencidas) {
    if (linha.status === 'convite') {
      fecharConvite(sala, linha, 'expirou')
      continue
    }
    const duelo = dueloDaLinha(linha)
    if (duelo === null) {
      sala.transacao(() => apagarLinha(sql, linha.id))
      continue
    }
    const depois = vencerAusencia(duelo, agora)
    // Gravado mesmo sem mudar: o `prazo` da linha volta a ser o do estado (nunca fica um vencido para trás).
    sala.transacao(() => gravarDuelo(sql, depois, linha, agora))
    if (depois !== duelo) difundirEstado(sala, depois)
  }
  sala.transacao(() => sql.exec('DELETE FROM duelos WHERE apagarEm IS NOT NULL AND apagarEm <= ?', agora))
}

/**
 * O menor `prazo` ou `apagarEm` da tabela: a próxima vez que o alarme precisa
 * acordar por causa dos duelos. `null` = nenhuma. O `prazo` de duelo de outra
 * versão do motor não conta (o convite conta sempre: ele não depende do motor).
 */
export function proximoPrazoDosDuelos(sql: SqlStorage): number | null {
  const consulta = `SELECT MIN(quando) AS n FROM (
    SELECT MIN(prazo) AS quando FROM duelos WHERE status = 'convite' OR versaoDoMotor = ?
    UNION ALL SELECT MIN(apagarEm) AS quando FROM duelos)`
  for (const linha of sql.exec(consulta, VERSAO_DO_MOTOR_DO_DUELO)) {
    return linha.n === null ? null : numero(linha, 'n')
  }
  return null
}
