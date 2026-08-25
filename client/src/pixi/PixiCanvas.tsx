import { useEffect, useRef } from 'react'
import { Application, Container, Graphics } from 'pixi.js'
import { useMapStore } from '../stores/mapStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { panBy, zoomAt, type Camera } from './world'
import { computeVisibleGridLines } from './grid'
import { drawGrid } from './drawGrid'
import { drawWalls } from './drawWalls'
import { drawLights } from './drawLights'
import { drawRegions } from './drawRegions'

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

      const gridGraphics = new Graphics()
      const regionsGraphics = new Graphics()
      const wallsGraphics = new Graphics()
      const lightsGraphics = new Graphics()
      world.addChild(gridGraphics, regionsGraphics, wallsGraphics, lightsGraphics)

      let camera: Camera = useMapStore.getState().camera
      world.position.set(camera.x, camera.y)
      world.scale.set(camera.scale)

      const redrawGrid = () => {
        const { map } = useMapStore.getState()
        if (!map.showGrid) {
          gridGraphics.clear()
          return
        }
        const viewport = {
          left: -camera.x / camera.scale,
          top: -camera.y / camera.scale,
          right: (app.screen.width - camera.x) / camera.scale,
          bottom: (app.screen.height - camera.y) / camera.scale,
        }
        const lines = computeVisibleGridLines(map.grid, viewport)
        drawGrid(gridGraphics, lines, viewport)
      }

      const redrawShapes = () => {
        const { map } = useMapStore.getState()
        drawRegions(regionsGraphics, map.regions)
        drawWalls(wallsGraphics, map.walls)
        drawLights(lightsGraphics, map.lights)
      }

      redrawGrid()
      redrawShapes()
      const unsubscribeGrid = subscribeToGridRedraw(redrawGrid)
      const unsubscribeShapes = subscribeToShapesRedraw(redrawShapes)

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

      return () => {
        unsubscribeGrid()
        unsubscribeShapes()
        el.removeEventListener('wheel', onWheel)
      }
    }

    const cleanupPromise = setup()

    return () => {
      destroyed = true
      void cleanupPromise.then((cleanup) => cleanup?.())
      if (initialized) {
        app.destroy(true, { children: true })
      }
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
