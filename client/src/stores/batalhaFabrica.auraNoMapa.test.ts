// @vitest-environment node
/**
 * AURA NA BATALHA COM MAPA (0.6.10, PENDENCIAS nº 1, D9): as condições de fábrica com aura (Inspirado,
 * raio 2; Infectado, raio 1; as duas pegam "aliados") postas pelo nome na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino, com o lugar das fichas na grade dado por
 * `posicaoDoToken` (a mesa do treino não tem mapa; aqui ganha um). A ficha anda e o mapa avisa a
 * batalha (`recalcularAuras`, o que `stores/ponteDasCondicoes.ts` faz): quem entra no raio ganha a
 * condição, quem sai perde, e o registro diz "Aura de X: Y ganhou Z" / "perdeu Z".
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { Casa } from '../lib/batalha/blocos'
import type { MesaDaBatalha } from '../lib/batalha/mesa'
import { combatentesIniciais } from '../lib/batalha/turnos'
import type { Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_da_aura'
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const lutador = (nome: string, agilidade: number): Personagem => ficha(nome, { ...ATRIBUTOS, agilidade }, { hp: 500, sp: 50, escudo: 0 }, {})

interface BatalhaComMapa {
  loja: LojaDaBatalha
  /** Põe a ficha `nome` na casa e avisa a batalha, como o mapa faz quando o token anda. */
  andar: (nome: string, casa: Casa) => void
  token: (nome: string) => string
}

/** Ana (portadora) e Bia do Lado A; Caio do Lado B. `casas`: onde cada uma começa. */
function batalhaComMapa(casas: Record<string, Casa>): BatalhaComMapa {
  const base = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe([{ ficha: lutador('Ana', 30), lado: 'a' }, { ficha: lutador('Bia', 20), lado: 'a' }, { ficha: lutador('Caio', 10), lado: 'b' }]))
  const nomePorToken = new Map(base.tokens().map((token) => [token.id, token.name]))
  const lugar = new Map(Object.entries(casas))
  const mesa: MesaDaBatalha = {
    ...base,
    posicaoDoToken: (_cena, tokenId) => {
      const casa = lugar.get(nomePorToken.get(tokenId) ?? '')
      return casa === undefined ? null : { casa, direcao: null }
    },
  }
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = base.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, base.personagens(), base.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const token = (nome: string): string => {
    const achado = tokens.find((candidato) => candidato.name === nome)
    if (achado === undefined) throw new Error(`sem o token de ${nome}`)
    return achado.id
  }
  return {
    loja,
    token,
    andar: (nome, casa) => {
      lugar.set(nome, casa)
      loja.getState().recalcularAuras(CENA)
    },
  }
}

function cena(loja: LojaDaBatalha): BatalhaDaCena {
  const atual = loja.getState().cenas[CENA]
  if (atual === undefined) throw new Error('a batalha não ligou')
  return atual
}

const selosDe = (b: BatalhaComMapa, nome: string): string[] => (cena(b.loja).turnos.selos ?? []).filter((selo) => selo.tokenId === b.token(nome)).map((selo) => selo.nome)
const ultimaLinha = (loja: LojaDaBatalha): string => cena(loja).registro.at(-1)?.texto ?? ''

describe('aura: Inspirado de fábrica (raio 2, aliados)', () => {
  it('a aliada a 3 casas não pega; andou para 2 (a borda) e ganhou; voltou para 3 e perdeu; o inimigo colado nunca pega', () => {
    const b = batalhaComMapa({ Ana: { col: 0, row: 0 }, Bia: { col: 3, row: 0 }, Caio: { col: 1, row: 1 } })
    expect(b.loja.getState().porSelo(CENA, b.token('Ana'), { nome: 'Inspirado', turnos: 2 })).toBe(true)
    expect(selosDe(b, 'Ana')).toEqual(['Inspirado'])
    expect(selosDe(b, 'Bia')).toEqual([])
    // Caio está a 1 casa, dentro do raio, mas é do outro lado: "aliados" não pega inimigo.
    expect(selosDe(b, 'Caio')).toEqual([])

    b.andar('Bia', { col: 2, row: 0 })
    expect(selosDe(b, 'Bia')).toEqual(['Inspirado'])
    expect(ultimaLinha(b.loja)).toBe('Aura de Ana: Bia ganhou Inspirado')
    // A pega dura enquanto valer (sem turnos) e aponta o selo de origem.
    const pega = (cena(b.loja).turnos.selos ?? []).find((selo) => selo.tokenId === b.token('Bia'))
    const daAna = (cena(b.loja).turnos.selos ?? []).find((selo) => selo.tokenId === b.token('Ana'))
    expect(pega?.turnos).toBeNull()
    expect(pega?.daAura).toBe(daAna?.id)

    // Andar dentro do raio não repete a linha nem refaz a pega.
    const linhas = cena(b.loja).registro.length
    b.andar('Bia', { col: 1, row: 2 })
    expect(cena(b.loja).registro).toHaveLength(linhas)
    expect(selosDe(b, 'Bia')).toEqual(['Inspirado'])

    b.andar('Bia', { col: 3, row: 2 })
    expect(selosDe(b, 'Bia')).toEqual([])
    expect(ultimaLinha(b.loja)).toBe('Aura de Ana: Bia perdeu Inspirado')
    expect(selosDe(b, 'Caio')).toEqual([])
  })
})

describe('aura: Infectado de fábrica (raio 1, aliados)', () => {
  it('a 2 casas não pega, colada pega; a portadora perde o Infectado e a pega sai junto, com "A aura acabou"', () => {
    const b = batalhaComMapa({ Ana: { col: 4, row: 4 }, Bia: { col: 6, row: 4 }, Caio: { col: 9, row: 9 } })
    expect(b.loja.getState().porSelo(CENA, b.token('Ana'), { nome: 'Infectado', turnos: 3 })).toBe(true)
    expect(selosDe(b, 'Bia')).toEqual([])

    b.andar('Bia', { col: 5, row: 5 })
    expect(selosDe(b, 'Bia')).toEqual(['Infectado'])
    expect(ultimaLinha(b.loja)).toBe('Aura de Ana: Bia ganhou Infectado')

    const daAna = (cena(b.loja).turnos.selos ?? []).find((selo) => selo.tokenId === b.token('Ana') && selo.nome === 'Infectado')
    if (daAna === undefined) throw new Error('a Ana perdeu o Infectado antes da hora')
    expect(b.loja.getState().tirarSelo(CENA, daAna.id)).toBe(true)
    expect(selosDe(b, 'Ana')).toEqual([])
    expect(selosDe(b, 'Bia')).toEqual([])
    expect(ultimaLinha(b.loja)).toBe('A aura acabou: Bia perdeu Infectado')
  })
})
