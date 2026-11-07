import { describe, expect, it } from 'vitest'
import { lerMensagemDoServidor } from './mensagens'

/**
 * A foto de perfil (07/11/2026) no `estado`: campo novo e opcional. O leitor
 * do site lê a forma que o DO manda de verdade (`estadoPara` com
 * `projetarMembro`, lobby/nuvem/src/campanha.ts: a foto só vai quando existe)
 * e nunca recusa o membro, nem o `estado` inteiro, por causa dela.
 */

const FOTO = `${'a'.repeat(64)}.webp`

function estadoCom(membros: readonly Record<string, unknown>[], eu: Record<string, unknown>): string {
  return JSON.stringify({ t: 'estado', rev: 3, fichas: [], membros, eu, sala: null })
}

describe('o leitor do site e a foto de perfil', () => {
  it('lê membro com foto, membro sem o campo e o eu com foto, como o DO manda', () => {
    const lida = lerMensagemDoServidor(
      estadoCom(
        [
          { contaId: 'mestre', nome: 'Mestre', papel: 'mestre' },
          { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador', foto: FOTO },
        ],
        { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador', foto: FOTO },
      ),
    )
    expect(lida?.t).toBe('estado')
    if (lida?.t !== 'estado') return
    expect(lida.membros).toEqual([
      { contaId: 'mestre', nome: 'Mestre', papel: 'mestre' },
      { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador', foto: FOTO },
    ])
    expect(lida.eu).toEqual({ contaId: 'conta_nami', nome: 'Nami', papel: 'jogador', foto: FOTO })
  })

  it('foto nula ou fora da forma do id vira a inicial, sem recusar o membro nem o estado', () => {
    const lida = lerMensagemDoServidor(
      estadoCom(
        [
          { contaId: 'mestre', nome: 'Mestre', papel: 'mestre', foto: null },
          { contaId: 'conta_nami', nome: 'Nami', papel: 'jogador', foto: '../../api/eu' },
          { contaId: 'conta_zoro', nome: 'Zoro', papel: 'jogador', foto: `javascript:alert(1)//${FOTO}` },
        ],
        { contaId: 'conta_zoro', nome: 'Zoro', papel: 'jogador', foto: 42 },
      ),
    )
    expect(lida?.t).toBe('estado')
    if (lida?.t !== 'estado') return
    expect(lida.membros.map((membro) => membro.contaId)).toEqual(['mestre', 'conta_nami', 'conta_zoro'])
    expect(lida.membros.some((membro) => 'foto' in membro)).toBe(false)
    expect('foto' in lida.eu).toBe(false)
  })
})
