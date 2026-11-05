import { describe, expect, it } from 'vitest'
import {
  AGORA,
  campanhaDeTeste,
  cartao,
  docDe,
  enviar,
  F_NAMI,
  F_ZORO,
  ficha,
  guardada,
  mesa,
  MESTRE_NO_APP,
  MESTRE_NO_SITE,
  NAMI,
  NAMI_NO_CELULAR,
  NAMI_NO_PC,
  op,
  TANGERINA,
  ZORO,
  ZORO_NO_SITE,
} from './campanha.fixture'
import { chaveDaEtiqueta } from './caminho'
import { caminhosSeSobrepoem, valorNoCaminho } from './conflito'
import { paraJson } from './json'

const F_SEM_OPCIONAIS = 'pers_chopper'

/**
 * CONFLITO (plano do Lobby §5.2, aceite da N2; testes liberados: mescla).
 * Mudança pequena por campo: campos diferentes nunca brigam; o mesmo campo
 * mudado quase junto por outra pessoa ou outro aparelho vira conflito para
 * quem chegou em segundo, com as duas escolhas.
 */

const HP = ['recursos', 'hp']

describe('mesmo campo, autorias diferentes', () => {
  it('dois autores no mesmo campo: o segundo é recusado com o valor de agora e quem mudou', () => {
    const campanha = mesa()
    const doMestre = op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })
    // A Nami editou a partir da ficha que viu (rev 0), antes de a mudança do mestre chegar.
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    expect(enviar(campanha, MESTRE_NO_SITE, [doMestre]).respostas).toEqual([{ t: 'ack', opId: doMestre.opId, rev: 1 }])
    expect(enviar(campanha, NAMI_NO_PC, [daNami]).respostas).toEqual([{ t: 'conflito', opId: daNami.opId, valorAtual: 250, quem: 'Mestre', quando: AGORA, revAtual: 1 }])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(250)
    // A recusada fica guardada até alguém decidir: nunca some.
    expect(campanha.todasAsRecusadas().map((recusada) => [recusada.opId, recusada.autorContaId])).toEqual([[daNami.opId, NAMI.contaId]])
  })

  it('"Usar a minha": op nova com a rev de agora e resolve = a recusada', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const daNami = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280 })
    enviar(campanha, NAMI_NO_PC, [daNami])
    const usarAMinha = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 280, baseRev: 1, resolve: daNami.opId })
    expect(enviar(campanha, NAMI_NO_PC, [usarAMinha]).respostas).toEqual([{ t: 'ack', opId: usarAMinha.opId, rev: 2 }])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(280)
    expect(campanha.todasAsOps().at(-1)).toMatchObject({ resolve: daNami.opId, antes: 250 })
  })

  it('o mesmo jogador em dois aparelhos (clienteIds diferentes) conflita', () => {
    const campanha = mesa()
    enviar(campanha, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 250 })])
    const doCelular = op(NAMI_NO_CELULAR, F_NAMI, HP, 'definir', { valor: 200 })
    expect(enviar(campanha, NAMI_NO_CELULAR, [doCelular]).respostas).toEqual([{ t: 'conflito', opId: doCelular.opId, valorAtual: 250, quem: 'Nami', quando: AGORA, revAtual: 1 }])
  })

  it('o mestre no app e no site conflita consigo', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_APP, [op(MESTRE_NO_APP, F_ZORO, HP, 'definir', { valor: 120 })])
    const doSite = op(MESTRE_NO_SITE, F_ZORO, HP, 'definir', { valor: 90 })
    expect(enviar(campanha, MESTRE_NO_SITE, [doSite]).respostas[0]).toMatchObject({ t: 'conflito', valorAtual: 120, quem: 'Mestre' })
  })

  it('dois jogadores na mesa LAN (mesmo app, autor declarado diferente) conflitam', () => {
    const campanha = mesa()
    const daNami = op(MESTRE_NO_APP, F_ZORO, HP, 'definir', { valor: 250, autorDeclarado: NAMI.contaId })
    const doZoro = op(MESTRE_NO_APP, F_ZORO, HP, 'definir', { valor: 200, autorDeclarado: ZORO.contaId })
    expect(enviar(campanha, MESTRE_NO_APP, [daNami]).respostas[0]).toMatchObject({ t: 'ack' })
    expect(enviar(campanha, MESTRE_NO_APP, [doZoro]).respostas[0]).toMatchObject({ t: 'conflito', quem: 'Nami', valorAtual: 250 })
  })
})

describe('sem conflito', () => {
  it('campos diferentes da mesma ficha passam, mesmo da mesma base', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const descricao = op(NAMI_NO_PC, F_NAMI, ['descricao'], 'definir', { valor: 'Navegadora' })
    const dano = op(NAMI_NO_PC, F_NAMI, ['abas', 'tecnicas', 'cart_clima', 'campos', 'dano'], 'definir', { valor: '2d6' })
    expect(enviar(campanha, NAMI_NO_PC, [descricao, dano]).respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack'])
    const doc = docDe(campanha, F_NAMI)
    expect([doc.recursos.hp, doc.descricao, doc.abas.tecnicas[0].campos.dano]).toEqual([250, 'Navegadora', '2d6'])
  })

  it('a fila offline do mesmo aparelho passa em sequência, toda da mesma base', () => {
    const campanha = mesa()
    const fila = [250, 220, 180].map((valor) => op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor }))
    // Reenviada aos poucos (um frame por vez), sempre com a base de quando ficou offline.
    const respostas = fila.flatMap((pendente) => enviar(campanha, NAMI_NO_PC, [pendente]).respostas)
    expect(respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack', 'ack'])
    expect(docDe(campanha, F_NAMI).recursos.hp).toBe(180)
  })

  it('mudança antes da base não conflita: o autor já a tinha visto', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, HP, 'definir', { valor: 250 })])
    const viuAMudanca = op(NAMI_NO_PC, F_NAMI, HP, 'definir', { valor: 240, baseRev: 1 })
    expect(enviar(campanha, NAMI_NO_PC, [viuAMudanca]).respostas[0]).toMatchObject({ t: 'ack', rev: 2 })
  })
})

describe('caminho que sobrepõe', () => {
  const CARTAO = ['abas', 'tecnicas', 'cart_clima']
  const DANO = [...CARTAO, 'campos', 'dano']

  it('apagar o cartão × mudar um campo dele = conflito (nas duas ordens)', () => {
    const apagouPrimeiro = mesa()
    enviar(apagouPrimeiro, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, CARTAO, 'apagar')])
    const campo = op(NAMI_NO_PC, F_NAMI, DANO, 'definir', { valor: '2d6' })
    const resposta = enviar(apagouPrimeiro, NAMI_NO_PC, [campo]).respostas[0]
    expect(resposta).toMatchObject({ t: 'conflito', quem: 'Mestre' })
    // O cartão não existe mais: o valor de agora é "ausente".
    expect(resposta.t === 'conflito' && 'valorAtual' in resposta).toBe(false)

    const mudouPrimeiro = mesa()
    enviar(mudouPrimeiro, NAMI_NO_PC, [op(NAMI_NO_PC, F_NAMI, DANO, 'definir', { valor: '2d6' })])
    const apagar = op(MESTRE_NO_SITE, F_NAMI, CARTAO, 'apagar')
    expect(enviar(mudouPrimeiro, MESTRE_NO_SITE, [apagar]).respostas[0]).toMatchObject({ t: 'conflito', quem: 'Nami', valorAtual: { id: 'cart_clima', campos: { dano: '2d6' } } })
    expect(docDe(mudouPrimeiro, F_NAMI).abas.tecnicas).toHaveLength(1)
  })

  it('tirar o item × mexer na quantidade dele = conflito', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, ['mochila', 'vaga_tangerina'], 'apagar')])
    const comer = op(NAMI_NO_PC, F_NAMI, ['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: -1 })
    expect(enviar(campanha, NAMI_NO_PC, [comer]).respostas[0]).toMatchObject({ t: 'conflito', quem: 'Mestre' })
  })

  it('quantidade sem número gravado aparece como 1 no conflito (o ausente da pilha)', () => {
    const campanha = mesa()
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_NAMI, ['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: -2 })])
    const comer = op(NAMI_NO_PC, F_NAMI, ['mochila', 'vaga_tangerina', 'quantidade'], 'somar', { delta: -1 })
    expect(enviar(campanha, NAMI_NO_PC, [comer]).respostas[0]).toMatchObject({ t: 'conflito', valorAtual: 1 })
  })

  it('ficha apagada = conflito com a escolha "recriar"; o mestre recria', () => {
    const campanha = mesa()
    const zoro = docDe(campanha, F_ZORO)
    enviar(campanha, MESTRE_NO_SITE, [op(MESTRE_NO_SITE, F_ZORO, [], 'apagar')])
    const doZoro = op(ZORO_NO_SITE, F_ZORO, HP, 'definir', { valor: 10, baseRev: 1 })
    expect(enviar(campanha, ZORO_NO_SITE, [doZoro]).respostas[0]).toEqual({ t: 'conflito', opId: doZoro.opId, quem: 'Mestre', quando: AGORA, revAtual: 1, fichaApagada: true })
    const recriar = op(MESTRE_NO_SITE, F_ZORO, [], 'criar', { valor: paraJson(zoro), baseRev: 1 })
    expect(enviar(campanha, MESTRE_NO_SITE, [recriar]).respostas[0]).toMatchObject({ t: 'ack', rev: 2 })
    expect(campanha.ficha(F_ZORO)).toMatchObject({ apagada: false, rev: 2, doc: zoro })
  })

  it('ficha sem nenhum campo opcional: o valor de agora sai sem quebrar em todo tipo de caminho', () => {
    const minima = ficha('pers_minima', { abas: {} })
    const ausentes = [
      ['mochila', 'v1'],
      ['mochila', 'v1', 'quantidade'],
      ['mochila', 'v1', 'nome'],
      ['abas', 'tecnicas', 'c1'],
      ['abas', 'tecnicas', 'c1', 'subcartoes', '#ordem'],
      ['abas', 'tecnicas', 'c1', 'campos', 'dano'],
      ['abas', 'tecnicas', 'c1', 'imagem'],
      ['dbt', 'pdl'],
      ['dbt', 'npc'],
      ['notaDoMestre'],
      ['dono'],
      ['escolhas', 'raca'],
      ['etiquetas', chaveDaEtiqueta('Pirata')],
    ]
    for (const caminho of ausentes) expect(valorNoCaminho(minima, caminho), caminho.join('/')).toBeUndefined()
    expect(valorNoCaminho(minima, ['moedas'])).toBe(0)
    expect(valorNoCaminho(minima, ['abas', 'tecnicas', '#ordem'])).toEqual([])
    expect(valorNoCaminho(minima, ['cartoesAtivos', 'c1'])).toBe(false)
    expect(valorNoCaminho(minima, ['retrato'])).toBeNull()
    expect(valorNoCaminho(null, ['nome'])).toBeUndefined()
    // E com valor: dentro de subcartão, a ordem dos subcartões, a quantidade gravada.
    const cheia = ficha('pers_cheia', {
      abas: { tecnicas: [cartao('c1', 'Pai', { subcartoes: [cartao('c2', 'Filho', { campos: { dano: '3d6' } })] })] },
      mochila: [TANGERINA],
    })
    expect(valorNoCaminho(cheia, ['abas', 'tecnicas', 'c1', 'subcartoes', 'c2', 'campos', 'dano'])).toBe('3d6')
    expect(valorNoCaminho(cheia, ['abas', 'tecnicas', 'c1', 'subcartoes', '#ordem'])).toEqual(['c2'])
    expect(valorNoCaminho(cheia, ['mochila', 'vaga_tangerina', 'quantidade'])).toBe(3)
  })

  it('ficha sem nenhum campo opcional atravessa o lote: moedas e mochila nascem, e o conflito mostra o ausente', () => {
    const campanha = campanhaDeTeste([guardada(ficha(F_SEM_OPCIONAIS, { abas: {} }))])
    const moedas = op(MESTRE_NO_SITE, F_SEM_OPCIONAIS, ['moedas'], 'somar', { delta: 5 })
    const item = op(MESTRE_NO_SITE, F_SEM_OPCIONAIS, ['mochila', 'vaga_mapa'], 'criar', { valor: { id: 'vaga_mapa', nome: 'Mapa' } })
    expect(enviar(campanha, MESTRE_NO_SITE, [moedas, item]).respostas.map((resposta) => resposta.t)).toEqual(['ack', 'ack'])
    expect(campanha.todasAsOps()[0]).not.toHaveProperty('antes')
    const doApp = op(MESTRE_NO_APP, F_SEM_OPCIONAIS, ['mochila', 'vaga_mapa', 'nome'], 'definir', { valor: 'Mapa velho' })
    expect(enviar(campanha, MESTRE_NO_APP, [doApp]).respostas[0]).toMatchObject({ t: 'conflito', valorAtual: 'Mapa' })
    expect(docDe(campanha, F_SEM_OPCIONAIS)).toMatchObject({ moedas: 5, mochila: [{ id: 'vaga_mapa', nome: 'Mapa' }] })
  })

  it('prefixo é sobreposição; irmãos não são', () => {
    expect(caminhosSeSobrepoem([], ['nome'])).toBe(true)
    expect(caminhosSeSobrepoem(['mochila', 'v1'], ['mochila', 'v1', 'quantidade'])).toBe(true)
    expect(caminhosSeSobrepoem(['recursos', 'hp'], ['recursos', 'hp'])).toBe(true)
    expect(caminhosSeSobrepoem(['recursos', 'hp'], ['recursos', 'sp'])).toBe(false)
    expect(caminhosSeSobrepoem(['mochila', 'v1'], ['mochila', 'v10'])).toBe(false)
  })
})
