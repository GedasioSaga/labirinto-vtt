import { expect, type Page } from '@playwright/test'

/**
 * O APP DO MESTRE no navegador, em modo Tauri de mentira: `window.isTauri`
 * ligado e um `__TAURI_INTERNALS__` com disco em memória (os arquivos dados)
 * e `net_start_room` respondendo com `codigo`. É o que liga a coluna da
 * direita (Jogo, Chat, Cenas), o "Abrir sala" e a aventura com várias cenas,
 * que no modo navegador puro não aparecem.
 *
 * Mesmo transporte de `task-controle-de-som.spec.ts`, num lugar só para os
 * specs que precisam da tela inteira do mestre (ex. `ui-onde-foi-parar`).
 */
export async function abrirAventuraDeMentira(page: Page, arquivos: Record<string, string>, nomeDaAventura: string, codigo: string): Promise<void> {
  await page.addInitScript(
    ({ arquivos, codigo }: { arquivos: Record<string, string>; codigo: string }) => {
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas))
      const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null ? Object.fromEntries(Object.entries(valor)) : {})
      let proximoId = 0
      const janela = window as unknown as Record<string, unknown>
      // Os ouvintes de evento (`net:message`, `net:peer`) guardados, para o spec fazer jogador entrar e cair.
      type Ouvinte = (evento: { event: string; id: number; payload: unknown }) => void
      const callbacks = new Map<number, Ouvinte>()
      const ouvintes = new Map<number, { event: string; handler: Ouvinte }>()
      janela.__emitTauri = (event: string, payload: unknown) => {
        for (const [id, ouvinte] of ouvintes) if (ouvinte.event === event) ouvinte.handler({ event, id, payload })
      }
      janela.isTauri = true
      janela.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: (cb: Ouvinte) => {
          proximoId += 1
          callbacks.set(proximoId, cb)
          return proximoId
        },
        invoke: async (cmd: string, args: unknown, options?: { headers?: Record<string, string> }) => {
          const a = campos(args)
          switch (cmd) {
            case 'net_start_room':
              return { code: codigo, urls: ['http://192.168.0.7:1420/player.html'], qrSvg: '<svg xmlns="http://www.w3.org/2000/svg"></svg>' }
            case 'plugin:event|listen': {
              const id = Number(a.handler)
              const cb = callbacks.get(id)
              if (cb !== undefined) ouvintes.set(id, { event: String(a.event), handler: cb })
              return id
            }
            case 'plugin:event|unlisten':
              ouvintes.delete(Number(a.eventId))
              return null
            case 'plugin:path|resolve_directory':
              return 'C:/appdata'
            case 'plugin:path|join':
              return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
            case 'plugin:path|dirname': {
              const p = String(a.path)
              return p.slice(0, Math.max(0, p.lastIndexOf('/')))
            }
            case 'plugin:fs|exists': {
              const c = semBarraFinal(String(a.path))
              return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
            }
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              if (args instanceof Uint8Array) textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args)
              return null
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:fs|read_dir': {
              const prefixo = `${semBarraFinal(String(a.path))}/`
              const filhos = new Map<string, boolean>()
              for (const p of todos()) {
                if (p.indexOf(prefixo) !== 0) continue
                const resto = p.slice(prefixo.length)
                if (resto.length === 0) continue
                const corte = resto.indexOf('/')
                const nome = corte === -1 ? resto : resto.slice(0, corte)
                filhos.set(nome, (filhos.get(nome) ?? false) || corte !== -1 || pastas.has(p))
              }
              return Array.from(filhos.entries()).map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }))
            }
            default:
              return null
          }
        },
      }
    },
    { arquivos, codigo },
  )
  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(nomeDaAventura) }).click()
  await page.waitForSelector('canvas')
  await expect(page.getByRole('heading', { name: 'Labirinto', level: 1 })).toBeVisible()
}
