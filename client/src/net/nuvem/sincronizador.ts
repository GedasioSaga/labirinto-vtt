import { armazenamentoEmTexto, criarFila, type EntradaDaFila, type Fila, type RemotasRecebidas, type ResultadoNaFila } from '../../lib/nuvem/fila'
import type { Op } from '../../lib/nuvem/tipos'
import type { ParteDoAjuste, Personagem } from '../../lib/personagem'
import {
  acertarComAVista,
  aplicarNasFichasDoApp,
  avancarBase,
  baseDaGuardada,
  guardadaDaBase,
  mudancasEntreVistas,
  nuvemConhece,
  vistaComOps,
  type BaseDaNuvem,
} from './acertoDasFichas'
import { arquivoDaFila, type PastaNoDisco } from './discoDaNuvem'
import type { DestinoDoEmissor } from './emissor'
import {
  ARQUIVO_DAS_NEGADAS,
  criarDiario,
  estadoNovo,
  gravarBase,
  gravarEstado,
  lerBase,
  lerEstado,
  type CampanhaPublicada,
  type Diario,
  type EstadoDaCampanha,
} from './estadoNoDisco'
import { fichasComAsLinhas, linhasDasOpsDaNuvem, type LinhaDaNuvem } from './historicoDaNuvem'
import type { FalhaDaNuvem, PaginaDoDesde, PonteDaNuvem } from './ponte'

/**
 * O SINCRONIZADOR DO APP (docs/planos/lobby-jogadores-2026-11-05.md §5.5-5.7,
 * fatia A5), um por campanha publicada. A mesa nunca para: toda mudança do
 * mestre entra na `fila.jsonl` ANTES de qualquer rede, e o ciclo, quando há
 * rede, primeiro PUXA (`desde`, sempre ops, paginado) e depois ENVIA (lotes).
 *
 * Ordem das gravações ao receber ops confirmadas (cada uma sobrevive à queda
 * no meio da seguinte):
 *   1. o diário (cópia completa, só acrescenta; nunca fica com buraco);
 *   2. a fila (o eco da própria op vale como ack: a soma não dobra);
 *   3. o `base.json` (a base confirmada; a fila abre DELA, 8.1.1 item 3);
 *   4. o `estado.json` (`revRecebida`).
 * Depois a diferença da vista vai para as fichas abertas no editor (fora do
 * Ctrl+Z, sem reemitir) e, ~1 s depois, o gravador leve acerta o `rpg.json`.
 * Com a pasta fechada nesse meio-tempo, o mapa que abrir lê um `rpg.json`
 * atrasado: a cópia aberta é acertada com a vista na hora da abertura.
 *
 * O emissor é ligado antes de a fila abrir, e o que ele entrega enquanto isso
 * espera e entra na fila antes do acerto da reabertura.
 *
 * Tudo que mexe na fila, na base e nos arquivos passa por UMA cadeia (uma
 * coisa por vez, na ordem pedida). A rede fica fora dela: a mudança do mestre
 * nunca espera 15 s de um pedido lento para ir ao disco.
 */

/** Onde a nuvem toca o app: o editor e o `rpg.json`. Injetado (o teste não tem Tauri nem store). */
export interface AplicadorNoApp {
  /** As fichas da pasta aberta no editor, se for esta pasta. `ajustar` devolve `null` quando não há o que mudar. */
  ajustarPastaAberta(pastaId: string, ajustar: (personagens: readonly Personagem[]) => Personagem[] | null): void
  /** O gravador leve: lê o `rpg.json`, ajusta e grava na fila única da pasta. */
  gravarRpg(pastaId: string, ajustar: (personagens: readonly Personagem[]) => Personagem[] | null): Promise<void>
  /**
   * Avisa cada vez que um mapa desta pasta abre no editor, DEPOIS de a cópia
   * lida do `rpg.json` entrar nele (o `rpg.json` pode estar atrás da vista: a
   * calmaria do gravador leve, uma gravação que falhou). Devolve o cancelar.
   */
  aoAbrirAPasta(pastaId: string, aoAbrir: () => void): () => void
  /**
   * O nome do número na hora (HP, Força), pelo sistema da pasta, para a linha
   * do histórico da op de outro lugar (§4.1). Ausente, ou sem nome conhecido: a chave.
   */
  rotuloNoHistorico?(pastaId: string, ficha: Personagem, parte: ParteDoAjuste, chave: string): string
}

export type EstadoDaRede = 'conectando' | 'ok' | FalhaDaNuvem['t']

export interface SituacaoDoSincronizador {
  rede: EstadoDaRede
  /** O que a tela diz quando não está tudo bem; `null` = nada a dizer. */
  mensagem: string | null
  /** Quantas mudanças esperam o servidor ("3 esperando rede"). */
  esperando: number
  /** "Mudanças para decidir": conflitos e negadas, até alguém decidir. */
  paraDecidir: readonly EntradaDaFila[]
  revConfirmada: number
  ultimaSincronia: number | null
}

export interface DependenciasDoSincronizador {
  ponte: PonteDaNuvem
  pasta: PastaNoDisco
  app: AplicadorNoApp
  /**
   * Liga o emissor (A4) da pasta a este destino e devolve o desligar. O
   * sincronizador liga ANTES de ler a fila e de acertar o editor (a mudança do
   * mestre durante a abertura espera e entra na fila) e desliga ao fechar.
   */
  ligarEmissor(destino: DestinoDoEmissor): () => void
  /** A conta da sala é membro ativo do Lobby (só ela vira `autorDeclarado`). */
  ehMembro(contaId: string): boolean
  agora(): number
  novoId(): string
  /** Espera do gravador leve (~1 s). Devolve o cancelar. */
  agendar(fazer: () => void, ms: number): () => void
  aoMudar(situacao: SituacaoDoSincronizador): void
  /** Aviso vermelho: a mudança não foi guardada, o disco falhou. */
  avisar(mensagem: string): void
  /** Uma mudança local entrou na fila: o laço manda logo. */
  aoEnfileirar?(): void
}

export type ResultadoDoCiclo = { t: 'ok'; recebidas: number; enviadas: number; faltaEnviar: boolean } | FalhaDaNuvem

/**
 * As escolhas de "Mudanças para decidir" (§5.2, §5.6). No conflito: ficar com
 * a do outro (nada vai ao servidor) ou usar a minha (op nova que `resolve` a
 * recusada). Na negada: desfazer aqui (o campo volta ao do servidor) ou
 * guardar como nota (`negadas.jsonl`, nunca apagado).
 */
export type EscolhaDaDecisao = 'ficar-com-a-do-outro' | 'usar-a-minha' | 'desfazer-aqui' | 'guardar-como-nota'

export interface Sincronizador {
  readonly campanha: CampanhaPublicada
  /** O que o emissor (A4) usa; já ligado por `ligarEmissor` das dependências. */
  readonly destino: DestinoDoEmissor
  ciclo(): Promise<ResultadoDoCiclo>
  decidir(opId: string, escolha: EscolhaDaDecisao): Promise<ResultadoNaFila>
  situacao(): SituacaoDoSincronizador
  /** Espera tudo que já foi pedido ao disco (fila, base, `rpg.json`). */
  esvaziar(): Promise<void>
  fechar(): Promise<void>
}

export type AberturaDoSincronizador = { ok: true; sincronizador: Sincronizador } | { ok: false; motivo: string }

/** O gravador leve espera esta calmaria antes de regravar o `rpg.json` (§5.6). */
export const ESPERA_DO_GRAVADOR_LEVE_MS = 1000
/** Teto de páginas do `desde` num ciclo: o resto vem no próximo (o laço volta logo, `faltaEnviar`). */
const PAGINAS_POR_CICLO = 20
const LOTES_POR_CICLO = 10

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

/** Só a mudança de uma op (sem envelope), para refazê-la em "Usar a minha". */
function opDeUsarAMinha(op: Op, novoId: () => string, baseRev: number, agora: number): Op {
  const nova: Op = { opId: novoId(), loteId: novoId(), fichaId: op.fichaId, caminho: op.caminho, acao: op.acao, baseRev, clienteId: op.clienteId, quandoCliente: agora, resolve: op.opId }
  if (op.valor !== undefined) nova.valor = op.valor
  if (op.delta !== undefined) nova.delta = op.delta
  if (op.autorDeclarado !== undefined) nova.autorDeclarado = op.autorDeclarado
  return nova
}

/** Para onde o destino do emissor manda as ops depois de a fila abrir. */
interface Encaminhamento {
  receber(ops: readonly Op[]): void
  revConfirmada(): number
}

interface DestinoQueEspera {
  destino: DestinoDoEmissor
  /** A fila abriu: o que esperava vai para ela, na ordem, e o resto vai direto. */
  encaminhar(para: Encaminhamento): void
}

/**
 * O destino do emissor nasce ANTES da fila: ligado assim que o `clienteId` e a
 * rev confirmada são conhecidos, guarda o que o mestre mudar enquanto a fila
 * abre e o entrega a ela antes do acerto da reabertura. Sem isso, o acerto
 * desfazia a mudança no editor e no `rpg.json` sem ela nunca ter chegado à
 * nuvem. Até a fila abrir, a rev confirmada é a do `base.json` — a mesma com
 * que a fila abre.
 */
function destinoQueEspera(clienteId: string, rev: number, ehMembro: (contaId: string) => boolean): DestinoQueEspera {
  const guardadas: (readonly Op[])[] = []
  let para: Encaminhamento | null = null
  return {
    destino: {
      clienteId,
      revConfirmada: () => (para === null ? rev : para.revConfirmada()),
      ehMembro,
      receber: (ops) => {
        if (para === null) guardadas.push(ops)
        else para.receber(ops)
      },
    },
    encaminhar(novo) {
      para = novo
      for (const ops of guardadas.splice(0)) novo.receber(ops)
    },
  }
}

export async function abrirSincronizador(campanha: CampanhaPublicada, deps: DependenciasDoSincronizador): Promise<AberturaDoSincronizador> {
  const { pasta } = deps
  const lido = await lerEstado(pasta)
  if (lido !== null && (lido.campanhaId !== campanha.campanhaId || lido.pastaId !== campanha.pastaId)) {
    return { ok: false, motivo: `A pasta da nuvem de "${campanha.nome}" é de outra campanha: o Lobby não liga para não misturar as duas.` }
  }
  const guardada = await lerBase(pasta)
  if (guardada === null) return { ok: false, motivo: `A cópia da nuvem de "${campanha.nome}" (base.json) está danificada: o Lobby não liga para não gravar por cima.` }
  const base = baseDaGuardada(guardada)
  const estado: EstadoDaCampanha = { ...(lido ?? estadoNovo(campanha.campanhaId, campanha.pastaId, deps.novoId())), revRecebida: base.rev }
  const emEspera = destinoQueEspera(estado.clienteId, base.rev, (contaId) => deps.ehMembro(contaId))
  // O emissor liga já: a mudança do mestre enquanto a fila abre e o editor é acertado espera no destino, em vez de sumir no acerto.
  const desligarEmissor = deps.ligarEmissor(emEspera.destino)
  let fila: Fila
  try {
    // A base da fila é SÓ o que o servidor confirmou (8.1.1, item 3): o `base.json`, nunca o `rpg.json` (que já tem as pendentes).
    fila = await criarFila(armazenamentoEmTexto(arquivoDaFila(pasta)), { rev: base.rev, fichas: [...base.fichas.values()] })
    await gravarEstado(pasta, estado)
  } catch (erro) {
    desligarEmissor()
    throw erro
  }
  const sincronizador = montar(campanha, deps, { fila, base, estado, diario: criarDiario(pasta, base.rev), emEspera, desligarEmissor })
  await sincronizador.reabrir()
  return { ok: true, sincronizador }
}

interface Partes {
  fila: Fila
  base: BaseDaNuvem
  estado: EstadoDaCampanha
  diario: Diario
  emEspera: DestinoQueEspera
  desligarEmissor: () => void
}

function montar(campanha: CampanhaPublicada, deps: DependenciasDoSincronizador, partes: Partes): Sincronizador & { reabrir(): Promise<void> } {
  const { fila, diario } = partes
  const { pasta } = deps
  const { pastaId } = campanha
  let base = partes.base
  let estado = partes.estado
  let rede: EstadoDaRede = 'conectando'
  let mensagem: string | null = null
  let ultimaSincronia: number | null = null
  let fechado = false

  // ── Uma coisa por vez ─────────────────────────────────────────────────────
  let cadeia: Promise<unknown> = Promise.resolve()
  function emOrdem<T>(passo: () => Promise<T>): Promise<T> {
    const resultado = cadeia.then(passo)
    cadeia = resultado.catch(() => undefined)
    return resultado
  }

  function situacao(): SituacaoDoSincronizador {
    return { rede, mensagem, esperando: fila.esperando(), paraDecidir: fila.paraDecidir(), revConfirmada: fila.revConfirmada(), ultimaSincronia }
  }
  const notificar = (): void => deps.aoMudar(situacao())

  // ── A vista que o app deve mostrar ────────────────────────────────────────
  /**
   * As ops que o emissor entregou e cuja vez na cadeia ainda não chegou: já
   * estão no editor (o funil aplica e só então entrega), então o acerto com a
   * vista as conta — senão as desfaria. Saem daqui quando a vez delas começa.
   */
  const aCaminho: (readonly Op[])[] = []
  /** Um passo da cadeia está mudando a vista e a diferença ainda não chegou ao editor. */
  let vistaMudando = false
  /** A pasta abriu no meio desse passo: o acerto vem logo depois da diferença. */
  let acertoAdiado = false
  const conhece = (fichaId: string): boolean => nuvemConhece(base, fichaId)

  function vistaEsperada(): ReadonlyMap<string, Personagem> {
    const vista = fila.vistaLocal()
    return aCaminho.length === 0 ? vista : vistaComOps(vista, aCaminho.flat())
  }

  /** A cópia aberta no editor passa a ser a vista (idempotente). `true` = estava atrás. */
  function acertarAgora(): boolean {
    const vista = vistaEsperada()
    let estavaAtras = false
    deps.app.ajustarPastaAberta(pastaId, (personagens) => {
      const acertadas = acertarComAVista(personagens, vista, conhece)
      estavaAtras = acertadas !== null
      return acertadas
    })
    return estavaAtras
  }

  /**
   * Um mapa desta pasta abriu com o que estava no `rpg.json`, que pode estar
   * atrás da vista. Acertar AGORA, antes de o mestre mexer: a op dele sairia
   * calculada sobre o valor velho com a rev de agora, e o servidor não veria
   * conflito. Estando atrás, o gravador leve acerta o `rpg.json` também (a
   * gravação que falhou volta aqui).
   */
  function acertarAoAbrir(): void {
    if (fechado) return
    // No meio de um passo a vista pode já ter mudado sem a diferença chegar ao editor: acertar e depois levar a diferença somaria duas vezes.
    if (vistaMudando) acertoAdiado = true
    else if (acertarAgora()) agendarRpg()
  }

  /** Um passo que muda a vista (nunca um dentro do outro): `aoTerminar` leva a diferença ao app, e o acerto adiado vem depois dela. */
  async function mudandoAVista<T>(passo: () => Promise<T>, aoTerminar: () => void): Promise<T> {
    vistaMudando = true
    try {
      return await passo()
    } finally {
      aoTerminar()
      vistaMudando = false
      if (acertoAdiado) {
        acertoAdiado = false
        if (acertarAgora()) agendarRpg()
      }
    }
  }

  // ── O rpg.json (gravador leve) ────────────────────────────────────────────
  let cancelarGravador: (() => void) | null = null
  let gravacaoDoRpg: Promise<void> = Promise.resolve()
  /** As linhas do histórico das ops de outro lugar que o editor já tem e o `rpg.json` ainda não (`levarAoHistorico`). */
  let linhasParaORpg: readonly LinhaDaNuvem[] = []

  function gravarRpgAgora(): Promise<void> {
    const vista = vistaEsperada()
    const rev = fila.revConfirmada()
    const anterior = gravacaoDoRpg
    gravacaoDoRpg = anterior.then(async () => {
      // As linhas do histórico que esperam (as de uma gravação que falhou também), lidas na vez desta: saem da espera só depois de gravadas.
      const linhas = linhasParaORpg
      try {
        await deps.app.gravarRpg(pastaId, (personagens) => {
          const acertadas = acertarComAVista(personagens, vista, conhece)
          return fichasComAsLinhas(acertadas ?? personagens, linhas) ?? acertadas
        })
        linhasParaORpg = linhasParaORpg.filter((linha) => !linhas.includes(linha))
        // Dentro da cadeia: o `estado` também muda ao receber ops (a `revRecebida`), e uma cópia velha voltaria atrás.
        await emOrdem(async () => {
          if (rev <= estado.revNoRpg) return
          estado = { ...estado, revNoRpg: rev }
          await gravarEstado(pasta, estado)
        })
      } catch (erro) {
        deps.avisar(`Não deu para atualizar os personagens da pasta com o Lobby: ${motivo(erro)}. As mudanças estão guardadas na fila e voltam na próxima vez.`)
      }
    })
    return gravacaoDoRpg
  }

  function agendarRpg(): void {
    if (fechado) return
    cancelarGravador?.()
    cancelarGravador = deps.agendar(() => {
      cancelarGravador = null
      void gravarRpgAgora()
    }, ESPERA_DO_GRAVADOR_LEVE_MS)
  }

  /** A diferença da vista entra nas fichas abertas e, depois, no `rpg.json`. */
  function levarAoApp(antes: ReadonlyMap<string, Personagem>, depois: ReadonlyMap<string, Personagem>): void {
    const mudancas = mudancasEntreVistas(antes, depois)
    if (mudancas.length === 0) return
    deps.app.ajustarPastaAberta(pastaId, (personagens) => aplicarNasFichasDoApp(personagens, mudancas))
    agendarRpg()
  }

  function comVista<T>(passo: () => Promise<T>): Promise<T> {
    const antes = fila.vistaLocal()
    return mudandoAVista(passo, () => levarAoApp(antes, fila.vistaLocal()))
  }

  // ── O histórico das ops de outro lugar (§4.1) ─────────────────────────────
  function rotuloNoHistorico(ficha: Personagem, parte: ParteDoAjuste, chave: string): string {
    // Sem quem dê o nome (o teste, a pasta fechada no app), a chave: o mesmo que `rotuloDaParte` faz sem nome conhecido.
    return deps.app.rotuloNoHistorico?.(pastaId, ficha, parte, chave) ?? chave
  }

  /** A linha de cada op numérica de outro lugar: no editor agora (fora do Ctrl+Z, sem reemitir) e no `rpg.json` pelo gravador leve. */
  function levarAoHistorico(linhas: readonly LinhaDaNuvem[]): void {
    if (linhas.length === 0) return
    deps.app.ajustarPastaAberta(pastaId, (personagens) => fichasComAsLinhas(personagens, linhas))
    linhasParaORpg = [...linhasParaORpg, ...linhas]
    agendarRpg()
  }

  // ── Mudança local (o emissor) ─────────────────────────────────────────────
  async function receberLocais(ops: readonly Op[]): Promise<void> {
    // Daqui em diante é a fila que as conta (ou o desfazer abaixo, se ela recusar).
    const posicao = aCaminho.indexOf(ops)
    if (posicao !== -1) aCaminho.splice(posicao, 1)
    const antes = fila.vistaLocal()
    let problema: string | null = null
    await mudandoAVista(
      async () => {
        try {
          const resultado = await fila.acrescentar(ops)
          if (!resultado.ok) problema = resultado.problemas.map((p) => p.detalhe).join('; ')
        } catch (erro) {
          problema = `o disco recusou (${motivo(erro)})`
        }
      },
      () => {
        if (problema === null) {
          agendarRpg()
          deps.aoEnfileirar?.()
        } else {
          // A mudança não aparece como feita (§5.7, disco cheio): volta no editor e no `rpg.json`.
          levarAoApp(vistaComOps(antes, ops), antes)
          deps.avisar(`O Lobby não guardou esta mudança: ${problema}. A ficha voltou como estava.`)
        }
      },
    )
    notificar()
  }

  const { destino } = partes.emEspera

  // ── Ops confirmadas (o desde) ─────────────────────────────────────────────
  async function receberPagina(pagina: PaginaDoDesde): Promise<boolean> {
    const remotas: RemotasRecebidas = { desde: pagina.desde, ate: pagina.ate, lista: pagina.lista }
    const avanco = avancarBase(base, remotas)
    if (avanco.t === 'buraco') return false
    // Sobre a base de ANTES: o de → para de cada linha é o que o servidor gravou.
    const doHistorico = linhasDasOpsDaNuvem(base, avanco.novas, estado.clienteId, rotuloNoHistorico)
    await diario.acrescentar(avanco.novas)
    const recebidas = await comVista(() => fila.receberRemotas(remotas))
    if (recebidas.t === 'buraco') return false
    levarAoHistorico(doHistorico)
    if (recebidas.naoAplicaveis.length > 0) mensagem = 'Uma mudança do servidor não coube na cópia deste computador: confira a ficha no site.'
    const andou = avanco.base.rev !== base.rev || avanco.novas.length > 0
    base = avanco.base
    if (andou) await gravarBase(pasta, guardadaDaBase(base))
    if (base.rev !== estado.revRecebida) {
      estado = { ...estado, revRecebida: base.rev }
      await gravarEstado(pasta, estado)
    }
    return true
  }

  function falhou(falha: FalhaDaNuvem): ResultadoDoCiclo {
    rede = falha.t
    mensagem = falha.detalhe
    notificar()
    return falha
  }

  async function puxar(): Promise<{ t: 'ok'; recebidas: number } | FalhaDaNuvem> {
    let recebidas = 0
    for (let pagina = 0; pagina < PAGINAS_POR_CICLO; pagina += 1) {
      // A página pedida a partir da rev de agora; só este ciclo anda a rev.
      const resposta = await deps.ponte.desde(campanha.campanhaId, fila.revConfirmada())
      if (resposta.t !== 'ok') return resposta
      if (!(await emOrdem(() => receberPagina(resposta)))) return { t: 'erro', detalhe: 'O servidor mandou mudanças fora de ordem' }
      recebidas += resposta.lista.length
      if (resposta.lista.length === 0 || resposta.ate >= resposta.revAtual) break
    }
    return { t: 'ok', recebidas }
  }

  async function enviar(): Promise<{ t: 'ok'; enviadas: number } | FalhaDaNuvem> {
    let enviadas = 0
    for (let vez = 0; vez < LOTES_POR_CICLO; vez += 1) {
      // As mudanças que o emissor acabou de mandar entram antes de escolher o lote.
      await emOrdem(async () => undefined)
      const lote = fila.paraEnviar(deps.agora())
      if (lote.length === 0) break
      const resposta = await deps.ponte.enviarOps(campanha.campanhaId, estado.clienteId, lote)
      if (resposta.t !== 'ok') return resposta
      await emOrdem(() => comVista(() => fila.receberRespostas(resposta.respostas)))
      enviadas += lote.length
      // Sem resposta para a primeira do lote: mandar de novo agora só repetiria. Fica para o próximo ciclo.
      const primeira = fila.entradas().find((entrada) => entrada.op.opId === lote[0].opId)
      if (primeira !== undefined && primeira.situacao.t === 'pendente' && primeira.situacao.tentarDepoisDe === undefined) break
    }
    return { t: 'ok', enviadas }
  }

  let cicloEmCurso: Promise<ResultadoDoCiclo> | null = null

  async function rodarCiclo(): Promise<ResultadoDoCiclo> {
    try {
      // Na volta da rede: primeiro puxa, depois envia em ordem (§5.6).
      const puxado = await puxar()
      if (puxado.t !== 'ok') return falhou(puxado)
      const enviado = await enviar()
      if (enviado.t !== 'ok') return falhou(enviado)
      await emOrdem(() => fila.compactarSePreciso())
      rede = 'ok'
      if (mensagem !== null && !mensagem.startsWith('Uma mudança do servidor')) mensagem = null
      ultimaSincronia = deps.agora()
      notificar()
      return { t: 'ok', recebidas: puxado.recebidas, enviadas: enviado.enviadas, faltaEnviar: fila.paraEnviar(deps.agora()).length > 0 }
    } catch (erro) {
      // Falha do disco no meio (diário, base): nada andou além do que foi gravado; o próximo ciclo pega de onde parou.
      return falhou({ t: 'erro', detalhe: `Não deu para guardar o que veio do Lobby: ${motivo(erro)}` })
    }
  }

  async function decidirAgora(opId: string, escolha: EscolhaDaDecisao): Promise<ResultadoNaFila> {
    const entrada = fila.paraDecidir().find((candidata) => candidata.op.opId === opId)
    if (entrada === undefined) return { ok: false, problemas: [{ opId, motivo: 'sem-decisao', detalhe: 'Esta mudança não espera decisão' }] }
    const { situacao: situacaoDaEntrada, op } = entrada
    if (escolha === 'usar-a-minha') {
      if (situacaoDaEntrada.t !== 'conflito') return { ok: false, problemas: [{ opId, motivo: 'sem-decisao', detalhe: '"Usar a minha" só vale no conflito' }] }
      return fila.resolver(opId, opDeUsarAMinha(op, deps.novoId, fila.revConfirmada(), deps.agora()))
    }
    if (escolha === 'guardar-como-nota') {
      if (situacaoDaEntrada.t !== 'negado') return { ok: false, problemas: [{ opId, motivo: 'sem-decisao', detalhe: '"Guardar como nota" só vale na mudança recusada' }] }
      const nota = { opId, op, motivo: situacaoDaEntrada.motivo, detalhe: situacaoDaEntrada.detalhe ?? null, quando: deps.agora() }
      await pasta.acrescentar(ARQUIVO_DAS_NEGADAS, `${JSON.stringify(nota)}\n`)
    }
    return fila.resolver(opId)
  }

  // A fila abriu: o que o mestre mudou durante a abertura entra nela antes do acerto da reabertura.
  partes.emEspera.encaminhar({
    revConfirmada: () => fila.revConfirmada(),
    receber: (ops) => {
      if (fechado) return
      aCaminho.push(ops)
      void emOrdem(() => receberLocais(ops))
    },
  })
  const pararDeOuvirAberturas = deps.app.aoAbrirAPasta(pastaId, acertarAoAbrir)

  return {
    campanha,
    destino,
    situacao,
    async reabrir() {
      // Ao abrir: o editor e o `rpg.json` acertados com a vista (base confirmada + pendentes + o que chegou do emissor na abertura); os conflitos voltam à lista.
      acertarAgora()
      await gravarRpgAgora()
      notificar()
    },
    ciclo() {
      if (fechado) return Promise.resolve({ t: 'erro', detalhe: 'O Lobby desta campanha foi desligado' })
      if (cicloEmCurso === null) {
        cicloEmCurso = rodarCiclo().finally(() => {
          cicloEmCurso = null
        })
      }
      return cicloEmCurso
    },
    async decidir(opId, escolha) {
      const resultado = await emOrdem(() => comVista(() => decidirAgora(opId, escolha)))
      notificar()
      if (resultado.ok && escolha === 'usar-a-minha') deps.aoEnfileirar?.()
      return resultado
    },
    async esvaziar() {
      await emOrdem(async () => undefined)
      await gravacaoDoRpg
    },
    async fechar() {
      // Primeiro o emissor e a escuta: nenhuma mudança nova e nenhum acerto entram daqui em diante.
      partes.desligarEmissor()
      pararDeOuvirAberturas()
      if (cancelarGravador !== null) {
        cancelarGravador()
        cancelarGravador = null
        // O que esperava a calmaria vai agora: fechar não perde a última mudança no `rpg.json`.
        await gravarRpgAgora()
      }
      fechado = true
      await cicloEmCurso?.catch(() => undefined)
      await emOrdem(async () => undefined)
      await gravacaoDoRpg
    },
  }
}
