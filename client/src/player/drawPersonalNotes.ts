import { Container, Graphics, Text } from 'pixi.js'
import { DEFAULT_TEXT_FONT_FAMILY } from '../lib/drawingFactory'
import type { Camera, Viewport } from '../pixi/world'
import type { PersonalNote } from './personalNotes'

/**
 * ANOTAÇÕES PESSOAIS no mapa do jogador, em espaço de TELA (tamanho fixo em
 * qualquer zoom), como as bandeirinhas de destino. Linguagem de minimapa:
 * quadradinho chapado claro com fio preto e o texto ao lado — sem ícone de
 * papel, sem textura. Nota fora da tela não ganha seta na borda: são muitas, e
 * "Minhas notas" no Caderno já leva até cada uma.
 */

/** Cor da nota: clara e quente, distinta do latão da porta e do azul da própria ficha. */
export const PERSONAL_NOTE_COLOR = 0xf2d479
const MARK_SIZE = 8
const OUTLINE = 0x000000
const LABEL_FONT_SIZE = 12
const LABEL_GAP = 6

interface NoteView {
  graphics: Graphics
  label: Text
}

function createLabel(): Text {
  const label = new Text({
    text: '',
    style: {
      fontSize: LABEL_FONT_SIZE,
      fill: PERSONAL_NOTE_COLOR,
      stroke: { color: OUTLINE, width: 3 },
      fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    },
  })
  label.anchor.set(0, 0.5)
  return label
}

/**
 * Pool de views reaproveitadas por posição, nunca destruídas durante a sessão
 * (mesma regra dos sinais: Text destruído antes do primeiro render derruba o
 * Pixi). Devolve quantas notas ficaram à vista.
 */
export function createPersonalNotesRenderer() {
  const pool: NoteView[] = []
  return {
    draw(container: Container, notes: readonly PersonalNote[], camera: Camera, viewport: Viewport): number {
      let used = 0
      for (const note of notes) {
        const sx = note.x * camera.scale + camera.x
        const sy = note.y * camera.scale + camera.y
        if (sx < 0 || sy < 0 || sx > viewport.width || sy > viewport.height) continue
        let view = pool[used]
        if (view === undefined) {
          view = { graphics: new Graphics(), label: createLabel() }
          container.addChild(view.graphics, view.label)
          pool.push(view)
        }
        used += 1
        const { graphics: g, label } = view
        g.clear()
        g.visible = true
        g.rect(sx - MARK_SIZE / 2, sy - MARK_SIZE / 2, MARK_SIZE, MARK_SIZE).fill({ color: PERSONAL_NOTE_COLOR }).stroke({ color: OUTLINE, width: 1.5 })
        label.visible = true
        if (label.text !== note.text) label.text = note.text
        label.position.set(sx + MARK_SIZE / 2 + LABEL_GAP, sy)
      }
      for (let i = used; i < pool.length; i += 1) {
        pool[i].graphics.visible = false
        pool[i].label.visible = false
      }
      return used
    },
  }
}
