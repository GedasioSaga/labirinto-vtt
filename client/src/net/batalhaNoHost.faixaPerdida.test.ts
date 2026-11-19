// @vitest-environment node
/**
 * F5 / atalho na batalha (conserto de 18/11/2026, "ao batalhar dá F5 e ele sai
 * da batalha"): a conexão segue aberta, mas a tela dele não tem mais a faixa
 * que o host conta como entregue. `perdeuAFaixa('vazia')` (o `scene.changed`
 * na mesma cena) faz o próximo `sync` mandar o recorte de novo, mesmo igual;
 * `perdeuAFaixa('incerta')` (um envio da batalha falhou) reenvia até o `null`
 * do fim da batalha.
 */
import { describe, expect, it } from 'vitest'
import type { PonteDaBatalha } from '../lib/batalha/ponte'
import { combatentesIniciais } from '../lib/batalha/turnos'
import { lutadoresDe, MARINHEIRO, SISTEMA_DO_TESTE, ze } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore } from '../stores/batalhaFabrica'
import { criarBatalhaNoHost, type ConexaoNaBatalha, type SaidaDaBatalha } from './batalhaNoHost'

const CENA = 'cena_da_batalha'

/** Zé (da Ana) contra o Marinheiro; `ligada` decide se a ponte ainda vê a batalha. */
function batalhaDaAna() {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: ze(60), lado: 'a' }, { ficha: MARINHEIRO, lado: 'b' }]))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  const combatentes = combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id)))
  loja.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
  const estado = { ligada: true }
  const s = () => loja.getState()
  const ponte: PonteDaBatalha = {
    cena: (sceneKey) => (estado.ligada ? s().cenas[sceneKey] ?? null : null),
    passarVez: (sceneKey, autor, esperado) => s().passarVez(sceneKey, autor, esperado),
    desfazer: (sceneKey, linhaId, autor) => s().desfazer(sceneKey, linhaId, autor),
    registrarAjuste: () => {},
    agir: (sceneKey, autor, vez, pedido) => s().agir(sceneKey, autor, vez, pedido),
    reagir: (sceneKey, autor, pedido) => s().reagir(sceneKey, autor, pedido),
    darDano: (sceneKey, autor, tokenId, valor) => s().darDano(sceneKey, autor, tokenId, valor),
    escolherArmas: (sceneKey, autor, personagemId, armas) => s().escolherArmas(sceneKey, autor, personagemId, armas),
    zerarCarga: (sceneKey, autor, personagemId) => s().zerarCarga(sceneKey, autor, personagemId),
    evoluir: (sceneKey, autor, pedido) => s().evoluir(sceneKey, autor, pedido),
  }
  const host = criarBatalhaNoHost({ ponte, agora: () => 1_000, paraOFio: (personagem) => personagem })
  const personagemDoZe = mesa.personagens().find((personagem) => personagem.nome === 'Zé')
  const tokenDoZe = tokens.find((token) => token.characterId === personagemDoZe?.id)
  if (personagemDoZe === undefined || tokenDoZe === undefined) throw new Error('sem o Zé')
  const ana: ConexaoNaBatalha = {
    clientId: 'c-ana',
    playerId: 'jogador_ana',
    nome: 'Ana',
    lugar: {
      sceneKey: CENA,
      meusTokens: new Set([tokenDoZe.id]),
      fichasNaTela: tokens.map((token) => ({ id: token.id, name: token.name })),
      meusPersonagens: new Set([personagemDoZe.id]),
      personagemDaFicha: new Map([[tokenDoZe.id, personagemDoZe.id]]),
    },
  }
  return { host, ana, estado }
}

const estadosDe = (saidas: SaidaDaBatalha[]) => saidas.filter((saida) => saida.msg.type === 'batalha.estado')

describe('batalhaNoHost: a tela perdeu a faixa sem a conexão cair', () => {
  it('vazia: o recorte igual sai de novo no próximo sync (uma vez só)', () => {
    const { host, ana } = batalhaDaAna()
    expect(estadosDe(host.entrou(ana, undefined))).toHaveLength(1)
    // Nada mudou: o host não repete o recorte.
    expect(estadosDe(host.sync([ana], undefined))).toHaveLength(0)
    host.perdeuAFaixa(ana.clientId, 'vazia')
    const deNovo = estadosDe(host.sync([ana], undefined))
    expect(deNovo).toHaveLength(1)
    const msg = deNovo[0]?.msg
    expect(msg?.type === 'batalha.estado' ? msg.estado?.rodada : null).toBe(1)
    expect(estadosDe(host.sync([ana], undefined))).toHaveLength(0)
  })

  it('incerta: o null do fim da batalha sai de novo; vazia depois do fim não manda nada', () => {
    const { host, ana, estado } = batalhaDaAna()
    host.entrou(ana, undefined)
    estado.ligada = false
    expect(host.sync([ana], undefined).map((saida) => saida.msg)).toEqual([{ type: 'batalha.estado', estado: null }])
    expect(host.sync([ana], undefined)).toEqual([])
    host.perdeuAFaixa(ana.clientId, 'incerta')
    expect(host.sync([ana], undefined).map((saida) => saida.msg)).toEqual([{ type: 'batalha.estado', estado: null }])
    host.perdeuAFaixa(ana.clientId, 'vazia')
    expect(host.sync([ana], undefined)).toEqual([])
  })
})
