import { CONTA_DO_MESTRE, type Cota, type FichaGuardada, type Gravacoes, type Json, type LeitorDaCampanha, type Membro, type OpGravada, type Recusada, type Visibilidade } from './nucleo'
import {
  cotaDaLinha,
  ErroDoBanco,
  fichaDaLinha,
  jsonDoTexto,
  jsonParaColuna,
  membroDaLinha,
  numero,
  opDaLinha,
  recusadaDaLinha,
  texto,
  visivelDe,
  type Linha,
} from './linhas'

/**
 * O SQLite do DO Campanha visto pelo núcleo (plano §4.5): o `LeitorDaCampanha`
 * que o `processarLote` lê e o `gravar` das `Gravacoes`, que o DO chama dentro
 * de um `transactionSync` só (o lote inteiro, com cada grupo atômico, entra ou
 * não entra). Tudo síncrono, como o núcleo espera.
 */

function primeira<T>(cursor: Iterable<Linha>, ler: (linha: Linha) => T): T | undefined {
  for (const linha of cursor) return ler(linha)
  return undefined
}

function existe(sql: SqlStorage, consulta: string, ...valores: (string | number)[]): boolean {
  return primeira(sql.exec(consulta, ...valores), () => true) === true
}

export function revAtual(sql: SqlStorage): number {
  return primeira(sql.exec('SELECT COALESCE(MAX(rev), 0) AS rev FROM ops'), (linha) => numero(linha, 'rev')) ?? 0
}

export function lerFicha(sql: SqlStorage, fichaId: string): FichaGuardada | undefined {
  return primeira(sql.exec('SELECT * FROM fichas WHERE id = ?', fichaId), fichaDaLinha)
}

/** Só a coluna `visivel` (a projeção da op precisa só dela; reler o doc custaria o leitor do disco inteiro). */
export function visivelDaFicha(sql: SqlStorage, fichaId: string): Visibilidade | undefined {
  return primeira(sql.exec('SELECT visivel FROM fichas WHERE id = ?', fichaId), (linha) => visivelDe(texto(linha, 'visivel')))
}

export function membroPorConta(sql: SqlStorage, contaId: string): Membro | undefined {
  return primeira(sql.exec('SELECT * FROM membros WHERE contaId = ?', contaId), membroDaLinha)
}

export function membroPorEmail(sql: SqlStorage, email: string): Membro | undefined {
  return primeira(sql.exec('SELECT * FROM membros WHERE email = ?', email), membroDaLinha)
}

export function todosOsMembros(sql: SqlStorage): Membro[] {
  return sql.exec('SELECT * FROM membros ORDER BY contaId').toArray().map(membroDaLinha)
}

export function todasAsFichas(sql: SqlStorage): FichaGuardada[] {
  return sql.exec('SELECT * FROM fichas ORDER BY id').toArray().map(fichaDaLinha)
}

export function todasAsRecusadas(sql: SqlStorage): Recusada[] {
  return sql.exec('SELECT * FROM recusadas ORDER BY quando, opId').toArray().map(recusadaDaLinha)
}

export function lerCota(sql: SqlStorage, chave: string): Cota | undefined {
  return primeira(sql.exec('SELECT * FROM cotas WHERE chave = ?', chave), cotaDaLinha)
}

/**
 * O leitor de uma passada do núcleo. A ficha lida fica guardada só durante a
 * passada (o doc é relido pelo leitor do disco, e o lote costuma mexer na
 * mesma ficha várias vezes); o DO cria um leitor novo a cada pedido.
 */
export function leitorDoBanco(sql: SqlStorage): LeitorDaCampanha {
  const fichas = new Map<string, FichaGuardada | undefined>()
  return {
    revAtual: () => revAtual(sql),
    ficha(fichaId) {
      if (!fichas.has(fichaId)) fichas.set(fichaId, lerFicha(sql, fichaId))
      return fichas.get(fichaId)
    },
    opGravada: (opId) => primeira(sql.exec('SELECT * FROM ops WHERE opId = ?', opId), opDaLinha),
    recusada: (opId) => primeira(sql.exec('SELECT * FROM recusadas WHERE opId = ?', opId), recusadaDaLinha),
    opsDaFicha: (fichaId, depoisDe) => sql.exec('SELECT * FROM ops WHERE fichaId = ? AND rev > ? ORDER BY rev', fichaId, depoisDe).toArray().map(opDaLinha),
    desfeitasDe: (opId) => sql.exec('SELECT * FROM ops WHERE desfaz = ? ORDER BY rev', opId).toArray().map(opDaLinha),
    membro: (contaId) => membroPorConta(sql, contaId),
    cota: (chave) => lerCota(sql, chave),
  }
}

// ── Gravar ──────────────────────────────────────────────────────────────────

function inserirOp(sql: SqlStorage, op: OpGravada): void {
  // `opId` é único entre `ops` e `recusadas` (o mesmo id nunca tem duas respostas); o UNIQUE de cada tabela não vê a outra.
  if (existe(sql, 'SELECT 1 FROM recusadas WHERE opId = ?', op.opId)) throw new ErroDoBanco(`opId já recusado: ${op.opId}`)
  sql.exec(
    `INSERT INTO ops (rev, opId, loteId, fichaId, caminho, acao, valor, delta, antes, baseRev, autorContaId, autorNome, origem,
      clienteId, atestadoPeloApp, quando, quandoCliente, desfaz, resolve, atomico, autorDeclarado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    op.rev,
    op.opId,
    op.loteId,
    op.fichaId,
    JSON.stringify(op.caminho),
    op.acao,
    jsonParaColuna(op.valor),
    op.delta ?? null,
    jsonParaColuna(op.antes),
    op.baseRev,
    op.autorContaId,
    op.autorNome,
    op.origem,
    op.clienteId,
    op.atestadoPeloApp ? 1 : 0,
    op.quando,
    op.quandoCliente,
    op.desfaz ?? null,
    op.resolve ?? null,
    op.atomico === true ? 1 : 0,
    op.autorDeclarado ?? null,
  )
}

export function gravarFicha(sql: SqlStorage, ficha: FichaGuardada): void {
  sql.exec(
    `INSERT INTO fichas (id, doc, visivel, dono, apagada, rev) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET doc = excluded.doc, visivel = excluded.visivel, dono = excluded.dono, apagada = excluded.apagada, rev = excluded.rev`,
    ficha.doc.id,
    JSON.stringify(ficha.doc),
    ficha.visivel,
    ficha.doc.dono ?? null,
    ficha.apagada ? 1 : 0,
    ficha.rev,
  )
}

function inserirRecusada(sql: SqlStorage, recusada: Recusada): void {
  if (existe(sql, 'SELECT 1 FROM ops WHERE opId = ?', recusada.opId)) throw new ErroDoBanco(`opId já gravado: ${recusada.opId}`)
  sql.exec(
    `INSERT INTO recusadas (opId, op, motivo, revAtual, quando, resposta, autorContaId) VALUES (?, ?, 'conflito', ?, ?, ?, ?)`,
    recusada.opId,
    JSON.stringify(recusada.op),
    recusada.resposta.revAtual,
    recusada.quando,
    JSON.stringify(recusada.resposta),
    recusada.autorContaId,
  )
}

/** `midiaBytes` não é do núcleo (é da mídia, W3): a atualização não mexe nele. */
export function gravarCota(sql: SqlStorage, chave: string, cota: Cota): void {
  sql.exec(
    `INSERT INTO cotas (chave, ops, bytes, negadas, paceAt) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (chave) DO UPDATE SET ops = excluded.ops, bytes = excluded.bytes, negadas = excluded.negadas, paceAt = excluded.paceAt`,
    chave,
    cota.ops,
    cota.bytes,
    cota.negadas,
    cota.paceAt ?? null,
  )
}

/** As gravações do núcleo, inteiras. Chamar SEMPRE dentro de `transactionSync`: o erro no meio desfaz tudo. */
export function gravar(sql: SqlStorage, gravacoes: Gravacoes): void {
  let esperada = revAtual(sql) + 1
  for (const op of gravacoes.ops) {
    if (op.rev !== esperada) throw new ErroDoBanco(`rev com buraco: ${op.rev}, esperava ${esperada}`)
    inserirOp(sql, op)
    esperada += 1
  }
  for (const ficha of gravacoes.fichas) gravarFicha(sql, ficha)
  for (const recusada of gravacoes.recusadas) inserirRecusada(sql, recusada)
  for (const { chave, cota } of gravacoes.cotas) gravarCota(sql, chave, cota)
}

// ── Consultas do log ────────────────────────────────────────────────────────

/** As ops com `rev > desde`, na ordem, no máximo `limite` (o `desde` do app e o `ola` do site). */
export function opsDesde(sql: SqlStorage, desde: number, limite: number): OpGravada[] {
  return sql.exec('SELECT * FROM ops WHERE rev > ? ORDER BY rev LIMIT ?', desde, limite).toArray().map(opDaLinha)
}

/** As ops de `deRev` a `ateRev` (as duas inclusive), no máximo `limite`: a página do `exportar`. */
export function opsEntre(sql: SqlStorage, deRev: number, ateRev: number, limite: number): OpGravada[] {
  return sql.exec('SELECT * FROM ops WHERE rev >= ? AND rev <= ? ORDER BY rev LIMIT ?', deRev, ateRev, limite).toArray().map(opDaLinha)
}

/** O histórico da ficha, da mais nova para a mais velha, abaixo de `antesDeRev`. */
export function historicoDaFicha(sql: SqlStorage, fichaId: string, antesDeRev: number, limite: number): OpGravada[] {
  return sql.exec('SELECT * FROM ops WHERE fichaId = ? AND rev < ? ORDER BY rev DESC LIMIT ?', fichaId, antesDeRev, limite).toArray().map(opDaLinha)
}

// ── Meta, membros e bloqueios ───────────────────────────────────────────────

/** Pedaço do sistema publicado em `meta` (§4.5: em pedaços se passar do teto da linha). Em caracteres: ≤ ~1,5 MB em UTF-8. */
const PEDACO_DO_SISTEMA = 500_000

export interface MetaDaCampanha {
  campanhaId: string
  nome: string
}

function lerValorDaMeta(sql: SqlStorage, chave: string): Json | undefined {
  return primeira(sql.exec('SELECT valor FROM meta WHERE chave = ?', chave), (linha) => jsonDoTexto(texto(linha, 'valor')))
}

function gravarValorDaMeta(sql: SqlStorage, chave: string, valor: Json): void {
  sql.exec('INSERT INTO meta (chave, valor) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET valor = excluded.valor', chave, JSON.stringify(valor))
}

/** `null` = a campanha ainda não foi publicada neste DO. */
export function lerMeta(sql: SqlStorage): MetaDaCampanha | null {
  const campanhaId = lerValorDaMeta(sql, 'campanhaId')
  const nome = lerValorDaMeta(sql, 'nome')
  if (typeof campanhaId !== 'string' || typeof nome !== 'string') return null
  return { campanhaId, nome }
}

export function gravarMeta(sql: SqlStorage, meta: MetaDaCampanha, sistema: Json): void {
  gravarValorDaMeta(sql, 'campanhaId', meta.campanhaId)
  gravarValorDaMeta(sql, 'nome', meta.nome)
  const textoDoSistema = JSON.stringify(sistema)
  sql.exec(`DELETE FROM meta WHERE chave LIKE 'sistema:%'`)
  const partes = Math.max(1, Math.ceil(textoDoSistema.length / PEDACO_DO_SISTEMA))
  for (let parte = 0; parte < partes; parte += 1) {
    gravarValorDaMeta(sql, `sistema:${parte}`, textoDoSistema.slice(parte * PEDACO_DO_SISTEMA, (parte + 1) * PEDACO_DO_SISTEMA))
  }
  gravarValorDaMeta(sql, 'sistemaPartes', partes)
}

export function lerSistema(sql: SqlStorage): Json | undefined {
  const partes = lerValorDaMeta(sql, 'sistemaPartes')
  if (typeof partes !== 'number') return undefined
  let textoDoSistema = ''
  for (let parte = 0; parte < partes; parte += 1) {
    const pedaco = lerValorDaMeta(sql, `sistema:${parte}`)
    if (typeof pedaco !== 'string') throw new ErroDoBanco(`pedaço ${parte} do sistema faltando`)
    textoDoSistema += pedaco
  }
  return jsonDoTexto(textoDoSistema)
}

export function gravarMembro(sql: SqlStorage, membro: Membro): void {
  sql.exec(
    `INSERT INTO membros (contaId, email, nome, papel, estado) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (contaId) DO UPDATE SET email = excluded.email, nome = excluded.nome, papel = excluded.papel, estado = excluded.estado`,
    membro.contaId,
    membro.email,
    membro.nome,
    membro.papel,
    membro.estado,
  )
}

export function emailDoMestre(sql: SqlStorage): string | undefined {
  return membroPorConta(sql, CONTA_DO_MESTRE)?.email
}

export function bloqueadaAte(sql: SqlStorage, contaId: string): number | undefined {
  return primeira(sql.exec('SELECT ate FROM bloqueios WHERE contaId = ?', contaId), (linha) => numero(linha, 'ate'))
}

export function bloquear(sql: SqlStorage, contaId: string, ate: number): void {
  sql.exec('INSERT INTO bloqueios (contaId, ate) VALUES (?, ?) ON CONFLICT (contaId) DO UPDATE SET ate = excluded.ate', contaId, ate)
}
