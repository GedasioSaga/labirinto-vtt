import { Container, Graphics, Text } from 'pixi.js'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import { measureDistance } from '../lib/measurement'
import { centroDaCasa, type Casa } from '../lib/batalha/blocos'
import { lerMedida, rotuloParaOMestre, type GradeDoMapa } from '../lib/batalha/ferramentasDoJogador'
import { PASSO_DA_DIRECAO } from '../lib/batalha/medicao'
import type { MedidaNaMesa } from '../stores/medidasDosJogadoresStore'
import type { MapData } from '../types/map'
import type { Camera, Point } from './world'

/**
 * COMPARTILHAR COM O MESTRE (B6): a medida de cada jogador na tela do mestre,
 * na cor da ficha dele e com o nome ("Lia: 6 blocos"). Discreta de propósito:
 * traço fino, casas quase transparentes, sem receber toque — o mestre segue
 * editando por cima. Em espaço de TELA (acima do `world`), como o laser dos
 * jogadores: espessura e letra do mesmo tamanho em qualquer zoom.
 *
 * Um Graphics e um Text por jogador, criados uma vez e nunca destruídos
 * durante a sessão (Text destruído antes do primeiro render derruba o Pixi
 * 8.20, ver `drawLaser.ts`); quem saiu só fica escondido.
 */

/** Cor de reserva quando a cor que veio não é `#rrggbb` (a do latão do painel). */
const COR_DE_RESERVA = 0xe0a44a
const FUNDO_DA_CASA_ALPHA = 0.16
const BORDA_ALPHA = 0.6
const LINHA_ALPHA = 0.85
const LINHA_LARGURA = 1.5
const VEU = 0x111111
const VEU_ALPHA = 0.35
const VEU_LARGURA = 3.5
const PONTA_RAIO = 3
const ROTULO_DESLOCAMENTO_PX = 10

function corDoJogador(cor: string): number {
  return /^#[0-9a-f]{6}$/i.test(cor) ? Number.parseInt(cor.slice(1), 16) : COR_DE_RESERVA
}

function naTela(camera: Camera, p: Point): Point {
  return { x: p.x * camera.scale + camera.x, y: p.y * camera.scale + camera.y }
}

function pintarCasas(g: Graphics, casas: readonly Casa[], grid: number, camera: Camera, cor: number): void {
  const lado = grid * camera.scale
  for (const casa of casas) {
    const canto = naTela(camera, { x: casa.col * grid, y: casa.row * grid })
    g.rect(canto.x, canto.y, lado, lado)
  }
  if (casas.length === 0) return
  g.fill({ color: cor, alpha: FUNDO_DA_CASA_ALPHA })
  g.stroke({ width: 1, color: cor, alpha: BORDA_ALPHA })
}

function linha(g: Graphics, de: Point, ate: Point, cor: number): void {
  g.moveTo(de.x, de.y).lineTo(ate.x, ate.y).stroke({ width: VEU_LARGURA, color: VEU, alpha: VEU_ALPHA, cap: 'round' })
  g.moveTo(de.x, de.y).lineTo(ate.x, ate.y).stroke({ width: LINHA_LARGURA, color: cor, alpha: LINHA_ALPHA, cap: 'round' })
  g.circle(de.x, de.y, PONTA_RAIO).fill({ color: cor, alpha: LINHA_ALPHA })
  g.circle(ate.x, ate.y, PONTA_RAIO + 1).stroke({ width: LINHA_LARGURA, color: cor, alpha: LINHA_ALPHA })
}

/** Desenha a forma e devolve onde o rótulo mora (px de tela). */
function desenharForma(g: Graphics, m: MedidaNaMesa, grade: GradeDoMapa, camera: Camera, cor: number): Point {
  const medida = m.medida
  const { grid } = grade
  if (medida.ferramenta === 'regua') {
    if (m.emBatalha) pintarCasas(g, lerMedida(medida, grade, []).casas, grid, camera, cor)
    const ate = naTela(camera, medida.ate)
    linha(g, naTela(camera, medida.de), ate, cor)
    return ate
  }
  if (medida.ferramenta === 'visao') {
    const ate = naTela(camera, centroDaCasa(medida.para, grid))
    linha(g, naTela(camera, centroDaCasa(medida.de, grid)), ate, cor)
    return ate
  }
  const leitura = lerMedida(medida, grade, [])
  pintarCasas(g, leitura.casas, grid, camera, cor)
  const origem = medida.ferramenta === 'circulo' ? medida.centro : medida.origem
  const centro = naTela(camera, centroDaCasa(origem, grid))
  g.circle(centro.x, centro.y, PONTA_RAIO).fill({ color: cor, alpha: LINHA_ALPHA })
  if (medida.ferramenta === 'cone') {
    const [ux, uy] = PASSO_DA_DIRECAO[medida.direcao]
    const ponta = naTela(camera, centroDaCasa({ col: medida.origem.col + ux * medida.comprimento, row: medida.origem.row + uy * medida.comprimento }, grid))
    g.moveTo(centro.x, centro.y).lineTo(ponta.x, ponta.y).stroke({ width: 1, color: cor, alpha: BORDA_ALPHA })
  }
  return naTela(camera, leitura.ancora)
}

/** O rótulo fora da batalha é o do Medir do mapa ("15 ft", "3 quadrados"); em batalha, os blocos. */
function rotuloDaMedida(m: MedidaNaMesa, map: MapData, grade: GradeDoMapa): string {
  const medida = m.medida
  const foraDaBatalha =
    medida.ferramenta === 'regua' && !m.emBatalha ? measureDistance(medida.de, medida.ate, map.grid, map.gridShape, map.measurementMode, map.scale).label : null
  return rotuloParaOMestre(m.name, medida, grade, foraDaBatalha)
}

/** O chip do rótulo, como o "4 blocos" do jogador: fundo escuro, borda e pontinho na cor dele. */
const CHIP_FUNDO = 0x15120f
const CHIP_FUNDO_ALPHA = 0.92
const CHIP_BORDA_ALPHA = 0.9
const CHIP_PADDING_X = 7
const CHIP_PADDING_Y = 3
const CHIP_RAIO = 6
const PONTINHO_RAIO = 3.5
const PONTINHO_ESPACO = 6

interface Peca {
  g: Graphics
  /** Fundo do rótulo (chip); atrás do texto. */
  chip: Graphics
  rotulo: Text
  chave: string | null
}

/** Desenha o chip atrás de `rotulo` e põe o texto dentro, com o canto inferior esquerdo em `ancora` deslocada. */
function desenharChip(chip: Graphics, rotulo: Text, ancora: Point, cor: number): void {
  const recuo = CHIP_PADDING_X + PONTINHO_RAIO * 2 + PONTINHO_ESPACO
  const largura = Math.ceil(rotulo.width) + recuo + CHIP_PADDING_X
  const altura = Math.ceil(rotulo.height) + CHIP_PADDING_Y * 2
  const x = Math.round(ancora.x + ROTULO_DESLOCAMENTO_PX)
  const y = Math.round(ancora.y - ROTULO_DESLOCAMENTO_PX - altura)
  chip.clear()
  chip.roundRect(x, y, largura, altura, CHIP_RAIO).fill({ color: CHIP_FUNDO, alpha: CHIP_FUNDO_ALPHA })
  chip.roundRect(x + 0.5, y + 0.5, largura - 1, altura - 1, CHIP_RAIO).stroke({ width: 1, color: cor, alpha: CHIP_BORDA_ALPHA })
  chip.circle(x + CHIP_PADDING_X + PONTINHO_RAIO, y + altura / 2, PONTINHO_RAIO).fill({ color: cor })
  chip.visible = true
  rotulo.position.set(x + recuo, y + CHIP_PADDING_Y)
}

export function createMedidasDosJogadoresRenderer() {
  const pecas = new Map<string, Peca>()

  return {
    /** Desenha as medidas do mapa aberto e devolve quantas apareceram. */
    draw(container: Container, medidas: readonly MedidaNaMesa[], map: MapData, camera: Camera): number {
      const presentes = new Set<string>()
      const grade: GradeDoMapa = { colunas: map.width, linhas: map.height, grid: map.grid }
      for (const m of medidas) {
        // Medida de outra cena: os números são de outro mapa.
        if (m.mapId !== map.id) continue
        presentes.add(m.playerId)
        let peca = pecas.get(m.playerId)
        if (peca === undefined) {
          const g = new Graphics()
          g.eventMode = 'none'
          const rotulo = new Text({
            text: '',
            style: { fontFamily: DEFAULT_TEXT_FONT_FAMILY, fontSize: 12, fontWeight: '600', fill: 0xf2ede4 },
          })
          rotulo.eventMode = 'none'
          const chip = new Graphics()
          chip.eventMode = 'none'
          container.addChild(g, chip, rotulo)
          peca = { g, chip, rotulo, chave: null }
          pecas.set(m.playerId, peca)
        }
        const chave = JSON.stringify([m.medida, m.color, m.name, m.emBatalha, camera.x, camera.y, camera.scale, map.grid])
        if (chave === peca.chave) continue
        peca.chave = chave
        const cor = corDoJogador(m.color)
        peca.g.clear()
        const ancora = desenharForma(peca.g, m, grade, camera, cor)
        peca.rotulo.text = rotuloDaMedida(m, map, grade)
        desenharChip(peca.chip, peca.rotulo, ancora, cor)
        peca.rotulo.visible = true
      }
      for (const [playerId, peca] of pecas) {
        if (presentes.has(playerId) || peca.chave === null) continue
        peca.chave = null
        peca.g.clear()
        peca.chip.clear()
        peca.chip.visible = false
        peca.rotulo.visible = false
      }
      return presentes.size
    },
  }
}
