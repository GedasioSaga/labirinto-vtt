import { describe, expect, it } from 'vitest'
import { fichaDBTVazia, lerFichaDBT } from '../../lib/dbt/modelo'
import { F_DO_MESTRE, F_NAMI, F_ZORO, ficha, guardada, MEMBROS, MESTRE, NAMI, USOPP_REMOVIDO, ZORO } from '../../lib/nuvem/campanha.fixture'
import { decidirVerComo, estadoDoMembro, type MensagemDoVerComo } from '../../lib/nuvem/verComo'
import type { MensagemDoVerComoNoSite } from './fonte'
import { lerMensagemDoServidor } from './mensagens'

/**
 * VER COMO JOGADOR (pedido do mestre, 07/11/2026): o servidor monta a vista
 * com a MESMA função do `estado` de cada socket (`estadoDoMembro`), e o site
 * lê o frame pelo mesmo leitor do resto. Os frames daqui são os que o DO
 * manda (campanha.ts, `verComo`), em JSON, como chegam pelo fio.
 */

const REQ = 'vc_teste_1'

/** O bloco de NPC do Dragon Ball (só do mestre), como no teste da projeção. */
function dbtComNpc() {
  const dbt = lerFichaDBT({ ...fichaDBTVazia(), npc: { nd: 2, categoria: 'elite', rank: 'C', passivas: [], prontoId: null } })
  if (dbt === null || dbt.npc === undefined) throw new Error('a ficha Dragon Ball com NPC não passou no leitor')
  return dbt
}

describe('ver como jogador', () => {
  it('só o mestre ativo pede, e só um jogador ativo é visto; a recusa chega ao site como recusa', () => {
    expect(decidirVerComo(NAMI, MEMBROS, ZORO.contaId)).toEqual({ ok: false, motivo: 'so-mestre' })
    expect(decidirVerComo(undefined, MEMBROS, NAMI.contaId)).toEqual({ ok: false, motivo: 'so-mestre' })
    expect(decidirVerComo(MESTRE, MEMBROS, MESTRE.contaId)).toEqual({ ok: false, motivo: 'nao-e-jogador' })
    expect(decidirVerComo(MESTRE, MEMBROS, USOPP_REMOVIDO.contaId)).toEqual({ ok: false, motivo: 'nao-e-jogador' })
    expect(decidirVerComo(MESTRE, MEMBROS, NAMI.contaId)).toEqual({ ok: true, alvo: NAMI })

    const recusa: MensagemDoVerComo<never> = { t: 'verComo.recusa', reqId: REQ, motivo: 'so-mestre' }
    expect(lerMensagemDoServidor(JSON.stringify(recusa))).toEqual(recusa)
  })

  it('a vista do mestre como Nami não traz nota do mestre, NPC, ficha escondida, e-mail nem privado', () => {
    const fichas = [
      guardada(ficha(F_NAMI, { dono: NAMI.contaId, notaDoMestre: 'Nami esconde o mapa' })),
      guardada(ficha(F_ZORO, { dono: ZORO.contaId, notaDoMestre: 'Zoro se perde no arco 2' })),
      // O NPC posto na mesa o jogador vê, como ele o vê: sem a nota e sem o bloco de NPC.
      guardada(ficha('pers_buggy', { tipo: 'npc', notaDoMestre: 'Palhaço do arco 1', dbt: dbtComNpc() })),
      guardada(ficha(F_DO_MESTRE, { tipo: 'npc', notaDoMestre: 'Chefe da ilha' }), { visivel: 'mestre' }),
    ]
    // Sem sala aberta (o DO manda `salaVisivel(agora)`, `null` com a mesa fechada).
    const vista: MensagemDoVerComoNoSite = {
      t: 'verComo.vista',
      reqId: REQ,
      contaId: NAMI.contaId,
      estado: estadoDoMembro(NAMI, fichas, MEMBROS, 7, null, null),
      mural: null,
      duelos: null,
    }
    const fio = JSON.stringify(vista)

    // Nada do que é só do mestre sai no fio.
    for (const segredo of ['Nami esconde o mapa', 'Zoro se perde', 'Palhaço', 'Chefe da ilha', F_DO_MESTRE, '"npc":', 'elite', '@example.com', 'notaDoMestre', '"dm:', 'privado']) {
      expect(fio).not.toContain(segredo)
    }

    const lida = lerMensagemDoServidor(fio)
    if (lida === null || lida.t !== 'verComo.vista') throw new Error(`a vista não passou no leitor do site: ${lida?.t ?? 'null'}`)
    expect(lida.contaId).toBe(NAMI.contaId)
    expect(lida.estado.eu).toEqual({ contaId: NAMI.contaId, nome: 'Nami', papel: 'jogador' })
    expect(lida.estado.fichas.map((noEstado) => [noEstado.doc.id, noEstado.ehMinha])).toEqual([
      [F_NAMI, true],
      [F_ZORO, false],
      ['pers_buggy', false],
    ])
    expect(lida.estado.membros.every((membro) => !('email' in membro))).toBe(true)
    expect(Object.keys(lida).sort()).toEqual(['contaId', 'duelos', 'estado', 'mural', 'reqId', 't'])
  })
})
