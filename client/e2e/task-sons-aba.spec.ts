// E2E da ABA SONS do livro da mesa (Sistema 4, sons ao vivo, fatia F3: só
// local, docs/planos/sons-ao-vivo-2026-10-23.md).
//
// O QUE ESTA RÉGUA COBRA:
//   - o marcador Sons abre a página; importar um WAV pequeno de verdade cria o
//     botão com o nome do arquivo; o clique toca (o Web Audio registra o start
//     de um trecho decodificado) e a barra de progresso aparece;
//   - a tecla 3 toca o som do atalho 3 com a página Sons FECHADA;
//   - 200 sons com nomes de 40 caracteres, emoji e escrita não latina não
//     abrem rolagem horizontal e cada botão fica dentro da página, em 390,
//     1280 e 1920 de largura (medido por getBoundingClientRect);
//   - com movimento reduzido o selo não pulsa (e o som toca do mesmo jeito).
//
// COMO PROVA: o app inteiro do mestre em modo Tauri, com disco de mentira que
// guarda texto E binário (o áudio vai para `<appData>/midia` e volta de lá
// para o motor), como task-sons-do-mestre.spec.ts. O áudio é o do Chromium,
// registrado por um `addInitScript`: cada AudioBufferSourceNode que começa a
// tocar (menos a amostra muda do destravamento) e cada pulso do selo. Gesto
// real (clique e tecla do Playwright); nada do app é trocado.
//
// Prints de layout (só com LAB_PROVAS_SONS=1): docs/design/sons/provas/.
import { test, expect, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { bibliotecaDeSonsVazia, comEfeitoMudado, comEfeitoNovo, comPastaNova, serializarBiblioteca, type BibliotecaDeSons } from '../src/lib/sons/biblioteca'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

interface RegistroDaAba {
  /** Trechos decodificados que começaram a tocar. */
  fontes: number
  /** Pulsos do selo (`animate` num `.lb-efeito__selo`). */
  pulsos: number
}

declare global {
  interface Window {
    __somDaAba?: RegistroDaAba
  }
}

const AVENTURA = 'Casa do Eco'
const PASTA = 'C:/appdata/maps/map_eco'
const ESPERA = 10_000
const PROVAS = process.env.LAB_PROVAS_SONS === '1' ? '../docs/design/sons/provas' : null

function discoDaAventura(sons?: BibliotecaDeSons): Record<string, string> {
  const mapa = createEmptyMap('map_eco', AVENTURA, 20, 12, 50)
  const aventura = { version: 1, id: 'adv_eco', name: AVENTURA, startSceneId: 'scene_eco', scenes: [{ id: 'scene_eco', name: 'Salão', file: 'map.json' }] }
  return {
    [`${PASTA}/map.json`]: serializeMap(mapa),
    [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2),
    ...(sons === undefined ? {} : { [`${PASTA}/sons.json`]: serializarBiblioteca(sons) }),
  }
}

/** O arquivo que o `setInputFiles` recebe em memória; o `Buffer` do Node vem do global (o tsconfig dos e2e não carrega os tipos do Node). */
type ArquivoEmMemoria = Extract<Parameters<Locator['setInputFiles']>[0], { buffer: unknown }>
const BufferDoNode: { from(bytes: Uint8Array): ArquivoEmMemoria['buffer'] } = Reflect.get(globalThis, 'Buffer')

/** Um WAV PCM de 16 bits, mono, que o Chromium decodifica de verdade: `segundos` de um tom baixo. */
function wavDeVerdade(segundos: number, taxa = 8000): Uint8Array {
  const amostras = Math.round(segundos * taxa)
  const dados = amostras * 2
  const bytes = new Uint8Array(44 + dados)
  const vista = new DataView(bytes.buffer)
  const texto = (valor: string, onde: number) => {
    for (let i = 0; i < valor.length; i++) bytes[onde + i] = valor.charCodeAt(i)
  }
  texto('RIFF', 0)
  vista.setUint32(4, 36 + dados, true)
  texto('WAVE', 8)
  texto('fmt ', 12)
  vista.setUint32(16, 16, true)
  vista.setUint16(20, 1, true)
  vista.setUint16(22, 1, true)
  vista.setUint32(24, taxa, true)
  vista.setUint32(28, taxa * 2, true)
  vista.setUint16(32, 2, true)
  vista.setUint16(34, 16, true)
  texto('data', 36)
  vista.setUint32(40, dados, true)
  for (let i = 0; i < amostras; i++) vista.setInt16(44 + i * 2, Math.round(Math.sin(i / 6) * 2500), true)
  return bytes
}

/** 200 sons com os nomes que costumam quebrar layout, uma pasta de nome comprido e um favorito com atalho e loop. */
function bibliotecaDoPiorCaso(): BibliotecaDeSons {
  const nomes = ['Aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', '🐉🔥 Dragão acorda na caverna 🔥🐉', 'Колокол собора на рассвете', '雷鳴が城に響く夜の嵐', 'ثعلب الصحراء يعوي', 'Porta']
  const comPasta = comPastaNova(bibliotecaDeSonsVazia(), 'Masmorra do Rei Esquecido sob a Vila Mor', 'pasta_1')
  if (comPasta === null) throw new Error('a pasta do pior caso não montou')
  let biblioteca = comPasta.biblioteca
  for (let i = 0; i < 200; i++) {
    const fonte = { tipo: 'arquivo' as const, ref: `midia:${i.toString(16).padStart(64, '0')}.wav`, bytes: 2000 }
    const passo = comEfeitoNovo(biblioteca, { nome: nomes[i % nomes.length] ?? 'Som', fonte, pastaId: i % 3 === 0 ? 'pasta_1' : null }, `som_${i}`)
    if (passo === null) throw new Error(`o som ${i} do pior caso não montou`)
    biblioteca = passo.biblioteca
  }
  return comEfeitoMudado(biblioteca, 'som_0', { atalho: 9, favorito: true, loop: true }) ?? biblioteca
}

/** Roda NA PÁGINA, antes de qualquer script dela: conta o áudio que começa e o pulso do selo. */
function instrumentar(): void {
  const registro: RegistroDaAba = { fontes: 0, pulsos: 0 }
  window.__somDaAba = registro
  const tocarBuffer = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, ...args: Parameters<AudioBufferSourceNode['start']>) {
    // O buffer de 1 amostra é o destravamento do iOS (lib/sons/contexto.ts), não um som.
    if (this.buffer !== null && this.buffer.length > 1) registro.fontes += 1
    tocarBuffer.apply(this, args)
  }
  const animar = Element.prototype.animate
  Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
    if (this.classList.contains('lb-efeito__selo')) registro.pulsos += 1
    return animar.apply(this, args)
  }
}

/** O "Rust" de mentira: path e fs com texto e binário na memória (o mesmo formato de invoke do plugin-fs). */
function discoDeMentira(textosIniciais: Record<string, string>): void {
  const arquivos = new Map<string, Uint8Array>()
  const codificar = (texto: string): Uint8Array => new TextEncoder().encode(texto)
  for (const [caminho, texto] of Object.entries(textosIniciais)) arquivos.set(caminho, codificar(texto))
  const pastas = new Set<string>()
  const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
  const criarPastas = (p: string): void => {
    for (let atual = semBarraFinal(p); atual.includes('/'); atual = atual.slice(0, atual.lastIndexOf('/'))) pastas.add(atual)
  }
  for (const caminho of arquivos.keys()) criarPastas(caminho.slice(0, caminho.lastIndexOf('/')))
  const todos = (): string[] => Array.from(arquivos.keys()).concat(Array.from(pastas))
  const existe = (caminho: string): boolean => {
    const c = semBarraFinal(caminho)
    return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
  }
  const campos = (valor: unknown): Record<string, unknown> => (typeof valor === 'object' && valor !== null && !(valor instanceof Uint8Array) ? Object.fromEntries(Object.entries(valor)) : {})
  const ler = (caminho: string): Uint8Array => {
    const bytes = arquivos.get(caminho)
    if (bytes === undefined) throw new Error(`arquivo não existe: ${caminho}`)
    return bytes
  }
  const gravar = (args: unknown, headers: Record<string, string> | undefined): null => {
    const caminho = decodeURIComponent(headers?.path ?? '')
    criarPastas(caminho.slice(0, caminho.lastIndexOf('/')))
    arquivos.set(caminho, args instanceof Uint8Array ? args.slice() : new Uint8Array(0))
    return null
  }
  let proximoId = 1
  Object.assign(window, {
    isTauri: true,
    __TAURI_INTERNALS__: {
      metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
      convertFileSrc: (caminho: string) => String(caminho),
      transformCallback: () => {
        proximoId += 1
        return proximoId
      },
      invoke: async (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => {
        const a = campos(args)
        switch (cmd) {
          case 'plugin:event|listen':
            return Number(a.handler)
          case 'plugin:path|resolve_directory':
            return 'C:/appdata'
          case 'plugin:path|join':
            return Array.isArray(a.paths) ? a.paths.map(String).join('/') : ''
          case 'plugin:path|dirname': {
            const p = String(a.path)
            return p.slice(0, Math.max(0, p.lastIndexOf('/')))
          }
          case 'plugin:path|basename': {
            const p = String(a.path)
            return p.slice(p.lastIndexOf('/') + 1)
          }
          case 'plugin:fs|exists':
            return existe(String(a.path))
          case 'plugin:fs|mkdir':
            criarPastas(String(a.path))
            return null
          case 'plugin:fs|write_text_file':
          case 'plugin:fs|write_file':
            return gravar(args, options?.headers)
          case 'plugin:fs|read_text_file':
            return Array.from(ler(String(a.path)))
          case 'plugin:fs|read_file':
            return ler(String(a.path)).slice().buffer
          case 'plugin:fs|copy_file':
            arquivos.set(String(a.toPath), ler(String(a.fromPath)).slice())
            return null
          case 'plugin:fs|rename':
            arquivos.set(String(a.newPath), ler(String(a.oldPath)))
            arquivos.delete(String(a.oldPath))
            return null
          case 'plugin:fs|remove':
            arquivos.delete(String(a.path))
            return null
          case 'plugin:fs|stat': {
            const caminho = semBarraFinal(String(a.path))
            const bytes = arquivos.get(caminho)
            if (bytes === undefined && !pastas.has(caminho)) throw new Error(`não existe: ${caminho}`)
            return { isFile: bytes !== undefined, isDirectory: bytes === undefined, isSymlink: false, size: bytes?.length ?? 0, mtime: null, atime: null, birthtime: null, readonly: false }
          }
          case 'plugin:fs|read_dir': {
            const prefixo = `${semBarraFinal(String(a.path))}/`
            if (!pastas.has(semBarraFinal(String(a.path)))) throw new Error(`pasta não existe: ${String(a.path)}`)
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
    },
  })
}

async function abrirOEditor(page: Page, sons?: BibliotecaDeSons): Promise<void> {
  await page.addInitScript(instrumentar)
  await page.addInitScript(discoDeMentira, discoDaAventura(sons))
  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(AVENTURA) }).click()
  await page.waitForSelector('canvas')
}

const livroDaMesa = (page: Page) => page.getByRole('complementary', { name: 'Livro da mesa' })
const paginaSons = (page: Page) => page.getByRole('region', { name: 'Sons' })

async function abrirAbaSons(page: Page): Promise<void> {
  const marcador = livroDaMesa(page).getByRole('tab', { name: 'Sons' })
  await marcador.click()
  await expect(marcador).toHaveAttribute('aria-selected', 'true')
  await expect(paginaSons(page)).toBeVisible()
  // A troca de página desliza e acende: mede e fotografa só depois de assentar
  // (a barra de progresso é tempo correndo, não entra na conta).
  await page.waitForFunction(() => document.getAnimations().every((animacao) => animacao.playState !== 'running' || (animacao.effect instanceof KeyframeEffect && animacao.effect.target instanceof Element && animacao.effect.target.classList.contains('lb-efeito__barra'))))
}

async function registro(page: Page): Promise<RegistroDaAba> {
  return page.evaluate(() => {
    const atual = window.__somDaAba
    if (atual === undefined) throw new Error('o registro do áudio não foi instalado')
    return { ...atual }
  })
}

async function importarEco(page: Page): Promise<void> {
  await paginaSons(page).locator('input[type="file"][aria-label="Arquivo de som"]').setInputFiles({ name: 'eco da caverna.wav', mimeType: 'audio/wav', buffer: BufferDoNode.from(wavDeVerdade(0.6)) })
  await expect(paginaSons(page).getByRole('button', { name: 'eco da caverna', exact: true })).toBeVisible({ timeout: ESPERA })
}

test('aba Sons: importa um WAV, o clique toca e mostra a barra; a tecla 3 toca com a aba fechada', async ({ page }) => {
  await abrirOEditor(page)
  await abrirAbaSons(page)
  await importarEco(page)
  expect((await registro(page)).fontes).toBe(0)
  // O áudio importado vai para a pasta de mídia DA AVENTURA (é o que viaja com ela), e o pé conta.
  await expect(paginaSons(page).getByText('Mídia da aventura: menos de 0,1 MB')).toBeVisible({ timeout: ESPERA })

  await paginaSons(page).getByRole('button', { name: 'eco da caverna', exact: true }).click()
  await expect.poll(async () => (await registro(page)).fontes, { timeout: ESPERA }).toBe(1)
  await expect(paginaSons(page).locator('.lb-efeito__barra')).toBeAttached()
  expect((await registro(page)).pulsos).toBe(1)
  if (PROVAS !== null) await page.screenshot({ path: `${PROVAS}/aba-sons-1280-um-som.png` })

  // Dá a tecla 3 pelo lápis e fecha a aba (vai às Cenas): a tecla vale com a página Sons fora da vista.
  await paginaSons(page).getByRole('button', { name: 'Editar eco da caverna' }).click()
  const lapis = page.getByRole('dialog', { name: 'Editar som' })
  await lapis.getByLabel('Tecla de atalho').selectOption('3')
  // Com o lápis (modal) aberto a tecla é dele: o som não toca.
  const comOLapis = (await registro(page)).fontes
  await lapis.getByRole('button', { name: 'Pronto' }).focus()
  await page.keyboard.press('3')
  await page.waitForTimeout(400)
  expect((await registro(page)).fontes).toBe(comOLapis)
  await lapis.getByRole('button', { name: 'Pronto' }).click()
  await expect(lapis).toBeHidden()
  await livroDaMesa(page).getByRole('tab', { name: 'Cenas' }).click()
  await expect(paginaSons(page)).toBeHidden()
  const antes = (await registro(page)).fontes
  await page.keyboard.press('3')
  await expect.poll(async () => (await registro(page)).fontes, { timeout: ESPERA }).toBe(antes + 1)
  // Ação de teclado não anima: o selo só pulsou no clique.
  expect((await registro(page)).pulsos).toBe(1)
  // Outra tecla sem som não toca nada.
  await page.keyboard.press('4')
  await page.waitForTimeout(400)
  expect((await registro(page)).fontes).toBe(antes + 1)
})

test('movimento reduzido, no celular (390): o selo não pulsa e o som toca do mesmo jeito', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 390, height: 844 })
  await abrirOEditor(page)
  await abrirAbaSons(page)
  await importarEco(page)
  await paginaSons(page).getByRole('button', { name: 'eco da caverna', exact: true }).click()
  await expect.poll(async () => (await registro(page)).fontes, { timeout: ESPERA }).toBe(1)
  expect((await registro(page)).pulsos).toBe(0)
  if (PROVAS !== null) await page.screenshot({ path: `${PROVAS}/aba-sons-390-um-som.png` })
})

for (const largura of [390, 1280, 1920] as const) {
  test(`pior caso em ${largura} px: 200 sons de nomes difíceis, sem rolagem horizontal e cada botão dentro da página`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: largura === 390 ? 844 : 900 })
    await abrirOEditor(page, bibliotecaDoPiorCaso())
    await abrirAbaSons(page)
    await expect(paginaSons(page).locator('.lb-efeito')).toHaveCount(200, { timeout: ESPERA })
    if (PROVAS !== null && largura !== 1920) await page.screenshot({ path: `${PROVAS}/aba-sons-${largura}-muitos.png` })

    const medida = await page.evaluate(() => {
      // A página do livro da MESA (o livro do mestre, à esquerda, também tem uma `.gr-pagina`).
      const pagina = document.querySelector('[data-pagina="sons"]')?.closest('.gr-pagina')?.getBoundingClientRect()
      const rolo = document.querySelector('[data-pagina="sons"] .gr-folha__rolo')
      if (pagina === undefined || !(rolo instanceof HTMLElement)) throw new Error('sem a página Sons')
      const fora: string[] = []
      for (const no of document.querySelectorAll<HTMLElement>('.lb-efeito, .lb-sons__chip')) {
        const r = no.getBoundingClientRect()
        if (r.left < pagina.left - 0.5 || r.right > pagina.right + 0.5) fora.push(`${no.className} ${Math.round(r.left)}-${Math.round(r.right)}`)
      }
      for (const nome of document.querySelectorAll<HTMLElement>('.lb-efeito__nome')) {
        const cartao = nome.closest('.lb-efeito')?.getBoundingClientRect()
        const r = nome.getBoundingClientRect()
        if (cartao === undefined || r.left < cartao.left - 0.5 || r.right > cartao.right + 0.5) fora.push(`nome ${nome.textContent ?? ''}`)
      }
      return {
        rolagemDaJanela: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        rolagemDaPagina: rolo.scrollWidth - rolo.clientWidth,
        paginaDentroDaJanela: pagina.left >= 0 && pagina.right <= window.innerWidth + 0.5,
        fora,
      }
    })
    expect(medida.rolagemDaJanela, 'a janela não pode rolar de lado').toBeLessThanOrEqual(0)
    expect(medida.rolagemDaPagina, 'a página Sons não pode rolar de lado').toBeLessThanOrEqual(0)
    expect(medida.paginaDentroDaJanela, 'a página inteira cabe na janela').toBe(true)
    expect(medida.fora, 'botões, chips e nomes dentro da página').toEqual([])
  })
}
