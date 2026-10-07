import { describe, expect, it } from 'vitest'
import type { PlayerInfo } from '../net/hostSession'
import {
  agruparPorCena,
  casaBusca,
  cenaCongelada,
  contarPedindo,
  estaPendente,
  fichasDaCena,
  MAPA_SEM_NOME_LABEL,
  personagemDe,
  presencaNaLinha,
  SEM_CENA_LABEL,
  seloFora,
  type CenaNaOrdem,
  type LinhaDoGrupo,
} from './grupoPorCena'
import type { PartyMember } from './party'

/*
 * GRUPO POR CENA: a mesa de 10 em grupos, um por cena — a aberta no editor
 * primeiro, depois a ordem da lista Cenas, e quem está sem cena por último.
 */

const CENAS: CenaNaOrdem[] = [
  { id: 's-salao', name: 'Salão' },
  { id: 's-cripta', name: 'Cripta' },
  { id: 's-torre', name: 'Torre' },
]

function jogador(over: Partial<PlayerInfo> & Pick<PlayerInfo, 'playerId' | 'name'>): PlayerInfo {
  return { clientId: `c-${over.playerId}`, status: 'playing', connected: true, tokenIds: [], visionRadius: 700, visionFactor: 1, ...over }
}

function membro(player: PlayerInfo, over: Partial<PartyMember> = {}): PartyMember {
  return {
    playerId: player.playerId,
    name: player.name,
    connected: player.connected,
    sceneId: player.sceneId ?? null,
    sceneName: player.sceneName ?? null,
    token: player.tokenIds[0] === undefined ? null : { id: player.tokenIds[0], color: '#ffffff', x: 0, y: 0 },
    travelPending: false,
    mochila: [],
    ...over,
  }
}

const ANA = jogador({ playerId: 'ana', name: 'Ana', tokenIds: ['t-ana'], sceneId: 's-cripta', sceneName: 'Cripta' })
const BIA = jogador({ playerId: 'bia', name: 'Bia', tokenIds: ['t-bia'], sceneId: 's-salao', sceneName: 'Salão' })
const CAIO = jogador({ playerId: 'caio', name: 'Caio', tokenIds: ['t-caio'], sceneId: 's-torre', sceneName: 'Torre' })
/** Caiu, mas a ficha continua na Cripta: ele fica lá, apagado. */
const DUDA = jogador({ playerId: 'duda', name: 'Duda', tokenIds: ['t-duda'], sceneId: 's-cripta', sceneName: 'Cripta', connected: false, clientId: null, disconnectedAt: 1_000 })
/** Chegou agora: espera personagem, conectado. */
const ENZO = jogador({ playerId: 'enzo', name: 'Enzo', status: 'waiting' })
/** Esperava e caiu: não espera nada agora, e fica sem cena. */
const FABI = jogador({ playerId: 'fabi', name: 'Fabi', status: 'waiting', connected: false, clientId: null })
/** Numa cena que não está na lista (a lista ainda não recarregou). */
const GABI = jogador({ playerId: 'gabi', name: 'Gabi', tokenIds: ['t-gabi'], sceneId: 's-porao', sceneName: 'Porão' })

const NOMES_DAS_FICHAS = new Map([
  ['t-ana', 'Lyra da Névoa'],
  ['t-bia', 'Kael Tempestade'],
  ['t-caio', 'Vex'],
  ['t-duda', 'Órion'],
  ['t-gabi', 'Sálvia'],
])

const nomes = (linhas: readonly LinhaDoGrupo[]): string[] => linhas.map((linha) => linha.player.name)

describe('agruparPorCena: ordem dos grupos', () => {
  const players = [ANA, BIA, CAIO, DUDA, ENZO, FABI, GABI]
  const members = players.map((p) => membro(p))

  it('a cena aberta no editor primeiro, depois a ordem da lista Cenas, as de fora da lista e, por último, quem está sem cena', () => {
    const { grupos } = agruparPorCena(players, members, { cenaAberta: 's-torre', ordemDasCenas: CENAS })
    expect(grupos.map((g) => [g.sceneId, g.nome])).toEqual([
      ['s-torre', 'Torre'],
      ['s-salao', 'Salão'],
      ['s-cripta', 'Cripta'],
      ['s-porao', 'Porão'],
      [null, SEM_CENA_LABEL],
    ])
  })

  it('dentro do grupo, a ordem de chegada; quem caiu fica na cena da ficha', () => {
    const { grupos } = agruparPorCena(players, members, { cenaAberta: 's-salao', ordemDasCenas: CENAS })
    expect(nomes(grupos.find((g) => g.sceneId === 's-cripta')?.linhas ?? [])).toEqual(['Ana', 'Duda'])
    expect(nomes(grupos.find((g) => g.sceneId === null)?.linhas ?? [])).toEqual(['Fabi'])
  })

  it('quem espera personagem conectado vai para "Chegando", fora dos grupos', () => {
    const { chegando, grupos } = agruparPorCena(players, members, { cenaAberta: 's-salao', ordemDasCenas: CENAS })
    expect(nomes(chegando)).toEqual(['Enzo'])
    expect(grupos.flatMap((g) => nomes(g.linhas))).not.toContain('Enzo')
  })

  it('cena sem ninguém não vira grupo', () => {
    const { grupos } = agruparPorCena([BIA], [membro(BIA)], { cenaAberta: 's-cripta', ordemDasCenas: CENAS })
    expect(grupos.map((g) => g.sceneId)).toEqual(['s-salao'])
  })

  it('sem o Grupo (painel sem aventura nem câmera): a cena vem da sala', () => {
    const { grupos } = agruparPorCena([ANA, BIA], undefined, { cenaAberta: 's-cripta', ordemDasCenas: CENAS })
    expect(grupos.map((g) => g.sceneId)).toEqual(['s-cripta', 's-salao'])
    expect(grupos[0]?.linhas[0]?.member).toBeUndefined()
  })

  it('mapa solto: um grupo só, com o nome do mapa (ou "Mapa" sem nome)', () => {
    const soltos = [jogador({ playerId: 'x', name: 'Xavi', tokenIds: ['t'] }), jogador({ playerId: 'y', name: 'Yara' })]
    const { grupos } = agruparPorCena(soltos, soltos.map((p) => membro(p)), { cenaAberta: null, ordemDasCenas: [], nomeDoMapa: 'Masmorra do Rei' })
    expect(grupos.map((g) => [g.sceneId, g.nome, nomes(g.linhas)])).toEqual([[null, 'Masmorra do Rei', ['Xavi', 'Yara']]])
    expect(agruparPorCena(soltos, undefined, { cenaAberta: null, ordemDasCenas: [], nomeDoMapa: '  ' }).grupos[0]?.nome).toBe(MAPA_SEM_NOME_LABEL)
  })
})

describe('agruparPorCena: busca e "Pedindo"', () => {
  const players = [ANA, BIA, CAIO, DUDA, ENZO]
  const members = [membro(ANA, { travelPending: true }), membro(BIA), membro(CAIO, { awayTokens: [{ tokenId: 'x', name: 'Faísca', sceneId: 's-salao', sceneName: 'Salão' }] }), membro(DUDA), membro(ENZO)]
  const opcoes = { cenaAberta: 's-salao', ordemDasCenas: CENAS, nomesDasFichas: NOMES_DAS_FICHAS }

  it('a busca casa o nome do jogador ou do personagem, sem acento nem maiúscula', () => {
    const porPersonagem = agruparPorCena(players, members, { ...opcoes, busca: 'nevoa' })
    expect(porPersonagem.grupos.flatMap((g) => nomes(g.linhas))).toEqual(['Ana'])
    const porJogador = agruparPorCena(players, members, { ...opcoes, busca: '  CAI ' })
    expect(porJogador.grupos.flatMap((g) => nomes(g.linhas))).toEqual(['Caio'])
    const ninguem = agruparPorCena(players, members, { ...opcoes, busca: 'zzz' })
    expect(ninguem.grupos).toEqual([])
    expect(ninguem.chegando).toEqual([])
  })

  it('"Pedindo": passagem, ficha longe ou personagem; a contagem do chip ignora a busca', () => {
    const { chegando, grupos } = agruparPorCena(players, members, { ...opcoes, soPedindo: true })
    expect(nomes(chegando)).toEqual(['Enzo'])
    // Salão (aberta) não tem quem peça; depois Cripta (Ana, passagem) e Torre (Caio, ficha longe).
    expect(grupos.map((g) => [g.sceneId, nomes(g.linhas)])).toEqual([
      ['s-cripta', ['Ana']],
      ['s-torre', ['Caio']],
    ])
    expect(contarPedindo(players, members)).toBe(3)
    expect(contarPedindo([BIA], [membro(BIA)])).toBe(0)
  })

  it('o pedido de passagem vale também vindo só da sala (sem a linha do Grupo)', () => {
    const pedindo = { ...BIA, travelPending: true as const }
    expect(estaPendente(pedindo, undefined)).toBe(true)
    expect(estaPendente(BIA, membro(BIA))).toBe(false)
    // Quem esperava e caiu não espera nada agora.
    expect(estaPendente(FABI, membro(FABI))).toBe(false)
  })

  it('personagem: a ficha da linha, senão a primeira dele; sem nome ou sem ficha, nenhum', () => {
    expect(personagemDe(ANA, membro(ANA), NOMES_DAS_FICHAS)).toBe('Lyra da Névoa')
    expect(personagemDe(ANA, undefined, NOMES_DAS_FICHAS)).toBe('Lyra da Névoa')
    expect(personagemDe(ENZO, membro(ENZO), NOMES_DAS_FICHAS)).toBeNull()
    expect(personagemDe(ANA, membro(ANA), new Map([['t-ana', '   ']]))).toBeNull()
    expect(casaBusca({ player: ENZO, personagem: null }, '')).toBe(true)
  })
})

describe('a linha: presença, selo de quem caiu e congelar a cena', () => {
  it('volto já vem antes de "fora"; "fora" antes de congelado', () => {
    expect(presencaNaLinha(BIA, membro(BIA))).toBe('online')
    expect(presencaNaLinha(BIA, membro(BIA, { congelado: true }))).toBe('congelado')
    expect(presencaNaLinha(DUDA, membro(DUDA, { congelado: true }))).toBe('fora')
    expect(presencaNaLinha({ ...DUDA, away: true }, membro(DUDA))).toBe('volto-ja')
  })

  it('"fora 0:10" no primeiro minuto, depois "fora 4 min"; sem a hora da queda, só "fora"', () => {
    expect(seloFora(DUDA, 11_000)).toBe('fora 0:10')
    expect(seloFora(DUDA, 1_000 + 4 * 60_000 + 5_000)).toBe('fora 4 min')
    expect(seloFora({ ...DUDA, disconnectedAt: undefined }, 99_000)).toBe('fora')
  })

  it('"Congelar a cena" leva a ficha da linha e as que andam com ela; "Descongelar" só com todas congeladas', () => {
    const linhas: LinhaDoGrupo[] = [
      { player: ANA, member: membro(ANA, { entourageIds: ['t-cavalo'], congelado: true }), personagem: null },
      { player: DUDA, member: membro(DUDA), personagem: null },
      { player: ENZO, member: membro(ENZO), personagem: null },
    ]
    expect(fichasDaCena(linhas)).toEqual(['t-ana', 't-cavalo', 't-duda'])
    expect(cenaCongelada(linhas)).toBe(false)
    const todas = linhas.map((linha) => ({ ...linha, member: linha.member === undefined ? undefined : { ...linha.member, congelado: true as const } }))
    // Quem não tem ficha (Enzo) não conta.
    expect(cenaCongelada(todas)).toBe(true)
    expect(cenaCongelada([{ player: ENZO, member: membro(ENZO), personagem: null }])).toBe(false)
  })
})
