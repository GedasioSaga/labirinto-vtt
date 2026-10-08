/**
 * MARCAÇÃO LEVE do livro de regras: o pedaço de Markdown que as regras do
 * Discord usam — títulos `#`, `##`, `###`; `**negrito**`, `*itálico*`,
 * `__sublinhado__`, `~~riscado~~`, `` `código` ``; listas `-`/`*`/`•` e
 * `1.`; citação `>`; régua `---`. Nada mais: link, imagem e HTML ficam como o
 * texto que são.
 *
 * O texto vem de arquivo de sistema (de qualquer um) ou da rede: é NÃO
 * CONFIÁVEL. Por isso aqui só se monta uma árvore de blocos e trechos de
 * texto, e quem desenha (`components/MarcacaoLeve.tsx`) usa só elementos
 * React com texto dentro — `<script>` num capítulo aparece escrito, nunca roda.
 */

export type EstiloDoTrecho = 'forte' | 'enfase' | 'sublinhado' | 'riscado'

export type Trecho = { tipo: 'texto'; texto: string } | { tipo: 'codigo'; texto: string } | { tipo: EstiloDoTrecho; filhos: Trecho[] }

/** Uma linha do texto, já em trechos. Parágrafo e citação guardam as quebras de linha do Discord. */
export type Linha = Trecho[]

export type Bloco =
  | { tipo: 'titulo'; nivel: 1 | 2 | 3; trechos: Linha }
  | { tipo: 'paragrafo'; linhas: Linha[] }
  | { tipo: 'citacao'; linhas: Linha[] }
  | { tipo: 'lista'; ordenada: boolean; itens: Linha[] }
  | { tipo: 'regua' }

/** Marcas de trecho, na ordem em que são tentadas: `**` antes de `*`. */
const MARCAS: readonly { marca: string; tipo: EstiloDoTrecho | 'codigo' }[] = [
  { marca: '**', tipo: 'forte' },
  { marca: '__', tipo: 'sublinhado' },
  { marca: '~~', tipo: 'riscado' },
  { marca: '`', tipo: 'codigo' },
  { marca: '*', tipo: 'enfase' },
]

/**
 * Estilo dentro de estilo vai até aqui; abaixo disso é texto. Sem o teto, uma
 * linha de 100 mil `**a ` aninhados viraria recursão de 25 mil níveis — a pilha
 * do navegador estoura e o leitor inteiro cai.
 */
const PROFUNDIDADE_MAX = 4

/**
 * Os trechos de uma linha. Marca sem par vira texto. Cada marca procura o par
 * uma vez por posição, e a que não achou par não procura mais (daí para a
 * frente também não acharia): a linha inteira é lida em tempo linear, mesmo
 * cheia de marcas soltas.
 */
export function trechosDaLinha(linha: string, profundidade = 0): Linha {
  if (profundidade >= PROFUNDIDADE_MAX) return linha.length === 0 ? [] : [{ tipo: 'texto', texto: linha }]
  const trechos: Linha = []
  const semPar = new Set<string>()
  let texto = ''
  let i = 0
  const soltarTexto = () => {
    if (texto.length > 0) trechos.push({ tipo: 'texto', texto })
    texto = ''
  }
  while (i < linha.length) {
    const achada = MARCAS.find(({ marca }) => !semPar.has(marca) && linha.startsWith(marca, i))
    if (achada === undefined) {
      texto += linha[i]
      i += 1
      continue
    }
    const { marca, tipo } = achada
    const fim = linha.indexOf(marca, i + marca.length)
    if (fim === -1) semPar.add(marca)
    const dentro = fim === -1 ? '' : linha.slice(i + marca.length, fim)
    // `* item` e `****` não são ênfase: sem conteúdo, ou começando por espaço, a marca é texto.
    if (fim === -1 || dentro.trim().length === 0 || (tipo === 'enfase' && /^\s/.test(dentro))) {
      texto += marca
      i += marca.length
      continue
    }
    soltarTexto()
    trechos.push(tipo === 'codigo' ? { tipo, texto: dentro } : { tipo, filhos: trechosDaLinha(dentro, profundidade + 1) })
    i = fim + marca.length
  }
  soltarTexto()
  return trechos
}

const TITULO = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/
const REGUA = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/
const ITEM = /^\s*[-*•+]\s+(.*)$/
const ITEM_NUMERADO = /^\s*\d{1,4}[.)]\s+(.*)$/
const CITACAO = /^\s*>\s?(.*)$/
/** Linha "vazia" do Discord: espaço, o preenchedor invisível (U+3164) ou espaço de largura zero. */
const VAZIA = /^[\sㅤ​]*$/u

/** Blocos que juntam linhas seguidas do mesmo tipo. */
type Agrupado = 'paragrafo' | 'citacao' | 'lista' | 'numerada'

/** Lê o texto em blocos: linha vazia fecha o bloco; linhas seguidas do mesmo tipo se juntam. */
export function lerMarcacao(texto: string): Bloco[] {
  const blocos: Bloco[] = []
  let grupo: { tipo: Agrupado; linhas: Linha[] } | null = null
  const fechar = () => {
    if (grupo === null) return
    const { tipo, linhas } = grupo
    blocos.push(tipo === 'lista' || tipo === 'numerada' ? { tipo: 'lista', ordenada: tipo === 'numerada', itens: linhas } : { tipo, linhas })
    grupo = null
  }
  const juntar = (tipo: Agrupado, linha: Linha) => {
    if (grupo !== null && grupo.tipo === tipo) {
      grupo.linhas.push(linha)
      return
    }
    fechar()
    grupo = { tipo, linhas: [linha] }
  }
  for (const linha of texto.replace(/\r\n?/g, '\n').split('\n')) {
    if (VAZIA.test(linha)) {
      fechar()
      continue
    }
    const titulo = TITULO.exec(linha)
    if (titulo !== null) {
      fechar()
      const nivel = Math.min(titulo[1].length, 3)
      blocos.push({ tipo: 'titulo', nivel: nivel === 1 ? 1 : nivel === 2 ? 2 : 3, trechos: trechosDaLinha(titulo[2]) })
      continue
    }
    if (REGUA.test(linha)) {
      fechar()
      blocos.push({ tipo: 'regua' })
      continue
    }
    const item = ITEM.exec(linha)
    const casouItem = item ?? ITEM_NUMERADO.exec(linha)
    if (casouItem !== null) {
      juntar(item === null ? 'numerada' : 'lista', trechosDaLinha(casouItem[1]))
      continue
    }
    const citacao = CITACAO.exec(linha)
    if (citacao === null) juntar('paragrafo', trechosDaLinha(linha.trim()))
    else juntar('citacao', trechosDaLinha(citacao[1]))
  }
  fechar()
  return blocos
}

function textoDosTrechos(trechos: readonly Trecho[]): string {
  return trechos.map((trecho) => (trecho.tipo === 'texto' || trecho.tipo === 'codigo' ? trecho.texto : textoDosTrechos(trecho.filhos))).join('')
}

/** O texto sem as marcas, um bloco por linha: o que a busca do livro procura e mostra no trecho achado. */
export function textoSemMarcacao(texto: string): string {
  return lerMarcacao(texto)
    .flatMap((bloco): string[] => {
      switch (bloco.tipo) {
        case 'titulo':
          return [textoDosTrechos(bloco.trechos)]
        case 'paragrafo':
        case 'citacao':
          return bloco.linhas.map(textoDosTrechos)
        case 'lista':
          return bloco.itens.map(textoDosTrechos)
        case 'regua':
          return []
      }
    })
    .join('\n')
}
