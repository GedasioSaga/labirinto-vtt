/**
 * MUNIÇÃO (pedido de 16/11/2026 11h03: "mesmo ele usando balas de prata o
 * número no inventário não tá diminuindo"): o tiro com a bala ligada à
 * mochila tira 1 da ficha, o Desfazer devolve, e com 0 o tiro não sai — no
 * mestre e no tiro do jogador que o host aceita (o mesmo `agir`).
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { BALA_DE_PRATA, ROSA_FUNEBRE, ryokoCom, vincentCom } from '../lib/batalha/fichasDaFatiaE.testkit'
import { ABA_DAS_ARMAS, armasDe, balaDaArma, motivoSemMunicao } from '../lib/batalha/leituraDaFicha'
import type { PonteDaBatalha, VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { definirMunicoesDasArmas } from '../lib/batalha/municoesDoAcervo'
import { nomesDeMunicaoIguais } from '../lib/mochila/municao'
import { paraOFio, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaNoHost, type ConexaoNaBatalha } from '../net/batalhaNoHost'
import { aplicarPartesPelaBase, mensagensDoSalvar } from '../net/edicaoDoPersonagem'
import { parsePlayerMessage } from '../net/protocol'
import { parseBatalhaAgir, parseBatalhaResultado } from '../net/protocoloDaBatalha'
import type { CarriedItem } from '../types/map'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_batalha'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADOR: AutorDaAcao = { tipo: 'jogador', playerId: 'jogador_1', nome: 'Jogador' }
const ID_DA_PRATA = 'item_bala-de-prata'

/** O Vincent com `quantas` "Balas de prata" do Acervo na mochila (o subcartão da Rosa Fúnebre diz "Bala de Prata": liga pelo nome). */
function vincentComBalas(quantas: number): Personagem {
  const vaga: CarriedItem = { id: 'vaga_prata', nome: 'Balas de prata', itemId: ID_DA_PRATA, categoria: 'Munição', empilhavel: true, ...(quantas > 1 ? { quantidade: quantas } : {}) }
  return { ...vincentCom(), mochila: [{ id: 'vaga_corda', nome: 'Corda' }, vaga] }
}

function batalha(quantas: number, vincent: Personagem = vincentComBalas(quantas)): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  return { loja, mesa }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

/** Passa a vez até chegar a de `nome` (a vez de agora conta). */
function naVezDe(loja: LojaDaBatalha, nome: string): VezEsperada {
  for (let i = 0; i < 4; i += 1) {
    const { turnos } = cena(loja)
    if (turnos.vez === null) throw new Error('sem vez')
    const atual = { cartaId: turnos.vez, rodada: turnos.rodada }
    if (turnos.cartas.find((candidata) => candidata.id === atual.cartaId)?.nome?.startsWith(nome) === true) return atual
    expect(loja.getState().passarVez(CENA, MESTRE, atual)).toBe(true)
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function tokenDe(loja: LojaDaBatalha, nome: string): string {
  const achada = cena(loja).turnos.cartas.find((candidata) => candidata.nome?.startsWith(nome) === true && candidata.extra === undefined)
  if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
  return achada.tokenId
}

const tiro = (alvo: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: ROSA_FUNEBRE.id, balaId: BALA_DE_PRATA.id, alvos: [{ tokenId: alvo, dano: 50 }], surpresa: false, perfurante: false })

function mochilaDoVincent(mesa: MesaEmMemoria): readonly CarriedItem[] {
  return mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))?.mochila ?? []
}

const pratas = (mesa: MesaEmMemoria): number => mochilaDoVincent(mesa).reduce((soma, vaga) => (vaga.itemId === ID_DA_PRATA ? soma + (vaga.quantidade ?? 1) : soma), 0)

describe('munição: a arma do Acervo que declara as munições', () => {
  it('a Garrucha da mochila aceita Balas de prata: o tiro do jogador sem bala escolhida gasta a primeira que há; sem nenhuma, não atira', () => {
    definirMunicoesDasArmas([
      { id: 'item_garrucha', nome: 'Garrucha', municoes: [ID_DA_PRATA] },
      { id: ID_DA_PRATA, nome: 'Balas de prata' },
    ])
    try {
      const garrucha: CarriedItem = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma' }
      const vincent = { ...vincentComBalas(1), mochila: [garrucha, ...(vincentComBalas(1).mochila ?? [])] }
      const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
      const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
      const tokens = mesa.tokens()
      loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
      const ryoko = tokenDe(loja, 'Ryoko')
      const comAGarrucha: PedidoDeAcao = { tipo: 'atacar', armaId: 'mochila:vaga_garrucha', alvos: [{ tokenId: ryoko, dano: 30 }], surpresa: false, perfurante: false }
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(true)
      expect(pratas(mesa)).toBe(0)
      naVezDe(loja, 'Ryoko')
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(false)
    } finally {
      definirMunicoesDasArmas([])
    }
  })
})

/**
 * A aventura que não migrou a mochila para a ficha: a dona é a mochila do
 * boneco do Vincent (aqui, `noBoneco`); a ficha dele nem tem mochila.
 */
function batalhaComAMochilaNoBoneco(quantas: number, comMochila: Personagem = vincentComBalas(quantas)): { loja: LojaDaBatalha; mesa: MesaEmMemoria; noBoneco: () => readonly CarriedItem[] } {
  const { mochila: comBalas = [], ...vincent } = comMochila
  const mesaDaFicha = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
  const tokenDoVincent = mesaDaFicha.tokens().find((token) => token.name.startsWith('Vincent'))?.id
  let mochilaDoBoneco: readonly CarriedItem[] = comBalas
  const mesa: MesaEmMemoria = {
    ...mesaDaFicha,
    mochilaDoBoneco: (sceneKey, tokenId) => (sceneKey === CENA && tokenId === tokenDoVincent ? mochilaDoBoneco : null),
    gravarMochilaDoBoneco: (sceneKey, tokenId, mochila) => {
      if (sceneKey !== CENA || tokenId !== tokenDoVincent) return false
      mochilaDoBoneco = mochila
      return true
    },
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  return { loja, mesa, noBoneco: () => mochilaDoBoneco }
}

const pratasNo = (mochila: readonly CarriedItem[]): number => mochila.reduce((soma, vaga) => (vaga.itemId === ID_DA_PRATA ? soma + (vaga.quantidade ?? 1) : soma), 0)

describe('munição: aventura que não migrou a mochila (o boneco é o dono)', () => {
  it('o tiro tira 1 da mochila do boneco (3 → 2) e a ficha continua sem mochila', () => {
    const { loja, mesa, noBoneco } = batalhaComAMochilaNoBoneco(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect([pratasNo(noBoneco()), mochilaDoVincent(mesa)]).toEqual([2, []])
  })

  it('a última bala sai do boneco e o próximo tiro é bloqueado; o Desfazer devolve a vaga ao boneco, no lugar', () => {
    const { loja, mesa, noBoneco } = batalhaComAMochilaNoBoneco(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratasNo(noBoneco())).toBe(0)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    naVezDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(false)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([pratasNo(noBoneco()), noBoneco().map((vaga) => vaga.id), mochilaDoVincent(mesa)]).toEqual([1, ['vaga_corda', 'vaga_prata'], []])
  })
})

describe('munição: o nome liga a bala à vaga', () => {
  it('"Balas de prata" é a "Bala de Prata" do cartão; "Bala de RPG" não é', () => {
    expect([nomesDeMunicaoIguais('Balas de prata', 'Bala de Prata'), nomesDeMunicaoIguais('Munições', 'munição'), nomesDeMunicaoIguais('Bala de RPG', 'Bala de prata')]).toEqual([true, true, false])
  })
})

describe('munição: o tiro gasta da mochila da ficha', () => {
  it('o tiro com a Bala de Prata tira 1 (3 → 2) e o Desfazer da linha devolve (2 → 3)', () => {
    const { loja, mesa } = batalha(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    naVezDe(loja, 'Vincent')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratas(mesa)).toBe(2)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([pratas(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([3, ['vaga_corda', 'vaga_prata']])
  })

  it('o tiro do jogador (o host passa pelo mesmo agir) gasta a última; com 0 o próximo é bloqueado, e o Desfazer devolve a vaga no lugar', () => {
    const { loja, mesa } = batalha(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratas(mesa)).toBe(0)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    // A vaga saiu com a última bala, mas a ligação ficou no cartão: a vez seguinte do Vincent não atira com 0.
    naVezDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(false)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([pratas(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([1, ['vaga_corda', 'vaga_prata']])
  })
})

/**
 * D1 da auditoria de 16/11 (tmp/auditoria-2026-11-16e/VEREDITO.md): a ficha de
 * antes tem a vaga "Balas de prata" SEM item do Acervo (digitada à mão, pino
 * antigo). A bala liga só pelo nome; quando a vaga zera e some, ela tem de
 * continuar ligada, senão o 4º tiro sai de graça, e todos depois dele.
 */
function vincentComBalasSoPeloNome(quantas: number): Personagem {
  const vaga: CarriedItem = { id: 'vaga_prata', nome: 'Balas de prata', ...(quantas > 1 ? { quantidade: quantas } : {}) }
  return { ...vincentCom(), mochila: [{ id: 'vaga_corda', nome: 'Corda' }, vaga] }
}

const pratasPeloNome = (mochila: readonly CarriedItem[]): number => mochila.reduce((soma, vaga) => (nomesDeMunicaoIguais(vaga.nome, BALA_DE_PRATA.nome) ? soma + (vaga.quantidade ?? 1) : soma), 0)

/** A store do mestre atrás do host, como a sessão a liga (`ponteDaBatalha` de `stores/batalhaStore.ts`). */
function ponteDa(loja: LojaDaBatalha): PonteDaBatalha {
  const s = () => loja.getState()
  return {
    cena: (sceneKey) => s().cenas[sceneKey] ?? null,
    passarVez: (sceneKey, autor, esperado) => s().passarVez(sceneKey, autor, esperado),
    desfazer: (sceneKey, linhaId, autor) => s().desfazer(sceneKey, linhaId, autor),
    registrarAjuste: () => {},
    agir: (sceneKey, autor, vez, pedido) => s().agir(sceneKey, autor, vez, pedido),
    motivoDoAgir: (sceneKey, autor, vez, pedido) => s().motivoDoAgir(sceneKey, autor, vez, pedido),
    reagir: (sceneKey, autor, pedido) => s().reagir(sceneKey, autor, pedido),
    darDano: (sceneKey, autor, tokenId, valor) => s().darDano(sceneKey, autor, tokenId, valor),
    escolherArmas: (sceneKey, autor, personagemId, armas) => s().escolherArmas(sceneKey, autor, personagemId, armas),
    zerarCarga: (sceneKey, autor, personagemId) => s().zerarCarga(sceneKey, autor, personagemId),
    evoluir: (sceneKey, autor, pedido) => s().evoluir(sceneKey, autor, pedido),
    motivoDoEvoluir: (sceneKey, autor, pedido) => s().motivoDoEvoluir(sceneKey, autor, pedido),
  }
}

/** O que a rede faz com a mensagem: vira texto e volta pelo leitor do protocolo. */
function pelaRede<T>(mensagem: unknown, ler: (valor: unknown) => T | null): T {
  const lida = ler(JSON.parse(JSON.stringify(mensagem)))
  if (lida === null) throw new Error('a mensagem não passou pelo protocolo')
  return lida
}

/** Por que a mira desabilita a Bala de Prata da Rosa Fúnebre nesta ficha, ou `null`. */
function semMunicaoNaMira(ficha: Personagem | null | undefined): string | null {
  const arma = ficha === null || ficha === undefined ? undefined : armasDe(ficha).find((candidata) => candidata.id === ROSA_FUNEBRE.id)
  const bala = arma === undefined ? null : balaDaArma(arma, BALA_DE_PRATA.id)
  return bala === null ? null : motivoSemMunicao(bala)
}

describe('munição só pelo nome (D1): a vaga sem item do Acervo', () => {
  it('pelo host, o jogador dá 3 tiros (3 → 0); o 4º é recusado "Sem Bala de Prata" no mestre e no jogador, e o Desfazer recria a vaga pelo nome', () => {
    const { loja, mesa } = batalha(3, vincentComBalasSoPeloNome(3))
    const host = criarBatalhaNoHost({ ponte: ponteDa(loja), agora: () => 1_000, paraOFio: (personagem) => personagem })
    const vincent = mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))
    if (vincent === undefined) throw new Error('sem o Vincent')
    const doVincent = tokenDe(loja, 'Vincent')
    const ryoko = tokenDe(loja, 'Ryoko')
    const jogador: ConexaoNaBatalha = {
      clientId: 'c-jogador',
      playerId: 'jogador_1',
      nome: 'Jogador',
      lugar: { sceneKey: CENA, meusTokens: new Set([doVincent]), fichasNaTela: mesa.tokens().map((token) => ({ id: token.id, name: token.name })), meusPersonagens: new Set([vincent.id]), personagemDaFicha: new Map([[doVincent, vincent.id]]) },
    }
    const resultados: unknown[] = []
    for (const reqId of ['r1', 'r2', 'r3', 'r4']) {
      if (reqId !== 'r1') naVezDe(loja, 'Ryoko')
      const resposta = host.agir(jogador, pelaRede({ type: 'batalha.agir', reqId, vez: naVezDe(loja, 'Vincent'), pedido: tiro(ryoko) }, parseBatalhaAgir))
      resultados.push(pelaRede(resposta.saidas[0]?.msg, parseBatalhaResultado))
    }
    expect(resultados).toEqual([
      { type: 'batalha.resultado', reqId: 'r1', ok: true },
      { type: 'batalha.resultado', reqId: 'r2', ok: true },
      { type: 'batalha.resultado', reqId: 'r3', ok: true },
      { type: 'batalha.resultado', reqId: 'r4', ok: false, motivo: 'Sem Bala de Prata' },
    ])
    expect([pratasPeloNome(mochilaDoVincent(mesa)), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([0, ['vaga_corda']])
    // A mira do mestre e a do jogador (a ficha que vai pelo fio e é lida de novo lá) mostram a bala desabilitada.
    const noMestre = mesa.personagens().find((personagem) => personagem.id === vincent.id)
    const noJogador = noMestre === undefined ? null : personagemDoArquivo(JSON.parse(JSON.stringify(paraOFio(noMestre))))
    expect([semMunicaoNaMira(noMestre), semMunicaoNaMira(noJogador)]).toEqual(['Sem Bala de Prata', 'Sem Bala de Prata'])
    const terceiro = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    expect(loja.getState().desfazer(CENA, terceiro?.id ?? '', MESTRE)).toBe(true)
    expect([pratasPeloNome(mochilaDoVincent(mesa)), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([1, ['vaga_corda', 'vaga_prata']])
  })

  it('na aventura que não migrou (a mochila é do boneco): a última sai e o tiro seguinte é bloqueado com "Sem Bala de Prata"', () => {
    const { loja, noBoneco } = batalhaComAMochilaNoBoneco(1, vincentComBalasSoPeloNome(1))
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(pratasPeloNome(noBoneco())).toBe(0)
    naVezDe(loja, 'Ryoko')
    const vez = naVezDe(loja, 'Vincent')
    expect([loja.getState().motivoDoAgir(CENA, MESTRE, vez, tiro(ryoko)), loja.getState().agir(CENA, MESTRE, vez, tiro(ryoko))]).toEqual(['Sem Bala de Prata', false])
  })
})

/**
 * O Salvar do jogador pela sala LAN (`personagem.editar`) leva a aba Armas
 * inteira. A ligação da bala com a mochila (`itemId`, `municaoPeloNome`) tem
 * de chegar ao host: sem ela, a bala zerada vira só texto e o tiro com 0 sai
 * de graça de novo.
 */
describe('munição: o Salvar do jogador pela sala não solta a bala', () => {
  it('3 tiros zeram a bala; o jogador salva a aba Armas; a ligação ao Acervo fica e o 4º tiro é recusado', () => {
    const { loja, mesa } = batalha(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    for (const vez of [1, 2, 3]) {
      if (vez > 1) naVezDe(loja, 'Ryoko')
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    }
    expect(pratas(mesa)).toBe(0)
    // O que o host mandou ao jogador (a base da conexão) e a ficha que o jogador lê do fio.
    const noHost = mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))
    if (noHost === undefined) throw new Error('sem o Vincent')
    const enviada = paraOFio(noHost)
    const recebida = personagemDoArquivo(JSON.parse(JSON.stringify(enviada)))
    if (recebida === null) throw new Error('a ficha não passou pelo fio')
    // O jogador muda o dano da Rosa Fúnebre e salva: a aba Armas vai inteira, com o subcartão da bala.
    const armas = (recebida.abas[ABA_DAS_ARMAS] ?? []).map((cartao) => (cartao.id === ROSA_FUNEBRE.id ? { ...cartao, campos: { ...cartao.campos, dano: '25' } } : cartao))
    const salvar = mensagensDoSalvar(recebida, { ...recebida, abas: { ...recebida.abas, [ABA_DAS_ARMAS]: armas } }, { novoReqId: () => 'r-salvar', cabe: () => true }, recebida)
    if (!salvar.ok) throw new Error(salvar.erro)
    for (const mensagem of salvar.mensagens) {
      const lida = parsePlayerMessage(JSON.stringify(mensagem))
      if (lida?.type !== 'personagem.editar') throw new Error('o Salvar não passou pelo protocolo')
      // O mesmo passo do host (`handlePersonagemEditar`): as partes entram na ficha de agora pela base da conexão.
      expect(mesa.ajustarPersonagem(noHost.id, (atual) => aplicarPartesPelaBase(enviada, atual, lida.partes))).toBe(true)
    }
    const rosa = mesa
      .personagens()
      .find((personagem) => personagem.id === noHost.id)
      ?.abas[ABA_DAS_ARMAS]?.find((cartao) => cartao.id === ROSA_FUNEBRE.id)
    naVezDe(loja, 'Ryoko')
    const vez = naVezDe(loja, 'Vincent')
    expect([rosa?.campos.dano, rosa?.subcartoes.map((bala) => bala.itemId), loja.getState().motivoDoAgir(CENA, JOGADOR, vez, tiro(ryoko)), loja.getState().agir(CENA, JOGADOR, vez, tiro(ryoko))]).toEqual([
      '25',
      [ID_DA_PRATA],
      'Sem Bala de Prata',
      false,
    ])
  })
})
