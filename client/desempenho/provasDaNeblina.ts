import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

/**
 * PROVAS DA NEBLINA (06/11/2026, regra de teste de jogos): rodam no fim da
 * mesa do `mapa-grande.spec.ts` quando `LAB_DES_NEBLINA_PROVAS` aponta uma
 * pasta FORA do repositório. Saem: a folha de contato (12 quadros da tela do
 * jogador ao longo de 6 s, numa imagem só, com o tempo embaixo de cada um) e
 * quatro prints de layout (mestre de dia, jogador de dia sobre o que ele não
 * explorou, jogador à noite, editor com o pincel). Não medem nada: a medida
 * é a dos cenários de antes.
 */

interface SondaDaNeblina {
  mapStore: {
    getState: () => {
      setNeblinaDoMapa: (n: { ligada: boolean; intensidade: number }) => void
      setPeriodoFixo: (p: 'dia' | 'tarde' | 'noite' | undefined) => void
      setActiveTool: (t: string) => void
    }
  }
}

const QUADROS = 12
const INTERVALO_MS = 500

async function naSonda(page: Page, passo: 'ligar' | 'desligar' | 'noite' | 'dia' | 'pincel', intensidade = 60): Promise<void> {
  await page.evaluate(
    ([qual, n]) => {
      const s = (window as unknown as { __labSonda: SondaDaNeblina }).__labSonda.mapStore.getState() // as: a sonda do app (`registrarNaSonda`)
      if (qual === 'ligar') s.setNeblinaDoMapa({ ligada: true, intensidade: n })
      else if (qual === 'desligar') s.setNeblinaDoMapa({ ligada: false, intensidade: n })
      else if (qual === 'noite') s.setPeriodoFixo('noite')
      else if (qual === 'dia') s.setPeriodoFixo(undefined)
      else s.setActiveTool('neblina')
    },
    [passo, intensidade] as const,
  )
}

async function estadoDaNeblina(page: Page): Promise<string | null> {
  return page.evaluate(() => document.querySelector('[data-neblina]')?.getAttribute('data-neblina') ?? null)
}

/** Um recorte de 640 x 400 no meio do canvas. */
async function recorteDoMeio(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const caixa = await page.locator('canvas').first().boundingBox()
  if (caixa === null) throw new Error('provas da neblina: canvas sem caixa')
  const width = Math.min(640, Math.floor(caixa.width))
  const height = Math.min(400, Math.floor(caixa.height))
  return { x: Math.floor(caixa.x + (caixa.width - width) / 2), y: Math.floor(caixa.y + (caixa.height - height) / 2), width, height }
}

async function folhaDeContato(jogador: Page, pasta: string): Promise<{ quadros_diferentes: number }> {
  const clip = await recorteDoMeio(jogador)
  const quadros: Buffer[] = []
  const inicio = Date.now()
  for (let i = 0; i < QUADROS; i += 1) {
    const alvo = inicio + i * INTERVALO_MS
    const falta = alvo - Date.now()
    if (falta > 0) await jogador.waitForTimeout(falta)
    quadros.push(await jogador.screenshot({ clip }))
  }
  let diferentes = 0
  for (let i = 1; i < quadros.length; i += 1) if (!quadros[i].equals(quadros[i - 1])) diferentes += 1
  const celulas = quadros
    .map(
      (q, i) =>
        `<figure><img src="data:image/png;base64,${q.toString('base64')}" width="${clip.width / 2}" height="${clip.height / 2}"><figcaption>t = ${((i * INTERVALO_MS) / 1000).toFixed(1)} s</figcaption></figure>`,
    )
    .join('')
  const folha = await jogador.context().newPage()
  await folha.setViewportSize({ width: 4 * (clip.width / 2 + 12) + 12, height: 800 })
  await folha.setContent(
    `<html><body style="margin:0;padding:6px;background:#15171c;color:#c9ced6;font:13px system-ui">` +
      `<div style="padding:4px 6px 8px">Neblina na tela do jogador · 12 quadros em 6 s (0,5 s entre eles) · intensidade 60 · rascunho</div>` +
      `<div style="display:grid;grid-template-columns:repeat(4,auto);gap:6px">${celulas}</div>` +
      `<style>figure{margin:0}img{display:block;border-radius:4px}figcaption{padding:3px 0 0;text-align:center;font-variant-numeric:tabular-nums}</style></body></html>`,
  )
  await folha.screenshot({ path: path.join(pasta, 'folha-de-contato-jogador.png'), fullPage: true })
  await folha.close()
  return { quadros_diferentes: diferentes }
}

export async function provasDaNeblina(mestre: Page, jogador: Page, pasta: string): Promise<Record<string, unknown>> {
  mkdirSync(pasta, { recursive: true })
  await naSonda(mestre, 'ligar')
  // A bruma aparece em 0,9 s; o pacote leva um tempo até o jogador.
  await jogador.waitForTimeout(2000)
  const folha = await folhaDeContato(jogador, pasta)
  await mestre.screenshot({ path: path.join(pasta, '1-mestre-dia.png') })
  await jogador.screenshot({ path: path.join(pasta, '2-jogador-dia-sobre-o-nao-explorado.png') })
  await naSonda(mestre, 'noite')
  await jogador.waitForTimeout(2000)
  await jogador.screenshot({ path: path.join(pasta, '3-jogador-noite.png') })
  const noJogador = await estadoDaNeblina(jogador)
  await naSonda(mestre, 'dia')
  // Editor: a chave desligada, o pincel na mão e uma pincelada no meio do mapa.
  await naSonda(mestre, 'desligar')
  await naSonda(mestre, 'pincel')
  const caixa = await recorteDoMeio(mestre)
  const y = caixa.y + caixa.height / 2
  await mestre.mouse.move(caixa.x + caixa.width * 0.2, y)
  await mestre.mouse.down()
  for (let i = 1; i <= 12; i += 1) await mestre.mouse.move(caixa.x + caixa.width * (0.2 + 0.05 * i), y + Math.sin(i / 2) * 40)
  await mestre.mouse.up()
  await mestre.waitForTimeout(1500)
  await mestre.screenshot({ path: path.join(pasta, '4-editor-com-o-pincel.png') })
  const noMestre = await estadoDaNeblina(mestre)
  const mascara = await mestre.evaluate(() => document.querySelector('[data-neblina-mascara]')?.getAttribute('data-neblina-mascara') ?? null)
  const resumo = { ...folha, neblina_no_jogador: noJogador, neblina_no_mestre_com_pincel: noMestre, mascara_do_pincel: mascara }
  writeFileSync(path.join(pasta, 'provas.json'), JSON.stringify(resumo, null, 2))
  return resumo
}
