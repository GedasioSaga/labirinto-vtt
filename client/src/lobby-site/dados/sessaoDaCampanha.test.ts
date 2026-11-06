import { describe, expect, it } from 'vitest'
import { AGORA, enviar, F_DO_MESTRE, F_NAMI, F_NAMI_2, F_SEM_DONO, F_ZORO, mesa, MESTRE_NO_APP, MEMBROS, NAMI, op, pedirDesfazer, type CampanhaDeTeste } from '../../lib/nuvem/campanha.fixture'
import { armazenamentoEmTexto, type ArquivoDeTexto } from '../../lib/nuvem/fila'
import { lerJsonSeguro } from '../../lib/nuvem/json'
import { fichaNoEstado, projetarMembros, projetarOpParaJogador } from '../../lib/nuvem/projecao'
import type { Identidade, Membro, MensagemDoServidor, OpGravada } from '../../lib/nuvem/tipos'
import type { Relogio } from './fonte'
import { criarFonteReal, type Fio, type OuvinteDoFio } from './fonteReal'
import { abrirSessaoDaCampanha, ESPERAS_DA_RECONEXAO_MS, PRAZO_DA_RESPOSTA_MS, type SessaoDaCampanha } from './sessaoDaCampanha'

/**
 * A fonte REAL (`fonteReal.ts`) e a sessão contra um servidor falso que fala o
 * protocolo da §5.4 como o DO da W1 (`lobby/nuvem/src/campanha.ts`): `ola` com
 * `desdeRev` nulo = `estado`; senão as ops que faltam; o lote passa pelo mesmo
 * `processarLote` do núcleo; a resposta vai a quem mandou e o `aplicada` a
 * todos, projetado. O servidor de verdade ainda não está no ar.
 */

const FICHAS = [F_NAMI, F_NAMI_2, F_ZORO, F_SEM_DONO, F_DO_MESTRE]

interface Conexao {
  membro: Membro
  ouvinte: OuvinteDoFio
  clienteId: string | null
  /** Grava o que chegar, mas não entrega nenhuma resposta e derruba o socket (queda logo depois de o servidor gravar). */
  engolir: boolean
  /** Nada do que esta aba manda chega (ela ficou sem rede e ainda não notou). */
  surda: boolean
}

type RelogioDeTeste = Relogio & { andar(ms: number): void }

function relogioDeTeste(): RelogioDeTeste {
  let agora = AGORA
  let timers: { quando: number; fazer: () => void }[] = []
  return {
    agora: () => agora,
    depois(ms, fazer) {
      const timer = { quando: agora + ms, fazer }
      timers.push(timer)
      return () => {
        timers = timers.filter((outro) => outro !== timer)
      }
    },
    andar(ms) {
      agora += ms
      const vencidos = timers.filter((timer) => timer.quando <= agora)
      timers = timers.filter((timer) => timer.quando > agora)
      for (const timer of vencidos) timer.fazer()
    },
  }
}

/** Os `opId` de um lote, para responder `adiado` a cada um. */
function opIdsDo(lote: readonly unknown[]): string[] {
  return lote.flatMap((item) => (typeof item === 'object' && item !== null && 'opId' in item && typeof item.opId === 'string' ? [item.opId] : []))
}

function servidorFalso(campanha: CampanhaDeTeste, relogio: Relogio) {
  const conexoes = new Set<Conexao>()
  const olas: (number | null)[] = []
  /** Frames que o ritmo deixou sem resposta. */
  const engolidos: string[] = []
  /** Até quando a conta está acima do ritmo (§6.5): op e desfazer viram `adiado`; o `ola` repetido fica sem resposta. */
  const ritmo = { ate: 0 }
  const nomeDaConta = (contaId: string): string | null => campanha.membro(contaId)?.nome ?? null

  function mandar(conexao: Conexao, mensagem: MensagemDoServidor): void {
    queueMicrotask(() => {
      if (conexoes.has(conexao)) conexao.ouvinte.aoReceber(JSON.stringify(mensagem))
    })
  }
  function projetar(membro: Membro, ops: readonly OpGravada[]): OpGravada[] {
    if (membro.papel === 'mestre') return [...ops]
    return ops.flatMap((gravada) => {
      const projetada = projetarOpParaJogador(gravada, campanha.ficha(gravada.fichaId)?.visivel ?? 'mestre')
      return projetada === null ? [] : [projetada]
    })
  }
  function difundir(ops: readonly OpGravada[]): void {
    for (const conexao of conexoes) for (const gravada of projetar(conexao.membro, ops)) mandar(conexao, { t: 'aplicada', op: gravada })
  }
  function derrubar(conexao: Conexao): void {
    conexoes.delete(conexao)
    queueMicrotask(() => conexao.ouvinte.aoFechar(1006))
  }
  function quemE(conexao: Conexao, clienteId: string): Identidade {
    const { email, contaId, nome, papel } = conexao.membro
    return { email, contaId, nome, papel, origem: 'site', clienteId }
  }
  function receber(conexao: Conexao, texto: string): void {
    const frame = lerJsonSeguro(texto)
    if (typeof frame !== 'object' || frame === null || !('t' in frame)) throw new Error(`frame torto: ${texto}`)
    // Como o DO (campanha.ts): o primeiro `ola` do socket não passa pelo ritmo; o resto passa.
    const acimaDoRitmo = relogio.agora() < ritmo.ate && !(frame.t === 'ola' && conexao.clienteId === null)
    if (acimaDoRitmo && frame.t === 'ola') {
      engolidos.push('ola')
      return
    }
    if (frame.t === 'ola' && 'desdeRev' in frame && 'clienteId' in frame && typeof frame.clienteId === 'string') {
      const desde = typeof frame.desdeRev === 'number' ? frame.desdeRev : null
      olas.push(desde)
      conexao.clienteId = frame.clienteId
      const atual = campanha.revAtual()
      if (desde === null || desde > atual) {
        const fichas = FICHAS.flatMap((id) => {
          const guardada = campanha.ficha(id)
          const naTela = guardada === undefined ? null : fichaNoEstado(conexao.membro, guardada, nomeDaConta)
          return naTela === null ? [] : [naTela]
        })
        const { contaId, nome, papel } = conexao.membro
        mandar(conexao, { t: 'estado', rev: atual, fichas, membros: projetarMembros(MEMBROS), eu: { contaId, nome, papel } })
      } else {
        mandar(conexao, { t: 'ops', desde, ate: atual, lista: projetar(conexao.membro, campanha.todasAsOps().filter((gravada) => gravada.rev > desde)) })
      }
      return
    }
    if (frame.t === 'ops' && 'lote' in frame && Array.isArray(frame.lote) && conexao.clienteId !== null) {
      if (acimaDoRitmo) {
        for (const opId of opIdsDo(frame.lote)) mandar(conexao, { t: 'adiado', opId, motivo: 'ritmo', tentarDepoisDe: ritmo.ate })
        return
      }
      const resultado = enviar(campanha, quemE(conexao, conexao.clienteId), frame.lote, AGORA)
      if (conexao.engolir) {
        derrubar(conexao)
      } else {
        for (const resposta of resultado.respostas) mandar(conexao, resposta)
      }
      difundir(resultado.gravacoes.ops)
      return
    }
    if (frame.t === 'desfazer' && 'novoOpId' in frame && typeof frame.novoOpId === 'string' && conexao.clienteId !== null) {
      if (acimaDoRitmo) {
        mandar(conexao, { t: 'adiado', opId: frame.novoOpId, motivo: 'ritmo', tentarDepoisDe: ritmo.ate })
        return
      }
      const resultado = pedirDesfazer(campanha, quemE(conexao, conexao.clienteId), frame, AGORA)
      for (const resposta of resultado.respostas) mandar(conexao, resposta)
      difundir(resultado.gravacoes.ops)
    }
  }

  return {
    olas,
    engolidos,
    ritmo,
    conexoes,
    abrirFioDe(membro: Membro) {
      return (_url: string, ouvinte: OuvinteDoFio): Fio => {
        const conexao: Conexao = { membro, ouvinte, clienteId: null, engolir: false, surda: false }
        conexoes.add(conexao)
        queueMicrotask(() => ouvinte.aoAbrir())
        return {
          enviar: (texto) => queueMicrotask(() => conexoes.has(conexao) && !conexao.surda && texto !== 'ping' && receber(conexao, texto)),
          fechar: () => conexoes.delete(conexao),
        }
      }
    },
    /** Uma mensagem do servidor a todos os sockets, fora de qualquer pedido. */
    mandarATodos(mensagem: MensagemDoServidor): void {
      for (const conexao of conexoes) mandar(conexao, mensagem)
    },
    /** O mestre muda pelo app (HTTPS pelo Rust): grava e difunde aos sockets do site. */
    mudarPeloApp(...ops: Parameters<typeof op>[]): void {
      difundir(enviar(campanha, MESTRE_NO_APP, ops.map((args) => op(...args)), AGORA).gravacoes.ops)
    },
  }
}

/** Deixa correr as microtarefas e as gravações da fila (memória) até tudo assentar. */
async function calmo(): Promise<void> {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

type ServidorFalso = ReturnType<typeof servidorFalso>

/** A base da fila (o IndexedDB do site): duas abas da mesma pessoa recebem o mesmo arquivo. */
function arquivoDeTeste(): ArquivoDeTexto {
  let texto = ''
  return {
    ler: async () => texto,
    acrescentar: async (mais) => void (texto += mais),
    reescrever: async (novo) => void (texto = novo),
  }
}

interface OpcoesDaAba {
  /** Servidor e relógio vêm juntos: o ritmo do servidor anda no relógio da aba. */
  mundo?: { servidor: ServidorFalso; relogio: RelogioDeTeste }
  arquivo?: ArquivoDeTexto
  clienteId?: string
  /** Prefixo dos ids novos: duas abas não podem gerar o mesmo `opId`. */
  prefixo?: string
}

async function abrirComoNami(campanha: CampanhaDeTeste, opcoes: OpcoesDaAba = {}) {
  const relogio = opcoes.mundo?.relogio ?? relogioDeTeste()
  const servidor = opcoes.mundo?.servidor ?? servidorFalso(campanha, relogio)
  const prefixo = opcoes.prefixo ?? 'id'
  let ids = 0
  const fonte = criarFonteReal({
    origem: 'https://lobby.example.com',
    abrirFio: servidor.abrirFioDe(NAMI),
    relogio,
    buscar: () => Promise.reject(new Error('o teste não usa o /api/eu')),
  })
  const sessao: SessaoDaCampanha = await abrirSessaoDaCampanha({
    fonte,
    campanhaId: 'campanha_teste',
    armazenamento: armazenamentoEmTexto(opcoes.arquivo ?? arquivoDeTeste()),
    clienteId: opcoes.clienteId ?? 'cli_nami_site',
    relogio,
    novoId: () => `${prefixo}_${(ids += 1)}`,
    aoMudar: () => undefined,
  })
  await calmo()
  const doc = (fichaId: string) => {
    const achada = sessao.estado().fichas.find((ficha) => ficha.doc.id === fichaId)
    if (achada === undefined) throw new Error(`a vista não tem ${fichaId}`)
    return achada.doc
  }
  return { servidor, relogio, sessao, doc }
}

describe('sessão da campanha pela fonte real, contra o protocolo (servidor falso)', () => {
  it('queda depois de o servidor gravar e antes do ack: a volta pede só o que falta e a soma não entra duas vezes', async () => {
    const campanha = mesa()
    const { servidor, relogio, sessao, doc } = await abrirComoNami(campanha)
    expect(sessao.estado().conexao).toBe('em-dia')
    // A jogadora vê as 4 fichas da mesa; o NPC do mestre não chega.
    expect(sessao.estado().fichas.map((ficha) => ficha.doc.id).sort()).toEqual([F_NAMI, F_NAMI_2, F_SEM_DONO, F_ZORO].sort())

    for (const conexao of servidor.conexoes) conexao.engolir = true
    const resultado = await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['moedas'], acao: 'somar', delta: 10 }], sessao.estado().rev)
    expect(resultado).toEqual({ ok: true, ops: 1 })
    await calmo()
    expect(sessao.estado().conexao).toBe('sem-rede')
    expect(sessao.estado().esperando).toBe(1)
    // Enquanto isso, o mestre muda outro campo da mesma ficha pelo app.
    servidor.mudarPeloApp([MESTRE_NO_APP, F_NAMI, ['descricao'], 'definir', { valor: 'Navegadora do bando', baseRev: 1 }])

    relogio.andar(2_000)
    await calmo()

    expect(servidor.olas).toEqual([null, 0])
    expect(campanha.todasAsOps().filter((gravada) => gravada.opId === 'id_2')).toHaveLength(1)
    expect(sessao.estado().conexao).toBe('em-dia')
    expect(sessao.estado().esperando).toBe(0)
    expect(sessao.estado().rev).toBe(2)
    expect(doc(F_NAMI).moedas).toBe(110)
    expect(doc(F_NAMI).descricao).toBe('Navegadora do bando')
  })

  it('o mestre mudou o mesmo campo depois da base do Editar: conflito guardado para decidir, o outro campo passa, e "Usar a minha" grava', async () => {
    const campanha = mesa()
    const { servidor, sessao, doc } = await abrirComoNami(campanha)
    const baseRev = sessao.estado().rev
    const base = doc(F_NAMI)

    servidor.mudarPeloApp([MESTRE_NO_APP, F_NAMI, ['recursos', 'hp'], 'definir', { valor: 200, baseRev }])
    await calmo()
    expect(doc(F_NAMI).recursos.hp).toBe(200)

    const rascunho = { ...base, nome: 'Nami Navegadora', recursos: { ...base.recursos, hp: 280 } }
    expect(await sessao.mudarFicha(base, rascunho, baseRev)).toEqual({ ok: true, ops: 2 })
    await calmo()

    const decidir = sessao.estado().paraDecidir
    expect(decidir).toHaveLength(1)
    expect(decidir[0].op.caminho).toEqual(['recursos', 'hp'])
    expect(decidir[0].situacao).toMatchObject({ t: 'conflito', conflito: { valorAtual: 200, quem: 'Mestre' } })
    expect(doc(F_NAMI).recursos.hp).toBe(200)
    expect(doc(F_NAMI).nome).toBe('Nami Navegadora')
    expect(sessao.estado().esperando).toBe(0)

    expect(await sessao.resolver(decidir[0].op.opId, { t: 'reenviar' })).toEqual({ ok: true, ops: 1 })
    await calmo()
    expect(sessao.estado().paraDecidir).toHaveLength(0)
    expect(sessao.estado().esperando).toBe(0)
    expect(doc(F_NAMI).recursos.hp).toBe(280)
    expect(campanha.todasAsOps().at(-1)).toMatchObject({ caminho: ['recursos', 'hp'], valor: 280, autorContaId: NAMI.contaId })
  })

  it('duas abas da mesma jogadora dividem a base: a mudança velha que a aba fechada deixou a caminho vira conflito na outra, e a nova fica', async () => {
    const campanha = mesa()
    const relogio = relogioDeTeste()
    const mundo = { servidor: servidorFalso(campanha, relogio), relogio }
    const arquivo = arquivoDeTeste()
    const abaA = await abrirComoNami(campanha, { mundo, arquivo, clienteId: 'cli_aba_a', prefixo: 'a' })
    const abaB = await abrirComoNami(campanha, { mundo, arquivo, clienteId: 'cli_aba_b', prefixo: 'b' })
    const baseRev = abaA.sessao.estado().rev

    // A aba A perde a rede: a mudança fica na base e nunca chega. A pessoa fecha a aba.
    for (const conexao of mundo.servidor.conexoes) if (conexao.clienteId === 'cli_aba_a') conexao.surda = true
    expect(await abaA.sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['recursos', 'hp'], acao: 'definir', valor: 25 }], baseRev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    abaA.sessao.fechar()

    expect(await abaB.sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['recursos', 'hp'], acao: 'definir', valor: 40 }], baseRev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    expect(abaB.doc(F_NAMI).recursos.hp).toBe(40)

    // A aba B recarrega (mesmo clienteId): a base traz a op da aba A, que sai com o clienteId de quem a fez.
    abaB.sessao.fechar()
    const recarregada = await abrirComoNami(campanha, { mundo, arquivo, clienteId: 'cli_aba_b', prefixo: 'b2' })
    await calmo()

    const decidir = recarregada.sessao.estado().paraDecidir
    expect(decidir).toHaveLength(1)
    expect(decidir[0].op).toMatchObject({ clienteId: 'cli_aba_a', valor: 25 })
    expect(decidir[0].situacao).toMatchObject({ t: 'conflito', conflito: { valorAtual: 40 } })
    expect(recarregada.doc(F_NAMI).recursos.hp).toBe(40)
    expect(campanha.todasAsOps().filter((gravada) => gravada.caminho.join('.') === 'recursos.hp').map((gravada) => gravada.valor)).toEqual([40])
  })

  it('o segundo ola, engolido pelo ritmo, não deixa a sessão parada: no prazo o canal cai, volta pelo primeiro ola e o que ficou na fila sai', async () => {
    const campanha = mesa()
    const { servidor, relogio, sessao, doc } = await abrirComoNami(campanha)
    servidor.ritmo.ate = relogio.agora() + PRAZO_DA_RESPOSTA_MS / 2

    // Uma lista de ops com buraco: a sessão pede o estado inteiro com um segundo ola, e o ritmo o deixa sem resposta.
    servidor.mandarATodos({ t: 'ops', desde: 5, ate: 6, lista: [] })
    await calmo()
    expect(servidor.engolidos).toEqual(['ola'])
    expect(await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['moedas'], acao: 'somar', delta: 10 }], sessao.estado().rev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    expect(sessao.estado().esperando).toBe(1)

    relogio.andar(PRAZO_DA_RESPOSTA_MS)
    await calmo()
    expect(sessao.estado().conexao).toBe('sem-rede')

    relogio.andar(ESPERAS_DA_RECONEXAO_MS[0])
    await calmo()
    expect(sessao.estado().conexao).toBe('em-dia')
    expect(sessao.estado().esperando).toBe(0)
    expect(doc(F_NAMI).moedas).toBe(110)
  })

  it('desfazer adiado e, logo depois, um lote adiado para mais tarde: o desfazer não perde a vez', async () => {
    const campanha = mesa()
    const { servidor, relogio, sessao, doc } = await abrirComoNami(campanha)
    expect(await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['moedas'], acao: 'somar', delta: 10 }], sessao.estado().rev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    const inicio = relogio.agora()

    servidor.ritmo.ate = inicio + 1_000
    expect(sessao.desfazer('id_2')).toBe(true)
    await calmo()
    servidor.ritmo.ate = inicio + 5_000
    expect(await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['descricao'], acao: 'definir', valor: 'Ladra de mapas' }], sessao.estado().rev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    expect(sessao.estado().desfazeres.get('id_2')).toMatchObject({ t: 'enviando' })

    // Na vez do desfazer ele vai de novo (e o ritmo, agora mais longo, o adia outra vez); na vez do lote, os dois saem.
    relogio.andar(1_100)
    await calmo()
    relogio.andar(4_000)
    await calmo()
    expect(sessao.estado().desfazeres.get('id_2')).toMatchObject({ t: 'feito' })
    expect(sessao.estado().esperando).toBe(0)
    expect(doc(F_NAMI).moedas).toBe(100)
    expect(doc(F_NAMI).descricao).toBe('Ladra de mapas')
  })

  it('lote adiado e, logo depois, um desfazer adiado para antes: o lote não perde a vez', async () => {
    const campanha = mesa()
    const { servidor, relogio, sessao, doc } = await abrirComoNami(campanha)
    expect(await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['moedas'], acao: 'somar', delta: 10 }], sessao.estado().rev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    const inicio = relogio.agora()

    servidor.ritmo.ate = inicio + 5_000
    expect(await sessao.enviarMudancas([{ fichaId: F_NAMI, caminho: ['descricao'], acao: 'definir', valor: 'Ladra de mapas' }], sessao.estado().rev)).toEqual({ ok: true, ops: 1 })
    await calmo()
    servidor.ritmo.ate = inicio + 1_000
    expect(sessao.desfazer('id_2')).toBe(true)
    await calmo()

    relogio.andar(1_100)
    await calmo()
    expect(sessao.estado().desfazeres.get('id_2')).toMatchObject({ t: 'feito' })
    expect(sessao.estado().esperando).toBe(1)

    relogio.andar(4_000)
    await calmo()
    expect(sessao.estado().esperando).toBe(0)
    expect(doc(F_NAMI).descricao).toBe('Ladra de mapas')
  })
})
