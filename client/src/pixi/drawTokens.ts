import { Container, Graphics, Text } from 'pixi.js'
import type { Token } from '../types/map'

export function drawTokens(container: Container, tokens: Token[], gridSize: number, selectedId: string | null): void {
  container.removeChildren()
  for (const token of tokens) {
    const radius = (gridSize * token.size) / 2 - 2

    const circle = new Graphics()
      .circle(0, 0, radius)
      .fill({ color: 0x5a8fd6 })
      .stroke({ width: selectedId === token.id ? 4 : 2, color: selectedId === token.id ? 0xffdd55 : 0x1a1a1a })
    circle.position.set(token.x, token.y)

    const label = new Text({ text: token.name, style: { fontSize: 12, fill: 0xffffff } })
    label.anchor.set(0.5, 0)
    label.position.set(token.x, token.y + radius + 2)

    container.addChild(circle)
    container.addChild(label)
  }
}
