/**
 * AGENDA DA CAMPANHA (`lib/agendaDaCampanha.ts`): eventos datados por dia e
 * apito que disparam quando a hora da mesa chega — nem antes, nem duas vezes —
 * e o `adventure.json` antigo, sem agenda, continua abrindo igual.
 */
import { describe, expect, it } from 'vitest'
import { parseAdventure, serializeAdventure, type Adventure } from './adventure'
import {
  adicionarEvento,
  avisoDoEvento,
  compararMomentos,
  formatarMomento,
  jaPassou,
  levarAgendaA,
  lerAgenda,
  novaAgenda,
  proximoApito,
  proximoDia,
  removerEvento,
  type AgendaDaCampanha,
  type EventoDaAgenda,
} from './agendaDaCampanha'

const GEMEOS: EventoDaAgenda = { id: 'ev-gemeos', titulo: 'Disparo dos Gêmeos', quando: { dia: 7, apito: 'meio' } }

function agendaCom(agora: AgendaDaCampanha['agora'], eventos: EventoDaAgenda[]): AgendaDaCampanha {
  return { agora, eventos }
}

describe('a hora da mesa: dia e apito', () => {
  it('os apitos seguem Aurora, Meio, Brasa, Sombra, e da Sombra vai à Aurora do dia seguinte', () => {
    expect(proximoApito({ dia: 7, apito: 'aurora' })).toEqual({ dia: 7, apito: 'meio' })
    expect(proximoApito({ dia: 7, apito: 'meio' })).toEqual({ dia: 7, apito: 'brasa' })
    expect(proximoApito({ dia: 7, apito: 'brasa' })).toEqual({ dia: 7, apito: 'sombra' })
    expect(proximoApito({ dia: 7, apito: 'sombra' })).toEqual({ dia: 8, apito: 'aurora' })
    expect(proximoDia({ dia: 7, apito: 'brasa' })).toEqual({ dia: 8, apito: 'aurora' })
  })

  it('compara pelo dia e, no mesmo dia, pela ordem do apito', () => {
    expect(compararMomentos({ dia: 7, apito: 'meio' }, { dia: 7, apito: 'meio' })).toBe(0)
    expect(compararMomentos({ dia: 7, apito: 'aurora' }, { dia: 7, apito: 'meio' })).toBeLessThan(0)
    expect(compararMomentos({ dia: 7, apito: 'aurora' }, { dia: 6, apito: 'sombra' })).toBeGreaterThan(0)
  })

  it('escreve como o mestre lê: "dia 7, Meio"', () => {
    expect(formatarMomento({ dia: 7, apito: 'meio' })).toBe('dia 7, Meio')
    expect(avisoDoEvento(GEMEOS)).toBe('Disparo dos Gêmeos — dia 7, Meio')
  })

  it('campanha nova começa no dia 1, Aurora, sem evento', () => {
    expect(novaAgenda()).toEqual({ agora: { dia: 1, apito: 'aurora' }, eventos: [] })
  })
})

describe('levarAgendaA: o disparo', () => {
  it('Disparo dos Gêmeos (dia 7, Meio) não dispara na Aurora do dia 7 e dispara no Meio', () => {
    const antes = agendaCom({ dia: 6, apito: 'sombra' }, [GEMEOS])

    const aurora = levarAgendaA(antes, { dia: 7, apito: 'aurora' })
    expect(aurora.disparados).toEqual([])
    expect(aurora.agenda.agora).toEqual({ dia: 7, apito: 'aurora' })
    expect(aurora.agenda.eventos[0].disparado).toBeUndefined()

    const meio = levarAgendaA(aurora.agenda, { dia: 7, apito: 'meio' })
    expect(meio.disparados.map((e) => e.titulo)).toEqual(['Disparo dos Gêmeos'])
    expect(meio.agenda.eventos[0].disparado).toBe(true)
  })

  it('evento disparado não dispara de novo quando a hora continua andando', () => {
    const disparou = levarAgendaA(agendaCom({ dia: 7, apito: 'aurora' }, [GEMEOS]), { dia: 7, apito: 'meio' })
    const depois = levarAgendaA(disparou.agenda, { dia: 7, apito: 'brasa' })
    expect(depois.disparados).toEqual([])
    expect(depois.agenda.eventos).toHaveLength(1)
  })

  it('pular vários apitos dispara os do meio, na ordem da hora e não na da lista', () => {
    const tarde: EventoDaAgenda = { id: 'ev-3', titulo: 'Caravana parte', quando: { dia: 9, apito: 'aurora' } }
    const segundo: EventoDaAgenda = { id: 'ev-2', titulo: 'Sino da torre', quando: { dia: 7, apito: 'aurora' } }
    const primeiro: EventoDaAgenda = { id: 'ev-1', titulo: 'Maré vira', quando: { dia: 6, apito: 'meio' } }
    const r = levarAgendaA(agendaCom({ dia: 5, apito: 'sombra' }, [tarde, segundo, primeiro]), { dia: 8, apito: 'aurora' })
    expect(r.disparados.map((e) => e.id)).toEqual(['ev-1', 'ev-2'])
    expect(r.agenda.eventos.map((e) => e.disparado === true)).toEqual([false, true, true])
  })
})

describe('marcar e remover evento', () => {
  const agora = { dia: 3, apito: 'brasa' } as const

  it('marca com título limpo; título vazio ou momento que já passou é recusado', () => {
    const base = agendaCom(agora, [])
    const marcada = adicionarEvento(base, '  Disparo dos Gêmeos  ', { dia: 7, apito: 'meio' })
    expect(marcada?.eventos.map((e) => [e.titulo, e.quando])).toEqual([['Disparo dos Gêmeos', { dia: 7, apito: 'meio' }]])
    expect(marcada?.eventos[0].id).toMatch(/^ev_/)

    expect(adicionarEvento(base, '   ', { dia: 7, apito: 'meio' })).toBeNull()
    expect(adicionarEvento(base, 'Tarde demais', { dia: 3, apito: 'brasa' })).toBeNull()
    expect(adicionarEvento(base, 'Tarde demais', { dia: 2, apito: 'sombra' })).toBeNull()
    expect(adicionarEvento(base, 'Dia zero', { dia: 0, apito: 'meio' })).toBeNull()
    expect(adicionarEvento(base, 'Dia quebrado', { dia: 4.5, apito: 'meio' })).toBeNull()
  })

  it('"já passou" é o agora e o que veio antes dele', () => {
    expect(jaPassou(agora, { dia: 3, apito: 'brasa' })).toBe(true)
    expect(jaPassou(agora, { dia: 3, apito: 'sombra' })).toBe(false)
  })

  it('remove pelo id e devolve a mesma agenda quando o id não existe', () => {
    const base = agendaCom(agora, [GEMEOS])
    expect(removerEvento(base, 'ev-gemeos').eventos).toEqual([])
    expect(removerEvento(base, 'sumiu')).toBe(base)
  })
})

describe('adventure.json: campo novo opcional', () => {
  const ANTIGO = JSON.stringify({
    version: 1,
    id: 'adv_torre',
    name: 'Torre',
    startSceneId: 'salao',
    scenes: [{ id: 'salao', name: 'Salão', file: 'map.json' }],
  })

  it('arquivo antigo abre sem agenda e grava de volta sem o campo', () => {
    const aventura = parseAdventure(ANTIGO)
    expect(aventura.scenes.map((s) => s.id)).toEqual(['salao'])
    expect('agenda' in aventura).toBe(false)
    expect(serializeAdventure(aventura)).not.toContain('agenda')
  })

  it('a agenda vai e volta do disco igual, com o disparado junto', () => {
    const aventura: Adventure = {
      ...parseAdventure(ANTIGO),
      agenda: agendaCom({ dia: 7, apito: 'meio' }, [{ ...GEMEOS, disparado: true }, { id: 'ev-2', titulo: 'Sino', quando: { dia: 8, apito: 'sombra' } }]),
    }
    expect(parseAdventure(serializeAdventure(aventura)).agenda).toEqual(aventura.agenda)
  })

  it('evento malformado sai da lista; agenda sem hora válida é descartada; a aventura abre igual', () => {
    const lida = lerAgenda({
      agora: { dia: 2, apito: 'aurora' },
      eventos: [GEMEOS, { id: 'x', titulo: '', quando: { dia: 1, apito: 'meio' } }, { id: 'y', titulo: 'Sem hora' }, 'lixo', { ...GEMEOS, titulo: 'Repetido' }],
    })
    expect(lida?.eventos.map((e) => e.titulo)).toEqual(['Disparo dos Gêmeos'])
    expect(lerAgenda({ agora: { dia: 2, apito: 'meia-noite' }, eventos: [] })).toBeUndefined()
    expect(lerAgenda('lixo')).toBeUndefined()

    const comLixo = JSON.stringify({ ...JSON.parse(ANTIGO), agenda: { agora: 'ontem' } })
    const aventura = parseAdventure(comLixo)
    expect(aventura.scenes).toHaveLength(1)
    expect('agenda' in aventura).toBe(false)
  })
})
