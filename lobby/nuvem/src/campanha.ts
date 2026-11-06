import { DurableObject } from 'cloudflare:workers'
import {
  bloqueadaAte,
  bloquear,
  emailDoMestre,
  gravar,
  gravarCota,
  gravarMeta,
  historicoDaFicha,
  leitorDoBanco,
  lerCota,
  lerFicha,
  lerMeta,
  lerSistema,
  membroPorConta,
  membroPorEmail,
  opsDesde,
  opsEntre,
  revAtual,
  todasAsFichas,
  todasAsRecusadas,
  todosOsMembros,
  visivelDaFicha,
  type MetaDaCampanha,
} from './banco'
import { criarEsquemaDaCampanha } from './esquema'
import { ErroDoPedido, inteiroDaUrl, json, lerCorpo, naoExiste, respostaDoErro } from './http'
import { lerIdentidade, type IdentidadeDoPortao } from './identidade'
import { receberMidia, servirMidia } from './midia'
import {
  bytesDoTexto,
  chaveDaCotaDaConta,
  conferirRitmo,
  CONTA_DO_MESTRE,
  fichaNoEstado,
  LIMITES,
  membroAtivo,
  podeVer,
  processarDesfazer,
  processarLote,
  projetarMembros,
  projetarOpParaJogador,
  proprio,
  respostasAdiadas,
  segmentoValido,
  VERSAO_DO_FORMATO,
  type ConferenciaDoRitmo,
  type FichaGuardada,
  type FichaNoEstado,
  type Identidade,
  type LeitorDaCampanha,
  type Membro,
  type MensagemDoServidor,
  type OpGravada,
  type PresencaNaMesa,
  type ResultadoDoProcessamento,
} from './nucleo'
import { CORPO_MAX_MEMBROS, CORPO_MAX_OPS, CORPO_MAX_PUBLICAR, lerPedidoDeMembros, lerPedidoDeOps, lerPedidoDePublicar, versaoAceita } from './pedidos'
import { entradasDoDiretorio, publicarFichas, sincronizarMembros } from './publicar'
import { NOME_DO_DIRETORIO, rotaDaCampanha, type RotaDaCampanha, type RotaDaMidia, type RotaDoDesde } from './rotas'
import {
  enviar,
  fechar,
  fecharDeVolta,
  FECHAR_POR_VIOLACAO,
  FECHAR_SEM_ACESSO,
  lerAnexo,
  lerFrame,
  PING,
  PONG,
  tagDaConta,
  type Anexo,
  type Frame,
} from './sala'

/**
 * DO CAMPANHA (plano §3.1, §4.5, §5, §6.4): um por pasta publicada, o único
 * escritor da campanha. Toda mudança passa pelo `processarLote` (ou pelo
 * `processarDesfazer`) do núcleo e é gravada inteira num `transactionSync`:
 * o lote todo, com cada grupo atômico, entra ou não entra (8.1.1, item 4).
 * A permissão é conferida a cada pedido e a cada mensagem, nunca só na
 * entrada; quem não é membro recebe a mesma resposta de "não existe".
 */

/** Mais de 1.000 ops atrás, o `ola` recebe o `estado` inteiro em vez das ops (§5.4). */
const LIMITE_SEM_SNAPSHOT = 1000
/** As ops do `ola` saem em mensagens de até 200 (cada mensagem bem abaixo do teto do socket). */
const PAGINA_DO_OLA = 200
const LIMITE_DO_DESDE = 500
const LIMITE_DA_EXPORTACAO = 500

const NAO_EXISTE = new ErroDoPedido(404, 'nao-existe', 'Não existe')

interface Acesso {
  membro: Membro
  meta: MetaDaCampanha
}

interface SocketPronto {
  ws: WebSocket
  anexo: Anexo
  membro: Membro
}

function identidadeDoNucleo(membro: Membro, origem: Identidade['origem'], clienteId: string): Identidade {
  return { email: membro.email, contaId: membro.contaId, nome: membro.nome, papel: membro.papel, origem, clienteId }
}

/** Ficha criada, apagada ou com outro dono muda o que cada um vê e edita (`ehMinha`): todo mundo recebe o `estado` de novo. */
function mudaQuemVeOuEdita(op: OpGravada): boolean {
  return op.caminho.length === 0 || op.caminho[0] === 'dono'
}

function exigirMetodo(request: Request, metodo: 'GET' | 'POST'): void {
  if (request.method !== metodo) throw new ErroDoPedido(405, 'metodo', `Use ${metodo}`)
}

function limiteDaUrl(url: URL, maximo: number): number {
  return Math.min(Math.max(inteiroDaUrl(url, 'limite', maximo), 1), maximo)
}

export class Campanha extends DurableObject<Env> {
  private readonly sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    criarEsquemaDaCampanha(this.sql)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG))
  }

  async fetch(request: Request): Promise<Response> {
    const identidade = lerIdentidade(request)
    const url = new URL(request.url)
    const rota = rotaDaCampanha(url.pathname)
    if (identidade === null || rota === null) return naoExiste()
    try {
      return await this.atender(request, url, rota, identidade)
    } catch (erro) {
      if (erro instanceof ErroDoPedido) return respostaDoErro(erro)
      throw erro
    }
  }

  private async atender(request: Request, url: URL, rota: RotaDaCampanha, identidade: IdentidadeDoPortao): Promise<Response> {
    switch (rota.nome) {
      case 'publicar':
        exigirMetodo(request, 'POST')
        return this.publicar(request, rota.campanhaId, identidade)
      case 'membros':
        exigirMetodo(request, 'POST')
        return this.membros(request, rota.campanhaId, identidade)
      case 'ops':
        exigirMetodo(request, 'POST')
        return this.opsDoApp(request, rota.campanhaId, identidade)
      case 'desde':
        exigirMetodo(request, 'GET')
        return this.desde(url, rota, identidade)
      case 'exportar':
        exigirMetodo(request, 'GET')
        return this.exportar(url, rota.campanhaId, identidade)
      case 'ws':
        exigirMetodo(request, 'GET')
        return this.abrirSocket(request, rota.campanhaId, identidade)
      case 'midia':
        return this.midia(request, rota, identidade)
    }
  }

  /** O membro ativo desta campanha publicada; senão, "não existe" (§6.4). A identidade do app é sempre o mestre. */
  private acesso(campanhaId: string, identidade: IdentidadeDoPortao): Acesso {
    const meta = lerMeta(this.sql)
    if (meta === null || meta.campanhaId !== campanhaId) throw NAO_EXISTE
    const membro = membroPorEmail(this.sql, identidade.email)
    if (!membroAtivo(membro)) throw NAO_EXISTE
    if (identidade.origem === 'app' && membro.contaId !== CONTA_DO_MESTRE) throw NAO_EXISTE
    return { membro, meta }
  }

  /**
   * Rotas que só o app do mestre (Service Token) usa: publicar, membros, ops,
   * desde e exportar (§5.4). O site só tem eu, ws, mídia e versão; pelo
   * socket, todo frame passa pelo ritmo e pelo bloqueio (§6.5), e uma rota
   * HTTP de leitura aberta ao site seria o caminho sem esse freio.
   */
  private acessoDoApp(campanhaId: string, identidade: IdentidadeDoPortao): Acesso {
    if (identidade.origem !== 'app') throw NAO_EXISTE
    return this.acesso(campanhaId, identidade)
  }

  // ── Rotas do app ──────────────────────────────────────────────────────────

  private async publicar(request: Request, campanhaId: string, identidade: IdentidadeDoPortao): Promise<Response> {
    if (identidade.origem !== 'app') throw NAO_EXISTE
    const meta = lerMeta(this.sql)
    // Campanha já publicada: só o mesmo mestre publica de novo.
    if (meta !== null && (meta.campanhaId !== campanhaId || emailDoMestre(this.sql) !== identidade.email)) throw NAO_EXISTE
    const pedido = lerPedidoDePublicar(await lerCorpo(request, CORPO_MAX_PUBLICAR))
    const quem: Identidade = { email: identidade.email, contaId: CONTA_DO_MESTRE, nome: pedido.nomeDoMestre, papel: 'mestre', origem: 'app', clienteId: pedido.clienteId }
    const agora = Date.now()
    const feito = this.ctx.storage.transactionSync(() => {
      gravarMeta(this.sql, { campanhaId, nome: pedido.nome }, pedido.sistema)
      const mudaram = sincronizarMembros(this.sql, identidade.email, pedido)
      return { mudaram, ...publicarFichas(this.sql, quem, pedido.fichas, agora) }
    })
    await this.depoisDeMudarMembros(campanhaId, pedido.nome, feito.mudaram)
    this.depoisDeGravar(feito.ops)
    return json({ campanhaId, rev: revAtual(this.sql), fichas: feito.fichas })
  }

  private async membros(request: Request, campanhaId: string, identidade: IdentidadeDoPortao): Promise<Response> {
    const { meta } = this.acessoDoApp(campanhaId, identidade)
    const pedido = lerPedidoDeMembros(await lerCorpo(request, CORPO_MAX_MEMBROS))
    const mudaram = this.ctx.storage.transactionSync(() => sincronizarMembros(this.sql, identidade.email, pedido))
    await this.depoisDeMudarMembros(campanhaId, meta.nome, mudaram)
    return json({ membros: todosOsMembros(this.sql) })
  }

  private async opsDoApp(request: Request, campanhaId: string, identidade: IdentidadeDoPortao): Promise<Response> {
    const { membro } = this.acessoDoApp(campanhaId, identidade)
    const pedido = lerPedidoDeOps(await lerCorpo(request, CORPO_MAX_OPS))
    const quem = identidadeDoNucleo(membro, 'app', pedido.clienteId)
    const resultado = this.processar((leitor, agora) => processarLote(leitor, quem, pedido.lote, agora))
    this.depoisDeGravar(resultado.gravacoes.ops)
    return json({ respostas: resultado.respostas, revAtual: resultado.revAtual })
  }

  /** Sempre ops, nunca snapshot, paginado: quem chama repete com `ate` até alcançar `revAtual` (§5.4, §5.5). */
  private desde(url: URL, rota: RotaDoDesde, identidade: IdentidadeDoPortao): Response {
    const { membro } = this.acessoDoApp(rota.campanhaId, identidade)
    const lidas = opsDesde(this.sql, rota.rev, limiteDaUrl(url, LIMITE_DO_DESDE))
    const ultima = lidas.at(-1)
    const ate = ultima === undefined ? rota.rev : ultima.rev
    return json({ t: 'ops', desde: rota.rev, ate, lista: this.projetarOps(membro, lidas), revAtual: revAtual(this.sql) })
  }

  /**
   * Exportação paginada (§5.4), lista fechada de tabelas: `ops` em toda
   * página; `membros`, `fichas`, `recusadas` e o sistema só na primeira
   * (`deRev` = 1). Nunca chat privado. Só o app do mestre chega aqui; a
   * projeção para não mestre (§6.4) fica como segunda parede, para a rota
   * não vazar nota do mestre se um dia abrir para o site.
   */
  private exportar(url: URL, campanhaId: string, identidade: IdentidadeDoPortao): Response {
    const { membro, meta } = this.acessoDoApp(campanhaId, identidade)
    const atual = revAtual(this.sql)
    const deRev = Math.max(1, inteiroDaUrl(url, 'deRev', 1))
    const ateRev = Math.min(atual, inteiroDaUrl(url, 'ateRev', atual))
    const lidas = deRev > ateRev ? [] : opsEntre(this.sql, deRev, ateRev, limiteDaUrl(url, LIMITE_DA_EXPORTACAO))
    const ultima = lidas.at(-1)
    const proximaDeRev = ultima !== undefined && ultima.rev < ateRev ? ultima.rev + 1 : null
    const pagina = { campanhaId, nome: meta.nome, revAtual: atual, deRev, ateRev, proximaDeRev, ops: this.projetarOps(membro, lidas) }
    return json(deRev === 1 ? { ...pagina, tabelas: this.tabelasDaExportacao(membro) } : pagina)
  }

  private tabelasDaExportacao(membro: Membro): Record<string, unknown> {
    const membros = todosOsMembros(this.sql)
    const fichas = todasAsFichas(this.sql)
    const recusadas = todasAsRecusadas(this.sql)
    if (membro.papel === 'mestre') return { membros, fichas, recusadas, sistema: lerSistema(this.sql) ?? null }
    return {
      membros: projetarMembros(membros),
      fichas: fichasDoEstado(membro, fichas, membros),
      recusadas: recusadas.filter((recusada) => recusada.autorContaId === membro.contaId),
    }
  }

  // ── Mídia (W3) ────────────────────────────────────────────────────────────

  /** §6.6: na v1 só o app do mestre sobe imagem (PUT); todo membro ativo baixa (GET), no app e no site. */
  private async midia(request: Request, rota: RotaDaMidia, identidade: IdentidadeDoPortao): Promise<Response> {
    if (request.method === 'PUT') {
      const { membro } = this.acessoDoApp(rota.campanhaId, identidade)
      return receberMidia(request, this.ctx.storage, rota.midiaId, membro.contaId)
    }
    if (request.method !== 'GET') throw new ErroDoPedido(405, 'metodo', 'Use GET ou PUT')
    this.acesso(rota.campanhaId, identidade)
    return servirMidia(this.sql, rota.midiaId)
  }

  // ── Depois de gravar ──────────────────────────────────────────────────────

  /** Lê e grava num `transactionSync` só: o lote inteiro (cada grupo atômico junto) entra ou não entra. */
  private processar(passo: (leitor: LeitorDaCampanha, agora: number) => ResultadoDoProcessamento): ResultadoDoProcessamento {
    const agora = Date.now()
    return this.ctx.storage.transactionSync(() => {
      const resultado = passo(leitorDoBanco(this.sql), agora)
      gravar(this.sql, resultado.gravacoes)
      return resultado
    })
  }

  private depoisDeGravar(ops: readonly OpGravada[]): void {
    this.difundir(ops)
    if (ops.some(mudaQuemVeOuEdita)) this.enviarEstadoATodos()
  }

  /** Quem saiu (ou mudou de e-mail) perde os sockets; o Diretório recebe a lista nova (§4.5, §6.4). */
  private async depoisDeMudarMembros(campanhaId: string, nome: string, mudaram: readonly string[]): Promise<void> {
    for (const contaId of mudaram) {
      for (const ws of this.ctx.getWebSockets(tagDaConta(contaId))) fechar(ws, FECHAR_SEM_ACESSO, 'Seu acesso a esta campanha mudou')
    }
    this.enviarEstadoATodos()
    const diretorio = this.env.DIRETORIO.get(this.env.DIRETORIO.idFromName(NOME_DO_DIRETORIO))
    try {
      await diretorio.atualizarCampanha(campanhaId, nome, entradasDoDiretorio(this.sql))
    } catch {
      // A campanha já gravou os membros; o app reenvia o mesmo pedido (idempotente) quando recebe 503.
      throw new ErroDoPedido(503, 'diretorio', 'A lista de campanhas não atualizou; tente de novo')
    }
  }

  private projetarOps(membro: Membro, ops: readonly OpGravada[]): OpGravada[] {
    if (membro.papel === 'mestre') return [...ops]
    const visivel = new Map<string, ReturnType<typeof visivelDaFicha>>()
    return ops.flatMap((op) => {
      if (!visivel.has(op.fichaId)) visivel.set(op.fichaId, visivelDaFicha(this.sql, op.fichaId))
      // Ficha sem linha (op que nunca criou nada): trata como escondida.
      const projetada = projetarOpParaJogador(op, visivel.get(op.fichaId) ?? 'mestre')
      return projetada === null ? [] : [projetada]
    })
  }

  private socketsProntos(excluir?: WebSocket): SocketPronto[] {
    const prontos: SocketPronto[] = []
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === excluir) continue
      const anexo = lerAnexo(ws.deserializeAttachment())
      if (anexo === null || anexo.clienteId === null) continue
      const membro = membroPorConta(this.sql, anexo.contaId)
      if (membroAtivo(membro) && membro.email === anexo.email) prontos.push({ ws, anexo, membro })
    }
    return prontos
  }

  private difundir(ops: readonly OpGravada[]): void {
    if (ops.length === 0) return
    for (const { ws, membro } of this.socketsProntos()) {
      for (const op of this.projetarOps(membro, ops)) enviar(ws, { t: 'aplicada', op })
    }
  }

  private estadoPara(membro: Membro, fichas: readonly FichaGuardada[], membros: readonly Membro[], rev: number): MensagemDoServidor {
    const { contaId, nome, papel } = membro
    return { t: 'estado', rev, fichas: fichasDoEstado(membro, fichas, membros), membros: projetarMembros(membros), eu: { contaId, nome, papel } }
  }

  private enviarEstadoATodos(): void {
    const prontos = this.socketsProntos()
    if (prontos.length === 0) return
    const fichas = todasAsFichas(this.sql)
    const membros = todosOsMembros(this.sql)
    const rev = revAtual(this.sql)
    for (const { ws, membro } of prontos) enviar(ws, this.estadoPara(membro, fichas, membros, rev))
  }

  private difundirPresenca(excluir?: WebSocket): void {
    const prontos = this.socketsProntos(excluir)
    const naMesa = new Map<string, PresencaNaMesa>()
    for (const { anexo, membro } of prontos) {
      naMesa.set(`${membro.contaId}:${anexo.origem}`, { contaId: membro.contaId, nome: membro.nome, papel: membro.papel, onde: anexo.origem })
    }
    for (const { ws } of prontos) enviar(ws, { t: 'presenca', naMesa: [...naMesa.values()] })
  }

  // ── WebSocket do site ─────────────────────────────────────────────────────

  private abrirSocket(request: Request, campanhaId: string, identidade: IdentidadeDoPortao): Response {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') throw new ErroDoPedido(426, 'precisa-websocket', 'Use WebSocket')
    const { membro } = this.acesso(campanhaId, identidade)
    const bloqueio = bloqueadaAte(this.sql, membro.contaId)
    if (bloqueio !== undefined && bloqueio > Date.now()) throw new ErroDoPedido(429, 'bloqueado', 'Mensagens fora do formato demais; tente daqui a alguns minutos')
    if (this.ctx.getWebSockets(tagDaConta(membro.contaId)).length >= LIMITES.socketsPorConta) throw new ErroDoPedido(429, 'sockets', 'Abas demais abertas nesta conta')
    if (this.ctx.getWebSockets().length >= LIMITES.socketsPorCampanha) throw new ErroDoPedido(429, 'sockets', 'Gente demais conectada nesta campanha')
    const par = new WebSocketPair()
    const servidor = par[1]
    this.ctx.acceptWebSocket(servidor, [tagDaConta(membro.contaId)])
    const anexo: Anexo = { contaId: membro.contaId, email: membro.email, origem: identidade.origem, clienteId: null, violacoes: 0 }
    servidor.serializeAttachment(anexo)
    return new Response(null, { status: 101, webSocket: par[0] })
  }

  webSocketMessage(ws: WebSocket, mensagem: string | ArrayBuffer): void {
    const anexo = lerAnexo(ws.deserializeAttachment())
    const membro = anexo === null ? undefined : membroPorConta(this.sql, anexo.contaId)
    // A cada mensagem, não só no upgrade: removido ou com outro e-mail sai já (§6.4).
    if (anexo === null || !membroAtivo(membro) || membro.email !== anexo.email) {
      fechar(ws, FECHAR_SEM_ACESSO, 'Você não está nesta campanha')
      return
    }
    const agora = Date.now()
    const frame = typeof mensagem === 'string' && bytesDoTexto(mensagem) <= LIMITES.frameBytes ? lerFrame(mensagem) : null
    const clienteId = frame !== null && frame.t === 'ola' ? frame.clienteId : anexo.clienteId
    if (frame === null || clienteId === null) {
      this.contarViolacoes(ws, anexo, 1, agora)
      return
    }
    // O primeiro `ola` do socket não passa pelo ritmo: sem ele o socket não serve para nada, e sockets por conta já têm teto.
    if (!(frame.t === 'ola' && anexo.clienteId === null)) {
      const ritmo = this.conferirRitmo(membro.contaId, agora)
      if (!ritmo.ok) return this.responderAoRitmo(ws, frame, ritmo.tentarDepoisDe)
    }
    this.atenderFrame(ws, anexo, frame, identidadeDoNucleo(membro, anexo.origem, clienteId), agora)
  }

  webSocketClose(ws: WebSocket): void {
    fecharDeVolta(ws)
    this.difundirPresenca(ws)
  }

  webSocketError(ws: WebSocket): void {
    this.difundirPresenca(ws)
  }

  private atenderFrame(ws: WebSocket, anexo: Anexo, frame: Frame, quem: Identidade, agora: number): void {
    switch (frame.t) {
      case 'ola':
        return this.ola(ws, anexo, quem, frame)
      case 'ops':
        return this.responder(ws, anexo, agora, (leitor, hora) => processarLote(leitor, quem, frame.lote, hora))
      case 'desfazer':
        return this.responder(ws, anexo, agora, (leitor, hora) => processarDesfazer(leitor, quem, frame.pedido, hora))
      case 'historico':
        return this.historico(ws, quem, frame)
    }
  }

  private responder(ws: WebSocket, anexo: Anexo, agora: number, passo: (leitor: LeitorDaCampanha, agora: number) => ResultadoDoProcessamento): void {
    const resultado = this.processar(passo)
    for (const resposta of resultado.respostas) enviar(ws, resposta)
    this.depoisDeGravar(resultado.gravacoes.ops)
    if (resultado.violacoes > 0) this.contarViolacoes(ws, anexo, resultado.violacoes, agora)
  }

  private ola(ws: WebSocket, anexo: Anexo, quem: Identidade, frame: Extract<Frame, { t: 'ola' }>): void {
    if (!versaoAceita(frame.v)) {
      enviar(ws, { t: 'versao', versaoDoFormato: VERSAO_DO_FORMATO })
      return
    }
    ws.serializeAttachment({ ...anexo, clienteId: frame.clienteId })
    const membro = membroPorConta(this.sql, quem.contaId)
    if (!membroAtivo(membro)) return
    const atual = revAtual(this.sql)
    const desde = frame.desdeRev
    if (desde === null || desde > atual || atual - desde > LIMITE_SEM_SNAPSHOT) {
      enviar(ws, this.estadoPara(membro, todasAsFichas(this.sql), todosOsMembros(this.sql), atual))
    } else {
      this.enviarOpsDesde(ws, membro, desde, atual)
    }
    this.difundirPresenca()
  }

  /** As ops que faltam, em páginas; já em dia = uma página vazia (o site sabe que alcançou). */
  private enviarOpsDesde(ws: WebSocket, membro: Membro, desde: number, atual: number): void {
    let inicio = desde
    do {
      const lidas = opsDesde(this.sql, inicio, PAGINA_DO_OLA)
      const ultima = lidas.at(-1)
      const ate = ultima === undefined ? atual : ultima.rev
      enviar(ws, { t: 'ops', desde: inicio, ate, lista: this.projetarOps(membro, lidas) })
      inicio = ate
    } while (inicio < atual)
  }

  private historico(ws: WebSocket, quem: Identidade, frame: Extract<Frame, { t: 'historico' }>): void {
    const ficha = lerFicha(this.sql, frame.fichaId)
    const membro = membroPorConta(this.sql, quem.contaId)
    if (ficha === undefined || !membroAtivo(membro) || !podeVer(membro.papel, ficha)) {
      // Ficha que não existe e ficha que ele não vê: a mesma resposta.
      enviar(ws, { t: 'historico', fichaId: frame.fichaId, lista: [], temMaisAntigas: false })
      return
    }
    const antesDe = frame.antesDeRev === null ? Number.MAX_SAFE_INTEGER : frame.antesDeRev
    const lidas = historicoDaFicha(this.sql, frame.fichaId, antesDe, frame.limite + 1)
    const lista = this.projetarOps(membro, lidas.slice(0, frame.limite))
    enviar(ws, { t: 'historico', fichaId: frame.fichaId, lista, temMaisAntigas: lidas.length > frame.limite })
  }

  /** Ritmo por conta em todo frame (§6.5), com `paceAt` em `cotas`: sobrevive à hibernação e vale para os vários sockets da conta. */
  private conferirRitmo(contaId: string, agora: number): ConferenciaDoRitmo {
    return this.ctx.storage.transactionSync(() => {
      const chave = chaveDaCotaDaConta(contaId, agora)
      const cota = lerCota(this.sql, chave)
      const ritmo = conferirRitmo(cota?.paceAt, agora)
      if (ritmo.ok) gravarCota(this.sql, chave, { ...(cota ?? { ops: 0, bytes: 0, negadas: 0 }), paceAt: ritmo.paceAt })
      return ritmo
    })
  }

  /** Frame acima do ritmo: op e desfazer viram `adiado` (a fila reenvia sozinha); `ola` repetido e `historico` ficam sem resposta. */
  private responderAoRitmo(ws: WebSocket, frame: Frame, tentarDepoisDe: number): void {
    if (frame.t === 'ops') {
      for (const resposta of respostasAdiadas(frame.lote, 'ritmo', tentarDepoisDe)) enviar(ws, resposta)
      return
    }
    const novoOpId = frame.t === 'desfazer' ? proprio(frame.pedido, 'novoOpId') : undefined
    if (segmentoValido(novoOpId)) enviar(ws, { t: 'adiado', opId: novoOpId, motivo: 'ritmo', tentarDepoisDe })
  }

  /** Violação = frame fora do formato ou op negada por regra, nunca `adiado` (§6.5). Passou do teto: fecha e bloqueia a conta por alguns minutos. */
  private contarViolacoes(ws: WebSocket, anexo: Anexo, quantas: number, agora: number): void {
    const atual = lerAnexo(ws.deserializeAttachment())
    const violacoes = (atual === null ? anexo.violacoes : atual.violacoes) + quantas
    ws.serializeAttachment({ ...(atual === null ? anexo : atual), violacoes })
    if (violacoes < LIMITES.violacoesAteFechar) return
    this.ctx.storage.transactionSync(() => bloquear(this.sql, anexo.contaId, agora + LIMITES.bloqueioDepoisDasViolacoesMs))
    fechar(ws, FECHAR_POR_VIOLACAO, 'Mensagens fora do formato demais')
  }
}

function fichasDoEstado(eu: Membro, fichas: readonly FichaGuardada[], membros: readonly Membro[]): FichaNoEstado[] {
  const nomes = new Map(membros.map((membro): [string, string] => [membro.contaId, membro.nome]))
  return fichas.flatMap((ficha) => {
    const noEstado = fichaNoEstado(eu, ficha, (contaId) => nomes.get(contaId) ?? null)
    return noEstado === null ? [] : [noEstado]
  })
}
