/**
 * FOGAREIRO DE FERRO, a SALAMANDRA (lote L11 dos objetos de 24/11/2026, "Arena e cortiço"; objeto novo, id
 * `salamandra`). O fogão de aquecer do cortiço: o corpo BARRIGUDO de ferro fundido, estreito no pé, largo na barriga
 * e fechando no ombro, com dois frisos em volta; os três PÉS curtos abertos para fora; a PORTA na frente, com a
 * moldura, a dobradiça, o trinco e as frestas por onde se vê a BRASA; a chapa de cima com a TAMPA redonda e o pino
 * de levantar; e o CANO, que sobe de trás da chapa, faz o cotovelo e corre deitado, com as emendas em anel, até o
 * ESPELHO de parede na beira de trás da pegada (sem ele e sem as emendas, de cima o disco com o cano era uma
 * frigideira com cabo). No chão, na frente da porta, a CHAPA pequena de cantos redondos, metade embaixo da barriga,
 * com a cinza e uma brasa caída, e o CLARÃO quente da porta, que de cima é o que diz "fogo". O ferro fundido é preto
 * quente e fosco, com ferrugem em manchas largas.
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
import { alturas, luzDoCilindro, luzDoDeitado, naTela, novoFatiador, sombraDoCilindro, sombraNoAr, type OpcoesDaFatia } from './pilhaDeFatias'
import { disco, lisa, luzDaNormal } from './apoioDasReferencias'
import { BRASA_QUENTE, BRASA_VIVA } from './fogueira'
import { bolha, escuroDe, passo, setorDeAnel } from './fossoDeArena'

/** As alturas (casas): o alto dos pés, o ombro, a chapa de cima e o eixo do cano deitado. */
const Z = { pes: 0.09, ombro: 0.56, chapa: 0.62, cano: 0.86 } as const
/** Os raios, em fração do menor meio lado: a barriga (o mais largo), a chapa de cima, a tampa e o cano. */
const RAIO = { barriga: 0.6, chapa: 0.43, tampa: 0.2, cano: 0.125 } as const
/** A porta: a meia largura (rad), de onde a onde ela vai na altura do corpo (0 a 1) e o quanto ela sai do corpo (px). */
const PORTA = { meia: 0.52, de: 0.2, ate: 0.66, salta: 1.3 } as const
const FRENTE = Math.PI / 2
/** O passo das fatias (px do protótipo). */
const PASSO = 0.9
/**
 * O ferro FUNDIDO do corpo: o metal escolhido tisnado (puxado para a fuligem quente) e bem mais escuro que o ferro
 * batido da tabela, quase sem brilho. O ferro da tabela (#5d6164) dá perto de #3c3835: preto quente. A 0,8 e com o
 * brilho do metal ele lia como alumínio.
 */
const TOM_DO_FERRO = 0.62
const FULIGEM = [0x62, 0x58, 0x52] as const
const QUANTO_TISNA = 0.75
const BRILHO_DO_FERRO = 0.05
/** O ferro escuro da ferrugem e o quanto ela cobre, a cinza da chapa e o clarão da porta no chão (o raio, em px do tamanho de partida, e o alfa no meio). */
const FERRUGEM = [0x7c, 0x55, 0x40] as const
const QUANTO_DE_FERRUGEM = 0.5
const CINZA_CLARA: MaterialDaPeca = { classe: 'liso', rgb: [0x8e, 0x88, 0x80] }
const CLARAO = [214, 150, 92] as const
const RAIO_DO_CLARAO = 13
const ALFA_DO_CLARAO = 0.42
const BRASA: MaterialDaPeca = { classe: 'liso', rgb: BRASA_QUENTE }
/** A chapa de cinza na frente: a meia largura (fração do raio da barriga), de onde ela sai debaixo da barriga e o tom. */
const CHAPA = { meia: 0.55, de: 0.4, tom: 0.95 } as const
/** As emendas do cano deitado: de quanto em quanto (casas) e a largura de cada anel, o escuro e o claro (px). */
const EMENDA = { passo: 0.15, anel: 0.9 } as const
/** O espelho de parede no fim do cano: o raio, em raios do cano, e a grossura (px). */
const ESPELHO = { raio: 1.4, grossura: 2.2 } as const

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
  const escolhido = c.m.metal
  const tisnar = (i: 0 | 1 | 2): number => escolhido.rgb[i] + (FULIGEM[i] - escolhido.rgb[i]) * QUANTO_TISNA
  const ferro: MaterialDaPeca = { ...escolhido, rgb: [tisnar(0), tisnar(1), tisnar(2)] }
  const doMetal = texturaDaClasse(ferro.classe)
  /** A fatia de dentro, fosca: o brilho de partida do metal acendia o corpo inteiro. */
  const fosca = (tom: number, textura: Textura | undefined, semente: number): OpcoesDaFatia => ({ ...lisa(tom, textura, semente), metal: BRILHO_DO_FERRO })
  const f = novoFatiador(P, cena, c.giro)
  const q = f.q
  const L = cena.partes
  // O pixel escuro demais é levantado para o escuro do próprio ferro: com o escuro quente da nogueira, o lado da
  // sombra do corpo preto saía marrom de cima a baixo.
  cena.corDoPiso = escuroDe(ferro)
  const R = Math.min(hw, hh)
  const k = R / 28
  const rBarriga = R * RAIO.barriga
  const [zPes, zOmbro, zChapa, zCano] = [g * Z.pes, g * Z.ombro, g * Z.chapa, g * Z.cano]
  const rCano = R * RAIO.cano
  const yCano = -rBarriga * 0.36

  // ---------- no chão: a chapa pequena de cantos redondos (metade embaixo da barriga), a cinza, a brasa caída e o clarão ----------
  const chapa = caixa(-rBarriga * CHAPA.meia, rBarriga * CHAPA.de, rBarriga * CHAPA.meia, hh - 1.2 * k, 4 * k)
  cena.sombras.push({ forma: chapa, z: 0, forca: 0.26, suave: 1 })
  L.push(P(chapa, ferro, { tabua: 0, bisel: 0.6, tom: CHAPA.tom, contorno: 0.26, metal: BRILHO_DO_FERRO, semente: 7101 }))
  L.push(P(bolha(-1.2 * k, hh - 6 * k, 5.4 * k, 2.4 * k, 7102, 0.22), CINZA_CLARA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.5, suave: 1.1 * k, semente: 7103 }))
  {
    // Uma brasa só, de volta torta: as duas redondas de antes liam como rebites.
    const [x, y, br] = [3.2 * k, hh - 4.6 * k, 1.15 * k]
    const quente: Textura = (_u, _v, px, py, _p, s) => {
      const t = Math.min(1, Math.hypot(px - x, py - y) / br)
      for (let j = 0; j < 3; j += 1) s[j] = BRASA_QUENTE[j] + (BRASA_VIVA[j] - BRASA_QUENTE[j]) * t * t
      s[4] = 1
    }
    L.push(P(bolha(x, y, br * 1.25, br * 0.8, 7104, 0.34, 0.5, 9), BRASA, { tabua: 0, bisel: 0, contorno: 0, textura: quente, semente: 7104 }))
  }
  const [gx, gy, gr] = [0, rBarriga + 3.2 * k, RAIO_DO_CLARAO * k]
  const clarao: Textura = (_u, _v, x, y, _p, s) => {
    const t = Math.min(1, ((x - gx) ** 2 + ((y - gy) * 1.35) ** 2) / (gr * gr))
    for (let j = 0; j < 3; j += 1) s[j] = CLARAO[j]
    s[4] = 1
    s[5] = ALFA_DO_CLARAO * (1 - t) * (1 - t)
  }
  L.push(P(disco(gx, gy, gr), BRASA, { tabua: 0, bisel: 0, contorno: 0, textura: clarao, semente: 7108 }))

  // ---------- os três pés curtos, abertos para fora ----------
  for (const [i, a] of [FRENTE - 1.05, FRENTE + 1.05, -FRENTE].entries()) {
    for (const z of alturas(0, zPes, PASSO)) {
      const longe = rBarriga * (0.94 - 0.12 * (z / zPes))
      const r = (2.7 - 0.5 * (z / zPes)) * k
      f.fatia(0, z, disco(Math.cos(a) * longe, Math.sin(a) * longe, r), ferro, z < PASSO * 0.5 ? { tabua: 0, bisel: 0.8, tom: TOM_DO_FERRO, contorno: 0.28, metal: BRILHO_DO_FERRO, semente: 7110 + i } : fosca(TOM_DO_FERRO, undefined, 7110 + i))
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
      let luz = luzDaNormal(x / rr, y / rr, nz, q) * 1.5 + luzDoCilindro(sx, 0.05) * 0.6 + nz * 0.07
      // Os frisos: um cordão claro com o fio de sombra embaixo, perto do pé e do ombro.
      for (const onde of [0.1, 0.9]) luz += 0.1 * passo(0.035, 0.012, Math.abs(t - onde)) - 0.1 * passo(0.035, 0.012, Math.abs(t - onde + 0.045))
      // A ferrugem, em manchas largas (some na porta).
      const da = daFrente(x, y)
      const ferrugem = passo(0.04, 0.34, ruido(x * 0.09 + 31, y * 0.09 + z * 0.07)) * QUANTO_DE_FERRUGEM
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
    f.fatia(1, z, comPorta, ferro, fosca(TOM_DO_FERRO, corpo(z), 7120))
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
      s[3] += luzDaNormal(x / rr, y / rr, 0, q) * 1.5 + luzDoCilindro(naTela(x / rr, y / rr, q)[0], 0.05) * 0.6
    }
    f.fatia(1, z, disco(0, 0, rChapa), ferro, topo ? { tabua: 0, bisel: 1.1, tom: TOM_DO_FERRO * 1.12, contorno: 0.26, metal: BRILHO_DO_FERRO, textura: emCima, semente: 7130 } : fosca(TOM_DO_FERRO * 1.04, lado, 7131))
  }
  f.fatia(1, zChapa + 1.3, disco(0, rChapa * 0.16, 1.5 * k), ferro, { tabua: 0, bisel: 1.1 * k, tom: TOM_DO_FERRO * 1.4, contorno: 0.26, metal: 0.12, semente: 7132 })

  // ---------- o cano: sobe de trás da chapa, faz o cotovelo e corre deitado até a beira de trás ----------
  const noCano = (brilho: number): Textura => (u, w, x, y, p, s, escala) => {
    if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
    const [sx] = naTela(x / rCano, (y - yCano) / rCano, q)
    s[3] += luzDoCilindro(Math.max(-1, Math.min(1, sx)), brilho)
  }
  for (const z of alturas(zChapa, zCano, PASSO)) {
    // A abraçadeira no pé do cano: um anel mais largo e mais claro.
    const noPe = z < zChapa + 2.2
    f.fatia(2, z, disco(0, yCano, rCano * (noPe ? 1.28 : 1)), ferro, fosca(TOM_DO_FERRO * (noPe ? 1.3 : 1.15), noCano(0.08), 7140))
  }
  const rCotovelo = rCano * 1.16
  const passoDaEmenda = g * EMENDA.passo
  for (const z of alturas(zCano - rCotovelo, zCano + rCotovelo, PASSO)) {
    const t = (z - zCano) / rCotovelo
    const meia = Math.sqrt(Math.max(0, 1 - t * t))
    const deitado: Textura = (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      // As emendas do cano: a cada trecho, o anel escuro da junta e, logo depois, o anel claro da boca do tubo seguinte.
      let anel = 0
      if (y < yCano - rCotovelo) {
        const ao = (yCano - y) / passoDaEmenda
        const naEmenda = (ao - Math.floor(ao)) * passoDaEmenda
        anel = naEmenda < EMENDA.anel ? -0.2 : naEmenda < EMENDA.anel * 2 ? 0.14 : 0
      }
      s[3] += luzDoDeitado(t, 0.08) + anel
    }
    if (meia * rCotovelo > 0.4) f.fatia(2, z, disco(0, yCano, meia * rCotovelo), ferro, fosca(TOM_DO_FERRO * 1.22, deitado, 7141))
    if (Math.abs(t) * rCotovelo < rCano) {
      const larg = Math.sqrt(rCano * rCano - (t * rCotovelo) ** 2)
      if (larg > 0.4) f.fatia(3, z, caixa(-larg, -hh + 0.4, larg, yCano, Math.min(larg, 1)), ferro, fosca(TOM_DO_FERRO * 1.15, deitado, 7142))
    }
  }
  // O ESPELHO de parede: o disco de pé em que o cano acaba, na beira de trás (de cima, uma barra curta e larga).
  const rEspelho = rCano * ESPELHO.raio
  for (const z of alturas(zCano - rEspelho, zCano + rEspelho, PASSO)) {
    const t = (z - zCano) / rEspelho
    const larg = rEspelho * Math.sqrt(Math.max(0, 1 - t * t))
    const noEspelho: Textura = (u, w, x, y, p, s, escala) => {
      if (doMetal !== null) doMetal(u, w, x, y, p, s, escala)
      // O aro: mais claro na beira, com o furo do cano escuro no meio.
      const longe = Math.hypot(x, (z - zCano)) / rEspelho
      s[3] += luzDoDeitado(t, 0.06) + (longe > 0.8 ? 0.08 : 0)
    }
    if (larg > 0.5) f.fatia(4, z, caixa(-larg, -hh + 0.4, larg, -hh + 0.4 + ESPELHO.grossura * k, Math.min(larg, 0.7)), ferro, fosca(TOM_DO_FERRO * 1.3, noEspelho, 7143))
  }
  f.fechar()

  // ---------- as sombras no chão, já desenhadas para o lado da sombra na tela ----------
  cena.sombras.push(
    { forma: disco(0, 0, rBarriga * 0.86), z: 0, forca: 0.34, suave: 1.8 },
    sombraDoCilindro(0, 0, rBarriga * 0.9, zChapa * 0.9, q, 0.3, 2.2),
    sombraNoAr(caixa(-rCano, -hh + 0.4, rCano, yCano + rCano), zCano, q, 0.22, 2.6),
  )
}
