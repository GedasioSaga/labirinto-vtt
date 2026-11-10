// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S1 (docs/planos/conserto-fichas-2026-11-08.md;
 * bugs 1 e 8 de docs/auditoria-fichas/00-bugs-do-sistema.md): o host com a
 * store de verdade (`criarBatalhaStore` sobre a mesa em memória do treino).
 * - bug 8: na vez da ficha emprestada (a tela dele mostra "sua vez"), o host
 *   aceita o Atacar;
 * - bug 1: a recusa leva o motivo ("A vez já passou", a regra da ficha dele).
 *   Unificação do combate (U2, 10/11/2026): na vez da ficha que ele opera (a
 *   emprestada, o NPC controlado) o motivo da regra sai também.
 */
import { describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../lib/batalha/combate'
import { CACA, siegCom } from '../lib/batalha/fichasDaFatiaF.testkit'
import type { PonteDaBatalha, VezEsperada } from '../lib/batalha/ponte'
import { combatentesIniciais } from '../lib/batalha/turnos'
import { LIA, lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type LojaDaBatalha } from '../stores/batalhaFabrica'
import { criarBatalhaNoHost, type ConexaoNaBatalha } from './batalhaNoHost'
import { parseBatalhaResultado } from './protocoloDaBatalha'

const CENA = 'cena_da_batalha'

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

/**
 * Lia (Agilidade 70, joga primeiro), Zé (40) e Marinheiro (30). A Ana joga com
 * o Zé (a ficha DELA) e com a Lia EMPRESTADA: o token é dela, o personagem não.
 */
function mesaDaAna() {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ze(60), lado: 'a' }, { ficha: LIA, lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  // A mesa em memória dá à cópia de cada ficha um id da vaga: o token acha-se pelo nome do personagem.
  const tokenDe = (nome: string): { tokenId: string; personagemId: string } => {
    const personagem = mesa.personagens().find((candidato) => candidato.nome === nome)
    const token = tokens.find((candidato) => candidato.characterId === personagem?.id)
    if (personagem === undefined || token === undefined) throw new Error(`sem token de ${nome}`)
    return { tokenId: token.id, personagemId: personagem.id }
  }
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  const host = criarBatalhaNoHost({ ponte: ponteDa(loja), agora: () => 1_000, paraOFio: (personagem) => personagem })
  const ze_ = tokenDe('Zé')
  const doZe = ze_.tokenId
  const daLia = tokenDe('Lia').tokenId
  const doMarinheiro = tokenDe('Marinheiro').tokenId
  const ana: ConexaoNaBatalha = {
    clientId: 'c-ana',
    playerId: 'jogador_ana',
    nome: 'Ana',
    lugar: {
      sceneKey: CENA,
      meusTokens: new Set([doZe, daLia]),
      fichasNaTela: tokens.map((token) => ({ id: token.id, name: token.name })),
      meusPersonagens: new Set([ze_.personagemId]),
      personagemDaFicha: new Map([[doZe, ze_.personagemId]]),
    },
  }
  const vez = (): VezEsperada => {
    const { turnos } = loja.getState().cenas[CENA] ?? { turnos: null }
    if (turnos === null || turnos.vez === null) throw new Error('sem vez')
    return { cartaId: turnos.vez, rodada: turnos.rodada }
  }
  const tokenDaVez = () => {
    const turnos = loja.getState().cenas[CENA]?.turnos
    return turnos?.cartas.find((carta) => carta.id === turnos.vez)?.tokenId
  }
  return { mesa, loja, host, ana, vez, tokenDaVez, doZe, daLia, doMarinheiro }
}

const ataque = (tokenId: string): PedidoDeAcao => ({ tipo: 'atacar', armaId: null, alvos: [{ tokenId, dano: 10 }], surpresa: false, perfurante: false })

describe('bug 8: vez da ficha emprestada', () => {
  it('a vez é da Lia emprestada (a tela da Ana mostra "sua vez"): o host aceita o Atacar e o golpe espera a reação', () => {
    const { loja, host, ana, vez, tokenDaVez, daLia, doMarinheiro } = mesaDaAna()
    expect(tokenDaVez()).toBe(daLia)
    const resposta = host.agir(ana, { type: 'batalha.agir', reqId: 'r1', vez: vez(), pedido: ataque(doMarinheiro) })
    expect(resposta.saidas.map((saida) => saida.msg)).toEqual([{ type: 'batalha.resultado', reqId: 'r1', ok: true }])
    expect(loja.getState().cenas[CENA]?.turnos.golpes?.[0]?.atacanteTokenId).toBe(daLia)
  })

  it('F2b: na vez da Lia, a ficha dela vai primeiro na lista dos aliados (o menu inteiro na tela da Ana); na vez do Zé, sai', () => {
    const { mesa, host, ana, vez, tokenDaVez, daLia, doZe } = mesaDaAna()
    // A Lia fica fora da equipe da Ana: sem a vez dela, não seria aliada (a lista só a leva pela vez).
    const doZeNaFicha = [...ana.lugar?.meusPersonagens ?? []]
    const fichas = () => ({ sistema: mesa.sistema(), personagens: mesa.personagens(), equipes: [{ id: 'eq_ana', nome: 'Da Ana', cor: '#336699', membros: doZeNaFicha }] })
    const nomesDosAliados = (saidas: ReturnType<typeof host.sync>): string[] | null => {
      const msg = saidas.find((saida) => saida.msg.type === 'batalha.aliados')?.msg
      return msg?.type === 'batalha.aliados' ? msg.personagens.map((personagem) => personagem.nome) : null
    }
    expect(tokenDaVez()).toBe(daLia)
    expect(nomesDosAliados(host.sync([ana], fichas()))?.[0]).toBe('Lia')
    const daLiaAgora = vez()
    expect(host.passar(ana, { type: 'batalha.passar', reqId: 'p1', cartaId: daLiaAgora.cartaId, rodada: daLiaAgora.rodada }).mudou).toBe(true)
    expect(tokenDaVez()).toBe(doZe)
    expect(nomesDosAliados(host.sync([ana], fichas()))).not.toContain('Lia')
  })
})

describe('bug 1: a recusa diz por quê', () => {
  it('vez que já passou e regra da ficha dele viram motivo; na emprestada, na vez dela, a regra também sai com o motivo (U2); o reenvio repete a recusa', () => {
    const { host, ana, vez, tokenDaVez, doZe, doMarinheiro } = mesaDaAna()
    const daLia = vez()
    // Lia (emprestada) ataca; o segundo Atacar não tem Simples. Unificação do combate (U2, 10/11/2026): na vez da ficha
    // que ele opera (a emprestada, o NPC controlado) o motivo da regra sai como na ficha dele; antes saía a genérica.
    expect(host.agir(ana, { type: 'batalha.agir', reqId: 'r1', vez: daLia, pedido: ataque(doMarinheiro) }).saidas[0]?.msg).toMatchObject({ ok: true })
    const emprestada = parseBatalhaResultado(host.agir(ana, { type: 'batalha.agir', reqId: 'r2', vez: daLia, pedido: ataque(doMarinheiro) }).saidas[0]?.msg)
    expect([emprestada?.ok, typeof emprestada?.motivo, emprestada?.motivo === 'Essa ação não vale agora']).toEqual([false, 'string', false])
    expect(host.passar(ana, { type: 'batalha.passar', reqId: 'r3', cartaId: daLia.cartaId, rodada: daLia.rodada }).mudou).toBe(true)

    // O pedido com a vez velha (a da Lia) e o "Passar" repetido: "A vez já passou".
    expect(host.agir(ana, { type: 'batalha.agir', reqId: 'r4', vez: daLia, pedido: ataque(doMarinheiro) }).saidas[0]?.msg).toEqual({ type: 'batalha.resultado', reqId: 'r4', ok: false, motivo: 'A vez já passou' })
    expect(host.passar(ana, { type: 'batalha.passar', reqId: 'r5', cartaId: daLia.cartaId, rodada: daLia.rodada }).saidas[0]?.msg).toEqual({ type: 'batalha.resultado', reqId: 'r5', ok: false, motivo: 'A vez já passou' })

    // Zé (ficha DELA) ataca duas vezes: a segunda volta com o motivo da regra, o mesmo do menu dele.
    expect(tokenDaVez()).toBe(doZe)
    expect(host.agir(ana, { type: 'batalha.agir', reqId: 'r6', vez: vez(), pedido: ataque(doMarinheiro) }).saidas[0]?.msg).toMatchObject({ ok: true })
    const daRegra = host.agir(ana, { type: 'batalha.agir', reqId: 'r7', vez: vez(), pedido: ataque(doMarinheiro) }).saidas[0]?.msg
    const lida = parseBatalhaResultado(daRegra)
    expect(lida?.ok).toBe(false)
    expect(lida?.motivo).toEqual(expect.any(String))
    expect(lida?.motivo).not.toBe('Essa ação não vale agora')
    // O reenvio do mesmo reqId devolve a mesma recusa, sem agir de novo.
    expect(host.agir(ana, { type: 'batalha.agir', reqId: 'r7', vez: vez(), pedido: ataque(doMarinheiro) }).saidas[0]?.msg).toEqual(daRegra)
  })
})

describe('F2 (revisão da fatia F): o Evoluir recusado diz por quê', () => {
  it('o Siegfried (jogador) sem a Melodia ligada no +20 pede o Evoluir da CAÇA: a recusa traz a regra', () => {
    const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: siegCom(), lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
    const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
    const tokens = mesa.tokens()
    loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
    const sieg = mesa.personagens().find((candidato) => candidato.nome === 'Siegfried')
    const doSieg = tokens.find((token) => token.characterId === sieg?.id)?.id
    if (sieg === undefined || doSieg === undefined) throw new Error('sem o Siegfried')
    // A vez anda até a carta do Siegfried (o mestre passa a do Marinheiro, se vier antes).
    for (let i = 0; i < 3; i += 1) {
      const turnos = loja.getState().cenas[CENA]?.turnos
      const daVez = turnos?.cartas.find((carta) => carta.id === turnos.vez)
      if (turnos === undefined || daVez === undefined || daVez.tokenId === doSieg) break
      loja.getState().passarVez(CENA, { tipo: 'mestre' }, { cartaId: daVez.id, rodada: turnos.rodada })
    }
    const host = criarBatalhaNoHost({ ponte: ponteDa(loja), agora: () => 1_000, paraOFio: (personagem) => personagem })
    const bia: ConexaoNaBatalha = {
      clientId: 'c-bia',
      playerId: 'jogador_bia',
      nome: 'Bia',
      lugar: { sceneKey: CENA, meusTokens: new Set([doSieg]), fichasNaTela: tokens.map((token) => ({ id: token.id, name: token.name })), meusPersonagens: new Set([sieg.id]), personagemDaFicha: new Map([[doSieg, sieg.id]]) },
    }
    const resposta = host.evoluir(bia, { type: 'batalha.evoluir', reqId: 'e1', pedido: { tipo: 'evoluir', tokenId: doSieg, cartaoId: CACA.id, custo: 50 } })
    expect(resposta.saidas.map((saida) => saida.msg)).toEqual([{ type: 'batalha.resultado', reqId: 'e1', ok: false, motivo: 'Para evoluir, a Melodia tem de estar ligada na opção do +20 de dano' }])
  })
})
