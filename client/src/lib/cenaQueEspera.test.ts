/**
 * atencao-do-mestre — a cena que espera. Na simulação, o Fábio passou 12 min
 * sozinho na Capitania enquanto o mestre conduzia as Docas, e ninguém viu. A
 * regra: cada cena com gente que o mestre NÃO está vendo conta há quanto tempo
 * espera; a lista Cenas mostra 'há N min' (âmbar a partir de 10) e Ctrl+J abre
 * a que espera há mais tempo, na ficha de quem está lá.
 */
import { describe, expect, it } from 'vitest'
import type { PartyMember } from './party'
import {
  ESPERA_LONGA_MIN,
  MINUTO_MS,
  atualizarEspera,
  cenaQueEsperaMais,
  cenasOcupadas,
  ehAtalhoDaCenaQueEspera,
  esperaLonga,
  minutosDeEspera,
  rotuloDeEspera,
} from './cenaQueEspera'

function membro(playerId: string, name: string, sceneId: string | null, extra: Partial<PartyMember> = {}): PartyMember {
  return {
    playerId,
    name,
    connected: true,
    sceneId,
    sceneName: sceneId,
    token: { id: `t-${playerId}`, color: '#3cff00', x: 300, y: 400 },
    travelPending: false,
    ...extra,
  }
}

const MESA: PartyMember[] = [
  membro('p-ana', 'Ana', 's-docas'),
  membro('p-bruno', 'Bruno', 's-docas'),
  membro('p-fabio', 'Fábio', 's-capitania', { token: { id: 't-fabio', color: '#ff0000', x: 520, y: 260 } }),
]

describe('cenasOcupadas', () => {
  it('só conta quem está conectado, com ficha, numa cena da aventura', () => {
    const ocupadas = cenasOcupadas([
      ...MESA,
      membro('p-caiu', 'Caio', 's-porao', { connected: false }),
      membro('p-sem', 'Sem ficha', 's-sotao', { token: null }),
      membro('p-solto', 'Solto', null),
    ])
    expect([...ocupadas].sort()).toEqual(['s-capitania', 's-docas'])
  })
})

describe('atualizarEspera', () => {
  it('cena com gente e fora da tela começa a esperar agora; a aberta não espera', () => {
    const espera = atualizarEspera(new Map(), new Set(['s-docas', 's-capitania']), 's-docas', 1000)
    expect([...espera]).toEqual([['s-capitania', 1000]])
  })

  it('o tempo não recomeça a cada atualização: guarda o início', () => {
    const antes = atualizarEspera(new Map(), new Set(['s-capitania']), 's-docas', 1000)
    const depois = atualizarEspera(antes, new Set(['s-capitania']), 's-docas', 9000)
    expect(depois.get('s-capitania')).toBe(1000)
    // Nada mudou: devolve o mesmo mapa (o estado do React não re-renderiza à toa).
    expect(depois).toBe(antes)
  })

  it('abrir a cena zera; sair dela recomeça do instante da saída', () => {
    const esperando = atualizarEspera(new Map(), new Set(['s-capitania']), 's-docas', 1000)
    const aberta = atualizarEspera(esperando, new Set(['s-capitania']), 's-capitania', 5000)
    expect(aberta.has('s-capitania')).toBe(false)
    const saiu = atualizarEspera(aberta, new Set(['s-capitania']), 's-docas', 7000)
    expect(saiu.get('s-capitania')).toBe(7000)
  })

  it('cena que esvaziou deixa de esperar', () => {
    const esperando = atualizarEspera(new Map(), new Set(['s-capitania']), 's-docas', 1000)
    expect(atualizarEspera(esperando, new Set(), 's-docas', 2000).size).toBe(0)
  })
})

describe('minutosDeEspera, rótulo e âmbar', () => {
  it('11 min nas Docas: a Capitania espera há 11 min, em âmbar', () => {
    const espera = new Map([['s-capitania', 0]])
    const minutos = minutosDeEspera(espera, 11 * MINUTO_MS + 30_000)
    expect(minutos.get('s-capitania')).toBe(11)
    expect(rotuloDeEspera(11)).toBe('há 11 min')
    expect(esperaLonga(11)).toBe(true)
  })

  it('âmbar a partir de 10 min, não antes', () => {
    expect(ESPERA_LONGA_MIN).toBe(10)
    expect(esperaLonga(9)).toBe(false)
    expect(esperaLonga(10)).toBe(true)
  })

  it('menos de 1 min não aparece (não há "há 0 min")', () => {
    const minutos = minutosDeEspera(new Map([['s-capitania', 0]]), 59_999)
    expect(minutos.has('s-capitania')).toBe(false)
    expect(minutosDeEspera(new Map([['s-capitania', 0]]), MINUTO_MS).get('s-capitania')).toBe(1)
  })
})

describe('cenaQueEsperaMais', () => {
  it('a que espera há mais tempo, centrada na ficha de quem está lá', () => {
    const espera = new Map([
      ['s-docas', 5000],
      ['s-capitania', 1000],
    ])
    expect(cenaQueEsperaMais(espera, MESA)).toEqual({ sceneId: 's-capitania', playerName: 'Fábio', x: 520, y: 260 })
  })

  it('ninguém esperando: null', () => {
    expect(cenaQueEsperaMais(new Map(), MESA)).toBeNull()
  })

  it('a cena espera mas a ficha sumiu (saiu no meio): pula para a próxima', () => {
    const espera = new Map([
      ['s-porao', 0],
      ['s-capitania', 1000],
    ])
    expect(cenaQueEsperaMais(espera, MESA)?.sceneId).toBe('s-capitania')
  })
})

describe('ehAtalhoDaCenaQueEspera: Ctrl+J', () => {
  const tecla = (extra: Partial<Parameters<typeof ehAtalhoDaCenaQueEspera>[0]> = {}) => ({
    key: 'j',
    ctrlKey: true,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    targetTagName: 'CANVAS',
    ...extra,
  })

  it('Ctrl+J e Cmd+J, maiúscula ou minúscula', () => {
    expect(ehAtalhoDaCenaQueEspera(tecla())).toBe(true)
    expect(ehAtalhoDaCenaQueEspera(tecla({ key: 'J' }))).toBe(true)
    expect(ehAtalhoDaCenaQueEspera(tecla({ ctrlKey: false, metaKey: true }))).toBe(true)
  })

  it('J sozinho é a ferramenta Sala Circular, não o atalho', () => {
    expect(ehAtalhoDaCenaQueEspera(tecla({ ctrlKey: false }))).toBe(false)
  })

  it('com Shift ou Alt, ou digitando num campo, não dispara', () => {
    expect(ehAtalhoDaCenaQueEspera(tecla({ shiftKey: true }))).toBe(false)
    expect(ehAtalhoDaCenaQueEspera(tecla({ altKey: true }))).toBe(false)
    expect(ehAtalhoDaCenaQueEspera(tecla({ targetTagName: 'INPUT', targetInputType: 'text' }))).toBe(false)
    expect(ehAtalhoDaCenaQueEspera(tecla({ targetTagName: 'TEXTAREA' }))).toBe(false)
  })
})
