/**
 * LUZ DA CENA — a força do escuro do botão do sol (`lib/luzDaCena.ts`): a
 * mesma `forca` do painel "Ambiente da cena", com a cor escurecendo da
 * aprovada até o breu acima de 85%.
 */
import { describe, expect, it } from 'vitest'
import { AMBIENTE_PADRAO } from './periodo'
import { BREU_DO_PERIODO, ambienteNoEscuro } from './luzDaCena'

describe('força do escuro', () => {
  it('até 85% só a força muda; em 100% a cor chega ao breu, e voltar a 85% devolve a cor aprovada', () => {
    const padrao = { ...AMBIENTE_PADRAO.noite }
    expect(ambienteNoEscuro('noite', 0.5, padrao)).toEqual({ cor: AMBIENTE_PADRAO.noite.cor, forca: 0.5 })
    const breu = ambienteNoEscuro('noite', 1, padrao)
    expect(breu).toEqual({ cor: BREU_DO_PERIODO.noite, forca: 1 })
    // No meio do caminho a cor já escureceu, e continua sendo uma cor que o controle reconhece como dele.
    const meio = ambienteNoEscuro('noite', 0.95, breu)
    expect(meio.cor).not.toBe(AMBIENTE_PADRAO.noite.cor)
    expect(meio.cor).not.toBe(BREU_DO_PERIODO.noite)
    expect(ambienteNoEscuro('noite', 0.85, meio)).toEqual({ cor: AMBIENTE_PADRAO.noite.cor, forca: 0.85 })
  })

  it('cor escolhida à mão no painel fica como está, e força fora de 0 a 1 é grampeada', () => {
    const verde = { cor: '#2f8f4a', forca: 0.4 }
    expect(ambienteNoEscuro('noite', 1, verde)).toEqual({ cor: '#2f8f4a', forca: 1 })
    expect(ambienteNoEscuro('tarde', 7, { ...AMBIENTE_PADRAO.tarde }).forca).toBe(1)
    expect(ambienteNoEscuro('tarde', Number.NaN, { ...AMBIENTE_PADRAO.tarde }).forca).toBe(0)
  })
})
