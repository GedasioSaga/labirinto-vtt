import type { LeitorDoCofre, TipoDaEntrada } from './cofre'

/**
 * SÓ PARA OS TESTES do importador (`importar.test.ts`, `aplicar.test.ts`): um
 * cofre do Grimório INVENTADO, em memória. O repositório é público: nenhum dado
 * real entra aqui. Nada do app importa este arquivo.
 */

/** Espaço livre medido e folgado: os testes que não são do espaço não travam nele. */
export const COM_ESPACO = { espacoLivreBytes: 20 * 1024 ** 3 }
export const HASH = /^[0-9a-f]{64}$/

export const SO_NA_NUVEM = 0x400000 | 0x1000
const LOCAL_FIXADO = 0x80000

export type Conteudo = string | Uint8Array
export interface Falso {
  readonly leitor: LeitorDoCofre
  /** Arquivos cujo conteúdo foi aberto (`lerTexto`/`lerBytes`). */
  readonly abertos: string[]
  /** Pastas que o inventário pediu para listar. */
  readonly listadas: string[]
}

/** `atalhos`: caminhos que o leitor mostra como link (o que houver dentro deles não pode ser listado). */
export function cofreFalso(arquivos: Readonly<Record<string, Conteudo>>, atributos: Readonly<Record<string, number>> = {}, atalhos: readonly string[] = []): Falso {
  const conteudos = new Map(Object.entries(arquivos))
  const abertos: string[] = []
  const listadas: string[] = []
  const bytesDe = (conteudo: Conteudo) => (typeof conteudo === 'string' ? new TextEncoder().encode(conteudo) : conteudo)
  const pegar = (caminho: string): Conteudo => {
    const conteudo = conteudos.get(caminho)
    if (conteudo === undefined) throw new Error(`não existe: ${caminho}`)
    return conteudo
  }
  const tipoDe = (caminho: string, temFilhos: boolean): TipoDaEntrada => {
    if (atalhos.includes(caminho)) return 'atalho'
    return temFilhos ? 'pasta' : 'arquivo'
  }
  const leitor: LeitorDoCofre = {
    async listar(pasta) {
      listadas.push(pasta)
      const prefixo = pasta === '' ? '' : `${pasta}/`
      const filhos = new Map<string, boolean>()
      for (const caminho of conteudos.keys()) {
        if (!caminho.startsWith(prefixo)) continue
        const [nome, ...resto] = caminho.slice(prefixo.length).split('/')
        filhos.set(nome, (filhos.get(nome) ?? false) || resto.length > 0)
      }
      return [...filhos].map(([nome, temFilhos]) => ({ nome, tipo: tipoDe(`${prefixo}${nome}`, temFilhos) }))
    },
    async info(caminho) {
      return { bytes: bytesDe(pegar(caminho)).length, atributos: atributos[caminho] ?? LOCAL_FIXADO }
    },
    async lerTexto(caminho) {
      abertos.push(caminho)
      const conteudo = pegar(caminho)
      return typeof conteudo === 'string' ? conteudo : new TextDecoder().decode(conteudo)
    },
    async lerBytes(caminho) {
      abertos.push(caminho)
      return bytesDe(pegar(caminho))
    },
  }
  return { leitor, abertos, listadas }
}

export function png(semente: number): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, semente, semente + 1, semente + 2])
}

export const json = (valor: unknown) => JSON.stringify(valor, null, 2)
/** `imagens`: id do asset → `meta.rel` (o caminho do cofre que o Grimório guarda, `canvasDoc.ts:27-50`). */
export const tldraw = (formas: string[], imagens: Readonly<Record<string, string>> = {}) => ({
  document: {
    store: Object.fromEntries([
      ...formas.map((id) => [id, { id, typeName: 'shape', x: 1 }]),
      ...Object.entries(imagens).map(([id, rel]) => [id, { id, typeName: 'asset', type: 'image', props: { src: 'http://asset.localhost/cofre-inventado' }, meta: { rel } }]),
    ]),
  },
  session: { camera: 1 },
})
export const CRIADO = '2026-01-02T03:04:05.000Z'
export const MODIFICADO = '2026-02-03T04:05:06.000Z'

/** Um cofre pequeno e inventado, com o formato atual e o antigo lado a lado. */
export function cofreInventado(): Record<string, Conteudo> {
  return {
    'campanhas/mar-de-teste/campanha.json': json({ id: 'camp-mar', nome: 'Mar de Teste', descricao: 'Inventada.', criadoEm: CRIADO }),
    'campanhas/mar-de-teste/sessoes/sessao-01.json': json({ id: 'sessao-um', nome: 'Sessão Um', documento: tldraw(['shape:a']) }),
    'campanhas/mar-de-teste/sessoes/sessao-01.notas/roteiro.json': json({ id: 'pag-roteiro', titulo: 'Roteiro', paiId: null, ordem: 0, corpo: '<p>Abre com <strong>tempestade</strong>.</p>' }),
    'campanhas/mar-de-teste/sessoes/sessao-01.notas/chat-ia.json': json({ mensagens: [{ papel: 'user', texto: 'oi', em: '' }] }),
    'campanhas/mar-de-teste/escrita/lendas.json': json({ id: 'caderno-lendas', nome: 'Lendas', documento: null }),
    'campanhas/mar-de-teste/escrita/lendas.notas/origem.json': json({
      id: 'pag-origem', titulo: 'Origem', paiId: null, ordem: 0,
      corpo: '<h2>Começo</h2><ul><li>um</li></ul><img data-rel="imagens/canvas/mapa.png" data-legenda="o mapa"><table><tr><td>x</td></tr></table>',
    }),
    'campanhas/mar-de-teste/escrita/lendas.notas/detalhe.json': json({ id: 'pag-detalhe', titulo: 'Detalhe', paiId: 'pag-origem', ordem: 1, corpo: '<p>filha</p>' }),
    'canvases-soltos/quadro-livre.json': json({
      id: 'canvas-livre', nome: 'Quadro livre', criadoEm: CRIADO,
      documento: tldraw(['shape:b'], { 'asset:mapa': 'imagens/canvas/mapa.png', 'asset:sumiu': 'imagens/canvas/sumiu.png' }),
    }),
    'canvases-soltos/quadro-livre.notas/ideias.json': json({ id: 'pag-ideias', titulo: 'Ideias', paiId: null, ordem: 0, corpo: '<p>Caderno do quadro.</p>' }),
    'mapas-soltos/masmorra.json': json({ id: 'mapa-masmorra', nome: 'Masmorra', documento: tldraw([]), camadas: [{ id: 'c1', nome: 'Base', oculta: false, travada: false }], versaoCamadas: 2 }),
    'personagens-soltos/piratas/pasta.json': json({ id: 'pasta-piratas', nome: 'Piratas' }),
    'personagens-soltos/piratas/capita.json': json({
      id: 'pers-capita', nome: 'Sombra', versaoAtivaId: 'v-noite', criadoEm: CRIADO, modificadoEm: MODIFICADO,
      versoes: [
        {
          id: 'v-dia', nome: 'Capitã Inventada', retrato: 'imagens/personagens/Capita/retrato.png', foco: { x: 40, y: 60 }, resumo: 'Navega em testes.',
          descricao: '<p>Descrição.</p>', informacao: '', historia: '', extras: '', anotacoes: '<p>SEGREDO-TESTE</p>',
          imagens: [{ rel: 'Imagens/personagens/Capita/retrato.png', legenda: 'De frente' }], acervo: [{ itemId: 'item-bussola' }],
        },
        {
          id: 'v-noite', nome: 'Sombra', retrato: null, resumo: '', descricao: '', historia: '', extras: '', anotacoes: '', imagens: [],
          informacao: '<p>À noite.</p><ul><li>leva o <a href="https://exemplo.invalid/mapa">mapa</a></li></ul>',
        },
      ],
    }),
    'personagens-soltos/antigo.json': json({ nome: 'Marujo Antigo', corpo: '<p>Formato plano, sem id.</p>' }),
    'itens/bussola.json': json({ id: 'item-bussola', nome: 'Bússola Falsa', resumo: 'Aponta para o teste.', retrato: null, descricao: '<p>d</p>', informacao: '', efeito: '<p>e</p>' }),
    'cenarios/mares/pasta.json': json({ id: 'pasta-mares', nome: 'Mares' }),
    'cenarios/mares/ilha/cenario.json': json({
      id: 'cen-ilha', nome: 'Ilha de Teste', personagens: ['pers-capita'], versaoAtivaId: 'cv-base',
      versoes: [{ id: 'cv-base', nome: 'Base', retrato: null, resumo: '', descricao: '<p>Ilha.</p>', informacao: '', historia: '', eventos: '', itens: '', acervo: [], anotacoes: '', imagens: [] }],
    }),
    'cenarios/mares/ilha/porto/cenario.json': json({ id: 'cen-porto', nome: 'Porto', retrato: 'imagens-cenarios/retrato-cen-porto.png', descricao: '<p>Formato plano.</p>' }),
    'vinculos.json': json({
      vinculos: [
        { id: 'v1', deTipo: 'pasta', deId: 'pasta-piratas', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '', criadoEm: CRIADO },
        { id: 'v2', deTipo: 'cenario', deId: 'cen-ilha', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '' },
        { id: 'v3', deTipo: 'canvas', deId: 'canvas-livre', paraTipo: 'campanha', paraId: 'camp-mar', tipo: 'participa', notas: '' },
        { id: 'v4', deTipo: 'item', deId: 'item-bussola', paraTipo: 'campanha', paraId: 'camp-na-lixeira', tipo: 'participa', notas: '' },
        { id: 'v5', deTipo: 'personagem', deId: 'pers-capita', paraTipo: 'cenario', paraId: 'cen-ilha', tipo: 'mora em', notas: 'desde o teste', criadoEm: CRIADO },
        { id: 'v6', deTipo: 'canvas', deId: 'x', paraTipo: 'canvas', paraId: 'y', tipo: 'invalido' },
      ],
    }),
    'layout-teia.json': json({ cofre: { 'pers-capita': { x: 0.25, y: 0.75 }, torto: 'x' }, 'campanha:camp-mar': { 'cen-ilha': { x: 0.5, y: 0.5 } } }),
    'Imagens/personagens/Capita/retrato.png': png(1),
    'imagens-cenarios/retrato-cen-porto.png': png(1),
    'Imagens/canvas/mapa.png': png(9),
    'Imagens/leia-me.md': '# notas soltas',
    'desktop.ini': '[.ShellClassInfo]',
    '.lixeira/lix-1/entrada.json': json({ id: 'lix-1', tipo: 'personagem', nome: 'Descartado' }),
    '.lixeira/lix-1/descartado.json': json({ id: 'pers-descartado', nome: 'Descartado' }),
  }
}
