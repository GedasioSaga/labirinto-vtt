import { diferencas } from '../../lib/nuvem/diferencas'
import { criarFila, type ArmazenamentoDaFila, type EntradaDaFila, type Fila, type ProblemaNaFila, type ResultadoNaFila } from '../../lib/nuvem/fila'
import type { Json } from '../../lib/nuvem/json'
import type { RespostaDaOp } from '../../lib/nuvem/lote'
import {
  VERSAO_DO_FORMATO,
  type Conflito,
  type MembroProjetado,
  type MensagemDoServidor,
  type MotivoNegado,
  type Mudanca,
  type Op,
  type OpGravada,
  type PresencaNaMesa,
  type Visibilidade,
} from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import type { MensagemDoChatDoServidor, PedidoDoChat } from '../../lib/nuvem/chatDoLobby'
import type { MensagemDoMuralDoServidor, PedidoDoMural } from '../../lib/nuvem/muralDoLobby'
import { ehDoChat, ehDoMural, RELOGIO_DO_NAVEGADOR, type Canal, type FonteDoLobby, type MensagemDoSite, type MotivoDoFechamento, type Relogio } from './fonte'

/**
 * A SESSÃO DE UMA CAMPANHA no site (§5.4-5.6): o protocolo inteiro do lado do
 * navegador, sem React. Abre o canal, manda o `ola`, recebe a base (`estado`
 * ou as ops que faltam), manda a fila pendente em ordem, aplica o que os
 * outros mudam (`aplicada`), guarda conflito e negada até a pessoa decidir e
 * volta sozinha quando a rede cai. A fila é a do núcleo (`criarFila`), com o
 * armazenamento injetado: IndexedDB no site de verdade, memória na demo.
 *
 * Um lote por vez em voo: o seguinte só sai depois que todas as ops do
 * anterior tiveram resposta (a ordem do mesmo campo nunca troca). Resposta
 * que não chega no prazo derruba o canal; a volta reenvia com os mesmos
 * `opId` e o servidor responde igual, sem gravar duas vezes.
 */

/** Espera antes de cada nova tentativa, como no app (§5.5): 2, 5, 10, 30 e depois 60 s. */
export const ESPERAS_DA_RECONEXAO_MS: readonly number[] = [2_000, 5_000, 10_000, 30_000, 60_000]
/** Lote mandado sem resposta por este tempo: o canal está ruim, cai e volta. */
export const PRAZO_DA_RESPOSTA_MS = 20_000
/** O histórico vem em páginas de 50 (§5.3). */
export const PAGINA_DO_HISTORICO = 50
/** Folga depois do `tentarDepoisDe` do adiado, para não chegar um instante antes e ser adiado de novo. */
const FOLGA_DO_ADIADO_MS = 50

export type Conexao =
  /** Abrindo o canal ou esperando a primeira resposta. */
  | 'conectando'
  /** Canal aberto e base recebida: pode editar. */
  | 'em-dia'
  /** Caiu; tentando de novo sozinha. A edição nova fica pausada (§5.6). */
  | 'sem-rede'
  /** O servidor disse que a pessoa não está nesta campanha. */
  | 'sem-acesso'
  /** O servidor fala outra versão do formato: recarregar a página. */
  | 'versao'
  | 'fechada'

export interface FichaDoSite {
  doc: Personagem
  visivel: Visibilidade
  /** Quem está vendo pode editá-la (dono, ou o mestre). */
  ehMinha: boolean
  /** Nome da conta dona; `null` = ficha sem dono (só o mestre edita). */
  nomeDoDono: string | null
  /** Tem mudança negada pelo servidor esperando decisão: selo "não aceito pelo servidor" (§5.6). */
  naoAceita: boolean
}

export interface HistoricoDaFicha {
  /** Da mais nova para a mais velha. */
  lista: OpGravada[]
  temMaisAntigas: boolean
  carregando: boolean
}

export type SituacaoDoDesfazer =
  | { t: 'enviando'; novoOpId: string; confirmar: boolean }
  | { t: 'feito'; rev: number }
  /** "Depois disso, Fulano mudou para Z. Desfazer volta para W. Confirmar?" (§5.3): confirmar = `desfazer(opId, true)`. */
  | { t: 'confirmar'; conflito: Conflito }
  | { t: 'negado'; motivo: MotivoNegado; detalhe?: string }

export interface EstadoDaCampanha {
  campanhaId: string
  conexao: Conexao
  /** Já recebeu a base do servidor ao menos uma vez: sem ela não há ficha para mostrar. */
  carregada: boolean
  /** A rev confirmada: a `baseRev` de quem abre o Editar agora. */
  rev: number
  fichas: FichaDoSite[]
  membros: MembroProjetado[]
  eu: MembroProjetado | null
  naMesa: PresencaNaMesa[]
  /** Quantas mudanças esperam o servidor ("Enviando 1"). */
  esperando: number
  /** Conflitos e negadas: "precisam da sua decisão". */
  paraDecidir: readonly EntradaDaFila[]
  historicos: ReadonlyMap<string, HistoricoDaFicha>
  /** Pelo `opId` que se quer desfazer. */
  desfazeres: ReadonlyMap<string, SituacaoDoDesfazer>
  /** Falha ao guardar no navegador (cota do IndexedDB, base bloqueada): a mudança NÃO foi feita. */
  erroLocal: string | null
}

export type ResultadoDaEdicao =
  | { ok: true; ops: number }
  | { ok: false; motivo: 'sem-rede' | 'sem-permissao' }
  | { ok: false; motivo: 'recusada'; problemas: ProblemaNaFila[] }
  | { ok: false; motivo: 'erro-local'; detalhe: string }

/**
 * A escolha numa decisão: `ficar-com-a-atual` ("Ficar com 25" no conflito,
 * "Desfazer aqui" na negada; nada vai ao servidor); `reenviar` ("Usar a
 * minha", e "Somar o meu também" numa soma); `definir` (pôr um valor, como
 * o "Usar 28" de uma soma).
 */
export type EscolhaDaDecisao = { t: 'ficar-com-a-atual' } | { t: 'reenviar' } | { t: 'definir'; valor: Json }

export interface SessaoDaCampanha {
  estado(): EstadoDaCampanha
  /** As mudanças de `base` (a ficha de quando o Editar abriu) para `rascunho`, com a rev daquele momento. */
  mudarFicha(base: Personagem | null, rascunho: Personagem | null, baseRev: number): Promise<ResultadoDaEdicao>
  enviarMudancas(mudancas: readonly Mudanca[], baseRev: number): Promise<ResultadoDaEdicao>
  resolver(opId: string, escolha: EscolhaDaDecisao): Promise<ResultadoDaEdicao>
  /** `false` = sem canal agora (o botão fica desligado offline). */
  desfazer(opId: string, confirmar?: boolean): boolean
  /** A primeira página, ou a seguinte (`maisAntigas`). `false` = sem canal agora. */
  pedirHistorico(fichaId: string, maisAntigas?: boolean): boolean
  /** A rede voltou (evento `online`): tenta já, sem esperar a vez. */
  reconectarAgora(): void
  /** Um pedido do chat pelo mesmo canal. `false` = canal fora do ar ou ainda sem a base (o chat espera o `aoFicarEmDia`). */
  enviarDoChat(pedido: PedidoDoChat): boolean
  /** Um pedido do mural (M2) pelo mesmo canal; `false` como no `enviarDoChat` (o mural espera o `aoFicarEmDia`). */
  enviarDoMural(pedido: PedidoDoMural): boolean
  fechar(): void
}

/**
 * Uma parte do site que fala pelo MESMO canal da campanha, com estado
 * próprio (o chat da C2): recebe os frames dela, sabe quando o canal fica em
 * dia (para pedir o que perdeu) e quando cai. Manda pelo `enviarDoChat`.
 */
export interface ParteDoCanal {
  /** O canal recebeu a base (na abertura e em cada volta depois de uma queda). */
  aoFicarEmDia(): void
  aoReceber(mensagem: MensagemDoChatDoServidor): void
  aoCair(): void
}

/** O mural (M2) pelo mesmo canal, como o chat: recebe os `mural.*`, sabe quando o canal fica em dia e quando cai. */
export interface ParteDoMural {
  aoFicarEmDia(): void
  aoReceber(mensagem: MensagemDoMuralDoServidor): void
  aoCair(): void
}

export interface OpcoesDaSessao {
  fonte: FonteDoLobby
  campanhaId: string
  armazenamento: ArmazenamentoDaFila
  clienteId: string
  aoMudar(estado: EstadoDaCampanha): void
  /** O chat da campanha (C2); sem ele, frame `chat.*` é ignorado. */
  chat?: ParteDoCanal
  /** O mural da campanha (M2); sem ele, frame `mural.*` é ignorado. */
  mural?: ParteDoMural
  relogio?: Relogio
  novoId?: () => string
}

interface MetaDaFicha {
  visivel: Visibilidade
  ehMinha: boolean
  nomeDoDono: string | null
}

/** A mudança da op, sem o envelope nem o `atomico` (a op de "Usar a minha" vai sozinha). */
function mudancaDa(op: Op): Mudanca {
  const mudanca: Mudanca = { fichaId: op.fichaId, caminho: op.caminho, acao: op.acao }
  if (op.valor !== undefined) mudanca.valor = op.valor
  if (op.delta !== undefined) mudanca.delta = op.delta
  return mudanca
}

function textoDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : 'Não deu para guardar a mudança neste navegador'
}

export async function abrirSessaoDaCampanha(opcoes: OpcoesDaSessao): Promise<SessaoDaCampanha> {
  const fila = await criarFila(opcoes.armazenamento)
  return montarSessao(fila, opcoes)
}

function montarSessao(fila: Fila, opcoes: OpcoesDaSessao): SessaoDaCampanha {
  const { fonte, campanhaId, clienteId } = opcoes
  const relogio = opcoes.relogio ?? RELOGIO_DO_NAVEGADOR
  const novoId = opcoes.novoId ?? (() => crypto.randomUUID())

  let canal: Canal | null = null
  /** Cada canal aberto ganha um número: mensagem e fechamento de um canal velho não mexem no novo. */
  let geracao = 0
  let conexao: Conexao = 'conectando'
  let carregada = false
  /** Este canal já recebeu a primeira resposta do `ola`. */
  let sincronizada = false
  let tentativas = 0
  let encerrada = false
  let erroLocal: string | null = null
  let meta = new Map<string, MetaDaFicha>()
  let membros: MembroProjetado[] = []
  let eu: MembroProjetado | null = null
  let naMesa: PresencaNaMesa[] = []
  const emVoo = new Set<string>()
  const historicos = new Map<string, HistoricoDaFicha>()
  /** `fichaId` -> a página pedida (`antesDeRev`; `null` = a primeira). */
  const historicosPedidos = new Map<string, number | null>()
  const desfazeres = new Map<string, SituacaoDoDesfazer>()
  /** `novoOpId` do pedido de desfazer -> o `opId` que ele desfaz. */
  const alvoDoDesfazer = new Map<string, string>()
  let cancelarReconexao: (() => void) | null = null
  /** O prazo do lote em voo. */
  let cancelarPrazo: (() => void) | null = null
  /** O prazo do `ola` que pede o `estado` de novo (`pedirEstado`). */
  let cancelarPrazoDoEstado: (() => void) | null = null
  /** O lote parado pelo adiado da cabeça da fila: quando ela pode sair, e quem cancela a espera. */
  let adiadoDasOps: { vez: number; cancelar: () => void } | null = null
  /** Um reenvio por desfazer adiado (alvo -> quem cancela): o adiado de um nunca apaga o de outro, nem o do lote. */
  const adiadosDoDesfazer = new Map<string, () => void>()
  let processando: Promise<void> = Promise.resolve()

  function montarEstado(): EstadoDaCampanha {
    const negadas = new Set(fila.paraDecidir().filter((entrada) => entrada.situacao.t === 'negado').map((entrada) => entrada.op.fichaId))
    const fichas = [...fila.vistaLocal().values()].map((doc): FichaDoSite => {
      // Ficha que chegou por op (criada depois do `estado`) e ainda sem meta: só ver, até o próximo `estado`.
      const daFicha = meta.get(doc.id) ?? { visivel: 'mesa', ehMinha: eu?.papel === 'mestre', nomeDoDono: null }
      return { doc, ...daFicha, naoAceita: negadas.has(doc.id) }
    })
    return {
      campanhaId,
      conexao,
      carregada,
      rev: fila.revConfirmada(),
      fichas,
      membros,
      eu,
      naMesa,
      esperando: fila.esperando(),
      paraDecidir: fila.paraDecidir(),
      historicos: new Map(historicos),
      desfazeres: new Map(desfazeres),
      erroLocal,
    }
  }

  function publicar(): void {
    opcoes.aoMudar(montarEstado())
  }

  function podeEditar(): boolean {
    return conexao === 'em-dia' && carregada
  }

  // ── Canal ────────────────────────────────────────────────────────────────

  function pararPrazo(): void {
    cancelarPrazo?.()
    cancelarPrazo = null
  }

  function pararPrazoDoEstado(): void {
    cancelarPrazoDoEstado?.()
    cancelarPrazoDoEstado = null
  }

  /** Sem canal, os reenvios marcados não servem: a volta (`marcarSincronizada` e `enviarPendentes`) manda tudo de novo. */
  function pararAdiados(): void {
    adiadoDasOps?.cancelar()
    adiadoDasOps = null
    for (const cancelar of adiadosDoDesfazer.values()) cancelar()
    adiadosDoDesfazer.clear()
  }

  function conectar(): void {
    if (encerrada) return
    cancelarReconexao = null
    geracao += 1
    const minha = geracao
    sincronizada = false
    emVoo.clear()
    canal = fonte.abrirCanal(campanhaId, {
      aoAbrir: () => {
        if (minha === geracao) mandarOla()
      },
      aoReceber: (mensagem) => {
        processando = processando.then(() => (minha === geracao ? tratar(mensagem) : undefined)).catch(falhaLocal)
      },
      aoFechar: (motivo) => {
        if (minha === geracao) caiu(motivo)
      },
    })
  }

  function mandarOla(): void {
    canal?.enviar({ t: 'ola', desdeRev: carregada ? fila.revConfirmada() : null, v: VERSAO_DO_FORMATO, clienteId })
  }

  function caiu(motivo: MotivoDoFechamento): void {
    canal = null
    sincronizada = false
    emVoo.clear()
    pararPrazo()
    pararPrazoDoEstado()
    pararAdiados()
    if (encerrada) return
    opcoes.chat?.aoCair()
    opcoes.mural?.aoCair()
    if (motivo === 'sem-acesso') {
      conexao = 'sem-acesso'
      publicar()
      return
    }
    conexao = 'sem-rede'
    publicar()
    const espera = ESPERAS_DA_RECONEXAO_MS[Math.min(tentativas, ESPERAS_DA_RECONEXAO_MS.length - 1)]
    tentativas += 1
    cancelarReconexao = relogio.depois(espera, conectar)
  }

  /** Derruba o canal deste lado (prazo estourado, base divergente sem saída, falha local) e volta como numa queda. */
  function derrubar(): void {
    const atual = canal
    if (atual === null) return
    geracao += 1
    atual.fechar()
    caiu('rede')
  }

  function falhaLocal(erro: unknown): void {
    erroLocal = textoDoErro(erro)
    publicar()
    // O que não deu para guardar volta pelo `ola` seguinte: a fila só anda com o que gravou.
    derrubar()
  }

  /**
   * A base divergiu (op confirmada que não entra na base local) ou tem buraco:
   * pede o `estado` inteiro. Este é o segundo `ola` do canal, e o servidor o
   * deixa sem resposta quando a conta passou do ritmo (`responderAoRitmo` em
   * `lobby/nuvem/src/campanha.ts`). Sem `estado` nem `ops` no prazo, o canal
   * cai e volta: o primeiro `ola` do canal novo o ritmo não segura.
   */
  function pedirEstado(): void {
    sincronizada = false
    canal?.enviar({ t: 'ola', desdeRev: null, v: VERSAO_DO_FORMATO, clienteId })
    pararPrazoDoEstado()
    cancelarPrazoDoEstado = relogio.depois(PRAZO_DA_RESPOSTA_MS, () => {
      cancelarPrazoDoEstado = null
      if (!sincronizada) derrubar()
    })
  }

  function marcarSincronizada(): void {
    if (sincronizada) return
    sincronizada = true
    pararPrazoDoEstado()
    conexao = 'em-dia'
    tentativas = 0
    for (const [alvo, situacao] of desfazeres) {
      if (situacao.t === 'enviando') mandarDesfazer(alvo, situacao.novoOpId, situacao.confirmar)
    }
    for (const [fichaId, antesDeRev] of historicosPedidos) mandarHistorico(fichaId, antesDeRev)
    opcoes.chat?.aoFicarEmDia()
    opcoes.mural?.aoFicarEmDia()
  }

  // ── O que chega ──────────────────────────────────────────────────────────

  async function tratar(mensagem: MensagemDoSite): Promise<void> {
    // O chat tem estado próprio e não mexe na base: vai direto a ele, sem publicar a campanha.
    if (ehDoChat(mensagem)) {
      opcoes.chat?.aoReceber(mensagem)
      return
    }
    // O mural (M2) também: estado próprio, fora da base.
    if (ehDoMural(mensagem)) {
      opcoes.mural?.aoReceber(mensagem)
      return
    }
    switch (mensagem.t) {
      case 'estado':
        await receberEstado(mensagem)
        break
      case 'ops': {
        const resultado = await fila.receberRemotas(mensagem)
        if (resultado.t === 'buraco' || resultado.naoAplicaveis.length > 0) pedirEstado()
        else marcarSincronizada()
        break
      }
      case 'ack':
      case 'conflito':
      case 'negado':
      case 'adiado':
        await receberResposta(mensagem)
        break
      case 'aplicada':
        await receberAplicada(mensagem.op)
        break
      case 'historico':
        receberHistorico(mensagem.fichaId, mensagem.lista, mensagem.temMaisAntigas)
        break
      case 'versao':
        // Versão que o servidor não aceita mais: reconectar não resolve; a tela pede para recarregar.
        conexao = 'versao'
        geracao += 1
        canal?.fechar()
        canal = null
        pararPrazo()
        pararPrazoDoEstado()
        pararAdiados()
        opcoes.chat?.aoCair()
        opcoes.mural?.aoCair()
        break
      case 'presenca':
        naMesa = mensagem.naMesa
        break
    }
    publicar()
    enviarPendentes()
  }

  async function receberEstado(mensagem: Extract<MensagemDoServidor, { t: 'estado' }>): Promise<void> {
    const aceita = await fila.receberEstado({ rev: mensagem.rev, fichas: mensagem.fichas.map((ficha) => ficha.doc) })
    if (aceita) {
      meta = new Map(mensagem.fichas.map((ficha): [string, MetaDaFicha] => [ficha.doc.id, { visivel: ficha.visivel, ehMinha: ficha.ehMinha, nomeDoDono: ficha.nomeDoDono }]))
      membros = mensagem.membros
      eu = mensagem.eu
      carregada = true
    }
    marcarSincronizada()
  }

  async function receberResposta(resposta: RespostaDaOp): Promise<void> {
    if (receberRespostaDoDesfazer(resposta)) return
    await fila.receberRespostas([resposta])
    emVoo.delete(resposta.opId)
    if (emVoo.size === 0) pararPrazo()
    // O adiado fica na fila; quando o lote esvazia, `enviarPendentes` marca a volta pela cabeça da fila.
  }

  /** A op confirmada de qualquer um (a própria inclusive: o eco vale como ack). O buraco na numeração é op que este membro não vê. */
  async function receberAplicada(op: OpGravada): Promise<void> {
    const rev = fila.revConfirmada()
    if (op.rev > rev) {
      const resultado = await fila.receberRemotas({ desde: rev, ate: op.rev, lista: [op] })
      if (resultado.t === 'buraco' || resultado.naoAplicaveis.length > 0) pedirEstado()
    }
    emVoo.delete(op.opId)
    if (emVoo.size === 0) pararPrazo()
    anotarNoHistorico(op)
  }

  function receberRespostaDoDesfazer(resposta: RespostaDaOp): boolean {
    const alvo = alvoDoDesfazer.get(resposta.opId)
    if (alvo === undefined) return false
    if (resposta.t === 'adiado') {
      if (desfazeres.get(alvo)?.t === 'enviando') agendarDesfazer(alvo, resposta.tentarDepoisDe)
      return true
    }
    adiadosDoDesfazer.get(alvo)?.()
    adiadosDoDesfazer.delete(alvo)
    alvoDoDesfazer.delete(resposta.opId)
    if (resposta.t === 'ack') desfazeres.set(alvo, { t: 'feito', rev: resposta.rev })
    else if (resposta.t === 'conflito') desfazeres.set(alvo, { t: 'confirmar', conflito: resposta })
    else desfazeres.set(alvo, resposta.detalhe === undefined ? { t: 'negado', motivo: resposta.motivo } : { t: 'negado', motivo: resposta.motivo, detalhe: resposta.detalhe })
    return true
  }

  function receberHistorico(fichaId: string, lista: OpGravada[], temMaisAntigas: boolean): void {
    if (!historicosPedidos.has(fichaId)) return
    const pagina = historicosPedidos.get(fichaId)
    historicosPedidos.delete(fichaId)
    const anteriores = pagina === null ? [] : (historicos.get(fichaId)?.lista ?? [])
    historicos.set(fichaId, { lista: [...anteriores, ...lista], temMaisAntigas, carregando: false })
  }

  function anotarNoHistorico(op: OpGravada): void {
    const historico = historicos.get(op.fichaId)
    if (historico === undefined || historico.lista.some((linha) => linha.opId === op.opId)) return
    historicos.set(op.fichaId, { ...historico, lista: [op, ...historico.lista] })
  }

  function esperaAte(vez: number): number {
    return Math.max(0, vez - relogio.agora()) + FOLGA_DO_ADIADO_MS
  }

  /**
   * Quando a cabeça da fila adiada pode sair; `null` = não há cabeça adiada.
   * O lote para no primeiro pendente adiado (a ordem nunca troca, `paraEnviar`
   * do núcleo), então é ele, e não o último adiado que chegou, quem diz quando
   * tentar de novo.
   */
  function vezDaCabeca(agora: number): number | null {
    for (const entrada of fila.entradas()) {
      if (entrada.situacao.t !== 'pendente') continue
      const { tentarDepoisDe } = entrada.situacao
      return tentarDepoisDe !== undefined && tentarDepoisDe > agora ? tentarDepoisDe : null
    }
    return null
  }

  function agendarAsOps(vez: number): void {
    if (adiadoDasOps !== null && adiadoDasOps.vez === vez) return
    adiadoDasOps?.cancelar()
    const cancelar = relogio.depois(esperaAte(vez), () => {
      adiadoDasOps = null
      enviarPendentes()
    })
    adiadoDasOps = { vez, cancelar }
  }

  function agendarDesfazer(alvo: string, tentarDepoisDe: number): void {
    adiadosDoDesfazer.get(alvo)?.()
    adiadosDoDesfazer.set(
      alvo,
      relogio.depois(esperaAte(tentarDepoisDe), () => {
        adiadosDoDesfazer.delete(alvo)
        const situacao = desfazeres.get(alvo)
        // Fora de sincronia, `marcarSincronizada` manda os desfazeres a caminho quando a base chegar.
        if (sincronizada && situacao?.t === 'enviando') mandarDesfazer(alvo, situacao.novoOpId, situacao.confirmar)
      }),
    )
  }

  // ── O que sai ────────────────────────────────────────────────────────────

  function enviarPendentes(): void {
    if (!sincronizada || canal === null || emVoo.size > 0) return
    const agora = relogio.agora()
    const lote = fila.paraEnviar(agora)
    if (lote.length === 0) {
      const vez = vezDaCabeca(agora)
      if (vez !== null) agendarAsOps(vez)
      return
    }
    if (!canal.enviar({ t: 'ops', lote })) return
    for (const op of lote) emVoo.add(op.opId)
    pararPrazo()
    cancelarPrazo = relogio.depois(PRAZO_DA_RESPOSTA_MS, () => {
      cancelarPrazo = null
      if (emVoo.size > 0) derrubar()
    })
  }

  function mandarDesfazer(alvo: string, novoOpId: string, confirmar: boolean): void {
    alvoDoDesfazer.set(novoOpId, alvo)
    canal?.enviar(confirmar ? { t: 'desfazer', opId: alvo, novoOpId, confirmar: true } : { t: 'desfazer', opId: alvo, novoOpId })
  }

  function mandarHistorico(fichaId: string, antesDeRev: number | null): void {
    canal?.enviar(antesDeRev === null ? { t: 'historico', fichaId, limite: PAGINA_DO_HISTORICO } : { t: 'historico', fichaId, antesDeRev, limite: PAGINA_DO_HISTORICO })
  }

  /** O mesmo que o servidor confere (§6.4): o mestre escreve em tudo; o jogador, só nas fichas dele. Mandar sem poder seria violação. */
  function podeEscrever(mudancas: readonly Mudanca[]): boolean {
    if (eu?.papel === 'mestre') return true
    return mudancas.every((mudanca) => meta.get(mudanca.fichaId)?.ehMinha === true)
  }

  /** Grava na fila (só depois aparece como feita) e manda. */
  async function guardar(gravar: () => Promise<ResultadoNaFila>, quantas: number): Promise<ResultadoDaEdicao> {
    let resultado: ResultadoNaFila
    try {
      resultado = await gravar()
    } catch (erro) {
      erroLocal = textoDoErro(erro)
      publicar()
      return { ok: false, motivo: 'erro-local', detalhe: erroLocal }
    }
    erroLocal = null
    publicar()
    if (!resultado.ok) return { ok: false, motivo: 'recusada', problemas: resultado.problemas }
    enviarPendentes()
    return { ok: true, ops: quantas }
  }

  async function enviarMudancas(mudancas: readonly Mudanca[], baseRev: number): Promise<ResultadoDaEdicao> {
    if (!podeEditar()) return { ok: false, motivo: 'sem-rede' }
    if (mudancas.length === 0) return { ok: true, ops: 0 }
    if (!podeEscrever(mudancas)) return { ok: false, motivo: 'sem-permissao' }
    const loteId = novoId()
    const quandoCliente = relogio.agora()
    const ops = mudancas.map((mudanca): Op => ({ ...mudanca, opId: novoId(), loteId, baseRev, clienteId, quandoCliente }))
    return guardar(() => fila.acrescentar(ops), ops.length)
  }

  async function resolver(opId: string, escolha: EscolhaDaDecisao): Promise<ResultadoDaEdicao> {
    const entrada = fila.paraDecidir().find((decisao) => decisao.op.opId === opId)
    if (entrada === undefined) return { ok: false, motivo: 'recusada', problemas: [{ opId, motivo: 'sem-decisao', detalhe: 'Esta mudança não espera decisão' }] }
    // "Ficar com a atual" não manda nada: vale também sem rede.
    if (escolha.t === 'ficar-com-a-atual') return guardar(() => fila.resolver(opId), 0)
    if (!podeEditar()) return { ok: false, motivo: 'sem-rede' }
    const { op } = entrada
    const mudanca: Mudanca = escolha.t === 'reenviar' ? mudancaDa(op) : { fichaId: op.fichaId, caminho: op.caminho, acao: 'definir', valor: escolha.valor }
    // A base é a de agora: a pessoa decidiu vendo o valor atual (o `valorAtual` do conflito já está nela).
    const nova: Op = { ...mudanca, opId: novoId(), loteId: novoId(), baseRev: fila.revConfirmada(), clienteId, quandoCliente: relogio.agora(), resolve: opId }
    return guardar(() => fila.resolver(opId, nova), 1)
  }

  conectar()

  return {
    estado: montarEstado,
    async mudarFicha(base, rascunho, baseRev) {
      if (!podeEditar() || eu === null) return { ok: false, motivo: 'sem-rede' }
      return enviarMudancas(diferencas(base, rascunho, { papel: eu.papel }), baseRev)
    },
    enviarMudancas,
    resolver,
    desfazer(opId, confirmar = false) {
      if (!podeEditar()) return false
      const novoOpId = novoId()
      desfazeres.set(opId, { t: 'enviando', novoOpId, confirmar })
      mandarDesfazer(opId, novoOpId, confirmar)
      publicar()
      return true
    },
    pedirHistorico(fichaId, maisAntigas = false) {
      if (!podeEditar()) return false
      const atual = historicos.get(fichaId)
      const ultima = maisAntigas ? atual?.lista.at(-1) : undefined
      const antesDeRev = ultima === undefined ? null : ultima.rev
      historicos.set(fichaId, { lista: atual?.lista ?? [], temMaisAntigas: atual?.temMaisAntigas ?? false, carregando: true })
      historicosPedidos.set(fichaId, antesDeRev)
      mandarHistorico(fichaId, antesDeRev)
      publicar()
      return true
    },
    reconectarAgora() {
      if (conexao !== 'sem-rede' || cancelarReconexao === null) return
      cancelarReconexao()
      tentativas = 0
      conectar()
    },
    enviarDoChat(pedido) {
      if (!sincronizada || canal === null) return false
      return canal.enviar(pedido)
    },
    enviarDoMural(pedido) {
      if (!sincronizada || canal === null) return false
      return canal.enviar(pedido)
    },
    fechar() {
      encerrada = true
      conexao = 'fechada'
      geracao += 1
      cancelarReconexao?.()
      pararAdiados()
      pararPrazo()
      pararPrazoDoEstado()
      canal?.fechar()
      canal = null
    },
  }
}
