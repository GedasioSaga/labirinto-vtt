import { describe, expect, it } from 'vitest'
import { andar6, fichaDoJogador, GUARDA, SINDICATO } from './__fixtures__/andar6'
import { filterMapForGroup, filterMapForPlayer } from './fogFilter'

/**
 * FACÇÃO E ALERTA NÃO VÃO AO JOGADOR. Quem manda em cada sala e o nível de
 * alerta da cena são anotação do mestre: o pacote do jogador não leva o campo
 * `faccao` de sala nenhuma, nem o `alerta` da cena — nem com o jogador DENTRO
 * da sala que tem facção, nem com a sala inteira à vista.
 */
const RAIO_QUE_VE_TUDO = 5000
const ownership = { p1: [fichaDoJogador.id] }

function pacoteDoJogador() {
  return filterMapForPlayer(andar6(), 'p1', ownership, RAIO_QUE_VE_TUDO)
}

describe('facção e alerta no recorte do jogador', () => {
  it('o jogador recebe os distritos, mas sem a facção de nenhum deles', () => {
    const { map } = pacoteDoJogador()
    const norte = map.regions.find((r) => r.id === 'd-norte')
    expect(norte?.room?.name).toBe('Distrito Norte')
    for (const region of map.regions) {
      expect(region.room !== undefined && 'faccao' in region.room).toBe(false)
    }
  })

  it('o nome das facções não aparece em lugar nenhum do pacote', () => {
    const texto = JSON.stringify(pacoteDoJogador())
    expect(texto).not.toContain(GUARDA)
    expect(texto).not.toContain(SINDICATO)
    expect(texto).not.toContain('faccao')
  })

  it('o nível de alerta da cena não vai no pacote', () => {
    const view = pacoteDoJogador()
    expect('alerta' in view.map).toBe(false)
    const texto = JSON.stringify(view)
    expect(texto).not.toContain('cacada')
    expect(texto).not.toContain('alerta')
  })

  it('jogador DENTRO do distrito com facção também não recebe', () => {
    const map = { ...andar6(), tokens: [{ ...fichaDoJogador, x: 250, y: 250 }] }
    const view = filterMapForPlayer(map, 'p1', ownership, RAIO_QUE_VE_TUDO)
    expect(view.map.tokens.map((t) => t.id)).toEqual([fichaDoJogador.id])
    expect(JSON.stringify(view)).not.toContain(GUARDA)
  })

  it('a tela da mesa (recorte do grupo) segue a mesma regra', () => {
    const view = filterMapForGroup(andar6(), [{ tokenIds: [fichaDoJogador.id], visionRadius: RAIO_QUE_VE_TUDO }])
    const texto = JSON.stringify(view)
    expect(view.map.regions.length).toBeGreaterThan(0)
    expect(texto).not.toContain(SINDICATO)
    expect(texto).not.toContain('cacada')
  })

  it('o mestre continua com tudo no mapa dele', () => {
    const map = andar6()
    expect(map.alerta).toBe('cacada')
    expect(map.regions[0].room?.faccao).toBe(GUARDA)
  })
})
