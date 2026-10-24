/**
 * PLACA DE SETA de cima com volume (peça nova da MT5): desenho original
 * inspirado na placa de seta do Estilo Mother da vila (`docs/design/
 * vila-estilo-mother/prototipo/mother.js`, `placa`): a tábua em forma de seta
 * pregada no alto de um poste. Material: `madeira`.
 *
 * Forma da revisão de design da MT5 (a 1x o pentágono lia como etiqueta e o
 * sulco com o prego como "sinal de menos"): o corpo estreito (±0,36 da meia
 * altura) com a cauda em RABO DE ANDORINHA (entalhe até -0,72 da meia largura),
 * a cabeça larga (±0,80) até a ponta em 0,95, e só o prego, sem sulco. Na
 * pegada de meia casa ela fica com ~20 px de altura de cabeça a 1x.
 *
 * O GIRO É PINTADO, não aplicado na imagem pronta: a seta aponta para a
 * DIREITA do objeto girado (`giro`, em quartos de volta, entra na chave da
 * imagem) e a sombra e a luz ficam onde estão em todo o mapa (para baixo à
 * direita, luz de cima à esquerda). Girar a imagem pronta levava a sombra
 * junto: a 90° ela caía para baixo à esquerda, a 180° a luz vinha de baixo.
 */
import { elipse, poligono, type Ponto } from './formas'
import { contato } from './motor'
import { PREGO, tomLongeDoChao, type MontarMovel } from './contexto'

/** Altura da seta em casas (a sombra cai longe: ela fica no alto do poste). */
const ALTURA_DA_SETA = 0.75

export const montarPlacaDeSeta: MontarMovel = (c, cena) => {
  const { hw, hh, peca: P } = c
  // O giro em quartos de volta (0, 90, 180 ou 270): x da seta vira (cos, sen), como o giro do objeto na tela.
  const rad = (c.giro * Math.PI) / 180
  const cos = Math.round(Math.cos(rad))
  const sen = Math.round(Math.sin(rad))
  const girar = ([x, y]: Ponto): Ponto => [x * cos - y * sen, x * sen + y * cos]
  const seta = poligono(
    (
      [
        [-0.92 * hw, -0.36 * hh],
        [0.15 * hw, -0.36 * hh],
        [0.15 * hw, -0.8 * hh],
        [0.95 * hw, 0],
        [0.15 * hw, 0.8 * hh],
        [0.15 * hw, 0.36 * hh],
        [-0.92 * hw, 0.36 * hh],
        [-0.72 * hw, 0],
      ] as const
    ).map(girar),
  )
  const [px, py] = girar([-0.35 * hw, 0])
  const poste = Math.min(hw, hh) * 0.2
  cena.sombras.push({ forma: seta, z: c.g * ALTURA_DA_SETA, forca: 0.3, solta: true })
  cena.sombras.push({ forma: elipse(px, py, poste, poste), z: c.g * ALTURA_DA_SETA }, contato(elipse(px, py, poste, poste), 0.3))
  cena.partes.push(P(seta, c.m.madeira, { eixo: c.giro === 90 || c.giro === 270 ? Math.PI / 2 : 0, tabua: 0, bisel: 1.6, contorno: 0.26, tom: tomLongeDoChao(c.m.madeira, 0.2), semente: 10 }))
  // O prego que segura a tábua no poste.
  const prego = Math.max(0.9, 0.11 * Math.min(hw, hh))
  cena.partes.push(P(elipse(px, py, prego, prego), PREGO, { bisel: prego * 0.7, contorno: 0.2, semente: 12 }))
}
