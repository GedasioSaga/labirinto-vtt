import { useEffect, useRef } from 'react'
import { Application, Container, Graphics, Sprite, Texture, Assets } from 'pixi.js'
import { convertFileSrc } from '@tauri-apps/api/core'
import { useMapStore } from '../stores/mapStore'
import { subscribeToGridRedraw } from '../stores/gridSubscription'
import { subscribeToShapesRedraw } from '../stores/shapesSubscription'
import { subscribeToTokensRedraw } from '../stores/tokensSubscription'
import { subscribeToBackgroundRedraw } from '../stores/backgroundSubscription'
import { panBy, zoomAt, type Camera } from './world'
import { computeVisibleGridLines } from './grid'
import { drawGrid } from './drawGrid'
import { drawWalls } from './drawWalls'
import { drawLights } from './drawLights'
import { drawRegions } from './drawRegions'
import { drawTokens } from './drawTokens'
import { findTokenAt, snapToGrid } from './tokenInteraction'

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

      const backgroundSprite = new Sprite(Texture.EMPTY)
      const gridGraphics = new Graphics()
      const regionsGraphics = new Graphics()
      const wallsGraphics = new Graphics()
      const lightsGraphics = new Graphics()
      const tokensContainer = new Container()
      world.addChild(backgroundSprite, gridGraphics, regionsGraphics, wallsGraphics, lightsGraphics, tokensContainer)

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
        drawGrid(gridGraphics, computeVisibleGridLines(map.grid, viewport), viewport)
      }

      const redrawShapes = () => {
        const { map } = useMapStore.getState()
        drawRegions(regionsGraphics, map.regions)
        drawWalls(wallsGraphics, map.walls)
        drawLights(lightsGraphics, map.lights)
      }

      const redrawTokens = () => {
        const { map, selectedTokenId } = useMapStore.getState()
        drawTokens(tokensContainer, map.tokens, map.grid, selectedTokenId)
      }

      let backgroundLoadToken = 0

      const redrawBackground = async () => {
        const { map } = useMapStore.getState()
        const loadToken = (backgroundLoadToken += 1)

        if (map.background.type !== 'image' || !map.background.src) {
          backgroundSprite.texture = Texture.EMPTY
          return
        }

        try {
          const url = convertFileSrc(map.background.src)
          const texture = await Assets.load(url)
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = texture
        } catch {
          if (loadToken !== backgroundLoadToken) return
          backgroundSprite.texture = Texture.EMPTY
        }
      }

      redrawGrid()
      redrawShapes()
      redrawTokens()
      void redrawBackground()
      const unsubscribeGrid = subscribeToGridRedraw(redrawGrid)
      const unsubscribeShapes = subscribeToShapesRedraw(redrawShapes)
      const unsubscribeTokens = subscribeToTokensRedraw(redrawTokens)
      const unsubscribeBackground = subscribeToBackgroundRedraw(() => {
        void redrawBackground()
      })

      let mode: 'idle' | 'panning' | 'dragging-token' = 'idle'
      let lastPoint = { x: 0, y: 0 }
      let draggingTokenId: string | null = null

      const toWorldPoint = (globalX: number, globalY: number) => ({
        x: (globalX - camera.x) / camera.scale,
        y: (globalY - camera.y) / camera.scale,
      })

      app.stage.on('pointerdown', (event) => {
        const worldPoint = toWorldPoint(event.global.x, event.global.y)
        const { map, setSelectedTokenId } = useMapStore.getState()
        const hit = findTokenAt(map.tokens, worldPoint, map.grid)

        if (hit) {
          mode = 'dragging-token'
          draggingTokenId = hit.id
          setSelectedTokenId(hit.id)
        } else {
          mode = 'panning'
          setSelectedTokenId(null)
        }
        lastPoint = { x: event.global.x, y: event.global.y }
      })

      app.stage.on('pointerup', () => {
        mode = 'idle'
        draggingTokenId = null
      })
      app.stage.on('pointerupoutside', () => {
        mode = 'idle'
        draggingTokenId = null
      })

      app.stage.on('pointermove', (event) => {
        if (mode === 'panning') {
          const dx = event.global.x - lastPoint.x
          const dy = event.global.y - lastPoint.y
          lastPoint = { x: event.global.x, y: event.global.y }
          camera = panBy(camera, dx, dy)
          world.position.set(camera.x, camera.y)
          useMapStore.getState().setCamera(camera)
        } else if (mode === 'dragging-token' && draggingTokenId) {
          const worldPoint = toWorldPoint(event.global.x, event.global.y)
          const { map, moveToken } = useMapStore.getState()
          const snapped = snapToGrid(worldPoint.x, worldPoint.y, map.grid)
          moveToken(draggingTokenId, snapped.x, snapped.y)
        }
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
        unsubscribeTokens()
        unsubscribeBackground()
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
