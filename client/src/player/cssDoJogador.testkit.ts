import { vi } from 'vitest'
import { themeCss } from '../theme'

/*
 * Leitura do CSS do jogador para os testes de geometria do HUD
 * (hudSemColisao.test.tsx, cantoDoZoom.test.ts). O jsdom não calcula posição
 * nenhuma: a prova de que nada se cruza na tela é o e2e
 * task-hud-do-jogador-sem-sobreposicao.spec.ts; aqui fica a régua — as contas
 * que o CSS declara, com as variáveis resolvidas e o `calc` avaliado.
 */

/** Um CSS do client pelo caminho a partir desta pasta (`player.css`, `../components/ControleDeSom.css`). */
export async function lerCss(caminho: string): Promise<string> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const { dirname, join } = await vi.importActual<{ dirname(caminho: string): string; join(...partes: string[]): string }>('node:path')
  return readFileSync(join(dirname(fileURLToPath(import.meta.url)), caminho), 'utf8')
}

export async function lerPlayerCss(): Promise<string> {
  return lerCss('player.css')
}

export type Regra = Map<string, string>

function semComentarios(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function declaracoes(corpo: string): Regra {
  return new Map(
    corpo
      .split(';')
      .map((declaracao) => declaracao.split(':'))
      .filter((partes) => partes.length >= 2)
      .map(([propriedade, ...valor]) => [propriedade.trim(), valor.join(':').trim()]),
  )
}

/** Blocos de `@<regra> <condicao> { ... }` (`@media`, `@container`), casando as chaves. */
function blocos(css: string, abertura: string): string[] {
  const texto = semComentarios(css)
  const achados: string[] = []
  let inicio = texto.indexOf(abertura)
  while (inicio !== -1) {
    let profundidade = 1
    let fim = inicio + abertura.length
    while (profundidade > 0 && fim < texto.length) {
      if (texto[fim] === '{') profundidade += 1
      if (texto[fim] === '}') profundidade -= 1
      fim += 1
    }
    achados.push(texto.slice(inicio + abertura.length, fim - 1))
    inicio = texto.indexOf(abertura, fim)
  }
  return achados
}

/** Blocos de `@media <condicao> { ... }`. */
export function blocosDaMidia(css: string, condicao: string): string[] {
  return blocos(css, `@media ${condicao} {`)
}

/** A lista de seletores de uma regra (`a,\n b {`) contém o seletor exato. */
function temSeletor(seletores: string, seletor: string): boolean {
  return seletores.split(',').some((um) => um.trim() === seletor)
}

function regrasDoBloco(bloco: string, seletor: string): Regra[] {
  return [...bloco.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, seletores]) => temSeletor(seletores, seletor)).map(([, , corpo]) => declaracoes(corpo))
}

/** O CSS sem nenhum bloco `@...{}` de segundo nível (`@media`, `@container`, `@keyframes`). */
function nivelDeTopo(css: string): string {
  let texto = semComentarios(css)
  for (const abertura of new Set([...texto.matchAll(/@(?:media|container|keyframes) [^{]+\{/g)].map(([a]) => a))) {
    for (const bloco of blocos(texto, abertura)) texto = texto.replace(`${abertura}${bloco}}`, '')
  }
  return texto
}

/** Regras de nível de topo (fora de qualquer `@media`) com o seletor exato; a última declaração vence. */
export function regraBase(css: string, seletor: string): Regra {
  const achadas = regrasDoBloco(nivelDeTopo(css), seletor)
  if (achadas.length === 0) throw new Error(`o player.css não tem a regra "${seletor}" fora de @media`)
  return new Map(achadas.flatMap((regra) => [...regra]))
}

/** Regra com o seletor exato dentro de `@media <condicao>` (as declarações de todos os blocos, a última vence). */
export function regraNaMidia(css: string, condicao: string, seletor: string): Regra {
  const achadas = blocosDaMidia(css, condicao).flatMap((bloco) => regrasDoBloco(bloco, seletor))
  if (achadas.length === 0) throw new Error(`o player.css não tem "${seletor}" dentro de @media ${condicao}`)
  return new Map(achadas.flatMap((regra) => [...regra]))
}

/** Todas as regras com o seletor exato, em qualquer `@media` (sem lançar quando não há nenhuma). */
export function emQualquerMidia(css: string, seletor: string): Regra[] {
  const condicoes = new Set([...semComentarios(css).matchAll(/@media ([^{]+) \{/g)].map(([, condicao]) => condicao))
  return [...condicoes].flatMap((condicao) => blocosDaMidia(css, condicao).flatMap((bloco) => regrasDoBloco(bloco, seletor)))
}

/** As condições de cada `@container (...)` do CSS, com as declarações do seletor dentro dela. */
export function noContainer(css: string, seletor: string): Array<{ condicao: string; regra: Regra }> {
  const condicoes = new Set([...semComentarios(css).matchAll(/@container ([^{]+) \{/g)].map(([, condicao]) => condicao))
  return [...condicoes].flatMap((condicao) =>
    blocos(css, `@container ${condicao} {`)
      .flatMap((bloco) => regrasDoBloco(bloco, seletor))
      .map((regra) => ({ condicao, regra })),
  )
}

const TEMA: ReadonlyMap<string, string> = new Map([...themeCss().matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, nome, valor]) => [nome, valor.trim()]))

/**
 * Os valores das variáveis CSS na tela: os tokens do tema, a régua do HUD (o
 * `:root` do player.css) e, com `midia`, o `:root` daquela mídia por cima
 * (o celular deitado reescreve a régua).
 */
export function variaveis(css: string, midia?: string): Map<string, string> {
  const valores = new Map(TEMA)
  for (const [nome, valor] of regraBase(css, ':root')) valores.set(nome, valor)
  if (midia !== undefined) for (const [nome, valor] of regraNaMidia(css, midia, ':root')) valores.set(nome, valor)
  return valores
}

type Termo = { valor: number; px: boolean }

/** Conta de `calc` com `+ - * /`, parênteses, `calc()`, `min()` e `max()`, em px. `%`, `vw` e `vh` dão NaN: dependem da tela. */
function avaliarConta(texto: string): number {
  const fichas = texto.match(/\d*\.?\d+(?:px|%|vw|vh|dvh)?|calc\(|min\(|max\(|[()+\-*/,]/g) ?? []
  let i = 0
  const proxima = (): string | undefined => fichas[i]
  const consome = (): string => {
    const ficha = fichas[i]
    i += 1
    if (ficha === undefined) throw new Error(`conta incompleta: ${texto}`)
    return ficha
  }
  function soma(): Termo {
    let esquerda = produto()
    while (proxima() === '+' || proxima() === '-') {
      const sinal = consome()
      const direita = produto()
      esquerda = { valor: sinal === '+' ? esquerda.valor + direita.valor : esquerda.valor - direita.valor, px: esquerda.px || direita.px }
    }
    return esquerda
  }
  function produto(): Termo {
    let esquerda = fator()
    while (proxima() === '*' || proxima() === '/') {
      const sinal = consome()
      const direita = fator()
      esquerda = { valor: sinal === '*' ? esquerda.valor * direita.valor : esquerda.valor / direita.valor, px: esquerda.px || direita.px }
    }
    return esquerda
  }
  function lista(): Termo[] {
    const termos = [soma()]
    while (proxima() === ',') {
      consome()
      termos.push(soma())
    }
    consome() // ')'
    return termos
  }
  function fator(): Termo {
    const ficha = consome()
    if (ficha === '-') {
      const termo = fator()
      return { valor: -termo.valor, px: termo.px }
    }
    if (ficha === '(' || ficha === 'calc(') {
      const termo = soma()
      consome() // ')'
      return termo
    }
    if (ficha === 'min(' || ficha === 'max(') {
      const termos = lista()
      const valores = termos.map((termo) => termo.valor)
      return { valor: ficha === 'min(' ? Math.min(...valores) : Math.max(...valores), px: termos.some((termo) => termo.px) }
    }
    if (/(%|vw|vh|dvh)$/.test(ficha)) return { valor: Number.NaN, px: true }
    return { valor: Number.parseFloat(ficha), px: ficha.endsWith('px') }
  }
  return soma().valor
}

/**
 * Um comprimento do CSS em px: `var()` pelo valor (o da régua, o do tema ou o
 * de reserva), `env()` vale 0 (sem recorte de tela), e o `calc` avaliado.
 */
export function px(valor: string | undefined, vars: ReadonlyMap<string, string> = TEMA): number {
  if (valor === undefined) return Number.NaN
  let texto = valor
  for (let volta = 0; volta < 20 && texto.includes('var('); volta += 1) {
    texto = texto.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_, nome: string, reserva: string | undefined) => vars.get(nome) ?? reserva ?? '0px')
  }
  try {
    return avaliarConta(texto.replace(/env\([^()]*\)/g, '0px'))
  } catch {
    // Palavra no lugar da conta (`auto`, `none`): não é comprimento.
    return Number.NaN
  }
}
