import { processarDesfazer } from '../../lib/nuvem/desfazer'
import type { Json } from '../../lib/nuvem/json'
import type { Cota } from '../../lib/nuvem/limites'
import { processarLote, type Gravacoes, type LeitorDaCampanha, type ResultadoDoProcessamento } from '../../lib/nuvem/lote'
import { fichaNoEstado, partesDoLivroPublicado, projetarMembros, projetarOpParaJogador, sistemaDoJogador } from '../../lib/nuvem/projecao'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { CONTA_DO_MESTRE, type FichaGuardada, type FichaNoEstado, type Identidade, type Membro, type MensagemDoServidor, type Op, type OpGravada, type Origem, type PresencaNaMesa, type Recusada } from '../../lib/nuvem/tipos'
import { criarChatDaDemo, type ChatDaDemo } from './chatDaDemo'
import { campanhasDaDemo, EMAIL_DA_DEMO, type CampanhaDaDemo, type MudancaAntiga } from './dadosDaDemo'
import type { DueloDaDemo, OpcoesDoDueloDaDemo } from './dueloDaDemo'
import { criarMuralDaDemo, type MuralDaDemo } from './muralDaDemo'
import {
  ehPedidoDoChat,
  ehPedidoDoDuelo,
  ehPedidoDoMural,
  RELOGIO_DO_NAVEGADOR,
  type Canal,
  type EstadoComSala,
  type FonteDoLobby,
  type MensagemDoSite,
  type OuvinteDoCanal,
  type PedidoDoSite,
  type Relogio,
  type RespostaDoBilhete,
  type SalaDaMesa,
} from './fonte'
import { lerMensagemDoServidor } from './mensagens'

/**
 * A FONTE DEMO (`?demo=1`): o site inteiro com dados inventados, sem login e
 * sem rede. Um servidor de mentira no próprio navegador, que responde pelo
 * MESMO núcleo do servidor de verdade (`processarLote`, `processarDesfazer`,
 * a projeção do jogador): conflito, negado, desfazer e histórico se comportam
 * como no Lobby. Cada mensagem dá a volta pelo JSON e pelo mesmo leitor do
 * fio da fonte real, com um atraso pequeno, para a tela ver o "Enviando".
 * Recarregar a página volta tudo ao começo.
 */

/** O atraso de cada mensagem, nos dois sentidos. */
export const LATENCIA_DA_DEMO_MS = 350
/** Acima disto, o `ola` recebe o `estado` em vez das ops (§5.4). */
const LIMITE_SEM_SNAPSHOT = 1_000
const MINUTO_MS = 60_000

export interface FonteDaDemo extends FonteDoLobby {
  /** O botão de dev "simular mestre mudou": o mestre (no app) põe `valor` no campo agora. `false` = o servidor não aceitou. */
  simularMudancaDoMestre(campanhaId: string, fichaId: string, caminho: string[], valor: Json): boolean
  /** O atalho "ver o mural como o mestre" (M2): o mural desta mesa passa a responder como se o mestre estivesse na página. */
  verMuralComoMestre(campanhaId: string, comoMestre: boolean): void
}

interface CampanhaEmMemoria extends LeitorDaCampanha {
  readonly campanhaId: string
  readonly nome: string
  gravar(gravacoes: Gravacoes): void
  todasAsOps(): readonly OpGravada[]
  todasAsFichas(): FichaGuardada[]
  todosOsMembros(): Membro[]
}

/** O DO em memória: lê como o SQLite e grava as `Gravacoes` de uma vez (o `transactionSync`). */
function campanhaEmMemoria(dados: CampanhaDaDemo): CampanhaEmMemoria {
  const fichas = new Map(dados.fichas.map((guardada): [string, FichaGuardada] => [guardada.doc.id, guardada]))
  const membros = new Map(dados.membros.map((membro): [string, Membro] => [membro.contaId, membro]))
  const ops: OpGravada[] = []
  const recusadas = new Map<string, Recusada>()
  const cotas = new Map<string, Cota>()
  return {
    campanhaId: dados.campanhaId,
    nome: dados.nome,
    revAtual: () => ops.at(-1)?.rev ?? 0,
    ficha: (fichaId) => fichas.get(fichaId),
    opGravada: (opId) => ops.find((op) => op.opId === opId),
    recusada: (opId) => recusadas.get(opId),
    opsDaFicha: (fichaId, depoisDe) => ops.filter((op) => op.fichaId === fichaId && op.rev > depoisDe),
    desfeitasDe: (opId) => ops.filter((op) => op.desfaz === opId),
    membro: (contaId) => membros.get(contaId),
    cota: (chave) => cotas.get(chave),
    gravar(gravacoes) {
      ops.push(...gravacoes.ops)
      for (const recusada of gravacoes.recusadas) recusadas.set(recusada.opId, recusada)
      for (const guardada of gravacoes.fichas) fichas.set(guardada.doc.id, guardada)
      for (const { chave, cota } of gravacoes.cotas) cotas.set(chave, cota)
    },
    todasAsOps: () => ops,
    todasAsFichas: () => [...fichas.values()],
    todosOsMembros: () => [...membros.values()],
  }
}

function identidadeDe(membro: Membro, origem: Origem, clienteId: string): Identidade {
  return { email: membro.email, contaId: membro.contaId, nome: membro.nome, papel: membro.papel, origem, clienteId }
}

function membroPorEmail(campanha: CampanhaEmMemoria, email: string): Membro | undefined {
  return campanha.todosOsMembros().find((membro) => membro.email === email && membro.estado === 'ativo')
}

/** O histórico que já existia quando a página abriu, gravado pelo mesmo núcleo (com `antes`, autor e hora). */
function semear(campanha: CampanhaEmMemoria, antigas: readonly MudancaAntiga[], agora: number): void {
  antigas.forEach((antiga, i) => {
    const membro = campanha.membro(antiga.quem)
    if (membro === undefined) throw new Error(`demo: ${antiga.quem} não é membro de ${campanha.campanhaId}`)
    const quando = agora - antiga.minutosAtras * MINUTO_MS
    const origem: Origem = membro.papel === 'mestre' ? 'app' : 'site'
    const quem = identidadeDe(membro, origem, `cli_demo_${membro.contaId}`)
    const op: Op = {
      opId: `antiga_${campanha.campanhaId}_${i}`,
      loteId: `antiga_${campanha.campanhaId}_${i}`,
      fichaId: antiga.fichaId,
      caminho: antiga.caminho,
      acao: antiga.acao,
      baseRev: campanha.revAtual(),
      clienteId: quem.clienteId,
      quandoCliente: quando,
    }
    if (antiga.valor !== undefined) op.valor = antiga.valor
    if (antiga.delta !== undefined) op.delta = antiga.delta
    campanha.gravar(processarLote(campanha, quem, [op], quando).gravacoes)
  })
}

/** As ops como este membro as vê (§6.4): o jogador não recebe o que é do mestre. */
function projetarOps(campanha: CampanhaEmMemoria, membro: Membro, ops: readonly OpGravada[]): OpGravada[] {
  if (membro.papel === 'mestre') return [...ops]
  return ops.flatMap((op) => {
    const projetada = projetarOpParaJogador(op, campanha.ficha(op.fichaId)?.visivel ?? 'mestre')
    return projetada === null ? [] : [projetada]
  })
}

/**
 * A sala que o mestre "abriu no app" (B6), só na mesa em que ele está no app
 * (`PRESENCA_DA_DEMO`): o código e os endereços inventados, na forma exata
 * que o DO aceita. A demo nunca navega para eles: o "Entrar na mesa agora"
 * daqui abre a aba e conta nela o que a de verdade faria.
 */
const SALA_DA_DEMO: Readonly<Record<string, SalaDaMesa>> = {
  'rota-das-ilhas': {
    codigo: 'K7Q2MX',
    enderecos: [
      { tipo: 'lan', url: 'http://192.168.0.12:7777/player' },
      { tipo: 'tunel', url: 'https://mare-alta-sem-farol.trycloudflare.com/player' },
    ],
  },
}

/** As mesas da demo são de One Piece: o `estado` leva o sistema como o DO o leva (F1), pela mesma projeção, e o livro vem sob pedido. */
const SISTEMA_DA_DEMO = sistemaDoJogador(SISTEMA_ONE_PIECE)
const LIVRO_DA_DEMO = partesDoLivroPublicado(SISTEMA_ONE_PIECE)

/** O convite da demo: a forma do de verdade (`v1.<payload>.<assinatura>`), sem assinatura de verdade. */
const BILHETE_DA_DEMO = 'v1.ZGVtbw.ZGVtbw'

function estadoPara(campanha: CampanhaEmMemoria, membro: Membro): EstadoComSala {
  const nomeDaConta = (contaId: string): string | null => campanha.membro(contaId)?.nome ?? null
  const fichas = campanha.todasAsFichas().flatMap((guardada): FichaNoEstado[] => {
    const naTela = fichaNoEstado(membro, guardada, nomeDaConta)
    return naTela === null ? [] : [naTela]
  })
  const { contaId, nome, papel } = membro
  const sala = SALA_DA_DEMO[campanha.campanhaId] ?? null
  const estado: EstadoComSala = { t: 'estado', rev: campanha.revAtual(), fichas, membros: projetarMembros(campanha.todosOsMembros()), eu: { contaId, nome, papel }, sala }
  if (SISTEMA_DA_DEMO !== null) {
    estado.sistema = SISTEMA_DA_DEMO.sistema
    estado.marcaDoSistema = SISTEMA_DA_DEMO.marca
    if (SISTEMA_DA_DEMO.livro !== null) estado.livro = SISTEMA_DA_DEMO.livro
  }
  return estado
}

/**
 * Quem mais está "na mesa agora" em cada mesa da demo (inventado; o lobby da H1 tem gente para mostrar): onde o
 * mestre está, os colegas que já estão no site e um que chega com a página aberta (a presença nova entra na tela).
 */
interface PresencaDaDemo {
  mestreNo: PresencaNaMesa['onde']
  colegas: readonly string[]
  chega?: { contaId: string; depoisDeMs: number }
}

const PRESENCA_DA_DEMO: Readonly<Record<string, PresencaDaDemo>> = {
  'rota-das-ilhas': { mestreNo: 'app', colegas: ['conta_caio'], chega: { contaId: 'conta_duda', depoisDeMs: 8_000 } },
  'mar-de-cobre': { mestreNo: 'site', colegas: ['conta_mel'] },
}

/** "Na mesa agora": o mestre, os colegas inventados da mesa e quem está vendo, no site. `comQuemChegou` = depois da chegada. */
function presencaPara(campanha: CampanhaEmMemoria, membro: Membro, comQuemChegou: boolean): MensagemDoServidor {
  const inventada = PRESENCA_DA_DEMO[campanha.campanhaId] ?? { mestreNo: 'site', colegas: [] }
  const presente = (contaId: string, onde: PresencaNaMesa['onde']): PresencaNaMesa[] => {
    const quem = campanha.membro(contaId)
    return quem === undefined || quem.contaId === membro.contaId ? [] : [{ contaId: quem.contaId, nome: quem.nome, papel: quem.papel, onde }]
  }
  const naMesa: PresencaNaMesa[] = [
    ...presente(CONTA_DO_MESTRE, inventada.mestreNo),
    ...inventada.colegas.flatMap((contaId) => presente(contaId, 'site')),
    { contaId: membro.contaId, nome: membro.nome, papel: membro.papel, onde: 'site' },
    ...(comQuemChegou && inventada.chega !== undefined ? presente(inventada.chega.contaId, 'site') : []),
  ]
  return { t: 'presenca', naMesa }
}

interface ServidorDaDemo {
  campanhas: Map<string, CampanhaEmMemoria>
  /** O chat de cada mesa (C2), com as conversas inventadas. */
  chats: Map<string, ChatDaDemo>
  /** Os canais abertos, para a difusão do `aplicada` (inclusive a mudança simulada do mestre). */
  abertos: Set<(campanhaId: string, ops: readonly OpGravada[]) => void>
  /** O mural de cada mesa (M2), com as notícias inventadas. */
  murais: Map<string, MuralDaDemo>
  /** As mesas cujo mural responde como o mestre (o atalho da demo). */
  comoMestre: Set<string>
  /** Os canais abertos, para mandar o `mural.estado` de novo quando a vista do mural muda. */
  muraisAbertos: Set<(campanhaId: string) => void>
  /** O duelo de cada mesa (T7), com o colega inventado que aceita, joga e cai da conexão uma vez; carregado na primeira vez que a mesa o usa. */
  duelos: Map<string, () => Promise<DueloDaDemo>>
}

/**
 * O duelo da demo só baixa quando a mesa o usa (o `ola`, um `duelo.*`): a regra
 * do duelo e o motor da batalha ficam fora do JS da entrada, como o treino
 * (`Site.tsx`). Um só por mesa: a mesma promessa para todo mundo que pedir.
 */
function dueloSobDemanda(opcoes: OpcoesDoDueloDaDemo): () => Promise<DueloDaDemo> {
  let carregando: Promise<DueloDaDemo> | null = null
  return () => {
    carregando ??= import('./dueloDaDemo').then(({ criarDueloDaDemo }) => criarDueloDaDemo(opcoes))
    return carregando
  }
}

/** Quem fala com o mural: quem vê a demo, ou o mestre quando o atalho "ver como o mestre" está ligado. */
function quemNoMural(servidor: ServidorDaDemo, campanha: CampanhaEmMemoria, membro: Membro): Membro {
  if (!servidor.comoMestre.has(campanha.campanhaId)) return membro
  return campanha.membro(CONTA_DO_MESTRE) ?? membro
}

function abrirCanalDaDemo(servidor: ServidorDaDemo, campanhaId: string, ouvinte: OuvinteDoCanal, relogio: Relogio): Canal {
  const campanha = servidor.campanhas.get(campanhaId)
  const membro = campanha === undefined ? undefined : membroPorEmail(campanha, EMAIL_DA_DEMO)
  let aberto = false
  let encerrado = false
  let clienteId = 'cli_demo_sem_ola'
  /** O colega inventado que chega com a página aberta já chegou (ou já está marcado para chegar) neste canal. */
  let chegadaMarcada = false
  let chegou = false
  /** O canal ouvindo o duelo da mesa (o que o colega inventado faz sozinho); `null` antes do primeiro `ola`. */
  let pararDeOuvirODuelo: (() => void) | null = null

  function encerrar(): void {
    encerrado = true
    aberto = false
    servidor.abertos.delete(difundir)
    servidor.muraisAbertos.delete(reenviarMural)
    pararDeOuvirODuelo?.()
    pararDeOuvirODuelo = null
  }
  /** A lista dos duelos como o DO manda depois de cada `ola` (`duelosNoOla`), e daí em diante o que o colega fizer. */
  function mandarDuelos(): void {
    const carregar = servidor.duelos.get(campanhaId)
    if (membro === undefined || carregar === undefined) return
    const { contaId } = membro
    carregar().then(
      (duelo) => {
        if (encerrado) return
        entregar(duelo.listaPara(contaId))
        pararDeOuvirODuelo ??= duelo.ouvir(entregar)
      },
      // O pedaço do duelo não baixou (rede caiu): a mesa abre sem duelos, em vez de esperar para sempre.
      () => {
        if (!encerrado) entregar({ t: 'duelo.lista', convites: [], duelos: [] })
      },
    )
  }
  /** O `mural.estado` como o DO manda depois de cada `ola` (e de novo quando a vista da demo muda). */
  function mandarMural(): void {
    const mural = servidor.murais.get(campanhaId)
    if (campanha === undefined || membro === undefined || mural === undefined) return
    entregar(mural.estadoPara(quemNoMural(servidor, campanha, membro)))
  }
  function reenviarMural(deQual: string): void {
    if (aberto && deQual === campanhaId) mandarMural()
  }
  /** Ida e volta pelo JSON e pelo leitor da fonte real, como no fio. */
  function entregar(mensagem: MensagemDoSite): void {
    relogio.depois(LATENCIA_DA_DEMO_MS, () => {
      if (encerrado) return
      const lida = lerMensagemDoServidor(JSON.stringify(mensagem))
      if (lida !== null) {
        ouvinte.aoReceber(lida)
        return
      }
      encerrar()
      ouvinte.aoFechar('rede')
    })
  }
  function difundir(deQual: string, ops: readonly OpGravada[]): void {
    if (campanha === undefined || membro === undefined || deQual !== campanhaId) return
    for (const op of projetarOps(campanha, membro, ops)) entregar({ t: 'aplicada', op })
  }
  function responder(resultado: ResultadoDoProcessamento, alvo: CampanhaEmMemoria): void {
    alvo.gravar(resultado.gravacoes)
    for (const resposta of resultado.respostas) entregar(resposta)
    for (const outro of servidor.abertos) outro(campanhaId, resultado.gravacoes.ops)
  }
  function atender(mensagem: PedidoDoSite, alvo: CampanhaEmMemoria, eu: Membro): void {
    if (ehPedidoDoChat(mensagem)) {
      servidor.chats.get(campanhaId)?.atender(mensagem, eu, entregar)
      return
    }
    if (ehPedidoDoMural(mensagem)) {
      servidor.murais.get(campanhaId)?.atender(mensagem, quemNoMural(servidor, alvo, eu), entregar)
      return
    }
    if (ehPedidoDoDuelo(mensagem)) {
      const carregar = servidor.duelos.get(campanhaId)
      if (carregar === undefined) return
      // A mesma promessa do `ola`: os pedidos são atendidos na ordem em que chegaram.
      carregar().then(
        (duelo) => {
          if (!encerrado) duelo.atender(mensagem, eu, entregar)
        },
        () => {
          if (!encerrado) entregar({ t: 'duelo.recusado', pedido: mensagem.t, motivo: 'sistema' })
        },
      )
      return
    }
    const agora = relogio.agora()
    switch (mensagem.t) {
      case 'ola': {
        clienteId = mensagem.clienteId
        const rev = alvo.revAtual()
        const desde = mensagem.desdeRev
        // A marca como no DO: a da demo nunca muda, mas o site que voltou sem ela (ou com outra) recebe o `estado`.
        const marcaDeAgora = SISTEMA_DA_DEMO === null ? null : SISTEMA_DA_DEMO.marca
        const sistemaVelho = mensagem.marcaDoSistema !== undefined && mensagem.marcaDoSistema !== marcaDeAgora
        if (desde === null || desde > rev || rev - desde > LIMITE_SEM_SNAPSHOT || sistemaVelho) entregar(estadoPara(alvo, eu))
        else entregar({ t: 'ops', desde, ate: rev, lista: projetarOps(alvo, eu, alvo.todasAsOps().filter((op) => op.rev > desde)) })
        entregar(presencaPara(alvo, eu, chegou))
        mandarMural()
        mandarDuelos()
        const chega = PRESENCA_DA_DEMO[campanhaId]?.chega
        if (chega !== undefined && !chegadaMarcada) {
          chegadaMarcada = true
          relogio.depois(chega.depoisDeMs, () => {
            if (encerrado) return
            chegou = true
            entregar(presencaPara(alvo, eu, true))
          })
        }
        return
      }
      case 'ops':
        return responder(processarLote(alvo, identidadeDe(eu, 'site', clienteId), mensagem.lote, agora), alvo)
      case 'desfazer':
        return responder(processarDesfazer(alvo, identidadeDe(eu, 'site', clienteId), mensagem, agora), alvo)
      case 'historico': {
        const antesDe = mensagem.antesDeRev ?? Number.MAX_SAFE_INTEGER
        const daFicha = alvo.todasAsOps().filter((op) => op.fichaId === mensagem.fichaId && op.rev < antesDe).reverse()
        const pagina = daFicha.slice(0, mensagem.limite)
        entregar({ t: 'historico', fichaId: mensagem.fichaId, lista: projetarOps(alvo, eu, pagina), temMaisAntigas: daFicha.length > mensagem.limite })
        return
      }
      case 'livro.pedir': {
        // Como o `livro` do DO: as partes, ou a recusa para o sistema que não é o de agora.
        if (LIVRO_DA_DEMO === null || LIVRO_DA_DEMO.sistemaId !== mensagem.sistemaId) {
          entregar({ t: 'livro.recusa', reqId: mensagem.reqId })
          return
        }
        const total = LIVRO_DA_DEMO.partes.length
        LIVRO_DA_DEMO.partes.forEach((texto, indice) => entregar({ t: 'livro.parte', reqId: mensagem.reqId, indice, total, texto }))
        return
      }
    }
  }

  relogio.depois(LATENCIA_DA_DEMO_MS, () => {
    if (encerrado) return
    if (campanha === undefined || membro === undefined) {
      encerrar()
      ouvinte.aoFechar('sem-acesso')
      return
    }
    aberto = true
    servidor.abertos.add(difundir)
    servidor.muraisAbertos.add(reenviarMural)
    ouvinte.aoAbrir()
  })

  return {
    enviar(mensagem) {
      if (!aberto || campanha === undefined || membro === undefined) return false
      // Cópia: o servidor de mentira não pode dividir objeto com a página (no fio de verdade nada é compartilhado).
      const copia = structuredClone(mensagem)
      relogio.depois(LATENCIA_DA_DEMO_MS, () => {
        if (!encerrado) atender(copia, campanha, membro)
      })
      return true
    },
    fechar: encerrar,
  }
}

export function criarFonteDemo(relogio: Relogio = RELOGIO_DO_NAVEGADOR): FonteDaDemo {
  const agora = relogio.agora()
  const campanhas = new Map<string, CampanhaEmMemoria>()
  for (const dados of campanhasDaDemo()) {
    const campanha = campanhaEmMemoria(dados)
    semear(campanha, dados.antigas, agora)
    campanhas.set(dados.campanhaId, campanha)
  }
  const chats = new Map<string, ChatDaDemo>()
  for (const campanha of campanhas.values()) {
    const quemVe = membroPorEmail(campanha, EMAIL_DA_DEMO)
    if (quemVe === undefined) continue
    chats.set(campanha.campanhaId, criarChatDaDemo(campanha.campanhaId, quemVe.contaId, campanha.todosOsMembros, relogio.agora, relogio.depois))
  }
  const murais = new Map<string, MuralDaDemo>()
  for (const campanha of campanhas.values()) {
    murais.set(
      campanha.campanhaId,
      criarMuralDaDemo(campanha.campanhaId, { agora: relogio.agora, membros: campanha.todosOsMembros, todasAsOps: campanha.todasAsOps, ficha: campanha.ficha }),
    )
  }
  const duelos = new Map<string, () => Promise<DueloDaDemo>>()
  for (const campanha of campanhas.values()) {
    const quemVe = membroPorEmail(campanha, EMAIL_DA_DEMO)
    if (quemVe === undefined) continue
    duelos.set(
      campanha.campanhaId,
      dueloSobDemanda({ campanhaId: campanha.campanhaId, agora: relogio.agora, depois: relogio.depois, membros: campanha.todosOsMembros, fichas: campanha.todasAsFichas, euContaId: quemVe.contaId }),
    )
  }
  const servidor: ServidorDaDemo = { campanhas, chats, abertos: new Set(), murais, comoMestre: new Set(), muraisAbertos: new Set(), duelos }
  let simuladas = 0

  return {
    demo: true,
    buscarEu() {
      const minhas = [...campanhas.values()].flatMap((campanha) => {
        const membro = membroPorEmail(campanha, EMAIL_DA_DEMO)
        return membro === undefined ? [] : [{ campanhaId: campanha.campanhaId, nomeDaCampanha: campanha.nome, papel: membro.papel }]
      })
      return new Promise((resolve) => {
        relogio.depois(LATENCIA_DA_DEMO_MS, () => resolve({ email: EMAIL_DA_DEMO, campanhas: minhas }))
      })
    },
    abrirCanal: (campanhaId, ouvinte) => abrirCanalDaDemo(servidor, campanhaId, ouvinte, relogio),
    pedirBilhete(campanhaId) {
      // As mesmas recusas do DO: quem não é membro, o mestre e a mesa sem sala aberta.
      const campanha = campanhas.get(campanhaId)
      const membro = campanha === undefined ? undefined : membroPorEmail(campanha, EMAIL_DA_DEMO)
      const sala = SALA_DA_DEMO[campanhaId]
      const resposta: RespostaDoBilhete =
        membro === undefined || membro.papel === 'mestre' ? { ok: false, motivo: 'fora-da-mesa' } : sala === undefined ? { ok: false, motivo: 'sem-sala' } : { ok: true, bilhete: BILHETE_DA_DEMO, sala }
      return new Promise((resolve) => {
        relogio.depois(LATENCIA_DA_DEMO_MS, () => resolve(resposta))
      })
    },
    simularMudancaDoMestre(campanhaId, fichaId, caminho, valor) {
      const campanha = campanhas.get(campanhaId)
      const mestre = campanha?.membro(CONTA_DO_MESTRE)
      if (campanha === undefined || mestre === undefined) return false
      simuladas += 1
      const quem = identidadeDe(mestre, 'app', 'cli_demo_app')
      const op: Op = {
        opId: `simulada_${simuladas}_${relogio.agora()}`,
        loteId: `simulada_${simuladas}_${relogio.agora()}`,
        fichaId,
        caminho,
        acao: 'definir',
        valor,
        baseRev: campanha.revAtual(),
        clienteId: quem.clienteId,
        quandoCliente: relogio.agora(),
      }
      const resultado = processarLote(campanha, quem, [op], relogio.agora())
      campanha.gravar(resultado.gravacoes)
      for (const aberto of servidor.abertos) aberto(campanhaId, resultado.gravacoes.ops)
      return resultado.respostas.some((resposta) => resposta.t === 'ack')
    },
    verMuralComoMestre(campanhaId, comoMestre) {
      if (servidor.comoMestre.has(campanhaId) === comoMestre) return
      if (comoMestre) servidor.comoMestre.add(campanhaId)
      else servidor.comoMestre.delete(campanhaId)
      for (const reenviar of servidor.muraisAbertos) reenviar(campanhaId)
    },
  }
}
