import type { ItemDoCatalogo } from '../../lib/acervoDeItens'
import { extrasPadrao, TITULO_DO_DOCUMENTO_NOVO, type Documento, type ExtrasDoDocumento, type PapelDoDocumento, type TrechoProtegido } from '../../documentos/tipos'

/**
 * "COMEÇAR DE UM EXEMPLO" (fase D5): as 4 combinações do protótipo dos extras
 * aprovado (`EXEMPLOS` e `estadoInicial`), como ponto de partida. Tudo fica
 * editável depois, como num documento escrito do zero.
 *
 * O protótipo lia os trechos com 3 itens de mentira (lente, dicionário, chave
 * de cifra). Aqui cada um vira o item do acervo do mestre com esse nome, se
 * existir; sem ele, o trecho nasce sem item e a ficha avisa que ninguém lê.
 */

/** Os 3 itens do protótipo, achados no acervo pelo nome (sem acento e sem caixa). */
type ItemDoExemplo = 'lente' | 'dicionario' | 'cifra'
const NOME_DO_ITEM_DO_EXEMPLO: Readonly<Record<ItemDoExemplo, RegExp>> = {
  lente: /\blente\b/,
  dicionario: /\bdicionario\b/,
  cifra: /\bcifra\b/,
}

type TrechoDoExemplo = { tipo: 'borrado'; claro: string } | { tipo: 'cifra'; claro: string; mostra: 'codigo' | 'lingua' | 'embaralhado'; textoCifrado: string; le: ItemDoExemplo }

export interface ExemploDeDocumento {
  id: string
  nome: string
  titulo: string
  papel: PapelDoDocumento
  paginas: readonly string[]
  extras: Partial<ExtrasDoDocumento>
  trechos: Readonly<Record<string, TrechoDoExemplo>>
}

export const EXEMPLOS_DE_DOCUMENTO: readonly ExemploDeDocumento[] = [
  {
    id: 'ordem',
    nome: 'Carta oficial com carimbo e assinatura',
    titulo: 'Ordem da Guarda',
    papel: 'carta',
    paginas: [
      '**Ordem nº 47.** A partir desta noite fica proibido atravessar a ponte velha depois do sino das nove.\n\nOs guardas da torre trancam o portão norte e entregam a chave ao capitão. Quem for visto no cais depois do sino será levado ao posto.\n\nSenha do turno: {{cifra:c1}}.',
    ],
    extras: {
      letra: 'maquina',
      tinta: 'preta',
      desgaste: { cor: null, manchas: 0, bordaQueimada: false, dobras: true, rasgos: false },
      selo: { tipo: 'carimbo', cor: '#33508f', arte: 'torre', imagem: null, texto: 'Guarda da Vila do Brejo' },
      assinatura: 'Cap. Aurélio Mendes',
      brasao: { arte: 'torre', imagem: null },
    },
    trechos: { c1: { tipo: 'cifra', claro: 'garça branca, maré baixa', mostra: 'codigo', textoCifrado: 'JDUFD EUDQFD, PDUH EDLAD', le: 'cifra' } },
  },
  {
    id: 'porao',
    nome: 'Bilhete rasgado à mão, em sangue',
    titulo: 'Não abram',
    papel: 'bilhete',
    paginas: ['Não abram a porta do porão.\n\nEle ainda escuta. Ontem ouvi meu nome lá embaixo, com a voz da minha mãe.\n\n**Não respondam.**'],
    extras: { letra: 'mao', tinta: 'sangue', desgaste: { cor: '#cdb98e', manchas: 2, bordaQueimada: false, dobras: false, rasgos: true } },
    trechos: {},
  },
  {
    id: 'diario',
    nome: 'Diário com página queimada e trecho borrado',
    titulo: 'Diário do faroleiro',
    papel: 'diario',
    paginas: [
      '*Dia 19.* A maré subiu até a porta e molhou metade destas folhas. O velho Tomé levou {{borrado:b1}} para o outro lado do brejo.\n\nSe eu não voltar, a chave do farol está {{cifra:c2}}. Escrevi miúdo de propósito.',
      '*Dia 20.* O fogo da lanterna pegou nas cortinas e quase levou o caderno. Desço amanhã, antes do sol.',
    ],
    extras: { letra: 'mao', tinta: 'sepia', desgaste: { cor: '#dcc796', manchas: 1, bordaQueimada: true, dobras: false, rasgos: false } },
    trechos: {
      b1: { tipo: 'borrado', claro: 'a lanterna de prata' },
      c2: { tipo: 'cifra', claro: 'debaixo do terceiro degrau da escada', mostra: 'embaralhado', textoCifrado: '', le: 'lente' },
    },
  },
  {
    id: 'juramento',
    nome: 'Pergaminho com selo de cera e trecho cifrado',
    titulo: 'Juramento dos Antigos',
    papel: 'pergaminho',
    paginas: ['Nós, os Antigos do Brejo, juramos diante da água e da pedra:\n\n{{cifra:c3}}\n\nQue estas palavras durem mais do que nós.'],
    extras: { letra: 'impressa', tinta: 'sepia', selo: { tipo: 'cera', cor: '#8e2a22', arte: 'rosa', imagem: null } },
    trechos: {
      c3: {
        tipo: 'cifra',
        claro: 'Quem guarda a rosa abre a porta de pedra; quem a fere fica do lado de fora.',
        mostra: 'lingua',
        textoCifrado: 'Ar velen tiru dossa nemar duvai; ke ruvai oste lumen ortas vael.',
        le: 'dicionario',
      },
    },
  },
]

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR')
}

/** O item do acervo que faz o papel do item do protótipo; `null` = o mestre não tem um com esse nome. */
function itemDoAcervo(qual: ItemDoExemplo, itens: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): string | null {
  const nome = NOME_DO_ITEM_DO_EXEMPLO[qual]
  return itens.find((item) => nome.test(semAcento(item.nome)))?.id ?? null
}

/**
 * O mestre ainda não deu título: vazio, ou ainda o que o "Novo documento" pôs
 * (bug de 20/11/2026: só o vazio contava, e o documento recém-criado nunca
 * oferecia os exemplos).
 */
function semTituloDoMestre(titulo: string): boolean {
  const aparado = titulo.trim()
  return aparado === '' || aparado === TITULO_DO_DOCUMENTO_NOVO
}

/** Nada escrito ainda: sem título do mestre, sem texto, sem imagem nas páginas e sem trecho. */
export function estaEmBranco(documento: Pick<Documento, 'titulo' | 'paginas' | 'trechos'>): boolean {
  return semTituloDoMestre(documento.titulo) && semTextoParaPerder(documento)
}

/** Sem texto nas páginas nem trecho (o título pode já estar escrito): trocar pelo exemplo não perde nada. */
export function semTextoParaPerder(documento: Pick<Documento, 'paginas' | 'trechos'>): boolean {
  return Object.keys(documento.trechos).length === 0 && documento.paginas.every((pagina) => pagina.texto.trim() === '' && pagina.imagem === null)
}

export interface ExemploAplicado {
  documento: Documento
  /** Trechos cifrados que ficaram sem item (o acervo não tem a lente, o dicionário ou a chave de cifra). */
  semItem: number
}

/** O documento com o exemplo: papel, páginas, extras e trechos do exemplo; o título dele só se o mestre ainda não escreveu um. */
export function comExemplo(documento: Documento, exemplo: ExemploDeDocumento, itens: readonly Pick<ItemDoCatalogo, 'id' | 'nome'>[]): ExemploAplicado {
  let semItem = 0
  const trechos: Record<string, TrechoProtegido> = {}
  for (const [id, trecho] of Object.entries(exemplo.trechos)) {
    if (trecho.tipo === 'borrado') {
      trechos[id] = { tipo: 'borrado', claro: trecho.claro }
      continue
    }
    const chave = itemDoAcervo(trecho.le, itens)
    if (chave === null) semItem += 1
    trechos[id] = { tipo: 'cifra', claro: trecho.claro, mostra: trecho.mostra, textoCifrado: trecho.textoCifrado, chaves: chave === null ? [] : [chave] }
  }
  const padrao = extrasPadrao()
  const extras: ExtrasDoDocumento = {
    letra: exemplo.extras.letra ?? padrao.letra,
    tinta: exemplo.extras.tinta ?? padrao.tinta,
    desgaste: { ...(exemplo.extras.desgaste ?? padrao.desgaste) },
    selo: exemplo.extras.selo === undefined || exemplo.extras.selo === null ? null : { ...exemplo.extras.selo },
    assinatura: exemplo.extras.assinatura ?? null,
    brasao: exemplo.extras.brasao === undefined || exemplo.extras.brasao === null ? null : { ...exemplo.extras.brasao },
  }
  return {
    documento: {
      ...documento,
      titulo: semTituloDoMestre(documento.titulo) ? exemplo.titulo : documento.titulo,
      papel: exemplo.papel,
      paginas: exemplo.paginas.map((texto) => ({ texto, imagem: null })),
      extras,
      trechos,
    },
    semItem,
  }
}
