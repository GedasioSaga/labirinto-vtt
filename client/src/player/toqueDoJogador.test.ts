import { describe, expect, it, vi } from 'vitest'
import { themeCss } from '../theme'
import { POINT_MENU_HEIGHT_PX, POINT_MENU_WALK_HEIGHT_PX } from './PointActionMenu'

/*
 * O TOQUE DO JOGADOR, lido no player.css de verdade (o jsdom não aplica CSS):
 * - os botões mais tocados afundam na hora em que o dedo pega e voltam em
 *   110 ms, como os da barra (`.pp-toggle`, `.pp-mine`, `.pp-bag`);
 * - o realce de pairar só existe onde há ponteiro que paira: no celular ele
 *   grudava no botão depois do toque;
 * - com movimento reduzido, nada afunda e nada transiciona;
 * - alvo de dedo de 44 px no celular e em toda tela de toque (tablet);
 * - o menu do toque longo mede, no TS, a soma real do CSS;
 * - o cartão de entrada preso ao alto, para a marca não saltar ao conectar.
 */

/**
 * O player.css como está no disco. `import './player.css?raw'` não serve: o
 * Vitest troca todo `.css` importado por string vazia (mesmo motivo do
 * `cantoDoZoom.test.ts`).
 */
async function lerPlayerCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'player.css'), 'utf8')
}

interface Regra {
  seletores: string[]
  declaracoes: Map<string, string>
  /** As condições dos `@media` em volta, de fora para dentro (vazio: fora de qualquer `@media`). */
  midia: string[]
}

/** Parte nas vírgulas do nível de cima: a vírgula de dentro de `:not(a, b)` não separa seletor. */
function partir(texto: string): string[] {
  const partes: string[] = []
  let fundo = 0
  let inicio = 0
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (c === '(' || c === '[') fundo++
    else if (c === ')' || c === ']') fundo--
    else if (c === ',' && fundo === 0) {
      partes.push(texto.slice(inicio, i))
      inicio = i + 1
    }
  }
  partes.push(texto.slice(inicio))
  return partes.map((parte) => parte.trim().replace(/\s+/g, ' ')).filter((parte) => parte !== '')
}

function lerDeclaracoes(corpo: string): Map<string, string> {
  const declaracoes = new Map<string, string>()
  for (const linha of corpo.split(';')) {
    const doisPontos = linha.indexOf(':')
    if (doisPontos < 0) continue
    declaracoes.set(linha.slice(0, doisPontos).trim(), linha.slice(doisPontos + 1).trim().replace(/\s+/g, ' '))
  }
  return declaracoes
}

/** As regras de estilo na ordem do arquivo, com os `@media` em volta; o miolo de `@keyframes` fica de fora. */
function lerRegras(css: string): Regra[] {
  const texto = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const regras: Regra[] = []
  let i = 0
  // `midia` null: dentro de um `@keyframes`, onde nada é regra de estilo.
  function lerBloco(midia: string[] | null): void {
    let inicio = i
    while (i < texto.length) {
      const c = texto[i]
      if (c === '}') {
        i++
        return
      }
      if (c === ';') inicio = i + 1
      if (c !== '{') {
        i++
        continue
      }
      const cabeca = texto.slice(inicio, i).trim()
      i++
      if (cabeca.startsWith('@media')) lerBloco(midia === null ? null : [...midia, cabeca.slice('@media'.length).trim()])
      else if (cabeca.startsWith('@')) lerBloco(null)
      else {
        const fim = texto.indexOf('}', i)
        if (midia !== null) regras.push({ seletores: partir(cabeca), declaracoes: lerDeclaracoes(texto.slice(i, fim)), midia })
        i = fim + 1
      }
      inicio = i
    }
  }
  lerBloco([])
  return regras
}

function regrasCom(regras: Regra[], seletor: string, midia: readonly string[] = []): Regra[] {
  return regras.filter(
    (regra) => regra.seletores.includes(seletor) && regra.midia.length === midia.length && regra.midia.every((condicao, k) => condicao === midia[k]),
  )
}

/** O valor que vence entre as regras do seletor exato naquela mídia (a última que declara). */
function valor(regras: Regra[], seletor: string, propriedade: string, midia: readonly string[] = []): string | undefined {
  let achado: string | undefined
  for (const regra of regrasCom(regras, seletor, midia)) achado = regra.declaracoes.get(propriedade) ?? achado
  return achado
}

const TOKENS = new Map([...themeCss().matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, nome, valor]) => [nome, valor.trim()]))

/** O primeiro comprimento em px do valor, com o token do tema no lugar do `var()`. */
function px(texto: string | undefined): number {
  if (texto === undefined) return Number.NaN
  const semVar = texto.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (_, nome: string) => TOKENS.get(nome) ?? '0px')
  const numero = /(-?\d+(?:\.\d+)?)px/.exec(semVar)
  return numero === null ? Number.NaN : Number(numero[1])
}

const PAIRA = '(hover: hover)'
const REDUZIDO = '(prefers-reduced-motion: reduce)'
const CELULAR = '(max-width: 699px)'
const TOQUE = '(pointer: coarse)'

interface Botao {
  /** A regra base do botão. */
  seletor: string
  /** A regra do aperto (com o `:not()` de quem tem estado indisponível). */
  ativo: string
  /** As regras de pairar que mudam a pele do botão. */
  pairar: string[]
}

const BOTOES: readonly Botao[] = [
  {
    seletor: '.pp-button',
    ativo: ".pp-button:active:not(:disabled, [aria-disabled='true'])",
    pairar: [".pp-button:hover:not(:disabled, [aria-disabled='true'])", ".pp-button--toggle[aria-pressed='true']:hover"],
  },
  { seletor: '.pp-pincard__travel', ativo: '.pp-pincard__travel:active:not(:disabled)', pairar: ['.pp-pincard__travel:hover:not(:disabled)'] },
  { seletor: '.pp-floors__tab', ativo: '.pp-floors__tab:active', pairar: ['.pp-floors__tab:hover'] },
  { seletor: '.pp-pointmenu__item', ativo: '.pp-pointmenu__item:active', pairar: ['.pp-pointmenu__item:hover'] },
  // "Andar até aqui": mora no fim do mesmo menu do toque longo, então aperta como os irmãos.
  {
    seletor: '.pp-point-menu__item',
    ativo: ".pp-point-menu__item:active:not([aria-disabled='true'])",
    pairar: [".pp-point-menu__item:hover:not([aria-disabled='true'])"],
  },
  { seletor: '.pp-lock__turn', ativo: '.pp-lock__turn:active', pairar: ['.pp-lock__turn:hover'] },
  { seletor: '.pp-note__close', ativo: '.pp-note__close:active', pairar: ['.pp-note__close:hover'] },
  { seletor: '.pp-espiar', ativo: '.pp-espiar:active', pairar: ['.pp-espiar:hover'] },
]

const nomeDoBotao = BOTOES.map((botao) => [botao.seletor, botao] as const)

describe('os botões do jogador afundam ao toque e soltam suave', () => {
  it.each(nomeDoBotao)('%s volta do aperto com transição de transform no token rápido, sem o realce azul do navegador', async (_, botao) => {
    const regras = lerRegras(await lerPlayerCss())
    const transicao = valor(regras, botao.seletor, 'transition') ?? ''
    expect(transicao).toContain('transform var(--lb-motion-fast')
    expect(transicao).toContain('var(--lb-motion-ease')
    expect(valor(regras, botao.seletor, '-webkit-tap-highlight-color')).toBe('transparent')
  })

  it.each(nomeDoBotao)('%s afunda na hora em que o dedo pega (scale 0.97, sem transição na ida)', async (_, botao) => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, botao.ativo, 'transform') ?? '').toContain('scale(0.97)')
    expect(valor(regras, botao.ativo, 'transition-duration')).toBe('0ms')
  })

  it.each(nomeDoBotao)('%s só acende no pairar onde existe ponteiro que paira (no celular grudava)', async (_, botao) => {
    const regras = lerRegras(await lerPlayerCss())
    for (const pairar of botao.pairar) {
      expect(regrasCom(regras, pairar), `${pairar} fora de @media ${PAIRA}`).toEqual([])
      expect(regrasCom(regras, pairar, [PAIRA]).length, `${pairar} dentro de @media ${PAIRA}`).toBeGreaterThan(0)
    }
  })

  it.each(nomeDoBotao)('%s, com movimento reduzido, não transiciona nem afunda', async (_, botao) => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, botao.seletor, 'transition', [REDUZIDO])).toBe('none')
    const apertado = valor(regras, botao.ativo, 'transform', [REDUZIDO])
    expect(apertado).toBeDefined()
    expect(apertado).not.toContain('scale')
  })

  it('o aperto do .pp-button só mexe no tamanho: o fundo é de quem já o pinta (o interruptor ligado é latão cheio)', async () => {
    const regras = lerRegras(await lerPlayerCss())
    const apertos = regrasCom(regras, ".pp-button:active:not(:disabled, [aria-disabled='true'])")
    expect(apertos.length).toBeGreaterThan(0)
    for (const aperto of apertos) {
      expect(aperto.declaracoes.has('background')).toBe(false)
      expect(aperto.declaracoes.has('background-color')).toBe(false)
    }
  })

  it('o "Espiar pela porta" afunda sem sair do lugar: mora na coluna das ações do lugar, sem translate a compor', async () => {
    const regras = lerRegras(await lerPlayerCss())
    // Quem a põe no lugar é a coluna (`.pp-lugar`): a pílula não se centra sozinha em tela nenhuma.
    expect(valor(regras, '.pp-espiar', 'transform')).toBeUndefined()
    expect(valor(regras, '.pp-espiar', 'transform', [CELULAR])).toBeUndefined()
    expect(valor(regras, '.pp-espiar:active', 'transform')).toBe('scale(0.97)')
    // Com movimento reduzido não afunda, e continua onde a coluna a pôs.
    expect(valor(regras, '.pp-espiar:active', 'transform', [REDUZIDO])).toBe('none')
  })

  it('o realce do item do menu de ponto continua no foco pelo teclado (fora do @media de pairar) e sem esperar transição', async () => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, '.pp-pointmenu__item:focus-visible', 'background')).toBe('rgba(255, 255, 255, 0.08)')
    // Só o aperto anima: andar pelas setas acende o item na hora, como num menu do sistema.
    expect(valor(regras, '.pp-pointmenu__item', 'transition')).not.toContain('background')
  })
})

/** Os alvos de toque do celular que já existiam (hudSemColisao.test.tsx) e os três que mediam 32 a 34 px. */
const ALVOS_ANTIGOS = [
  '.pp-floors__tab',
  '.pp-where',
  '.pp-notice__action',
  '.pp-call__reason',
  '.pp-call .pp-input',
  '.pp-call .pp-button',
  '.pp-pincard__close',
  '.pp-pincard__travel',
  '.pp-pincard__watch',
  '.pp-pincard__barrar',
]
const ALVOS_NOVOS = ['.pp-note__close', '.pp-lock__turn', '.pp-personal-notes__remove']

describe('alvo de dedo de 44 px', () => {
  it.each(ALVOS_NOVOS)('%s ("Fechar" do recado, setas do cadeado, "Apagar" das notas) tem o alvo de toque do tema no celular', async (seletor) => {
    const regras = lerRegras(await lerPlayerCss())
    const altura = valor(regras, seletor, 'min-height', [CELULAR])
    expect(altura ?? 'sem min-height').toContain('--lb-control-touch')
    expect(px(altura)).toBeGreaterThanOrEqual(44)
  })

  it.each([...ALVOS_ANTIGOS, ...ALVOS_NOVOS])('%s tem o alvo de toque do tema em toda tela de toque, também no tablet', async (seletor) => {
    const regras = lerRegras(await lerPlayerCss())
    const altura = valor(regras, seletor, 'min-height', [TOQUE])
    expect(altura ?? 'sem min-height').toContain('--lb-control-touch')
    expect(px(altura)).toBeGreaterThanOrEqual(44)
  })

  it('o "x" do aviso, só ícone, tem os 44 px também na largura em toda tela de toque', async () => {
    const regras = lerRegras(await lerPlayerCss())
    expect(px(valor(regras, '.pp-notice__close', 'min-width', [TOQUE]))).toBeGreaterThanOrEqual(44)
    expect(px(valor(regras, '.pp-notice__close', 'min-height', [TOQUE]))).toBeGreaterThanOrEqual(44)
  })

  it('os itens do menu do toque longo têm o alvo do tema, e nada encolhe o "Andar até aqui" dentro dele', async () => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, '.pp-pointmenu__item', 'min-height')).toContain('--lb-control-touch')
    expect(px(valor(regras, '.pp-point-menu__item', 'min-height'))).toBeGreaterThanOrEqual(44)
    const encolhe = valor(regras, '.pp-pointmenu--walk .pp-point-menu__item', 'min-height')
    if (encolhe !== undefined) expect(px(encolhe)).toBeGreaterThanOrEqual(44)
  })
})

/** Entrelinha do corpo da página do jogador (`player.html`, `body`): a do texto dos itens do menu. */
const ENTRELINHA = 1.45

describe('a altura do menu do toque longo no TS é a soma real do CSS', () => {
  // O TS usa a altura para virar o menu perto da borda; o CSS a usa de teto.
  // Se o teto for menor que os itens, eles vazam pela borda de baixo do menu.
  it('dois itens de 44 px (Sinalizar e Chamar o mestre aqui), um vão, o respiro e a borda', async () => {
    const regras = lerRegras(await lerPlayerCss())
    const item = px(valor(regras, '.pp-pointmenu__item', 'min-height'))
    const vao = px(valor(regras, '.pp-pointmenu', 'gap'))
    const respiro = px(valor(regras, '.pp-pointmenu', 'padding'))
    const borda = px(valor(regras, '.pp-pointmenu', 'border'))
    expect(POINT_MENU_HEIGHT_PX).toBe(2 * item + 1 * vao + 2 * respiro + 2 * borda)
    expect(valor(regras, '.pp-pointmenu', 'max-height')).toBe(`${POINT_MENU_HEIGHT_PX}px`)
  })

  it('o "Andar até aqui" a mais cabe com o motivo em duas linhas, sem folga além do arredondamento', async () => {
    const regras = lerRegras(await lerPlayerCss())
    const vaoDoMenu = px(valor(regras, '.pp-pointmenu', 'gap'))
    const respiro = px(valor(regras, '.pp-point-menu__item', 'padding'))
    const vaoDoItem = px(valor(regras, '.pp-point-menu__item', 'gap'))
    const rotulo = px(valor(regras, '.pp-point-menu__item', 'font-size')) * ENTRELINHA
    const motivo = px(valor(regras, '.pp-point-menu__why', 'font-size')) * ENTRELINHA
    const andar = vaoDoMenu + 2 * respiro + rotulo + vaoDoItem + 2 * motivo
    expect(POINT_MENU_WALK_HEIGHT_PX).toBeGreaterThanOrEqual(andar)
    expect(POINT_MENU_WALK_HEIGHT_PX).toBeLessThan(andar + 1)
    expect(valor(regras, '.pp-pointmenu--walk', 'max-height')).toBe(`${POINT_MENU_HEIGHT_PX + POINT_MENU_WALK_HEIGHT_PX}px`)
  })

  it('a origem da escala vem do componente (o ponto do dedo), não de um canto fixo no CSS', async () => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, '.pp-pointmenu', 'transform-origin')).toBeUndefined()
  })
})

describe('o cartão das telas de texto fica preso ao alto', () => {
  // Centrado, o cartão encolhia ao trocar o formulário por "Conectando…" e a
  // marca Labirinto saltava uns 104 px numa janela de 800. Preso ao topo, só a
  // borda de baixo se mexe.
  it('a casca alinha o cartão pelo topo, com a margem de cima acompanhando a altura da tela', async () => {
    const regras = lerRegras(await lerPlayerCss())
    expect(valor(regras, '.pe-page', 'align-items')).toBe('flex-start')
    expect(valor(regras, '.pe-page', 'padding')).toMatch(/^clamp\(24px, 18vh, 168px\) /)
  })
})
