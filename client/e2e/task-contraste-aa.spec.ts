// CONTRASTE AA MEDIDO (fatia 21 do design consolidado, 22/10/2026).
//
// Nas telas principais (mestre a 1440: editor, ficha do token, página Cenas e
// o diálogo Configurar cena; jogador a 390: mapa e a folha Painel), cada
// texto à vista tem de passar a WCAG 2.2 AA:
//  - texto normal >= 4,5:1; texto grande (>= 24 px, ou >= 18,66 px em negrito)
//    >= 3:1;
//  - campos de digitar e de escolher (input, select, textarea): a borda ou o
//    fundo contra o que está atrás >= 3:1 (1.4.11, componente de interface).
// A cor do texto leva a opacidade dele e a dos ancestrais; o fundo é a pilha
// de fundos dos ancestrais composta de baixo para cima; num degradê, conta a
// parada de cor PIOR. Atrás de tudo fica a pedra do app (o fundo do body, ou
// o canvas, que no mestre e no jogador é escuro). Fundo de imagem (url) não dá
// para medir: entra no relatório como "sem medida" e não reprova.
// Fora da regra, como a WCAG manda: controle desabilitado (1.4.3, "inactive
// user interface component") e texto escondido do leitor e da vista (sr-only).
// O relatório inteiro vai como anexo `contraste` (JSON); a cópia legível mora
// em docs/design/consolidado/provas/contraste-aa.md.
import { test, expect, type Page, type WebSocketRoute } from '@playwright/test'
import { createEmptyMap } from '../src/lib/mapFactory'
import { serializeMap } from '../src/lib/mapFile'
import { createHostSession } from '../src/net/hostSession'
import type { HostMessage } from '../src/net/protocol'
import type { MapData } from '../src/types/map'
import { abrirPaginaDaMesa, livroDaMesa } from './helpers/colunaDireita'
import { abrirAventuraDeMentira } from './helpers/mestreDeMentira'

test.use({ trace: 'off', video: 'off' })

const AVENTURA = 'Contraste'
const CODIGO = 'CONT01'
const PASTA = 'C:/appdata/maps/map_contraste'

interface Achado { tela: string; tipo: 'texto' | 'componente'; onde: string; texto: string; razao: number; minimo: number; cor: string; fundo: string }

/**
 * Exceções justificadas por escrito (relatório em docs/design/consolidado/provas/contraste-aa.md):
 * o filete de 1 px dos campos de texto (`--lb-gr-filete-forte`, o do protótipo aprovado) fica entre 1,3 e
 * 1,6:1. O campo continua identificável sem ele: mora sempre sob o rótulo, mostra o valor ou o exemplo em
 * texto que passa do 4,5:1, e o foco acende o anel de latão de 8,4:1. Subir o filete a 3:1 muda a cara de
 * todo campo do app: fica para o usuário decidir (pendência da fatia 21).
 */
const EXCECOES: { tipo: Achado['tipo']; onde: RegExp; porque: string }[] = [
  { tipo: 'componente', onde: /^input\.(lb-input|pp-input)/, porque: 'filete de 1 px do protótipo; rótulo, texto e anel de foco identificam o campo' },
]
interface Relatorio { medidos: number; semMedida: string[]; reprovados: Achado[]; piores: Achado[] }

function disco(): Record<string, string> {
  const mapa: MapData = { ...createEmptyMap('map_contraste', AVENTURA, 30, 20, 50), tokens: [{ id: 't1', characterId: null, name: 'Goblin', x: 300, y: 300, size: 1, image: null }] }
  const aventura = { version: 1, id: 'adv_contraste', name: AVENTURA, startSceneId: 'scene_c', scenes: [{ id: 'scene_c', name: AVENTURA, file: 'map.json' }] }
  return { [`${PASTA}/map.json`]: serializeMap(mapa), [`${PASTA}/adventure.json`]: JSON.stringify(aventura, null, 2) }
}

/** Mede a tela de agora, dentro da página, depois de toda entrada animada assentar (uma folha no meio do fade mediria a opacidade do meio). */
async function medir(page: Page, tela: string): Promise<Relatorio> {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity), null, { timeout: 5_000 })
  return page.evaluate((tela) => {
    type Cor = [number, number, number, number]
    const lerCores = (texto: string): Cor[] =>
      Array.from(texto.matchAll(/rgba?\(([^)]+)\)/g), (m) => {
        const [r, g, b, a] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
        return [r, g, b, Number.isFinite(a) ? a : 1]
      })
    const sobre = (cima: Cor, baixo: Cor): Cor => {
      const a = cima[3] + baixo[3] * (1 - cima[3])
      if (a === 0) return [0, 0, 0, 0]
      const canal = (i: number) => (cima[i] * cima[3] + baixo[i] * baixo[3] * (1 - cima[3])) / a
      return [canal(0), canal(1), canal(2), a]
    }
    const luz = (c: Cor) => {
      const lin = (v: number) => {
        const s = v / 255
        return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
    }
    const razao = (a: Cor, b: Cor) => {
      const [x, y] = [luz(a), luz(b)].sort((p, q) => q - p)
      return (x + 0.05) / (y + 0.05)
    }
    const hex = (c: Cor) => `rgb(${c.slice(0, 3).map(Math.round).join(',')})`
    const corpo = lerCores(getComputedStyle(document.body).backgroundColor)[0]
    const PEDRA: Cor = corpo !== undefined && corpo[3] > 0 ? corpo : [20, 20, 24, 1]
    const semMedida: string[] = []
    const nome = (el: Element) => {
      const classe = typeof el.className === 'string' && el.className.trim() !== '' ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''
      return `${el.tagName.toLowerCase()}${classe}`
    }
    /**
     * Os fundos possíveis atrás do elemento (um por parada de cor de cada degradê da pilha); `null` = imagem.
     * A pilha são os ancestrais e, em cada um, o filho posto em posição absoluta por baixo do texto que não
     * é ancestral (a fita de latão sob o marcador escolhido, a placa sob a ferramenta armada).
     */
    const fundos = (el: Element): Cor[] | null => {
      const r = el.getBoundingClientRect()
      const cx = r.left + r.width / 2
      const cy = r.top + r.height / 2
      const pilha: Element[] = []
      for (let atual: Element | null = el; atual !== null; atual = atual.parentElement) pilha.push(atual)
      const naPilha = new Set(pilha)
      let possiveis: Cor[] = [PEDRA]
      const pintar = (camada: Element): boolean => {
        const cs = getComputedStyle(camada)
        const imagem = cs.backgroundImage
        if (imagem.includes('url(')) return false
        const opac = Number(cs.opacity)
        const paradas = imagem === 'none' ? [] : lerCores(imagem).map((q): Cor => [q[0], q[1], q[2], q[3] * opac])
        const base = lerCores(cs.backgroundColor)[0] ?? [0, 0, 0, 0]
        const cor: Cor = [base[0], base[1], base[2], base[3] * opac]
        possiveis = possiveis.map((p) => sobre(cor, p))
        if (paradas.length > 0) possiveis = possiveis.flatMap((p) => paradas.map((q) => sobre(q, p)))
        if (possiveis.length > 12) possiveis = possiveis.slice(0, 12)
        return true
      }
      for (const camada of pilha.reverse()) {
        if (!pintar(camada)) return null
        for (const filho of Array.from(camada.children)) {
          if (naPilha.has(filho) || getComputedStyle(filho).position !== 'absolute' || !filho.checkVisibility({ opacityProperty: true })) continue
          const f = filho.getBoundingClientRect()
          if (cx < f.left || cx > f.right || cy < f.top || cy > f.bottom) continue
          if (!pintar(filho)) return null
        }
      }
      return possiveis
    }
    const opacidade = (el: Element) => {
      let o = 1
      for (let atual: Element | null = el; atual !== null; atual = atual.parentElement) o *= Number(getComputedStyle(atual).opacity)
      return o
    }
    const desabilitado = (el: Element) => el.closest(':disabled, [aria-disabled="true"], [inert]') !== null
    const achados: { tela: string; tipo: 'texto' | 'componente'; onde: string; texto: string; razao: number; minimo: number; cor: string; fundo: string }[] = []
    let medidos = 0
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      if (el.closest('svg, canvas') !== null) continue
      const proprio = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim()
      // O input de arquivo some atrás do próprio botão (::file-selector-button), que é medido pelo texto.
      const campo = el.matches('input:not([type=hidden]):not([type=range]):not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]), select, textarea')
      if (proprio === '' && !campo) continue
      const caixa = el.getBoundingClientRect()
      if (caixa.width < 2 || caixa.height < 2 || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue
      if (caixa.right < 0 || caixa.bottom < 0 || caixa.left > innerWidth || caixa.top > innerHeight) continue
      if (desabilitado(el)) continue
      const cs = getComputedStyle(el)
      if (cs.clip === 'rect(0px, 0px, 0px, 0px)' || (caixa.width <= 1 && caixa.height <= 1)) continue
      const atras = fundos(el)
      if (atras === null) {
        semMedida.push(`${tela}: ${nome(el)} "${proprio.slice(0, 30)}" (fundo de imagem)`)
        continue
      }
      const o = opacidade(el)
      if (proprio !== '') {
        const corTexto = lerCores(cs.color)[0]
        const comAlfa: Cor = [corTexto[0], corTexto[1], corTexto[2], corTexto[3] * o]
        const tamanho = parseFloat(cs.fontSize)
        const grande = tamanho >= 24 || (tamanho >= 18.66 && Number(cs.fontWeight) >= 700)
        const minimo = grande ? 3 : 4.5
        const pior = atras.map((f) => ({ f, r: razao(sobre(comAlfa, f), f) })).sort((a, b) => a.r - b.r)[0]
        medidos++
        achados.push({ tela, tipo: 'texto', onde: nome(el), texto: proprio.slice(0, 40), razao: Math.round(pior.r * 100) / 100, minimo, cor: hex(sobre(comAlfa, pior.f)), fundo: hex(pior.f) })
      }
      if (campo) {
        const atrasDoCampo = el.parentElement === null ? atras : (fundos(el.parentElement) ?? atras)
        const proprioFundo = atras
        const borda = lerCores(cs.borderTopColor)[0]
        const temBorda = parseFloat(cs.borderTopWidth) > 0 && borda !== undefined && borda[3] > 0
        const melhor = Math.max(
          ...atrasDoCampo.map((f) => (temBorda ? razao(sobre([borda[0], borda[1], borda[2], borda[3] * o], f), f) : 1)),
          ...atrasDoCampo.map((f, i) => razao(proprioFundo[Math.min(i, proprioFundo.length - 1)], f)),
        )
        medidos++
        achados.push({ tela, tipo: 'componente', onde: nome(el), texto: (el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? '').slice(0, 40), razao: Math.round(melhor * 100) / 100, minimo: 3, cor: temBorda ? hex(borda) : 'sem borda', fundo: hex(atrasDoCampo[0]) })
      }
    }
    const reprovados = achados.filter((a) => a.razao < a.minimo)
    const piores = [...achados].sort((a, b) => a.razao / a.minimo - b.razao / b.minimo).slice(0, 8)
    return { medidos, semMedida, reprovados, piores }
  }, tela)
}

async function entrarComoJogador(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 })
  const mapa: MapData = { ...createEmptyMap('m-contraste', AVENTURA, 20, 12, 50), tokens: [{ id: 'tok-a', characterId: null, name: 'Heroi', x: 250, y: 300, size: 1, image: null }] }
  const sessao = createHostSession({ code: CODIGO, visionRadius: 2000, randomId: (() => { let n = 0; return () => `id-${++n}` })() })
  let socket: WebSocketRoute | null = null
  let jogador: string | null = null
  const enviar = (saida: { clientId: string; msg: HostMessage }[]) => {
    for (const { clientId, msg } of saida) {
      if (clientId !== 'c1' || socket === null) continue
      socket.send(JSON.stringify(msg))
      if (msg.type === 'welcome') jogador = msg.playerId
    }
  }
  await page.routeWebSocket((url) => url.pathname === '/ws', (ws) => {
    socket = ws
    ws.onMessage((raw) => enviar(sessao.handleMessage('c1', typeof raw === 'string' ? raw : raw.toString('utf8'), mapa).outbound))
  })
  await page.goto('/player.html')
  await page.getByLabel('Código da sala').fill(CODIGO)
  await page.getByLabel('Seu nome').fill('Ana')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('status')).toHaveText(/Aguardando o mestre/)
  const id: string | null = jogador
  if (id === null) throw new Error('o mestre de mentira não mandou welcome')
  sessao.assignToken(id, 'tok-a')
  enviar(sessao.broadcast(mapa).outbound)
  await expect(page.getByRole('button', { name: 'Minha ficha' })).toBeVisible()
}

test('contraste AA nas telas principais do mestre (1440) e do jogador (390)', async ({ page, browser }) => {
  test.setTimeout(120_000)
  const relatorios: Relatorio[] = []
  await page.setViewportSize({ width: 1440, height: 900 })
  await abrirAventuraDeMentira(page, disco(), AVENTURA, CODIGO)
  await expect(page.getByRole('toolbar', { name: 'Ferramentas do mapa' })).toBeVisible()
  relatorios.push(await medir(page, 'mestre: editor'))
  await page.evaluate(async () => {
    const store = (await import('/src/stores/mapStore.ts')).useMapStore.getState()
    store.setActiveTool('select')
    store.setSelection([{ kind: 'token', id: 't1' }])
  })
  await expect(page.getByRole('complementary', { name: 'Livro do mestre' }).getByText('Goblin').first()).toBeVisible()
  relatorios.push(await medir(page, 'mestre: ficha do token'))
  await abrirPaginaDaMesa(page, 'Cenas')
  relatorios.push(await medir(page, 'mestre: página Cenas'))
  await livroDaMesa(page).getByRole('button', { name: `Configurar ${AVENTURA}` }).click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  // O diálogo entra em 220 ms: mede depois da entrada, com a opacidade final.
  await page.waitForTimeout(400)
  relatorios.push(await medir(page, 'mestre: diálogo Configurar cena'))

  const contexto = await browser.newContext()
  const jogador = await contexto.newPage()
  await entrarComoJogador(jogador)
  relatorios.push(await medir(jogador, 'jogador: mapa'))
  await jogador.getByRole('button', { name: 'Painel' }).click()
  await expect(jogador.getByRole('complementary', { name: 'Painel do jogador' })).toBeVisible()
  await jogador.waitForTimeout(400)
  relatorios.push(await medir(jogador, 'jogador: Painel'))
  await contexto.close()

  const todos = relatorios.flatMap((r) => r.reprovados)
  const excecao = (a: Achado) => EXCECOES.find((e) => e.tipo === a.tipo && e.onde.test(a.onde))
  const juntos = {
    medidos: relatorios.reduce((s, r) => s + r.medidos, 0),
    semMedida: relatorios.flatMap((r) => r.semMedida),
    excecoes: todos.filter((a) => excecao(a) !== undefined).map((a) => ({ ...a, porque: excecao(a)?.porque })),
    reprovados: todos.filter((a) => excecao(a) === undefined),
    piores: relatorios.flatMap((r) => r.piores).sort((a, b) => a.razao / a.minimo - b.razao / b.minimo).slice(0, 12),
  }
  await test.info().attach('contraste', { body: JSON.stringify(juntos, null, 2), contentType: 'application/json' })
  expect(juntos.medidos).toBeGreaterThan(100)
  expect(juntos.reprovados, JSON.stringify(juntos.reprovados.slice(0, 40))).toEqual([])
})
