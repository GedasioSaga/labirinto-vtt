import { TEXTO_CLARO_MAX, TEXTO_DA_PAGINA_MAX, TRECHOS_MAX, type Documento, type TrechoProtegido } from '../../documentos/tipos'

/**
 * OS TRECHOS PROTEGIDOS NA FICHA DO MESTRE (fase D5; protótipo dos extras,
 * `protegerTrecho`, `ordemTrechos`, "Desfazer" e "Apagar"). Puro: cada conta
 * devolve o documento novo, e a ficha grava pelo rascunho.
 *
 * O trecho mora em `Documento.trechos` e a página leva só a marca
 * (`{{cifra:c1}}`): o texto claro nunca fica no texto da página.
 */

export type TipoDoTrecho = TrechoProtegido['tipo']

/** A marca do trecho no texto da página. */
export function marcaDoTrecho(tipo: TipoDoTrecho, id: string): string {
  return `{{${tipo}:${id}}}`
}

/** O primeiro id livre: `c1`, `c2`… para os cifrados, `b1`… para os borrados (o `novoIdTrecho` do protótipo). */
function idLivre(documento: Documento, tipo: TipoDoTrecho): string {
  const letra = tipo === 'cifra' ? 'c' : 'b'
  // Também livre do texto: uma marca solta (o trecho apagado à mão no disco) não ganha um trecho que não é dela.
  const usado = (id: string): boolean => Object.hasOwn(documento.trechos, id) || documento.paginas.some((pagina) => pagina.texto.includes(`:${id}}}`))
  let n = 1
  while (usado(`${letra}${n}`)) n += 1
  return `${letra}${n}`
}

export type ResultadoDeProteger = { tipo: 'ok'; documento: Documento; texto: string; depoisDaMarca: number } | { tipo: 'recusa'; aviso: string }

/**
 * Faz do pedaço selecionado (`inicio`..`fim`) da página `indice` um trecho
 * protegido: o pedaço vai para o `claro` do trecho e a página fica com a
 * marca no lugar. Os espaços das pontas ficam no texto, fora do trecho.
 */
export function protegerTrecho(documento: Documento, indice: number, inicio: number, fim: number, tipo: TipoDoTrecho): ResultadoDeProteger {
  const pagina = documento.paginas[indice]
  if (pagina === undefined) return { tipo: 'recusa', aviso: 'Essa página não existe mais.' }
  const numero = indice + 1
  const bruto = pagina.texto.slice(Math.min(inicio, fim), Math.max(inicio, fim))
  if (bruto.trim() === '') return { tipo: 'recusa', aviso: `Selecione no texto da página ${numero} o pedaço que vai ficar ${tipo === 'cifra' ? 'cifrado' : 'borrado'}.` }
  if (/\{\{|\}\}/.test(bruto)) return { tipo: 'recusa', aviso: 'Esse pedaço já tem um trecho protegido. Selecione só texto comum.' }
  if (/\n\s*\n/.test(bruto)) return { tipo: 'recusa', aviso: 'O trecho precisa ficar dentro de um parágrafo. Selecione menos texto.' }
  if (Object.keys(documento.trechos).length >= TRECHOS_MAX) return { tipo: 'recusa', aviso: `Este documento já tem ${TRECHOS_MAX} trechos protegidos, o máximo.` }
  const a = Math.min(inicio, fim) + (bruto.length - bruto.trimStart().length)
  const b = Math.max(inicio, fim) - (bruto.length - bruto.trimEnd().length)
  const claro = pagina.texto.slice(a, b)
  if (claro.length > TEXTO_CLARO_MAX) return { tipo: 'recusa', aviso: `Um trecho protegido tem até ${TEXTO_CLARO_MAX} letras. Selecione menos texto.` }
  const id = idLivre(documento, tipo)
  const marca = marcaDoTrecho(tipo, id)
  const texto = `${pagina.texto.slice(0, a)}${marca}${pagina.texto.slice(b)}`
  if (texto.length > TEXTO_DA_PAGINA_MAX) return { tipo: 'recusa', aviso: 'A página ficaria comprida demais com a marca do trecho. Encurte o texto dela antes.' }
  const trecho: TrechoProtegido = tipo === 'cifra' ? { tipo: 'cifra', claro, mostra: 'embaralhado', textoCifrado: '', chaves: [] } : { tipo: 'borrado', claro }
  return {
    tipo: 'ok',
    documento: { ...documento, paginas: documento.paginas.map((p, i) => (i === indice ? { ...p, texto } : p)), trechos: { ...documento.trechos, [id]: trecho } },
    texto,
    depoisDaMarca: a + marca.length,
  }
}

/** A página (de 0) onde a marca do trecho está; -1 = o trecho saiu do texto (o mestre apagou a marca). */
export function paginaDoTrecho(documento: Documento, id: string, tipo: TipoDoTrecho): number {
  const marca = marcaDoTrecho(tipo, id)
  return documento.paginas.findIndex((pagina) => pagina.texto.includes(marca))
}

/** Sem o trecho (o "Apagar" do trecho que saiu do texto). */
export function semOTrecho(documento: Documento, id: string): Documento {
  if (!Object.hasOwn(documento.trechos, id)) return documento
  const trechos = Object.fromEntries(Object.entries(documento.trechos).filter(([outro]) => outro !== id))
  return { ...documento, trechos }
}

/**
 * "Desfazer": o trecho volta a ser texto comum, legível para todos (o claro
 * no lugar de cada marca dele). A página que passaria do teto fica como está
 * e a conta devolve `null` (a ficha avisa).
 */
export function trechoDesfeito(documento: Documento, id: string): Documento | null {
  const trecho = Object.hasOwn(documento.trechos, id) ? documento.trechos[id] : undefined
  if (trecho === undefined) return documento
  const marca = marcaDoTrecho(trecho.tipo, id)
  const paginas = documento.paginas.map((pagina) => ({ ...pagina, texto: pagina.texto.split(marca).join(trecho.claro) }))
  if (paginas.some((pagina) => pagina.texto.length > TEXTO_DA_PAGINA_MAX)) return null
  return semOTrecho({ ...documento, paginas }, id)
}

/** O trecho `id` trocado por `mudar` (do mesmo tipo). Sem o trecho: o mesmo documento. */
export function comTrecho<T extends TrechoProtegido>(documento: Documento, id: string, tipo: T['tipo'], mudar: (trecho: T) => T): Documento {
  const trecho = Object.hasOwn(documento.trechos, id) ? documento.trechos[id] : undefined
  if (trecho === undefined || !ehDoTipo<T>(trecho, tipo)) return documento
  return { ...documento, trechos: { ...documento.trechos, [id]: mudar(trecho) } }
}

function ehDoTipo<T extends TrechoProtegido>(trecho: TrechoProtegido, tipo: T['tipo']): trecho is T {
  return trecho.tipo === tipo
}

export interface TrechoNaFicha {
  id: string
  trecho: TrechoProtegido
  /** "Cifrado 1", "Borrado 2": a ordem de criação, contada por tipo. */
  rotulo: string
  /** A página (de 0) da marca; -1 = saiu do texto. */
  pagina: number
}

/** Os trechos na ordem em que foram criados, com o rótulo e a página de cada um. */
export function trechosNaFicha(documento: Documento): TrechoNaFicha[] {
  const conta = { cifra: 0, borrado: 0 }
  return Object.entries(documento.trechos).map(([id, trecho]) => {
    conta[trecho.tipo] += 1
    return { id, trecho, rotulo: `${trecho.tipo === 'cifra' ? 'Cifrado' : 'Borrado'} ${conta[trecho.tipo]}`, pagina: paginaDoTrecho(documento, id, trecho.tipo) }
  })
}

/** Os itens que leem algum trecho cifrado do documento, sem repetir, na ordem dos trechos. */
export function chavesDoDocumento(documento: Documento): string[] {
  const chaves = new Set<string>()
  for (const trecho of Object.values(documento.trechos)) if (trecho.tipo === 'cifra') for (const chave of trecho.chaves) chaves.add(chave)
  return [...chaves]
}
