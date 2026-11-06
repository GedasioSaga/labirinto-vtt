import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

/**
 * PROVAS DA NEBLINA (06/11/2026, regra de teste de jogos): rodam no fim da
 * mesa do `mapa-grande.spec.ts` quando `LAB_DES_NEBLINA_PROVAS` aponta uma
 * pasta FORA do repositório. Saem:
 * - a folha de contato: as três densidades (baixa, média, alta) lado a lado,
 *   12 quadros da tela do jogador ao longo de 6 s em cada uma, com o tempo
 *   embaixo, e o quanto de cada quadro a bruma cobre (medido contra o quadro
 *   sem neblina);
 * - a curva do aparecer (0,9 s) e do sumir (0,3 s) no mestre: o brilho que a
 *   bruma soma a cada instante depois de ligar e de desligar a chave;
 * - quatro prints de layout (mestre de dia, jogador de dia sobre o que ele não
 *   explorou, jogador à noite, editor com duas pinceladas de densidades
 *   diferentes).
 * Não medem quadro: a medida é a dos cenários de antes.
 */

interface SondaDaNeblina {
  mapStore: {
    getState: () => {
      setNeblinaDoMapa: (n: { ligada: boolean; intensidade: number; densidade?: number }) => void
      setPeriodoFixo: (p: 'dia' | 'tarde' | 'noite' | undefined) => void
      setActiveTool: (t: string) => void
    }
  }
}

const QUADROS = 12
const INTERVALO_MS = 500
const INTENSIDADE = 60
/** A de hoje (o padrão de quem abre um mapa sem o campo). */
const DENSIDADE_MEDIA = 50
/** As três colunas da folha, para o mestre escolher. */
const DENSIDADES = [
  { nome: 'Baixa', valor: 15 },
  { nome: 'Média', valor: DENSIDADE_MEDIA },
  { nome: 'Alta', valor: 85 },
] as const
/** Quanto tempo a curva do aparecer e a do sumir são amostradas (ms). */
const AMOSTRA_APARECER_MS = 1400
const AMOSTRA_SUMIR_MS = 700
/** Diferença de brilho (0 a 255) a partir da qual o pixel conta como coberto pela bruma. */
const LIMIAR_DE_COBERTURA = 8

type PassoDaSonda = 'ligar' | 'desligar' | 'noite' | 'dia' | 'pincel'

async function naSonda(page: Page, passo: PassoDaSonda, densidade: number = DENSIDADE_MEDIA): Promise<void> {
  await page.evaluate(
    ([qual, intensidade, d]) => {
      const s = (window as unknown as { __labSonda: SondaDaNeblina }).__labSonda.mapStore.getState() // as: a sonda do app (`registrarNaSonda`)
      if (qual === 'ligar') s.setNeblinaDoMapa({ ligada: true, intensidade, densidade: d })
      else if (qual === 'desligar') s.setNeblinaDoMapa({ ligada: false, intensidade, densidade: d })
      else if (qual === 'noite') s.setPeriodoFixo('noite')
      else if (qual === 'dia') s.setPeriodoFixo(undefined)
      else s.setActiveTool('neblina')
    },
    [passo, INTENSIDADE, densidade] as const,
  )
}

async function estadoDaNeblina(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('[data-neblina]')?.getAttribute('data-neblina') ?? null)
}

interface Recorte {
  x: number
  y: number
  width: number
  height: number
}

/** Um recorte de até `largura` x `altura` no meio do canvas. */
async function recorteDoMeio(page: Page, largura = 640, altura = 400): Promise<Recorte> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (caixa === null) throw new Error('provas da neblina: canvas sem caixa')
  const width = Math.min(largura, Math.floor(caixa.width))
  const height = Math.min(altura, Math.floor(caixa.height))
  return { x: Math.floor(caixa.x + (caixa.width - width) / 2), y: Math.floor(caixa.y + (caixa.height - height) / 2), width, height }
}

interface Medida {
  /** Brilho médio que a bruma somou ao quadro (0 a 255). */
  delta: number
  /** Fração dos pixels que a bruma mudou acima do limiar. */
  cobre: number
}

/** Mede cada quadro contra a referência sem neblina, numa página em branco (canvas 2D do navegador, sem dependência). */
async function medirContraReferencia(pagina: Page, referencia: Buffer, quadros: readonly Buffer[]): Promise<Medida[]> {
  return pagina.evaluate(
    async ([ref, lista, limiar]) => {
      async function pixels(b64: string): Promise<Uint8ClampedArray> {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const tela = document.createElement('canvas')
        tela.width = img.width
        tela.height = img.height
        const g = tela.getContext('2d')
        if (g === null) throw new Error('sem canvas 2d')
        g.drawImage(img, 0, 0)
        return g.getImageData(0, 0, tela.width, tela.height).data
      }
      const luma = (d: Uint8ClampedArray, i: number) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      const base = await pixels(ref)
      const saida: Array<{ delta: number; cobre: number }> = []
      for (const quadro of lista) {
        const px = await pixels(quadro)
        let soma = 0
        let cobertos = 0
        for (let i = 0; i < px.length; i += 4) {
          const diferenca = Math.abs(luma(px, i) - luma(base, i))
          soma += diferenca
          if (diferenca > limiar) cobertos += 1
        }
        const n = px.length / 4
        saida.push({ delta: Math.round((soma / n) * 10) / 10, cobre: Math.round((cobertos / n) * 1000) / 1000 })
      }
      return saida
    },
    [referencia.toString('base64'), quadros.map((q) => q.toString('base64')), LIMIAR_DE_COBERTURA] as const,
  )
}

async function quadrosAoLongoDoTempo(page: Page, clip: Recorte): Promise<Buffer[]> {
  const quadros: Buffer[] = []
  const inicio = Date.now()
  for (let i = 0; i < QUADROS; i += 1) {
    const falta = inicio + i * INTERVALO_MS - Date.now()
    if (falta > 0) await page.waitForTimeout(falta)
    quadros.push(await page.screenshot({ clip }))
  }
  return quadros
}

const ESTILO_DA_FOLHA =
  `<style>body{margin:0;padding:8px;background:#15171c;color:#c9ced6;font:13px system-ui}` +
  `figure{margin:0}img{display:block;border-radius:4px}figcaption{padding:3px 0 0;text-align:center;font-variant-numeric:tabular-nums}` +
  `.cab{padding:4px 2px 8px;font-weight:600;text-align:center}.t{align-self:center;text-align:right;padding-right:6px;font-variant-numeric:tabular-nums}</style>`

async function folhaDeContato(mestre: Page, jogador: Page, pasta: string): Promise<Record<string, unknown>> {
  const clip = await recorteDoMeio(jogador)
  await naSonda(mestre, 'desligar')
  await jogador.waitForTimeout(2000)
  const referencia = await jogador.screenshot({ clip })
  const colunas: Array<{ nome: string; valor: number; quadros: Buffer[] }> = []
  for (const densidade of DENSIDADES) {
    await naSonda(mestre, 'ligar', densidade.valor)
    // O pacote leva um tempo até o jogador, e a bruma aparece em 0,9 s.
    await jogador.waitForTimeout(2000)
    colunas.push({ nome: densidade.nome, valor: densidade.valor, quadros: await quadrosAoLongoDoTempo(jogador, clip) })
  }
  const folha = await jogador.context().newPage()
  const medidas = await Promise.all(colunas.map((c) => medirContraReferencia(folha, referencia, c.quadros)))
  const largura = clip.width / 2
  const altura = clip.height / 2
  const cabecalho =
    `<div></div>` +
    colunas
      .map((c, i) => {
        const cobreMedia = medidas[i].reduce((s, m) => s + m.cobre, 0) / medidas[i].length
        return `<div class="cab">${c.nome} · densidade ${c.valor}${c.valor === DENSIDADE_MEDIA ? ' (a de hoje)' : ''}<br><span style="font-weight:400">cobre ${Math.round(cobreMedia * 100)}% do quadro</span></div>`
      })
      .join('')
  const linhas = Array.from({ length: QUADROS }, (_, linha) => {
    const tempo = `<div class="t">t = ${((linha * INTERVALO_MS) / 1000).toFixed(1).replace('.', ',')} s</div>`
    const celulas = colunas
      .map(
        (c, i) =>
          `<figure><img src="data:image/png;base64,${c.quadros[linha].toString('base64')}" width="${largura}" height="${altura}"><figcaption>cobre ${Math.round(medidas[i][linha].cobre * 100)}%</figcaption></figure>`,
      )
      .join('')
    return tempo + celulas
  }).join('')
  await folha.setViewportSize({ width: 80 + 3 * (largura + 8) + 16, height: 800 })
  await folha.setContent(
    `<html><body>${ESTILO_DA_FOLHA}` +
      `<div style="padding:4px 2px 10px">Neblina na tela do jogador · 3 densidades lado a lado · 12 quadros em 6 s (0,5 s entre eles) · intensidade ${INTENSIDADE} · rascunho para escolher</div>` +
      `<div style="display:grid;grid-template-columns:80px repeat(3,auto);gap:6px">${cabecalho}${linhas}</div></body></html>`,
  )
  await folha.screenshot({ path: path.join(pasta, 'folha-de-contato-densidades.png'), fullPage: true })
  await folha.close()
  const diferentes = (q: Buffer[]) => q.slice(1).filter((b, i) => !b.equals(q[i])).length
  return Object.fromEntries(
    colunas.map((c, i) => [
      `densidade_${c.valor}`,
      { quadros_diferentes: diferentes(c.quadros), cobre_por_quadro: medidas[i].map((m) => m.cobre), delta_por_quadro: medidas[i].map((m) => m.delta) },
    ]),
  )
}

/** Amostra o recorte o mais rápido que dá durante `duracaoMs`, a partir de agora. */
async function amostrar(page: Page, clip: Recorte, duracaoMs: number): Promise<Array<{ t: number; png: Buffer }>> {
  const inicio = Date.now()
  const saida: Array<{ t: number; png: Buffer }> = []
  while (Date.now() - inicio < duracaoMs) {
    const t = Date.now() - inicio
    saida.push({ t, png: await page.screenshot({ clip }) })
  }
  return saida
}

/** A curva do aparecer e do sumir no mestre (sem a espera da rede): brilho somado pela bruma em cada instante. */
async function curvaDoFade(mestre: Page, pasta: string): Promise<Record<string, unknown>> {
  const clip = await recorteDoMeio(mestre, 320, 200)
  await naSonda(mestre, 'desligar')
  await mestre.waitForTimeout(1000)
  const referencia = await mestre.screenshot({ clip })
  await naSonda(mestre, 'ligar')
  const aparecer = await amostrar(mestre, clip, AMOSTRA_APARECER_MS)
  await naSonda(mestre, 'desligar')
  const sumir = await amostrar(mestre, clip, AMOSTRA_SUMIR_MS)
  const pagina = await mestre.context().newPage()
  const medAparecer = await medirContraReferencia(pagina, referencia, aparecer.map((a) => a.png))
  const medSumir = await medirContraReferencia(pagina, referencia, sumir.map((a) => a.png))
  const celula = (rotulo: string, a: { t: number; png: Buffer }, m: Medida) =>
    `<figure><img src="data:image/png;base64,${a.png.toString('base64')}" width="${clip.width / 2}" height="${clip.height / 2}"><figcaption>${rotulo} ${a.t} ms · +${m.delta}</figcaption></figure>`
  await pagina.setViewportSize({ width: 8 * (clip.width / 2 + 6) + 16, height: 600 })
  await pagina.setContent(
    `<html><body>${ESTILO_DA_FOLHA}` +
      `<div style="padding:4px 2px 8px">Aparecer (0,9 s) e sumir (0,3 s) no mestre · o número é o brilho que a bruma soma ao quadro (0 a 255)</div>` +
      `<div style="display:grid;grid-template-columns:repeat(8,auto);gap:6px">${aparecer.map((a, i) => celula('ligou +', a, medAparecer[i])).join('')}</div>` +
      `<div style="height:10px"></div>` +
      `<div style="display:grid;grid-template-columns:repeat(8,auto);gap:6px">${sumir.map((a, i) => celula('desligou +', a, medSumir[i])).join('')}</div></body></html>`,
  )
  await pagina.screenshot({ path: path.join(pasta, 'curva-aparecer-e-sumir.png'), fullPage: true })
  await pagina.close()
  return {
    aparecer: aparecer.map((a, i) => ({ t_ms: a.t, delta: medAparecer[i].delta })),
    sumir: sumir.map((a, i) => ({ t_ms: a.t, delta: medSumir[i].delta })),
  }
}

/** Leva o controle (`rotulo`, o `indice`-ésimo com esse nome) ao valor pelo teclado, como a pessoa faria, e devolve o número que o painel mostra. */
async function ajustarPeloTeclado(page: Page, rotulo: string, indice: number, ida: 'Home' | 'End', passos: number): Promise<string | null> {
  const campo = page.getByLabel(rotulo, { exact: true }).nth(indice)
  await campo.focus()
  await page.keyboard.press(ida)
  for (let i = 0; i < passos; i += 1) await page.keyboard.press(ida === 'Home' ? 'ArrowRight' : 'ArrowLeft')
  return campo.evaluate((el) => el.closest('.lb-field')?.querySelector('.lb-num')?.textContent ?? null)
}

async function pincelada(page: Page, caixa: Recorte, altura: number): Promise<void> {
  const y = caixa.y + caixa.height * altura
  await page.mouse.move(caixa.x + caixa.width * 0.2, y)
  await page.mouse.down()
  for (let i = 1; i <= 12; i += 1) await page.mouse.move(caixa.x + caixa.width * (0.2 + 0.05 * i), y + Math.sin(i / 2) * 20)
  await page.mouse.up()
}

export async function provasDaNeblina(mestre: Page, jogador: Page, pasta: string): Promise<Record<string, unknown>> {
  mkdirSync(pasta, { recursive: true })
  const folha = await folhaDeContato(mestre, jogador, pasta)
  const fade = await curvaDoFade(mestre, pasta)
  // Prints de layout, na densidade de hoje.
  await naSonda(mestre, 'ligar')
  await jogador.waitForTimeout(2000)
  await mestre.screenshot({ path: path.join(pasta, '1-mestre-dia.png') })
  await jogador.screenshot({ path: path.join(pasta, '2-jogador-dia-sobre-o-nao-explorado.png') })
  await naSonda(mestre, 'noite')
  await jogador.waitForTimeout(2000)
  await jogador.screenshot({ path: path.join(pasta, '3-jogador-noite.png') })
  const noJogador = await estadoDaNeblina(jogador)
  await naSonda(mestre, 'dia')
  // Editor: a chave desligada, o pincel na mão e duas pinceladas, a de cima rala e a de baixo densa.
  await naSonda(mestre, 'desligar')
  await naSonda(mestre, 'pincel')
  await mestre.waitForTimeout(300)
  const tamanho = await ajustarPeloTeclado(mestre, 'Tamanho do pincel', 0, 'Home', 12)
  const rala = await ajustarPeloTeclado(mestre, 'Densidade', 1, 'Home', 3)
  const caixa = await recorteDoMeio(mestre)
  await pincelada(mestre, caixa, 0.3)
  const densa = await ajustarPeloTeclado(mestre, 'Densidade', 1, 'End', 3)
  await pincelada(mestre, caixa, 0.72)
  await mestre.waitForTimeout(1500)
  await mestre.screenshot({ path: path.join(pasta, '4-editor-com-o-pincel.png') })
  const noMestre = await estadoDaNeblina(mestre)
  const mascara = await mestre.evaluate(() => document.querySelector('[data-neblina-mascara]')?.getAttribute('data-neblina-mascara') ?? null)
  const resumo = {
    folha,
    fade,
    neblina_no_jogador: noJogador,
    neblina_no_mestre_com_pincel: noMestre,
    mascara_do_pincel: mascara,
    painel_pelo_teclado: { tamanho, densidade_rala: rala, densidade_densa: densa },
  }
  writeFileSync(path.join(pasta, 'provas.json'), JSON.stringify(resumo, null, 2))
  return resumo
}
