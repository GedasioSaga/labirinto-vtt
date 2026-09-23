import type { Page } from '@playwright/test'

type FakeInternals = {
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
  __fakeFs: Record<string, string>
  /** Todo comando recebido, em ordem — para conferir, por exemplo, que Ctrl+O abriu o diálogo. */
  __invokes: string[]
}

/**
 * Disco de mentira para o navegador: responde os invokes de path/fs que
 * `lib/mapFileIO.ts` usa (appDataDir, join, dirname, exists, mkdir,
 * write_text_file, read_text_file, grant_fs_access) guardando os arquivos em
 * `window.__fakeFs`. Não liga `window.isTauri`, então o App segue no modo
 * navegador (sem abas nem ponte do jogador) — só Salvar/Início/entrar e voltar
 * de andar passam a funcionar como no app.
 */
export async function installTauriFsStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const target = window as unknown as FakeInternals
    const files: Record<string, string> = {}
    const dirs = new Set<string>()
    target.__fakeFs = files
    target.__invokes = []
    target.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      transformCallback: () => 0,
      convertFileSrc: (filePath: string) => filePath,
      invoke: async (cmd, args, options) => {
        target.__invokes.push(cmd)
        const a = (args ?? {}) as Record<string, unknown>
        switch (cmd) {
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return (a.paths as string[]).join('/')
          case 'plugin:path|dirname': {
            const p = String(a.path)
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:fs|exists':
            return dirs.has(String(a.path)) || String(a.path) in files
          case 'plugin:fs|mkdir':
            dirs.add(String(a.path))
            return null
          case 'plugin:fs|write_text_file': {
            const path = decodeURIComponent(options?.headers?.path ?? '')
            files[path] = new TextDecoder().decode(args as Uint8Array)
            return null
          }
          case 'plugin:fs|read_text_file': {
            const path = String(a.path)
            if (!(path in files)) throw new Error(`arquivo não existe: ${path}`)
            return Array.from(new TextEncoder().encode(files[path]))
          }
          default:
            return null
        }
      },
    }
  })
}
