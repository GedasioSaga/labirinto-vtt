/**
 * FOGAREIRO DE FERRO, a SALAMANDRA (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo, id
 * `salamandra`). O fogão de aquecer do cortiço: o corpo BARRIGUDO de ferro fundido, estreito no pé, largo na barriga
 * e fechando no ombro, com dois frisos em volta; os três PÉS curtos abertos para fora; a PORTA na frente, com a
 * moldura, a dobradiça, o trinco e as frestas por onde se vê a BRASA; a chapa de cima com a TAMPA redonda e o pino
 * de levantar; e o CANO, que sobe de trás da chapa, faz o cotovelo e corre deitado até a beira de trás da pegada
 * (a parede). No chão, na frente da porta, a CHAPA de lata com cinza e duas brasas caídas, e o clarão morno da
 * porta. O ferro é escuro, com ferrugem em manchas largas e apagadas.
 *
 * A porta fica na frente (embaixo no giro 0) e o cano sai por trás: encoste a parte de cima na parede. A LUZ é do
 * integrador (`LUZ_DOS_OBJETOS`, sugestão no registro do lote); o brilho do desenho é só a brasa da porta.
 *
 * As duas vistas saem da PILHA DE FATIAS (`pilhaDeFatias.ts`): o corpo é um disco em fatias cujo raio segue a
 * barriga (de cima aparecem o ombro em degradê, a chapa e a tampa; na 3/4, o perfil barrigudo com a porta acesa na
 * frente). A porta, os frisos e a ferrugem são pintados na face de cada fatia, no referencial do objeto: giram com
 * ele. Perfil da 3/4: `{ modo: 'derivado', espessura: 0 }`. Material: `metal` (sugestão: ferro). Medidas do menor
 * meio lado (1 x 1 casa de partida).
 */
import { caixa, uniao, type Forma } from './formas'
import { ruido, texturaDaClasse, type MaterialDaPeca, type Textura } from './motor'
import type { MontarMovel } from './contexto'
import { alturas, luzDoCilindro, luzDoDeitado, naTela, novoFatiador, sombraDoCilindro, sombraNoAr } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal } from './apoioDasReferencias'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'
import { bolha, passo, setorDeAnel } from './fossoDeArena'

/** As alturas (casas): o alto dos pés, o ombro, a chapa de cima e o eixo do cano deitado. */
const Z = { pes: 0.09, ombro: 0.56, chapa: 0.62, cano: 0.86 } as const
/** Os raios, em fração do menor meio lado: a barriga (o mais largo), a chapa de cima, a tampa e o cano. */
const RAIO = { barriga: 0.6, chapa: 0.43, tampa: 0.2, cano: 0.125 } as const
/** A porta: a meia largura (rad), de onde a onde ela vai na altura do corpo (0 a 1) e o quanto ela sai do corpo (px). */
const PORTA = { meia: 0.52, de: 0.2, ate: 0.66, salta: 1.3 } as const
const FRENTE = Math.PI / 2
/** O passo das fatias (px do protótipo). */
const PASSO = 0.9
/** O ferro fundido do corpo é mais escuro que o ferro batido da tabela. */
const TOM_DO_FERRO = 0.8
/** O ferro escuro da ferrugem, a cinza da chapa e o clarão da porta no chão. */
const FERRUGEM = [0x7c, 0x55, 0x40] as const
const CINZA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x88, 0x80] }
const CLARAO = [214, 150, 92] as const
const BRASA: MaterialDaPeca = { classe: 'liso', rgb: BRASA_QUENTE }

/** O raio do corpo na altura `t` (0 no alto dos pés, 1 no ombro), em fração do raio da barriga. */
function barriga(t: number): number {
  return 0.76 - 0.1 * t + 0.3 * Math.sin(Math.PI * t ** 0.9)
}

/** A diferença de ângulo até a frente, entre -π e π. */
function daFrente(x: number, y: number): number {
  const a = Math.atan2(y, x) - FRENTE
  return a - 2 * Math.PI * Math.round(a / (2 * Math.PI))
}

export const montarSalamandra: MontarMovel = (c, cena) => {
  const { hw, hh, g, peca: P } = c
  const ferro = c.m.metal
  const doMetal = texturaDaClasse(ferro.classe)
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const L = cena.partes
  const R = Math.min(hw, hh)
  const k = R / 28
  const rBarriga = R * RAIO.barriga
  const [zPes, zOmbro, zChapa, zCano] = [g * Z.pes, g * Z.ombro, g * Z.chapa, g * Z.cano]
  const rCano = R * RAIO.cano
  const yCano = -rBarriga * 0.36

  // ---------- no chão: a chapa de lata, a cinza, as brasas caídas e o clarão da porta ----------
  const chapa = caixa(-rBarriga * 0.74, rBarriga * 0.2, rBarriga * 0.74, hh - 1.2 * k, 1.2 * k)
  cena.sombras.push({ forma: chapa, z: 0, forca: 0.26, suave: 1 })
  L.push(P(chapa, ferro, { tabua: 0, bisel: 0.6, tom: 1.22, contorno: 0.26, metal: 0.16, semente: 7101 }))
  L.push(P(bolha(-1.6 * k, hh - 6.4 * k, 6.4 * k, 2.6 * k, 7102, 0.22), CINZA_CLARA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1.1 * k, semente: 7103 }))
  for (const [i, [bx, by, br]] of ([[3.4, 4.4, 0.95], [-4.6, 3.2, 0.7]] as const).entries()) {
    const [x, y] = [bx * k, hh - by * k]
    const quente: Textura = (_u, _v, px, py, _p, s) => {
      const t = Math.min(1, Math.hypot(px - x, py - y) / (br * k))
      for (let j = 0; j < 3; j += 1) s[j] = BRASA_QUENTE[j] + (BRASA_VIVA[j] - BRASA_QUENTE[j]) * t * t
      s[4] = 1
    }
    L.push(P(disco(x, y, br * k), BRASA, { tabua: 0, bisel: 0, contorno: 0, textura: quente, semente: 7104 + i }))
  }
  const [gx, gy, gr] = [0, rBarriga + 3.2 * k, 9.5 * k]
  const clarao: Textura = (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, ((x - gx) ** 2 + ((y - gy) * 1.35) ** 2) / (gr * gr))
    for (let j = 0; j < 3; j += 1) s[j] = CLARAO[j]
    s[4] = 1
    s[5] = 0.3 * (1 - t) * (1 - t)
  }
  L.push(P(disco(gx, gy, gr), BRASA, { tabua: 0, bisel: 0, contorno: 0, textura: clarao, semente: 7108 }))

  // ---------- os três pés curtos, abertos para fora ----------
  for (const [i, a] of [FRENTE - 1.05, FRENTE + 1.05, -FRENTE].entries()) {
    for (const z of alturas(0, zPes, PASSO)) {
      const longe = rBarriga * (0.94 - 0.12 * (z / zPes))
      const r = (2.7 - 0.5 * (z / zPes)) * k
      f.fatia(0, z, disco(Math.cos(a) * longe, Math.sin(a) * longe, r), ferro, z < PASSO * 0.5 ? { tabua: 0, bisel: 0.8, tom: TOM_DO_FERRO, contorno: 0.28, semente: 7110 + i } : lisa(TOM_DO_FERRO, undefined, 7110 + i))
    }
  }

  // ---------- o corpo barrigudo: a face de cada fatia leva a luz, os frisos, a ferrugem e a porta ----------
  const corpo = (z: number): Textura => {
    const t = (z - zPes) / (zOmbro - zPes)
    // A inclinação da parede na altura da fatia: o ombro olha para cima (pega luz), o pé da barriga olha para baixo.
    const nz = (barriga(Math.max(0, t - 0.04)) - barriga(Math.min(1, t + 0.04))) * 4.5
    const naPorta = t > PORTA.de && t < PORTA.ate
    const v = (t - PORTA.de) / (PORTA.ate - PORTA.de)
    return (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      const rr = Math.hypot(x, y) || 1
      const [sx] = naTela(x / rr, y / rr, q)
      let luz = luzDaNormal(x / rr, y / rr, nz, q) * 1.5 + luzDoCilindro(sx, 0.1) * 0.6 + nz * 0.07
      // Os frisos: um cordão claro com o fio de sombra embaixo, perto do pé e do ombro.
      for (const onde of [0.1, 0.9]) luz += 0.1 * passo(0.035, 0.012, Math.abs(t - onde)) - 0.1 * passo(0.035, 0.012, Math.abs(t - onde + 0.045))
      // A ferrugem, em manchas largas (some na porta).
      const da = daFrente(x, y)
      const ferrugem = passo(0.12, 0.42, ruido(x * 0.09 + 31, y * 0.09 + z * 0.07)) * 0.42
      if (naPorta && Math.abs(da) < PORTA.meia) {
        // A porta é uma chapa mais escura com a moldura clara; as frestas são faixas retas (pela largura, não pelo
        // ângulo: de fatia em fatia a beira delas não serrilha).
        const lx = x / (rr * Math.sin(PORTA.meia))
        const borda = Math.min(1 - Math.abs(lx), Math.min(v, 1 - v) * 1.6)
        if (borda < 0.13) luz += 0.12
        else {
          const fresta = (Math.abs(lx) < 0.17 || (Math.abs(lx) > 0.36 && Math.abs(lx) < 0.7)) && v > 0.26 && v < 0.78
          if (fresta) {
            // A brasa atrás das frestas: mais quente no meio da porta e embaixo.
            const calor = 1.05 - Math.abs(lx) * 0.5 - (v - 0.26) * 0.7 - 0.3 * ruido(lx * 9, z * 0.9)
            for (let j = 0; j < 3; j += 1) s[j] = BRASA_VIVA[j] + (BRASA_QUENTE[j] - BRASA_VIVA[j]) * Math.max(0, Math.min(1, calor))
            s[4] = 0.92
            return
          }
          luz -= 0.1
        }
        // O trinco, à direita de quem olha.
        if (lx > 0.8 && lx < 0.93 && Math.abs(v - 0.5) < 0.1) luz += 0.2
      } else {
        for (let j = 0; j < 3; j += 1) s[j] += (FERRUGEM[j] - s[j]) * ferrugem
      }
      s[3] += luz
    }
  }
  for (const z of alturas(zPes, zOmbro, PASSO)) {
    const t = (z - zPes) / (zOmbro - zPes)
    const r = rBarriga * barriga(t)
    // A porta salta um nada do corpo: a moldura dela é o que se vê de cima, na frente.
    const comPorta: Forma = t > PORTA.de && t < PORTA.ate ? uniao(disco(0, 0, r), setorDeAnel(0, 0, r - 3, r + PORTA.salta * k, FRENTE - PORTA.meia, PORTA.meia * 2, 0)) : disco(0, 0, r)
    f.fatia(1, z, comPorta, ferro, lisa(TOM_DO_FERRO, corpo(z), 7120))
  }

  // ---------- a chapa de cima, a tampa e o pino ----------
  const rChapa = R * RAIO.chapa
  const rTampa = R * RAIO.tampa
  for (const z of alturas(zOmbro, zChapa, PASSO)) {
    const topo = z >= zChapa - 1e-6
    const emCima: Textura = (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      const rr = Math.hypot(x, y - rChapa * 0.16)
      // O rego em volta da tampa e o entalhe de levantar.
      let luz = Math.abs(rr - rTampa) < 0.55 * k ? -0.26 : rr < rTampa ? 0.05 : 0
      if (rr < rTampa && Math.abs(x) < 0.5 * k && y > rChapa * 0.16 + rTampa * 0.45) luz -= 0.2
      s[3] += luz
    }
    const lado: Textura = (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      const rr = Math.hypot(x, y) || 1
      s[3] += luzDaNormal(x / rr, y / rr, 0, q) * 1.5 + luzDoCilindro(naTela(x / rr, y / rr, q)[0], 0.1) * 0.6
    }
    f.fatia(1, z, disco(0, 0, rChapa), ferro, topo ? { tabua: 0, bisel: 1.1, tom: TOM_DO_FERRO * 1.1, contorno: 0.26, textura: emCima, semente: 7130 } : lisa(TOM_DO_FERRO * 1.04, lado, 7131))
  }
  f.fatia(1, zChapa + 1.3, disco(0, rChapa * 0.16, 1.5 * k), ferro, { tabua: 0, bisel: 1.1 * k, tom: 1.1, contorno: 0.26, semente: 7132 })

  // ---------- o cano: sobe de trás da chapa, faz o cotovelo e corre deitado até a beira de trás ----------
  const noCano = (brilho: number): Textura => (u, w, x, y, p, s, escala) => {
    if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
    const [sx] = naTela(x / rCano, (y - yCano) / rCano, q)
    s[3] += luzDoCilindro(Math.max(-1, Math.min(1, sx)), brilho)
  }
  for (const z of alturas(zChapa, zCano, PASSO)) {
    // A abraçadeira no pé do cano: um anel mais largo e mais claro.
    const noPe = z < zChapa + 2.2
    f.fatia(2, z, disco(0, yCano, rCano * (noPe ? 1.28 : 1)), ferro, lisa(noPe ? 1.04 : 0.92, noCano(0.16), 7140))
  }
  const rCotovelo = rCano * 1.16
  for (const z of alturas(zCano - rCotovelo, zCano + rCotovelo, PASSO)) {
    const t = (z - zCano) / rCotovelo
    const meia = Math.sqrt(Math.max(0, 1 - t * t))
    const deitado: Textura = (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      // As emendas do cano: um fio escuro a cada meia casa de comprimento.
      const emenda = Math.abs(((y - yCano) / (g * 0.3)) % 1) < 0.07 && y < yCano - rCotovelo
      s[3] += luzDoDeitado(t, 0.16) - (emenda ? 0.16 : 0)
    }
    if (meia * rCotovelo > 0.4) f.fatia(2, z, disco(0, yCano, meia * rCotovelo), ferro, lisa(0.98, deitado, 7141))
    if (Math.abs(t) * rCotovelo < rCano) {
      const larg = Math.sqrt(rCano * rCano - (t * rCotovelo) ** 2)
      if (larg > 0.4) f.fatia(3, z, caixa(-larg, -hh + 0.4, larg, yCano, Math.min(larg, 1)), ferro, lisa(0.92, deitado, 7142))
    }
  }
  f.fechar()

  // ---------- as sombras no chão, já desenhadas para o lado da sombra na tela ----------
  cena.sombras.push(
    { forma: disco(0, 0, rBarriga * 0.86), z: 0, forca: 0.34, suave: 1.8 },
    sombraDoCilindro(0, 0, rBarriga * 0.9, zChapa * 0.9, q, 0.3, 2.2),
    sombraNoAr(caixa(-rCano, -hh + 0.4, rCano, yCano + rCano), zCano, q, 0.22, 2.6),
  )
}
