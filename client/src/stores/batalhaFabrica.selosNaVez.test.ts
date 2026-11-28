// @vitest-environment node
/**
 * BUGS DA BATALHA (testadores de 28/11/2026): o que os selos fazem na virada da vez, na store do app
 * (`criarBatalhaStore`) sobre a mesa em memória do treino. Ana (Agilidade 60), Bia (20) e Caio (10).
 * - O gatilho "depois de X turnos" (Pavio aceso, 2 turnos: 30 de dano + Queimando) conta uma vez por
 *   VEZ, como o prazo: não conta de novo quando o "Dar a vez" devolve a vez à mesma carta, nem na vez em
 *   que o selo nasceu.
 */
import { describe, expect, it } from 'vitest'
import { ficha } from '../lib/batalha/fichasDaFatiaB.testkit'
import type { SeloDaBatalha } from '../lib/batalha/combate'
import { bonusDaBatalha, totalDoBonus } from '../lib/batalha/selos'
import { combatentesIniciais, type AutorDaAcao } from '../lib/batalha/turnos'
import { numeroDaFicha, type Personagem } from '../lib/personagem'
import { lutadoresDe, SISTEMA_DO_TESTE } from '../lib/treino/fichasDeTreino.testkit'
import { criarMesaEmMemoria, type MesaEmMemoria } from '../lib/treino/mesaEmMemoria'
import { criarBatalhaStore, type BatalhaDaCena, type LojaDaBatalha } from './batalhaFabrica'

const CENA = 'cena_dos_selos'
const MESTRE: AutorDaAcao = { tipo: 'mestre' }
const ATRIBUTOS = { forca: 10, agilidade: 10, percepcao: 10, resistencia: 10, intuicao: 10, espirito: 10, carisma: 10, determinacao: 10 }
const lutador = (nome: string, agilidade: number): Personagem => ficha(nome, { ...ATRIBUTOS, agilidade }, { hp: 500, sp: 50, escudo: 0 }, {})

interface Batalha {
  loja: LojaDaBatalha
  mesa: MesaEmMemoria
  token: (nome: string) => string
  carta: (nome: string) => string
  cena: () => BatalhaDaCena
  /** Passa a vez (do mestre) até a de `nome`. */
  passarAte: (nome: string) => void
  selo: (nome: string, selo: string) => SeloDaBatalha | undefined
  hp: (nome: string) => number
}

function batalha(lutadores: readonly Personagem[] = [lutador('Ana', 60), lutador('Bia', 20), lutador('Caio', 10)]): Batalha {
  const mesa = criarMesaEmMemoria(SISTEMA_DO_TESTE, lutadoresDe(lutadores.map((personagem, i) => ({ ficha: personagem, lado: i === lutadores.length - 1 ? 'b' : 'a' }))))
  const loja = criarBatalhaStore(mesa, { rolarD20: () => 10, outraBatalhaLigada: () => false })
  const tokens = mesa.tokens()
  loja.getState().ligar(CENA, {}, { combatentes: combatentesIniciais(tokens, mesa.personagens(), mesa.sistema(), new Set(tokens.map((token) => token.id))), regras: null, desempate: 'd20' })
  const cena = (): BatalhaDaCena => {
    const atual = loja.getState().cenas[CENA]
    if (atual === undefined) throw new Error('a batalha não ligou')
    return atual
  }
  const cartaDe = (nome: string): string => {
    const achada = cena().turnos.cartas.find((carta) => carta.nome === nome)
    if (achada === undefined) throw new Error(`sem a carta de ${nome}`)
    return achada.id
  }
  const token = (nome: string): string => cena().turnos.cartas.find((carta) => carta.nome === nome)?.tokenId ?? ''
  return {
    loja,
    mesa,
    token,
    carta: cartaDe,
    cena,
    passarAte: (nome) => {
      for (let i = 0; i < 6; i += 1) {
        if (cena().turnos.vez === cartaDe(nome)) return
        expect(loja.getState().passarVez(CENA, MESTRE)).toBe(true)
      }
      throw new Error(`a vez de ${nome} não chegou`)
    },
    selo: (nome, selo) => (cena().turnos.selos ?? []).find((candidato) => candidato.tokenId === token(nome) && candidato.nome === selo),
    hp: (nome) => numeroDaFicha(mesa.personagens().find((personagem) => personagem.nome === nome)?.recursos ?? {}, 'hp'),
  }
}

describe('o gatilho "depois de X turnos" conta uma vez por vez, como o prazo', () => {
  it('o "Dar a vez" que devolve a vez à mesma carta na rodada não conta o Pavio de novo (nem o Envenenado)', () => {
    const b = batalha()
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Pavio aceso', turnos: null })).toBe(true)
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Envenenado', turnos: 3 })).toBe(true)
    b.passarAte('Caio')
    expect([b.selo('Bia', 'Pavio aceso')?.gatilhoConta, b.selo('Bia', 'Envenenado')?.turnos]).toEqual([1, 2])
    expect(b.loja.getState().darVez(CENA, b.carta('Bia'))).toBe(true)
    expect(b.loja.getState().passarVez(CENA, MESTRE)).toBe(true)
    expect([b.selo('Bia', 'Pavio aceso')?.gatilhoConta, b.selo('Bia', 'Envenenado')?.turnos, b.hp('Bia')]).toEqual([1, 2, 500])
  })

  it('posto na vez da própria Bia, o Pavio não conta nessa vez (como o Queimando, que segue 2)', () => {
    const b = batalha()
    b.passarAte('Bia')
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Pavio aceso', turnos: null })).toBe(true)
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Queimando', turnos: 2 })).toBe(true)
    expect(b.loja.getState().passarVez(CENA, MESTRE)).toBe(true)
    expect([b.selo('Bia', 'Pavio aceso')?.gatilhoConta, b.selo('Bia', 'Queimando')?.turnos]).toEqual([undefined, 2])
  })
})

describe('a queda em % sai do atributo de agora (a ficha mais os mods da batalha)', () => {
  it('Bia com Força 40 e Fortalecido (+20): o Enfraquecido (−20% da Força) tira 12 (20% de 60), não 8', () => {
    const b = batalha([lutador('Ana', 60), { ...lutador('Bia', 20), atributos: { ...ATRIBUTOS, agilidade: 20, forca: 40 } }, lutador('Caio', 10)])
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Fortalecido', turnos: 3 })).toBe(true)
    expect(totalDoBonus(bonusDaBatalha(b.cena().turnos.selos, b.token('Bia')), 'forca')).toBe(20)
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Enfraquecido', turnos: 2 })).toBe(true)
    expect(totalDoBonus(bonusDaBatalha(b.cena().turnos.selos, b.token('Bia')), 'forca')).toBe(20 - 12)
  })
})

describe('o "Recupera por turno" lê a fórmula com os atributos de agora', () => {
  it('Bia (Resistência 40, recupera "Resistência", HP 300/500) com Fraqueza −20 de Resistência: recupera 20 na vez seguinte', () => {
    const recupera = { tipo: 'recuperacao' as const, id: 'car_recupera', hp: { quanto: 'Resistência' } }
    const bia: Personagem = { ...lutador('Bia', 20), atributos: { ...ATRIBUTOS, agilidade: 20, resistencia: 40 }, caracteristicas: [recupera] }
    const b = batalha([lutador('Ana', 60), { ...bia, recursos: { ...bia.recursos, hp: 300 } }, lutador('Caio', 10)])
    b.passarAte('Caio')
    expect(b.loja.getState().porSelo(CENA, b.token('Bia'), { nome: 'Fraqueza', turnos: 3, mods: [{ alvo: 'resistencia', delta: -20 }] })).toBe(true)
    b.passarAte('Bia')
    expect(b.hp('Bia')).toBe(300 + 20)
  })
})
