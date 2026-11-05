import { describe, expect, it } from 'vitest'
import type { Personagem } from '../personagem'
import {
  AGORA,
  docDe,
  enviar,
  F_DO_MESTRE,
  F_NAMI,
  F_NAMI_2,
  F_SEM_DONO,
  F_ZORO,
  ficha,
  mesa,
  MESTRE_NO_APP,
  MESTRE_NO_SITE,
  NAMI_NO_PC,
  op,
  type CampanhaDeTeste,
} from './campanha.fixture'
import { TETOS_DO_CAMINHO } from './caminho'
import {
  armazenamentoEmTexto,
  criarFila,
  lerLinhasDaFila,
  lerRegistro,
  TETO_DA_FILA_EM_BYTES,
  type ArquivoDeTexto,
  type BaseConfirmada,
  type Fila,
  type ResultadoDasRemotas,
} from './fila'
import { bytesDoJson, paraJson } from './json'
import { LIMITES } from './limites'
import { respostasAdiadas, type RespostaDaOp } from './lote'
import { projetarOpParaJogador, projetarParaJogador } from './projecao'
import { VERSAO_DO_FORMATO, type Identidade, type Op, type Visibilidade } from './tipos'

/**
 * FILA OFFLINE (plano do Lobby §5.6-5.7, aceite da N3; testes liberados:
 * fila offline, e esquema/proteção pela 12.18). A mesa nunca para e toda
 * mudança fica salva: o que foi feito sem rede vai quando ela volta, com o
 * mesmo `opId`; o que o servidor recusa fica guardado até alguém decidir.
 */

const HP = ['recursos', 'hp']
const QTD_TANGERINA = ['mochila', 'vaga_tangerina', 'quantidade']
const FICHAS_DA_MESA = [F_NAMI, F_NAMI_2, F_ZORO, F_SEM_DONO]

// ── O disco, o cliente e o servidor de mentira ─────────────────────────────

interface ArquivoDeTeste extends ArquivoDeTexto {
  conteudo(): string
  /** A queda no meio do append: um pedaço de linha, sem a quebra. */
  cortarNoMeio(pedaco: string): void
  encherODisco(cheio: boolean): void
}

/** O `fila.jsonl` em memória, com o que o disco de verdade faz de ruim. */
function arquivoNaMemoria(): ArquivoDeTeste {
  let texto: string | null = null
  let cheio = false
  return {
    ler: async () => texto,
    async acrescentar(novo) {
      if (cheio) throw new Error('ENOSPC: disco cheio')
      texto = (texto ?? '') + novo
    },
    async reescrever(novo) {
      if (cheio) throw new Error('ENOSPC: disco cheio')
      texto = novo
    },
    conteudo: () => texto ?? '',
    cortarNoMeio(pedaco) {
      texto = (texto ?? '') + pedaco
    },
    encherODisco(sim) {
      cheio = sim
    },
  }
}

/** Quem usa a fila: o site da Nami recebe tudo projetado; o app do mestre, tudo. */
interface Cliente {
  fila: Fila
  quem: Identidade
  projetar: boolean
}

function comoNami(fila: Fila): Cliente {
  return { fila, quem: NAMI_NO_PC, projetar: true }
}

function comoMestreNoApp(fila: Fila): Cliente {
  return { fila, quem: MESTRE_NO_APP, projetar: false }
}

/** O `estado` que o site da Nami recebe: as fichas da mesa, projetadas (o NPC do mestre não vem). */
function baseDaNami(campanha: CampanhaDeTeste): BaseConfirmada {
  return { rev: campanha.revAtual(), fichas: FICHAS_DA_MESA.map((id) => projetarParaJogador(docDe(campanha, id))) }
}

function baseDoMestre(campanha: CampanhaDeTeste): BaseConfirmada {
  return { rev: campanha.revAtual(), fichas: [...FICHAS_DA_MESA, F_DO_MESTRE].map((id) => docDe(campanha, id)) }
}

function visivelDe(campanha: CampanhaDeTeste, fichaId: string): Visibilidade {
  const guardada = campanha.ficha(fichaId)
  if (guardada === undefined) throw new Error(`ficha ${fichaId} não existe na campanha de teste`)
  return guardada.visivel
}

/** O `desde`: as ops depois da base, como quem pede as vê (o jogador vê um buraco na numeração, de propósito). */
async function puxar(cliente: Cliente, campanha: CampanhaDeTeste): Promise<ResultadoDasRemotas> {
  const desde = cliente.fila.revConfirmada()
  const novas = campanha.todasAsOps().filter((gravada) => gravada.rev > desde)
  const lista = cliente.projetar
    ? novas.flatMap((gravada) => {
        const projetada = projetarOpParaJogador(gravada, visivelDe(campanha, gravada.fichaId))
        return projetada === null ? [] : [projetada]
      })
    : novas
  return cliente.fila.receberRemotas({ desde, ate: campanha.revAtual(), lista })
}

/** Um ciclo do sincronizador (§5.6): puxa o `desde`, manda em ordem, puxa o eco. Devolve as respostas na ordem. */
async function sincronizar(cliente: Cliente, campanha: CampanhaDeTeste, agora = AGORA): Promise<RespostaDaOp[]> {
  await puxar(cliente, campanha)
  const respostas: RespostaDaOp[] = []
  // Teto de voltas: um lote que não anda (bug) falha o teste em vez de travar.
  for (let volta = 0; volta < 20; volta += 1) {
    const lote = cliente.fila.paraEnviar(agora)
    if (lote.length === 0) break
    expect(lote.length).toBeLessThanOrEqual(LIMITES.opsPorLote)
    expect(bytesDoJson({ t: 'ops', lote })).toBeLessThanOrEqual(LIMITES.frameBytes)
    const resultado = enviar(campanha, cliente.quem, lote, agora)
    respostas.push(...resultado.respostas)
    await cliente.fila.receberRespostas(resultado.respostas)
  }
  await puxar(cliente, campanha)
  return respostas
}

function fichaNaVista(fila: Fila, fichaId: string): Personagem {
  const doc = fila.vistaLocal().get(fichaId)
  if (doc === undefined) throw new Error(`ficha ${fichaId} não está na vista`)
  return doc
}

/** As 10 mudanças da Nami sem rede, cada uma num campo da ficha dela. */
function dezMudancasDaNami(): Op[] {
  return [
    op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 }),
    op(NAMI_NO_PC, F_NAMI, ['recursos', 'mp'], 'definir', { valor: 40 }),
    op(NAMI_NO_PC, F_NAMI, ['atributos', 'forca'], 'definir', { valor: 8 }),
    op(NAMI_NO_PC, F_NAMI, ['atributos', 'destreza'], 'definir', { valor: 16 }),
    op(NAMI_NO_PC, F_NAMI, ['escolhas', 'classe'], 'definir', { valor: 'Navegadora' }),
    op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'Desenha o mapa do mundo' }),
    op(NAMI_NO_PC, F_NAMI, ['cartoesAtivos', 'cart_clima'], 'definir', { valor: true }),
    op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', 'cart_clima', 'campos', 'dano'], 'definir', { valor: '2d6' }),
    op(NAMI_NO_PC, F_NAMI, ['moedas'], 'somar', { delta: 50 }),
    op(NAMI_NO_PC, F_NAMI, QTD_TANGERINA, 'somar', { delta: 2 }),
  ]
}

/** O mestre, no site, mexendo em outros 3 campos da ficha da Nami enquanto ela está sem rede. */
function tresDoMestre(): Op[] {
  return [
    op(MESTRE_NO_SITE, F_NAMI, ['nome'], 'definir', { valor: 'Nami, a Gata Ladra' }),
    op(MESTRE_NO_SITE, F_NAMI, ['maximos', 'hp'], 'definir', { valor: 320 }),
    op(MESTRE_NO_SITE, F_NAMI, ['modificadoresDosAtributos', 'forca'], 'definir', { valor: 1 }),
  ]
}

/** A troca da mesa feita no app: Nami dá 1 Tangerina ao Zoro e ele paga 10 moedas. Tudo ou nada. */
function troca(loteId: string): Op[] {
  const tudoOuNada: { atomico: true; loteId: string } = { atomico: true, loteId }
  return [
    op(MESTRE_NO_APP, F_NAMI, QTD_TANGERINA, 'somar', { delta: -1, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_ZORO, ['mochila', 'vaga_tangerina_zoro'], 'criar', { valor: { id: 'vaga_tangerina_zoro', nome: 'Tangerina' }, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: -10, ...tudoOuNada }),
    op(MESTRE_NO_APP, F_NAMI, ['moedas'], 'somar', { delta: 10, ...tudoOuNada }),
  ]
}

function ids(ops: readonly Op[]): string[] {
  return ops.map((cada) => cada.opId)
}

// ── Aceite da N3 ────────────────────────────────────────────────────────────

describe('sem rede e de volta', () => {
  it('10 mudanças offline + 3 remotas em campos diferentes: todas aplicadas', async () => {
    const campanha = mesa()
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivoNaMemoria()), baseDaNami(campanha)))
    const minhas = dezMudancasDaNami()
    expect(await nami.fila.acrescentar(minhas)).toEqual({ ok: true })
    // Sem rede: a vista já mostra as 10, e nada foi ao servidor.
    expect(fichaNaVista(nami.fila, F_NAMI)).toMatchObject({ recursos: { hp: 280, mp: 40 }, moedas: 150, mochila: [{ quantidade: 5 }] })
    expect(nami.fila.esperando()).toBe(10)
    for (const remota of tresDoMestre()) enviar(campanha, MESTRE_NO_SITE, [remota])

    // A rede volta: primeiro puxa; a base anda e as 10 são reaplicadas por cima (rebase).
    expect(await puxar(nami, campanha)).toEqual({ t: 'ok', aplicadas: 3, naoAplicaveis: [] })
    expect(fichaNaVista(nami.fila, F_NAMI)).toMatchObject({ nome: 'Nami, a Gata Ladra', maximos: { hp: 320 }, recursos: { hp: 280 }, moedas: 150 })

    const respostas = await sincronizar(nami, campanha)
    expect(respostas).toEqual(minhas.map((minha, indice) => ({ t: 'ack', opId: minha.opId, rev: 4 + indice })))
    expect(nami.fila.entradas()).toEqual([])
    const vista = fichaNaVista(nami.fila, F_NAMI)
    expect(vista).toEqual(projetarParaJogador(docDe(campanha, F_NAMI)))
    expect(vista).toMatchObject({
      nome: 'Nami, a Gata Ladra',
      descricao: 'Desenha o mapa do mundo',
      recursos: { hp: 280, mp: 40 },
      maximos: { hp: 320 },
      atributos: { forca: 8, destreza: 16 },
      modificadoresDosAtributos: { forca: 1 },
      escolhas: { classe: 'Navegadora' },
      cartoesAtivos: ['cart_clima'],
      abas: { tecnicas: [{ campos: { dano: '2d6' } }] },
      moedas: 150,
      mochila: [{ id: 'vaga_tangerina', quantidade: 5 }],
    })
  })

  it('1 remota no mesmo campo: 1 conflito e 9 acks; o campo fica com o valor do servidor', async () => {
    const campanha = mesa()
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivoNaMemoria()), baseDaNami(campanha)))
    const minhas = dezMudancasDaNami()
    await nami.fila.acrescentar(minhas)
    const [nome, maximo] = tresDoMestre()
    for (const remota of [nome, maximo, op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })]) enviar(campanha, MESTRE_NO_SITE, [remota])

    const respostas = await sincronizar(nami, campanha)
    const conflito = { opId: minhas[0].opId, valorAtual: 250, quem: 'Mestre', quando: AGORA, revAtual: 3 }
    expect(respostas.filter((resposta) => resposta.t === 'ack')).toHaveLength(9)
    expect(respostas.filter((resposta) => resposta.t !== 'ack')).toEqual([{ t: 'conflito', ...conflito }])
    expect(nami.fila.paraDecidir()).toEqual([{ op: minhas[0], situacao: { t: 'conflito', conflito }, versao: VERSAO_DO_FORMATO }])
    expect(nami.fila.esperando()).toBe(0)
    // As 9 aceitas entraram; a Vida mostra a do mestre até a Nami escolher.
    const vista = fichaNaVista(nami.fila, F_NAMI)
    expect(vista).toEqual(projetarParaJogador(docDe(campanha, F_NAMI)))
    expect(vista).toMatchObject({ recursos: { hp: 250, mp: 40 }, moedas: 150, nome: 'Nami, a Gata Ladra' })
  })

  it('reenvio depois da queda (resposta perdida, app reaberto): mesmas revs, nada gravado duas vezes', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const fila = await criarFila(armazenamentoEmTexto(arquivo), base)
    const minhas = dezMudancasDaNami()
    await fila.acrescentar(minhas)
    // O servidor grava, mas a conexão cai antes de as respostas chegarem.
    const primeira = enviar(campanha, NAMI_NO_PC, fila.paraEnviar(AGORA))
    expect(campanha.todasAsOps()).toHaveLength(10)

    const reaberta = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    expect(reaberta.fila.esperando()).toBe(10)
    const lote = reaberta.fila.paraEnviar(AGORA)
    expect(ids(lote)).toEqual(ids(minhas))
    const segunda = enviar(campanha, NAMI_NO_PC, lote)
    expect(segunda.respostas).toEqual(primeira.respostas)
    expect(campanha.todasAsOps()).toHaveLength(10)
    await reaberta.fila.receberRespostas(segunda.respostas)
    await puxar(reaberta, campanha)
    expect(reaberta.fila.entradas()).toEqual([])
    // A soma entrou uma vez só, no servidor e na vista.
    expect(docDe(campanha, F_NAMI)).toMatchObject({ moedas: 150, mochila: [{ quantidade: 5 }] })
    expect(fichaNaVista(reaberta.fila, F_NAMI)).toEqual(projetarParaJogador(docDe(campanha, F_NAMI)))
  })

  it('o eco no desde vale como ack: a soma não entra duas vezes, nada é reenviado, nem depois de reabrir', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    await nami.fila.acrescentar(dezMudancasDaNami())
    enviar(campanha, NAMI_NO_PC, nami.fila.paraEnviar(AGORA))
    // Volta e puxa primeiro: as próprias ops chegam pelo desde antes do ack.
    await puxar(nami, campanha)
    expect(nami.fila.esperando()).toBe(0)
    expect(nami.fila.paraEnviar(AGORA)).toEqual([])
    expect(fichaNaVista(nami.fila, F_NAMI)).toMatchObject({ moedas: 150, mochila: [{ quantidade: 5 }] })

    // Reaberta com a base velha: os acks do eco ficaram gravados; a vista não soma de novo, e nada vai.
    const reaberta = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    expect(reaberta.fila.esperando()).toBe(0)
    expect(fichaNaVista(reaberta.fila, F_NAMI)).toMatchObject({ moedas: 150, mochila: [{ quantidade: 5 }] })
    await puxar(reaberta, campanha)
    expect(reaberta.fila.entradas()).toEqual([])
    expect(fichaNaVista(reaberta.fila, F_NAMI)).toEqual(projetarParaJogador(docDe(campanha, F_NAMI)))
  })

  it('a numeração com buraco de propósito (op que o jogador não vê) não trava; lista que começa depois da base é buraco', async () => {
    const campanha = mesa()
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivoNaMemoria()), baseDaNami(campanha)))
    enviar(campanha, MESTRE_NO_APP, [op(MESTRE_NO_APP, F_DO_MESTRE, HP, 'definir', { valor: 999 })])
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_ZORO, HP, 'definir', { valor: 150 })])
    expect(await nami.fila.receberRemotas({ desde: 1, ate: 2, lista: [] })).toEqual({ t: 'buraco' })
    expect(await puxar(nami, campanha)).toEqual({ t: 'ok', aplicadas: 1, naoAplicaveis: [] })
    expect(nami.fila.revConfirmada()).toBe(2)
    expect(fichaNaVista(nami.fila, F_ZORO).recursos.hp).toBe(150)
    expect(nami.fila.vistaLocal().has(F_DO_MESTRE)).toBe(false)
  })
})

describe('o arquivo da fila', () => {
  it('linha cortada no fim é ignorada, e a próxima gravação começa numa linha nova', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const fila = await criarFila(armazenamentoEmTexto(arquivo), base)
    const [a, b, c, d] = dezMudancasDaNami()
    await fila.acrescentar([a, b, c])
    // O app caiu no meio do append da quarta: meia linha, sem a quebra. Ela nunca apareceu como feita.
    arquivo.cortarNoMeio(JSON.stringify({ t: 'op', v: VERSAO_DO_FORMATO, ...d }).slice(0, 40))

    const reaberta = await criarFila(armazenamentoEmTexto(arquivo), base)
    expect(reaberta.ignoradosAoAbrir).toBe(1)
    expect(ids(reaberta.entradas().map((entrada) => entrada.op))).toEqual(ids([a, b, c]))
    // A pessoa refaz a quarta; a linha nova não gruda na cortada.
    expect(await reaberta.acrescentar([d])).toEqual({ ok: true })

    const deNovo = await criarFila(armazenamentoEmTexto(arquivo), base)
    expect(deNovo.ignoradosAoAbrir).toBe(1)
    expect(ids(deNovo.entradas().map((entrada) => entrada.op))).toEqual(ids([a, b, c, d]))
    expect(deNovo.vistaLocal()).toEqual(reaberta.vistaLocal())
  })

  it('sem os opcionais: fila sem base, ficha só na vista, conflito sem valorAtual e negado sem detalhe voltam iguais ao reabrir', async () => {
    const vazia = await criarFila(armazenamentoEmTexto(arquivoNaMemoria()))
    expect(vazia.revConfirmada()).toBe(0)
    expect(vazia.vistaLocal().size).toBe(0)
    await vazia.acrescentar([op(MESTRE_NO_APP, 'pers_robin', [], 'criar', { valor: paraJson(ficha('pers_robin')) })])
    expect(fichaNaVista(vazia, 'pers_robin')).toMatchObject({ nome: 'robin', recursos: { hp: 300 } })

    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    const naApagada = op(NAMI_NO_PC, F_NAMI_2, HP, 'definir', { valor: 10 })
    const deVersaoVelha = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 11 })
    await nami.fila.acrescentar([naApagada, deVersaoVelha])
    // O mestre apaga a segunda ficha da Nami (apagar não leva valor) antes de a mudança dela chegar.
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI_2, [], 'apagar')])
    await puxar(nami, campanha)
    const doServidor = enviar(campanha, NAMI_NO_PC, [naApagada]).respostas
    await nami.fila.receberRespostas([...doServidor, { t: 'negado', opId: deVersaoVelha.opId, motivo: 'versao' }])

    const reaberta = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    await puxar(reaberta, campanha)
    expect(reaberta.fila.ignoradosAoAbrir).toBe(0)
    const situacoes = reaberta.fila.paraDecidir().map((entrada) => entrada.situacao)
    expect(situacoes).toEqual([
      { t: 'conflito', conflito: { opId: naApagada.opId, quem: 'Mestre', quando: AGORA, revAtual: 1, fichaApagada: true } },
      { t: 'negado', motivo: 'versao' },
    ])
    expect(situacoes.map((situacao) => Object.keys(situacao.t === 'conflito' ? situacao.conflito : situacao).sort())).toEqual([
      ['fichaApagada', 'opId', 'quando', 'quem', 'revAtual'],
      ['motivo', 't'],
    ])
    // A ficha apagada some da vista (a escolha é "recriar"); a negada mostra o valor local.
    expect(reaberta.fila.vistaLocal().has(F_NAMI_2)).toBe(false)
    expect(fichaNaVista(reaberta.fila, F_NAMI).recursos.hp).toBe(11)
  })

  it('disco cheio: a gravação falha, a mudança não aparece como feita, e a fila segue quando o disco volta', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const fila = await criarFila(armazenamentoEmTexto(arquivo), baseDaNami(campanha))
    const vida = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    arquivo.encherODisco(true)
    await expect(fila.acrescentar([vida])).rejects.toThrow('disco cheio')
    expect(fila.entradas()).toEqual([])
    expect(fichaNaVista(fila, F_NAMI).recursos.hp).toBe(300)
    arquivo.encherODisco(false)
    expect(await fila.acrescentar([vida])).toEqual({ ok: true })
    expect(fichaNaVista(fila, F_NAMI).recursos.hp).toBe(280)
  })

  it('compacta só com tudo respondido e acima de 256 KB, guardando o que espera decisão', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDoMestre(campanha)
    const mestre = comoMestreNoApp(await criarFila(armazenamentoEmTexto(arquivo), base))
    // O mestre, no site, muda a Vida antes: a mesma mudança vinda do app (outro aparelho) vira conflito.
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 200 })])
    const vidaNoApp = op(MESTRE_NO_APP, F_NAMI, HP, 'definir', { valor: 210 })
    const diario = 'Diário de bordo. '.repeat(300)
    const descricoes = Array.from({ length: 60 }, (_, indice) => op(MESTRE_NO_APP, F_NAMI, ['descricao'], 'definir', { valor: `${indice}: ${diario}` }))
    await mestre.fila.acrescentar([vidaNoApp, ...descricoes])
    expect(arquivo.conteudo().length).toBeGreaterThan(TETO_DA_FILA_EM_BYTES)
    // Passou do teto, mas 61 ainda esperam o servidor: não mexe.
    expect(await mestre.fila.compactarSePreciso()).toBe(false)

    await sincronizar(mestre, campanha)
    expect(mestre.fila.paraDecidir().map((entrada) => entrada.op.opId)).toEqual([vidaNoApp.opId])
    expect(await mestre.fila.compactarSePreciso()).toBe(true)
    const sobrou = lerLinhasDaFila(arquivo.conteudo()).registros.map((bruto) => lerRegistro(bruto))
    expect(sobrou.map((registro) => (registro === null ? null : [registro.t, registro.opId]))).toEqual([
      ['op', vidaNoApp.opId],
      ['conflito', vidaNoApp.opId],
    ])

    const reaberta = await criarFila(armazenamentoEmTexto(arquivo), base)
    expect(reaberta.paraDecidir().map((entrada) => entrada.situacao)).toEqual(mestre.fila.paraDecidir().map((entrada) => entrada.situacao))
    expect(reaberta.esperando()).toBe(0)
    expect(await reaberta.compactarSePreciso()).toBe(false)
  })
})

describe('o que espera decisão', () => {
  async function namiComConflitoNaVida(arquivo: ArquivoDeTeste, campanha: CampanhaDeTeste): Promise<{ nami: Cliente; daNami: Op }> {
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivo), baseDaNami(campanha)))
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    await nami.fila.acrescentar([daNami])
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    await sincronizar(nami, campanha)
    return { nami, daNami }
  }

  it('o conflito fica gravado: sobrevive a recriar a fila e só sai com resolvido ("Ficar com 250")', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const { nami, daNami } = await namiComConflitoNaVida(arquivo, campanha)
    const decisoes = nami.fila.paraDecidir()
    expect(decisoes.map((entrada) => entrada.situacao)).toEqual([
      { t: 'conflito', conflito: { opId: daNami.opId, valorAtual: 250, quem: 'Mestre', quando: AGORA, revAtual: 1 } },
    ])

    const reaberta = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    await puxar(reaberta, campanha)
    expect(reaberta.fila.paraDecidir()).toEqual(decisoes)
    expect(reaberta.fila.paraEnviar(AGORA)).toEqual([])
    expect(fichaNaVista(reaberta.fila, F_NAMI).recursos.hp).toBe(250)

    // "Ficar com 250": nada vai ao servidor; a decisão fica gravada.
    expect(await reaberta.fila.resolver(daNami.opId)).toEqual({ ok: true })
    expect(await reaberta.fila.resolver(daNami.opId)).toMatchObject({ ok: false, problemas: [{ motivo: 'sem-decisao' }] })
    const depois = await criarFila(armazenamentoEmTexto(arquivo), base)
    expect(depois.entradas()).toEqual([])
    expect(campanha.todasAsOps()).toHaveLength(1)
  })

  it('"Usar a minha": a op nova cita a recusada, vai com a rev de agora, e a decisão sai junto', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const { nami, daNami } = await namiComConflitoNaVida(arquivo, campanha)
    const semCitar = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280, baseRev: 1 })
    expect(await nami.fila.resolver(daNami.opId, semCitar)).toMatchObject({ ok: false, problemas: [{ opId: semCitar.opId, motivo: 'fora-do-esquema' }] })
    expect(await nami.fila.acrescentar([{ ...semCitar, resolve: daNami.opId }])).toMatchObject({ ok: false })

    const usarAMinha = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280, baseRev: 1, resolve: daNami.opId })
    expect(await nami.fila.resolver(daNami.opId, usarAMinha)).toEqual({ ok: true })
    expect(nami.fila.paraDecidir()).toEqual([])
    expect(fichaNaVista(nami.fila, F_NAMI).recursos.hp).toBe(280)
    expect(await sincronizar(nami, campanha)).toEqual([{ t: 'ack', opId: usarAMinha.opId, rev: 2 }])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(280)

    const reaberta = await criarFila(armazenamentoEmTexto(arquivo), baseDaNami(campanha))
    expect(reaberta.entradas()).toEqual([])
  })

  it('op negada fica como "precisa de decisão": não some, não é reenviada, sobrevive a recriar e só sai com resolvido', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const base = baseDaNami(campanha)
    const nami = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    // Na ficha do Zoro: o site não deixaria, mas a permissão pode mudar entre a edição e o envio.
    const alheia = op(NAMI_NO_PC, F_ZORO, HP, 'definir', { valor: 1 })
    await nami.fila.acrescentar([alheia])
    const respostas = await sincronizar(nami, campanha)
    expect(respostas).toMatchObject([{ t: 'negado', opId: alheia.opId, motivo: 'sem-permissao' }])
    expect(nami.fila.paraDecidir().map((entrada) => [entrada.op.opId, entrada.situacao.t])).toEqual([[alheia.opId, 'negado']])
    // Até decidir, a ficha mostra o valor local (com o selo "não aceito pelo servidor").
    expect(fichaNaVista(nami.fila, F_ZORO).recursos.hp).toBe(1)
    expect(nami.fila.paraEnviar(AGORA)).toEqual([])

    const reaberta = comoNami(await criarFila(armazenamentoEmTexto(arquivo), base))
    await puxar(reaberta, campanha)
    expect(reaberta.fila.paraDecidir()).toEqual(nami.fila.paraDecidir())
    expect(reaberta.fila.esperando()).toBe(0)
    expect(reaberta.fila.paraEnviar(AGORA)).toEqual([])
    // "Usar a minha" não vale na negada: mandar igual seria negada de novo.
    const deNovo = op(NAMI_NO_PC, F_ZORO, HP, 'definir', { valor: 1, resolve: alheia.opId })
    expect(await reaberta.fila.resolver(alheia.opId, deNovo)).toMatchObject({ ok: false, problemas: [{ motivo: 'sem-decisao' }] })

    // "Desfazer aqui": a ficha volta ao valor do servidor.
    expect(await reaberta.fila.resolver(alheia.opId)).toEqual({ ok: true })
    expect(fichaNaVista(reaberta.fila, F_ZORO).recursos.hp).toBe(300)
    expect((await criarFila(armazenamentoEmTexto(arquivo), base)).entradas()).toEqual([])
    expect(campanha.todasAsOps()).toEqual([])
  })

  it('op adiada continua pendente e vai de novo com o mesmo opId, sem a nova passar na frente', async () => {
    const campanha = mesa()
    const fila = await criarFila(armazenamentoEmTexto(arquivoNaMemoria()), baseDaNami(campanha))
    const minhas = dezMudancasDaNami().slice(0, 3)
    await fila.acrescentar(minhas)
    // O servidor recusou o frame pelo ritmo: cada op volta adiada, nunca negada.
    await fila.receberRespostas(respostasAdiadas(fila.paraEnviar(AGORA), 'ritmo', AGORA + 2000))
    expect(fila.esperando()).toBe(3)
    expect(fila.paraDecidir()).toEqual([])
    expect(fila.entradas().map((entrada) => entrada.situacao)).toEqual(minhas.map(() => ({ t: 'pendente', tentarDepoisDe: AGORA + 2000, motivoDoAdiamento: 'ritmo' })))
    expect(fila.paraEnviar(AGORA)).toEqual([])

    const nova = op(NAMI_NO_PC, F_NAMI, ['escolhas', 'sonho'], 'definir', { valor: 'Mapa do mundo' })
    await fila.acrescentar([nova])
    expect(fila.paraEnviar(AGORA + 1999)).toEqual([])
    const reenvio = fila.paraEnviar(AGORA + 2000)
    expect(ids(reenvio)).toEqual(ids([...minhas, nova]))
    const resultado = enviar(campanha, NAMI_NO_PC, reenvio, AGORA + 2000)
    expect(resultado.respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack', 'ack', 'ack'])
    await fila.receberRespostas(resultado.respostas)
    expect(fila.esperando()).toBe(0)
  })
})

describe('o que nem entra na fila (o mesmo esquema e os mesmos tetos do servidor)', () => {
  it('fora do esquema, acima do teto, desfazer pela fila, base que não chegou, id repetido: nada gravado, a vista não muda', async () => {
    const campanha = mesa()
    const arquivo = arquivoNaMemoria()
    const fila = await criarFila(armazenamentoEmTexto(arquivo), baseDaNami(campanha))
    const antes = fichaNaVista(fila, F_NAMI)
    const valida = op(NAMI_NO_PC, F_NAMI, ['atributos', 'forca'], 'definir', { valor: 9 })
    const casos: [Op, string][] = [
      [op(NAMI_NO_PC, F_NAMI, ['__proto__', 'hp'], 'definir', { valor: 1 }), 'fora-do-esquema'],
      [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: Number.NaN }), 'fora-do-esquema'],
      [op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'x'.repeat(TETOS_DO_CAMINHO.descricaoBytes + 1) }), 'acima-do-teto'],
      [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1, desfaz: 'op_qualquer' }), 'fora-do-esquema'],
      [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 1, baseRev: 5 }), 'base-invalida'],
    ]
    for (const [errada, motivo] of casos) {
      // Junto com uma válida: uma recusada e nenhuma entra (é uma ação só da pessoa).
      expect(await fila.acrescentar([valida, errada])).toEqual({ ok: false, problemas: [{ opId: errada.opId, motivo, detalhe: expect.any(String) }] })
    }
    expect(arquivo.conteudo()).toBe('')
    expect(fila.entradas()).toEqual([])
    expect(fichaNaVista(fila, F_NAMI)).toEqual(antes)

    expect(await fila.acrescentar([valida])).toEqual({ ok: true })
    expect(await fila.acrescentar([valida])).toMatchObject({ ok: false, problemas: [{ motivo: 'repetida' }] })
    expect(fila.entradas()).toHaveLength(1)
  })

  it('tudo ou nada na vista: a troca que não cabe fica toda de fora; a que cabe entra inteira', async () => {
    const campanha = mesa()
    const fila = await criarFila(armazenamentoEmTexto(arquivoNaMemoria()), baseDoMestre(campanha))
    // O Zoro não tem moedas: pagar 10 não cabe, então a Tangerina também não sai da Nami.
    await fila.acrescentar(troca('lote_sem_moedas'))
    expect(fichaNaVista(fila, F_NAMI)).toMatchObject({ moedas: 100, mochila: [{ quantidade: 3 }] })
    expect(fichaNaVista(fila, F_ZORO).mochila).toBeUndefined()
    expect(fila.esperando()).toBe(4)

    await fila.acrescentar([op(MESTRE_NO_APP, F_ZORO, ['moedas'], 'somar', { delta: 20 }), ...troca('lote_com_moedas')])
    expect(fichaNaVista(fila, F_NAMI)).toMatchObject({ moedas: 110, mochila: [{ quantidade: 2 }] })
    expect(fichaNaVista(fila, F_ZORO)).toMatchObject({ moedas: 10, mochila: [{ id: 'vaga_tangerina_zoro' }] })
  })
})
