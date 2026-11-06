import { describe, expect, it } from 'vitest'
import { centroDaCasaNaArena, type CasaDaArena } from '../../../../lib/arena/grade'
import type { GolpeDaBatalha } from '../../../../lib/batalha/combate'
import { DIRECAO_INICIAL, direcaoSeguinte, type DirecaoDoJudge } from '../../../../lib/batalha/judge'
import { turnosVazios, type CartaDaOrdem, type TurnosDaCena } from '../../../../lib/batalha/turnos'
import { quemOJuizOlha } from './olharDoJuiz'

/**
 * Para quem o Judge da grade do site olha, e para que lado da folha ele vira.
 * A regra do app (TelaDaArena): vira para a ficha da vez, e na vez dele fica
 * como está; no site, o golpe que o envolve vem na frente.
 */

const JUIZ = 'tok_juiz'
const NAMI = 'tok_nami'
const ZORO = 'tok_zoro'

function carta(tokenId: string): CartaDaOrdem {
  return { id: `carta_${tokenId}`, tokenId, personagemId: `p_${tokenId}` }
}

/** Só o que a regra lê do golpe: quem ataca e quem é alvo. */
function golpe(atacanteTokenId: string, alvos: readonly string[]): GolpeDaBatalha {
  const parcial = { id: `golpe_${atacanteTokenId}_${alvos.join('_')}`, atacanteTokenId, alvos: alvos.map((tokenId) => ({ tokenId, personagemId: null, dano: 1, podeReagir: true })) }
  // Teste: o resto do golpe não entra na regra.
  return parcial as unknown as GolpeDaBatalha
}

function turnos(vez: string | null, golpes?: readonly GolpeDaBatalha[]): TurnosDaCena {
  const cartas = [carta(NAMI), carta(JUIZ), carta(ZORO)]
  return { ...turnosVazios(), cartas, vez: vez === null ? null : `carta_${vez}`, ...(golpes === undefined ? {} : { golpes }) }
}

describe('quemOJuizOlha', () => {
  it('sem golpe, olha para a ficha da vez', () => {
    expect(quemOJuizOlha(turnos(NAMI), JUIZ)).toBe(NAMI)
  })

  it('na vez dele e sem golpe, fica como está (null)', () => {
    expect(quemOJuizOlha(turnos(JUIZ), JUIZ)).toBeNull()
  })

  it('antes da luta começar (sem vez), fica como está', () => {
    expect(quemOJuizOlha(turnos(null), JUIZ)).toBeNull()
  })

  it('vez numa carta que não existe mais na ordem fica como está', () => {
    const t = { ...turnos(NAMI), vez: 'carta_que_saiu' }
    expect(quemOJuizOlha(t, JUIZ)).toBeNull()
  })

  it('golpe dele esperando a reação: olha para quem ele mira, mesmo na vez de outro', () => {
    expect(quemOJuizOlha(turnos(NAMI, [golpe(JUIZ, [ZORO])]), JUIZ)).toBe(ZORO)
  })

  it('golpe contra ele: olha para quem o ataca', () => {
    expect(quemOJuizOlha(turnos(JUIZ, [golpe(ZORO, [JUIZ])]), JUIZ)).toBe(ZORO)
  })

  it('golpe em área que também o atinge (ele é atacante e alvo) olha para o outro alvo', () => {
    expect(quemOJuizOlha(turnos(JUIZ, [golpe(JUIZ, [JUIZ, NAMI])]), JUIZ)).toBe(NAMI)
  })

  it('o golpe mais novo manda', () => {
    expect(quemOJuizOlha(turnos(JUIZ, [golpe(ZORO, [JUIZ]), golpe(NAMI, [JUIZ])]), JUIZ)).toBe(NAMI)
  })

  it('golpe entre os outros dois não o envolve: segue a ficha da vez', () => {
    expect(quemOJuizOlha(turnos(ZORO, [golpe(NAMI, [ZORO])]), JUIZ)).toBe(ZORO)
  })

  it('lista de golpes vazia é o mesmo que sem golpe', () => {
    expect(quemOJuizOlha(turnos(NAMI, []), JUIZ)).toBe(NAMI)
  })

  it('golpe dele só nele mesmo não tem para quem olhar: vale o golpe pendente anterior que o envolve', () => {
    // Os golpes da lista estão todos esperando reação; o de antes (Zoro contra ele) segue na tela.
    expect(quemOJuizOlha(turnos(NAMI, [golpe(ZORO, [JUIZ]), golpe(JUIZ, [JUIZ])]), JUIZ)).toBe(ZORO)
  })
})

/** A virada do Judge do site, como o JuizAnimado faz: do centro da casa dele ao centro da casa do alvo. */
function direcaoNoSite(casaDoJuiz: CasaDaArena, alvo: CasaDaArena | null): DirecaoDoJudge {
  return direcaoSeguinte(DIRECAO_INICIAL, centroDaCasaNaArena(casaDoJuiz), alvo === null ? null : centroDaCasaNaArena(alvo))
}

describe('a direção para o alvo, igual à do app (folha: sul, sudeste, leste, nordeste, norte, noroeste, oeste, sudoeste)', () => {
  const centro: CasaDaArena = { col: 5, row: 4 }
  const casos: readonly [string, CasaDaArena, DirecaoDoJudge][] = [
    ['casa de baixo = sul', { col: 5, row: 5 }, 0],
    ['baixo à direita = sudeste', { col: 6, row: 5 }, 1],
    ['à direita = leste', { col: 6, row: 4 }, 2],
    ['cima à direita = nordeste', { col: 6, row: 3 }, 3],
    ['casa de cima = norte', { col: 5, row: 3 }, 4],
    ['cima à esquerda = noroeste', { col: 4, row: 3 }, 5],
    ['à esquerda = oeste', { col: 4, row: 4 }, 6],
    ['baixo à esquerda = sudoeste', { col: 4, row: 5 }, 7],
    ['longe a leste, uma linha abaixo, ainda é leste', { col: 11, row: 5 }, 2],
  ]

  for (const [nome, alvo, esperada] of casos) {
    it(nome, () => {
      expect(direcaoNoSite(centro, alvo)).toBe(esperada)
    })
  }

  it('o app (token em px do mundo) e o site (casa da grade) dão a mesma direção para a mesma ficha', () => {
    // O app guarda o token no centro da casa em px (tokensDaArena) e o Judge em px; o site guarda a casa.
    for (const [, alvo, esperada] of casos) {
      const tokenNoApp = { x: (alvo.col + 0.5) * 64, y: (alvo.row + 0.5) * 64 }
      const judgeNoApp = { x: (centro.col + 0.5) * 64, y: (centro.row + 0.5) * 64 }
      expect(direcaoSeguinte(DIRECAO_INICIAL, judgeNoApp, tokenNoApp)).toBe(esperada)
    }
  })

  it('alvo nulo ou na mesma casa: fica de frente (a direção de antes)', () => {
    expect(direcaoNoSite(centro, null)).toBe(DIRECAO_INICIAL)
    expect(direcaoNoSite(centro, centro)).toBe(DIRECAO_INICIAL)
  })
})
