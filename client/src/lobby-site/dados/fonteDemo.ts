import { processarDesfazer } from '../../lib/nuvem/desfazer'
import type { Json } from '../../lib/nuvem/json'
import type { Cota } from '../../lib/nuvem/limites'
import { processarLote, type Gravacoes, type LeitorDaCampanha, type ResultadoDoProcessamento } from '../../lib/nuvem/lote'
import { fichaNoEstado, projetarMembros, projetarOpParaJogador } from '../../lib/nuvem/projecao'
import { CONTA_DO_MESTRE, type FichaGuardada, type FichaNoEstado, type Identidade, type Membro, type MensagemDoServidor, type Op, type OpGravada, type Origem, type PresencaNaMesa, type Recusada } from '../../lib/nuvem/tipos'
import { criarChatDaDemo, type ChatDaDemo } from './chatDaDemo'
import { campanhasDaDemo, EMAIL_DA_DEMO, type CampanhaDaDemo, type MudancaAntiga } from './dadosDaDemo'
import { ehPedidoDoChat, RELOGIO_DO_NAVEGADOR, type Canal, type FonteDoLobby, type MensagemDoSite, type OuvinteDoCanal, type PedidoDoSite, type Relogio } from './fonte'
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

function estadoPara(campanha: CampanhaEmMemoria, membro: Membro): MensagemDoServidor {
  const nomeDaConta = (contaId: string): string | null => campanha.membro(contaId)?.nome ?? null
  const fichas = campanha.todasAsFichas().flatMap((guardada): FichaNoEstado[] => {
    const naTela = fichaNoEstado(membro, guardada, nomeDaConta)
    return naTela === null ? [] : [naTela]
  })
  const { contaId, nome, papel } = membro
  return { t: 'estado', rev: campanha.revAtual(), fichas, membros: projetarMembros(campanha.todosOsMembros()), eu: { contaId, nome, papel } }
}

/** "Na mesa agora": o mestre no app e quem está vendo, no site (inventado, só para a tela ter o que mostrar). */
function presencaPara(campanha: CampanhaEmMemoria, membro: Membro): MensagemDoServidor {
  const mestre = campanha.membro(CONTA_DO_MESTRE)
  const naMesa: PresencaNaMesa[] = [{ contaId: membro.contaId, nome: membro.nome, papel: membro.papel, onde: 'site' }]
  if (mestre !== undefined && mestre.contaId !== membro.contaId) naMesa.unshift({ contaId: mestre.contaId, nome: mestre.nome, papel: mestre.papel, onde: 'site' })
  return { t: 'presenca', naMesa }
}

interface ServidorDaDemo {
  campanhas: Map<string, CampanhaEmMemoria>
  /** O chat de cada mesa (C2), com as conversas inventadas. */
  chats: Map<string, ChatDaDemo>
  /** Os canais abertos, para a difusão do `aplicada` (inclusive a mudança simulada do mestre). */
  abertos: Set<(campanhaId: string, ops: readonly OpGravada[]) => void>
}

function abrirCanalDaDemo(servidor: ServidorDaDemo, campanhaId: string, ouvinte: OuvinteDoCanal, relogio: Relogio): Canal {
  const campanha = servidor.campanhas.get(campanhaId)
  const membro = campanha === undefined ? undefined : membroPorEmail(campanha, EMAIL_DA_DEMO)
  let aberto = false
  let encerrado = false
  let clienteId = 'cli_demo_sem_ola'

  function encerrar(): void {
    encerrado = true
    aberto = false
    servidor.abertos.delete(difundir)
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
    const agora = relogio.agora()
    switch (mensagem.t) {
      case 'ola': {
        clienteId = mensagem.clienteId
        const rev = alvo.revAtual()
        const desde = mensagem.desdeRev
        if (desde === null || desde > rev || rev - desde > LIMITE_SEM_SNAPSHOT) entregar(estadoPara(alvo, eu))
        else entregar({ t: 'ops', desde, ate: rev, lista: projetarOps(alvo, eu, alvo.todasAsOps().filter((op) => op.rev > desde)) })
        entregar(presencaPara(alvo, eu))
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
  const servidor: ServidorDaDemo = { campanhas, chats, abertos: new Set() }
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
  }
}
