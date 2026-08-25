import { useEffect, useRef } from 'react'
import { Application, Container } from 'pixi.js'
import { useMapStore } from '../stores/mapStore'
import { panBy, zoomAt, type Camera } from './world'

export function PixiCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let destroyed = false
    let initialized = false
    const app = new Application()

    const setup = async () => {
      await app.init({ backgroundColor: 0x2b2b2b, resizeTo: el })
      if (destroyed) {
        app.destroy(true, { children: true })
        return
      }
      initialized = true
      el.appendChild(app.canvas)

      const world = new Container()
      app.stage.addChild(world)
      app.stage.eventMode = 'static'
      app.stage.hitArea = app.screen

      let camera: Camera = useMapStore.getState().camera
      world.position.set(camera.x, camera.y)
      world.scale.set(camera.scale)

      let dragging = false
      let lastPoint = { x: 0, y: 0 }

      app.stage.on('pointerdown', (event) => {
        dragging = true
        lastPoint = { x: event.global.x, y: event.global.y }
      })
      app.stage.on('pointerup', () => {
        dragging = false
      })
      app.stage.on('pointerupoutside', () => {
        dragging = false
      })
      app.stage.on('pointermove', (event) => {
        if (!dragging) return
        const dx = event.global.x - lastPoint.x
        const dy = event.global.y - lastPoint.y
        lastPoint = { x: event.global.x, y: event.global.y }
        camera = panBy(camera, dx, dy)
        world.position.set(camera.x, camera.y)
        useMapStore.getState().setCamera(camera)
      })

      const onWheel = (event: WheelEvent) => {
        event.preventDefault()
        const rect = el.getBoundingClientRect()
        const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        camera = zoomAt(camera, pointer, event.deltaY)
        world.position.set(camera.x, camera.y)
        world.scale.set(camera.scale)
        useMapStore.getState().setCamera(camera)
      }
      el.addEventListener('wheel', onWheel, { passive: false })
    }

    void setup()

    return () => {
      destroyed = true
      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
