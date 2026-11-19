import { describe, expect, it } from 'vitest'
import { chamadoDaBatalha, type BatalhaQueChama, type VistaDBTQueChama } from './chamadoDaBatalha'

/**
 * "Às vezes não aparece para reagir" (18/11/2026): o jogador olhando a memória de outro andar não via a caixa
 * REAÇÃO. A tela volta ao andar ao vivo quando esta chave muda para algo não vazio; a mesma situação dá a mesma
 * chave (senão a aba de outro andar fecharia a cada recorte, e ele não conseguiria olhar nada).
 */

const SEM_NADA: BatalhaQueChama = { reacoes: [], minhaVez: false, vez: 't-npc', rodada: 2 }

describe('chamadoDaBatalha', () => {
  it('One Piece: golpe novo esperando a reação dele muda a chave; o mesmo golpe repetido no recorte não muda', () => {
    expect(chamadoDaBatalha(SEM_NADA, undefined)).toBe('')
    const golpe = { ...SEM_NADA, reacoes: [{ golpeId: 'g1', tokenId: 't-luffy' }] }
    const primeira = chamadoDaBatalha(golpe, undefined)
    expect(primeira).not.toBe('')
    expect(chamadoDaBatalha({ ...golpe, reacoes: [{ golpeId: 'g1', tokenId: 't-luffy' }] }, undefined)).toBe(primeira)
    expect(chamadoDaBatalha({ ...golpe, reacoes: [{ golpeId: 'g2', tokenId: 't-luffy' }] }, undefined)).not.toBe(primeira)
    expect(chamadoDaBatalha({ ...SEM_NADA, minhaVez: true, vez: 't-luffy' }, undefined)).not.toBe('')
  })

  it('Dragon Ball: só a pendência ativa, a declaração ou a vez dele chamam; pendência de outro na fila não', () => {
    const vista: VistaDBTQueChama = { pendencias: [{ id: 'p1', combatenteId: 't-goku', ativa: false }], declaracoes: [], minhaVez: false, vez: 't-raditz', rodada: 1, turno: { n: 1 } }
    expect(chamadoDaBatalha(undefined, vista)).toBe('')
    expect(chamadoDaBatalha(undefined, { ...vista, pendencias: [{ id: 'p1', combatenteId: 't-goku', ativa: true }] })).not.toBe('')
    expect(chamadoDaBatalha(undefined, { ...vista, declaracoes: [{ combatenteId: 't-goku' }] })).not.toBe('')
    expect(chamadoDaBatalha(undefined, { ...vista, minhaVez: true, vez: 't-goku' })).not.toBe('')
    expect(chamadoDaBatalha(undefined, undefined)).toBe('')
  })
})
