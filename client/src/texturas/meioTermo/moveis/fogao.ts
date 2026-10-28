/**
 * FOGÃO de ferro a lenha de cima com volume (móveis de casa, 28/10/2026). A
 * frente é o lado de baixo, como no armário: o corpo de ferro escuro, a CHAPA
 * por cima com as duas bocas tampadas, a barra de latão na beira da frente e,
 * abaixo dela, a portinha da lenha com a fresta da brasa acesa. No fundo, à
 * direita, o cano que sobe para a parede faz a sombra comprida. A 25% de zoom
 * sobram o quadrado escuro, os dois pontos das bocas e o risco quente da
 * brasa: é o que diz "fogão" e não "caixa". Materiais: `metal` e `puxadores`.
 */
import { anel, caixa, elipse } from './formas'
import { contato, type MaterialDaPeca, type Textura } from './motor'
import { BURACO, type MontarMovel } from './contexto'

/** Altura do fogão (a chapa) e a do cano, em casas. */
const ALTURA = 0.75
const ALTURA_DO_CANO = 1.2
/** A brasa: o laranja do fogo do Meio-Termo (#e39446), mais claro no meio da fresta. */
const BRASA: MaterialDaPeca = { classe: 'liso', rgb: [0xe3, 0x94, 0x46] }
const MIOLO_DA_BRASA: readonly [number, number, number] = [0xf0, 0xc0, 0x78]
/** A parte da cor da brasa que não pega luz nem sombra (como o vidro do lampião). */
const EMISSAO_DA_BRASA = 0.6

/** A fresta da brasa: o miolo claro no meio, caindo para o laranja nas pontas. */
function texBrasa(meiaLargura: number): Textura {
  return (_u, _v, x, _y, _p, s) => {
    const t = Math.max(0, 1 - Math.abs(x) / meiaLargura) ** 1.5
    s[0] = BRASA.rgb[0] + (MIOLO_DA_BRASA[0] - BRASA.rgb[0]) * t
    s[1] = BRASA.rgb[1] + (MIOLO_DA_BRASA[1] - BRASA.rgb[1]) * t
    s[2] = BRASA.rgb[2] + (MIOLO_DA_BRASA[2] - BRASA.rgb[2]) * t
    s[4] = EMISSAO_DA_BRASA
  }
}

export const montarFogao: MontarMovel = (c, cena) => {
  const { hw, hh, w, h, peca: P } = c
  const ferro = c.m.metal
  const latao = c.m.puxadores
  const R = Math.min(w, h)
  const corpo = caixa(-hw, -hh, hw, hh, 0.07 * R)
  // O cano no fundo, à direita: o que sobe para a parede.
  const rCano = 0.1 * R
  const xCano = hw - 0.22 * w
  const yCano = -hh + 0.15 * h
  const cano = elipse(xCano, yCano, rCano, rCano)
  cena.sombras.push({ forma: corpo, z: c.g * ALTURA }, contato(corpo), { forma: cano, z: c.g * ALTURA_DO_CANO, forca: 0.24 })
  const L = cena.partes
  L.push(P(corpo, ferro, { tabua: 0, bisel: 1.4, tom: 0.84, semente: 601 }))
  // A chapa: um pouco para dentro do corpo, mais clara, até a barra da frente.
  const beira = 0.06 * R
  const fimDaChapa = hh - 0.24 * h
  L.push(P(caixa(-hw + beira, -hh + beira, hw - beira, fimDaChapa, 0.05 * R), ferro, { tabua: 0, bisel: 1.1, semente: 602 }))
  // As duas bocas: o sulco escuro em volta e a tampa redonda com o pegador no meio.
  const rBoca = 0.15 * R
  const yBoca = -hh + 0.42 * h
  for (const sx of [-1, 1]) {
    const xBoca = sx * 0.22 * w
    L.push(P(anel(xBoca, yBoca, rBoca + 1, rBoca + 1, rBoca - 0.4, rBoca - 0.4), ferro, { tabua: 0, bisel: 0.5, tom: 0.58, contorno: 0, semente: 603 }))
    L.push(P(elipse(xBoca, yBoca, rBoca - 0.4, rBoca - 0.4), ferro, { tabua: 0, bisel: rBoca * 0.35, luz: 0.04, semente: 604 }))
    L.push(P(elipse(xBoca, yBoca, 0.03 * R, 0.03 * R), latao, { tabua: 0, bisel: 0.8, contorno: 0.15, projeta: { dist: 0.6, forca: 0.25 } }))
  }
  // A barra de latão na beira da chapa: onde se pendura o pano.
  L.push(P(caixa(-hw + beira * 1.4, fimDaChapa - 0.9, hw - beira * 1.4, fimDaChapa + 0.9, 0.9), latao, { tabua: 0, bisel: 0.8, contorno: 0.2, projeta: { dist: 1, forca: 0.3 } }))
  // A portinha da lenha e a fresta da brasa.
  const meiaPorta = 0.27 * w
  const yPorta = hh - 0.12 * h
  L.push(P(caixa(-meiaPorta, yPorta - 0.075 * h, meiaPorta, yPorta + 0.075 * h, 1), ferro, { tabua: 0, bisel: 0.9, tom: 0.74, semente: 605 }))
  const meiaFresta = 0.19 * w
  L.push(P(caixa(-meiaFresta, yPorta - 0.025 * h, meiaFresta, yPorta + 0.025 * h, 0.8), BRASA, { bisel: 0.3, contorno: 0.1, textura: texBrasa(meiaFresta), semente: 606 }))
  // O cano visto de cima é a boca dele: a parede de ferro e o escuro de dentro (cheio, lia como um botão).
  L.push(P(cano, ferro, { tabua: 0, bisel: 1, semente: 608 }))
  L.push(P(elipse(xCano, yCano, rCano * 0.58, rCano * 0.58), BURACO, { bisel: 0.4, contorno: 0.1, recesso: { k: 1, forca: 0.3 } }))
}
