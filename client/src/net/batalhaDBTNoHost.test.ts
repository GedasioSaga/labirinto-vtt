/**
 * Host da batalha DBT (docs/planos/dbt-batalha.md, seção 17, aceite da fatia
 * 2): posse recusada, vez errada, `reqId` repetido não age duas vezes, o
 * recorte sem a vida do NPC, `estado: null` uma vez ao desligar e a cena que
 * não é DBT sem nenhuma `batalhaDBT.*`. Store de verdade com mesa de teste.
 */
import { describe, expect, it } from 'vitest'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { fichaDBTVazia, type NpcDaFichaDBT } from '../lib/dbt/modelo'
import type { PonteDaBatalhaDBT } from '../lib/dbt/batalha/ponte'
import type { AutorDBT } from '../lib/dbt/batalha/tipos'
import { SISTEMA_DRAGON_BALL } from '../lib/dbt/sistemaDragonBall'
import { novoPersonagem, type Personagem } from '../lib/personagem'
import { criarBatalhaDBTStore } from '../stores/batalhaDBTStore'
import { criarBatalhaDBTNoHost, type ConexaoNaBatalhaDBT } from './batalhaDBTNoHost'
import type { BatalhaDBTPassarMessage } from './protocoloDaBatalhaDBT'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const CENA = 'cena-dbt'

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, dbt: novo.dbt ?? fichaDBTVazia() }
}

function montar() {
  const personagens = new Map([personagemDBT('goku', 'jogador', 'Goku'), personagemDBT('raditz', 'npc', 'Raditz')].map((p) => [p.id, p]))
  const mesa: MesaDaBatalha = {
    personagens: () => [...personagens.values()],
    sistema: () => SISTEMA_DRAGON_BALL,
    equipes: () => [],
    ajustarPersonagem: (personagemId, ajustar) => {
      const atual = personagens.get(personagemId)
      if (atual === undefined) return false
      personagens.set(personagemId, ajustar(atual))
      return true
    },
    trocarEquipe: () => false,
  }
  const loja = criarBatalhaDBTStore(mesa, { rolar: () => 10, agora: () => 1000, posicoes: () => null })
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'rolarIniciativa', digitados: { 't-goku': 19, 't-raditz': 2 } }).ok).toBe(true)
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
  const ponte: PonteDaBatalhaDBT = {
    cena: (sceneKey) => loja.getState().cenas[sceneKey] ?? null,
    comando: (sceneKey, autor, comando) => loja.getState().comando(sceneKey, autor, comando),
    desfazer: (sceneKey, linhaId, autor) => loja.getState().desfazer(sceneKey, linhaId, autor),
    registrarAjuste: (personagemId, antes, depois, autor) => loja.getState().registrarAjuste(personagemId, antes, depois, autor),
    fichasLidas: (sceneKey) => loja.getState().fichasLidas(sceneKey),
  }
  const host = criarBatalhaDBTNoHost({ ponte, agora: () => 1000 })
  const fichasNaTela = [
    { id: 't-goku', name: 'Goku' },
    { id: 't-raditz', name: 'Saiyajin' },
  ]
  const ana: ConexaoNaBatalhaDBT = {
    clientId: 'c-ana',
    playerId: 'ana',
    nome: 'Ana',
    lugar: { sceneKey: CENA, meusTokens: new Set(['t-goku']), fichasNaTela, meusPersonagens: new Set(['goku']), personagemDaFicha: new Map([['t-goku', 'goku']]) },
  }
  const bia: ConexaoNaBatalhaDBT = {
    clientId: 'c-bia',
    playerId: 'bia',
    nome: 'Bia',
    lugar: { sceneKey: CENA, meusTokens: new Set(), fichasNaTela, meusPersonagens: new Set(), personagemDaFicha: new Map() },
  }
  return { loja, host, ana, bia, mesa: { personagens: mesa.personagens() } }
}

describe('batalhaDBTNoHost', () => {
  it('manda o recorte sem a vida do NPC e com o nome da tela dele', () => {
    const { host, ana, mesa } = montar()
    const saidas = host.entrou(ana, mesa)
    const estado = saidas.find((saida) => saida.msg.type === 'batalhaDBT.estado')
    expect(estado?.msg.type).toBe('batalhaDBT.estado')
    if (estado?.msg.type !== 'batalhaDBT.estado' || estado.msg.estado === null) throw new Error('sem recorte')
    const npc = estado.msg.estado.cartas.find((carta) => carta.tokenId === 't-raditz')
    expect(npc?.nome).toBe('Saiyajin')
    expect(npc?.pv).toBeNull()
    expect(npc?.lado).toBe('outro')
    expect(estado.msg.estado.minhaVez).toBe(true)
    expect(estado.msg.estado.meus[0]?.vez).toEqual({ rodada: 1, turno: 1 })
  })

  it('recusa passar a vez de ficha que não é dele e a vez de outra rodada', () => {
    const { loja, host, ana, bia } = montar()
    const daBia = host.passar(bia, { type: 'batalhaDBT.passar', reqId: 'r1', vez: { combatenteId: 't-goku', rodada: 1, turno: 1 } })
    expect(daBia.mudou).toBe(false)
    expect(daBia.saidas[0]?.msg).toEqual({ type: 'batalhaDBT.resultado', reqId: 'r1', ok: false })
    const vezErrada = host.passar(ana, { type: 'batalhaDBT.passar', reqId: 'r2', vez: { combatenteId: 't-goku', rodada: 2, turno: 1 } })
    expect(vezErrada.mudou).toBe(false)
    expect(loja.getState().cenas[CENA]?.ordem.vez).toBe('t-goku')
  })

  it('o mesmo reqId não age duas vezes', () => {
    const { loja, host, ana } = montar()
    const msg: BatalhaDBTPassarMessage = { type: 'batalhaDBT.passar', reqId: 'r9', vez: { combatenteId: 't-goku', rodada: 1, turno: 1 } }
    const primeira = host.passar(ana, msg)
    expect(primeira.mudou).toBe(true)
    const linhas = loja.getState().cenas[CENA]?.registro.length
    const segunda = host.passar(ana, msg)
    expect(segunda.mudou).toBe(false)
    expect(segunda.saidas[0]?.msg).toEqual({ type: 'batalhaDBT.resultado', reqId: 'r9', ok: true })
    expect(loja.getState().cenas[CENA]?.registro.length).toBe(linhas)
  })

  it('agir com chave fora das opções é recusado', () => {
    const { host, ana } = montar()
    const resposta = host.agir(ana, { type: 'batalhaDBT.agir', reqId: 'r3', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'tecnica:nao-existe', alvos: ['t-raditz'] })
    expect(resposta.mudou).toBe(false)
  })

  it('manda estado null uma vez ao desligar', () => {
    const { loja, host, ana, mesa } = montar()
    host.entrou(ana, mesa)
    loja.getState().desligar(CENA)
    expect(host.sync([ana], mesa)).toEqual([{ clientId: 'c-ana', msg: { type: 'batalhaDBT.estado', estado: null } }])
    expect(host.sync([ana], mesa)).toEqual([])
  })

  it('manda o aliado na ordem antes do recorte, pelo paraOFio, e uma vez só', () => {
    const { loja, host, bia, mesa } = montar()
    // Sem equipes, todo jogador que não é dele é aliado: Goku é aliado da Bia. Dado de mestre na ficha não pode sair.
    const npc: NpcDaFichaDBT = { nd: 3, categoria: 'elite', rank: 'B', passivas: [], prontoId: null }
    const comSegredo = mesa.personagens.map((personagem) =>
      personagem.id !== 'goku' || personagem.dbt === undefined ? personagem : { ...personagem, dono: 'conta-1', notaDoMestre: 'segredo', dbt: { ...personagem.dbt, npc } },
    )
    const mesaComSegredo = { personagens: comSegredo }
    const saidas = host.entrou(bia, mesaComSegredo)
    expect(saidas.map((saida) => saida.msg.type)).toEqual(['batalhaDBT.aliados', 'batalhaDBT.estado'])
    const aliados = saidas[0]?.msg
    if (aliados?.type !== 'batalhaDBT.aliados') throw new Error('sem aliados')
    expect(aliados.personagens.map((personagem) => personagem.id)).toEqual(['goku'])
    const goku = aliados.personagens[0]
    expect(goku?.dono).toBeUndefined()
    expect(goku?.notaDoMestre).toBeUndefined()
    expect(goku?.dbt).toBeDefined()
    expect(goku?.dbt?.npc).toBeUndefined()
    // O NPC nunca vai como aliado; a carta do aliado traz o personagem para o perfil.
    const estado = saidas[1]?.msg
    if (estado?.type !== 'batalhaDBT.estado' || estado.estado === null) throw new Error('sem recorte')
    expect(estado.estado.cartas.find((carta) => carta.tokenId === 't-goku')?.personagemId).toBe('goku')
    // Nada mudou: o sync não repete os aliados.
    expect(host.sync([bia], mesaComSegredo).some((saida) => saida.msg.type === 'batalhaDBT.aliados')).toBe(false)
    // Ao desligar, só o `null` (o jogador limpa a faixa e os aliados juntos).
    loja.getState().desligar(CENA)
    expect(host.sync([bia], mesaComSegredo)).toEqual([{ clientId: 'c-bia', msg: { type: 'batalhaDBT.estado', estado: null } }])
  })

  it('quem não tem aliado na ordem não recebe lista vazia', () => {
    const { host, ana, mesa } = montar()
    expect(host.entrou(ana, mesa).some((saida) => saida.msg.type === 'batalhaDBT.aliados')).toBe(false)
  })

  it('cena que não está na batalha DBT (One Piece) não recebe batalhaDBT.*', () => {
    const { host, ana, mesa } = montar()
    const naCenaOnePiece: ConexaoNaBatalhaDBT = { ...ana, lugar: ana.lugar === null ? null : { ...ana.lugar, sceneKey: 'cena-one-piece' } }
    expect(host.entrou(naCenaOnePiece, mesa)).toEqual([])
    expect(host.sync([naCenaOnePiece], mesa)).toEqual([])
  })
})
