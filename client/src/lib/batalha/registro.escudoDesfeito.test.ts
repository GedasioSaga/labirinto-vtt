// @vitest-environment node
/**
 * CONSERTO DAS FICHAS F1, fatia S2 (bug 12 de
 * docs/auditoria-fichas/00-bugs-do-sistema.md): o cheio da barra do Escudo
 * não conta valor de linha desfeita.
 */
import { describe, expect, it } from 'vitest'
import { escudoMaisAlto, type LinhaDoRegistro } from './registro'

const ficha = (de: number, para: number): LinhaDoRegistro['reversao'] => ({ tipo: 'ficha', personagemId: 'pers_a', partes: [{ parte: 'recurso', chave: 'escudo', de, para }] })

describe('bug 12: barra do Escudo', () => {
  it('o Escudo 500 posto por engano e desfeito não vira o cheio da barra; o golpe de pé (40 → 30) diz que o cheio é 40', () => {
    const registro: Pick<LinhaDoRegistro, 'reversao' | 'desfeita'>[] = [
      { reversao: ficha(40, 500), desfeita: { por: 'Mestre', quando: 1 } },
      { reversao: ficha(40, 30) },
    ]
    expect(escudoMaisAlto(registro, 'pers_a', 'escudo')).toBe(40)
  })
})
