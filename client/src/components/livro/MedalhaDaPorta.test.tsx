import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carregarPacoteDeAnimacoes, esquecerPacoteCarregado, type OrigemDoPacote } from '../../lib/pacoteDeAnimacoes'
import { esquecerAnimacoesDePortaDeFora } from '../../portas/animacoesDePorta'
import type { DoorState } from '../../types/map'
import { MedalhaDaPorta } from './MedalhaDaPorta'

/**
 * A MEDALHA ANDA NO PASSO DO MAPA (22/10/2026): as curvas declaradas da
 * animação (`curvaAbrir`/`curvaFechar`) chegam ao svg como
 * `--lb-porta-curva-abre`/`--lb-porta-curva-fecha` (`curvasDaMedalha`), e o
 * `fichaDaPorta.css` as usa em cada sentido. Sem curva, nada é posto e o CSS
 * cai no `--lb-gr-ease-porta`.
 */
let container: HTMLDivElement
let root: Root

/** Curvas diferentes nos dois sentidos: trocar uma pela outra não passa despercebido. */
const ABRE = [0.1, 0.2, 0.3, 0.4] as const
const FECHA = [0.5, 0.6, 0.7, 0.8] as const

async function registrarPortaComCurvas(): Promise<void> {
  const animacoes = [{ id: 'teste-curvas', tipo: 'porta', nome: 'Teste das curvas', duracaoMs: 500, duracaoFecharMs: 300, curvaAbrir: ABRE, curvaFechar: FECHA, arquivo: 'porta-teste-curvas.js' }]
  const indice = JSON.stringify({ formato: 1, versao: 1, motorMinimo: '0.4.21', arquivos: [{ nome: 'porta-teste-curvas.js', sha256: 'a'.repeat(64), tamanho: 10 }], animacoes })
  const origem: OrigemDoPacote = { lerIndice: async () => indice, importar: async () => ({ default: () => {} }) }
  vi.spyOn(console, 'info').mockImplementation(() => {})
  await carregarPacoteDeAnimacoes(origem, indice)
}

beforeEach(async () => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  await registrarPortaComCurvas()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  esquecerPacoteCarregado()
  esquecerAnimacoesDePortaDeFora()
  vi.restoreAllMocks()
})

function estiloDaMedalha(porta: Pick<DoorState, 'open' | 'locked' | 'secret' | 'animacao' | 'cor'>): CSSStyleDeclaration {
  act(() => root.render(<MedalhaDaPorta porta={porta} />))
  const svg = container.querySelector<SVGSVGElement>('svg.lb-medalha-porta')
  if (svg === null) throw new Error('a medalha não desenhou o svg')
  return svg.style
}

describe('MedalhaDaPorta: as curvas da animação no svg (curvasDaMedalha)', () => {
  it('a curva de abrir e a de fechar, cada uma na sua variável, em cubic-bezier', () => {
    const estilo = estiloDaMedalha({ open: false, locked: false, animacao: 'teste-curvas' })
    expect(estilo.getPropertyValue('--lb-porta-curva-abre')).toBe('cubic-bezier(0.1, 0.2, 0.3, 0.4)')
    expect(estilo.getPropertyValue('--lb-porta-curva-fecha')).toBe('cubic-bezier(0.5, 0.6, 0.7, 0.8)')
    expect(estilo.getPropertyValue('--lb-porta-abre')).toBe('500ms')
    expect(estilo.getPropertyValue('--lb-porta-fecha')).toBe('300ms')
  })

  it('animação sem curva declarada (Girar) não põe as variáveis: o CSS usa a de sempre', () => {
    const estilo = estiloDaMedalha({ open: true, locked: false, animacao: 'girar' })
    expect(estilo.getPropertyValue('--lb-porta-curva-abre')).toBe('')
    expect(estilo.getPropertyValue('--lb-porta-curva-fecha')).toBe('')
  })

  it('porta secreta não anima: nem curva nem tempo, mesmo com a animação de curvas escolhida', () => {
    const estilo = estiloDaMedalha({ open: false, locked: false, secret: true, animacao: 'teste-curvas' })
    expect(estilo.getPropertyValue('--lb-porta-curva-abre')).toBe('')
    expect(estilo.getPropertyValue('--lb-porta-curva-fecha')).toBe('')
    expect(estilo.getPropertyValue('--lb-porta-abre')).toBe('0ms')
  })
})

/** O fichaDaPorta.css do disco: o Vitest troca todo `.css` importado por string vazia (ver Toggle.test.tsx). */
async function lerCssDaFicha(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fichaDaPorta.css'), 'utf8')
}

/** As declarações da regra cujo seletor é exatamente `seletor`: propriedade → valor, sem espaço repetido. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpo] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (seletores.trim() !== seletor) continue
    return new Map(
      corpo
        .split(';')
        .map((declaracao) => {
          const i = declaracao.indexOf(':')
          return [declaracao.slice(0, i).trim(), declaracao.slice(i + 1).replace(/\s+/g, ' ').trim()] as const
        })
        .filter(([propriedade]) => propriedade !== ''),
    )
  }
  throw new Error(`sem a regra ${seletor} no fichaDaPorta.css`)
}

describe('fichaDaPorta.css: cada sentido lê a sua curva', () => {
  it('fechando (a regra base), a transição do giro usa --lb-porta-curva-fecha, com a de sempre de reserva', async () => {
    const transicao = regra(await lerCssDaFicha(), '.lb-medalha-porta__folha').get('transition') ?? ''
    expect(transicao).toContain('transform var(--lb-porta-fecha, var(--lb-gr-porta-fecha)) var(--lb-porta-curva-fecha, var(--lb-gr-ease-porta))')
  })

  it('abrindo (a regra da aberta), a função de tempo do giro é --lb-porta-curva-abre, com a de sempre de reserva', async () => {
    const aberta = regra(await lerCssDaFicha(), ".lb-medalha-porta[data-estado='aberta'] .lb-medalha-porta__folha")
    expect(aberta.get('transition-timing-function')).toBe('var(--lb-porta-curva-abre, var(--lb-gr-ease-porta)), ease')
    expect(aberta.get('transition-duration')).toBe('var(--lb-porta-abre, var(--lb-gr-porta-abre)), var(--lb-motion-base)')
  })
})
