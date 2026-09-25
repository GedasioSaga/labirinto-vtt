/**
 * MOTIVO DO BLOQUEIO, lado do RECORTE: o pino de viagem trancado leva ao
 * jogador o PORQUÊ ("Desabou", "Alagada", "Sem energia") — só isso, e só
 * enquanto está trancado. Motivo guardado num pino que o mestre reabriu não
 * sai (diria o que o mestre preparou para depois), valor fora da lista não
 * sai (texto cru do arquivo nunca chega ao jogador), e o destino continua
 * fora como sempre.
 */
import { describe, expect, it } from 'vitest'
import type { MapData, Pin, Token } from '../types/map'
import { filterMapForPlayer, pinClueForPlayer } from './fogFilter'
import { createEmptyMap } from './mapFactory'

const RAIO = 700
const CENA_SECRETA = 'cena-cripta-secreta'

const ficha: Token = { id: 'arco', characterId: null, name: 'Arco', x: 100, y: 100, size: 1, image: null }

function caracol(extra: Partial<Pin> = {}): Pin {
  return {
    id: 'caracol',
    x: 200,
    y: 100,
    kind: 'viagem',
    description: 'A escada em caracol',
    image: null,
    destino: { sceneId: CENA_SECRETA, pinId: 'fundo' },
    passagem: 'trancada',
    motivo: 'desabou',
    ...extra,
  }
}

function recorte(pin: Pin): Pin {
  const map: MapData = { ...createEmptyMap('m', 'Torre', 30, 10, 50), tokens: [ficha], pins: [pin] }
  const { map: visto } = filterMapForPlayer(map, 'duda', { duda: ['arco'] }, RAIO)
  expect(visto.pins).toHaveLength(1)
  return visto.pins[0]
}

describe('recorte: motivo do bloqueio no pino de viagem', () => {
  it('trancada com motivo: o jogador recebe o motivo, e o destino continua fora', () => {
    const visto = recorte(caracol())
    expect(visto.passagem).toBe('trancada')
    expect(visto.motivo).toBe('desabou')
    expect(JSON.stringify(visto)).not.toContain(CENA_SECRETA)
  })

  it('os quatro motivos da lista atravessam, cada um como é', () => {
    for (const motivo of ['desabou', 'alagada', 'em-chamas', 'sem-energia'] as const) {
      expect(recorte(caracol({ motivo })).motivo, motivo).toBe(motivo)
    }
  })

  it('pino reaberto (pede ou livre) com motivo guardado: o motivo NÃO chega', () => {
    for (const passagem of ['pede', 'livre'] as const) {
      const visto = recorte(caracol({ passagem, motivo: 'alagada' }))
      expect(visto.passagem).toBe(passagem)
      expect('motivo' in visto, passagem).toBe(false)
      expect(JSON.stringify(visto), passagem).not.toContain('alagada')
    }
    // Sem o campo `passagem` o pino pede ao mestre: também não é trancado.
    const semModo = recorte(caracol({ passagem: undefined, motivo: 'alagada' }))
    expect('motivo' in semModo).toBe(false)
  })

  it('motivo fora da lista (arquivo editado à mão) não chega ao jogador', () => {
    // Forçando um valor que o tipo não aceita, como faria um arquivo editado à mão.
    const torto = { ...caracol(), motivo: 'SEGREDO-DO-MESTRE' } as unknown as Pin // teste: simula dado cru fora do tipo
    const visto = recorte(torto)
    expect('motivo' in visto).toBe(false)
    expect(JSON.stringify(visto)).not.toContain('SEGREDO-DO-MESTRE')
  })

  it('pino de ponto de interesse ("!") com motivo por engano não leva o campo', () => {
    const visto = recorte({ id: 'bau', x: 200, y: 100, kind: 'exclamacao', description: 'Baú', image: null, passagem: 'trancada', motivo: 'desabou' })
    expect(visto.kind).toBe('exclamacao')
    expect('motivo' in visto).toBe(false)
  })

  it('trancada sem motivo: o jogador recebe só o modo, sem campo inventado', () => {
    const visto = recorte(caracol({ motivo: undefined }))
    expect(visto.passagem).toBe('trancada')
    expect('motivo' in visto).toBe(false)
  })

  it('a pista do cartão não carrega o motivo nem o destino', () => {
    const pista = pinClueForPlayer(caracol())
    expect(pista?.text).toBe('A escada em caracol')
    expect(JSON.stringify(pista)).not.toContain('desabou')
    expect(JSON.stringify(pista)).not.toContain(CENA_SECRETA)
  })
})
