import { secureRollDie } from '../../../client/src/lib/dice'
import type { Personagem } from '../../../client/src/lib/personagem'
import { lerSistemaDeRpg, type SistemaDeRpg } from '../../../client/src/lib/sistemaDeRpg'
import {
  aplicarJogada,
  criarDuelo,
  dueloParaOFio,
  marcarAusente,
  marcarPresente,
  prazoDoDuelo,
  vencerAusencia,
  VERSAO_DO_MOTOR_DO_DUELO,
  type DueloGravado,
  type MotorDoDuelo,
} from '../../../client/src/lib/treino/duelo'
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
 *   aba aberta segura o duelo. Sem tempo limite por turno (12.15).
 * - O d20 é do `crypto` do servidor (`secureRollDie`), nunca do cliente.
 * - Só as duas contas do duelo recebem o estado, sempre pelo
 *   `dueloParaOFio` (fichas projetadas, cauda do registro).
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

/** O duelo da linha; `null` = convite, ou estado de outra versão do motor (não continua, não aparece). */
function dueloDaLinha(linha: LinhaDoDuelo): DueloGravado | null {
  if (linha.status === 'convite' || linha.versaoDoMotor !== VERSAO_DO_MOTOR_DO_DUELO) return null
  const valor = lerJsonSeguro(linha.estadoJson)
  if (!ehRegistro(valor) || proprio(valor, 'versao') !== VERSAO_DO_MOTOR_DO_DUELO || proprio(valor, 'id') !== linha.id) throw new ErroDoBanco('duelo gravado fora do formato')
  // Cast conferido só por fora: `estadoJson` de duelo só é escrito por `gravarDuelo` (JSON.stringify de um
  // DueloGravado, que vai a JSON e volta igual, `duelo.ts`), nunca por cliente; versão e id batem acima.
  return valor as unknown as DueloGravado
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

function emAndamento(sql: SqlStorage, contaId: string): boolean {
  return sql.exec(`SELECT 1 AS achou FROM duelos WHERE status = 'andamento' AND (jogadorA = ? OR jogadorB = ?) LIMIT 1`, contaId, contaId).toArray().length > 0
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

function difundirEstado(sala: SalaDoDuelo, duelo: DueloGravado): void {
  const contas = [duelo.jogadores.a.contaId, duelo.jogadores.b.contaId]
  difundirAsDuas(sala, contas, { t: 'duelo.estado', duelo: dueloParaOFio(duelo) })
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
  switch (pedido.t) {
    case 'duelo.convidar':
      return convidar(sala, ws, eu, pedido, agora)
    case 'duelo.aceitar':
      return aceitar(sala, ws, eu, pedido, agora)
    case 'duelo.recusar':
      return recusarConvite(sala, ws, eu, pedido, agora)
    case 'duelo.jogar':
      return jogar(sala, ws, eu, pedido, agora)
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
    if (feito.motivo === 'seqVelho' || feito.motivo === 'acabou') enviar(ws, { t: 'duelo.estado', duelo: dueloParaOFio(duelo) })
    return
  }
  const gravado = gravarComCota(sala, eu.contaId, bytesDoTexto(JSON.stringify(pedido)), agora, () => gravarDuelo(sql, feito.duelo, linha, agora))
  if (!gravado.ok) return recusar(ws, pedido.t, 'cota', { id: pedido.id, tentarDepoisDe: gravado.tentarDepoisDe })
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
  const convites: ConviteDoDuelo[] = []
  const duelos: DueloGravado[] = []
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
    duelos.push(depois)
  }
  enviar(ws, { t: 'duelo.lista', convites, duelos: duelos.map(dueloParaOFio) })
}

/**
 * A conta ficou sem nenhum socket (achado Tr9: por conta, não por socket):
 * cada duelo em andamento dela começa a contar os 3 minutos (12.15) e o outro
 * lado vê na hora. Devolve se algum prazo nasceu (quem chama reagenda o alarme).
 */
export function contaSaiuDosDuelos(sala: SalaDoDuelo, contaId: string, agora: number): boolean {
  const { sql } = sala
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
 * acabado que já ficou o bastante é apagado.
 */
export function vencerPrazosDosDuelos(sala: SalaDoDuelo, agora: number): void {
  const { sql } = sala
  const vencidas = sql.exec('SELECT * FROM duelos WHERE prazo IS NOT NULL AND prazo <= ? ORDER BY id', agora).toArray().map(linhaDoDuelo)
  for (const linha of vencidas) {
    if (linha.status === 'convite') {
      fecharConvite(sala, linha, 'expirou')
      continue
    }
    const duelo = dueloDaLinha(linha)
    if (duelo === null) continue
    const depois = vencerAusencia(duelo, agora)
    // Gravado mesmo sem mudar: o `prazo` da linha volta a ser o do estado (nunca fica um vencido para trás).
    sala.transacao(() => gravarDuelo(sql, depois, linha, agora))
    if (depois !== duelo) difundirEstado(sala, depois)
  }
  sala.transacao(() => sql.exec('DELETE FROM duelos WHERE apagarEm IS NOT NULL AND apagarEm <= ?', agora))
}

/** O menor `prazo` ou `apagarEm` da tabela: a próxima vez que o alarme precisa acordar por causa dos duelos. `null` = nenhuma. */
export function proximoPrazoDosDuelos(sql: SqlStorage): number | null {
  for (const linha of sql.exec('SELECT MIN(quando) AS n FROM (SELECT MIN(prazo) AS quando FROM duelos UNION ALL SELECT MIN(apagarEm) AS quando FROM duelos)')) {
    return linha.n === null ? null : numero(linha, 'n')
  }
  return null
}
