// Empacota uma ferramenta da mesa dos MÓVEIS (onda 4, CONTRATO.md seção 10) com o
// motor dos móveis do app, SÓ PARA LEITURA, e troca a superfície pela do Desenhado.
//
//   node ferramentas/construir.mjs <entrada.ts> <saida.mjs> [--cliente=<client/src>]
//
// - "@cliente/..." aponta para o client/src do checkout PRINCIPAL do repositório (o
//   "git common dir" do worktree; os móveis novos de 28/10 ainda não estão nesta branch)
//   ou para --cliente. Nada é escrito lá: o esbuild só lê.
// - O motor.ts lido ganha, só no pacote, uma função a mais, __trocarTexturaDaClasse,
//   que troca a função de textura de uma classe na tabela TEXTURA. É o ponto onde a
//   superfície do material entra hoje; a integração faz a mesma troca no app.
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const aqui = dirname(fileURLToPath(import.meta.url))
const raiz = resolve(aqui, '../../..')
const [entrada, saida, ...resto] = process.argv.slice(2)
if (!entrada || !saida) {
  console.error('uso: node construir.mjs <entrada.ts> <saida.mjs> [--cliente=<client/src>]')
  process.exit(2)
}

function clientePadrao() {
  try {
    const comum = execSync('git rev-parse --path-format=absolute --git-common-dir', { cwd: raiz, encoding: 'utf8' }).trim()
    const principal = join(dirname(comum), 'client', 'src')
    if (existsSync(principal)) return principal
  } catch {
    // sem git: fica o client deste worktree
  }
  return join(raiz, 'client', 'src')
}

const opcao = resto.find((a) => a.startsWith('--cliente='))
const cliente = opcao ? opcao.slice('--cliente='.length) : clientePadrao()

const TROCA = `
// ---- só no pacote da mesa de prova (godot/desenhado/ferramentas/construir.mjs) ----
export function __trocarTexturaDaClasse(classe: ClasseDaPeca, t: Textura | null): Textura | null {
  const tabela = TEXTURA as Record<ClasseDaPeca, Textura | null>
  const antes = tabela[classe]
  tabela[classe] = t
  return antes
}
`

const pluginDoCliente = {
  name: 'cliente-so-leitura',
  setup(b) {
    b.onResolve({ filter: /^@cliente\// }, (args) => {
      const base = join(cliente, args.path.slice('@cliente/'.length))
      for (const c of [base + '.ts', base + '.tsx', join(base, 'index.ts')]) if (existsSync(c)) return { path: c }
      return { errors: [{ text: `não achei ${base} em ${cliente}` }] }
    })
    b.onLoad({ filter: /[\\/]moveis[\\/]motor\.ts$/ }, (args) => {
      const texto = readFileSync(args.path, 'utf8')
      if (!texto.includes('const TEXTURA: Readonly<Record<ClasseDaPeca, Textura | null>> = {')) {
        return { errors: [{ text: `${args.path} mudou: não achei a tabela TEXTURA (a troca da superfície precisa dela)` }] }
      }
      return { contents: texto + TROCA, loader: 'ts' }
    })
    // A sebe passa texFolhagem direto (3 peças) e a troca da classe folha não chegaria
    // nela; no pacote ela pede pela tabela, como a integração precisa (CONTRATO.md 10.8).
    // Sem troca, a tabela devolve o próprio texFolhagem: o Atual sai igual.
    b.onLoad({ filter: /[\\/]moveis[\\/]sebe\.ts$/ }, (args) => {
      const texto = readFileSync(args.path, 'utf8')
      const partes = texto.split('textura: texFolhagem')
      if (partes.length < 2) {
        return { errors: [{ text: `${args.path} mudou: não achei "textura: texFolhagem" (a folha da sebe)` }] }
      }
      const pela = "textura: (__texturaDaClasse('folha') ?? texFolhagem)"
      const importa = "import { texturaDaClasse as __texturaDaClasse } from './motor'\n"
      return { contents: importa + partes.join(pela), loader: 'ts' }
    })
  },
}

const esbuild = createRequire(join(raiz, 'package.json'))('esbuild')
await esbuild.build({
  entryPoints: [entrada],
  outfile: saida,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'warning',
  plugins: [pluginDoCliente],
})
console.log(`empacotado com o client de ${cliente}`)
