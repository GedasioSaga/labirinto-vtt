import { describe, expect, it } from 'vitest'
import { PASSO_DA_MEIA_U, campoDoCorpo, comporCampo, type CampoComposto, type CorpoDoCampo } from './campo'

/**
 * A PONTA SOLTA DO RIO DE LAVA (auditoria de 15/11/2026): na ponta redonda o
 * comprimento ao longo do rio parava e a meia largura medida no texel encolhia;
 * as placas da crosta (um desenho nítido, de tamanho tirado dessa medida)
 * viravam um leque de riscos. O campo passa a dizer o que a lava precisa: o
 * comprimento que segue depois da ponta e a meia largura do rio, igual nele
 * inteiro. O rio de água fica como era.
 */
const MEIA = 40

/** Rio reto de 200 u, de (0, 0) a (200, 0), com 2 casas de largura. */
function rio(extra: Partial<CorpoDoCampo> = {}): CorpoDoCampo {
  return { id: 'rio', tipo: 'rio', cor: [200, 80, 20], velocidade: 0.45, ondas: 0.5, espuma: 0.6, meia: MEIA, trechos: [{ xy: [0, 0, 200, 0], s: [0, 200] }], ...extra }
}

function campoDe(corpo: CorpoDoCampo): CampoComposto {
  const campo = campoDoCorpo(corpo, 4)
  return comporCampo([{ corpo, campo }], campo, 4)
}

/** O texel que contém o ponto (u): o índice dele nos canais do campo. */
function texelEm(c: CampoComposto, x: number, y: number): number {
  return ((Math.floor(y / c.texel) - c.y0) * c.w + (Math.floor(x / c.texel) - c.x0)) * 4
}

describe('a ponta solta do rio no campo', () => {
  it('o rio de lava segue contando o comprimento depois da ponta (e antes do começo); o de água para nela, como sempre', () => {
    const lava = campoDe(rio({ lava: 1 }))
    const agua = campoDe(rio())
    // Os centros dos texels: (222, 10) fica 22 u depois do fim, (-22, 10) fica 22 u antes do começo, (102, 10) no corpo.
    const depois = texelEm(lava, 222, 10)
    const antes = texelEm(lava, -22, 10)
    const corpo = texelEm(lava, 102, 10)
    expect([lava.f1[depois + 1], lava.f1[antes + 1], lava.f1[corpo + 1]]).toEqual([222, -22, 102])
    expect([agua.f1[depois + 1], agua.f1[antes + 1], agua.f1[corpo + 1]]).toEqual([200, 0, 102])
    // A distância até a margem e o lado não mudam com o líquido.
    expect([lava.f1[depois], lava.f1[depois + 2]]).toEqual([agua.f1[depois], agua.f1[depois + 2]])
  })

  it('a meia largura do rio vai igual em todo texel dele, no corpo, na margem e na ponta redonda', () => {
    const largo = campoDe(rio({ lava: 1 }))
    const noCampo = [texelEm(largo, 102, 2), texelEm(largo, 102, 38), texelEm(largo, 230, 2), texelEm(largo, 222, 30), texelEm(largo, -30, 2)]
    expect(noCampo.map((p) => largo.f4[p + 2])).toEqual(noCampo.map(() => MEIA / PASSO_DA_MEIA_U))
    // O rio fino (meia casa de largura) e o rio de água levam a deles.
    const fino = campoDe(rio({ meia: 10 }))
    expect(fino.f4[texelEm(fino, 102, 2) + 2]).toBe(10 / PASSO_DA_MEIA_U)
  })
})
