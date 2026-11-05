import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * PUREZA DO NÚCLEO (plano do Lobby §3.3 e §8.1; achado da auditoria da
 * rodada 1): `lib/nuvem` roda igual no app, no site e no Worker da
 * Cloudflare, então nada no fecho dos imports dele pode puxar Tauri, React ou
 * Pixi, nem tocar no navegador. O tsconfig inclui a lib DOM, e o tsc aceitaria
 * `document` aqui sem reclamar: quem barra é este teste. Ele lê o código do
 * disco (só arquivos locais, seguindo cada import relativo até o fim) com o
 * parser do TypeScript, então comentário e texto entre aspas não contam.
 */

/**
 * Pacotes externos que o fecho pode importar, pelo especificador exato (o
 * subcaminho entra à parte: liberar `x` não libera `x/y`). Hoje NENHUM. É lista
 * do que entra, não do que fica de fora: a guarda não lê o código de dentro de
 * um pacote, e um nome inofensivo pode puxar o proibido (o `zustand` reexporta
 * o `zustand/react`). Pacote novo aqui só depois de conferir que ele, e tudo o
 * que ele importa, roda no Worker sem navegador.
 */
const PACOTES_PERMITIDOS: ReadonlySet<string> = new Set<string>()
const GLOBAL_PROIBIDO: ReadonlySet<string> = new Set(['document', 'window', 'localStorage', 'sessionStorage', 'indexedDB'])
/** `import(algo)` com nome calculado: a guarda não tem como seguir, então reprova. */
const IMPORT_CALCULADO = '(import dinâmico com nome calculado)'

const OPCOES: ts.CompilerOptions = {
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true,
  resolveJsonModule: true,
  noEmit: true,
}

/** Barra do Windows vira `/`: o `ts.sys` devolve as duas, conforme a função. */
function comBarra(caminho: string): string {
  return caminho.replace(/\\/g, '/')
}

/**
 * A pasta deste arquivo: `file:///C:/...` vira `C:/...` no Windows; nos outros
 * sistemas o caminho fica como está. A URL passa por uma variável de
 * propósito: o Vite reescreve o padrão literal `new URL(x, import.meta.url)`
 * para o endereço do servidor (`/src/lib/nuvem`), que não existe no disco.
 */
function pastaDaNuvem(): string {
  const desteArquivo = import.meta.url
  return comBarra(ts.sys.resolvePath(decodeURIComponent(new URL('.', desteArquivo).pathname).replace(/^\/(?=[A-Za-z]:)/, '')))
}

/** As entradas: todo `.ts` da pasta que não é teste. */
function entradasDaNuvem(): string[] {
  const pasta = pastaDaNuvem()
  if (!ts.sys.directoryExists(pasta)) throw new Error(`A pasta da nuvem não está em ${pasta}`)
  return ts.sys
    .readDirectory(pasta, ['.ts'], undefined, undefined, 1)
    .map(comBarra)
    .filter((arquivo) => !arquivo.endsWith('.test.ts') && !arquivo.endsWith('.d.ts'))
}

function relativo(arquivo: string): string {
  return arquivo.slice(arquivo.lastIndexOf('/src/') + 1)
}

function lerFonte(arquivo: string): ts.SourceFile {
  const texto = ts.sys.readFile(arquivo)
  if (texto === undefined) throw new Error(`Não consegui ler ${arquivo}`)
  return ts.createSourceFile(arquivo, texto, ts.ScriptTarget.ES2022, true, arquivo.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
}

interface ImportLido {
  especificador: string
  /** `import type x from`, `export type {} from` ou `import('x').Tipo`: some na compilação e não carrega nada. */
  soTipo: boolean
}

/** O módulo de um import/export estático, de um `import()` ou de um `import('x').Tipo`; `null` = o nó não importa nada. */
function importDe(no: ts.Node): ImportLido | null {
  if ((ts.isImportDeclaration(no) || ts.isExportDeclaration(no)) && no.moduleSpecifier !== undefined) {
    // `import 'x'` (só efeito colateral) não tem cláusula, e carrega o módulo: não é só de tipo.
    const soTipo = ts.isImportDeclaration(no) ? no.importClause?.isTypeOnly === true : no.isTypeOnly
    return { especificador: ts.isStringLiteral(no.moduleSpecifier) ? no.moduleSpecifier.text : IMPORT_CALCULADO, soTipo }
  }
  if (ts.isCallExpression(no) && no.expression.kind === ts.SyntaxKind.ImportKeyword) {
    const [primeiro] = no.arguments
    return { especificador: primeiro !== undefined && ts.isStringLiteralLike(primeiro) ? primeiro.text : IMPORT_CALCULADO, soTipo: false }
  }
  if (ts.isImportTypeNode(no) && ts.isLiteralTypeNode(no.argument) && ts.isStringLiteral(no.argument.literal)) {
    return { especificador: no.argument.literal.text, soTipo: true }
  }
  return null
}

/** `obj.window` e `{ window: 1 }` são nomes de propriedade, não o global; `globalThis.window` é o global. */
function ehNomeDePropriedade(no: ts.Identifier): boolean {
  const pai = no.parent
  if (ts.isPropertyAccessExpression(pai) && pai.name === no) return !(ts.isIdentifier(pai.expression) && pai.expression.text === 'globalThis')
  const declaraPropriedade = ts.isPropertyAssignment(pai) || ts.isPropertySignature(pai) || ts.isPropertyDeclaration(pai) || ts.isMethodDeclaration(pai) || ts.isMethodSignature(pai)
  return declaraPropriedade && pai.name === no
}

/** A função de topo (`function nome`) onde o nó está; `null` = código solto do módulo, que roda já no import. */
function funcaoDeTopo(no: ts.Node): string | null {
  let atual = no
  while (!ts.isSourceFile(atual.parent)) atual = atual.parent
  return ts.isFunctionDeclaration(atual) && atual.name !== undefined ? atual.name.text : null
}

/**
 * O que a guarda aceita, arquivo por arquivo: uso de global do navegador
 * (`arquivo#funçãoDeTopo:global`) e import SÓ DE TIPO de pacote fora de
 * `PACOTES_PERMITIDOS` (`arquivo#import type:pacote`; se a linha virar import
 * de valor, volta a reprovar). Exceção que deixa de ser usada reprova (último
 * teste), para não virar buraco esquecido.
 */
const EXCECOES: ReadonlySet<string> = new Set([
  // Reduz a foto no canvas (tela do jogador e webview do mestre). A nuvem chega ao arquivo
  // só por `midia.ts` (`isTokenPhotoData`, puro) e nunca chama esta função; o esbuild da W1
  // a tira do bundle. Separar a parte de canvas do arquivo é trabalho fora de `lib/nuvem`.
  'src/lib/tokenPhoto.ts#buildTokenPhotoData:document',
  // O fecho chega aqui por `transicoes/catalogo.ts`, que só importa tipos deste arquivo; e
  // este só pega o tipo do módulo `three`. As duas linhas somem na compilação: nada do three
  // chega ao Worker. Tirar o tipo daqui é trabalho fora de `lib/nuvem`.
  'src/transicoes/tipos.ts#import type:three',
])

interface GlobalUsado {
  nome: string
  linha: number
  funcao: string | null
}

interface LidoDoArquivo {
  imports: ImportLido[]
  globais: GlobalUsado[]
}

function lerArquivo(fonte: ts.SourceFile): LidoDoArquivo {
  const lido: LidoDoArquivo = { imports: [], globais: [] }
  const visitar = (no: ts.Node): void => {
    const importado = importDe(no)
    if (importado !== null) lido.imports.push(importado)
    if (ts.isIdentifier(no) && GLOBAL_PROIBIDO.has(no.text) && !ehNomeDePropriedade(no)) {
      const linha = fonte.getLineAndCharacterOfPosition(no.getStart(fonte)).line + 1
      lido.globais.push({ nome: no.text, linha, funcao: funcaoDeTopo(no) })
    }
    ts.forEachChild(no, visitar)
  }
  visitar(fonte)
  return lido
}

interface Fecho {
  arquivos: string[]
  problemas: string[]
  excecoesUsadas: Set<string>
}

/** Segue os imports relativos a partir das entradas, até o fim; o import de pacote reprova se não está em `PACOTES_PERMITIDOS`. */
function fechoDosImports(entradas: readonly string[]): Fecho {
  const vistos = new Set<string>()
  const problemas: string[] = []
  const excecoesUsadas = new Set<string>()
  const pendentes = [...entradas]
  for (let arquivo = pendentes.pop(); arquivo !== undefined; arquivo = pendentes.pop()) {
    if (vistos.has(arquivo)) continue
    vistos.add(arquivo)
    const nome = relativo(arquivo)
    if (arquivo.endsWith('.tsx')) problemas.push(`${nome}: arquivo .tsx no fecho (o JSX puxa react/jsx-runtime)`)
    const lido = lerArquivo(lerFonte(arquivo))
    for (const global of lido.globais) {
      const excecao = `${nome}#${global.funcao ?? '(topo do módulo)'}:${global.nome}`
      if (EXCECOES.has(excecao)) excecoesUsadas.add(excecao)
      else problemas.push(`${nome}: usa ${global.nome} (linha ${global.linha})`)
    }
    for (const { especificador, soTipo } of lido.imports) {
      if (especificador === IMPORT_CALCULADO) {
        problemas.push(`${nome}: ${IMPORT_CALCULADO}`)
      } else if (!especificador.startsWith('.')) {
        const excecao = `${nome}#import type:${especificador}`
        if (soTipo && EXCECOES.has(excecao)) excecoesUsadas.add(excecao)
        else if (!PACOTES_PERMITIDOS.has(especificador)) problemas.push(`${nome}: importa o pacote ${especificador}, fora de PACOTES_PERMITIDOS`)
      } else {
        const resolvido = ts.resolveModuleName(especificador, arquivo, OPCOES, ts.sys).resolvedModule
        if (resolvido === undefined) problemas.push(`${nome}: import "${especificador}" não resolve`)
        else if (/\.tsx?$/.test(resolvido.resolvedFileName) && !resolvido.resolvedFileName.endsWith('.d.ts')) pendentes.push(comBarra(resolvido.resolvedFileName))
      }
    }
  }
  return { arquivos: [...vistos], problemas, excecoesUsadas }
}

describe('pureza do núcleo da nuvem', () => {
  let guardado: Fecho | null = null
  const fecho = (): Fecho => {
    guardado ??= fechoDosImports(entradasDaNuvem())
    return guardado
  }

  it('segue os imports para fora da pasta: a guarda olha o fecho inteiro, não só a nuvem', () => {
    const arquivos = fecho().arquivos.map(relativo)
    expect(arquivos).toContain('src/lib/nuvem/lote.ts')
    expect(arquivos).toContain('src/lib/nuvem/fila.ts')
    expect(arquivos).toContain('src/lib/personagem.ts')
    expect(arquivos).toContain('src/lib/items.ts')
    expect(arquivos.some((arquivo) => arquivo.endsWith('.test.ts'))).toBe(false)
  })

  it('nenhum pacote fora da lista de permitidos (hoje vazia), nem document, window ou localStorage no fecho', () => {
    expect(fecho().problemas).toEqual([])
  })

  it('toda exceção ainda vale: a que não é mais usada sai da lista', () => {
    expect([...EXCECOES].filter((excecao) => !fecho().excecoesUsadas.has(excecao))).toEqual([])
  })
})
