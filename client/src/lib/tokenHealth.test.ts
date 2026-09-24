/**
 * BARRA DE VIDA NA FICHA — a regra pura: o que o painel grava quando o mestre
 * digita, o que o mapa desenha e o que o jogador pode receber.
 *
 * A dor: "Ninguém sabe quanto falta para o monstro cair sem o mestre narrar."
 */
import { describe, expect, it } from 'vitest'
import type { TokenHealth } from '../types/map'
import { createEmptyMap } from './mapFactory'
import { deserializeMap, serializeMap } from './mapFile'
import {
  HEALTH_LIMIT,
  healthForPlayer,
  healthFraction,
  healthState,
  readTokenHealth,
  sameHealth,
  withCurrentHealth,
  withMaxHealth,
} from './tokenHealth'

const vida = (current: number, max: number, shownToPlayers = false): TokenHealth => ({ current, max, shownToPlayers })

describe('readTokenHealth — o que chega do disco ou da rede é cru', () => {
  it('ficha sem vida (undefined, null, lixo) não tem barra', () => {
    expect(readTokenHealth(undefined)).toBeNull()
    expect(readTokenHealth(null)).toBeNull()
    expect(readTokenHealth('7/10')).toBeNull()
    expect(readTokenHealth({ current: '7', max: 10 })).toBeNull()
    expect(readTokenHealth({ current: 7, max: Number.NaN })).toBeNull()
    expect(readTokenHealth({ current: 7 })).toBeNull()
  })

  it('máxima abaixo de 1 não é vida: não há barra para desenhar', () => {
    expect(readTokenHealth({ current: 0, max: 0, shownToPlayers: false })).toBeNull()
    expect(readTokenHealth({ current: 3, max: -4, shownToPlayers: false })).toBeNull()
  })

  it('arredonda, prende a atual entre 0 e a máxima, e respeita o teto', () => {
    expect(readTokenHealth({ current: 7.4, max: 10.6, shownToPlayers: false })).toEqual(vida(7, 11))
    expect(readTokenHealth({ current: 15, max: 10, shownToPlayers: false })).toEqual(vida(10, 10))
    expect(readTokenHealth({ current: -3, max: 10, shownToPlayers: false })).toEqual(vida(0, 10))
    expect(readTokenHealth({ current: 5, max: HEALTH_LIMIT * 10, shownToPlayers: false })).toEqual(vida(5, HEALTH_LIMIT))
  })

  it('"os jogadores veem" só com true de verdade — qualquer outra coisa é só o mestre', () => {
    expect(readTokenHealth({ current: 7, max: 10, shownToPlayers: true })?.shownToPlayers).toBe(true)
    expect(readTokenHealth({ current: 7, max: 10, shownToPlayers: 'sim' })?.shownToPlayers).toBe(false)
    expect(readTokenHealth({ current: 7, max: 10 })?.shownToPlayers).toBe(false)
  })

  it('campo que o app não conhece não sobrevive à leitura', () => {
    const lida = readTokenHealth({ current: 7, max: 10, shownToPlayers: false, anotacao: 'fraco a fogo' })
    expect(lida).toEqual(vida(7, 10))
    expect(Object.keys(lida ?? {}).sort()).toEqual(['current', 'max', 'shownToPlayers'])
  })
})

describe('o que o painel grava quando o mestre digita', () => {
  it('ficha sem vida: a primeira máxima digitada nasce cheia e só para o mestre', () => {
    expect(withMaxHealth(null, 10)).toEqual(vida(10, 10, false))
  })

  it('ficha sem vida: a primeira atual digitada vale para as duas', () => {
    expect(withCurrentHealth(null, 7)).toEqual(vida(7, 7, false))
  })

  it('ficha sem vida e atual 0: a ficha nasce caída (0 de 1), não com um ponto que ninguém deu', () => {
    expect(withCurrentHealth(null, 0)).toEqual(vida(0, 1, false))
    expect(withCurrentHealth(null, -3)).toEqual(vida(0, 1, false))
  })

  it('máxima primeiro e atual depois: 173 de 419 fica 173 de 419', () => {
    expect(withCurrentHealth(withMaxHealth(null, 419), 173)).toEqual(vida(173, 419))
  })

  it('a atual nunca passa da máxima nem desce de 0', () => {
    expect(withCurrentHealth(vida(7, 10), 12)).toEqual(vida(10, 10))
    expect(withCurrentHealth(vida(7, 10), -5)).toEqual(vida(0, 10))
  })

  it('baixar a máxima abaixo da atual puxa a atual junto; subir a máxima não cura', () => {
    expect(withMaxHealth(vida(7, 10), 5)).toEqual(vida(5, 5))
    expect(withMaxHealth(vida(7, 10), 20)).toEqual(vida(7, 20))
  })

  it('máxima abaixo de 1 fica 1; tudo acima do teto fica no teto', () => {
    expect(withMaxHealth(vida(7, 10), 0)).toEqual(vida(1, 1))
    expect(withMaxHealth(null, HEALTH_LIMIT + 5)).toEqual(vida(HEALTH_LIMIT, HEALTH_LIMIT))
  })

  it('mudar os números não mexe em quem vê a barra', () => {
    expect(withCurrentHealth(vida(7, 10, true), 3).shownToPlayers).toBe(true)
    expect(withMaxHealth(vida(7, 10, true), 12).shownToPlayers).toBe(true)
  })

  it('sameHealth: o Tab que passa pelo campo sem trocar o número não conta como mudança', () => {
    expect(sameHealth(vida(7, 10), vida(7, 10))).toBe(true)
    expect(sameHealth(null, null)).toBe(true)
    expect(sameHealth(vida(7, 10), vida(6, 10))).toBe(false)
    expect(sameHealth(vida(7, 10), vida(7, 10, true))).toBe(false)
    expect(sameHealth(vida(7, 10), null)).toBe(false)
  })
})

describe('o que a barra mostra', () => {
  it('fração de 0 a 1', () => {
    expect(healthFraction(vida(7, 10))).toBeCloseTo(0.7, 10)
    expect(healthFraction(vida(0, 10))).toBe(0)
    expect(healthFraction(vida(10, 10))).toBe(1)
  })

  it('três estados, os do ECG do Resident Evil: acima da metade bem, até um quarto perigo', () => {
    expect(healthState(1)).toBe('fine')
    expect(healthState(0.51)).toBe('fine')
    expect(healthState(0.5)).toBe('caution')
    expect(healthState(0.3)).toBe('caution')
    expect(healthState(0.25)).toBe('danger')
    expect(healthState(0)).toBe('danger')
  })
})

describe('a vida atravessa o disco', () => {
  it('salvar e abrir o mapa devolve a mesma vida, com a mesma escolha de quem vê', () => {
    const base = createEmptyMap('m-vida', 'Sala do Ogro', 20, 12, 50)
    const og = { id: 'tok-og', characterId: null, name: 'Og', x: 550, y: 300, size: 1, image: null, health: vida(173, 419, false) }
    const lu = { id: 'tok-lu', characterId: null, name: 'Lu', x: 400, y: 300, size: 1, image: null, health: vida(6, 10, true) }
    const aberto = deserializeMap(serializeMap({ ...base, tokens: [og, lu] }))
    expect(readTokenHealth(aberto.tokens[0]?.health)).toEqual(vida(173, 419, false))
    expect(readTokenHealth(aberto.tokens[1]?.health)).toEqual(vida(6, 10, true))
  })

  it('mapa salvo antes da barra existir abre sem barra nenhuma', () => {
    const base = createEmptyMap('m-antigo', 'Cripta', 20, 12, 50)
    const antigo = { id: 't', characterId: null, name: 'Rato', x: 100, y: 100, size: 1, image: null }
    const aberto = deserializeMap(serializeMap({ ...base, tokens: [antigo] }))
    expect(readTokenHealth(aberto.tokens[0]?.health)).toBeNull()
  })
})

describe('healthForPlayer — o jogador recebe a barra, nunca os números', () => {
  it('barra só do mestre (o padrão) não sai: nem os números, nem o campo', () => {
    expect(healthForPlayer(vida(173, 419, false))).toBeNull()
    expect(healthForPlayer({ current: 173, max: 419 })).toBeNull()
    expect(healthForPlayer(undefined)).toBeNull()
    expect(healthForPlayer(null)).toBeNull()
  })

  it('barra que os jogadores veem sai em CENTÉSIMOS: a proporção, não os pontos', () => {
    expect(healthForPlayer(vida(6, 10, true))).toEqual({ current: 60, max: 100, shownToPlayers: true })
    expect(healthForPlayer(vida(173, 419, true))).toEqual({ current: 41, max: 100, shownToPlayers: true })
  })

  it('vivo nunca chega como zero, ferido nunca chega como cheio', () => {
    expect(healthForPlayer(vida(1, 419, true))?.current).toBe(1)
    expect(healthForPlayer(vida(418, 419, true))?.current).toBe(99)
    expect(healthForPlayer(vida(0, 419, true))?.current).toBe(0)
    expect(healthForPlayer(vida(419, 419, true))?.current).toBe(100)
  })
})
