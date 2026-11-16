/**
 * MÁQUINA DE ESCREVER de cima com volume (lote L1 de 16/11/2026, necrotério e laboratório; versão ORIGINAL, só a
 * ideia do objeto das referências, sem marca nem desenho de modelo de verdade): a máquina de escritório antiga, de
 * LACA PRETA com o fio dourado na beira. Atrás, o CARRO de níquel com o ROLO de borracha preta e os botões das
 * pontas, a ALAVANCA de voltar o carro à esquerda e a FOLHA de papel com as linhas já batidas; no meio, a CESTA DAS
 * HASTES em meia-lua com os dois CARRETÉIS da fita; na frente, as quatro fileiras de TECLAS redondas (o aro de
 * níquel, o miolo preto e a letra clara) e a BARRA de espaço.
 *
 * A 25% de zoom sobram o bloco preto com a folha clara atrás e o pontilhado das teclas: é o que diz "máquina de
 * escrever".
 *
 * NA 3/4 é MESA POSTA, como os pratos: feita para ficar em cima da escrivaninha ou da mesa, ela sobe até a altura
 * delas. O corpo é um tampo solto sem sombra no chão (`ALTURA_DA_MESA_DA_MAQUINA` mais a altura dela), e a beirada
 * dele (`ESPESSURA_DA_MAQUINA_DE_ESCREVER`, o perfil) é a frente preta; as sombras sobem junto (o perfil pede
 * `alturaSolta: ALTURA_DA_MESA_POSTA` e `sombrasSobem`). Posta no chão, ela fica no ar, como os pratos. Nada lê o
 * giro.
 *
 * Sem material escolhido: a laca, o níquel, a borracha e o papel são fixos.
 */
import { anel, caixa, capsula, dentroDe, elipse, type Forma } from './formas'
import { type MaterialDaPeca } from './motor'
import { G, type MontarMovel } from './contexto'
import { comMeioEm } from './varalDeBandeirinhas'
import { BORRACHA, ESCURO, LACA_PRETA, LATAO, NIQUEL, BRILHO_DO_NIQUEL, PAPEL, PISO_DO_NECROTERIO } from './apoioDoNecroterio'

/**
 * A altura do tampo da mesa em que a máquina fica, em casas: a mesma de `ALTURA_DA_MESA_POSTA` (`tresQuartos.ts`; não
 * importada de lá para não fechar um ciclo quando o perfil importar daqui), e a altura da própria máquina.
 */
export const ALTURA_DA_MESA_DA_MAQUINA = 0.56 * G
export const ESPESSURA_DA_MAQUINA_DE_ESCREVER = 0.1 * G

/** A letra das teclas: o creme do papel, um nada mais escuro. */
const LETRA: MaterialDaPeca = PAPEL
/** As fileiras de teclas: quantas em cada uma, de trás para a frente, e o raio da tecla (px). */
const FILEIRAS = [10, 10, 9, 8] as const
const RAIO_DA_TECLA = 0.95

export const montarMaquinaDeEscrever: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  cena.corDoPiso = PISO_DO_NECROTERIO
  const k = Math.min(hw / 14, hh / 11.2)
  const corpo = caixa(-hw * 0.84, -hh * 0.5, hw * 0.84, hh * 0.96, 2 * k)

  // As sombras de cima (curtas: a máquina é baixa) e o corpo, só para a 3/4: um tampo solto sem sombra no chão.
  cena.sombras.push(
    { forma: caixa(-hw * 0.9, -hh, hw * 0.9, hh, 2), z: 0, suave: 1.2, forca: 0.3 },
    { forma: caixa(-hw * 0.84 + 1.2, -hh * 0.75 + 1, hw * 0.84 + 1.2, hh * 0.96 + 1, 2), z: 0, suave: 1.4, forca: 0.22 },
    { forma: caixa(-hw * 0.84, -hh * 1.1, hw * 0.84, hh * 0.96, 2 * k), z: ALTURA_DA_MESA_DA_MAQUINA + ESPESSURA_DA_MAQUINA_DE_ESCREVER, solta: true, forca: 0 },
  )
  // O que passa da largura do corpo (os botões do rolo e a alavanca) sobe com ele: o meio da caixa vai para dentro.
  const dentro = (forma: Forma, lado: number, y: number): Forma => comMeioEm(forma, lado * hw * 0.7, y)

  const L = cena.partes
  const niquel = (semente: number, tom = 1) => ({ tabua: 0, bisel: 0.5, tom, contorno: 0.26, metal: BRILHO_DO_NIQUEL, semente })

  // A folha de papel atrás do carro, com as linhas batidas (fica no apoio, deitada para trás).
  const folha = caixa(-hw * 0.5, -hh * 1.06, hw * 0.5, -hh * 0.62, 0.3)
  L.push(P(folha, PAPEL, { tabua: 0, bisel: 0.4, contorno: 0.24, semente: 8101 }))
  for (let i = 0; i < 4; i += 1) {
    const y = -hh * 1.0 + i * hh * 0.08
    L.push(P(capsula(-hw * 0.4, y, hw * (i === 3 ? 0.05 : 0.38), y, 0.18 * k), ESCURO, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.45, semente: 8102 }))
  }

  // O corpo de laca preta, a frente das teclas um degrau abaixo e o fio dourado na beira da frente.
  L.push(P(corpo, LACA_PRETA, { tabua: 0, bisel: 1.4 * k, contorno: 0.3, metal: 0.45, semente: 8103 }))
  L.push(P(caixa(-hw * 0.78, hh * 0.04, hw * 0.78, hh * 0.9, 1.4 * k), LACA_PRETA, { tabua: 0, bisel: 0.6, tom: 1.15, contorno: 0.16, metal: 0.4, semente: 8104 }))
  L.push(P(capsula(-hw * 0.74, hh * 0.93, hw * 0.74, hh * 0.93, 0.18 * k), LATAO, { tabua: 0, bisel: 0, contorno: 0, tom: 1.1, alfa: 0.8, semente: 8105 }))

  // A cesta das hastes em meia-lua (aberta para trás), com as hastes finas de níquel, e os dois carretéis da fita.
  const [cx, cy, cr] = [0, -hh * 0.18, hw * 0.42]
  const cesta: Forma = dentroDe(elipse(cx, cy, cr, cr * 0.62), caixa(cx - cr, cy - cr, cx + cr, cy + 0.2))
  L.push(P(cesta, ESCURO, { tabua: 0, bisel: 0.4, contorno: 0.2, recesso: { k: 1, forca: 0.4 }, semente: 8106 }))
  for (let i = 0; i <= 12; i += 1) {
    const a = Math.PI + (i / 12) * Math.PI
    L.push(P(capsula(cx + Math.cos(a) * cr * 0.25, cy + Math.sin(a) * cr * 0.16, cx + Math.cos(a) * cr * 0.9, cy + Math.sin(a) * cr * 0.56, 0.16 * k), NIQUEL, { ...niquel(8107, 0.9), bisel: 0, contorno: 0.1 }))
  }
  for (const lado of [-1, 1]) {
    const [rx, ry] = [lado * hw * 0.62, -hh * 0.22]
    L.push(P(elipse(rx, ry, 2.3 * k, 2.3 * k), NIQUEL, { ...niquel(8108), bisel: 0.9 * k, projeta: { dist: 0.5, forca: 0.26 } }))
    L.push(P(anel(rx, ry, 1.6 * k, 1.6 * k, 0.9 * k, 0.9 * k), BORRACHA, { tabua: 0, bisel: 0.2, tom: 1.2, contorno: 0.1, semente: 8109 }))
    L.push(P(elipse(rx, ry, 0.45 * k, 0.45 * k), NIQUEL, niquel(8110, 1.1)))
  }

  // O carro: o trilho de níquel de ponta a ponta, o rolo preto, os botões das pontas e a alavanca de voltar.
  const yRolo = -hh * 0.62
  L.push(P(caixa(-hw * 0.92, yRolo - 1.9 * k, hw * 0.92, yRolo + 2.1 * k, 0.8), NIQUEL, { ...niquel(8111, 0.92), projeta: { dist: 0.8, forca: 0.3 } }))
  L.push(P(capsula(-hw * 0.78, yRolo, hw * 0.78, yRolo, 1.45 * k), BORRACHA, { eixo: 0, tabua: 0, bisel: 1.1 * k, tom: 1.15, contorno: 0.28, semente: 8112 }))
  for (const lado of [-1, 1]) L.push(P(dentro(elipse(lado * hw * 0.88, yRolo, 1.4 * k, 1.9 * k), lado, yRolo), BORRACHA, { tabua: 0, bisel: 0.7, tom: 1.25, contorno: 0.28, semente: 8113, projeta: { dist: 0.6, forca: 0.26 } }))
  L.push(P(dentro(capsula(-hw * 0.84, yRolo - 0.6, -hw * 1.0, yRolo + 3.6 * k, 0.5 * k), -1, yRolo), NIQUEL, { ...niquel(8114, 1.08), projeta: { dist: 0.7, forca: 0.28 } }))
  L.push(P(dentro(elipse(-hw * 1.0, yRolo + 3.6 * k, 0.9 * k, 0.9 * k), -1, yRolo), BORRACHA, { tabua: 0, bisel: 0.4, tom: 1.2, contorno: 0.26, semente: 8115 }))

  // As teclas: quatro fileiras desencontradas (o aro de níquel, o miolo preto e a letra clara) e a barra de espaço.
  FILEIRAS.forEach((n, j) => {
    const y = hh * (0.17 + j * 0.17)
    const passo = (hw * 1.42) / 10
    const x0 = -((n - 1) * passo) / 2 + (j % 2) * passo * 0.25
    for (let i = 0; i < n; i += 1) {
      const x = x0 + i * passo
      L.push(P(elipse(x, y, RAIO_DA_TECLA * k, RAIO_DA_TECLA * k), NIQUEL, { ...niquel(8120 + j), bisel: 0.25 * k, projeta: { dist: 0.4, forca: 0.24 } }))
      L.push(P(elipse(x, y, RAIO_DA_TECLA * 0.7 * k, RAIO_DA_TECLA * 0.7 * k), LACA_PRETA, { tabua: 0, bisel: 0.2, tom: 1.2, contorno: 0, semente: 8125 }))
      L.push(P(elipse(x, y, 0.24 * k, 0.24 * k), LETRA, { tabua: 0, bisel: 0, contorno: 0, alfa: 0.85, semente: 8126 }))
    }
  })
  L.push(P(capsula(-hw * 0.42, hh * 0.84, hw * 0.42, hh * 0.84, 0.6 * k), NIQUEL, { ...niquel(8127, 1.05), projeta: { dist: 0.4, forca: 0.24 } }))
}
