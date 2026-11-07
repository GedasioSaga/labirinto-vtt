import { gravarCota, lerCota, lerFicha, lerSistema, todosOsMembros } from './banco'
import type { Ouvinte } from './chat'
import { ErroDoBanco, jsonDoTexto, numero, opDaLinha, texto, textoOuNulo, type Linha } from './linhas'
import {
  bytesDoTexto,
  cabeNaCota,
  chaveDaCotaDaCampanha,
  chaveDaCotaDaConta,
  comOpContada,
  ehReacaoDoMural,
  fichaDaFrase,
  membroAtivo,
  mencoesDoMural,
  modificacaoDoMural,
  MURAL_PAGINA_DO_ESTADO,
  MURAL_REACOES,
  PEDIDOS_DO_MESTRE,
  projetarOpParaJogador,
  rotulosDoSistema,
  textoDoMural,
  type ContagemDaReacao,
  type FichaGuardada,
  type Membro,
  type MensagemDoMuralDoServidor,
  type ModificacaoDoMural,
  type MotivoDoMuralRecusado,
  type NoticiaDoMural,
  type OpGravada,
  type PedidoDoMural,
  type ReacaoDoMural,
  type RotulosDoSistema,
  type TipoDoPedidoDoMural,
} from './nucleo'
import { enviar } from './sala'

/**
 * MURAL NO DO CAMPANHA (plano do Lobby §8.2, fatia M1), pela mesma conexão
 * WebSocket das fichas e do chat. O protocolo e as frases puras estão no
 * núcleo (`client/src/lib/nuvem/muralDoLobby.ts`); aqui ficam o SQLite e a
 * difusão.
 *
 * - Permissão a cada mensagem (§6.4): só o mestre posta, edita, apaga e fixa;
 *   todo membro lê, reage e marca aviso como lido.
 * - Apagar deixa lápide (a linha fica sem texto nem imagem, desafixada);
 *   reações e lidos nunca são apagados.
 * - O aviso (notícia fixada) vai no `mural.estado` que o DO manda depois de
 *   cada `ola`; o lido é por conta e por VERSÃO (`mural_lidos.versao`).
 * - Modificações: as `ops` do log, filtradas no SQL pela visibilidade da
 *   ficha e passadas pelo `projetarOpParaJogador` antes de virar frase.
 * - Ritmo em todo frame (campanha.ts, antes de chegar aqui); postar, editar e
 *   reagir contam na cota do dia (§6.5), como a mensagem do chat.
 */

/** O que o mural usa do DO (a mesma forma da `SalaDoChat`): o SQLite, a transação e os sockets prontos. */
export interface SalaDoMural {
  sql: SqlStorage
  transacao<T>(passo: () => T): T
  ouvintes(): Ouvinte[]
}

const COLUNAS = 'id, autorContaId, autorNome, texto, imagem, mencoes, fixada, versao, criadaEm, editadaEm, apagadaEm'
const PREFIXO_DA_MIDIA = 'midia:'

/** A linha de `mural_noticias`, sem nada de quem lê. */
export interface NoticiaGuardada {
  id: number
  autorContaId: string
  autorNome: string
  texto: string
  imagem: string | null
  mencoes: string[]
  fixada: boolean
  versao: number
  criadaEm: number
  editadaEm: number | null
  apagadaEm: number | null
}

// ── Linhas ──────────────────────────────────────────────────────────────────

function numeroOuNulo(linha: Linha, coluna: string): number | null {
  return linha[coluna] === null ? null : numero(linha, coluna)
}

function mencoesDaLinha(linha: Linha): string[] {
  const valor = jsonDoTexto(texto(linha, 'mencoes'))
  if (!Array.isArray(valor)) throw new ErroDoBanco('mencoes do mural fora do formato')
  return valor.map((contaId) => {
    if (typeof contaId !== 'string') throw new ErroDoBanco('mencoes do mural fora do formato')
    return contaId
  })
}

function noticiaDaLinha(linha: Linha): NoticiaGuardada {
  return {
    id: numero(linha, 'id'),
    autorContaId: texto(linha, 'autorContaId'),
    autorNome: texto(linha, 'autorNome'),
    texto: texto(linha, 'texto'),
    imagem: textoOuNulo(linha, 'imagem'),
    mencoes: mencoesDaLinha(linha),
    fixada: numero(linha, 'fixada') !== 0,
    versao: numero(linha, 'versao'),
    criadaEm: numero(linha, 'criadaEm'),
    editadaEm: numeroOuNulo(linha, 'editadaEm'),
    apagadaEm: numeroOuNulo(linha, 'apagadaEm'),
  }
}

function primeiraNoticia(cursor: Iterable<Linha>): NoticiaGuardada | undefined {
  for (const linha of cursor) return noticiaDaLinha(linha)
  return undefined
}

function noticiaPorId(sql: SqlStorage, id: number): NoticiaGuardada | undefined {
  return primeiraNoticia(sql.exec(`SELECT ${COLUNAS} FROM mural_noticias WHERE id = ?`, id))
}

function noticiaDoCliente(sql: SqlStorage, autorContaId: string, idDoCliente: string): NoticiaGuardada | undefined {
  return primeiraNoticia(sql.exec(`SELECT ${COLUNAS} FROM mural_noticias WHERE autorContaId = ? AND idDoCliente = ?`, autorContaId, idDoCliente))
}

/** A `midia:` da notícia precisa já estar guardada nesta campanha (W3), com o mesmo tipo. */
function imagemGuardada(sql: SqlStorage, imagem: string | null): boolean {
  if (imagem === null) return true
  const id = imagem.slice(PREFIXO_DA_MIDIA.length)
  const ponto = id.indexOf('.')
  if (!imagem.startsWith(PREFIXO_DA_MIDIA) || ponto < 0) return false
  return sql.exec('SELECT 1 AS achou FROM midia_meta WHERE hash = ? AND tipo = ?', id.slice(0, ponto), id.slice(ponto + 1)).toArray().length > 0
}

// ── A notícia vista por quem recebe ─────────────────────────────────────────

function reacoesDa(sql: SqlStorage, noticia: NoticiaGuardada): ContagemDaReacao[] {
  if (noticia.apagadaEm !== null) return []
  const totais = new Map<string, number>()
  for (const linha of sql.exec('SELECT reacao, COUNT(*) AS n FROM mural_reacoes WHERE noticiaId = ? GROUP BY reacao', noticia.id)) {
    totais.set(texto(linha, 'reacao'), numero(linha, 'n'))
  }
  return MURAL_REACOES.flatMap((reacao) => {
    // Ausente do mapa = ninguém reagiu com ela.
    const total = totais.get(reacao) ?? 0
    return total > 0 ? [{ reacao, total }] : []
  })
}

function reacaoDaConta(sql: SqlStorage, noticiaId: number, contaId: string): ReacaoDoMural | null {
  for (const linha of sql.exec('SELECT reacao FROM mural_reacoes WHERE noticiaId = ? AND contaId = ?', noticiaId, contaId)) {
    const reacao = texto(linha, 'reacao')
    return ehReacaoDoMural(reacao) ? reacao : null
  }
  return null
}

function versaoLida(sql: SqlStorage, contaId: string, noticiaId: number): number {
  for (const linha of sql.exec('SELECT versao FROM mural_lidos WHERE contaId = ? AND noticiaId = ?', contaId, noticiaId)) return numero(linha, 'versao')
  return 0
}

function vistaPor(sql: SqlStorage, noticia: NoticiaGuardada, reacoes: ContagemDaReacao[], contaId: string): NoticiaDoMural {
  const dePe = noticia.apagadaEm === null
  return {
    ...noticia,
    reacoes,
    minhaReacao: dePe ? reacaoDaConta(sql, noticia.id, contaId) : null,
    lida: versaoLida(sql, contaId, noticia.id) >= noticia.versao,
  }
}

function vistasPor(sql: SqlStorage, noticias: readonly NoticiaGuardada[], contaId: string): NoticiaDoMural[] {
  return noticias.map((noticia) => vistaPor(sql, noticia, reacoesDa(sql, noticia), contaId))
}

/** Para cada socket pronto (ou só os da conta `soDaConta`), a notícia vista por quem recebe. */
function difundir(sala: SalaDoMural, noticia: NoticiaGuardada, soDaConta: string | null = null): void {
  const reacoes = reacoesDa(sala.sql, noticia)
  for (const { ws, contaId } of sala.ouvintes()) {
    if (soDaConta !== null && contaId !== soDaConta) continue
    enviar(ws, { t: 'mural.noticia', noticia: vistaPor(sala.sql, noticia, reacoes, contaId) })
  }
}

function responderComANoticia(sala: SalaDoMural, ws: WebSocket, noticia: NoticiaGuardada, contaId: string): void {
  enviar(ws, { t: 'mural.noticia', noticia: vistaPor(sala.sql, noticia, reacoesDa(sala.sql, noticia), contaId) })
}

// ── Respostas ───────────────────────────────────────────────────────────────

export function recusarPedidoDoMural(
  ws: WebSocket,
  pedido: TipoDoPedidoDoMural | 'mural',
  motivo: MotivoDoMuralRecusado,
  extra: { idDoCliente?: string; tentarDepoisDe?: number } = {},
): void {
  const resposta: MensagemDoMuralDoServidor = { t: 'mural.recusado', pedido, motivo }
  if (extra.idDoCliente !== undefined) resposta.idDoCliente = extra.idDoCliente
  if (extra.tentarDepoisDe !== undefined) resposta.tentarDepoisDe = extra.tentarDepoisDe
  enviar(ws, resposta)
}

function idDoClienteDe(pedido: PedidoDoMural): { idDoCliente?: string } {
  return pedido.t === 'mural.postar' ? { idDoCliente: pedido.idDoCliente } : {}
}

/** O pedido acima do ritmo: recusado com a hora de tentar de novo. */
export function recusarMuralPorRitmo(ws: WebSocket, pedido: PedidoDoMural, tentarDepoisDe: number): void {
  recusarPedidoDoMural(ws, pedido.t, 'ritmo', { ...idDoClienteDe(pedido), tentarDepoisDe })
}

// ── Estado de quem entra ────────────────────────────────────────────────────

/**
 * O `mural.estado` como `contaId` o vê: todas as fixadas (os avisos, com o
 * `lida` e a reação dele) e a primeira página. Só lê: o `verComo` do mestre
 * usa o mesmo para mostrar o mural do jogador sem marcar nada como lido.
 */
export function estadoDoMuralPara(sql: SqlStorage, contaId: string): Extract<MensagemDoMuralDoServidor, { t: 'mural.estado' }> {
  const fixadas = sql.exec(`SELECT ${COLUNAS} FROM mural_noticias WHERE fixada = 1 AND apagadaEm IS NULL ORDER BY id DESC`).toArray().map(noticiaDaLinha)
  const pagina = sql.exec(`SELECT ${COLUNAS} FROM mural_noticias ORDER BY id DESC LIMIT ?`, MURAL_PAGINA_DO_ESTADO + 1).toArray().map(noticiaDaLinha)
  return {
    t: 'mural.estado',
    fixadas: vistasPor(sql, fixadas, contaId),
    noticias: vistasPor(sql, pagina.slice(0, MURAL_PAGINA_DO_ESTADO), contaId),
    temMaisAntigas: pagina.length > MURAL_PAGINA_DO_ESTADO,
  }
}

/** Depois do `ola`: todas as fixadas (os avisos, com o `lida` de quem entra) e a primeira página. */
export function enviarEstadoDoMural(sql: SqlStorage, ws: WebSocket, contaId: string): void {
  enviar(ws, estadoDoMuralPara(sql, contaId))
}

// ── Pedidos ─────────────────────────────────────────────────────────────────

export function atenderPedidoDoMural(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: PedidoDoMural, agora: number): void {
  // §6.4: conferido a cada mensagem, pelo papel lido de `membros` agora.
  if (PEDIDOS_DO_MESTRE.has(pedido.t) && eu.papel !== 'mestre') return recusarPedidoDoMural(ws, pedido.t, 'sem-permissao', idDoClienteDe(pedido))
  switch (pedido.t) {
    case 'mural.postar':
      return postar(sala, ws, eu, pedido, agora)
    case 'mural.editar':
      return editar(sala, ws, eu, pedido, agora)
    case 'mural.apagar':
      return apagar(sala, ws, eu, pedido, agora)
    case 'mural.fixar':
      return fixar(sala, ws, eu, pedido)
    case 'mural.reagir':
      return reagir(sala, ws, eu, pedido, agora)
    case 'mural.lido':
      return marcarLido(sala, ws, eu, pedido, agora)
    case 'mural.antes':
      return listarAntes(sala.sql, ws, eu, pedido)
    case 'mural.modificacoes':
      return listarModificacoes(sala.sql, ws, eu, pedido)
  }
}

type NaCota = { ok: true } | { ok: false; tentarDepoisDe: number }

/** Dentro da transação: cabe mais uma gravação de `bytes` hoje? Se cabe, já conta (conta e campanha, §6.5). */
function contarNaCota(sql: SqlStorage, contaId: string, bytes: number, agora: number): NaCota {
  const chaveDaConta = chaveDaCotaDaConta(contaId, agora)
  const chaveDaCampanha = chaveDaCotaDaCampanha(agora)
  const daConta = lerCota(sql, chaveDaConta)
  const daCampanha = lerCota(sql, chaveDaCampanha)
  const cabe = cabeNaCota(daConta, daCampanha, contaId, bytes, agora)
  if (!cabe.ok) return { ok: false, tentarDepoisDe: cabe.tentarDepoisDe }
  gravarCota(sql, chaveDaConta, comOpContada(daConta, bytes))
  gravarCota(sql, chaveDaCampanha, comOpContada(daCampanha, bytes))
  return { ok: true }
}

function mencoesEmJson(sql: SqlStorage, texto: string): string {
  return JSON.stringify(mencoesDoMural(texto, todosOsMembros(sql).filter(membroAtivo)))
}

type Conteudo = { ok: true; texto: string; imagem: string | null } | { ok: false; motivo: 'texto' | 'imagem' }

function conteudoDo(sql: SqlStorage, pedido: { texto: string; imagem: string | null }): Conteudo {
  const texto = textoDoMural(pedido.texto)
  if (texto === null) return { ok: false, motivo: 'texto' }
  return imagemGuardada(sql, pedido.imagem) ? { ok: true, texto, imagem: pedido.imagem } : { ok: false, motivo: 'imagem' }
}

type Gravada = { ok: true; noticia: NoticiaGuardada } | { ok: false; tentarDepoisDe: number }

function postar(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.postar' }>, agora: number): void {
  const { sql } = sala
  const { idDoCliente } = pedido
  // Reenvio (a resposta se perdeu na queda): a mesma notícia, nada gravado de novo nem difundido.
  const repetida = noticiaDoCliente(sql, eu.contaId, idDoCliente)
  if (repetida !== undefined) return enviar(ws, { t: 'mural.ok', idDoCliente, noticia: vistaPor(sql, repetida, reacoesDa(sql, repetida), eu.contaId) })
  const conteudo = conteudoDo(sql, pedido)
  if (!conteudo.ok) return recusarPedidoDoMural(ws, pedido.t, conteudo.motivo, { idDoCliente })
  const gravada = sala.transacao((): Gravada => {
    const cota = contarNaCota(sql, eu.contaId, bytesDoTexto(conteudo.texto), agora)
    if (!cota.ok) return cota
    sql.exec(
      `INSERT INTO mural_noticias (autorContaId, autorNome, texto, imagem, mencoes, fixada, versao, criadaEm, editadaEm, apagadaEm, idDoCliente)
       VALUES (?, ?, ?, ?, ?, 0, 1, ?, NULL, NULL, ?)`,
      eu.contaId,
      eu.nome,
      conteudo.texto,
      conteudo.imagem,
      mencoesEmJson(sql, conteudo.texto),
      agora,
      idDoCliente,
    )
    const noticia = noticiaDoCliente(sql, eu.contaId, idDoCliente)
    if (noticia === undefined) throw new ErroDoBanco('notícia gravada e não achada')
    return { ok: true, noticia }
  })
  if (!gravada.ok) return recusarPedidoDoMural(ws, pedido.t, 'cota', { idDoCliente, tentarDepoisDe: gravada.tentarDepoisDe })
  const { noticia } = gravada
  enviar(ws, { t: 'mural.ok', idDoCliente, noticia: vistaPor(sql, noticia, [], eu.contaId) })
  for (const ouvinte of sala.ouvintes()) {
    if (ouvinte.ws !== ws) enviar(ouvinte.ws, { t: 'mural.noticia', noticia: vistaPor(sql, noticia, [], ouvinte.contaId) })
  }
}

/** A notícia de pé que o pedido aponta; senão a recusa já foi mandada e volta `undefined`. */
function dePe(sql: SqlStorage, ws: WebSocket, pedido: { t: TipoDoPedidoDoMural; id: number }): NoticiaGuardada | undefined {
  const noticia = noticiaPorId(sql, pedido.id)
  if (noticia === undefined) recusarPedidoDoMural(ws, pedido.t, 'nao-existe')
  else if (noticia.apagadaEm !== null) recusarPedidoDoMural(ws, pedido.t, 'apagada')
  else return noticia
  return undefined
}

/** Texto e imagem novos; a versão sobe (o aviso editado volta a aparecer para quem já tinha lido). */
function editar(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.editar' }>, agora: number): void {
  const { sql } = sala
  const atual = dePe(sql, ws, pedido)
  if (atual === undefined) return
  const conteudo = conteudoDo(sql, pedido)
  if (!conteudo.ok) return recusarPedidoDoMural(ws, pedido.t, conteudo.motivo)
  const gravada = sala.transacao((): NaCota => {
    const cota = contarNaCota(sql, eu.contaId, bytesDoTexto(conteudo.texto), agora)
    if (!cota.ok) return cota
    sql.exec(
      'UPDATE mural_noticias SET texto = ?, imagem = ?, mencoes = ?, versao = versao + 1, editadaEm = ? WHERE id = ?',
      conteudo.texto,
      conteudo.imagem,
      mencoesEmJson(sql, conteudo.texto),
      agora,
      atual.id,
    )
    return cota
  })
  if (!gravada.ok) return recusarPedidoDoMural(ws, pedido.t, 'cota', { tentarDepoisDe: gravada.tentarDepoisDe })
  const editada = noticiaPorId(sql, atual.id)
  if (editada !== undefined) difundir(sala, editada)
}

/** Vira lápide (sem texto, sem imagem, desafixada). Já lápide: repete só para quem pediu. */
function apagar(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.apagar' }>, agora: number): void {
  const { sql } = sala
  const atual = noticiaPorId(sql, pedido.id)
  if (atual === undefined) return recusarPedidoDoMural(ws, pedido.t, 'nao-existe')
  if (atual.apagadaEm !== null) return responderComANoticia(sala, ws, atual, eu.contaId)
  sala.transacao(() => {
    sql.exec(`UPDATE mural_noticias SET texto = '', imagem = NULL, mencoes = '[]', fixada = 0, apagadaEm = ? WHERE id = ?`, agora, atual.id)
  })
  const lapide = noticiaPorId(sql, atual.id)
  if (lapide !== undefined) difundir(sala, lapide)
}

/** Fixar sobe a versão (o aviso volta para quem já tinha lido); desafixar não. Sem mudança: repete só para quem pediu. */
function fixar(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.fixar' }>): void {
  const { sql } = sala
  const atual = dePe(sql, ws, pedido)
  if (atual === undefined) return
  if (atual.fixada === pedido.fixada) return responderComANoticia(sala, ws, atual, eu.contaId)
  sala.transacao(() => {
    sql.exec('UPDATE mural_noticias SET fixada = ?, versao = versao + ? WHERE id = ?', pedido.fixada ? 1 : 0, pedido.fixada ? 1 : 0, atual.id)
  })
  const mudada = noticiaPorId(sql, atual.id)
  if (mudada !== undefined) difundir(sala, mudada)
}

/** Uma reação por pessoa e notícia; `null` tira. A mesma de antes: repete só para quem pediu. */
function reagir(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.reagir' }>, agora: number): void {
  const { sql } = sala
  const atual = dePe(sql, ws, pedido)
  if (atual === undefined) return
  if (reacaoDaConta(sql, atual.id, eu.contaId) === pedido.reacao) return responderComANoticia(sala, ws, atual, eu.contaId)
  const { reacao } = pedido
  const gravada = sala.transacao((): NaCota => {
    const cota = contarNaCota(sql, eu.contaId, reacao === null ? 0 : bytesDoTexto(reacao), agora)
    if (!cota.ok) return cota
    if (reacao === null) sql.exec('DELETE FROM mural_reacoes WHERE noticiaId = ? AND contaId = ?', atual.id, eu.contaId)
    else {
      sql.exec(
        'INSERT INTO mural_reacoes (noticiaId, contaId, reacao, quando) VALUES (?, ?, ?, ?) ON CONFLICT (noticiaId, contaId) DO UPDATE SET reacao = excluded.reacao, quando = excluded.quando',
        atual.id,
        eu.contaId,
        reacao,
        agora,
      )
    }
    return cota
  })
  if (!gravada.ok) return recusarPedidoDoMural(ws, pedido.t, 'cota', { tentarDepoisDe: gravada.tentarDepoisDe })
  difundir(sala, atual)
}

/**
 * O aviso lido até a versão que quem pediu viu (nunca além da atual, nunca
 * para trás). Só notícia fixada: o lido é do aviso. As outras abas da mesma
 * conta recebem a notícia com `lida` nova.
 */
function marcarLido(sala: SalaDoMural, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.lido' }>, agora: number): void {
  const { sql } = sala
  const atual = dePe(sql, ws, pedido)
  if (atual === undefined || !atual.fixada) return
  const versao = Math.min(pedido.versao, atual.versao)
  if (versao <= versaoLida(sql, eu.contaId, atual.id)) return responderComANoticia(sala, ws, atual, eu.contaId)
  sala.transacao(() => {
    sql.exec(
      'INSERT INTO mural_lidos (contaId, noticiaId, versao, quando) VALUES (?, ?, ?, ?) ON CONFLICT (contaId, noticiaId) DO UPDATE SET versao = MAX(versao, excluded.versao), quando = excluded.quando',
      eu.contaId,
      atual.id,
      versao,
      agora,
    )
  })
  difundir(sala, atual, eu.contaId)
}

/** Da mais nova para a mais velha, abaixo de `antesDeId` (lápides incluídas: o site mostra "apagada"). */
function listarAntes(sql: SqlStorage, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.antes' }>): void {
  const antesDe = pedido.antesDeId === null ? Number.MAX_SAFE_INTEGER : pedido.antesDeId
  const lidas = sql.exec(`SELECT ${COLUNAS} FROM mural_noticias WHERE id < ? ORDER BY id DESC LIMIT ?`, antesDe, pedido.limite + 1).toArray().map(noticiaDaLinha)
  enviar(ws, { t: 'mural.lista', noticias: vistasPor(sql, lidas.slice(0, pedido.limite), eu.contaId), temMaisAntigas: lidas.length > pedido.limite })
}

// ── Modificações ────────────────────────────────────────────────────────────

/** Os nomes do sistema, lidos uma vez por DO acordado (o sistema publicado pode passar de 1 MB com o livro). */
const ROTULOS = new WeakMap<SqlStorage, RotulosDoSistema>()

function rotulosDaCampanha(sql: SqlStorage): RotulosDoSistema {
  const guardados = ROTULOS.get(sql)
  if (guardados !== undefined) return guardados
  const lidos = rotulosDoSistema(lerSistema(sql))
  ROTULOS.set(sql, lidos)
  return lidos
}

/** Publicar de novo pode trazer outro sistema: o próximo feed relê os nomes. */
export function esquecerRotulosDoMural(sql: SqlStorage): void {
  ROTULOS.delete(sql)
}

/**
 * As ops abaixo de `antesDeRev`, da mais nova para a mais velha, com os
 * filtros. Para o jogador o SQL já deixa de fora a ficha fora da mesa; o
 * `projetarOpParaJogador` depois tira o campo do mestre (segunda parede).
 * Só fragmentos fixos entram no texto do SQL; os valores vão como parâmetro.
 */
function opsDoFeed(sql: SqlStorage, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.modificacoes' }>): OpGravada[] {
  const condicoes = ['rev < ?']
  const valores: (string | number)[] = [pedido.antesDeRev ?? Number.MAX_SAFE_INTEGER]
  if (pedido.fichaId !== null) {
    condicoes.push('fichaId = ?')
    valores.push(pedido.fichaId)
  }
  if (pedido.autorContaId !== null) {
    condicoes.push('autorContaId = ?')
    valores.push(pedido.autorContaId)
  }
  if (eu.papel !== 'mestre') condicoes.push(`fichaId IN (SELECT id FROM fichas WHERE visivel = 'mesa')`)
  const consulta = `SELECT * FROM ops WHERE ${condicoes.join(' AND ')} ORDER BY rev DESC LIMIT ?`
  return sql.exec(consulta, ...valores, pedido.limite + 1).toArray().map(opDaLinha)
}

/**
 * A op como entra no feed de quem lê; `null` = não entra. Para o jogador: a
 * projeção da §6.4 e, além dela, nada de ficha de NPC (pedido do usuário: o
 * feed nunca mostra NPC). Hoje o NPC não sobe porque o emissor do app filtra
 * (§5.1), mas o servidor aceita um `criar` de ficha `tipo:'npc'` e o põe na
 * mesa; o feed não depende disso.
 */
function vistaNoFeed(eu: Membro, op: OpGravada, ficha: FichaGuardada): OpGravada | null {
  if (eu.papel === 'mestre') return op
  if (ficha.doc.tipo !== 'jogador') return null
  return projetarOpParaJogador(op, ficha.visivel)
}

function listarModificacoes(sql: SqlStorage, ws: WebSocket, eu: Membro, pedido: Extract<PedidoDoMural, { t: 'mural.modificacoes' }>): void {
  const lidas = opsDoFeed(sql, eu, pedido)
  const pagina = lidas.slice(0, pedido.limite)
  const rotulos = rotulosDaCampanha(sql)
  const fichas = new Map<string, FichaGuardada | undefined>()
  const lista = pagina.flatMap((op): ModificacaoDoMural[] => {
    if (!fichas.has(op.fichaId)) fichas.set(op.fichaId, lerFicha(sql, op.fichaId))
    const ficha = fichas.get(op.fichaId)
    // Op sem linha de ficha (nunca criou nada): fica de fora, como no `projetarOps` do DO.
    if (ficha === undefined) return []
    const vista = vistaNoFeed(eu, op, ficha)
    return vista === null ? [] : [modificacaoDoMural(vista, fichaDaFrase(ficha.doc), rotulos)]
  })
  const ultima = pagina.at(-1)
  const proximaAntesDeRev = lidas.length > pedido.limite && ultima !== undefined ? ultima.rev : null
  enviar(ws, { t: 'mural.modificacoes', fichaId: pedido.fichaId, autorContaId: pedido.autorContaId, lista, proximaAntesDeRev })
}

// ── Exportar ────────────────────────────────────────────────────────────────

export interface MuralExportado {
  noticias: NoticiaGuardada[]
  reacoes: { noticiaId: number; contaId: string; reacao: string; quando: number }[]
  lidos: { noticiaId: number; contaId: string; versao: number; quando: number }[]
}

/**
 * O mural no `exportar` (com as lápides). O mestre recebe tudo; a segunda
 * parede (não mestre) recebe as notícias, que todo membro vê, e só as
 * reações e os lidos da própria conta.
 */
export function muralParaExportar(sql: SqlStorage, membro: Membro): MuralExportado {
  const filtro = membro.papel === 'mestre' ? '' : 'WHERE contaId = ?'
  const daConta = membro.papel === 'mestre' ? [] : [membro.contaId]
  return {
    noticias: sql.exec(`SELECT ${COLUNAS} FROM mural_noticias ORDER BY id`).toArray().map(noticiaDaLinha),
    reacoes: sql
      .exec(`SELECT noticiaId, contaId, reacao, quando FROM mural_reacoes ${filtro} ORDER BY noticiaId, contaId`, ...daConta)
      .toArray()
      .map((linha) => ({ noticiaId: numero(linha, 'noticiaId'), contaId: texto(linha, 'contaId'), reacao: texto(linha, 'reacao'), quando: numero(linha, 'quando') })),
    lidos: sql
      .exec(`SELECT noticiaId, contaId, versao, quando FROM mural_lidos ${filtro} ORDER BY noticiaId, contaId`, ...daConta)
      .toArray()
      .map((linha) => ({ noticiaId: numero(linha, 'noticiaId'), contaId: texto(linha, 'contaId'), versao: numero(linha, 'versao'), quando: numero(linha, 'quando') })),
  }
}
