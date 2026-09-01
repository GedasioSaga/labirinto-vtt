import { describe, expect, it } from 'vitest'
import { resolveWheel } from './wheelGesture'

const base = { deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, shiftKey: false }

describe('resolveWheel', () => {
  it('roda vertical simples (modo pixel, trackpad) vira pan, sem transformar em zoom', () => {
    const result = resolveWheel({ ...base, deltaY: 100 })
    expect(result).toEqual({ kind: 'pan', dx: 0, dy: 100 })
  })

  it('trackpad com deltaX próprio (pinça de dois dedos horizontal) preserva os dois eixos', () => {
    const result = resolveWheel({ ...base, deltaX: 30, deltaY: -20 })
    expect(result).toEqual({ kind: 'pan', dx: 30, dy: -20 })
  })

  it('ctrlKey vira zoom, mesmo com deltaX presente (deltaX é ignorado no zoom)', () => {
    const result = resolveWheel({ ...base, deltaX: 5, deltaY: 100, ctrlKey: true })
    expect(result).toEqual({ kind: 'zoom', deltaY: 100 })
  })

  it('shiftKey sem deltaX nativo (mouse de roda tradicional) redireciona deltaY pro pan horizontal', () => {
    const result = resolveWheel({ ...base, deltaY: 100, shiftKey: true })
    expect(result).toEqual({ kind: 'pan', dx: 100, dy: 0 })
  })

  it('shiftKey com deltaX já presente (trackpad) não rouba o eixo vertical do dispositivo', () => {
    const result = resolveWheel({ ...base, deltaX: 15, deltaY: 100, shiftKey: true })
    expect(result).toEqual({ kind: 'pan', dx: 15, dy: 100 })
  })

  it('ctrlKey tem prioridade sobre shiftKey (não deveria ocorrer junto, mas zoom vence)', () => {
    const result = resolveWheel({ ...base, deltaY: 100, ctrlKey: true, shiftKey: true })
    expect(result.kind).toBe('zoom')
  })

  it('deltaMode linha (mouse de roda tradicional) normaliza para pixel: 3 linhas por notch vira pan perceptível', () => {
    const result = resolveWheel({ ...base, deltaY: 3, deltaMode: 1 })
    expect(result).toEqual({ kind: 'pan', dx: 0, dy: 120 })
  })

  it('deltaMode página normaliza numa escala bem maior que linha', () => {
    const result = resolveWheel({ ...base, deltaY: 1, deltaMode: 2 })
    expect(result).toEqual({ kind: 'pan', dx: 0, dy: 800 })
  })

  it('deltaMode linha também normaliza o eixo X (relevante pro caso shiftKey de trackpad)', () => {
    const result = resolveWheel({ ...base, deltaX: 2, deltaY: 0, deltaMode: 1 })
    expect(result).toEqual({ kind: 'pan', dx: 80, dy: 0 })
  })

  it('deltaY zero e ctrlKey: zoom com deltaY 0 (chamador decide se ignora no-op)', () => {
    const result = resolveWheel({ ...base, deltaY: 0, ctrlKey: true })
    expect(result).toEqual({ kind: 'zoom', deltaY: 0 })
  })
})
