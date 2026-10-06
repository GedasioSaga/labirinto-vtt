import type * as Three from 'three'
import type { ThreeModule } from './tipos'

/** Gerador pseudoaleatório com semente: a textura sai igual toda vez (miniatura estável). */
export function semente(seed: number): () => number {
  let s = seed
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

function tela(largura: number, altura: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas')
  canvas.width = largura
  canvas.height = altura
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2D indisponível')
  return [canvas, ctx]
}

/** Veio de madeira. `vertical` = fibras de cima a baixo (porta); senão, de lado (degrau). */
export function texturaDeMadeira(THREE: ThreeModule, largura: number, altura: number, base: string, escuro: string, seed: number, vertical = true): Three.CanvasTexture {
  const [canvas, g] = tela(largura, altura)
  const rnd = semente(seed)
  g.fillStyle = base
  g.fillRect(0, 0, largura, altura)
  for (let i = 0; i < 240; i++) {
    const pos = rnd() * (vertical ? largura : altura)
    const onda = 2 + rnd() * 6
    g.strokeStyle = escuro
    g.globalAlpha = 0.05 + rnd() * 0.18
    g.lineWidth = 0.5 + rnd() * 2.2
    g.beginPath()
    const fim = vertical ? altura : largura
    for (let k = 0; k <= fim; k += 8) {
      const desvio = pos + Math.sin(k / (30 + onda * 9) + i) * onda
      const [x, y] = vertical ? [desvio, k] : [k, desvio]
      if (k === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  if (vertical) {
    for (let n = 0; n < 4; n++) {
      const cx = rnd() * largura
      const cy = rnd() * altura
      for (let r = 3; r < 16; r += 2.5) {
        g.globalAlpha = 0.12
        g.lineWidth = 1
        g.beginPath()
        g.ellipse(cx, cy, r * 0.6, r * 1.6, 0, 0, Math.PI * 2)
        g.stroke()
      }
    }
  }
  g.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.anisotropy = 4
  return tex
}

/** Reboco manchado de umidade. */
export function texturaDeReboco(THREE: ThreeModule, base: string, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(256, 256)
  const rnd = semente(seed)
  g.fillStyle = base
  g.fillRect(0, 0, 256, 256)
  const img = g.getImageData(0, 0, 256, 256)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 22
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  for (let k = 0; k < 14; k++) {
    const x = rnd() * 256
    const y = rnd() * 256
    const grd = g.createRadialGradient(x, y, 0, x, y, 60 + rnd() * 60)
    grd.addColorStop(0, 'rgba(10,8,5,0.35)')
    grd.addColorStop(1, 'rgba(10,8,5,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 256, 256)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Pedra/concreto gasto, com manchas e rachaduras finas. */
export function texturaDePedra(THREE: ThreeModule, base: string, seed: number): Three.CanvasTexture {
  const [canvas, g] = tela(512, 128)
  const rnd = semente(seed)
  g.fillStyle = base
  g.fillRect(0, 0, 512, 128)
  const img = g.getImageData(0, 0, 512, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rnd() - 0.5) * 26
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  for (let k = 0; k < 30; k++) {
    const x = rnd() * 512
    const y = rnd() * 128
    const r = 10 + rnd() * 60
    const grd = g.createRadialGradient(x, y, 0, x, y, r)
    const escuro = rnd() > 0.4
    grd.addColorStop(0, escuro ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.05)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 128)
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)'
  g.lineWidth = 1
  for (let k = 0; k < 5; k++) {
    let x = rnd() * 512
    let y = rnd() * 128
    g.beginPath()
    g.moveTo(x, y)
    for (let s = 0; s < 8; s++) {
      x += (rnd() - 0.3) * 22
      y += (rnd() - 0.5) * 10
      g.lineTo(x, y)
    }
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Libera geometrias, materiais e texturas de uma cena inteira. */
export function descartarCena(scene: Three.Scene): void {
  scene.traverse((obj) => {
    const malha = obj as Three.Mesh
    if (malha.geometry) malha.geometry.dispose()
    const materiais = Array.isArray(malha.material) ? malha.material : malha.material ? [malha.material] : []
    for (const material of materiais) {
      const comMapa = material as Three.MeshStandardMaterial
      comMapa.map?.dispose()
      material.dispose()
    }
  })
}
