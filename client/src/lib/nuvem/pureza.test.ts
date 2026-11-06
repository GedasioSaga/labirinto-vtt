import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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

/**
 * As entradas: todo `.ts` da pasta que não é teste, e a grade da Arena
 * (`lib/arena/grade.ts`), que o treino e o duelo do Worker importam direto:
 * ela tem de continuar pura mesmo se nada da nuvem chegar a ela.
 */
function entradasDaNuvem(): string[] {
  const pasta = pastaDaNuvem()
  if (!ts.sys.directoryExists(pasta)) throw new Error(`A pasta da nuvem não está em ${pasta}`)
  const grade = comBarra(ts.sys.resolvePath(`${pasta}/../arena/grade.ts`))
  if (!ts.sys.fileExists(grade)) throw new Error(`A grade da Arena não está em ${grade}`)
  const daNuvem = ts.sys
    .readDirectory(pasta, ['.ts'], undefined, undefined, 1)
    .map(comBarra)
    .filter((arquivo) => !arquivo.endsWith('.test.ts') && !arquivo.endsWith('.d.ts'))
  return [...daNuvem, grade]
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
    expect(arquivos).toContain('src/lib/arena/grade.ts')
    expect(arquivos.some((arquivo) => arquivo.endsWith('.test.ts'))).toBe(false)
  })

  it('nenhum pacote fora da lista de permitidos (hoje vazia), nem document, window ou localStorage no fecho', () => {
    expect(fecho().problemas).toEqual([])
  })

  it('toda exceção ainda vale: a que não é mais usada sai da lista', () => {
    expect([...EXCECOES].filter((excecao) => !fecho().excecoesUsadas.has(excecao))).toEqual([])
  })
})

// ── O bundle do Worker ───────────────────────────────────────────────────────

/**
 * A guarda de cima só segue os imports de `lib/nuvem`. O Worker
 * (`lobby/nuvem`) importa mais do app: o duelo da T6 chega à regra do treino e
 * à fábrica da batalha One Piece, e foi por ali que React e zustand entraram no
 * bundle sem nenhum teste ver (auditoria da fase 1 do Lobby). Esta parte olha o
 * que o wrangler empacota DE VERDADE: roda o `wrangler deploy --dry-run` (nada
 * sobe, nenhuma conta é usada) numa pasta temporária e reprova módulo proibido
 * no metafile e `document.` no código.
 */
const PASTA_DO_WORKER = 'lobby/nuvem'
const WRANGLER = 'node_modules/wrangler/bin/wrangler.js'
/** O dry-run leva ~3 s sozinho; com a suíte em paralelo, bem mais. */
const TEMPO_DO_DRY_RUN_MS = 90_000
const TEMPO_DO_TESTE_MS = TEMPO_DO_DRY_RUN_MS + 30_000
/** Módulo de pacote que não pode entrar no Worker, pelo caminho no metafile. Do zustand, só a parte sem React (`zustand/vanilla`). */
const MODULOS_PROIBIDOS: readonly { nome: string; padrao: RegExp }[] = [
  { nome: 'react', padrao: /node_modules\/(react|react-dom)\// },
  { nome: 'zustand com react', padrao: /node_modules\/zustand\/(?!esm\/vanilla\.mjs$)/ },
  { nome: '@tauri-apps', padrao: /node_modules\/@tauri-apps\// },
  { nome: 'pixi', padrao: /node_modules\/(pixi\.js|@pixi)\// },
]
const TEXTO_PROIBIDO = 'document.'
/** Quanto do código em volta de cada `document.` achado vai na mensagem. */
const CONTEXTO_DO_ACHADO = 60

interface BundleDoWorker {
  /** Os módulos que entraram, como o metafile os escreve (relativos a `lobby/nuvem`). */
  entradas: string[]
  codigo: string
}

/** A raiz do repo: `client/src/lib/nuvem` sobe quatro pastas. */
function raizDoRepo(): string {
  return comBarra(ts.sys.resolvePath(`${pastaDaNuvem()}/../../../..`))
}

function entradasDoMetafile(texto: string): string[] {
  const lido: unknown = JSON.parse(texto)
  if (typeof lido !== 'object' || lido === null || !('inputs' in lido) || typeof lido.inputs !== 'object' || lido.inputs === null) {
    throw new Error('o metafile do dry-run não tem "inputs"')
  }
  return Object.keys(lido.inputs).map(comBarra)
}

/** Roda o `wrangler deploy --dry-run` do Worker e lê o metafile e o `index.js`; a pasta temporária sai no fim. */
function empacotarOWorker(): BundleDoWorker {
  const raiz = raizDoRepo()
  const saida = comBarra(mkdtempSync(`${comBarra(tmpdir())}/pureza-do-worker-`))
  try {
    const rodada = spawnSync('node', [`${raiz}/${WRANGLER}`, 'deploy', '--dry-run', '--outdir', saida, '--metafile', `${saida}/meta.json`], {
      cwd: `${raiz}/${PASTA_DO_WORKER}`,
      encoding: 'utf8',
      timeout: TEMPO_DO_DRY_RUN_MS,
      windowsHide: true,
    })
    if (rodada.error !== undefined) throw new Error(`o wrangler não rodou: ${rodada.error.message}`)
    if (rodada.status !== 0) throw new Error(`wrangler deploy --dry-run saiu com ${String(rodada.status)}: ${rodada.stderr}`)
    const meta = ts.sys.readFile(`${saida}/meta.json`)
    const codigo = ts.sys.readFile(`${saida}/index.js`)
    if (meta === undefined || codigo === undefined) throw new Error(`o dry-run não deixou meta.json e index.js em ${saida}`)
    return { entradas: entradasDoMetafile(meta), codigo }
  } finally {
    rmSync(saida, { recursive: true, force: true })
  }
}

/** Cada `document.` do código, com um pedaço em volta para achar de onde veio. */
function usosDoDocument(codigo: string): string[] {
  const achados: string[] = []
  for (let indice = codigo.indexOf(TEXTO_PROIBIDO); indice !== -1; indice = codigo.indexOf(TEXTO_PROIBIDO, indice + 1)) {
    achados.push(codigo.slice(Math.max(0, indice - CONTEXTO_DO_ACHADO), indice + CONTEXTO_DO_ACHADO))
  }
  return achados
}

describe('pureza do bundle do Worker (o que o wrangler empacota em lobby/nuvem)', () => {
  let guardado: BundleDoWorker | null = null
  const bundle = (): BundleDoWorker => {
    guardado ??= empacotarOWorker()
    return guardado
  }

  it(
    'nenhum módulo de react, zustand com react, @tauri-apps ou pixi entra no bundle',
    () => {
      const { entradas } = bundle()
      // O bundle tem o Worker de verdade: lista vazia não passa por engano.
      expect(entradas).toContain('src/index.ts')
      const achados = entradas.flatMap((entrada) => MODULOS_PROIBIDOS.filter(({ padrao }) => padrao.test(entrada)).map(({ nome }) => `${nome}: ${entrada}`))
      expect(achados).toEqual([])
    },
    TEMPO_DO_TESTE_MS,
  )

  it(
    'nenhum document. no código empacotado',
    () => {
      expect(usosDoDocument(bundle().codigo)).toEqual([])
    },
    TEMPO_DO_TESTE_MS,
  )
})
