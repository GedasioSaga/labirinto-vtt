/*
 * GUARDA do teste em níveis (docs/planos/teste-em-niveis.md).
 *
 * Os projetos do vitest (rapido / lento / desempenho) e o mapa de specs e2e
 * são listas de caminhos escritas à mão. Arquivo renomeado deixa a lista
 * apontando para o nada SEM erro nenhum: o teste lento cai no 'rapido' e volta
 * a travar o laço, o spec da área some do N1. Esta guarda transforma isso em
 * vermelho. Também prende as regras de decisão do scripts/teste-rapido.cjs
 * (lista branca do N1, gatilhos do N2), que são a garantia da ferramenta.
 *
 * É .mjs (fora do tsconfig) porque o projeto não tem @types/node e o script é
 * CommonJS fora de client/.
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const ferramenta = require('../scripts/teste-rapido.cjs')
const CLIENTE = dirname(fileURLToPath(import.meta.url))
const EH_TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/

const projetos = ferramenta.lerProjetos(join(CLIENTE, 'vitest.projetos.json'))
const mapa = JSON.parse(readFileSync(join(CLIENTE, 'e2e', 'mapa-de-specs.json'), 'utf8'))
const specs = ferramenta.specsExistentes(CLIENTE)
const arquivosDoCliente = ferramenta.listarArquivos(CLIENTE).filter((a) => !/^(?:e2e|recreate)\//.test(a))
const testesDoVitest = arquivosDoCliente.filter((a) => EH_TESTE.test(a))
const fontesDoRepo = ferramenta.listarArquivos(join(CLIENTE, 'src')).map((a) => 'client/src/' + a)

const casam = (glob, lista) => lista.filter((a) => ferramenta.globParaRegex(glob).test(a))

describe('vitest.projetos.json', () => {
  for (const projeto of ['lento', 'desempenho']) {
    for (const item of projetos.bruto[projeto]) {
      if (item.pendente) {
        it(projeto + ': ' + item.glob + ' ainda não chegou (' + item.pendente + ')', () => {
          // Chegou pelo merge: tire a marca `pendente` para a guarda voltar a cobrar o glob.
          expect(casam(item.glob, testesDoVitest)).toEqual([])
        })
      } else {
        it(projeto + ': ' + item.glob + ' casa com algum arquivo de teste', () => {
          expect(casam(item.glob, testesDoVitest).length).toBeGreaterThan(0)
        })
      }
    }
  }

  it('nenhum arquivo cai em lento E desempenho (rodaria duas vezes)', () => {
    const duplos = testesDoVitest.filter((a) => ferramenta.casaAlgum(a, projetos.lento) && ferramenta.casaAlgum(a, projetos.desempenho))
    expect(duplos).toEqual([])
  })

  it('os testes de sempre no N1 existem', () => {
    for (const arquivo of projetos.bruto.sempreNoN1) expect(arquivosDoCliente).toContain(arquivo)
  })
})

describe('e2e/mapa-de-specs.json', () => {
  const nomesDeSpec = [...mapa.sempre, ...mapa.fumaca, ...mapa.areas.flatMap((a) => [...a.specs, ...(a.n0 || [])])]
  for (const nome of nomesDeSpec) {
    it('spec ' + nome + ' existe', () => {
      expect(casam(nome, specs).length).toBeGreaterThan(0)
    })
  }
  const fontes = [...mapa.centrais, ...mapa.quentes, ...mapa.visuais, ...mapa.areas.flatMap((a) => a.fontes)]
  for (const glob of fontes) {
    it('fonte ' + glob + ' casa com algum arquivo', () => {
      expect(casam(glob, fontesDoRepo).length).toBeGreaterThan(0)
    })
  }
})

describe('decisão do scripts/teste-rapido.cjs', () => {
  const ctx = { projetos, mapa, specs, cache: 'cache', existe: () => true }
  const planejar = (arquivos, nivelPedido = 1) =>
    ferramenta.montarPlano({ nivelPedido, base: 'main', topo: null, mergeBase: 'abc', arquivos, ctx, so: null })
  const specsDoE2e = (plano) => (plano.etapas.find((e) => e.tipo === 'e2e') || { args: [] }).args

  it('só .ts de uma área: N1 com golden, seladas, a área e o round-trip dos mapas', () => {
    const plano = planejar(['client/src/lib/camadas/ordem.ts'])
    expect(plano.nivel).toBe(1)
    for (const s of mapa.sempre) expect(specsDoE2e(plano)).toContain(s)
    expect(specsDoE2e(plano)).toContain('task-camadas-painel.spec.ts')
    const vitest = plano.etapas.find((e) => e.id === 'vitest-rapido')
    expect(vitest.args).toContain('src/lib/camadas/ordem.ts')
    for (const sempre of projetos.bruto.sempreNoN1) expect(vitest.args).toContain(sempre)
  })

  it.each([
    ['client/src/components/LayersPanel.css', 'css'],
    ['client/src/lib/camadas/dados.json', 'json'],
    ['client/src/stores/mapStore.ts', 'quente'],
    ['client/src/texturas/meioTermo/materiais.ts', 'visual'],
    ['client/src/lib/__fixtures__/itensDeCamada.ts', 'fixture'],
    ['client/src/lib/arquivoQueNenhumaAreaConhece.ts', 'sem área'],
    ['client/e2e/helpers/enterEditor.ts', 'helper'],
    ['package.json', 'dependência'],
    ['client/vite.config.ts', 'config'],
    ['client/public/animacoes/x.png', 'asset'],
  ])('%s (%s) força o N2', (arquivo) => {
    const plano = planejar(['client/src/lib/camadas/ordem.ts', arquivo])
    expect(plano.nivel).toBe(2)
    expect(plano.etapas.map((e) => e.id)).toEqual(expect.arrayContaining(['vitest-rapido-lento', 'e2e', 'vitest-desempenho']))
    expect(plano.etapas.at(-1).id).toBe('vitest-desempenho')
  })

  it('gatilho de config força o N2 até no N0', () => {
    expect(planejar(['client/package.json'], 0).nivel).toBe(2)
  })

  it('.rs do exe fica no N1 e chama o cargo', () => {
    const plano = planejar(['desktop/src-tauri/src/lib.rs'])
    expect(plano.nivel).toBe(1)
    expect(plano.etapas.map((e) => e.id)).toEqual(expect.arrayContaining(['cargo-clippy', 'cargo-test']))
  })

  it('teste mudado do projeto lento roda no N1', () => {
    const lento = testesDoVitest.find((a) => ferramenta.casaAlgum(a, projetos.lento))
    const plano = planejar(['client/' + lento])
    expect(plano.etapas.find((e) => e.id === 'vitest-lento-mudados').args).toContain(lento)
  })

  it('só documentação: N1 roda o de sempre, sem omitir', () => {
    const plano = planejar(['docs/planos/x.md'])
    expect(plano.nivel).toBe(1)
    expect(specsDoE2e(plano)).toContain('task-camadas-golden.spec.ts')
  })
})

describe('e2e vermelhos pré-existentes (e2e/vermelhas-conhecidas.json)', () => {
  // Spec de ÁREA pode ter vermelho conhecido (o N1 o pula por título e o N2 o vigia).
  // Golden, seladas e fumaça nunca são tolerados.
  it('nenhum teste conhecido mora no golden, nas seladas ou na fumaça', () => {
    const intocaveis = ferramenta.expandirSpecs([...mapa.sempre, ...mapa.fumaca], specs)
    const proibidos = [...ferramenta.lerConhecidas()].filter((nome) => intocaveis.has(nome.split(' › ')[0]))
    expect(proibidos).toEqual([])
  })

  it('todo teste conhecido aponta para um spec que existe', () => {
    const fantasmas = [...ferramenta.lerConhecidas()].filter((nome) => !specs.includes(nome.split(' › ')[0]))
    expect(fantasmas).toEqual([])
  })

  it('o nome sai do JSON do Playwright no formato do reporter list', () => {
    const relatorio = { suites: [{ title: 'task-x.spec.ts', file: 'task-x.spec.ts', specs: [{ title: 'solto', tests: [{ status: 'unexpected' }] }],
      suites: [{ title: 'grupo', specs: [{ title: 'dentro', tests: [{ status: 'expected' }] }] }] }] }
    const { falhas, passaram } = ferramenta.nomesDoRelatorioE2e(relatorio)
    expect([...falhas]).toEqual(['task-x.spec.ts › solto'])
    expect([...passaram]).toEqual(['task-x.spec.ts › grupo › dentro'])
  })

  it('falha nova reprova, conhecida tolera, conhecida que passou vira aviso', () => {
    const conhecidas = new Set(['a › 1', 'a › 2'])
    expect(ferramenta.compararComConhecidas(new Set(['a › 1', 'b › 9']), new Set(['a › 2']), conhecidas)).toEqual({ novas: ['b › 9'], curadas: ['a › 2'] })
    expect(ferramenta.compararComConhecidas(new Set(['a › 1']), new Set(), conhecidas)).toEqual({ novas: [], curadas: [] })
  })
})
