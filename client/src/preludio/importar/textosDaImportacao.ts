import type { FaseDaAplicacao, ResumoDaAplicacao } from '../../lib/preparo/importar/aplicar'
import type { PlanoDeReimportacao } from '../../lib/preparo/importar/reimportar'
import type { Contagens, EspacoEmDisco } from '../../lib/preparo/importar/relatorio'
import { textoDoTamanho } from '../copia/textosDaCopia'

/** As frases da importação do Grimório, separadas da tela (puras). */

const NUMERO = new Intl.NumberFormat('pt-BR')

export function numero(valor: number): string {
  return NUMERO.format(valor)
}

/** As linhas do "No cofre": as mesmas contagens que o mestre aprovou na simulação. */
export const LINHAS_DO_COFRE: readonly { readonly rotulo: string; readonly chave: keyof Contagens }[] = [
  { rotulo: 'Campanhas', chave: 'campanhas' },
  { rotulo: 'Sessões', chave: 'sessoes' },
  { rotulo: 'Cadernos', chave: 'cadernos' },
  { rotulo: 'Páginas', chave: 'paginas' },
  { rotulo: 'Personagens', chave: 'personagens' },
  { rotulo: 'Cenários', chave: 'cenarios' },
  { rotulo: 'Itens', chave: 'itens' },
  { rotulo: 'Quadros', chave: 'quadros' },
  { rotulo: 'Vínculos', chave: 'vinculos' },
  { rotulo: 'Imagens', chave: 'imagens' },
]

export const TIPOS_DA_REIMPORTACAO: readonly { readonly rotulo: string; readonly chave: keyof PlanoDeReimportacao }[] = [
  { rotulo: 'Verbetes', chave: 'verbetes' },
  { rotulo: 'Quadros', chave: 'quadros' },
  { rotulo: 'Ligações', chave: 'ligacoes' },
  { rotulo: 'Campanhas', chave: 'campanhas' },
]

export function textoDoCofre(arquivos: number, bytes: number, umDestino: boolean): string {
  const quantos = `${numero(arquivos)} arquivo${arquivos === 1 ? '' : 's'} (${textoDoTamanho(bytes)})`
  return umDestino ? `${quantos}, cada um com um destino só.` : `${quantos}: algum ficou sem destino ou com mais de um. Veja os avisos.`
}

export function textoDoEspaco(espaco: EspacoEmDisco): string {
  const precisa = `Precisa de ${textoDoTamanho(espaco.necessarioBytes)}`
  if (espaco.livreBytes === null || espaco.sobraDepoisBytes === null) return `${precisa}. O espaço livre do disco não foi medido.`
  const sobra = `sobram ${textoDoTamanho(Math.max(0, espaco.sobraDepoisBytes))} (o mínimo é ${textoDoTamanho(espaco.minimoQueSobraBytes)})`
  return `${precisa}; livres ${textoDoTamanho(espaco.livreBytes)}; ${sobra}.`
}

const FASES: Readonly<Record<FaseDaAplicacao, string>> = {
  conferindo: 'Conferindo o Prelúdio e o espaço',
  imagens: 'Copiando as imagens',
  verbetes: 'Gravando os verbetes',
  quadros: 'Gravando os quadros',
  restante: 'Gravando as ligações e as campanhas',
  original: 'Guardando os originais',
}

export function textoDoAndamento(rotulo: string, feitos: number, total: number): string {
  return total > 1 ? `${rotulo}: ${numero(feitos)} de ${numero(total)}…` : `${rotulo}…`
}

export function textoDaFase(fase: FaseDaAplicacao, feitos: number, total: number): string {
  return textoDoAndamento(FASES[fase], feitos, total)
}

function lista(partes: readonly string[]): string {
  return new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(partes)
}

function contado(quantos: number, um: string, varios: string): string | null {
  if (quantos === 0) return null
  return `${numero(quantos)} ${quantos === 1 ? um : varios}`
}

export function textoDoResumo(resumo: ResumoDaAplicacao): string {
  if (resumo.mudancas === 0) return 'Nada mudou: o Prelúdio já estava igual ao Grimório. Nenhum arquivo foi gravado.'
  const partes = [
    contado(resumo.verbetes, 'verbete', 'verbetes'),
    contado(resumo.quadros, 'quadro', 'quadros'),
    contado(resumo.imagens, 'imagem nova', 'imagens novas'),
    resumo.ligacoesMudaram ? 'as ligações' : null,
    resumo.indiceMudou ? 'as campanhas' : null,
    contado(resumo.soLeitura, 'arquivo só de leitura (chat, Teia, lixeira)', 'arquivos só de leitura (chat, Teia, lixeira)'),
  ].filter((parte): parte is string => parte !== null)
  return `Importado: ${lista(partes)}.`
}
