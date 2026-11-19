// @vitest-environment node
/**
 * CONTRATO DA CASCA DA BATALHA (análise 18/11/2026, seção 3, causa 3). Os dois
 * motores têm regras diferentes de verdade, mas a casca (o que a mesa faz com
 * a batalha) era copiada à mão e o que entrou depois de 02/11 ficava só no One
 * Piece. Aqui as DUAS stores passam pelo MESMO contrato: o que entrar na casca
 * de uma e faltar na outra fica vermelho neste arquivo.
 *
 * Fora daqui, por ter forma diferente em cada motor: a forma no token (One
 * Piece `fotosDaFormaDoMestre`, DBT `fotosDaFormaDBT`, `lib/dbt/batalha/store.test.ts`)
 * e o "Usar item" (One Piece pelo cartão com custo de item, DBT pela ação `item:`).
 */
import { describe, expect, it } from 'vitest'
import { batalhaSalvaDoTexto, textoDaBatalhaSalva } from '../lib/batalha/batalhaSalva'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais } from '../lib/batalha/turnos'
import { fichaDBTVazia } from '../lib/dbt/modelo'
import { SISTEMA_DRAGON_BALL } from '../lib/dbt/sistemaDragonBall'
import { novoPersonagem, personagemDoArquivo, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaDBTStore } from './batalhaDBTStore'
import { criarBatalhaStore } from './batalhaFabrica'

const CENA = 'cena_do_contrato'

/** O que o contrato pede de cada store, na língua da casca (tokens da cena), sem as regras do motor. */
interface CascaDeTeste {
  /** Os tokens da batalha agora, em ordem. */
  emBatalha(): readonly string[]
  /** A mesa diz quais tokens ainda estão na cena (o "apagar ficha" do editor chama isto). */
  normalizar(ficam: ReadonlySet<string>): void
  /** Grava pelo texto do arquivo e retoma numa store NOVA; os tokens da batalha que voltou (null = não voltou). */
  salvarERetomar(): readonly string[] | null
}

function fichaOP(dados: Record<string, unknown>): Personagem {
  const lida = personagemDoArquivo(dados)
  if (lida === null) throw new Error('ficha de teste inválida')
  return lida
}

function cascaOnePiece(): CascaDeTeste {
  const lutadores = lutadoresDe([
    { ficha: fichaOP({ id: 'pers_a', tipo: 'jogador', nome: 'Atiradora', recursos: { hp: 300, sp: 60 }, atributos: { agilidade: 70 } }), lado: 'a' },
    { ficha: fichaOP({ id: 'pers_b', tipo: 'npc', nome: 'Coveiro', recursos: { hp: 300, sp: 60 }, atributos: { agilidade: 40 } }), lado: 'b' },
  ])
  const deps = { rolarD20: () => 10, outraBatalhaLigada: () => false }
  const memoria = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadores)
  const loja = criarBatalhaStore(memoria, deps)
  const tokens = memoria.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, memoria.personagens(), memoria.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const tokensDe = (cena: { turnos: { cartas: readonly { tokenId: string }[] } } | undefined) => (cena === undefined ? null : [...new Set(cena.turnos.cartas.map((carta) => carta.tokenId))])
  return {
    emBatalha: () => tokensDe(loja.getState().cenas[CENA]) ?? [],
    normalizar: (ficam) => loja.getState().normalizarCena(CENA, ficam),
    salvarERetomar: () => {
      const cena = loja.getState().cenas[CENA]
      if (cena === undefined) return null
      const lido = batalhaSalvaDoTexto(textoDaBatalhaSalva({ mesaId: 'adv_contrato', salvaEm: 1, cenas: { [CENA]: cena } }))
      const salva = lido.ok ? lido.salva.cenas[CENA] : undefined
      const nova = criarBatalhaStore(criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadores), deps)
      if (salva === undefined || !nova.getState().retomar(CENA, salva)) return null
      return tokensDe(nova.getState().cenas[CENA])
    },
  }
}

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, recursos: { ...novo.recursos, pv: 10, pk: 20 }, dbt: novo.dbt ?? fichaDBTVazia() }
}

function mesaDBT(): MesaDaBatalha {
  const personagens = new Map([personagemDBT('goku', 'jogador', 'Goku'), personagemDBT('raditz', 'npc', 'Raditz')].map((p) => [p.id, p]))
  return {
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
}

function cascaDragonBall(): CascaDeTeste {
  const deps = { rolar: () => 10, agora: () => 1000, posicoes: () => null }
  const loja = criarBatalhaDBTStore(mesaDBT(), deps)
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  const tokensDe = (cena: { ordem: { cartas: readonly string[] } } | undefined) => (cena === undefined ? null : [...cena.ordem.cartas])
  return {
    emBatalha: () => tokensDe(loja.getState().cenas[CENA]) ?? [],
    normalizar: (ficam) => loja.getState().normalizarCena(CENA, ficam),
    salvarERetomar: () => {
      const cena = loja.getState().cenas[CENA]
      if (cena === undefined) return null
      const lido = batalhaSalvaDoTexto(textoDaBatalhaSalva({ mesaId: 'adv_contrato', salvaEm: 1, cenas: {}, dbt: { [CENA]: cena } }))
      const salva = lido.ok ? lido.salva.dbt?.[CENA] : undefined
      const nova = criarBatalhaDBTStore(mesaDBT(), deps)
      if (salva === undefined || !nova.getState().retomar(CENA, salva)) return null
      return tokensDe(nova.getState().cenas[CENA])
    },
  }
}

describe.each([
  { motor: 'One Piece', montar: cascaOnePiece },
  { motor: 'Dragon Ball', montar: cascaDragonBall },
])('casca da batalha ($motor)', ({ montar }) => {
  it('ficha apagada do mapa sai da batalha, a outra fica', () => {
    const casca = montar()
    const [fica, sai] = casca.emBatalha()
    expect(casca.emBatalha()).toHaveLength(2)
    casca.normalizar(new Set([fica]))
    expect(casca.emBatalha()).toEqual([fica])
    expect(casca.emBatalha()).not.toContain(sai)
  })

  it('a batalha vai ao arquivo e volta pela retomar, numa store nova, com os mesmos combatentes', () => {
    const casca = montar()
    expect(casca.salvarERetomar()).toEqual(casca.emBatalha())
  })
})
