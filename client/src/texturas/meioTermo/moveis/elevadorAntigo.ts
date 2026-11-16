/**
 * ELEVADOR ANTIGO (lote L2 das referências, 16/11/2026: versão original, só a ideia do objeto). A cabine de madeira
 * escura dentro da gaiola de ferro: os quatro montantes de canto com o pomo, as grades de pé por fora das paredes,
 * na frente a GRADE SANFONADA (as barras de pé e os losangos da tesoura) com a chapa de cima e o MOSTRADOR de latão
 * dos andares (o ponteiro e as marcas), a soleira de latão e o piso de tábuas. Em cima do teto rebitado, a viga
 * atravessada com o TAMBOR do cabo enrolado, e os dois furos por onde o cabo desce.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): de cima aparecem o teto com a viga e o tambor (a
 * marca do elevador a 25% de zoom: o quadrado escuro com a faixa e o rolo no meio) e os pomos dos cantos; na 3/4 a
 * gaiola sobe quase duas casas e a frente é a grade de verdade, vazada (a textura apaga o que não é barra), com a
 * cabine e os painéis do fundo aparecendo por ela. Girada, mostra a grade de pé por fora da parede de madeira.
 *
 * O desenho não sabe da cabine de transporte (`lib/cabine.ts`): ele fica em cima do pino de viagem dela. Perfil da
 * 3/4: `{ modo: 'derivado', espessura: 0 }`. Materiais: `madeira` (a cabine) e `grade` (o ferro); o latão é fixo.
 */
import { caixa, uniao } from './formas'
import { contato, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, novoFatiador, type Fatiador } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal, sombraVarrida } from './apoioDasReferencias'

/** O latão da soleira e do mostrador. */
const LATAO: MaterialDaPeca = { classe: 'metal', rgb: [0xb3, 0x8f, 0x4c] }
/** A altura da gaiola (casas), a da chapa de cima da grade e a do piso (px). */
const ALTURA = 1.8
const CHAPA = 14
const PISO = 3
/** A grossura da parede e do montante, o passo das barras de pé e o dos losangos da sanfona (px). */
const PAREDE = 2
const MONTANTE = 3.2
const BARRA = 4.6
const LOSANGO = 7
/** O tambor do cabo: meia largura, raio e o passo da volta do cabo (px). */
const TAMBOR = { meia: 8.5, raio: 4.4, volta: 1.6 } as const

const mod = (a: number, n: number): number => ((a % n) + n) % n

export const montarElevadorAntigo: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const madeira = c.m.madeira
  const ferro = c.m.grade
  const f: Fatiador = novoFatiador(P, cena, c.giro)
  const q = f.q
  const daMadeira = texturaDaClasse(madeira.classe)
  const doFerro = texturaDaClasse(ferro.classe)
  const H = g * ALTURA
  const [x0, x1, y0, y1] = [-hw + 1.5, hw - 1.5, -hh + 1.5, hh - 1.5]

  // O PISO: a chapa de ferro e as tábuas por cima; a soleira de latão na frente.
  for (const z of alturas(0, PISO, 1)) {
    const topo = z >= PISO - 1e-6
    f.fatia(0, z, caixa(x0, y0, x1, y1, 0.6), topo ? madeira : ferro, topo ? { eixo: 0, tabua: 6.5, bisel: 0.5, tom: 0.86, contorno: 0.26, semente: 6101 } : lisa(0.8, undefined, 6100))
  }
  f.fatia(0, PISO + 0.3, caixa(x0 + MONTANTE, y1 - 2.6, x1 - MONTANTE, y1 - 0.7, 0.4), LATAO, { eixo: 0, tabua: 0, bisel: 0.5, tom: 1, contorno: 0.24, semente: 6102 })

  // As PAREDES da cabine (o fundo e os dois lados, uma forma em U por altura): por dentro, os painéis de madeira com
  // a moldura; por fora, as barras de ferro de pé da gaiola.
  const fundo = caixa(x0 + PAREDE, y0, x1 - PAREDE, y0 + PAREDE)
  const lados = uniao(caixa(x0, y0, x0 + PAREDE, y1 - MONTANTE), caixa(x1 - PAREDE, y0, x1, y1 - MONTANTE))
  const paredes = uniao(fundo, lados)
  const parede = (z: number): Textura => (u, v, x, y, p, s, escala) => {
    const deFora = y < y0 + 0.8 || x < x0 + 0.8 || x > x1 - 0.8
    const [nx, ny] = x < x0 + PAREDE ? [deFora ? -1 : 1, 0] : x > x1 - PAREDE ? [deFora ? 1 : -1, 0] : [0, deFora ? -1 : 1]
    const ao = nx === 0 ? x : y
    if (deFora && mod(ao, BARRA) < 1.3) {
      if (doFerro !== null) doFerro(u, v, x, y, p, s, escala)
      s[0] = ferro.rgb[0]
      s[1] = ferro.rgb[1]
      s[2] = ferro.rgb[2]
      s[3] += luzDaNormal(nx, ny, 0, q) + 0.04
      return
    }
    if (daMadeira !== null) daMadeira(ao * 0.4, z * 1.7, x, y, p, s, escala)
    // Os painéis: três de largura e três de altura, com a moldura escura e o filete claro.
    const largura = nx === 0 ? x1 - x0 : y1 - y0
    const local = mod(ao - (nx === 0 ? x0 : y0), largura / 3)
    const alto = mod(z - PISO, (H - PISO) / 3)
    const naMoldura = local < 1.4 || alto < 1.4
    s[3] += luzDaNormal(nx, ny, 0, q) + (deFora ? -0.12 : 0) + (naMoldura ? -0.16 : local < 2.1 || alto < 2.1 ? 0.07 : 0)
  }
  for (const z of alturas(PISO, H, 1)) f.fatia(1, z, paredes, madeira, lisa(0.78, parede(z), 6110))

  // Os MONTANTES dos cantos, do chão ao pomo em cima do teto.
  const zPomo = H + 5
  for (const [mx, my] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]] as const) {
    const cx = mx < 0 ? mx + MONTANTE / 2 : mx - MONTANTE / 2
    const cy = my < 0 ? my + MONTANTE / 2 : my - MONTANTE / 2
    const faces: Textura = (u, v, x, y, p, s, escala) => {
      if (doFerro !== null) doFerro(u, v, x, y, p, s, escala)
      const [dx, dy] = [x - cx, y - cy]
      s[3] += Math.abs(dx) > Math.abs(dy) ? luzDaNormal(Math.sign(dx), 0, 0, q) : luzDaNormal(0, Math.sign(dy), 0, q)
    }
    for (const z of alturas(0, zPomo, 1.2)) f.fatia(1, z, caixa(cx - MONTANTE / 2, cy - MONTANTE / 2, cx + MONTANTE / 2, cy + MONTANTE / 2, 0.3), ferro, lisa(0.92, faces, 6120))
    for (const z of alturas(zPomo, zPomo + 3.4, 0.5)) {
      const t = (z - zPomo) / 3.4
      const topo = t > 0.99
      f.fatia(1, z, disco(cx, cy, 0.6 + 1.6 * Math.sin(Math.PI * Math.min(1, 0.15 + t))), ferro, topo ? { tabua: 0, bisel: 0.6, tom: 1.1, contorno: 0.24, semente: 6121 } : lisa(1, faces, 6122))
    }
  }

  // A GRADE SANFONADA na frente: as barras de pé e a tesoura em losangos; o resto é vazado (a cabine aparece). Em
  // cima, a chapa com o MOSTRADOR dos andares.
  const [gx0, gx1] = [x0 + MONTANTE, x1 - MONTANTE]
  const zChapa = H - CHAPA
  const centroDoMostrador = [0, H - CHAPA / 2] as const
  const grade = (z: number): Textura => (u, v, x, y, p, s, escala) => {
    if (doFerro !== null) doFerro(u, v, x, y, p, s, escala)
    const naChapa = z >= zChapa
    if (naChapa) {
      const [dx, dz] = [x - centroDoMostrador[0], z - centroDoMostrador[1]]
      const r = Math.hypot(dx, dz)
      if (r < 5.2) {
        // O mostrador: o latão, o aro escuro, as marcas dos andares em leque e o ponteiro.
        s[0] = LATAO.rgb[0]
        s[1] = LATAO.rgb[1]
        s[2] = LATAO.rgb[2]
        const ang = Math.atan2(dz, dx)
        const marca = r > 3.4 && r < 4.6 && dz > -0.5 && mod(ang + Math.PI / 10, Math.PI / 5) < 0.18
        const ponteiro = r < 4 && Math.abs(dx * Math.sin(2.2) - dz * Math.cos(2.2)) < 0.45 && dx * Math.cos(2.2) + dz * Math.sin(2.2) > -0.6
        s[3] += (r > 4.6 ? -0.32 : 0.12) + (marca || ponteiro ? -0.42 : 0)
        return
      }
      s[3] += luzDaNormal(0, 1, 0, q) + (z > H - 1.4 || z < zChapa + 1.2 ? 0.1 : 0)
      return
    }
    const trilho = z < PISO + 2.2
    const dePe = mod(x - gx0, BARRA * 1.5) < 1.2 || x < gx0 + 1.4 || x > gx1 - 1.4
    const tesoura = mod(x + z, LOSANGO) < 0.85 || mod(x - z, LOSANGO) < 0.85
    if (!(trilho || dePe || tesoura)) {
      s[5] = 0
      return
    }
    s[3] += luzDaNormal(0, 1, 0, q) + (dePe ? 0.08 : 0) + (tesoura && !dePe ? -0.04 : 0)
  }
  for (const z of alturas(PISO, H, 0.8)) f.fatia(2, z, caixa(gx0, y1 - 2.2, gx1, y1 - 0.8), ferro, lisa(0.95, grade(z), 6130))

  // O TETO rebitado (a chapa passa um nada das paredes) e, por cima, a viga, o tambor do cabo e os furos do cabo.
  const rebites: Textura = (u, v, x, y, p, s, escala) => {
    if (doFerro !== null) doFerro(u, v, x, y, p, s, escala)
    const naBeira = Math.min(x - x0, x1 - x, y - y0, y1 - y) < 3
    if (naBeira && Math.hypot(mod(x - x0, 6) - 3, Math.min(Math.abs(y - y0 - 1.6), Math.abs(y1 - 1.6 - y), 9) ) < 0.8) s[3] += 0.16
    if (naBeira && Math.hypot(mod(y - y0, 6) - 3, Math.min(Math.abs(x - x0 - 1.6), Math.abs(x1 - 1.6 - x), 9)) < 0.8) s[3] += 0.16
  }
  for (const z of alturas(H, H + 2, 1)) {
    const topo = z >= H + 2 - 1e-6
    f.fatia(3, z, caixa(x0 - 0.4, y0 - 0.4, x1 + 0.4, y1 + 0.4, 0.5), ferro, topo ? { tabua: 0, bisel: 0.8, tom: 0.82, contorno: 0.26, textura: rebites, semente: 6140 } : lisa(0.76, undefined, 6141))
  }
  for (const sx of [-1, 1]) f.fatia(3, H + 2.2, disco(sx * 4.2, 6.5, 1.1), { classe: 'liso', rgb: [0x1c, 0x1a, 0x18] }, { tabua: 0, bisel: 0, contorno: 0.1, tom: 1, semente: 6142 })
  for (const z of alturas(H + 2, H + 5, 1)) {
    const topo = z >= H + 5 - 1e-6
    f.fatia(3, z, caixa(x0 + 1, -2.4, x1 - 1, 2.4, 0.3), ferro, topo ? { eixo: 0, tabua: 0, bisel: 0.6, tom: 1, contorno: 0.26, semente: 6143 } : lisa(0.9, undefined, 6144))
  }
  const zEixo = H + 5 + TAMBOR.raio
  for (const z of alturas(H + 5, zEixo + TAMBOR.raio, 0.6)) {
    const meia = Math.sqrt(Math.max(0, TAMBOR.raio ** 2 - (z - zEixo) ** 2))
    if (meia < 0.4) continue
    const cabo: Textura = (u, v, x, y, p, s, escala) => {
      if (doFerro !== null) doFerro(u, v, x, y, p, s, escala)
      const a = Math.atan2(z - zEixo, y)
      // O rolo: o lombo claro, a barriga escura; as voltas do cabo enrolado, inclinadas.
      s[3] += luzDaNormal(0, Math.cos(a), Math.sin(a), q) * 1.6 + (mod(x + a * 0.8, TAMBOR.volta) < 0.55 ? -0.14 : 0.03)
    }
    f.fatia(3, z, caixa(-TAMBOR.meia, -meia, TAMBOR.meia, meia), ferro, lisa(1.02, cabo, 6150))
    // As abas do tambor, um nada maiores que o rolo.
    for (const sx of [-1, 1]) f.fatia(3, z, caixa(sx * TAMBOR.meia - 0.6 + sx * 0.6, -meia - 0.8, sx * TAMBOR.meia + 0.6 + sx * 0.6, meia + 0.8), ferro, lisa(0.9, undefined, 6151))
  }
  f.fechar()

  // A sombra da gaiola alta, varrida do pé até a do teto, e o contato.
  cena.sombras.push(sombraVarrida(x0, y0, x1, y1, H * 0.55, q, 0.24, 2.8), contato(caixa(x0, y0, x1, y1, 0.6), 0.32))
}
