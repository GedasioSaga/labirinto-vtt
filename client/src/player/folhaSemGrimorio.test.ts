/**
 * A FOLHA DO JOGADOR SEM O GRIMÓRIO DO MESTRE. Os primitivos de
 * `components/grimorio/` importam `grimorio.css` cada um, e o Vite põe na folha
 * de `player.html` o CSS de todo módulo que a entrada alcança. Um import só,
 * direto ou por um componente dividido com o editor, somaria ~22,6 KB
 * minificados (4,5 KB gzip) à folha que o celular baixa antes do mapa — e nada
 * na tela avisaria. Este teste anda pelo grafo de imports a partir da entrada
 * do jogador (`boot.tsx`, a de `player.html`), como o bundler anda, e fica
 * vermelho no primeiro módulo de `components/grimorio/` que encontrar, com o
 * caminho de imports até ele.
 */
import { describe, expect, it, vi } from 'vitest'

/** Lê um arquivo; `null` quando ele não existe (é assim que a resolução prova cada candidato). */
type Leitor = (caminho: string) => string | null

/** Onde o grafo não pode chegar: a pasta dos primitivos do grimório e a folha dele, onde quer que seja copiada. */
const PROIBIDO = /\/components\/grimorio\/|\/grimorio\.css$/

const EXTENSAO_CONHECIDA = /\.(tsx?|css|json|svg|png|jpe?g|webp|gif|wav|mp3|ogg|txt|md|html)$/

function semComentarios(codigo: string): string {
  // O `//` de linha só conta depois de espaço ou no começo: o `https://` de uma string não é comentário.
  return codigo.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** Os especificadores RELATIVOS que um módulo importa: estático, reexporte, efeito colateral, `import()` e o `@import` do CSS. */
function importsRelativos(caminho: string, codigo: string): string[] {
  const limpo = semComentarios(codigo)
  const padroes = caminho.endsWith('.css')
    ? [/@import\s+(?:url\()?\s*['"]([^'"]+)['"]/g]
    : [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g]
  const achados = padroes.flatMap((padrao) => Array.from(limpo.matchAll(padrao), (m) => m[1]))
  return achados.filter((especificador) => especificador.startsWith('./') || especificador.startsWith('../')).map((especificador) => especificador.replace(/\?.*$/, ''))
}

function pastaDe(caminho: string): string {
  return caminho.slice(0, caminho.lastIndexOf('/'))
}

/** `a/b/../c/./d` → `a/c/d`, sempre com `/`. */
function normalizar(caminho: string): string {
  const partes: string[] = []
  for (const parte of caminho.split('/')) {
    if (parte === '..') partes.pop()
    else if (parte !== '.' && parte !== '') partes.push(parte)
  }
  return `${caminho.startsWith('/') ? '/' : ''}${partes.join('/')}`
}

/** O arquivo que o bundler abriria para `especificador`, como o `moduleResolution: bundler` deste client. */
function resolver(de: string, especificador: string, ler: Leitor): { caminho: string; codigo: string } | null {
  const base = normalizar(`${pastaDe(de)}/${especificador}`)
  const candidatos = EXTENSAO_CONHECIDA.test(base) ? [base] : [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
  for (const candidato of candidatos) {
    const codigo = ler(candidato)
    if (codigo !== null) return { caminho: candidato, codigo }
  }
  return null
}

interface Percurso {
  /** Cada módulo proibido alcançado, com a fila de imports desde a entrada. */
  proibidos: string[][]
  /** Imports relativos que não viraram arquivo: a régua não pode ficar cega a eles. */
  semArquivo: string[]
  alcancados: number
}

function percorrer(entrada: string, ler: Leitor): Percurso {
  const pai = new Map<string, string | null>([[entrada, null]])
  const codigoDaEntrada = ler(entrada)
  if (codigoDaEntrada === null) return { proibidos: [], semArquivo: [entrada], alcancados: 0 }
  const fila: Array<{ caminho: string; codigo: string }> = [{ caminho: entrada, codigo: codigoDaEntrada }]
  const proibidos: string[][] = []
  const semArquivo: string[] = []
  const caminhoAte = (alvo: string): string[] => {
    const cadeia: string[] = []
    for (let atual: string | null = alvo; atual !== null; atual = pai.get(atual) ?? null) cadeia.unshift(atual)
    return cadeia
  }
  while (fila.length > 0) {
    const atual = fila.shift()
    if (atual === undefined) break
    if (PROIBIDO.test(atual.caminho)) {
      // Daqui para dentro é o grimório inteiro: basta o primeiro passo, com o caminho até ele.
      proibidos.push(caminhoAte(atual.caminho))
      continue
    }
    // Asset (imagem, som, json) não importa ninguém; só código e CSS continuam o grafo.
    if (!/\.(tsx?|css)$/.test(atual.caminho)) continue
    for (const especificador of importsRelativos(atual.caminho, atual.codigo)) {
      const alvo = resolver(atual.caminho, especificador, ler)
      if (alvo === null) {
        semArquivo.push(`${especificador} (em ${atual.caminho})`)
        continue
      }
      if (pai.has(alvo.caminho)) continue
      pai.set(alvo.caminho, atual.caminho)
      fila.push(alvo)
    }
  }
  return { proibidos, semArquivo, alcancados: pai.size }
}

async function leitorDoDisco(): Promise<{ ler: Leitor; entrada: string }> {
  const { readFileSync } = await vi.importActual<{ readFileSync(caminho: string, codificacao: 'utf8'): string }>('node:fs')
  const { fileURLToPath } = await vi.importActual<{ fileURLToPath(url: string): string }>('node:url')
  const aqui = fileURLToPath(import.meta.url).replace(/\\/g, '/')
  const ler: Leitor = (caminho) => {
    try {
      return readFileSync(caminho, 'utf8')
    } catch {
      return null
    }
  }
  return { ler, entrada: `${pastaDe(aqui)}/boot.tsx` }
}

function leitorDeMentira(arquivos: Record<string, string>): Leitor {
  return (caminho) => (Object.hasOwn(arquivos, caminho) ? arquivos[caminho] : null)
}

describe('a folha do jogador não leva o grimório do mestre', () => {
  it('nenhum módulo alcançado a partir de player/boot.tsx mora em components/grimorio/', async () => {
    const { ler, entrada } = await leitorDoDisco()
    const percurso = percorrer(entrada, ler)
    expect(percurso.semArquivo, 'imports relativos que a régua não achou no disco (ela ficaria cega a eles)').toEqual([])
    // Piso: a entrada de verdade alcança centenas de módulos; poucos = a régua parou de andar.
    expect(percurso.alcancados).toBeGreaterThan(100)
    expect(
      percurso.proibidos.map((cadeia) => cadeia.map((caminho) => caminho.slice(caminho.indexOf('/src/') + 1)).join(' → ')),
      'o grimório entrou no bundle do jogador por este caminho',
    ).toEqual([])
  })

  describe('a régua morde (grafo de mentira)', () => {
    const ENTRADA = '/c/src/player/boot.tsx'

    it('acha o grimorio.css importado direto pelo CSS do jogador', () => {
      const ler = leitorDeMentira({
        [ENTRADA]: "import './player.css'\n",
        '/c/src/player/player.css': "@import '../components/grimorio/grimorio.css';\n.pp-bar { color: red }\n",
        '/c/src/components/grimorio/grimorio.css': '.gr-botao {}',
      })
      expect(percorrer(ENTRADA, ler).proibidos).toEqual([[ENTRADA, '/c/src/player/player.css', '/c/src/components/grimorio/grimorio.css']])
    })

    it('acha o primitivo trazido por um componente dividido com o editor, por import de várias linhas', () => {
      const ler = leitorDeMentira({
        [ENTRADA]: "import { PlayerApp } from './main'\n",
        '/c/src/player/main.tsx': "import {\n  Comum,\n  type Outro,\n} from '../components/Comum'\n",
        '/c/src/components/Comum.tsx': "import { Botao } from './grimorio/Botao'\n",
        '/c/src/components/grimorio/Botao.tsx': "import './grimorio.css'\n",
      })
      expect(percorrer(ENTRADA, ler).proibidos).toEqual([[ENTRADA, '/c/src/player/main.tsx', '/c/src/components/Comum.tsx', '/c/src/components/grimorio/Botao.tsx']])
    })

    it('acha o import dinâmico e ignora o que está em comentário', () => {
      const ler = leitorDeMentira({
        [ENTRADA]: "// import './nao/existe'\n/* import '../components/grimorio/Nota' */\nconst carregar = () => import('../components/grimorio/Nota')\n",
        '/c/src/components/grimorio/Nota.tsx': "import './grimorio.css'\n",
      })
      const percurso = percorrer(ENTRADA, ler)
      expect(percurso.semArquivo).toEqual([])
      expect(percurso.proibidos).toEqual([[ENTRADA, '/c/src/components/grimorio/Nota.tsx']])
    })

    it('import relativo sem arquivo vira aviso, não silêncio', () => {
      const ler = leitorDeMentira({ [ENTRADA]: "import { x } from './sumiu'\n" })
      expect(percorrer(ENTRADA, ler).semArquivo).toEqual([`./sumiu (em ${ENTRADA})`])
    })
  })
})
