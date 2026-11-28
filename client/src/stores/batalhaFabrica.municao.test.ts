/**
 * MUNIÇÃO (pedido de 16/11/2026 11h03: "mesmo ele usando balas de prata o
 * número no inventário não tá diminuindo"): o tiro com a bala tira 1, o
 * Desfazer devolve, e com 0 o tiro não sai — no mestre e no tiro do jogador
 * que o host aceita (o mesmo `agir`).
 *
 * ITENS REFEITOS (E6a): a arma é a vaga EQUIPADA da mochila e o tiro gasta do
 * PENTE dela (`stores/batalha/recargaDoPente.ts`), não da pilha de balas da
 * mochila (que só serve à recarga). As provas de antes, no modelo de agora:
 * o pente desce 1 por tiro, o Desfazer devolve ao pente, e o pente vazio sem
 * bala para a recarga bloqueia o tiro com o motivo do pente.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { ARMA_DA_ROSA, BALA_DA_PRATA, ID_DA_PRATA, REGRA_DA_PRATA, ROSA_FUNEBRE, ryokoCom, VAGA_DA_PRATA, VAGA_DA_ROSA, vincentArmado, vincentCom } from '../lib/batalha/fichasDaFatiaE.testkit'
import { ABA_DAS_ARMAS, armasDe, motivoDoPente } from '../lib/batalha/leituraDaFicha'
import type { PonteDaBatalha, VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { fichaComAMochilaDoBoneco } from '../lib/batalha/municaoDaFicha'
import { definirMunicoesDasArmas } from '../lib/batalha/municoesDoAcervo'
import { readCarriedItems } from '../lib/items'
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
const CORDA: CarriedItem = { id: 'vaga_corda', nome: 'Corda' }
/** O motivo do pente vazio sem bala que a Rosa aceite na mochila (`motivoDoPente`): não há o que recarregar. */
const PENTE_VAZIO = 'Pente vazio e nenhuma bala que Rosa Fúnebre aceita na mochila'

/** O Vincent com a Corda, a Rosa com `noPente` Balas de Prata no pente e `naPilha` fora dele (0 = sem pilha, nada a recarregar). */
function vincentComPente(noPente: number, naPilha = 0): Personagem {
  const armado = vincentArmado(noPente, naPilha)
  return { ...armado, mochila: [CORDA, ...(armado.mochila ?? [])] }
}

function batalha(noPente: number, vincent: Personagem = vincentComPente(noPente)): { loja: LojaDaBatalha; mesa: MesaEmMemoria } {
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

const tiro = (alvo: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: ARMA_DA_ROSA, balaId: BALA_DA_PRATA, alvos: [{ tokenId: alvo, dano: 50 }], surpresa: false, perfurante: false })

function mochilaDoVincent(mesa: MesaEmMemoria): readonly CarriedItem[] {
  return mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))?.mochila ?? []
}

/** Quantas balas há no pente da vaga `vagaId` (sem o campo = 0). */
const noPenteDe = (mochila: readonly CarriedItem[], vagaId = VAGA_DA_ROSA): number => mochila.find((vaga) => vaga.id === vagaId)?.pente?.n ?? 0
const noPente = (mesa: MesaEmMemoria): number => noPenteDe(mochilaDoVincent(mesa))
/** A pilha de Balas de Prata fora do pente. */
const naPilha = (mesa: MesaEmMemoria): number => mochilaDoVincent(mesa).reduce((soma, vaga) => (vaga.itemId === ID_DA_PRATA ? soma + (vaga.quantidade ?? 1) : soma), 0)

describe('munição: a arma do Acervo que declara as munições', () => {
  it('a Garrucha do Acervo (o pente aceita a prata): o tiro do jogador sem bala escolhida gasta a do pente; sem nenhuma, não atira', () => {
    definirMunicoesDasArmas([
      { id: 'item_garrucha', nome: 'Garrucha', tipo: 'fogo', ataque: { dano: 15, soma: 'percepcao', acao: 'Ação Simples', alvos: 1 }, pente: { capacidade: 1, aceita: [ID_DA_PRATA], recarga: { acao: 'Ação Simples', rodadas: 0 } } },
      { id: ID_DA_PRATA, nome: 'Bala de Prata', tipo: 'municao', ...REGRA_DA_PRATA },
    ])
    try {
      // A vaga não traz regra nem tipo: o ataque e o pente vêm do Acervo (o app do mestre).
      const garrucha: CarriedItem = { id: 'vaga_garrucha', nome: 'Garrucha', itemId: 'item_garrucha', categoria: 'Arma', equipado: true, pente: { balaId: ID_DA_PRATA, n: 1 } }
      const vincent: Personagem = { ...vincentCom(), mochila: [garrucha, CORDA] }
      const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
      const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
      const tokens = mesa.tokens()
      loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
      const ryoko = tokenDe(loja, 'Ryoko')
      const comAGarrucha: PedidoDeAcao = { tipo: 'atacar', armaId: 'mochila:vaga_garrucha', alvos: [{ tokenId: ryoko, dano: 30 }], surpresa: false, perfurante: false }
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(true)
      expect(noPenteDe(mochilaDoVincent(mesa), garrucha.id)).toBe(0)
      naVezDe(loja, 'Ryoko')
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), comAGarrucha)).toBe(false)
    } finally {
      definirMunicoesDasArmas([])
    }
  })
})

/**
 * A aventura que não migrou a mochila para a ficha: a dona é a mochila do
 * boneco do Vincent (aqui, `noBoneco`), com a Rosa e o pente; a ficha dele nem tem mochila.
 */
function batalhaComAMochilaNoBoneco(noPenteDaRosa: number, comMochila: Personagem = vincentComPente(noPenteDaRosa)): { loja: LojaDaBatalha; mesa: MesaEmMemoria; noBoneco: () => readonly CarriedItem[] } {
  const { mochila: daFicha = [], ...vincent } = comMochila
  const mesaDaFicha = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: vincent, lado: 'a' }, { ficha: ryokoCom(), lado: 'b' }]))
  const tokenDoVincent = mesaDaFicha.tokens().find((token) => token.name.startsWith('Vincent'))?.id
  let mochilaDoBoneco: readonly CarriedItem[] = daFicha
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

describe('munição: aventura que não migrou a mochila (o boneco é o dono)', () => {
  it('o tiro tira 1 do pente da Rosa no boneco (3 → 2) e a ficha continua sem mochila', () => {
    const { loja, mesa, noBoneco } = batalhaComAMochilaNoBoneco(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect([noPenteDe(noBoneco()), mochilaDoVincent(mesa)]).toEqual([2, []])
  })

  it('a última bala sai do pente do boneco e o próximo tiro é bloqueado; o Desfazer a devolve ao pente do boneco, no lugar', () => {
    const { loja, mesa, noBoneco } = batalhaComAMochilaNoBoneco(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(noPenteDe(noBoneco())).toBe(0)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    naVezDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(false)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([noPenteDe(noBoneco()), noBoneco().map((vaga) => vaga.id), mochilaDoVincent(mesa)]).toEqual([1, [CORDA.id, VAGA_DA_ROSA], []])
  })
})

describe('munição: o nome liga a bala à vaga', () => {
  it('"Balas de prata" é a "Bala de Prata" do cartão; "Bala de RPG" não é', () => {
    expect([nomesDeMunicaoIguais('Balas de prata', 'Bala de Prata'), nomesDeMunicaoIguais('Munições', 'munição'), nomesDeMunicaoIguais('Bala de RPG', 'Bala de prata')]).toEqual([true, true, false])
  })
})

describe('munição: o tiro gasta do pente da ficha', () => {
  it('o tiro com a Bala de Prata tira 1 do pente (3 → 2) e nada da pilha (5); o Desfazer da linha devolve (2 → 3)', () => {
    const { loja, mesa } = batalha(3, vincentComPente(3, 5))
    const ryoko = tokenDe(loja, 'Ryoko')
    naVezDe(loja, 'Vincent')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect([noPente(mesa), naPilha(mesa)]).toEqual([2, 5])
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([noPente(mesa), naPilha(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([3, 5, [CORDA.id, VAGA_DA_ROSA, VAGA_DA_PRATA]])
  })

  it('o tiro do jogador (o host passa pelo mesmo agir) gasta a última; com 0 o próximo é bloqueado, e o Desfazer devolve a bala ao pente', () => {
    const { loja, mesa } = batalha(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(noPente(mesa)).toBe(0)
    const linha = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    // O pente vazio fica na arma e não há pilha para a recarga: a vez seguinte do Vincent não atira com 0.
    naVezDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, MESTRE, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(false)
    expect(loja.getState().desfazer(CENA, linha?.id ?? '', MESTRE)).toBe(true)
    expect([noPente(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([1, [CORDA.id, VAGA_DA_ROSA]])
  })
})

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

/** Por que a mira desabilita a Rosa Fúnebre nesta ficha (o pente), ou `null`. */
function penteNaMira(ficha: Personagem | null | undefined): string | null {
  const arma = ficha === null || ficha === undefined ? undefined : armasDe(ficha).find((candidata) => candidata.id === ARMA_DA_ROSA)
  return arma === undefined ? null : motivoDoPente(arma, 0)
}

/**
 * D1 da auditoria de 16/11 (tmp/auditoria-2026-11-16e/VEREDITO.md): a bala
 * zerada tinha de continuar bloqueando o tiro, senão o 4º saía de graça, e
 * todos depois dele. Itens refeitos (E6a): a bala ligada só pelo nome saiu (o
 * pente guarda o item da bala na vaga da arma, que não some ao zerar); fica a
 * prova do mesmo bloqueio pelo host, pelo fio e na mochila do boneco.
 */
describe('o pente zerado bloqueia pelo host e pelo fio (antes D1: a munição só pelo nome)', () => {
  it('pelo host, o jogador dá 3 tiros (pente 3 → 0); o 4º é recusado com o pente vazio no mestre e no jogador, e o Desfazer devolve 1 ao pente', () => {
    const { loja, mesa } = batalha(3)
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
      { type: 'batalha.resultado', reqId: 'r4', ok: false, motivo: PENTE_VAZIO },
    ])
    expect([noPente(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([0, [CORDA.id, VAGA_DA_ROSA]])
    // A mira do mestre e a do jogador mostram a arma desabilitada. O fio leva a ficha SEM a mochila (`paraOFio`); a
    // mochila chega ao jogador no boneco do recorte, e a tela junta as duas (`fichasComAMochilaDasLigacoes`).
    const noMestre = mesa.personagens().find((personagem) => personagem.id === vincent.id)
    const fichaDoFio = noMestre === undefined ? null : personagemDoArquivo(JSON.parse(JSON.stringify(paraOFio(noMestre))))
    const mochilaDoBoneco = readCarriedItems(JSON.parse(JSON.stringify(noMestre?.mochila ?? []))) ?? []
    const noJogador = fichaDoFio === null ? null : fichaComAMochilaDoBoneco(fichaDoFio, mochilaDoBoneco)
    expect([penteNaMira(noMestre), penteNaMira(noJogador)]).toEqual([PENTE_VAZIO, PENTE_VAZIO])
    const terceiro = cena(loja).registro.filter((candidata) => candidata.tipo === 'golpe').at(-1)
    expect(loja.getState().desfazer(CENA, terceiro?.id ?? '', MESTRE)).toBe(true)
    expect([noPente(mesa), mochilaDoVincent(mesa).map((vaga) => vaga.id)]).toEqual([1, [CORDA.id, VAGA_DA_ROSA]])
  })

  it('na aventura que não migrou (a mochila é do boneco): a última sai do pente e o tiro seguinte é bloqueado com o pente vazio', () => {
    const { loja, noBoneco } = batalhaComAMochilaNoBoneco(1)
    const ryoko = tokenDe(loja, 'Ryoko')
    expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    expect(noPenteDe(noBoneco())).toBe(0)
    naVezDe(loja, 'Ryoko')
    const vez = naVezDe(loja, 'Vincent')
    expect([loja.getState().motivoDoAgir(CENA, MESTRE, vez, tiro(ryoko)), loja.getState().agir(CENA, MESTRE, vez, tiro(ryoko))]).toEqual([PENTE_VAZIO, false])
  })
})

/**
 * O Salvar do jogador pela sala LAN (`personagem.editar`) leva a aba Armas
 * inteira. Ele não pode devolver as balas ao pente (a ficha que o jogador
 * tinha antes dos tiros): o pente zerado fica zerado e o 4º tiro não sai.
 */
describe('munição: o Salvar do jogador pela sala não enche o pente', () => {
  it('3 tiros zeram o pente; o jogador salva a aba Armas; o pente fica vazio e o 4º tiro é recusado', () => {
    const { loja, mesa } = batalha(3)
    const ryoko = tokenDe(loja, 'Ryoko')
    for (const vez of [1, 2, 3]) {
      if (vez > 1) naVezDe(loja, 'Ryoko')
      expect(loja.getState().agir(CENA, JOGADOR, naVezDe(loja, 'Vincent'), tiro(ryoko))).toBe(true)
    }
    expect(noPente(mesa)).toBe(0)
    // O que o host mandou ao jogador (a base da conexão) e a ficha que o jogador lê do fio.
    const noHost = mesa.personagens().find((personagem) => personagem.nome.startsWith('Vincent'))
    if (noHost === undefined) throw new Error('sem o Vincent')
    const enviada = paraOFio(noHost)
    const recebida = personagemDoArquivo(JSON.parse(JSON.stringify(enviada)))
    if (recebida === null) throw new Error('a ficha não passou pelo fio')
    // O jogador muda o dano do cartão da Rosa Fúnebre e salva: a aba Armas vai inteira, com o subcartão da bala.
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
    expect([rosa?.campos.dano, noPente(mesa), loja.getState().motivoDoAgir(CENA, JOGADOR, vez, tiro(ryoko)), loja.getState().agir(CENA, JOGADOR, vez, tiro(ryoko))]).toEqual(['25', 0, PENTE_VAZIO, false])
  })
})
