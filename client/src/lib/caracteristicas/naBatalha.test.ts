// @vitest-environment node
/**
 * COMPANION (PLANO-COMPANION.md, fatias 3 e 4): a store de verdade sobre a mesa
 * em memória do treino, com a Mimi ligada ao Zé, e o host com o pedido do fio.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../batalha/mesa'
import type { PonteDaBatalha } from '../batalha/ponte'
import { combatentesIniciais } from '../batalha/turnos'
import type { Personagem } from '../personagem'
import { lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../treino/mesaEmMemoria'
import { criarBatalhaStore } from '../../stores/batalhaFabrica'
import { criarBatalhaNoHost, type ConexaoNaBatalha } from '../../net/batalhaNoHost'
import { tokensDosCompanionsDe } from './naBatalha'

const CENA = 'cena_companion'
const TOKEN_DA_MIMI = 'tok_mimi'

function mesaDoZe(hpDaMimi: number) {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ze(60), lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
  const mimi: Personagem = { ...MARINHEIRO, id: 'pers_mimi', nome: 'Mimi', recursos: { ...MARINHEIRO.recursos, hp: hpDaMimi } }
  const zeId = base.personagens().find((personagem) => personagem.nome === 'Zé')?.id ?? ''
  base.ajustarPersonagem(zeId, (atual) => ({ ...atual, caracteristicas: [{ tipo: 'companion', id: 'g1', nome: 'Gatos', limite: 1, ligados: [{ personagemId: 'pers_mimi', modo: 'luta' }] }] }))
  const mesa: MesaDaBatalha = {
    ...base,
    personagens: () => [...base.personagens(), mimi],
    porCompanionsAoLado: (_sceneKey, _dono, quem) => quem.map(({ personagemId }) => ({ personagemId, tokenId: TOKEN_DA_MIMI, criado: true })),
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = base.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const tokenDoZe = tokens.find((token) => token.characterId === zeId)?.id ?? ''
  return { loja, zeId, tokenDoZe, tokens, mesa }
}

describe('companion na ordem', () => {
  it('o Zé começa escolhendo; a Mimi entra com carta própria, o Zé sai da espera e a escolha fica na ficha', () => {
    const { loja, zeId, mesa } = mesaDoZe(100)
    expect(loja.getState().cenas[CENA]?.turnos.escolhendoCompanions).toEqual([zeId])
    expect(loja.getState().escolherCompanions(CENA, { tipo: 'mestre' }, zeId, ['pers_mimi'])).toBeNull()
    const turnos = loja.getState().cenas[CENA]?.turnos
    expect(turnos?.cartas.some((carta) => carta.tokenId === TOKEN_DA_MIMI && carta.personagemId === 'pers_mimi')).toBe(true)
    expect(turnos?.escolhendoCompanions).toBeUndefined()
    expect(turnos?.companions?.[0]).toMatchObject({ tokenId: TOKEN_DA_MIMI, donoPersonagemId: zeId, criado: true })
    const grupo = mesa.personagens().find((personagem) => personagem.id === zeId)?.caracteristicas?.[0]
    expect(grupo?.tipo === 'companion' ? grupo.ultimaEscolha : null).toEqual(['pers_mimi'])
    // De novo: a escolha já foi feita.
    expect(loja.getState().escolherCompanions(CENA, { tipo: 'mestre' }, zeId, [])).not.toBeNull()
  })

  it('desmaiada e acima do limite: recusa com o motivo e nada muda', () => {
    const { loja, zeId } = mesaDoZe(0)
    expect(loja.getState().escolherCompanions(CENA, { tipo: 'mestre' }, zeId, ['pers_mimi'])).toMatch(/Desmaiada|desmaiada/)
    expect(loja.getState().escolherCompanions(CENA, { tipo: 'mestre' }, zeId, ['pers_mimi', 'pers_mimi'])).not.toBeNull()
    expect(loja.getState().cenas[CENA]?.turnos.escolhendoCompanions).toEqual([zeId])
  })
})

describe('companion pelo fio', () => {
  it('o jogador dono vê a escolha no estado, escolhe, e o token da Mimi passa a contar como dele na batalha', () => {
    const { loja, zeId, tokenDoZe, tokens, mesa } = mesaDoZe(100)
    const s = () => loja.getState()
    const ponte: PonteDaBatalha = {
      cena: (sceneKey) => s().cenas[sceneKey] ?? null,
      passarVez: (sceneKey, autor, esperado) => s().passarVez(sceneKey, autor, esperado),
      desfazer: (sceneKey, linhaId, autor) => s().desfazer(sceneKey, linhaId, autor),
      registrarAjuste: () => {},
      agir: (sceneKey, autor, vez, pedido) => s().agir(sceneKey, autor, vez, pedido),
      reagir: (sceneKey, autor, pedido) => s().reagir(sceneKey, autor, pedido),
      darDano: (sceneKey, autor, tokenId, valor) => s().darDano(sceneKey, autor, tokenId, valor),
      escolherArmas: (sceneKey, autor, personagemId, armas) => s().escolherArmas(sceneKey, autor, personagemId, armas),
      zerarCarga: (sceneKey, autor, personagemId) => s().zerarCarga(sceneKey, autor, personagemId),
      escolherCompanions: (sceneKey, autor, dono, escolhidos) => s().escolherCompanions(sceneKey, autor, dono, escolhidos),
    }
    const host = criarBatalhaNoHost({ ponte, agora: () => 1_000, paraOFio: (personagem) => personagem })
    const ana: ConexaoNaBatalha = {
      clientId: 'c-ana',
      playerId: 'jogador_ana',
      nome: 'Ana',
      lugar: { sceneKey: CENA, meusTokens: new Set([tokenDoZe]), fichasNaTela: [...tokens.map((token) => ({ id: token.id, name: token.name })), { id: TOKEN_DA_MIMI, name: 'Mimi' }], meusPersonagens: new Set([zeId]), personagemDaFicha: new Map([[tokenDoZe, zeId]]) },
    }
    const estadoNoFio = () => {
      const msg = host.sync([ana], { sistema: SISTEMA_DO_TESTE, personagens: mesa.personagens() }).map((saida) => saida.msg).find((candidata) => candidata.type === 'batalha.estado')
      return msg?.type === 'batalha.estado' ? msg.estado : undefined
    }
    const escolhasNoEstado = () => estadoNoFio()?.companions
    // A escolha vai no estado: só para o dono, com a Mimi já marcada (as primeiras de pé).
    expect(escolhasNoEstado()?.[0]).toMatchObject({ donoPersonagemId: zeId, grupos: [{ nome: 'Gatos', limite: 1, padrao: ['pers_mimi'] }] })
    const resposta = host.companions(ana, { type: 'batalha.companions', reqId: 'c1', donoPersonagemId: zeId, escolhidos: ['pers_mimi'] })
    expect(resposta.saidas.map((saida) => saida.msg)).toEqual([{ type: 'batalha.resultado', reqId: 'c1', ok: true }])
    // Outro jogador (sem o Zé) é recusado.
    const outro: ConexaoNaBatalha = { ...ana, clientId: 'c-bia', playerId: 'jogador_bia', lugar: ana.lugar === null ? null : { ...ana.lugar, meusPersonagens: new Set(), meusTokens: new Set() } }
    expect(host.companions(outro, { type: 'batalha.companions', reqId: 'c2', donoPersonagemId: zeId, escolhidos: [] }).saidas[0]?.msg).toMatchObject({ ok: false })
    // Depois da escolha, a carta da Mimi diz de quem é, e a escolha some do estado.
    // (O host só manda o estado quando muda: um sync só para as duas leituras.)
    const depois = estadoNoFio()
    expect(depois?.companions).toBeUndefined()
    expect(tokensDosCompanionsDe(loja.getState().cenas[CENA]?.turnos, new Set([zeId]))).toEqual([TOKEN_DA_MIMI])
    expect(tokensDosCompanionsDe(loja.getState().cenas[CENA]?.turnos, new Set(['pers_outro']))).toEqual([])
    // Prova por gestos (23/11): a Mimi luta do lado do Zé, não do lado dos NPCs. Antes a mira do
    // jogador punha o dono "do outro lado" e escondia o inimigo entre os aliados dela.
    const cartas = depois?.cartas ?? []
    const ladoDoToken = (tokenId: string) => cartas.find((carta) => carta.tokenId === tokenId)?.ladoNaLuta
    const tokenDoMarinheiro = tokens.find((token) => token.characterId === MARINHEIRO.id)?.id ?? ''
    expect(ladoDoToken(TOKEN_DA_MIMI)).toBeDefined()
    expect(ladoDoToken(TOKEN_DA_MIMI)).toBe(ladoDoToken(tokenDoZe))
    expect(ladoDoToken(TOKEN_DA_MIMI)).not.toBe(ladoDoToken(tokenDoMarinheiro))
  })
})
