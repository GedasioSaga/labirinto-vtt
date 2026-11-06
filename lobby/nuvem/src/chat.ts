import { gravarCota, lerCota, membroPorConta, todosOsMembros } from './banco'
import { ErroDoBanco, jsonDoTexto, numero, texto, type Linha } from './linhas'
import {
  bytesDoTexto,
  cabeNaCota,
  canalDoPar,
  chaveDaCotaDaCampanha,
  chaveDaCotaDaConta,
  CHAT_NAO_LIDAS_MAX,
  comOpContada,
  membroAtivo,
  mencoesDaSala,
  parDoPrivado,
  textoDoChat,
  type CanalDoChat,
  type Membro,
  type MensagemDoChat,
  type MensagemDoChatDoServidor,
  type MensagemNoCanal,
  type MotivoDoChatRecusado,
  type ParDoPrivado,
  type PedidoDoChat,
  type ResumoDoCanal,
  type TipoDoPedidoDoChat,
} from './nucleo'
import { enviar } from './sala'

/**
 * CHAT NO DO CAMPANHA (plano do Lobby §4.5 e §8.2, fatia C1), pela mesma
 * conexão WebSocket das fichas. O protocolo e as regras puras estão no núcleo
 * (`client/src/lib/nuvem/chatDoLobby.ts`); aqui ficam o SQLite e a difusão.
 *
 * - Sala e privado em TABELAS SEPARADAS (`chat_sala`, `chat_dm`): o privado
 *   fica fora do `exportar` e da cópia da sala no app (XS5).
 * - O privado é sempre lido e escrito pelo par montado com o contaId do
 *   socket: não há pedido que alcance o privado de outras duas contas.
 * - O privado também fica preso ao E-MAIL de cada lado de quando foi escrito
 *   (`emailA`, `emailB`): só aparece enquanto as duas contas têm esses mesmos
 *   e-mails. Quem liga conta a e-mail é o mestre; sem isto, trocar o e-mail
 *   da Nami pelo de uma segunda conta dele (ou reativar a conta removida com
 *   outro e-mail) abriria o privado Nami-Zoro. Com isto o privado recomeça
 *   vazio para os dois lados, e o antigo volta se o e-mail voltar (12.19).
 * - Apagar deixa lápide (a linha fica sem texto), com um `mudou` novo: quem
 *   volta pelo `chat.desde` e a cópia do app recebem a lápide.
 * - Ritmo (GCRA do `takeChatTurn`) em todo frame, antes de chegar aqui
 *   (campanha.ts); a mensagem nova também conta na cota do dia (§6.5:
 *   "teto diário de ops, bytes gravados" por conta), para o chat não gastar a
 *   cota de gravação do plano grátis.
 *
 * Duas colunas além da 4.5: `autorNome` (o nome de quando foi dita, como
 * `ops.autorNome`) e `mudou` (o cursor de mudança, um só para as duas tabelas).
 */

/** O `chat.desde` manda até isto de mudanças; mais atrás que isto, `recomecar`. */
const LIMITE_DO_DESDE_DO_CHAT = 500
/** Mensagens por `chat.mudancas` (cada uma bem abaixo do teto do socket). */
const PAGINA_DAS_MUDANCAS = 100
/** Página da rota da sala do app (`GET /chat/sala`). */
export const LIMITE_DA_ROTA_DA_SALA = 500

const COLUNAS_DA_SALA = 'id, autorContaId, autorNome, texto, mencoes, criadaEm, apagadaEm, mudou'
const COLUNAS_DO_PRIVADO = `id, autorContaId, autorNome, texto, '[]' AS mencoes, criadaEm, apagadaEm, mudou, contaA, contaB`

/** Um socket pronto (já mandou `ola`) e a conta dele. */
export interface Ouvinte {
  ws: WebSocket
  contaId: string
}

/** O que o chat precisa do DO: o SQLite, a transação e os sockets prontos. */
export interface SalaDoChat {
  sql: SqlStorage
  transacao<T>(passo: () => T): T
  ouvintes(): Ouvinte[]
}

/** Um privado: o par de contas e o e-mail de cada lado AGORA. A conversa é do par com esses dois e-mails. */
type Privado = { tipo: 'dm'; chave: string; emailA: string; emailB: string } & ParDoPrivado

type Destino = { tipo: 'sala'; chave: 'sala' } | Privado

const SALA: Destino = { tipo: 'sala', chave: 'sala' }

function destinoDoPrivado(eu: Membro, outro: Membro): Privado {
  const par = parDoPrivado(eu.contaId, outro.contaId)
  const [emailA, emailB] = par.a === eu.contaId ? [eu.email, outro.email] : [outro.email, eu.email]
  return { tipo: 'dm', chave: `dm:${par.par}`, ...par, emailA, emailB }
}

/** Filtro de toda leitura do privado: linha escrita quando um dos lados tinha outro e-mail não aparece. */
const DA_CONVERSA = 'par = ? AND emailA = ? AND emailB = ?'

function daConversa(privado: Privado): [string, string, string] {
  return [privado.par, privado.emailA, privado.emailB]
}

/**
 * O canal do pedido, montado com o contaId de quem pediu. `null` = privado
 * consigo mesmo ou com quem nunca foi membro; para escrever, o outro precisa
 * estar ativo (ler o que já foi dito com quem saiu continua possível).
 */
function destinoDoCanal(sql: SqlStorage, eu: Membro, canal: CanalDoChat, paraEscrever: boolean): Destino | null {
  if (canal === 'sala') return SALA
  if (canal.dm === eu.contaId) return null
  const outro = membroPorConta(sql, canal.dm)
  if (outro === undefined || (paraEscrever && !membroAtivo(outro))) return null
  return destinoDoPrivado(eu, outro)
}

function canalPara(destino: Destino, contaId: string): CanalDoChat {
  return destino.tipo === 'sala' ? 'sala' : canalDoPar(destino, contaId)
}

// ── Linhas ──────────────────────────────────────────────────────────────────

function mencoesDaLinha(linha: Linha): string[] {
  const valor = jsonDoTexto(texto(linha, 'mencoes'))
  if (!Array.isArray(valor)) throw new ErroDoBanco('mencoes fora do formato')
  return valor.map((contaId) => {
    if (typeof contaId !== 'string') throw new ErroDoBanco('mencoes fora do formato')
    return contaId
  })
}

function mensagemDaLinha(linha: Linha): MensagemDoChat {
  return {
    id: numero(linha, 'id'),
    autorContaId: texto(linha, 'autorContaId'),
    autorNome: texto(linha, 'autorNome'),
    texto: texto(linha, 'texto'),
    mencoes: mencoesDaLinha(linha),
    criadaEm: numero(linha, 'criadaEm'),
    apagadaEm: linha.apagadaEm === null ? null : numero(linha, 'apagadaEm'),
    mudou: numero(linha, 'mudou'),
  }
}

function primeiraMensagem(cursor: Iterable<Linha>): MensagemDoChat | undefined {
  for (const linha of cursor) return mensagemDaLinha(linha)
  return undefined
}

function numeroDaConsulta(sql: SqlStorage, consulta: string, ...valores: (string | number)[]): number {
  for (const linha of sql.exec(consulta, ...valores)) return linha.n === null ? 0 : numero(linha, 'n')
  return 0
}

/** O maior `mudou` das duas tabelas: o cursor do chat agora. */
export function cursorDoChat(sql: SqlStorage): number {
  return numeroDaConsulta(sql, 'SELECT MAX(m) AS n FROM (SELECT MAX(mudou) AS m FROM chat_sala UNION ALL SELECT MAX(mudou) AS m FROM chat_dm)')
}

function mensagemDoCliente(sql: SqlStorage, destino: Destino, autorContaId: string, idDoCliente: string): MensagemDoChat | undefined {
  if (destino.tipo === 'sala') {
    return primeiraMensagem(sql.exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala WHERE autorContaId = ? AND idDoCliente = ?`, autorContaId, idDoCliente))
  }
  // O mesmo idDoCliente num privado com OUTRA pessoa não é reenvio: a conversa entra na busca.
  return primeiraMensagem(
    sql.exec(`SELECT ${COLUNAS_DO_PRIVADO} FROM chat_dm WHERE autorContaId = ? AND idDoCliente = ? AND ${DA_CONVERSA}`, autorContaId, idDoCliente, ...daConversa(destino)),
  )
}

function mensagemPorId(sql: SqlStorage, destino: Destino, id: number): MensagemDoChat | undefined {
  if (destino.tipo === 'sala') return primeiraMensagem(sql.exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala WHERE id = ?`, id))
  return primeiraMensagem(sql.exec(`SELECT ${COLUNAS_DO_PRIVADO} FROM chat_dm WHERE id = ? AND ${DA_CONVERSA}`, id, ...daConversa(destino)))
}

function ultimaIdDo(sql: SqlStorage, destino: Destino): number {
  if (destino.tipo === 'sala') return numeroDaConsulta(sql, 'SELECT MAX(id) AS n FROM chat_sala')
  return numeroDaConsulta(sql, `SELECT MAX(id) AS n FROM chat_dm WHERE ${DA_CONVERSA}`, ...daConversa(destino))
}

function lidaAteDo(sql: SqlStorage, contaId: string, destino: Destino): number {
  return numeroDaConsulta(sql, 'SELECT ateId AS n FROM lidas WHERE contaId = ? AND canal = ?', contaId, destino.chave)
}

/** Lê no máximo `CHAT_NAO_LIDAS_MAX` linhas: a contagem não varre a sala inteira de quem nunca leu. */
function naoLidasDo(sql: SqlStorage, contaId: string, destino: Destino, lidaAte: number): number {
  if (destino.tipo === 'sala') {
    return numeroDaConsulta(
      sql,
      'SELECT COUNT(*) AS n FROM (SELECT 1 FROM chat_sala WHERE id > ? AND autorContaId <> ? AND apagadaEm IS NULL LIMIT ?)',
      lidaAte,
      contaId,
      CHAT_NAO_LIDAS_MAX,
    )
  }
  return numeroDaConsulta(
    sql,
    `SELECT COUNT(*) AS n FROM (SELECT 1 FROM chat_dm WHERE ${DA_CONVERSA} AND id > ? AND autorContaId <> ? AND apagadaEm IS NULL LIMIT ?)`,
    ...daConversa(destino),
    lidaAte,
    contaId,
    CHAT_NAO_LIDAS_MAX,
  )
}

/** A sala inteira, com as lápides, na ordem: o `exportar` do mestre (o privado nunca entra). */
export function salaInteira(sql: SqlStorage): MensagemDoChat[] {
  return sql.exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala ORDER BY id`).toArray().map(mensagemDaLinha)
}

/** A cópia da sala do app (§5.4, C3): mensagens e lápides com `mudou > desde`, na ordem do cursor. */
export function salaDesde(sql: SqlStorage, desde: number, limite: number): MensagemDoChat[] {
  return sql.exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala WHERE mudou > ? ORDER BY mudou LIMIT ?`, desde, limite).toArray().map(mensagemDaLinha)
}

// ── Respostas ───────────────────────────────────────────────────────────────

export function recusarPedidoDoChat(
  ws: WebSocket,
  pedido: TipoDoPedidoDoChat | 'chat',
  motivo: MotivoDoChatRecusado,
  extra: { idDoCliente?: string; tentarDepoisDe?: number } = {},
): void {
  const resposta: MensagemDoChatDoServidor = { t: 'chat.recusado', pedido, motivo }
  if (extra.idDoCliente !== undefined) resposta.idDoCliente = extra.idDoCliente
  if (extra.tentarDepoisDe !== undefined) resposta.tentarDepoisDe = extra.tentarDepoisDe
  enviar(ws, resposta)
}

function idDoClienteDe(pedido: PedidoDoChat): { idDoCliente?: string } {
  return pedido.t === 'chat.enviar' ? { idDoCliente: pedido.idDoCliente } : {}
}

/** O pedido acima do ritmo: recusado com a hora de tentar de novo (o site mostra "devagar"). */
export function recusarPorRitmo(ws: WebSocket, pedido: PedidoDoChat, tentarDepoisDe: number): void {
  recusarPedidoDoChat(ws, pedido.t, 'ritmo', { ...idDoClienteDe(pedido), tentarDepoisDe })
}

/** Para cada socket pronto do canal (no privado, só as duas contas do par), com o canal visto por quem recebe. */
function difundir(sala: SalaDoChat, destino: Destino, excluir: WebSocket | null, mensagem: (canal: CanalDoChat) => MensagemDoChatDoServidor): void {
  for (const { ws, contaId } of sala.ouvintes()) {
    if (ws === excluir) continue
    if (destino.tipo === 'dm' && contaId !== destino.a && contaId !== destino.b) continue
    enviar(ws, mensagem(canalPara(destino, contaId)))
  }
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

export function atenderPedidoDoChat(sala: SalaDoChat, ws: WebSocket, eu: Membro, pedido: PedidoDoChat, agora: number): void {
  switch (pedido.t) {
    case 'chat.enviar':
      return enviarMensagem(sala, ws, eu, pedido, agora)
    case 'chat.apagar':
      return apagarMensagem(sala, ws, eu, pedido, agora)
    case 'chat.antes':
      return listarAntes(sala.sql, ws, eu, pedido)
    case 'chat.desde':
      return enviarMudancas(sala.sql, ws, eu, pedido.cursor)
    case 'chat.lida':
      return marcarLida(sala, eu, pedido)
  }
}

type Gravada = { ok: true; msg: MensagemDoChat } | { ok: false; tentarDepoisDe: number }

function gravarMensagem(sala: SalaDoChat, destino: Destino, eu: Membro, texto: string, idDoCliente: string, agora: number): Gravada {
  const { sql } = sala
  const bytes = bytesDoTexto(texto)
  return sala.transacao((): Gravada => {
    const chaveDaConta = chaveDaCotaDaConta(eu.contaId, agora)
    const chaveDaCampanha = chaveDaCotaDaCampanha(agora)
    const daConta = lerCota(sql, chaveDaConta)
    const daCampanha = lerCota(sql, chaveDaCampanha)
    const cabe = cabeNaCota(daConta, daCampanha, eu.contaId, bytes, agora)
    if (!cabe.ok) return { ok: false, tentarDepoisDe: cabe.tentarDepoisDe }
    gravarCota(sql, chaveDaConta, comOpContada(daConta, bytes))
    gravarCota(sql, chaveDaCampanha, comOpContada(daCampanha, bytes))
    const mudou = cursorDoChat(sql) + 1
    if (destino.tipo === 'sala') {
      const membros = todosOsMembros(sql).filter(membroAtivo)
      sql.exec(
        'INSERT INTO chat_sala (autorContaId, autorNome, texto, mencoes, criadaEm, apagadaEm, idDoCliente, mudou) VALUES (?, ?, ?, ?, ?, NULL, ?, ?)',
        eu.contaId,
        eu.nome,
        texto,
        JSON.stringify(mencoesDaSala(texto, membros)),
        agora,
        idDoCliente,
        mudou,
      )
    } else {
      sql.exec(
        'INSERT INTO chat_dm (par, contaA, contaB, emailA, emailB, autorContaId, autorNome, texto, criadaEm, apagadaEm, idDoCliente, mudou) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)',
        destino.par,
        destino.a,
        destino.b,
        destino.emailA,
        destino.emailB,
        eu.contaId,
        eu.nome,
        texto,
        agora,
        idDoCliente,
        mudou,
      )
    }
    const msg = mensagemDoCliente(sql, destino, eu.contaId, idDoCliente)
    if (msg === undefined) throw new ErroDoBanco('mensagem gravada e não achada')
    return { ok: true, msg }
  })
}

function enviarMensagem(sala: SalaDoChat, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoChat, { t: 'chat.enviar' }>, agora: number): void {
  const { idDoCliente } = pedido
  const destino = destinoDoCanal(sala.sql, eu, pedido.canal, true)
  if (destino === null) return recusarPedidoDoChat(ws, pedido.t, 'canal', { idDoCliente })
  // Reenvio (a resposta se perdeu na queda): a mesma mensagem, nada gravado de novo nem difundido.
  const repetida = mensagemDoCliente(sala.sql, destino, eu.contaId, idDoCliente)
  if (repetida !== undefined) return enviar(ws, { t: 'chat.ok', idDoCliente, canal: pedido.canal, msg: repetida })
  const texto = textoDoChat(pedido.texto)
  if (texto === null) return recusarPedidoDoChat(ws, pedido.t, 'texto', { idDoCliente })
  const gravada = gravarMensagem(sala, destino, eu, texto, idDoCliente, agora)
  if (!gravada.ok) return recusarPedidoDoChat(ws, pedido.t, 'cota', { idDoCliente, tentarDepoisDe: gravada.tentarDepoisDe })
  const { msg } = gravada
  enviar(ws, { t: 'chat.ok', idDoCliente, canal: pedido.canal, msg })
  difundir(sala, destino, ws, (canal) => ({ t: 'chat.msg', canal, msg }))
}

/** Só quem disse apaga. A linha vira lápide (sem texto nem menções) com um `mudou` novo. */
function apagarMensagem(sala: SalaDoChat, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoChat, { t: 'chat.apagar' }>, agora: number): void {
  const { sql } = sala
  const destino = destinoDoCanal(sql, eu, pedido.canal, false)
  const msg = destino === null ? undefined : mensagemPorId(sql, destino, pedido.id)
  if (destino === null || msg === undefined) return recusarPedidoDoChat(ws, pedido.t, 'nao-existe')
  if (msg.autorContaId !== eu.contaId) return recusarPedidoDoChat(ws, pedido.t, 'sem-permissao')
  if (msg.apagadaEm !== null) {
    // Já é lápide: repete a confirmação só para quem pediu de novo.
    return enviar(ws, { t: 'chat.apagada', canal: pedido.canal, id: msg.id, apagadaEm: msg.apagadaEm, mudou: msg.mudou })
  }
  const mudou = sala.transacao(() => {
    const proximo = cursorDoChat(sql) + 1
    if (destino.tipo === 'sala') sql.exec(`UPDATE chat_sala SET texto = '', mencoes = '[]', apagadaEm = ?, mudou = ? WHERE id = ?`, agora, proximo, msg.id)
    else sql.exec(`UPDATE chat_dm SET texto = '', apagadaEm = ?, mudou = ? WHERE id = ?`, agora, proximo, msg.id)
    return proximo
  })
  difundir(sala, destino, null, (canal) => ({ t: 'chat.apagada', canal, id: msg.id, apagadaEm: agora, mudou }))
}

function listarAntes(sql: SqlStorage, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoChat, { t: 'chat.antes' }>): void {
  const destino = destinoDoCanal(sql, eu, pedido.canal, false)
  if (destino === null) return recusarPedidoDoChat(ws, pedido.t, 'canal')
  const antesDe = pedido.antesDeId === null ? Number.MAX_SAFE_INTEGER : pedido.antesDeId
  const lidas =
    destino.tipo === 'sala'
      ? sql.exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala WHERE id < ? ORDER BY id DESC LIMIT ?`, antesDe, pedido.limite + 1)
      : sql.exec(`SELECT ${COLUNAS_DO_PRIVADO} FROM chat_dm WHERE ${DA_CONVERSA} AND id < ? ORDER BY id DESC LIMIT ?`, ...daConversa(destino), antesDe, pedido.limite + 1)
  const lista = lidas.toArray().map(mensagemDaLinha)
  const temMaisAntigas = lista.length > pedido.limite
  enviar(ws, { t: 'chat.lista', canal: pedido.canal, lista: lista.slice(0, pedido.limite).reverse(), temMaisAntigas })
}

function resumoDoDestino(sql: SqlStorage, eu: Membro, destino: Destino): ResumoDoCanal {
  const lidaAte = lidaAteDo(sql, eu.contaId, destino)
  return { canal: canalPara(destino, eu.contaId), ultimaId: ultimaIdDo(sql, destino), lidaAte, naoLidas: naoLidasDo(sql, eu.contaId, destino, lidaAte) }
}

/** A sala sempre; cada privado de quem pediu que já tem mensagem (a conversa é montada com cada membro, um índice por par). */
function resumoDoChat(sql: SqlStorage, eu: Membro): Extract<MensagemDoChatDoServidor, { t: 'chat.resumo' }> {
  const canais = [resumoDoDestino(sql, eu, SALA)]
  for (const membro of todosOsMembros(sql)) {
    if (membro.contaId === eu.contaId) continue
    const destino = destinoDoPrivado(eu, membro)
    if (ultimaIdDo(sql, destino) > 0) canais.push(resumoDoDestino(sql, eu, destino))
  }
  return { t: 'chat.resumo', cursor: cursorDoChat(sql), canais }
}

/**
 * Mudanças visíveis a `eu` com `mudou > cursor`: a sala e só os privados do
 * par dele, cada um com os dois e-mails de agora (o `eu` vem de `membros`,
 * então o lado dele confere pela mesma tabela).
 */
function mudancasDesde(sql: SqlStorage, eu: Membro, cursor: number): MensagemNoCanal[] {
  const daSala = sql
    .exec(`SELECT ${COLUNAS_DA_SALA} FROM chat_sala WHERE mudou > ?`, cursor)
    .toArray()
    .map((linha): MensagemNoCanal => ({ canal: 'sala', msg: mensagemDaLinha(linha) }))
  const dosPrivados = sql
    .exec(
      `SELECT ${COLUNAS_DO_PRIVADO} FROM chat_dm WHERE mudou > ? AND (contaA = ? OR contaB = ?)
        AND emailA = (SELECT email FROM membros WHERE contaId = chat_dm.contaA)
        AND emailB = (SELECT email FROM membros WHERE contaId = chat_dm.contaB)`,
      cursor,
      eu.contaId,
      eu.contaId,
    )
    .toArray()
    .map((linha): MensagemNoCanal => {
      const par = parDoPrivado(texto(linha, 'contaA'), texto(linha, 'contaB'))
      return { canal: canalDoPar(par, eu.contaId), msg: mensagemDaLinha(linha) }
    })
  return [...daSala, ...dosPrivados].sort((x, y) => x.msg.mudou - y.msg.mudou)
}

/**
 * A volta depois da queda (achado Ch3): primeiro o resumo (não lidas e o
 * cursor de agora), depois o que mudou desde o cursor do cliente, em páginas.
 * Sem cursor, ou longe demais, `recomecar`: o cliente recarrega pelo `chat.antes`.
 */
function enviarMudancas(sql: SqlStorage, ws: WebSocket, eu: Membro, cursor: number | null): void {
  const resumo = resumoDoChat(sql, eu)
  enviar(ws, resumo)
  const atual = resumo.cursor
  if (cursor === null || cursor > atual || atual - cursor > LIMITE_DO_DESDE_DO_CHAT) {
    enviar(ws, { t: 'chat.mudancas', desde: cursor ?? 0, ate: atual, lista: [], recomecar: true })
    return
  }
  const lista = mudancasDesde(sql, eu, cursor)
  let desde = cursor
  let inicio = 0
  do {
    const pagina = lista.slice(inicio, inicio + PAGINA_DAS_MUDANCAS)
    inicio += PAGINA_DAS_MUDANCAS
    const ultima = pagina.at(-1)
    const ate = inicio >= lista.length || ultima === undefined ? atual : ultima.msg.mudou
    enviar(ws, { t: 'chat.mudancas', desde, ate, lista: pagina })
    desde = ate
  } while (inicio < lista.length)
}

/** Lida até `ateId` (nunca além da última do canal, nem para trás); as outras abas da mesma conta recebem o resumo novo. */
function marcarLida(sala: SalaDoChat, eu: Membro, pedido: Extract<PedidoDoChat, { t: 'chat.lida' }>): void {
  const { sql } = sala
  const destino = destinoDoCanal(sql, eu, pedido.canal, false)
  if (destino === null) return
  const ateId = Math.min(pedido.ateId, ultimaIdDo(sql, destino))
  if (ateId <= lidaAteDo(sql, eu.contaId, destino)) return
  sala.transacao(() => {
    sql.exec(
      'INSERT INTO lidas (contaId, canal, ateId) VALUES (?, ?, ?) ON CONFLICT (contaId, canal) DO UPDATE SET ateId = MAX(ateId, excluded.ateId)',
      eu.contaId,
      destino.chave,
      ateId,
    )
  })
  const resumo = resumoDoChat(sql, eu)
  for (const { ws, contaId } of sala.ouvintes()) if (contaId === eu.contaId) enviar(ws, resumo)
}
