import { afterEach, describe, expect, it } from 'vitest'
import { quantidadeDe } from '../../lib/items'
import { AGORA, campanhaDeTeste, enviar, ficha, MEMBROS, MESTRE_NO_APP, MESTRE_NO_SITE, NAMI, NAMI_NO_PC, op, TANGERINA, type CampanhaDeTeste } from '../../lib/nuvem/campanha.fixture'
import { ehRegistro, paraJson, proprio } from '../../lib/nuvem/json'
import type { Personagem } from '../../lib/personagem'
import type { PastaNoDisco } from './discoDaNuvem'
import { ligarEmissor, prepararEmissao } from './emissor'
import { ErroDaPonte, ponteSobre, type TransporteDaNuvem } from './ponte'
import { abrirSincronizador, type AplicadorNoApp, type Sincronizador } from './sincronizador'

/**
 * A5 contra a ponte FALSA (a R1 ainda não existe): o transporte responde
 * como o Worker (`lobby/nuvem/src/campanha.ts`), com o núcleo de verdade
 * (`processarLote`) por trás e o JSON passando "pelo fio" (ida e volta em
 * texto), e o disco é uma pasta em memória. As telas e o Tauri ficam de fora.
 */

const CAMPANHA = 'camp_onepiece'
const PASTA = 'pasta_onepiece'
const LUFFY = ficha('pers_luffy', { dono: NAMI.contaId, mochila: [TANGERINA], moedas: 100 })

/** Como o JSON chega do outro lado do fio. */
function peloFio(valor: unknown): unknown {
  return JSON.parse(JSON.stringify(valor))
}

interface ServidorFalso {
  transporte: TransporteDaNuvem
  online: boolean
}

/** O Worker em memória: `POST ops` e `GET desde` da §5.4, com a identidade do Service Token (o mestre no app). */
function servidorFalso(campanha: CampanhaDeTeste): ServidorFalso {
  const servidor: ServidorFalso = {
    online: true,
    transporte: {
      async pedir(rota, corpo) {
        if (!servidor.online) throw new ErroDaPonte('rede', 'Sem internet')
        if (rota.rota === 'ops') {
          const lido = peloFio(corpo)
          const lote = ehRegistro(lido) ? proprio(lido, 'lote') : undefined
          const clienteId = ehRegistro(lido) ? proprio(lido, 'clienteId') : undefined
          if (!Array.isArray(lote) || typeof clienteId !== 'string') return { status: 400, corpo: { erro: 'fora-do-formato' } }
          const brutas: readonly unknown[] = lote
          const resultado = enviar(campanha, { ...MESTRE_NO_APP, clienteId }, brutas, AGORA)
          return { status: 200, corpo: peloFio({ respostas: resultado.respostas, revAtual: resultado.revAtual }) }
        }
        if (rota.rota === 'desde') {
          const lista = campanha.todasAsOps().filter((gravada) => gravada.rev > rota.rev).slice(0, rota.limite)
          const ate = lista.at(-1)?.rev ?? rota.rev
          return { status: 200, corpo: peloFio({ t: 'ops', desde: rota.rev, ate, lista, revAtual: campanha.revAtual() }) }
        }
        return { status: 404, corpo: { erro: 'nao-existe' } }
      },
    },
  }
  return servidor
}

/** O `publicar` da W1: cada ficha nova entra como `criar` de `[]` pelo mesmo núcleo. */
function publicar(campanha: CampanhaDeTeste, fichas: readonly Personagem[]): void {
  const lote = fichas.map((doc) => ({ opId: `pub:${doc.id}`, loteId: `pub:${doc.id}`, fichaId: doc.id, caminho: [], acao: 'criar', valor: paraJson(doc), baseRev: 0, clienteId: 'cli_app', quandoCliente: AGORA }))
  enviar(campanha, MESTRE_NO_APP, lote, AGORA)
}

type DiscoEmMemoria = PastaNoDisco & { arquivos: Map<string, string> }

function discoEmMemoria(): DiscoEmMemoria {
  const arquivos = new Map<string, string>()
  return {
    caminho: 'memoria',
    arquivos,
    ler: async (nome) => arquivos.get(nome) ?? null,
    acrescentar: async (nome, texto) => {
      arquivos.set(nome, `${arquivos.get(nome) ?? ''}${texto}`)
    },
    reescrever: async (nome, texto) => {
      arquivos.set(nome, texto)
    },
    listar: async () => [...arquivos.keys()],
  }
}

/** O `rpg.json` da pasta e a cópia aberta no editor (`fechada` = nenhum mapa da pasta aberto). */
interface AppFalso {
  aplicador: AplicadorNoApp
  rpg: Personagem[]
  aberta: Personagem[]
  fechada: boolean
  aoAbrir: (() => void)[]
}

function appFalso(rpg: Personagem[]): AppFalso {
  const app: AppFalso = {
    rpg,
    aberta: rpg,
    fechada: false,
    aoAbrir: [],
    aplicador: {
      ajustarPastaAberta(_pastaId, ajustar) {
        if (!app.fechada) app.aberta = ajustar(app.aberta) ?? app.aberta
      },
      async gravarRpg(_pastaId, ajustar) {
        app.rpg = ajustar(app.rpg) ?? app.rpg
      },
      aoAbrirAPasta(_pastaId, aoAbrir) {
        app.aoAbrir.push(aoAbrir)
        return () => {
          app.aoAbrir = app.aoAbrir.filter((outro) => outro !== aoAbrir)
        }
      },
    },
  }
  return app
}

/** Um mapa da pasta abre no editor: a cópia é lida do `rpg.json` e só então vem o aviso. */
function abrirAPastaNoEditor(app: AppFalso): void {
  app.fechada = false
  app.aberta = app.rpg
  for (const aoAbrir of app.aoAbrir) aoAbrir()
}

/** O gravador leve sem a espera de 1 s. */
function agendarJa(fazer: () => void): () => void {
  fazer()
  return () => undefined
}

let proximoId = 0
const desligar: (() => void)[] = []

afterEach(() => {
  for (const fazer of desligar.splice(0)) fazer()
})

async function abrir(servidor: ServidorFalso, disco: PastaNoDisco, app: AppFalso, avisos: string[] = [], agendar = agendarJa): Promise<Sincronizador> {
  const aberto = await abrirSincronizador(
    { campanhaId: CAMPANHA, pastaId: PASTA, nome: 'One Piece' },
    {
      ponte: ponteSobre(servidor.transporte),
      pasta: disco,
      app: app.aplicador,
      ligarEmissor: (destino) => {
        const desligarEste = ligarEmissor(PASTA, destino)
        desligar.push(desligarEste)
        return desligarEste
      },
      ehMembro: () => false,
      agora: () => AGORA,
      novoId: () => `id_${(proximoId += 1)}`,
      agendar,
      aoMudar: () => undefined,
      avisar: (mensagem) => avisos.push(mensagem),
    },
  )
  if (!aberto.ok) throw new Error(aberto.motivo)
  return aberto.sincronizador
}

/** O funil do app (A4): a ficha muda no editor e o emissor entrega as ops à fila. */
function mudarNoEditor(app: AppFalso, depois: Personagem): void {
  const antes = app.aberta
  const novos = antes.map((doc) => (doc.id === depois.id ? depois : doc))
  const emissao = prepararEmissao(PASTA, antes, novos, {}, AGORA)
  if (!emissao.ok) throw new Error(emissao.motivo)
  app.aberta = novos
  emissao.entregar()
}

function hpDe(fichas: readonly Personagem[], id = LUFFY.id): number | undefined {
  return fichas.find((doc) => doc.id === id)?.recursos.hp
}

function tangerinasDe(fichas: readonly Personagem[]): number | undefined {
  const vaga = fichas.find((doc) => doc.id === LUFFY.id)?.mochila?.find((item) => item.id === TANGERINA.id)
  return vaga === undefined ? undefined : quantidadeDe(vaga)
}

function linhas(texto: string | undefined): unknown[] {
  return (texto ?? '').split('\n').filter((linha) => linha.trim() !== '').map((linha) => JSON.parse(linha))
}

describe('sincronizador do app (A5)', () => {
  it('roteiro: offline muda Vida e +1 item, fecha e reabre, religa: o servidor tem as duas ops do mestre no app, a fila fica sem pendentes e o diário com as linhas', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const app = appFalso([LUFFY])
    const primeiro = await abrir(servidor, disco, app)
    expect((await primeiro.ciclo()).t).toBe('ok')

    servidor.online = false
    mudarNoEditor(app, { ...LUFFY, recursos: { ...LUFFY.recursos, hp: 250 }, mochila: [{ ...TANGERINA, quantidade: 4 }] })
    await primeiro.esvaziar()
    expect((await primeiro.ciclo()).t).toBe('sem-rede')
    expect(primeiro.situacao().esperando).toBe(2)
    await primeiro.fechar()
    desligar.splice(0).forEach((fazer) => fazer())

    // Reabrir: o app relê o disco; nada foi mandado ainda.
    const reaberto = appFalso(app.rpg)
    const segundo = await abrir(servidor, disco, reaberto)
    expect(segundo.situacao().esperando).toBe(2)
    servidor.online = true
    expect((await segundo.ciclo()).t).toBe('ok')
    // O próximo ciclo traz o eco das duas (o ack de verdade é a op no `desde`).
    expect((await segundo.ciclo()).t).toBe('ok')

    const doMestre = campanha.todasAsOps().filter((gravada) => !gravada.opId.startsWith('pub:'))
    expect(doMestre.map((gravada) => [gravada.caminho.join('/'), gravada.autorContaId, gravada.origem])).toEqual([
      ['recursos/hp', 'mestre', 'app'],
      ['mochila/vaga_tangerina/quantidade', 'mestre', 'app'],
    ])
    expect(segundo.situacao().esperando).toBe(0)
    expect(segundo.situacao().paraDecidir).toEqual([])
    const revsNoDiario = linhas(disco.arquivos.get('diario-2026-11.jsonl')).map((linha) => (ehRegistro(linha) ? proprio(linha, 'rev') : null))
    expect(revsNoDiario).toEqual([1, 2, 3])
    const noServidor = campanha.ficha(LUFFY.id)?.doc
    expect(noServidor === undefined ? undefined : [noServidor.recursos.hp, tangerinasDe([noServidor])]).toEqual([250, 4])
  })

  it('8.1.1 item 3: o rpg.json já gravado com a soma pendente não vira base da fila — ao reabrir, a soma conta uma vez só', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const app = appFalso([LUFFY])
    const primeiro = await abrir(servidor, disco, app)
    await primeiro.ciclo()
    servidor.online = false
    mudarNoEditor(app, { ...LUFFY, mochila: [{ ...TANGERINA, quantidade: 4 }] })
    await primeiro.fechar()
    // O gravador leve já levou a soma pendente para o `rpg.json` (a vista).
    expect(tangerinasDe(app.rpg)).toBe(4)

    const reaberto = appFalso(app.rpg)
    await abrir(servidor, disco, reaberto)
    expect(tangerinasDe(reaberto.rpg)).toBe(4)
    expect(tangerinasDe(reaberto.aberta)).toBe(4)
  })

  it('conflito: Nami muda a Vida no site enquanto o mestre está offline; o aviso fica guardado depois de reabrir e "usar a minha" grava o valor do mestre', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const app = appFalso([LUFFY])
    const primeiro = await abrir(servidor, disco, app)
    await primeiro.ciclo()
    servidor.online = false
    mudarNoEditor(app, { ...LUFFY, recursos: { ...LUFFY.recursos, hp: 250 } })
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, LUFFY.id, ['recursos', 'hp'], 'definir', { valor: 280, baseRev: 1 })])
    servidor.online = true
    await primeiro.ciclo()

    // O campo mostra o valor do servidor; a escolha fica na lista.
    expect(hpDe(app.aberta)).toBe(280)
    const [aDecidir] = primeiro.situacao().paraDecidir
    expect(aDecidir?.situacao).toMatchObject({ t: 'conflito', conflito: { valorAtual: 280, quem: 'Nami' } })
    await primeiro.fechar()
    desligar.splice(0).forEach((fazer) => fazer())

    const reaberto = appFalso(app.rpg)
    const segundo = await abrir(servidor, disco, reaberto)
    expect(segundo.situacao().paraDecidir).toHaveLength(1)
    const decidido = await segundo.decidir(aDecidir?.op.opId ?? '', 'usar-a-minha')
    expect(decidido.ok).toBe(true)
    await segundo.ciclo()
    await segundo.ciclo()
    expect(campanha.ficha(LUFFY.id)?.doc.recursos.hp).toBe(250)
    expect(hpDe(reaberto.aberta)).toBe(250)
    expect(segundo.situacao().paraDecidir).toEqual([])
    expect(segundo.situacao().esperando).toBe(0)
  })

  it('disco cheio: a fila não grava, a ficha volta como estava no editor e no rpg.json, e o aviso vermelho aparece', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const app = appFalso([LUFFY])
    const avisos: string[] = []
    const sincronizador = await abrir(servidor, disco, app, avisos)
    await sincronizador.ciclo()
    const acrescentarDeVerdade = disco.acrescentar
    disco.acrescentar = async (nome, texto) => {
      if (nome === 'fila.jsonl') throw new Error('There is not enough space on the disk. (os error 112)')
      return acrescentarDeVerdade(nome, texto)
    }
    mudarNoEditor(app, { ...LUFFY, recursos: { ...LUFFY.recursos, hp: 1 } })
    await sincronizador.esvaziar()

    expect(hpDe(app.aberta)).toBe(300)
    expect(hpDe(app.rpg)).toBe(300)
    expect(sincronizador.situacao().esperando).toBe(0)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('não guardou')
  })

  it('ficha apagada no site some do rpg.json e do editor; NPC e ficha que nunca subiu ficam', async () => {
    const zoro = ficha('pers_zoro', {})
    const npc = ficha('pers_arlong', { tipo: 'npc' })
    const nuncaSubiu = ficha('pers_novato', {})
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY, zoro])
    const servidor = servidorFalso(campanha)
    const app = appFalso([LUFFY, zoro, npc, nuncaSubiu])
    const sincronizador = await abrir(servidor, discoEmMemoria(), app)
    await sincronizador.ciclo()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, zoro.id, [], 'apagar', { baseRev: 2 })])
    await sincronizador.ciclo()
    await sincronizador.esvaziar()

    const ids = (fichas: readonly Personagem[]): string[] => fichas.map((doc) => doc.id)
    expect(ids(app.rpg)).toEqual([LUFFY.id, npc.id, nuncaSubiu.id])
    expect(ids(app.aberta)).toEqual([LUFFY.id, npc.id, nuncaSubiu.id])
  })

  it('rpg.json atrás da vista (gravador leve na calmaria): o mapa que abre mostra a Vida do site, e o dano do mestre sai sobre ela', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const app = appFalso([LUFFY])
    app.fechada = true
    // A calmaria de 1 s não termina: o `rpg.json` fica para trás.
    const sincronizador = await abrir(servidor, discoEmMemoria(), app, [], () => () => undefined)
    await sincronizador.ciclo()
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, LUFFY.id, ['recursos', 'hp'], 'definir', { valor: 150, baseRev: 1 })])
    await sincronizador.ciclo()
    expect(hpDe(app.rpg)).toBe(300)

    abrirAPastaNoEditor(app)
    expect(hpDe(app.aberta)).toBe(150)
    // O mestre tira 3 do que vê.
    mudarNoEditor(app, { ...LUFFY, recursos: { ...LUFFY.recursos, hp: (hpDe(app.aberta) ?? 0) - 3 } })
    await sincronizador.esvaziar()
    await sincronizador.ciclo()
    expect(campanha.ficha(LUFFY.id)?.doc.recursos.hp).toBe(147)
  })

  it('mudança do mestre enquanto a fila abre: espera o emissor, entra na fila e o acerto da reabertura não a desfaz', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const app = appFalso([LUFFY])
    const primeiro = await abrir(servidor, disco, app)
    await primeiro.ciclo()
    await primeiro.fechar()
    desligar.splice(0).forEach((fazer) => fazer())

    const reaberto = appFalso(app.rpg)
    const lerDeVerdade = disco.ler
    let mexeu = false
    disco.ler = async (nome) => {
      if (nome === 'fila.jsonl' && !mexeu) {
        // O dano entra no editor e o Salvar o leva ao `rpg.json` enquanto a fila é lida.
        mexeu = true
        mudarNoEditor(reaberto, { ...LUFFY, recursos: { ...LUFFY.recursos, hp: 290 } })
        reaberto.rpg = reaberto.aberta
      }
      return lerDeVerdade(nome)
    }
    const segundo = await abrir(servidor, disco, reaberto)
    await segundo.esvaziar()
    expect(mexeu).toBe(true)
    expect([hpDe(reaberto.aberta), hpDe(reaberto.rpg), segundo.situacao().esperando]).toEqual([290, 290, 1])
    await segundo.ciclo()
    expect(campanha.ficha(LUFFY.id)?.doc.recursos.hp).toBe(290)
  })

  it('negada pelo servidor fica para decidir (não some) e "guardar como nota" vai para negadas.jsonl', async () => {
    const campanha = campanhaDeTeste([], MEMBROS)
    publicar(campanha, [LUFFY])
    const servidor = servidorFalso(campanha)
    const disco = discoEmMemoria()
    const sincronizador = await abrir(servidor, disco, appFalso([LUFFY]))
    await sincronizador.ciclo()
    // Uma ficha que o servidor não tem: o servidor nega (o alvo não existe).
    sincronizador.destino.receber([{ ...op(MESTRE_NO_APP, 'pers_fantasma', ['nome'], 'definir', { valor: 'Fantasma', baseRev: 1 }), clienteId: sincronizador.destino.clienteId }])
    await sincronizador.ciclo()
    const [negada] = sincronizador.situacao().paraDecidir
    expect(negada?.situacao.t).toBe('negado')

    expect((await sincronizador.decidir(negada?.op.opId ?? '', 'guardar-como-nota')).ok).toBe(true)
    expect(sincronizador.situacao().paraDecidir).toEqual([])
    const [nota] = linhas(disco.arquivos.get('negadas.jsonl'))
    expect(ehRegistro(nota) ? [proprio(nota, 'opId'), proprio(nota, 'motivo')] : null).toEqual([negada?.op.opId, 'alvo-inexistente'])
  })
})
