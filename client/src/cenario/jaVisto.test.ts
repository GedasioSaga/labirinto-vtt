import { describe, expect, it } from 'vitest'
import { CENARIO_PADRAO } from './catalogo'
import { deveTocarCenario, marcarCenarioVisto, type Armazem } from './jaVisto'

function armazem(): Armazem & { dados: Map<string, string> } {
  const dados = new Map<string, string>()
  return { dados, getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v) }
}

describe('animação do cenário: primeira vez ou sempre', () => {
  it('"Só da primeira vez": toca na primeira abertura e não na segunda; outro pino e outro mapa contam à parte', () => {
    const a = armazem()
    const primeira = { ...CENARIO_PADRAO, quando: 'primeira' as const }
    expect(deveTocarCenario(primeira, 'mapa-1', 'pino-a', a)).toBe(true)
    marcarCenarioVisto('mapa-1', 'pino-a', a)
    expect(deveTocarCenario(primeira, 'mapa-1', 'pino-a', a)).toBe(false)
    expect(deveTocarCenario(primeira, 'mapa-1', 'pino-b', a)).toBe(true)
    expect(deveTocarCenario(primeira, 'mapa-2', 'pino-a', a)).toBe(true)
  })

  it('"Sempre": toca mesmo já visto', () => {
    const a = armazem()
    marcarCenarioVisto('mapa-1', 'pino-a', a)
    expect(deveTocarCenario({ ...CENARIO_PADRAO, quando: 'sempre' }, 'mapa-1', 'pino-a', a)).toBe(true)
  })

  it('sem armazenamento ou com lixo guardado: conta como primeira vez, sem quebrar', () => {
    expect(deveTocarCenario(CENARIO_PADRAO, 'm', 'p', null)).toBe(true)
    const a = armazem()
    a.dados.set('lb-cenario-visto', '{nao é lista')
    expect(deveTocarCenario(CENARIO_PADRAO, 'm', 'p', a)).toBe(true)
    marcarCenarioVisto('m', 'p', a)
    expect(deveTocarCenario(CENARIO_PADRAO, 'm', 'p', a)).toBe(false)
  })
})
