import { beforeEach, describe, expect, it } from 'vitest'
import type { PedidoDeAcao } from '../../lib/batalha/combate'
import { aliadosDe, ladoDoNpc, type Equipe } from '../../lib/batalha/equipes'
import { ficha } from '../../lib/batalha/fichasDaFatiaB.testkit'
import type { VezEsperada } from '../../lib/batalha/ponte'
import { combatentesIniciais, type AutorDaAcao } from '../../lib/batalha/turnos'
import { createEmptyMap } from '../../lib/mapFactory'
import { numeroDaFicha, type CartaoDaFicha, type Personagem } from '../../lib/personagem'
import { SISTEMA_ONE_PIECE } from '../../lib/sistemaOnePiece'
import { equipesAtivas, personagensAtivos, useAdventureStore } from '../../stores/adventureStore'
import { useBatalhaStore } from '../../stores/batalhaStore'
import { useMapStore } from '../../stores/mapStore'
import { porNpcNoLado } from './ladoDoNpcNaTela'

/**
 * Segunda auditoria da batalha (09/11/2026, achado 2): "Do lado dos jogadores"
 * gravava a equipe "Jogadores" só com os jogadores daquele momento, sem linha
 * no registro, e ela ficava na pasta depois de o NPC voltar. O jogador criado
 * depois ficava sem equipe: os colegas deixavam de ver a vida dele e a cura de
 * jogador nele era recusada. Pelas stores de verdade (a aventura e a batalha).
 * Dados inventados; no máximo 2 testes.
 */

const CENA = 'cena_do_lado'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const JOGADORA: AutorDaAcao = { tipo: 'jogador', playerId: 'p1', nome: 'Jogadora de Teste' }

const CURA_DE_TESTE: CartaoDaFicha = {
  id: 'cart_cura_de_teste',
  nome: 'Cura de Teste',
  campos: {},
  extras: [],
  atributos: [],
  imagem: null,
  modificadores: [],
  subcartoes: [],
  mecanica: { versao: 1, acao: 'simples', alvo: { quem: 'aliados', forma: { tipo: 'varios', max: 2 } }, efeitos: [{ tipo: 'cura', recurso: 'hp', quanto: { fixo: 50 }, emQuem: 'alvo' }] },
}

/** Uma ficha de teste com 200 de 500 de HP (a cura aparece). */
function ferido(nome: string, tipo: Personagem['tipo'], habilidades: CartaoDaFicha[] = []): Personagem {
  const base = ficha(nome, { forca: 20 }, { hp: 500, sp: 100, escudo: 0 }, { habilidades })
  return { ...base, tipo, recursos: { ...base.recursos, hp: 200 } }
}

const curandeira = ferido('Curandeira de Teste', 'jogador', [CURA_DE_TESTE])
const arvore = ferido('Árvore de Teste', 'npc')
const urso = ferido('Urso de Teste', 'npc')
const grumete = ferido('Grumete de Teste', 'jogador')

const equipes = (): readonly Equipe[] => equipesAtivas(useAdventureStore.getState())
const personagens = (): readonly Personagem[] => personagensAtivos(useAdventureStore.getState())
const registro = (): string[] => (useBatalhaStore.getState().cenas[CENA]?.registro ?? []).map((linha) => linha.texto)

function porNoMapa(personagem: Personagem, tokenId: string): { id: string; characterId: string; name: string } {
  useMapStore.getState().addToken({ id: tokenId, characterId: personagem.id, name: personagem.nome, x: 100, y: 100, size: 1, image: null, ...(personagem.tipo === 'npc' ? { npc: true } : {}) })
  return { id: tokenId, characterId: personagem.id, name: personagem.nome }
}

function naVezDe(nome: string): VezEsperada {
  for (let i = 0; i < 6; i += 1) {
    const turnos = useBatalhaStore.getState().cenas[CENA]?.turnos
    if (turnos === undefined) throw new Error('a batalha não ligou')
    if (turnos.vez !== null && turnos.cartas.find((carta) => carta.id === turnos.vez)?.nome === nome) return { cartaId: turnos.vez, rodada: turnos.rodada }
    useBatalhaStore.getState().passarVez(CENA, MESTRE, turnos.vez === null ? undefined : { cartaId: turnos.vez, rodada: turnos.rodada })
  }
  throw new Error(`a vez de ${nome} não chegou`)
}

function curar(tokenId: string): PedidoDeAcao {
  return { tipo: 'habilidade', cartaoId: CURA_DE_TESTE.id, armaId: null, alvos: [{ tokenId, dano: null }], surpresa: false, perfurante: false, custo: null, acao: null }
}

/** A aventura de teste com a Curandeira (jogadora), a Árvore e o Urso (NPCs), os três na batalha ligada. */
beforeEach(() => {
  useBatalhaStore.getState().reset()
  const aventura = useAdventureStore.getState()
  aventura.virarAventura(null)
  aventura.setSistemaDeRpg('one-piece')
  if (!useAdventureStore.getState().adicionarPersonagens([curandeira, arvore, urso])) throw new Error('a aventura de teste não guardou as fichas')
  useMapStore.getState().loadMap(createEmptyMap('mapa-do-lado', 'Clareira de Teste', 20, 20, 50))
  const tokens = [porNoMapa(curandeira, 'tok_curandeira'), porNoMapa(arvore, 'tok_arvore'), porNoMapa(urso, 'tok_urso')]
  const combatentes = combatentesIniciais(useMapStore.getState().map.tokens, personagens(), SISTEMA_ONE_PIECE, new Set(tokens.map((token) => token.id)))
  useBatalhaStore.getState().ligar(CENA, {}, { combatentes, regras: null, desempate: 'd20' })
})

describe('o lado do NPC na pasta e no registro da batalha', () => {
  it('a Árvore passa para o lado dos jogadores e fica no registro; o jogador que entra depois é aliado e a cura de jogador nele passa; a Árvore volta e a pasta fica como antes', () => {
    expect(equipes()).toEqual([])
    expect(porNpcNoLado(arvore.id, 'jogadores')).toBe(true)
    expect(registro().at(-1)).toBe('Árvore de Teste passou para o lado dos jogadores')

    expect(useAdventureStore.getState().adicionarPersonagens([grumete])).toBe(true)
    expect(useBatalhaStore.getState().incluirCombatente(CENA, porNoMapa(grumete, 'tok_grumete'))).toBe(true)
    // O que cada jogador vê dos colegas: o que chegou depois é aliado, dos dois lados.
    expect([aliadosDe(new Set([curandeira.id]), equipes(), personagens()).has(grumete.id), aliadosDe(new Set([grumete.id]), equipes(), personagens()).has(curandeira.id)]).toEqual([true, true])
    expect(useBatalhaStore.getState().agir(CENA, JOGADORA, naVezDe('Curandeira de Teste'), curar('tok_grumete'))).toBe(true)
    expect(numeroDaFicha(personagens().find((personagem) => personagem.id === grumete.id)?.recursos ?? {}, 'hp')).toBe(250)

    expect(porNpcNoLado(arvore.id, 'contra')).toBe(true)
    expect(equipes()).toEqual([])
    expect(registro().at(-1)).toBe('Árvore de Teste passou a lutar contra os jogadores')
    // O Desfazer da linha traz a Árvore de volta para o lado dos jogadores (a equipe automática renasce).
    const ultima = useBatalhaStore.getState().cenas[CENA]?.registro.at(-1)
    expect(useBatalhaStore.getState().desfazer(CENA, ultima?.id ?? '', MESTRE)).toBe(true)
    expect(ladoDoNpc(arvore.id, equipes(), personagens())).toBe('jogadores')
  })

  it('pasta com equipe feita pelo mestre joga como antes: o jogador sem equipe segue sem aliados, a equipe fica quando o NPC sai e a linha do registro é a de sempre', () => {
    const navio: Equipe = { id: 'equipe_do_navio', nome: 'Navio de Teste', cor: '#336699', membros: [curandeira.id, arvore.id] }
    expect(useAdventureStore.getState().salvarEquipes([navio])).toBe(true)
    expect(useAdventureStore.getState().adicionarPersonagens([grumete])).toBe(true)
    expect(aliadosDe(new Set([curandeira.id]), equipes(), personagens()).has(grumete.id)).toBe(false)
    expect(porNpcNoLado(arvore.id, 'contra')).toBe(true)
    expect(equipes()).toEqual([{ ...navio, membros: [curandeira.id] }])
    expect(registro().at(-1)).toBe('Árvore de Teste: Navio de Teste → sem equipe')
  })
})
