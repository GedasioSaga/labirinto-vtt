import { act, createElement, Fragment, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TerritorioControls } from '../components/TerritorioControls'
import { TOKEN_NPC_HINT, TokenNpcControls } from '../components/TokenNpcControls'
import { WallDoorControls } from '../components/WallDoorControls'
import { ESPERA_DO_PRIMEIRO_MS, JANELA_DO_VIZINHO_MS, classificarDicas, instalarDicasDoPainel, posicionarBalao } from './dicaDoPainel'

/**
 * DICAS SOB DEMANDA (peça P3 do laudo do painel): a frase que explica um
 * controle sai do fluxo da coluna e vira balão ao pairar na linha ou ao chegar
 * nela pelo teclado. O jsdom não desenha: a geometria do corpo e das linhas
 * vem de stub, e o que se prova aqui é quem vira balão, quando ele abre e
 * fecha, e que a frase segue no DOM ligada ao controle. O "sem empurrar a
 * coluna" é a regra do main.css (`position: fixed`), provada no fim.
 */

let corpo: HTMLDivElement
let root: Root
let desinstalar: (() => void) | null = null
let passo = 0

function retangulo(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }
}

beforeEach(() => {
  Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
  corpo = document.createElement('div')
  corpo.className = 'lb-inspector__body lb-scroll'
  document.body.appendChild(corpo)
  root = createRoot(corpo)
  // A coluna do editor em 1280x800: corpo de 262 x 595 px; toda linha cabe nele.
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return this === corpo ? retangulo(17, 139, 262, 595) : retangulo(33, 200, 230, 30)
  })
  Object.defineProperty(corpo, 'clientWidth', { configurable: true, value: 262 })
  Object.defineProperty(corpo, 'clientHeight', { configurable: true, value: 595 })
})

afterEach(() => {
  desinstalar?.()
  desinstalar = null
  act(() => root.unmount())
  corpo.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function montar(...elementos: ReactElement[]) {
  act(() => root.render(createElement(Fragment, null, ...elementos)))
}

function instalar() {
  desinstalar = instalarDicasDoPainel(document)
}

/** O MutationObserver entrega na próxima microtarefa. */
async function observadorEntrega() {
  await Promise.resolve()
  await Promise.resolve()
}

function pairar(alvo: Element) {
  passo += 1
  alvo.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: passo, clientY: passo, pointerType: 'mouse' }))
}

function apertar(alvo: Element) {
  alvo.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
}

function teclar(alvo: Element, tecla: string): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key: tecla, bubbles: true, cancelable: true })
  alvo.dispatchEvent(evento)
  return evento
}

function dicaComTexto(texto: string): HTMLElement {
  const dica = [...corpo.querySelectorAll<HTMLElement>('.lb-field__hint')].find((p) => (p.textContent ?? '').includes(texto))
  if (dica === undefined) throw new Error(`nenhuma frase do painel diz "${texto}"`)
  return dica
}

function interruptor(rotulo: string): { linha: HTMLElement; caixa: HTMLInputElement } {
  const linha = [...corpo.querySelectorAll<HTMLElement>('label.lb-switch')].find((l) => (l.textContent ?? '').trim() === rotulo)
  const caixa = linha?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (linha === undefined || caixa === null || caixa === undefined) throw new Error(`o painel deveria ter o interruptor "${rotulo}"`)
  return { linha, caixa }
}

const npc = () => createElement(TokenNpcControls, { key: 'npc', npc: false, onNpcChange: () => {} })
const territorio = () =>
  createElement(TerritorioControls, {
    key: 'territorio',
    filtroLigado: false,
    onFiltroChange: () => {},
    legenda: [],
    alerta: 'calmo',
    onAlertaChange: () => {},
  })

const AVISO_SEM_FACCAO = 'Nenhuma sala tem facção'
const FRASE_DO_FILTRO = 'Pinta cada sala e distrito'
const FRASE_DO_ALERTA = 'Suba conforme o grupo faz barulho'

/** Aviso de estado sem controle nenhum que ele explique (o Acervo vazio): conteúdo da coluna. */
const AVISO_SOLTO = 'Nenhum token no acervo ainda.'

function avisoSolto(): HTMLElement {
  const aviso = document.createElement('p')
  aviso.className = 'lb-field__hint'
  aviso.textContent = AVISO_SOLTO
  corpo.appendChild(aviso)
  return aviso
}

describe('classificarDicas — quais frases viram balão', () => {
  it('a frase do interruptor, ligada por aria-describedby, vira balão; a linha é o interruptor inteiro', () => {
    montar(npc())
    const { linha } = interruptor('Ficha de NPC')
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    const { sobDemanda, linhas } = classificarDicas(corpo)
    expect(sobDemanda).toEqual([dica])
    expect([...linhas.keys()]).toEqual([linha])
    expect(linhas.get(linha)).toEqual([dica])
  })

  it('aviso sem ligação com controle nenhum fica no fluxo: é conteúdo, não explicação', () => {
    montar(npc())
    const aviso = avisoSolto()
    expect(classificarDicas(corpo).sobDemanda, 'o aviso de lista vazia tem de continuar à vista').not.toContain(aviso)
  })

  it('Território: a frase do filtro e a de sem facção são do interruptor; a do alerta é do campo (rótulo e segmentado)', () => {
    montar(territorio())
    const { sobDemanda, linhas } = classificarDicas(corpo)
    expect(sobDemanda).toContain(dicaComTexto(FRASE_DO_FILTRO))
    expect(sobDemanda).toContain(dicaComTexto(FRASE_DO_ALERTA))
    // Peça mapa-inteiro-enxuto: a frase de estado diz por que "Quem manda aqui"
    // não pinta nada; ligada ao interruptor, ela é a explicação dele.
    expect(sobDemanda).toContain(dicaComTexto(AVISO_SEM_FACCAO))
    expect(linhas.get(interruptor('Quem manda aqui').linha)).toEqual([dicaComTexto(FRASE_DO_FILTRO), dicaComTexto(AVISO_SEM_FACCAO)])
    const campo = corpo.querySelector<HTMLElement>('[role="radiogroup"]')?.closest<HTMLElement>('.lb-field') ?? null
    expect(campo !== null && linhas.get(campo)?.[0] === dicaComTexto(FRASE_DO_ALERTA), 'a linha do alerta é o campo inteiro (rótulo e segmentado)').toBe(true)
  })

  it('frase de controle desabilitado é o motivo de ele não fazer nada: fica no fluxo', () => {
    corpo.innerHTML = `
      <button type="button" disabled aria-describedby="motivo">Distribuir</button>
      <p class="lb-field__hint" id="motivo">Precisa de 3 ou mais itens selecionados.</p>`
    expect(classificarDicas(corpo).sobDemanda).toEqual([])
  })

  it('frase do Avançado e frase marcada como aviso (lb-field__hint--fixa) ficam no fluxo', () => {
    corpo.innerHTML = `
      <div class="lb-advanced__item">
        <div role="radiogroup" aria-label="Ponta" aria-describedby="avancado"></div>
        <p class="lb-field__hint" id="avancado">Arredondada suaviza a ponta solta.</p>
      </div>
      <input aria-describedby="aviso" />
      <p class="lb-field__hint lb-field__hint--fixa" id="aviso">Largura e altura voltam quando a sala fica reta.</p>`
    expect(classificarDicas(corpo).sobDemanda).toEqual([])
  })

  it('campo com um só controle descrito: a linha é o campo (rótulo e controle); com dois, cada controle é a sua linha', () => {
    montar(
      createElement(WallDoorControls, {
        key: 'porta',
        door: { open: false, locked: false, kind: 'normal' },
        onToggleDoor: () => {},
        onToggleOpen: () => {},
        onToggleLocked: () => {},
        onToggleSemEspiar: () => {},
        onToggleSecret: () => {},
        onRevealPassage: () => {},
        onOpensFromChange: () => {},
      }),
    )
    const campoUnico = document.createElement('div')
    campoUnico.className = 'lb-field'
    campoUnico.innerHTML = `<label class="lb-label" for="piso">Piso</label><input id="piso" aria-describedby="piso-dica" /><p class="lb-field__hint" id="piso-dica">O jogador vê só o piso da ficha dele.</p>`
    corpo.appendChild(campoUnico)

    const { linhas } = classificarDicas(corpo)
    const abrePor = corpo.querySelector<HTMLElement>('[role="radiogroup"][aria-label="Abre por"]')
    expect(linhas.has(interruptor('Secreta').linha), 'Secreta divide o campo com o "Abre por": a linha dela é o interruptor').toBe(true)
    expect(abrePor !== null && linhas.has(abrePor), 'o "Abre por" é a própria linha').toBe(true)
    expect(linhas.has(campoUnico), 'o Piso é o único controle descrito no campo: a linha é o campo').toBe(true)
  })
})

describe('instalarDicasDoPainel — a frase sai do fluxo e continua ligada ao controle', () => {
  it('marca a frase como balão fechado sem mudar id, texto nem aria-describedby; o aviso fica sem marca', () => {
    montar(npc(), territorio())
    const aviso = avisoSolto()
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    const id = dica.id
    instalar()
    const { caixa, linha } = interruptor('Ficha de NPC')
    expect(dica.getAttribute('data-dica')).toBe('fechada')
    expect(dica.getAttribute('role')).toBe('tooltip')
    expect(dica.id).toBe(id)
    expect(dica.textContent).toBe(TOKEN_NPC_HINT)
    expect(caixa.getAttribute('aria-describedby')).toBe(id)
    expect(linha.getAttribute('data-dica-ids')).toBe(id)
    expect(aviso.hasAttribute('data-dica')).toBe(false)
  })

  it('frase fora do corpo do painel (diálogo, aba Jogo) não muda', () => {
    const fora = document.createElement('div')
    fora.innerHTML = `<input aria-describedby="fora-dica" /><p class="lb-field__hint" id="fora-dica">Explica o campo do diálogo.</p>`
    document.body.appendChild(fora)
    instalar()
    expect(fora.querySelector('.lb-field__hint')?.hasAttribute('data-dica')).toBe(false)
    fora.remove()
  })

  it('desinstalar devolve a frase ao fluxo', () => {
    montar(npc())
    instalar()
    desinstalar?.()
    desinstalar = null
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    expect(dica.hasAttribute('data-dica')).toBe(false)
    expect(dica.hasAttribute('role')).toBe(false)
    expect(interruptor('Ficha de NPC').linha.hasAttribute('data-dica-linha')).toBe(false)
  })
})

describe('pairar: só o primeiro balão espera; o vizinho aparece na hora', () => {
  it('o primeiro balão abre só depois da espera parada na linha, e entra com movimento', () => {
    vi.useFakeTimers()
    montar(npc())
    instalar()
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    pairar(interruptor('Ficha de NPC').linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS - 1)
    expect(dica.getAttribute('data-dica'), 'antes da espera o balão não pode abrir').toBe('fechada')
    vi.advanceTimersByTime(1)
    expect(dica.getAttribute('data-dica')).toBe('aberta')
    expect(dica.hasAttribute('data-dica-entrada'), 'o primeiro balão entra com movimento').toBe(true)
    expect(interruptor('Ficha de NPC').linha.getAttribute('data-dica-linha')).toBe('aberta')
  })

  it('passando para a linha vizinha, o balão dela abre na hora, sem movimento, e o primeiro fecha', () => {
    vi.useFakeTimers()
    montar(npc(), territorio())
    instalar()
    pairar(interruptor('Ficha de NPC').linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    pairar(interruptor('Quem manda aqui').linha)
    const vizinha = dicaComTexto(FRASE_DO_FILTRO)
    expect(vizinha.getAttribute('data-dica'), 'o vizinho não espera de novo').toBe('aberta')
    expect(vizinha.hasAttribute('data-dica-entrada'), 'o vizinho aparece já no lugar').toBe(false)
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
  })

  it('saiu do painel, o balão fecha; voltou dentro da janela do vizinho, abre na hora; depois dela, espera de novo', () => {
    vi.useFakeTimers()
    montar(npc(), territorio())
    instalar()
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    const linha = interruptor('Ficha de NPC').linha
    pairar(linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    pairar(document.body)
    expect(dica.getAttribute('data-dica')).toBe('fechada')
    vi.advanceTimersByTime(JANELA_DO_VIZINHO_MS - 100)
    pairar(linha)
    expect(dica.getAttribute('data-dica'), 'dentro da janela, a volta abre na hora').toBe('aberta')
    pairar(document.body)
    vi.advanceTimersByTime(JANELA_DO_VIZINHO_MS + 1)
    pairar(linha)
    expect(dica.getAttribute('data-dica'), 'passada a janela, espera de novo').toBe('fechada')
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    expect(dica.getAttribute('data-dica')).toBe('aberta')
  })

  it('apertar a linha é usar o controle: o balão sai e não volta enquanto o ponteiro ficar nela', () => {
    vi.useFakeTimers()
    montar(npc())
    instalar()
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    const { linha } = interruptor('Ficha de NPC')
    pairar(linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    apertar(linha)
    expect(dica.getAttribute('data-dica')).toBe('fechada')
    pairar(linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS * 3)
    expect(dica.getAttribute('data-dica'), 'parado na linha apertada, o balão não volta').toBe('fechada')
    pairar(document.body)
    pairar(linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    expect(dica.getAttribute('data-dica'), 'saiu e voltou: a linha pode explicar de novo').toBe('aberta')
  })

  it('o ponteiro de toque não abre balão', () => {
    vi.useFakeTimers()
    montar(npc())
    instalar()
    interruptor('Ficha de NPC').linha.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 900, clientY: 900, pointerType: 'touch' }))
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS * 2)
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
  })
})

describe('teclado: o foco abre na hora e o Esc fecha só o balão', () => {
  it('Tab até o interruptor abre o balão na hora, sem movimento', () => {
    montar(npc())
    instalar()
    const { caixa } = interruptor('Ficha de NPC')
    teclar(document.body, 'Tab')
    act(() => caixa.focus())
    const dica = dicaComTexto(TOKEN_NPC_HINT)
    expect(dica.getAttribute('data-dica')).toBe('aberta')
    expect(dica.hasAttribute('data-dica-entrada'), 'ação de teclado não espera animação').toBe(false)
  })

  it('Esc fecha o balão aberto pelo foco sem largar a seleção; o Esc seguinte segue viagem, como antes', () => {
    montar(npc())
    instalar()
    const larga = vi.fn()
    // A janela é onde o editor larga a seleção no Esc (PixiCanvas, "deixa pra lá").
    const naJanela = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') larga()
    }
    window.addEventListener('keydown', naJanela)
    const { caixa } = interruptor('Ficha de NPC')
    teclar(document.body, 'Tab')
    act(() => caixa.focus())
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('aberta')
    teclar(caixa, 'Escape')
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
    expect(larga, 'o Esc que fechou o balão não pode chegar à janela (lá ele larga a seleção)').not.toHaveBeenCalled()
    expect(document.activeElement, 'o foco fica no controle').toBe(caixa)
    teclar(caixa, 'Escape')
    expect(larga).toHaveBeenCalledTimes(1)
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica'), 'fechado pelo Esc, não reabre com o foco parado ali').toBe('fechada')
    window.removeEventListener('keydown', naJanela)
  })

  it('Esc com balão de pairar fecha o balão e segue viagem (larga a seleção, como antes)', () => {
    vi.useFakeTimers()
    montar(npc())
    instalar()
    const larga = vi.fn()
    const naJanela = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') larga()
    }
    window.addEventListener('keydown', naJanela)
    const { linha } = interruptor('Ficha de NPC')
    pairar(linha)
    vi.advanceTimersByTime(ESPERA_DO_PRIMEIRO_MS)
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('aberta')
    teclar(document.body, 'Escape')
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
    expect(larga).toHaveBeenCalledTimes(1)
    window.removeEventListener('keydown', naJanela)
  })

  it('foco que chegou pelo clique não abre balão', () => {
    montar(npc())
    instalar()
    const { caixa } = interruptor('Ficha de NPC')
    teclar(document.body, 'Tab')
    apertar(caixa)
    act(() => caixa.focus())
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
  })
})

describe('o painel muda e a classificação acompanha', () => {
  it('controle que fica desabilitado devolve a frase ao fluxo, à vista (vira o motivo)', async () => {
    corpo.innerHTML = `
      <button type="button" aria-describedby="avanco">Avançar</button>
      <p class="lb-field__hint" id="avanco">Vai atingir: Cripta.</p>`
    instalar()
    const dica = corpo.querySelector<HTMLElement>('#avanco')
    expect(dica?.getAttribute('data-dica')).toBe('fechada')
    corpo.querySelector('button')?.setAttribute('disabled', '')
    await observadorEntrega()
    expect(dica?.hasAttribute('data-dica')).toBe(false)
    expect(dica?.hasAttribute('role')).toBe(false)
  })

  it('componente montado depois da instalação já nasce com a frase fora do fluxo', async () => {
    instalar()
    montar(npc())
    await observadorEntrega()
    expect(dicaComTexto(TOKEN_NPC_HINT).getAttribute('data-dica')).toBe('fechada')
    expect(interruptor('Ficha de NPC').linha.hasAttribute('data-dica-linha')).toBe(true)
  })
})

describe('posicionarBalao — embaixo, em cima, e nunca além da coluna', () => {
  // Corpo visível de 17..279 x 192..734 (a faixa fixa da seleção já descontada), painel 16..280 x 16..686+.
  const area = { left: 17, top: 192, right: 271, bottom: 734 }
  const limite = { left: 16, top: 16, right: 280, bottom: 750 }
  const base = { area, limite, folga: 8, recuo: 16 }

  it('cabe embaixo: fica embaixo da linha, alinhado ao começo dela, com a seta no começo do rótulo', () => {
    const posicao = posicionarBalao({ ...base, linha: { left: 33, top: 440, right: 263, bottom: 480 }, largura: 222, altura: 64 })
    expect(posicao).toEqual({ x: 33, y: 488, lado: 'abaixo', seta: 12 })
  })

  it('perto do fim da parte visível, sobe para cima da linha', () => {
    const posicao = posicionarBalao({ ...base, linha: { left: 33, top: 690, right: 263, bottom: 720 }, largura: 222, altura: 64 })
    expect(posicao).toEqual({ x: 33, y: 618, lado: 'acima', seta: 12 })
  })

  it('não passa da borda direita da coluna: recua e a seta continua no rótulo', () => {
    const posicao = posicionarBalao({ ...base, linha: { left: 60, top: 440, right: 263, bottom: 480 }, largura: 222, altura: 64 })
    expect(posicao.x + 222, 'a borda direita do balão fica no respiro da coluna').toBe(area.right - 16)
    expect(posicao).toEqual({ x: 33, y: 488, lado: 'abaixo', seta: 39 })
  })

  it('sem espaço inteiro nem embaixo nem em cima: vai para o lado mais folgado, preso ao painel', () => {
    const posicao = posicionarBalao({ ...base, linha: { left: 33, top: 300, right: 263, bottom: 330 }, largura: 222, altura: 500 })
    expect(posicao).toEqual({ x: 33, y: 242, lado: 'abaixo', seta: 12 })
  })
})

/** O main.css como está no disco (mesmo leitor de `Toggle.test.tsx`: o Vitest troca `.css` importado por string vazia). */
async function lerMainCss(): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'main.css'), 'utf8')
}

const normalizar = (texto: string) => texto.replace(/\s+/g, ' ').trim()

/** As declarações da primeira regra cujo seletor (sem contar espaços) é `seletor`. */
function regra(css: string, seletor: string): Map<string, string> {
  const semComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
  for (const [, seletores, corpoDaRegra] of semComentarios.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (normalizar(seletores) !== normalizar(seletor)) continue
    return new Map(
      corpoDaRegra
        .split(';')
        .map((declaracao) => declaracao.split(':'))
        .filter((partes) => partes.length >= 2)
        .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
    )
  }
  throw new Error(`o main.css não tem a regra "${seletor}"`)
}

describe('main.css — o balão não empurra a coluna', () => {
  it('fechado, o balão fica fora do fluxo, sem ponteiro e escondido; aberto, visível', async () => {
    const css = await lerMainCss()
    const balao = regra(css, '.lb-inspector__body .lb-field__hint[data-dica]')
    expect(balao.get('position'), 'fora do fluxo: abrir não move o controle de baixo').toBe('fixed')
    expect(balao.get('pointer-events'), 'o clique seguinte cai no controle coberto, não no balão').toBe('none')
    expect(balao.get('visibility')).toBe('hidden')
    expect(regra(css, ".lb-inspector__body .lb-field__hint[data-dica='aberta']").get('visibility')).toBe('visible')
  })

  it('o "?" da linha fica fora do nome acessível e colado à última palavra do rótulo', async () => {
    const css = await lerMainCss()
    const marca = regra(css, 'label.lb-switch[data-dica-linha] > span:first-child::after, [data-dica-linha] > .lb-label:first-child::after')
    expect(marca.get('content'), 'texto alternativo vazio: o interruptor continua "Travado", não "Travado?"').toBe("'?' / ''")
    expect(marca.get('display'), 'em linha, o "?" é pontuação e não desce sozinho').toBe('inline')
  })

  it('com movimento reduzido, o balão aparece sem entrada animada', async () => {
    const css = normalizar((await lerMainCss()).replace(/\/\*[\s\S]*?\*\//g, ''))
    const blocos = css.split('@media (prefers-reduced-motion: reduce)').slice(1)
    const doBalao = blocos.find((bloco) => bloco.includes(".lb-inspector__body .lb-field__hint[data-dica='aberta'][data-dica-entrada]"))
    expect(doBalao !== undefined && /animation: none/.test(doBalao.slice(0, doBalao.indexOf('}') + 1)), 'o bloco de movimento reduzido tira a entrada do balão').toBe(true)
  })
})
