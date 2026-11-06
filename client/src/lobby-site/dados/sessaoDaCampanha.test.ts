import { describe, expect, it } from 'vitest'
import { AGORA, enviar, F_DO_MESTRE, F_NAMI, F_NAMI_2, F_SEM_DONO, F_ZORO, mesa, MESTRE_NO_APP, MEMBROS, NAMI, op, type CampanhaDeTeste } from '../../lib/nuvem/campanha.fixture'
import { armazenamentoEmTexto } from '../../lib/nuvem/fila'
import { lerJsonSeguro } from '../../lib/nuvem/json'
import { fichaNoEstado, projetarMembros, projetarOpParaJogador } from '../../lib/nuvem/projecao'
import type { Identidade, Membro, MensagemDoServidor, OpGravada } from '../../lib/nuvem/tipos'
import type { Relogio } from './fonte'
import { criarFonteReal, type Fio, type OuvinteDoFio } from './fonteReal'
import { abrirSessaoDaCampanha, type SessaoDaCampanha } from './sessaoDaCampanha'

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
}

function relogioDeTeste(): Relogio & { andar(ms: number): void } {
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

function servidorFalso(campanha: CampanhaDeTeste) {
  const conexoes = new Set<Conexao>()
  const olas: (number | null)[] = []
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
  function receber(conexao: Conexao, texto: string): void {
    const frame = lerJsonSeguro(texto)
    if (typeof frame !== 'object' || frame === null || !('t' in frame)) throw new Error(`frame torto: ${texto}`)
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
      const { email, contaId, nome, papel } = conexao.membro
      const quem: Identidade = { email, contaId, nome, papel, origem: 'site', clienteId: conexao.clienteId }
      const resultado = enviar(campanha, quem, frame.lote, AGORA)
      if (conexao.engolir) {
        derrubar(conexao)
      } else {
        for (const resposta of resultado.respostas) mandar(conexao, resposta)
      }
      difundir(resultado.gravacoes.ops)
    }
  }

  return {
    olas,
    conexoes,
    abrirFioDe(membro: Membro) {
      return (_url: string, ouvinte: OuvinteDoFio): Fio => {
        const conexao: Conexao = { membro, ouvinte, clienteId: null, engolir: false }
        conexoes.add(conexao)
        queueMicrotask(() => ouvinte.aoAbrir())
        return {
          enviar: (texto) => queueMicrotask(() => conexoes.has(conexao) && texto !== 'ping' && receber(conexao, texto)),
          fechar: () => conexoes.delete(conexao),
        }
      }
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

async function abrirComoNami(campanha: CampanhaDeTeste) {
  const servidor = servidorFalso(campanha)
  const relogio = relogioDeTeste()
  let ids = 0
  let texto = ''
  const fonte = criarFonteReal({
    origem: 'https://lobby.example.com',
    abrirFio: servidor.abrirFioDe(NAMI),
    relogio,
    buscar: () => Promise.reject(new Error('o teste não usa o /api/eu')),
  })
  const sessao: SessaoDaCampanha = await abrirSessaoDaCampanha({
    fonte,
    campanhaId: 'campanha_teste',
    armazenamento: armazenamentoEmTexto({ ler: async () => texto, acrescentar: async (mais) => void (texto += mais), reescrever: async (novo) => void (texto = novo) }),
    clienteId: 'cli_nami_site',
    relogio,
    novoId: () => `id_${(ids += 1)}`,
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
})
