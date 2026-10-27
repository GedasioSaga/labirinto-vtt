/**
 * BYTES IGUAIS (F5 da otimização do mapa grande, 27/10/2026): acelerar o ruído
 * não pode mudar um pixel das texturas embutidas, senão o chão já pintado nos
 * mapas mudaria sozinho. Os hashes abaixo saíram do código ANTES da F5
 * (commit b06ce4cc), ladrilho inteiro no lado de cada textura.
 */
import { describe, expect, it } from 'vitest'
import { TEXTURAS_EMBUTIDAS } from './embutidas'
import { LADO_DO_LADRILHO, pixelsDoLadrilho } from './ladrilhos'
import { cristas, fbm, hash, mod, valor, vizinhos } from './ruido'

const HASH_ANTES_DA_F5: Record<string, string> = {
  areia: '07860dc67fbed4981f80f7100191c2f2ac0a1c66c1ef6a44217bdbd7ea00768b',
  duna: 'd633a6305ccff8b087115735118bfd62a283548410323a09fa31cbef43937e2b',
  grama: 'b8ba828cc8735d5935665ec2121d875b055ae692e34f560035276c8435600145',
  'grama-amarela': '2c5c66aad9452247d7e0e5c201d77432eaa7a09c1169e89e8aef5df90738b7da',
  floresta: 'd3e6a04ed6ab39fb5d086bd9973bc369503cdbbc4fd011e3e8d594abbf35a9da',
  bosque: '5fc2a6a3de25c32017ab735a103db42cea789881da445e2b6324c5ec8564c95b',
  pinheiros: '279160d3a7f4eea0e5afdb2615b2094cd5752af3439255ac0c138e76c0158c04',
  'chao-de-floresta': 'cb19d3330ebcf5285aacac502e0acce26aef645b6f623ead0f9da972b9c8a3d4',
  pantano: 'f07e90c5c5685fe828b29fbad4081aa173b899f7ce9ff6e35264aa269f4ee780',
  terra: 'f8b057f72fe1b374def89e9ba3e5054101cfb4b20693f29dcd7036f3dc73ec82',
  pedra: '4d518949913ec7f1937ef4d734b07e1fc1bde309ae8a705ee1499e286451ce12',
  neve: '4fb13c25326a3ea80e3f28b516f5b022d1420903ca5821b0ce9b1b7d53415ee1',
  conves: 'e4807562aa43b41a7fa8ea9762f41915dbb684ade3a7bc70bdc77f24caaae4ed',
  lajotas: '387a27a0022e95cb343291734290ea8f40cf26b40ac82cfc486d451f4c3f35cb',
  'lajotas-escuras': 'cfe207ea892115ceb1c63741c9fe961f56f836780a8d3c816919d16ccc11c793',
  calcamento: 'b28fda318cb0960ac96a043de13fd8ef1add9641802299f8638b9e82cfe930fe',
}

async function sha256(bytes: Uint8ClampedArray): Promise<string> {
  const resumo = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes))
  return [...new Uint8Array(resumo)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

describe('texturas embutidas: os mesmos bytes de antes da F5', () => {
  it('toda embutida tem hash registrado', () => {
    expect(TEXTURAS_EMBUTIDAS.map((t) => t.id).sort()).toEqual(Object.keys(HASH_ANTES_DA_F5).sort())
  })
  for (const textura of TEXTURAS_EMBUTIDAS) {
    it(`${textura.id}: hash dos pixels igual`, async () => {
      const pixels = pixelsDoLadrilho(textura.cor, textura.lado ?? LADO_DO_LADRILHO)
      expect(await sha256(pixels)).toBe(HASH_ANTES_DA_F5[textura.id])
    })
  }
})

// ---- a conta de antes, copiada, para os parâmetros que as embutidas não usam
// (base fracionária, período acima da tabela, semente grande, índice negativo).

function suave(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10)
}
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
function gradienteDeAntes(x: number, y: number, periodo: number, semente: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const canto = (cx: number, cy: number, dx: number, dy: number) => {
    const angulo = hash(mod(cx, periodo), mod(cy, periodo), semente) * Math.PI * 2
    return Math.cos(angulo) * dx + Math.sin(angulo) * dy
  }
  const sx = suave(fx)
  return lerp(lerp(canto(x0, y0, fx, fy), canto(x0 + 1, y0, fx - 1, fy), sx), lerp(canto(x0, y0 + 1, fx, fy - 1), canto(x0 + 1, y0 + 1, fx - 1, fy - 1), sx), suave(fy))
}
function fbmDeAntes(u: number, v: number, base: number, oitavas: number, semente: number, ganho = 0.5): number {
  let soma = 0
  let amplitude = 1
  let total = 0
  let periodo = base
  for (let i = 0; i < oitavas; i += 1) {
    soma += gradienteDeAntes(u * periodo, v * periodo, periodo, semente + i * 101) * amplitude
    total += amplitude
    amplitude *= ganho
    periodo *= 2
  }
  return (soma / total) * 1.6
}
function cristasDeAntes(u: number, v: number, base: number, oitavas: number, semente: number): number {
  let soma = 0
  let amplitude = 1
  let total = 0
  let periodo = base
  for (let i = 0; i < oitavas; i += 1) {
    const n = 1 - Math.abs(gradienteDeAntes(u * periodo, v * periodo, periodo, semente + i * 131) * 1.4)
    soma += n * n * amplitude
    total += amplitude
    amplitude *= 0.5
    periodo *= 2
  }
  return Math.min(1, Math.max(0, soma / total))
}
function valorDeAntes(x: number, y: number, periodo: number, semente: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const sx = suave(x - x0)
  const sy = suave(y - y0)
  const [ix0, iy0, ix1, iy1] = [mod(x0, periodo), mod(y0, periodo), mod(x0 + 1, periodo), mod(y0 + 1, periodo)]
  return lerp(lerp(hash(ix0, iy0, semente), hash(ix1, iy0, semente), sx), lerp(hash(ix0, iy1, semente), hash(ix1, iy1, semente), sx), sy)
}

describe('ruído acelerado: o mesmo número da conta de antes, bit a bit', () => {
  const pontos: Array<[number, number]> = []
  for (let k = 0; k < 300; k += 1) pontos.push([((k * 0.7548776662) % 1) * 3 - 1, ((k * 0.569840291) % 1) * 3 - 1])
  it('fbm e cristas com base inteira, fracionária, grande e semente enorme', () => {
    for (const [base, oitavas, semente] of [[4, 5, 3], [6, 2, 141], [2.5, 3, 9], [200, 3, 17], [3, 4, 2 ** 31], [5, 3, -40]] as const) {
      for (const [u, v] of pontos) {
        expect(Object.is(fbm(u, v, base, oitavas, semente), fbmDeAntes(u, v, base, oitavas, semente))).toBe(true)
        expect(Object.is(fbm(u, v, base, oitavas, semente, 0.65), fbmDeAntes(u, v, base, oitavas, semente, 0.65))).toBe(true)
        expect(Object.is(cristas(u, v, base, oitavas, semente), cristasDeAntes(u, v, base, oitavas, semente))).toBe(true)
      }
    }
  })
  it('valor e vizinhos com período inteiro e fracionário, índice negativo', () => {
    for (const periodo of [7, 64, 2.5]) {
      for (const [u, v] of pontos) {
        expect(Object.is(valor(u * periodo, v * periodo, periodo, 11), valorDeAntes(u * periodo, v * periodo, periodo, 11))).toBe(true)
        const vistos: number[] = []
        vizinhos(u, v, periodo, 5, 0.4, (p) => vistos.push(p.dx, p.dy, p.ix, p.iy))
        const esperados: number[] = []
        const cx = Math.floor(u * periodo)
        const cy = Math.floor(v * periodo)
        for (let oy = -1; oy <= 1; oy += 1) {
          for (let ox = -1; ox <= 1; ox += 1) {
            const ix = mod(cx + ox, periodo)
            const iy = mod(cy + oy, periodo)
            const px = cx + ox + 0.5 + (hash(ix, iy, 5) - 0.5) * 2 * 0.4
            const py = cy + oy + 0.5 + (hash(ix, iy, 5 + 7) - 0.5) * 2 * 0.4
            esperados.push(u * periodo - px, v * periodo - py, ix, iy)
          }
        }
        expect(vistos.every((x, i) => Object.is(x, esperados[i]))).toBe(true)
      }
    }
  })
})
