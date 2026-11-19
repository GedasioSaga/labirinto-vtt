/**
 * A batalha Dragon Ball no `batalha-em-andamento.json` (18/11/2026, análise
 * item 7): antes o F5 do mestre perdia a DBT inteira. O campo `dbt` vai ao
 * arquivo sem as animações e volta igual; a cena DBT torta fica de fora (a boa
 * volta); arquivo sem o campo (app de antes) segue lendo, sem DBT.
 */
import { describe, expect, it } from 'vitest'
import { criarBatalhaDBTStore, type CenaDBT } from '../../stores/batalhaDBTStore'
import { fichaDBTVazia } from '../dbt/modelo'
import { SISTEMA_DRAGON_BALL } from '../dbt/sistemaDragonBall'
import type { AutorDBT } from '../dbt/batalha/tipos'
import { novoPersonagem, type Personagem } from '../personagem'
import type { MesaDaBatalha } from './mesa'
import { batalhaSalvaDoTexto, textoDaBatalhaSalva } from './batalhaSalva'

const MESTRE: AutorDBT = { tipo: 'mestre' }
const CENA = 'cena-dbt'

function personagemDBT(id: string, tipo: 'jogador' | 'npc', nome: string): Personagem {
  const novo = novoPersonagem(SISTEMA_DRAGON_BALL, tipo, nome)
  return { ...novo, id, recursos: { ...novo.recursos, pv: 10, pk: 20 }, dbt: novo.dbt ?? fichaDBTVazia() }
}

/** Goku x Raditz em combate, com o voo do Goku no registro (uma linha e um efeito). */
function cenaDBTEmCombate(): CenaDBT {
  const personagens = new Map([personagemDBT('goku', 'jogador', 'Goku'), personagemDBT('raditz', 'npc', 'Raditz')].map((personagem) => [personagem.id, personagem]))
  const mesa: MesaDaBatalha = {
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
  const loja = criarBatalhaDBTStore(mesa, { rolar: () => 10, agora: () => 1000, posicoes: () => null })
  loja.getState().ligar(CENA, {}, {
    entrantes: [
      { tokenId: 't-goku', personagemId: 'goku', nome: 'Goku', lado: 'pj', npc: false },
      { tokenId: 't-raditz', personagemId: 'raditz', nome: 'Raditz', lado: 'npc', npc: true },
    ],
  })
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'rolarIniciativa', digitados: { 't-goku': 19, 't-raditz': 2 } }).ok).toBe(true)
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'comecar' }).ok).toBe(true)
  expect(loja.getState().comando(CENA, MESTRE, { tipo: 'agir', combatenteId: 't-goku', vez: { rodada: 1, turno: 1 }, opcao: 'voo:1', alvos: [] }).ok).toBe(true)
  const cena = loja.getState().cenas[CENA]
  if (cena === undefined) throw new Error('sem a cena DBT')
  return cena
}

describe('batalha salva: a cena Dragon Ball vai ao arquivo e volta', () => {
  it('ida e volta: a cena DBT volta igual (vez, rodada, Ki, voo, registro), sem as animações', () => {
    const cena = cenaDBTEmCombate()
    const lido = batalhaSalvaDoTexto(textoDaBatalhaSalva({ mesaId: 'adv_1', salvaEm: 5, cenas: {}, dbt: { [CENA]: cena } }))
    if (!lido.ok) throw new Error(`não leu: ${lido.motivo}`)
    expect(lido.salva.dbt?.[CENA]).toEqual({ ...cena, efeitos: [] })
    expect(lido.salva.dbt?.[CENA]?.ordem.vez).toBe('t-goku')
    expect(lido.salva.dbt?.[CENA]?.combatentes['t-goku']?.voo).toBe(1)
  })

  it('cena DBT torta fica de fora e a boa volta; arquivo sem o campo dbt segue lendo, sem DBT', () => {
    const cena = cenaDBTEmCombate()
    const texto = JSON.parse(textoDaBatalhaSalva({ mesaId: 'adv_1', salvaEm: 5, cenas: {}, dbt: { [CENA]: cena } })) as Record<string, unknown>
    const comTorta = JSON.stringify({ ...texto, dbt: { [CENA]: { ...cena, efeitos: [] }, torta: { ...cena, ordem: { vez: 7 } } } })
    const lido = batalhaSalvaDoTexto(comTorta)
    if (!lido.ok) throw new Error(`não leu: ${lido.motivo}`)
    expect(Object.keys(lido.salva.dbt ?? {})).toEqual([CENA])

    const deAntes = batalhaSalvaDoTexto(JSON.stringify({ versao: 1, mesaId: 'adv_1', salvaEm: 5, cenas: {} }))
    if (!deAntes.ok) throw new Error(`não leu: ${deAntes.motivo}`)
    expect(deAntes.salva.dbt).toBeUndefined()
  })
})
