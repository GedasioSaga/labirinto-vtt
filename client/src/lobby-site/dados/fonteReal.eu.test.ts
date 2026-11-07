import { describe, expect, it } from 'vitest'
import { lerEu } from './fonteReal'

describe('lerEu (corpo do /api/eu)', () => {
  it('lê a forma que o Diretório manda de verdade (campo nome)', () => {
    // Forma real vista em produção em 07/11/2026 (e-mail inventado).
    const eu = lerEu({ email: 'mestre@example.com', campanhas: [{ campanhaId: 'camp_ed35115d-f34f-497e-bf1f-dac7a8cabdf6', nome: 'One Piece', papel: 'mestre' }] })
    expect(eu).toEqual({ email: 'mestre@example.com', campanhas: [{ campanhaId: 'camp_ed35115d-f34f-497e-bf1f-dac7a8cabdf6', nomeDaCampanha: 'One Piece', papel: 'mestre' }] })
  })

  it('aceita nomeDaCampanha e recusa campanha sem nome, papel estranho ou lista vazia de e-mail', () => {
    expect(lerEu({ email: 'a@example.com', campanhas: [{ campanhaId: 'camp_1', nomeDaCampanha: 'Mesa', papel: 'jogador' }] })?.campanhas[0]?.nomeDaCampanha).toBe('Mesa')
    expect(lerEu({ email: 'a@example.com', campanhas: [{ campanhaId: 'camp_1', papel: 'jogador' }] })).toBeNull()
    expect(lerEu({ email: 'a@example.com', campanhas: [{ campanhaId: 'camp_1', nome: 'Mesa', papel: 'dono' }] })).toBeNull()
    expect(lerEu({ email: '', campanhas: [] })).toBeNull()
  })
})
