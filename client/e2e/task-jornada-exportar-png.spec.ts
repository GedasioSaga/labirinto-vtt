// JORNADA DE USUÁRIO de EXPORTAR O MAPA COMO IMAGEM PNG (item 16 de
// docs/features-candidatas-2026-09-21.md) — escrita para SAIR VERMELHA no
// código de hoje. É a régua da feature, não a feature.
//
// A FEATURE:
//   - no editor, um item "Exportar imagem" (junto das ações de arquivo)
//     salva a cena ATUAL como um arquivo PNG, para imprimir ou postar no grupo;
//   - a imagem sai no estilo do editor: o chão com a cor do chão, as fichas nas
//     posições delas, o mapa inteiro sem espelhar nem deformar;
//   - antes de salvar, o mestre escolhe se a imagem inclui ou não a GRADE e se
//     inclui ou não os objetos SÓ DO MESTRE ("Oculto para jogadores", o
//     `secret` de types/map.ts:212). Desligado, o que é só do mestre NÃO
//     aparece na imagem: uma imagem postada no grupo não pode entregar segredo.
//
// ONDE ISSO MORRE HOJE: components/ActionBar.tsx:100-104 só tem "Exportar
// mapa (pasta)", que copia map.json e as imagens para uma pasta
// (lib/mapFileIO.ts, exportMapFolder) — ninguém abre isso no celular. Nenhum
// `extract`/`toDataURL` do canvas do mapa existe em src/ (as únicas conversões
// para imagem são de FOTO importada: lib/imageImport.ts:99 e
// lib/tokenPhoto.ts:94).
//
// COMO ESTE ARQUIVO PROVA, sem mentir:
//   DISCO DE MENTIRA COM O MAPA PRONTO: um mapa salvo (chão magenta, grade
//   amarela bem grossa, uma ficha laranja visível no canto de cima à direita
//   e uma ficha azul "Oculta para jogadores" no canto de baixo à direita), aberto
//   pelo menu "Carregar Mapa existente", como na mesa. Mesmo mecanismo de
//   task-jornada-visao-geral-das-cenas.spec.ts.
//   ONDE O PNG CAI: o app roda como Tauri (isTauri), então "salvar" é a janela
//   de salvar do sistema (`plugin:dialog|save`, que aqui responde um caminho
//   na Área de Trabalho) seguida da gravação do arquivo (`plugin:fs|write_file`,
//   que aqui guarda os BYTES). Se a feature preferir o download do navegador,
//   o evento `download` do Playwright também é aceito. O arquivo que o mestre
//   receberia é o produto: é ele que a régua abre e olha.
//   GESTO REAL NA AÇÃO SOB TESTE: clique de ponteiro no item, nas opções e no
//   botão de confirmar. Nenhum setState, nenhum evento sintético, nenhum
//   invoke chamado pela régua.
//   `evaluate` SÓ LÊ: (a) decodificar um PNG (a foto da tela ou o arquivo
//   exportado) num canvas solto da página e contar cores; (b) copiar os bytes
//   já gravados no disco de mentira. Nada do app é tocado.
//   PROVA NO QUE O MESTRE VÊ: nome acessível dos controles e PIXEL do PNG
//   exportado. A MESMA função que lê o arquivo exportado lê a foto da tela no
//   teste 1 — se ela lesse errado, o controle cairia junto.
//
// SUPOSIÇÕES (as únicas que esta régua dita além das frases do pedido):
//   - o item é um controle visível no editor (button ou menuitem) cujo nome
//     acessível começa com "Exportar imagem"; se ele morar num menu, esse menu
//     é o do rodapé de ações de arquivo e o item fica visível sem outro clique
//     além do próprio item (como "Exportar mapa (pasta)" hoje);
//   - clicar nele abre um diálogo cujo nome acessível contém "Exportar imagem",
//     com duas opções liga/desliga (checkbox ou switch): uma com "grade" no
//     nome e outra com "só do mestre" / "oculto(s) para jogadores" no nome, e
//     um botão de confirmar cujo nome começa com "Exportar" ou "Salvar";
//   - confirmar grava UM arquivo PNG (assinatura 89 50 4E 47) pela janela de
//     salvar do Tauri + `writeFile` do plugin-fs, ou por download do navegador;
//   - "no estilo do editor" = o chão sai com a cor do chão (magenta), o mapa
//     inteiro sai na proporção dele (20 x 16 células, 1,25 : 1) e a ficha
//     visível sai no quadrante certo, medido contra a caixa do CHÃO na imagem
//     (moldura, título ou margem da imagem não deslocam a conta);
//   - a ficha "Oculta para jogadores" é o "objeto só do mestre": com a opção
//     desligada o lugar dela na imagem é chão liso; ligada, há ficha ali (em
//     qualquer opacidade).
//
// CONTROLE POSITIVO (verde hoje): teste 1. Prova que o disco falso abre o
// mapa, que o editor pinta chão magenta, grade amarela, ficha laranja e a
// ficha oculta, que o rodapé de ações de arquivo está onde a régua procura, e
// que o leitor de PNG enxerga tudo isso. Sem ele, o vermelho dos testes 2 a 4
// poderia ser a infraestrutura quebrada, e não a feature ausente.
import { readFileSync } from 'node:fs'
import { test, expect, type Download, type Locator, type Page } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import type { MapData, Token } from '../src/types/map'

// Disco apertado nesta máquina: sem trace e sem vídeo. O screenshot de falha fica.
test.use({ trace: 'off', video: 'off' })

const NOME_DO_MAPA = 'Cripta do Farol'
const PASTA = 'C:/appdata/maps/map_cripta_farol'
const PASTA_DA_AREA_DE_TRABALHO = 'C:/Users/mestre/Desktop'

const ITEM_EXPORTAR_IMAGEM = /^Exportar imagem/
const NOME_DO_DIALOGO = /Exportar imagem/
const OPCAO_GRADE = /grade/i
const OPCAO_MESTRE = /(s[óo] do mestre|ocult[oa]s? (para|dos) jogadores)/i
const BOTAO_CONFIRMAR = /^(Exportar|Salvar)/

// Mapa 20 x 16 células de 50 px (1000 x 800): quase quadrado, proporção 1,25.
const GRADE = 50
const COLUNAS = 20
const LINHAS = 16
const LARGURA = COLUNAS * GRADE
const ALTURA = LINHAS * GRADE
/** O chão cobre o mapa inteiro menos esta margem em cada lado. */
const MARGEM_DO_CHAO = 10
const PROPORCAO_DO_CHAO = (LARGURA - 2 * MARGEM_DO_CHAO) / (ALTURA - 2 * MARGEM_DO_CHAO)
const TOLERANCIA_DA_PROPORCAO = 0.08

/** Cores que nada mais no app usa. */
const CHAO = '#8c1e8c'
const COR_DA_GRADE = '#ffff00'
const LARGURA_DA_LINHA_DA_GRADE = 4
const COR_DA_FICHA = '#ff5a00'
const COR_DA_FICHA_OCULTA = '#00c8ff'
/**
 * Ficha visível: centro de uma célula na metade de CIMA, à DIREITA. Não colada
 * no topo: a barra de ferramentas flutua sobre a faixa de cima do canvas.
 */
const POS_DA_FICHA = { x: LARGURA - 125, y: 275 }
/**
 * Ficha oculta para jogadores: centro de uma célula no canto de BAIXO À DIREITA.
 * Do lado direito de propósito: a câmera inicial do editor pode deixar a borda
 * esquerda do mapa debaixo do rail (foto de falha de 23/09, zoom 120%), e o
 * controle precisa enxergar a ficha oculta na tela.
 */
const POS_DA_OCULTA = { x: LARGURA - 125, y: ALTURA - 125 }
/** Meio-lado (px de mundo) do quadrado olhado em volta do centro da ficha oculta: dentro do disco, longe da grade. */
const MEIO_LADO_DO_OLHO = 10

/** Espera curta por elemento: a feature ausente tem de falhar rápido. */
const ESPERA = 6000
/**
 * Espera de quem LÊ PIXEL ou espera o arquivo cair no disco. Cada leitura
 * custa segundos (foto + decodificação + elementFromPoint); com a máquina
 * carregada, 15 s deram UMA leitura só e o controle caiu com o chão na tela.
 */
const ESPERA_TELA = 45_000
/** Folga para o Pixi pintar antes da foto. */
const PINTURA_MS = 400

/** Pixels magenta para dizer "o chão está aqui" (editor ou imagem). */
const PIXELS_DE_CHAO = 2000
/** Pixels amarelos para dizer "a grade está aqui". */
const PIXELS_DE_GRADE = 300
/** Pixels laranja para dizer "a ficha visível está aqui". */
const PIXELS_DE_FICHA = 40
/** Pixels azuis (a ficha oculta, cheia ou esmaecida sobre o magenta) para dizer "a ficha oculta está na tela". */
const PIXELS_DE_OCULTA = 40
/** Pixels máximos para dizer "esta cor NÃO está aqui" (antisserrilhado). */
const RESIDUO = 3
/** Fração do quadrado da ficha oculta que tem de NÃO ser chão para dizer "a ficha está ali". */
const FRACAO_COM_FICHA = 0.4
/** Fração do quadrado da ficha oculta que pode não ser chão e ainda dizer "chão liso ali". */
const FRACAO_CHAO_LISO = 0.03

type Foto = Awaited<ReturnType<Page['screenshot']>>

// ───────────────────────────────────────────────────────────────────────────
// O mapa no disco
// ───────────────────────────────────────────────────────────────────────────

function ficha(id: string, name: string, p: { x: number; y: number }, color: string, secret: boolean): Token {
  return { id, characterId: null, name, x: p.x, y: p.y, size: 1, image: null, color, ...(secret ? { secret: true } : {}) }
}

function mapaDaCripta(): MapData {
  const base = createEmptyMap('map_cripta_farol', NOME_DO_MAPA, COLUNAS, LINHAS, GRADE)
  return {
    ...base,
    showGrid: true,
    gridSettings: { color: COR_DA_GRADE, opacity: 1, lineWidth: LARGURA_DA_LINHA_DA_GRADE, lineStyle: 'solid' },
    floor: [
      {
        id: 'chao-cripta',
        shape: { kind: 'rect', cx: LARGURA / 2, cy: ALTURA / 2, w: LARGURA - 2 * MARGEM_DO_CHAO, h: ALTURA - 2 * MARGEM_DO_CHAO },
        op: 'add',
        modifiers: {},
      },
    ],
    floorStyle: { ...base.floorStyle, fillColor: CHAO },
    tokens: [
      ficha('tok-lanterna', 'Lanterna', POS_DA_FICHA, COR_DA_FICHA, false),
      ficha('tok-espreita', 'Espreita', POS_DA_OCULTA, COR_DA_FICHA_OCULTA, true),
    ],
  }
}

// ───────────────────────────────────────────────────────────────────────────
// O mestre: app em modo Tauri com disco de mentira que aceita gravar bytes
// ───────────────────────────────────────────────────────────────────────────

type JanelaDoMestre = {
  isTauri: boolean
  /** Bytes (base64) de cada arquivo BINÁRIO gravado, na ordem em que caíram no disco. */
  __binariosGravados: Array<{ caminho: string; b64: string }>
  __TAURI_INTERNALS__: {
    metadata: { currentWindow: { label: string }; currentWebview: { windowLabel: string; label: string } }
    invoke: (cmd: string, args?: unknown, options?: { headers?: Record<string, string> }) => Promise<unknown>
    transformCallback: () => number
    convertFileSrc: (filePath: string) => string
  }
}

interface Mestre {
  page: Page
  /** PNGs recebidos por download do navegador (a outra rota aceita). */
  downloads: Download[]
}

async function mestreAbreOMapa(page: Page): Promise<Mestre> {
  await page.addInitScript(
    ({ arquivos, desktop }: { arquivos: Record<string, string>; desktop: string }) => {
      const alvo = window as unknown as JanelaDoMestre
      const textos: Record<string, string> = { ...arquivos }
      const pastas = new Set<string>()
      const binarios: Array<{ caminho: string; b64: string }> = []
      let salvamentos = 0
      const semBarraFinal = (p: string): string => p.replace(/[/]+$/, '')
      const todos = (): string[] => Object.keys(textos).concat(Array.from(pastas), binarios.map((b) => b.caminho))
      const existe = (caminho: string): boolean => {
        const c = semBarraFinal(caminho)
        return todos().some((p) => p === c || p.indexOf(`${c}/`) === 0)
      }
      const paraBytes = (corpo: unknown): Uint8Array | null => {
        if (corpo instanceof Uint8Array) return corpo
        if (corpo instanceof ArrayBuffer) return new Uint8Array(corpo)
        if (Array.isArray(corpo)) return Uint8Array.from(corpo as number[])
        return null
      }
      const base64 = (bytes: Uint8Array): string => {
        let s = ''
        for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)))
        return btoa(s)
      }
      alvo.__binariosGravados = binarios
      alvo.isTauri = true
      alvo.__TAURI_INTERNALS__ = {
        metadata: { currentWindow: { label: 'main' }, currentWebview: { windowLabel: 'main', label: 'main' } },
        convertFileSrc: (caminho: string) => String(caminho),
        transformCallback: () => 0,
        invoke: async (cmd, args, options) => {
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
              return existe(String(a.path))
            case 'plugin:fs|mkdir':
              pastas.add(semBarraFinal(String(a.path)))
              return null
            case 'plugin:fs|write_text_file':
              textos[decodeURIComponent(options?.headers?.path ?? '')] = new TextDecoder().decode(args as Uint8Array)
              return null
            case 'plugin:fs|write_file': {
              // writeFile do plugin-fs: corpo = bytes, caminho no cabeçalho.
              const bytes = paraBytes(args)
              const caminho = decodeURIComponent(options?.headers?.path ?? '')
              if (bytes) binarios.push({ caminho, b64: base64(bytes) })
              return null
            }
            case 'plugin:fs|read_text_file': {
              const caminho = String(a.path)
              if (!(caminho in textos)) throw new Error(`arquivo não existe: ${caminho}`)
              return Array.from(new TextEncoder().encode(textos[caminho]))
            }
            case 'plugin:dialog|save': {
              // A janela de salvar do sistema: o mestre escolhe a Área de Trabalho.
              salvamentos += 1
              return `${desktop}/cripta-${salvamentos}.png`
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
    { arquivos: { [`${PASTA}/map.json`]: serializeMap(mapaDaCripta()) }, desktop: PASTA_DA_AREA_DE_TRABALHO },
  )

  const downloads: Download[] = []
  page.on('download', (d) => downloads.push(d))

  await page.goto('/')
  await page.getByRole('button', { name: /Carregar Mapa existente/ }).click()
  await page.getByRole('button', { name: new RegExp(NOME_DO_MAPA) }).click()
  await page.waitForSelector('canvas')
  await afastarAteCaberNaTela(page)
  return { page, downloads }
}

/** O mostrador de zoom do canto do editor (components/ZoomHud.tsx:45, "Zoom: 120%"). */
const MOSTRADOR_DE_ZOOM = /^Zoom: \d+%/
/** Zoom em que o mapa inteiro (1000 x 800) cabe na área do canvas livre de rail e barra. */
const ZOOM_QUE_CABE = 50
const MAX_GIROS_DA_RODA = 40
/** Ponto do canvas livre de rail (à esquerda) e barra (em cima). */
const PONTO_DO_ZOOM = { x: 800, y: 450 }

/**
 * A câmera inicial variou entre execuções (fotos de falha de 23/09: ora a
 * ficha visível, ora a oculta debaixo do rail ou da barra; o atalho F
 * enquadra só as FICHAS e deixou uma debaixo da barra a 160%). O mestre
 * afasta com Ctrl+roda (resolveWheel: Ctrl+roda é zoom) sobre um ponto livre
 * do canvas, lendo o mostrador de zoom na tela, até o mapa inteiro caber. O
 * zoom encolhe tudo em direção ao ponteiro, então o mapa acaba perto dele.
 */
async function afastarAteCaberNaTela(page: Page): Promise<void> {
  const mostrador = page.getByRole('button', { name: MOSTRADOR_DE_ZOOM })
  await expect(mostrador, 'o editor deveria mostrar o zoom (ex.: "Zoom: 120%") no canto').toBeVisible({ timeout: ESPERA })
  const zoom = async (): Promise<number> => Number.parseInt(/(\d+)%/.exec((await mostrador.getAttribute('aria-label')) ?? '')?.[1] ?? 'NaN', 10)
  await page.mouse.move(PONTO_DO_ZOOM.x, PONTO_DO_ZOOM.y)
  await page.keyboard.down('Control')
  try {
    for (let giro = 0; giro < MAX_GIROS_DA_RODA && (await zoom()) > ZOOM_QUE_CABE; giro += 1) {
      await page.mouse.wheel(0, 120)
      await page.waitForTimeout(40)
    }
  } finally {
    await page.keyboard.up('Control')
  }
  expect(await zoom(), `Ctrl+roda deveria afastar o mapa até ${ZOOM_QUE_CABE}%`).toBeLessThanOrEqual(ZOOM_QUE_CABE)
  await page.waitForTimeout(PINTURA_MS)
}

// ───────────────────────────────────────────────────────────────────────────
// Os PNGs que o mestre recebeu (disco de mentira + downloads) — só leitura
// ───────────────────────────────────────────────────────────────────────────

const ASSINATURA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function ehPng(bytes: Foto): boolean {
  return bytes.length > ASSINATURA_PNG.length && ASSINATURA_PNG.every((b, i) => bytes[i] === b)
}

/** Todo arquivo binário que caiu no disco ou chegou por download, na ordem. */
async function arquivosRecebidos(mestre: Mestre): Promise<Foto[]> {
  const gravados = await mestre.page.evaluate(() => (window as unknown as JanelaDoMestre).__binariosGravados.map((b) => b.b64))
  const doDisco = gravados.map((b64) => Buffer.from(b64, 'base64'))
  const baixados: Foto[] = []
  for (const d of mestre.downloads) {
    const caminho = await d.path().catch(() => null)
    if (!caminho) continue
    baixados.push(readFileSync(caminho))
  }
  return doDisco.concat(baixados)
}

// ───────────────────────────────────────────────────────────────────────────
// O gesto: item "Exportar imagem" → opções → confirmar → PNG no disco
// ───────────────────────────────────────────────────────────────────────────

function itemExportarImagem(page: Page): Locator {
  return page.getByRole('button', { name: ITEM_EXPORTAR_IMAGEM }).or(page.getByRole('menuitem', { name: ITEM_EXPORTAR_IMAGEM }))
}

function opcao(dialogo: Locator, nome: RegExp): Locator {
  return dialogo.getByRole('checkbox', { name: nome }).or(dialogo.getByRole('switch', { name: nome }))
}

/** Liga ou desliga uma opção com clique de ponteiro, e confere o que ficou marcado na tela. */
async function marcar(controle: Locator, ligado: boolean, descricao: string): Promise<void> {
  await expect(controle, `o diálogo deveria ter a opção de ${descricao}`).toBeVisible({ timeout: ESPERA })
  if ((await controle.isChecked()) !== ligado) await controle.click()
  await expect(controle, `a opção de ${descricao} deveria ficar ${ligado ? 'ligada' : 'desligada'}`).toBeChecked({ checked: ligado })
}

/** Exporta pelo gesto do mestre e devolve o PNG que chegou. */
async function exportarImagem(mestre: Mestre, opcoes: { grade: boolean; mestre: boolean }): Promise<Foto> {
  const { page } = mestre
  const antes = (await arquivosRecebidos(mestre)).length
  const item = itemExportarImagem(page)
  await expect(item, 'o editor deveria ter um item "Exportar imagem"').toBeVisible({ timeout: ESPERA })
  await item.click()

  const dialogo = page.getByRole('dialog', { name: NOME_DO_DIALOGO })
  await expect(dialogo, '"Exportar imagem" deveria abrir um diálogo com as opções da imagem').toBeVisible({ timeout: ESPERA })
  await marcar(opcao(dialogo, OPCAO_GRADE), opcoes.grade, 'incluir a grade')
  await marcar(opcao(dialogo, OPCAO_MESTRE), opcoes.mestre, 'incluir os objetos só do mestre')
  const confirmar = dialogo.getByRole('button', { name: BOTAO_CONFIRMAR })
  await expect(confirmar, 'o diálogo deveria ter um botão "Exportar" ou "Salvar"').toBeVisible({ timeout: ESPERA })
  await confirmar.click()

  await expect
    .poll(async () => (await arquivosRecebidos(mestre)).length, {
      timeout: ESPERA_TELA,
      message: 'confirmar deveria gravar UM arquivo de imagem (janela de salvar + gravação, ou download)',
    })
    .toBe(antes + 1)
  const recebidos = await arquivosRecebidos(mestre)
  const png = recebidos[recebidos.length - 1]
  expect(ehPng(png), `o arquivo gravado deveria ser PNG (começa com 89 50 4E 47); começou com ${png.subarray(0, 8).toString('hex')}`).toBe(true)
  return png
}

// ───────────────────────────────────────────────────────────────────────────
// Leitura de pixel (a mesma para a foto da tela e para o PNG exportado)
// ───────────────────────────────────────────────────────────────────────────

interface Mancha {
  n: number
  x1: number
  y1: number
  x2: number
  y2: number
  cx: number
  cy: number
}

interface Leitura {
  largura: number
  altura: number
  chao: Mancha
  grade: Mancha
  ficha: Mancha
  /** Azul da ficha oculta (cheia ou esmaecida sobre o magenta). */
  oculta: Mancha
  /** Fração do quadrado da ficha oculta (medido contra a caixa do chão) que NÃO é chão nem grade. */
  fracaoNaoChaoNaOculta: number
  /** Pixels do quadrado da ficha oculta. */
  pixelsNoOlho: number
}

/** Onde fica o quadrado da ficha oculta, em fração da caixa do chão (0 = esquerda/cima, 1 = direita/baixo). */
const OLHO = {
  x1: (POS_DA_OCULTA.x - MEIO_LADO_DO_OLHO - MARGEM_DO_CHAO) / (LARGURA - 2 * MARGEM_DO_CHAO),
  x2: (POS_DA_OCULTA.x + MEIO_LADO_DO_OLHO - MARGEM_DO_CHAO) / (LARGURA - 2 * MARGEM_DO_CHAO),
  y1: (POS_DA_OCULTA.y - MEIO_LADO_DO_OLHO - MARGEM_DO_CHAO) / (ALTURA - 2 * MARGEM_DO_CHAO),
  y2: (POS_DA_OCULTA.y + MEIO_LADO_DO_OLHO - MARGEM_DO_CHAO) / (ALTURA - 2 * MARGEM_DO_CHAO),
}

/**
 * Decodifica um PNG num canvas solto da página e conta: chão magenta, grade
 * amarela, ficha laranja, e quanto do quadrado da ficha oculta não é chão.
 * Leitura pura — nada do app é tocado. Com `soCanvas`, conta só onde o CANVAS
 * do mapa está por cima (a foto da tela inteira: o rail e os painéis não
 * contam); sem ele, conta o arquivo inteiro (o PNG exportado).
 */
async function lerPng(page: Page, png: Foto, soCanvas: boolean): Promise<Leitura> {
  return page.evaluate(
    async ({ b64, filtrar, olho }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob())
      const tela = document.createElement('canvas')
      tela.width = bmp.width
      tela.height = bmp.height
      const ctx = tela.getContext('2d')
      if (!ctx) throw new Error('sem contexto 2d')
      ctx.drawImage(bmp, 0, 0)
      const { data, width, height } = ctx.getImageData(0, 0, bmp.width, bmp.height)
      const escalaX = window.innerWidth / width
      const escalaY = window.innerHeight / height
      const noCanvas = new Map<number, boolean>()
      const canvasPorCima = (x: number, y: number): boolean => {
        if (!filtrar) return true
        const chave = (y >> 3) * 65536 + (x >> 3)
        let v = noCanvas.get(chave)
        if (v === undefined) {
          v = document.elementFromPoint(((x >> 3) * 8 + 4) * escalaX, ((y >> 3) * 8 + 4) * escalaY)?.tagName === 'CANVAS'
          noCanvas.set(chave, v)
        }
        return v
      }
      type Classe = 'chao' | 'grade' | 'ficha' | 'oculta' | 'outro'
      const classe = (i: number): Classe => {
        const R = data[i]
        const G = data[i + 1]
        const B = data[i + 2]
        if (R > 200 && G > 200 && B < 90) return 'grade'
        if (R > 200 && G > 50 && G < 140 && B < 60) return 'ficha'
        if (R > G * 1.8 + 8 && B > G * 1.8 + 8 && Math.abs(R - B) < 30) return 'chao'
        // #00c8ff cheio, ou a 50% sobre o magenta (~#46739d): azul bem acima do vermelho, verde acima do vermelho.
        if (B > 150 && B > R + 60 && G > R + 20) return 'oculta'
        return 'outro'
      }
      const vazia = () => ({ n: 0, x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity, sx: 0, sy: 0 })
      const r = { chao: vazia(), grade: vazia(), ficha: vazia(), oculta: vazia() }
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const c = classe((y * width + x) * 4)
          if (c === 'outro' || !canvasPorCima(x, y)) continue
          const m = r[c]
          m.n += 1
          m.sx += x
          m.sy += y
          if (x < m.x1) m.x1 = x
          if (y < m.y1) m.y1 = y
          if (x > m.x2) m.x2 = x
          if (y > m.y2) m.y2 = y
        }
      }
      // O quadrado da ficha oculta, medido contra a caixa do CHÃO (a grade conta como chão:
      // ela passa por cima e não é a ficha).
      const caixa = r.chao
      let naoChao = 0
      let total = 0
      if (caixa.n > 0) {
        const w = caixa.x2 - caixa.x1
        const h = caixa.y2 - caixa.y1
        const ox1 = Math.floor(caixa.x1 + olho.x1 * w)
        const ox2 = Math.ceil(caixa.x1 + olho.x2 * w)
        const oy1 = Math.floor(caixa.y1 + olho.y1 * h)
        const oy2 = Math.ceil(caixa.y1 + olho.y2 * h)
        for (let y = Math.max(0, oy1); y <= Math.min(height - 1, oy2); y += 1) {
          for (let x = Math.max(0, ox1); x <= Math.min(width - 1, ox2); x += 1) {
            total += 1
            const c = classe((y * width + x) * 4)
            if (c !== 'chao' && c !== 'grade') naoChao += 1
          }
        }
      }
      const fechar = (m: ReturnType<typeof vazia>) => ({
        n: m.n,
        x1: m.x1,
        y1: m.y1,
        x2: m.x2,
        y2: m.y2,
        cx: m.n > 0 ? m.sx / m.n : NaN,
        cy: m.n > 0 ? m.sy / m.n : NaN,
      })
      return {
        largura: width,
        altura: height,
        chao: fechar(r.chao),
        grade: fechar(r.grade),
        ficha: fechar(r.ficha),
        oculta: fechar(r.oculta),
        fracaoNaoChaoNaOculta: total > 0 ? naoChao / total : NaN,
        pixelsNoOlho: total,
      }
    },
    { b64: png.toString('base64'), filtrar: soCanvas, olho: OLHO },
  )
}

async function foto(page: Page): Promise<Foto> {
  for (let tentativa = 1; tentativa <= 3; tentativa += 1) {
    try {
      return await page.screenshot()
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
  }
  throw new Error('não consegui fotografar')
}

/** O editor: cores sobre o canvas do mapa. */
async function editor(page: Page): Promise<Leitura> {
  await page.waitForTimeout(PINTURA_MS)
  return lerPng(page, await foto(page), true)
}

function ondeEsta(l: Leitura): string {
  return `imagem ${l.largura}x${l.altura}; chão ${l.chao.n} px de (${l.chao.x1}, ${l.chao.y1}) a (${l.chao.x2}, ${l.chao.y2}); grade ${l.grade.n} px; ficha ${l.ficha.n} px em (${l.ficha.cx.toFixed(1)}, ${l.ficha.cy.toFixed(1)}); oculta (azul) ${l.oculta.n} px; quadrado da oculta ${(l.fracaoNaoChaoNaOculta * 100).toFixed(1)}% não-chão em ${l.pixelsNoOlho} px`
}

// ───────────────────────────────────────────────────────────────────────────
// As jornadas
// ───────────────────────────────────────────────────────────────────────────

test('1. controle: o mapa abre com chão, grade, ficha visível e ficha oculta no editor, e o rodapé de arquivo está lá', async ({ page }) => {
  test.setTimeout(180_000)
  await mestreAbreOMapa(page)

  // O rodapé de ações de arquivo existe e tem a exportação de hoje (a de pasta).
  await expect(page.getByRole('button', { name: 'Exportar mapa (pasta)' }), 'o rodapé de ações de arquivo deveria estar no editor').toBeVisible({ timeout: ESPERA })

  // A mesma função que vai ler o PNG exportado enxerga tudo na foto da tela.
  await expect
    .poll(async () => (await editor(page)).chao.n, { timeout: ESPERA_TELA, message: 'o editor deveria mostrar o chão magenta' })
    .toBeGreaterThan(PIXELS_DE_CHAO)
  const tela = await editor(page)
  const onde = ondeEsta(tela)
  expect(tela.grade.n, `o editor deveria mostrar a grade amarela — ${onde}`).toBeGreaterThan(PIXELS_DE_GRADE)
  expect(tela.ficha.n, `o editor deveria mostrar a ficha laranja — ${onde}`).toBeGreaterThan(PIXELS_DE_FICHA)
  // O mestre enxerga a ficha oculta (esmaecida) no editor, e o leitor acha o azul dela.
  // Só contagem aqui: a câmera do editor pode cortar o chão (rail, zoom), então a caixa
  // do chão na TELA não serve de régua de posição — no PNG exportado ela serve.
  expect(tela.oculta.n, `o editor deveria mostrar a ficha oculta (azul esmaecido) — ${onde}`).toBeGreaterThan(PIXELS_DE_OCULTA)
  expect(tela.oculta.cy, `a ficha oculta deveria estar abaixo da ficha visível — ${onde}`).toBeGreaterThan(tela.ficha.cy)
})

test('2. "Exportar imagem" salva um PNG da cena no estilo do editor: chão com a cor dele, proporção do mapa, ficha no canto certo', async ({ page }) => {
  test.setTimeout(180_000)
  const mestre = await mestreAbreOMapa(page)
  await expect.poll(async () => (await editor(page)).chao.n, { timeout: ESPERA_TELA }).toBeGreaterThan(PIXELS_DE_CHAO)

  const png = await exportarImagem(mestre, { grade: true, mestre: true })
  const img = await lerPng(page, png, false)
  const onde = ondeEsta(img)

  expect(img.chao.n, `a imagem deveria mostrar o chão magenta da cena — ${onde}`).toBeGreaterThan(PIXELS_DE_CHAO)
  const proporcao = (img.chao.x2 - img.chao.x1 + 1) / (img.chao.y2 - img.chao.y1 + 1)
  expect(
    Math.abs(proporcao - PROPORCAO_DO_CHAO) / PROPORCAO_DO_CHAO,
    `o chão na imagem deveria ter a proporção do mapa (${PROPORCAO_DO_CHAO.toFixed(3)}); saiu ${proporcao.toFixed(3)} — ${onde}`,
  ).toBeLessThan(TOLERANCIA_DA_PROPORCAO)
  expect(img.ficha.n, `a imagem deveria mostrar a ficha laranja — ${onde}`).toBeGreaterThan(PIXELS_DE_FICHA)
  const meioX = (img.chao.x1 + img.chao.x2) / 2
  const meioY = (img.chao.y1 + img.chao.y2) / 2
  expect(img.ficha.cx, `a ficha deveria sair na metade DIREITA do chão, sem espelhar — ${onde}`).toBeGreaterThan(meioX)
  expect(img.ficha.cy, `a ficha deveria sair na metade de CIMA do chão, sem virar — ${onde}`).toBeLessThan(meioY)
})

test('3. a opção da grade decide se a grade sai na imagem', async ({ page }) => {
  test.setTimeout(240_000)
  const mestre = await mestreAbreOMapa(page)
  await expect.poll(async () => (await editor(page)).grade.n, { timeout: ESPERA_TELA }).toBeGreaterThan(PIXELS_DE_GRADE)

  const comGrade = await lerPng(page, await exportarImagem(mestre, { grade: true, mestre: false }), false)
  expect(comGrade.chao.n, `a imagem com grade deveria mostrar o chão — ${ondeEsta(comGrade)}`).toBeGreaterThan(PIXELS_DE_CHAO)
  expect(comGrade.grade.n, `com "grade" ligada, a grade amarela deveria sair na imagem — ${ondeEsta(comGrade)}`).toBeGreaterThan(PIXELS_DE_GRADE)

  const semGrade = await lerPng(page, await exportarImagem(mestre, { grade: false, mestre: false }), false)
  expect(semGrade.chao.n, `a imagem sem grade deveria mostrar o chão — ${ondeEsta(semGrade)}`).toBeGreaterThan(PIXELS_DE_CHAO)
  expect(semGrade.grade.n, `com "grade" desligada, nenhuma linha da grade deveria sair na imagem — ${ondeEsta(semGrade)}`).toBeLessThanOrEqual(RESIDUO)

  // Desligar a grade na IMAGEM não apaga a grade do EDITOR.
  expect((await editor(page)).grade.n, 'depois de exportar sem grade, o editor deveria continuar mostrando a grade').toBeGreaterThan(PIXELS_DE_GRADE)
})

test('4. a opção "só do mestre" decide se a ficha oculta para jogadores sai na imagem; desligada, o lugar dela é chão liso', async ({ page }) => {
  test.setTimeout(240_000)
  const mestre = await mestreAbreOMapa(page)
  await expect.poll(async () => (await editor(page)).chao.n, { timeout: ESPERA_TELA }).toBeGreaterThan(PIXELS_DE_CHAO)

  // Grade desligada nas duas: só a ficha oculta pode sujar o quadrado olhado.
  const semSegredo = await lerPng(page, await exportarImagem(mestre, { grade: false, mestre: false }), false)
  const ondeSem = ondeEsta(semSegredo)
  expect(semSegredo.chao.n, `a imagem deveria mostrar o chão — ${ondeSem}`).toBeGreaterThan(PIXELS_DE_CHAO)
  expect(semSegredo.pixelsNoOlho, `o quadrado da ficha oculta deveria caber na imagem — ${ondeSem}`).toBeGreaterThan(0)
  expect(
    semSegredo.fracaoNaoChaoNaOculta,
    `com "só do mestre" desligada, o lugar da ficha oculta deveria ser chão liso na imagem — ${ondeSem}`,
  ).toBeLessThanOrEqual(FRACAO_CHAO_LISO)
  expect(semSegredo.ficha.n, `a ficha VISÍVEL continua na imagem sem os objetos do mestre — ${ondeSem}`).toBeGreaterThan(PIXELS_DE_FICHA)

  const comSegredo = await lerPng(page, await exportarImagem(mestre, { grade: false, mestre: true }), false)
  const ondeCom = ondeEsta(comSegredo)
  expect(
    comSegredo.fracaoNaoChaoNaOculta,
    `com "só do mestre" ligada, a ficha oculta deveria sair na imagem no canto de baixo à direita —${ondeCom}`,
  ).toBeGreaterThan(FRACAO_COM_FICHA)
  expect(comSegredo.ficha.n, `a ficha visível também sai — ${ondeCom}`).toBeGreaterThan(PIXELS_DE_FICHA)
})
