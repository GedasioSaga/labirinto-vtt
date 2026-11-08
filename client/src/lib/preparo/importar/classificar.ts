import { extensaoDe } from './cofre'

/**
 * PARA ONDE VAI CADA ARQUIVO DO COFRE (plano §4, passos 4 e 5). A regra:
 * cada arquivo cai em EXATAMENTE 1 destino, e nenhum fica "sem destino". Aqui
 * a decisão sai só do caminho, com as pastas que o Grimório usa
 * (`vaultRepo.ts:179-246,530-545,691-724`, `caminhos.ts`, `lixeira.ts:6-28`);
 * a simulação pode trocar o destino para `falha` (só na nuvem, ilegível) ou
 * `soOriginal` (JSON que não deu para entender).
 */

export type TipoNoGrimorio =
  | 'campanha'
  | 'sessao'
  /** Caderno da Escrita (`campanhas/<c>/escrita/<x>.json`): as páginas moram em `<x>.notas/`. */
  | 'caderno'
  | 'pagina'
  /** Chat de IA de uma sessão ou caderno (`<x>.notas/chat-ia.json`). */
  | 'chat'
  | 'canvas'
  | 'mapa'
  | 'personagem'
  | 'cenario'
  | 'item'
  /** `pasta.json`: nome e id de uma pasta de personagens, cenários ou itens. */
  | 'pasta'
  | 'vinculos'
  | 'teia'
  | 'imagem'
  | 'lixeira'
  | 'outro'

export type Destino =
  | 'verbete'
  | 'quadro'
  | 'ligacoes'
  | 'campanha'
  | 'midia'
  /** Vira a organização dos verbetes: nome da pasta e campanha herdada. */
  | 'organizacao'
  | 'teia'
  /** Guardado só para leitura, junto da sessão. */
  | 'chat'
  | 'lixeira'
  /** Não vira nada no Prelúdio: fica só em `importacoes/<data>/original/`. */
  | 'soOriginal'
  | 'ignorado'
  /** Não deu para ler (só na nuvem, erro do disco): trava o "Aplicar". */
  | 'falha'

export const TIPOS_NO_GRIMORIO: readonly TipoNoGrimorio[] = [
  'campanha', 'sessao', 'caderno', 'pagina', 'chat', 'canvas', 'mapa', 'personagem',
  'cenario', 'item', 'pasta', 'vinculos', 'teia', 'imagem', 'lixeira', 'outro',
]

export const DESTINOS: readonly Destino[] = [
  'verbete', 'quadro', 'ligacoes', 'campanha', 'midia', 'organizacao', 'teia', 'chat', 'lixeira', 'soOriginal', 'ignorado', 'falha',
]

export interface Classificacao {
  readonly tipo: TipoNoGrimorio
  readonly destino: Destino
  /** Por que foi ignorado ou guardado só como original. */
  readonly motivo?: string
  /** A campanha pelo lugar do arquivo (`campanhas/<slug>/…`). */
  readonly campanhaSlug?: string
  /** Página e chat: o documento dono da pasta `.notas` (`…/<x>.json`). */
  readonly dono?: string
}

const EXTENSOES_DE_IMAGEM: ReadonlySet<string> = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'avif'])
const EXTENSOES_DE_TEXTO: ReadonlySet<string> = new Set(['md', 'txt'])
const ARQUIVOS_DO_SISTEMA: ReadonlySet<string> = new Set(['desktop.ini', 'thumbs.db', '.ds_store'])
const SUFIXO_DAS_NOTAS = '.notas'
const ARQUIVO_DO_CHAT = 'chat-ia.json'
const ARQUIVO_DA_PASTA = 'pasta.json'
const FORA_DO_LUGAR = 'JSON fora das pastas que o Grimório lê'

function soOriginal(motivo: string): Classificacao {
  return { tipo: 'outro', destino: 'soOriginal', motivo }
}

function naRaiz(nome: string): Classificacao {
  if (nome === 'vinculos.json') return { tipo: 'vinculos', destino: 'ligacoes' }
  if (nome === 'layout-teia.json') return { tipo: 'teia', destino: 'teia' }
  return soOriginal(FORA_DO_LUGAR)
}

/** `…/<x>.notas/<arquivo>.json`: página do caderno de `<x>`, ou o chat de IA dele. */
function nasNotas(partes: readonly string[], nome: string, campanhaSlug: string | undefined): Classificacao | null {
  const pastaDasNotas = partes[partes.length - 2]
  if (partes.length < 3 || !pastaDasNotas.toLowerCase().endsWith(SUFIXO_DAS_NOTAS)) return null
  const dono = [...partes.slice(0, -2), `${pastaDasNotas.slice(0, -SUFIXO_DAS_NOTAS.length)}.json`].join('/')
  const tipo = nome === ARQUIVO_DO_CHAT ? 'chat' : 'pagina'
  return { tipo, destino: tipo === 'chat' ? 'chat' : 'verbete', dono, campanhaSlug }
}

/** Map, e não objeto: uma pasta chamada "constructor" não acha nada no protótipo. */
const NA_CAMPANHA: ReadonlyMap<string, { tipo: TipoNoGrimorio; destino: Destino }> = new Map<string, { tipo: TipoNoGrimorio; destino: Destino }>([
  ['sessoes', { tipo: 'sessao', destino: 'verbete' }],
  ['escrita', { tipo: 'caderno', destino: 'verbete' }],
  ['canvases', { tipo: 'canvas', destino: 'quadro' }],
  ['personagens', { tipo: 'personagem', destino: 'verbete' }],
])

function naCampanha(partes: readonly string[], nome: string, campanhaSlug: string): Classificacao {
  if (partes.length === 3 && nome === 'campanha.json') return { tipo: 'campanha', destino: 'campanha', campanhaSlug }
  const lugar = partes.length === 4 ? NA_CAMPANHA.get(partes[2].toLowerCase()) : undefined
  return lugar === undefined ? soOriginal(FORA_DO_LUGAR) : { ...lugar, campanhaSlug }
}

function naSecao(raiz: string, partes: readonly string[], nome: string): Classificacao {
  switch (raiz) {
    case 'canvases-soltos':
      return partes.length === 2 ? { tipo: 'canvas', destino: 'quadro' } : soOriginal(FORA_DO_LUGAR)
    case 'mapas-soltos':
      return partes.length === 2 ? { tipo: 'mapa', destino: 'quadro' } : soOriginal(FORA_DO_LUGAR)
    case 'personagens-soltos':
      return nome === ARQUIVO_DA_PASTA ? { tipo: 'pasta', destino: 'organizacao' } : { tipo: 'personagem', destino: 'verbete' }
    case 'itens':
      return nome === ARQUIVO_DA_PASTA ? { tipo: 'pasta', destino: 'organizacao' } : { tipo: 'item', destino: 'verbete' }
    case 'cenarios':
      if (nome === ARQUIVO_DA_PASTA) return { tipo: 'pasta', destino: 'organizacao' }
      return nome === 'cenario.json' && partes.length >= 3 ? { tipo: 'cenario', destino: 'verbete' } : soOriginal(FORA_DO_LUGAR)
    default:
      return soOriginal(FORA_DO_LUGAR)
  }
}

function porExtensao(ext: string): Classificacao {
  if (EXTENSOES_DE_TEXTO.has(ext)) return soOriginal('texto solto, sem lugar no Prelúdio')
  return { tipo: 'outro', destino: 'ignorado', motivo: ext === '' ? 'arquivo sem extensão' : `arquivo .${ext}, que o Prelúdio não usa` }
}

/** O tipo e o destino de um arquivo do cofre, só pelo caminho. */
export function classificar(caminho: string): Classificacao {
  const partes = caminho.split('/')
  const nome = partes[partes.length - 1].toLowerCase()
  const raiz = partes[0].toLowerCase()
  const ext = extensaoDe(caminho)
  if (raiz === '.lixeira') return { tipo: 'lixeira', destino: 'lixeira' }
  if (ARQUIVOS_DO_SISTEMA.has(nome)) return { tipo: 'outro', destino: 'ignorado', motivo: 'arquivo do Windows, não do Grimório' }
  if (EXTENSOES_DE_IMAGEM.has(ext)) return { tipo: 'imagem', destino: 'midia' }
  if (ext !== 'json') return porExtensao(ext)
  if (partes.length === 1) return naRaiz(nome)
  // O Grimório não mostra o que mora em pasta com ponto (`pastasInternas.ts:12`).
  if (partes.slice(1, -1).some((parte) => parte.startsWith('.'))) return soOriginal('dentro de pasta oculta, que o Grimório não mostra')
  const campanhaSlug = raiz === 'campanhas' && partes.length > 2 ? partes[1] : undefined
  const daNota = nasNotas(partes, nome, campanhaSlug)
  if (daNota !== null) return daNota
  return campanhaSlug === undefined ? naSecao(raiz, partes, nome) : naCampanha(partes, nome, campanhaSlug)
}
