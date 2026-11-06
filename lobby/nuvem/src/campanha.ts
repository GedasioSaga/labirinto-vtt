import { DurableObject } from 'cloudflare:workers'
import type { SistemaDeRpg } from '../../../client/src/lib/sistemaDeRpg'
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
import { atenderPedidoDoChat, cursorDoChat, LIMITE_DA_ROTA_DA_SALA, recusarPedidoDoChat, recusarPorRitmo, salaDesde, salaInteira, type SalaDoChat } from './chat'
import {
  atenderPedidoDoDuelo,
  contaSaiuDosDuelos,
  duelosNoOla,
  esquecerSistemaDoDuelo,
  proximoPrazoDosDuelos,
  recusarDueloPorRitmo,
  recusarPedidoDoDuelo,
  vencerPrazosDosDuelos,
  type SalaDoDuelo,
} from './duelo'
import { criarEsquemaDaCampanha } from './esquema'
import { ErroDoPedido, inteiroDaUrl, json, lerCorpo, naoExiste, respostaDoErro } from './http'
import { lerIdentidade, type IdentidadeDoPortao } from './identidade'
import { receberMidia, servirMidia } from './midia'
import { atenderPedidoDoMural, enviarEstadoDoMural, esquecerRotulosDoMural, muralParaExportar, recusarMuralPorRitmo, recusarPedidoDoMural } from './mural'
import {
  assinarBilhete,
  bytesDoTexto,
  chaveDaCotaDaConta,
  conferirRitmo,
  CONTA_DO_MESTRE,
  fichaNoEstado,
  LIMITES,
  membroAtivo,
  novaChaveDaSala,
  podeVer,
  processarDesfazer,
  processarLote,
  projetarMembros,
  projetarOpParaJogador,
  proprio,
  respostasAdiadas,
  segmentoValido,
  sistemaParaOJogador,
  VALIDADE_DO_BILHETE_MS,
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
import { entradasDoDiretorio, publicarFichas, publicarTreino, sincronizarMembros } from './publicar'
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
import {
  CHAVE_DO_REGISTRO_DA_SALA,
  chaveDoRitmoDoBilhete,
  conferirRitmoDoBilhete,
  CORPO_MAX_SALA,
  lerPedidoDaSala,
  lerRegistroDaSala,
  menorPrazo,
  registroDepoisDaBatida,
  salaParaJogador,
  type EstadoComSala,
  type MensagemDaSala,
  type RegistroDaSala,
  type RitmoDoBilhete,
  type SalaParaJogador,
} from './salaAberta'

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
  /**
   * O sistema do `estado` (F1), lido de `meta` uma vez por DO acordado (o
   * publicado pode passar de 1 MB com o livro). `undefined` = ainda não lido;
   * `null` = o guardado não se lê. O publicar esquece.
   */
  private sistemaDoEstado: SistemaDeRpg | null | undefined = undefined

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
      case 'chatSala':
        exigirMetodo(request, 'GET')
        return this.salaDoChat(url, rota.campanhaId, identidade)
      case 'midia':
        return this.midia(request, rota, identidade)
      case 'sala':
        exigirMetodo(request, 'POST')
        return this.abrirSala(request, rota.campanhaId, identidade)
      case 'salaFechar':
        exigirMetodo(request, 'POST')
        return this.fecharSala(rota.campanhaId, identidade)
      case 'bilhete':
        exigirMetodo(request, 'POST')
        return this.bilhete(rota.campanhaId, identidade)
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
   * desde, exportar, sala e sala/fechar (§5.4, B2). O site só tem eu, ws,
   * mídia, versão e bilhete (que tem ritmo próprio); pelo
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
      const daMesa = publicarFichas(this.sql, quem, pedido.fichas, agora)
      // T8: sem a lista (app de antes dela), as cópias de treino ficam como estão.
      const doTreino = pedido.treino === null ? null : publicarTreino(this.sql, quem, pedido.treino, agora)
      return { mudaram, fichas: daMesa.fichas, treino: doTreino?.fichas ?? [], ops: [...daMesa.ops, ...(doTreino?.ops ?? [])] }
    })
    // O sistema pode ter mudado: o feed de modificações relê os nomes (Vida para `hp`).
    esquecerRotulosDoMural(this.sql)
    // E o duelo relê o sistema (só roda no motor do One Piece).
    esquecerSistemaDoDuelo(this.sql)
    // E o `estado`: o que `depoisDeMudarMembros` manda a todos já leva o sistema novo.
    this.sistemaDoEstado = undefined
    await this.depoisDeMudarMembros(campanhaId, pedido.nome, feito.mudaram)
    this.depoisDeGravar(feito.ops)
    return json({ campanhaId, rev: revAtual(this.sql), fichas: feito.fichas, treino: feito.treino })
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
   * A cópia da sala do chat no app (§5.4, achado Ch6): mensagens e lápides
   * com `mudou > desde`, na ordem do cursor; o app repete com `ate` enquanto
   * `temMais`. Só a sala: o privado nunca vai para o disco do mestre (§5.7).
   */
  private salaDoChat(url: URL, campanhaId: string, identidade: IdentidadeDoPortao): Response {
    this.acessoDoApp(campanhaId, identidade)
    const desde = inteiroDaUrl(url, 'desde', 0)
    const limite = limiteDaUrl(url, LIMITE_DA_ROTA_DA_SALA)
    const lista = salaDesde(this.sql, desde, limite)
    const ultima = lista.at(-1)
    const temMais = lista.length === limite
    const cursorAtual = cursorDoChat(this.sql)
    // Página incompleta = alcançou: o cursor salta para o de agora (o que falta no meio é privado, que não vem).
    const ate = temMais && ultima !== undefined ? ultima.mudou : Math.max(desde, cursorAtual)
    return json({ desde, ate, lista, temMais, cursorAtual })
  }

  /**
   * Exportação paginada (§5.4), lista fechada de tabelas: `ops` em toda
   * página; `membros`, `fichas`, `recusadas`, o sistema e a sala do chat
   * (com as lápides) só na primeira (`deRev` = 1). Nunca o chat privado
   * (`chat_dm`, XS5) nem as `lidas`. Só o app do mestre chega aqui; a
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
    // A sala é vista por todo membro: entra igual nas duas paredes.
    const chatSala = salaInteira(this.sql)
    // O mural (M1): o mestre leva tudo; a segunda parede, só as reações e os lidos da própria conta.
    const mural = muralParaExportar(this.sql, membro)
    if (membro.papel === 'mestre') return { membros, fichas, recusadas, sistema: lerSistema(this.sql) ?? null, chatSala, mural }
    return {
      membros: projetarMembros(membros),
      fichas: fichasDoEstado(membro, fichas, membros),
      recusadas: recusadas.filter((recusada) => recusada.autorContaId === membro.contaId),
      chatSala,
      mural,
    }
  }

  // ── Sala aberta no app e bilhete do jogador (B2, salaAberta.ts) ─────────────

  private registroDaSala(): RegistroDaSala | null {
    return lerRegistroDaSala(this.ctx.storage.kv.get(CHAVE_DO_REGISTRO_DA_SALA))
  }

  /** A sala que o jogador vê agora: a vencida, com o alarme ainda por tocar, já é `null`. */
  private salaVisivel(agora: number): SalaParaJogador | null {
    return salaParaJogador(this.registroDaSala(), agora)
  }

  /**
   * Abertura e batida (a cada 4 min) são o mesmo pedido do app: renova o prazo
   * e troca os endereços; a chave só muda numa abertura nova. Sem `await`
   * entre ler e gravar o registro: nenhum outro pedido entra no meio.
   */
  private async abrirSala(request: Request, campanhaId: string, identidade: IdentidadeDoPortao): Promise<Response> {
    this.acessoDoApp(campanhaId, identidade)
    const pedido = lerPedidoDaSala(await lerCorpo(request, CORPO_MAX_SALA))
    const agora = Date.now()
    const batida = registroDepoisDaBatida(this.registroDaSala(), pedido, agora, novaChaveDaSala)
    this.ctx.storage.kv.put(CHAVE_DO_REGISTRO_DA_SALA, batida.registro)
    if (batida.mudouParaJogador) this.difundirSala(salaParaJogador(batida.registro, agora))
    await this.agendarAlarme()
    const { chave, expiraEm } = batida.registro
    return json({ chave, agora, expiraEm })
  }

  /** `net_stop_room` no app: o registro e a chave somem; sem sala aberta, nada a avisar (repetir não muda nada). */
  private fecharSala(campanhaId: string, identidade: IdentidadeDoPortao): Response {
    this.acessoDoApp(campanhaId, identidade)
    const estavaVisivel = this.salaVisivel(Date.now()) !== null
    this.ctx.storage.kv.delete(CHAVE_DO_REGISTRO_DA_SALA)
    if (estavaVisivel) this.difundirSala(null)
    return json({ fechada: true })
  }

  /** O alarme passou do prazo sem batida (app fechado sem `net_stop_room`, internet caiu): a sala some para todos. */
  private vencerSala(agora: number): void {
    const registro = this.registroDaSala()
    if (registro === null || registro.expiraEm > agora) return
    this.ctx.storage.kv.delete(CHAVE_DO_REGISTRO_DA_SALA)
    this.difundirSala(null)
  }

  private difundirSala(sala: SalaParaJogador | null): void {
    const mensagem: MensagemDaSala = { t: 'sala', sala }
    for (const { ws } of this.socketsProntos()) enviar(ws, mensagem)
  }

  /**
   * O convite de um clique (só o site; o `Origin` já foi conferido no portão):
   * o membro sai do e-mail do Access, nunca do pedido. Não membro e Service
   * Token = "não existe" (§6.4); o mestre entra pelo app e não leva convite.
   * O ritmo conta toda tentativa do membro, até a que acha a sala fechada.
   */
  private async bilhete(campanhaId: string, identidade: IdentidadeDoPortao): Promise<Response> {
    if (identidade.origem !== 'site') throw NAO_EXISTE
    const { membro } = this.acesso(campanhaId, identidade)
    if (membro.papel === 'mestre') throw new ErroDoPedido(403, 'mestre', 'O mestre entra pelo app; o convite é para os jogadores')
    const agora = Date.now()
    const ritmo = this.ritmoDoBilhete(membro.contaId, agora)
    if (!ritmo.ok) return json({ erro: 'ritmo', detalhe: 'Convites demais em pouco tempo; espere alguns segundos', tentarDepoisDe: ritmo.tentarDepoisDe }, 429)
    const registro = this.registroDaSala()
    const sala = salaParaJogador(registro, agora)
    if (registro === null || sala === null) throw new ErroDoPedido(409, 'sem-sala', 'A mesa não está aberta agora')
    let bilhete: string
    try {
      bilhete = await assinarBilhete(registro.chave, { sala: registro.codigo, contaId: membro.contaId, nome: membro.nome }, agora)
    } catch (erro) {
      // `assinarBilhete` só lança `TypeError` com conta ou nome fora da forma do bilhete (o `contaId` do membro aceita `:`, `.` e `#`).
      if (erro instanceof TypeError) throw new ErroDoPedido(409, 'conta-sem-convite', 'Esta conta não recebe convite; entre pelo código da sala')
      throw erro
    }
    return json({ bilhete, validoAte: agora + VALIDADE_DO_BILHETE_MS, sala })
  }

  /** GCRA por conta no KV do DO: sobrevive à hibernação e vale para as várias abas da conta. */
  private ritmoDoBilhete(contaId: string, agora: number): RitmoDoBilhete {
    const chave = chaveDoRitmoDoBilhete(contaId)
    const guardado = this.ctx.storage.kv.get(chave)
    const ritmo = conferirRitmoDoBilhete(typeof guardado === 'number' ? guardado : undefined, agora)
    if (ritmo.ok) this.ctx.storage.kv.put(chave, ritmo.paceAt)
    return ritmo
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
      // Socket fechado pelo servidor não chama o `webSocketClose`: o duelo dela começa a contar aqui.
      await this.contaSaiu(contaId, null)
    }
    this.enviarEstadoATodos()
    // Quem saiu some da presença já (os sockets dele não contam mais como prontos); nome novo aparece.
    this.difundirPresenca(this.socketsProntos())
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

  private sistemaParaOEstado(): SistemaDeRpg | null {
    if (this.sistemaDoEstado === undefined) this.sistemaDoEstado = sistemaParaOJogador(lerSistema(this.sql))
    return this.sistemaDoEstado
  }

  /**
   * O `estado` leva também a sala aberta no app (B2) e o sistema publicado
   * (F1, sem o livro): o site de antes deles ignora os campos a mais.
   */
  private estadoPara(membro: Membro, fichas: readonly FichaGuardada[], membros: readonly Membro[], rev: number, sala: SalaParaJogador | null): EstadoComSala {
    const { contaId, nome, papel } = membro
    const estado: EstadoComSala = { t: 'estado', rev, fichas: fichasDoEstado(membro, fichas, membros), membros: projetarMembros(membros), eu: { contaId, nome, papel }, sala }
    const sistema = this.sistemaParaOEstado()
    if (sistema !== null) estado.sistema = sistema
    return estado
  }

  private enviarEstadoATodos(): void {
    const prontos = this.socketsProntos()
    if (prontos.length === 0) return
    const fichas = todasAsFichas(this.sql)
    const membros = todosOsMembros(this.sql)
    const rev = revAtual(this.sql)
    const sala = this.salaVisivel(Date.now())
    for (const { ws, membro } of prontos) enviar(ws, this.estadoPara(membro, fichas, membros, rev, sala))
  }

  /** "Na mesa agora" para todos os `prontos` (uma linha por conta, sem e-mail, §6.4). */
  private difundirPresenca(prontos: readonly SocketPronto[]): void {
    const mensagem: MensagemDoServidor = { t: 'presenca', naMesa: presencaPorConta(prontos) }
    for (const { ws } of prontos) enviar(ws, mensagem)
  }

  /**
   * Presença no `ola`: quem acabou de chegar recebe a lista; os outros só
   * recebem se a CONTA entrou agora (a segunda aba, ou o `ola` repetido da
   * reconexão, não muda quem está na mesa).
   */
  private entrouNaMesa(ws: WebSocket, contaId: string, jaEstavaPronto: boolean): void {
    const prontos = this.socketsProntos()
    const contaJaEstava = jaEstavaPronto || prontos.some((pronto) => pronto.ws !== ws && pronto.membro.contaId === contaId)
    if (contaJaEstava) enviar(ws, { t: 'presenca', naMesa: presencaPorConta(prontos) })
    else this.difundirPresenca(prontos)
  }

  /** Socket fechou: os outros recebem a presença só se a conta saiu de vez (nenhuma outra aba dela pronta). */
  private saiuDaMesa(ws: WebSocket): void {
    const anexo = lerAnexo(ws.deserializeAttachment())
    // Socket que nunca mandou `ola` nunca apareceu na mesa.
    if (anexo === null || anexo.clienteId === null) return
    const restantes = this.socketsProntos(ws)
    if (restantes.some((pronto) => pronto.membro.contaId === anexo.contaId)) return
    this.difundirPresenca(restantes)
  }

  /** O que o chat usa do DO (lobby/nuvem/src/chat.ts). */
  private salaDoChatNoSocket(): SalaDoChat {
    return {
      sql: this.sql,
      transacao: (passo) => this.ctx.storage.transactionSync(passo),
      ouvintes: () => this.socketsProntos().map(({ ws, membro }) => ({ ws, contaId: membro.contaId })),
    }
  }

  /** O que o duelo usa do DO (lobby/nuvem/src/duelo.ts): o do chat e se a conta ainda tem socket. */
  private salaDoDuelo(): SalaDoDuelo {
    return { ...this.salaDoChatNoSocket(), contaConectada: (contaId, exceto) => this.contaConectada(contaId, exceto) }
  }

  /** Algum socket da conta ainda aberto além de `exceto` (o que está fechando, ou fechado pelo servidor, já não conta). */
  private contaConectada(contaId: string, exceto: WebSocket | null): boolean {
    return this.ctx.getWebSockets(tagDaConta(contaId)).some((ws) => ws !== exceto && ws.readyState === WebSocket.OPEN)
  }

  /** A conta perdeu um socket: sem nenhum aberto, os duelos dela começam a contar os 3 minutos (achado Tr9). */
  private async contaSaiu(contaId: string, exceto: WebSocket | null): Promise<void> {
    if (this.contaConectada(contaId, exceto)) return
    if (contaSaiuDosDuelos(this.salaDoDuelo(), contaId, Date.now())) await this.agendarAlarme()
  }

  /**
   * O alarme do DO é UM só (achado Tr4): fica no menor prazo de tudo o que
   * vence. Hoje vencem os duelos e a sala aberta no app (B2); outro prazo do
   * DO entra no mesmo cálculo. Alarme já marcado para antes fica (ao tocar,
   * ele mesmo reagenda): a batida que empurra o prazo da sala só faz o alarme
   * tocar uma vez à toa.
   */
  private async agendarAlarme(): Promise<void> {
    const sala = this.registroDaSala()
    const proximo = menorPrazo([proximoPrazoDosDuelos(this.sql), sala === null ? null : sala.expiraEm])
    if (proximo === null) return
    const marcado = await this.ctx.storage.getAlarm()
    if (marcado === null || proximo < marcado) await this.ctx.storage.setAlarm(proximo)
  }

  async alarm(): Promise<void> {
    const agora = Date.now()
    vencerPrazosDosDuelos(this.salaDoDuelo(), agora)
    this.vencerSala(agora)
    await this.agendarAlarme()
  }

  private async duelo(ws: WebSocket, quem: Identidade, leitura: Extract<Frame, { t: 'duelo' }>['leitura'], agora: number): Promise<void> {
    // O torto já foi respondido em `webSocketMessage`; aqui só chega pedido lido, de membro ativo relido agora.
    const membro = membroPorConta(this.sql, quem.contaId)
    if (!leitura.ok || !membroAtivo(membro)) return
    atenderPedidoDoDuelo(this.salaDoDuelo(), ws, membro, leitura.pedido, agora)
    // Convite novo, duelo que começou com alguém fora ou que acabou: um prazo pode ter nascido.
    await this.agendarAlarme()
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

  webSocketMessage(ws: WebSocket, mensagem: string | ArrayBuffer): void | Promise<void> {
    const anexo = lerAnexo(ws.deserializeAttachment())
    const membro = anexo === null ? undefined : membroPorConta(this.sql, anexo.contaId)
    // A cada mensagem, não só no upgrade: removido ou com outro e-mail sai já (§6.4).
    if (anexo === null || !membroAtivo(membro) || membro.email !== anexo.email) {
      fechar(ws, FECHAR_SEM_ACESSO, 'Você não está nesta campanha')
      // Removido sem passar por `depoisDeMudarMembros`: o duelo dele começa a contar aqui também.
      if (anexo !== null) return this.contaSaiu(anexo.contaId, ws)
      return
    }
    const agora = Date.now()
    const frame = typeof mensagem === 'string' && bytesDoTexto(mensagem) <= LIMITES.frameBytes ? lerFrame(mensagem) : null
    const clienteId = frame !== null && frame.t === 'ola' ? frame.clienteId : anexo.clienteId
    if (frame === null || clienteId === null) return this.contarViolacoes(ws, anexo, 1, agora)
    // `chat.*` torto também é violação, mas ganha resposta: o site tira o "enviando…" e mostra o motivo.
    if (frame.t === 'chat' && !frame.leitura.ok) {
      const { pedido, idDoCliente } = frame.leitura
      recusarPedidoDoChat(ws, pedido, 'formato', idDoCliente === undefined ? {} : { idDoCliente })
      return this.contarViolacoes(ws, anexo, 1, agora)
    }
    if (frame.t === 'mural' && !frame.leitura.ok) {
      const { pedido, idDoCliente } = frame.leitura
      recusarPedidoDoMural(ws, pedido, 'formato', idDoCliente === undefined ? {} : { idDoCliente })
      return this.contarViolacoes(ws, anexo, 1, agora)
    }
    if (frame.t === 'duelo' && !frame.leitura.ok) {
      recusarPedidoDoDuelo(ws, frame.leitura.pedido, 'formato', frame.leitura.id)
      return this.contarViolacoes(ws, anexo, 1, agora)
    }
    // O primeiro `ola` do socket não passa pelo ritmo: sem ele o socket não serve para nada, e sockets por conta já têm teto.
    if (!(frame.t === 'ola' && anexo.clienteId === null)) {
      const ritmo = this.conferirRitmo(membro.contaId, agora)
      if (!ritmo.ok) return this.responderAoRitmo(ws, frame, ritmo.tentarDepoisDe)
    }
    return this.atenderFrame(ws, anexo, frame, identidadeDoNucleo(membro, anexo.origem, clienteId), agora)
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    fecharDeVolta(ws)
    this.saiuDaMesa(ws)
    await this.saiuDosDuelos(ws)
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.saiuDaMesa(ws)
    await this.saiuDosDuelos(ws)
  }

  /** Qualquer socket conta para o duelo (até o que não mandou `ola`): ausente é a conta sem nenhum. */
  private async saiuDosDuelos(ws: WebSocket): Promise<void> {
    const anexo = lerAnexo(ws.deserializeAttachment())
    if (anexo !== null) await this.contaSaiu(anexo.contaId, ws)
  }

  private atenderFrame(ws: WebSocket, anexo: Anexo, frame: Frame, quem: Identidade, agora: number): void | Promise<void> {
    switch (frame.t) {
      case 'ola':
        return this.ola(ws, anexo, quem, frame)
      case 'ops':
        return this.responder(ws, anexo, agora, (leitor, hora) => processarLote(leitor, quem, frame.lote, hora))
      case 'desfazer':
        return this.responder(ws, anexo, agora, (leitor, hora) => processarDesfazer(leitor, quem, frame.pedido, hora))
      case 'historico':
        return this.historico(ws, quem, frame)
      case 'chat': {
        const membro = membroPorConta(this.sql, quem.contaId)
        // O torto já foi respondido em `webSocketMessage`; aqui só chega pedido lido.
        if (!frame.leitura.ok || !membroAtivo(membro)) return
        return atenderPedidoDoChat(this.salaDoChatNoSocket(), ws, membro, frame.leitura.pedido, agora)
      }
      case 'mural': {
        // O papel é relido de `membros` aqui: só o mestre posta, edita, apaga e fixa (§6.4).
        const membro = membroPorConta(this.sql, quem.contaId)
        if (!frame.leitura.ok || !membroAtivo(membro)) return
        // O mural usa do DO o mesmo que o chat (SQLite, transação, sockets prontos).
        return atenderPedidoDoMural(this.salaDoChatNoSocket(), ws, membro, frame.leitura.pedido, agora)
      }
      case 'duelo':
        return this.duelo(ws, quem, frame.leitura, agora)
    }
  }

  private async responder(ws: WebSocket, anexo: Anexo, agora: number, passo: (leitor: LeitorDaCampanha, agora: number) => ResultadoDoProcessamento): Promise<void> {
    const resultado = this.processar(passo)
    for (const resposta of resultado.respostas) enviar(ws, resposta)
    this.depoisDeGravar(resultado.gravacoes.ops)
    if (resultado.violacoes > 0) await this.contarViolacoes(ws, anexo, resultado.violacoes, agora)
  }

  private ola(ws: WebSocket, anexo: Anexo, quem: Identidade, frame: Extract<Frame, { t: 'ola' }>): void {
    if (!versaoAceita(frame.v)) {
      enviar(ws, { t: 'versao', versaoDoFormato: VERSAO_DO_FORMATO })
      return
    }
    const jaEstavaPronto = anexo.clienteId !== null
    ws.serializeAttachment({ ...anexo, clienteId: frame.clienteId })
    const membro = membroPorConta(this.sql, quem.contaId)
    if (!membroAtivo(membro)) return
    const atual = revAtual(this.sql)
    const desde = frame.desdeRev
    const sala = this.salaVisivel(Date.now())
    if (desde === null || desde > atual || atual - desde > LIMITE_SEM_SNAPSHOT) {
      enviar(ws, this.estadoPara(membro, todasAsFichas(this.sql), todosOsMembros(this.sql), atual, sala))
    } else {
      this.enviarOpsDesde(ws, membro, desde, atual)
      // Sem `estado`, a sala vai no frame próprio, e só aberta: o site de antes da B4 derruba o socket com frame que não conhece (salaAberta.ts).
      if (sala !== null) enviar(ws, { t: 'sala', sala })
    }
    this.entrouNaMesa(ws, membro.contaId, jaEstavaPronto)
    // Quem entra (ou volta) recebe os avisos fixados com o `lida` dele e a primeira página do mural (M1).
    enviarEstadoDoMural(this.sql, ws, membro.contaId)
    // E os duelos dele: quem tinha caído volta (o relógio dos 3 minutos para) e recebe a lista (T6).
    duelosNoOla(this.salaDoDuelo(), ws, membro, Date.now())
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

  /** Frame acima do ritmo: op e desfazer viram `adiado` (a fila reenvia sozinha); `chat.*` vira `chat.recusado` com motivo `ritmo`; `ola` repetido e `historico` ficam sem resposta. */
  private responderAoRitmo(ws: WebSocket, frame: Frame, tentarDepoisDe: number): void {
    if (frame.t === 'chat') {
      if (frame.leitura.ok) recusarPorRitmo(ws, frame.leitura.pedido, tentarDepoisDe)
      return
    }
    if (frame.t === 'mural') {
      if (frame.leitura.ok) recusarMuralPorRitmo(ws, frame.leitura.pedido, tentarDepoisDe)
      return
    }
    if (frame.t === 'duelo') {
      if (frame.leitura.ok) recusarDueloPorRitmo(ws, frame.leitura.pedido, tentarDepoisDe)
      return
    }
    if (frame.t === 'ops') {
      for (const resposta of respostasAdiadas(frame.lote, 'ritmo', tentarDepoisDe)) enviar(ws, resposta)
      return
    }
    const novoOpId = frame.t === 'desfazer' ? proprio(frame.pedido, 'novoOpId') : undefined
    if (segmentoValido(novoOpId)) enviar(ws, { t: 'adiado', opId: novoOpId, motivo: 'ritmo', tentarDepoisDe })
  }

  /** Violação = frame fora do formato ou op negada por regra, nunca `adiado` (§6.5). Passou do teto: fecha e bloqueia a conta por alguns minutos. */
  private async contarViolacoes(ws: WebSocket, anexo: Anexo, quantas: number, agora: number): Promise<void> {
    const atual = lerAnexo(ws.deserializeAttachment())
    const violacoes = (atual === null ? anexo.violacoes : atual.violacoes) + quantas
    ws.serializeAttachment({ ...(atual === null ? anexo : atual), violacoes })
    if (violacoes < LIMITES.violacoesAteFechar) return
    this.ctx.storage.transactionSync(() => bloquear(this.sql, anexo.contaId, agora + LIMITES.bloqueioDepoisDasViolacoesMs))
    fechar(ws, FECHAR_POR_VIOLACAO, 'Mensagens fora do formato demais')
    // Como em `depoisDeMudarMembros`: o socket que o servidor fecha não espera o `webSocketClose` para o duelo
    // contar (sem outra aba, os 3 minutos começam já). Repetir não muda nada: `marcarAusente` guarda o 1º instante.
    await this.contaSaiu(anexo.contaId, ws)
  }
}

/**
 * Quem está conectado agora, UMA linha por conta (a conta com várias abas
 * aparece uma vez), só com contaId, nome e papel: nunca o e-mail do colega
 * (§6.4, XS12). `onde` = `app` se algum socket da conta é do app. Mestre
 * primeiro, depois por nome.
 */
function presencaPorConta(prontos: readonly SocketPronto[]): PresencaNaMesa[] {
  const porConta = new Map<string, PresencaNaMesa>()
  for (const { anexo, membro } of prontos) {
    const onde = porConta.get(membro.contaId)?.onde === 'app' ? 'app' : anexo.origem
    porConta.set(membro.contaId, { contaId: membro.contaId, nome: membro.nome, papel: membro.papel, onde })
  }
  return [...porConta.values()].sort((a, b) => Number(b.papel === 'mestre') - Number(a.papel === 'mestre') || a.nome.localeCompare(b.nome, 'pt-BR'))
}

function fichasDoEstado(eu: Membro, fichas: readonly FichaGuardada[], membros: readonly Membro[]): FichaNoEstado[] {
  const nomes = new Map(membros.map((membro): [string, string] => [membro.contaId, membro.nome]))
  return fichas.flatMap((ficha) => {
    const noEstado = fichaNoEstado(eu, ficha, (contaId) => nomes.get(contaId) ?? null)
    return noEstado === null ? [] : [noEstado]
  })
}
