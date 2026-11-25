import { itemDoCatalogoLido, itemParaDar, novoItemDoCatalogo, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { pinImageFromBlob } from '../../lib/imageImport'
import { imagemDoItemDoBlob } from '../../lib/imagemDoItem'
import { itemDoAcervoNoMapa } from '../../lib/itemNoMapa'
import { lerIndiceDasPastas, lerRpgDaPasta, type PastaAberta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import { PIN_NOME_MAX_LENGTH } from '../../lib/pins'
import { imagemDaForma, itemComOMesmoNome, textoDoLugar } from '../../lib/preparo/doVerbeteParaOMapa'
import type { LigaFicha, Verbete } from '../../lib/preparo/tipos'
import { buildTokenPhotoData } from '../../lib/tokenPhoto'
import { useAcervoDeItensStore } from '../../stores/acervoDeItensStore'
import { useAdventureStore } from '../../stores/adventureStore'
import type { CoisaDoVerbete } from '../../stores/colocacaoDoPreludio'
import { fotoDoRetrato } from '../../stores/porPersonagemNoMapa'
import { editarRpgDaPasta } from '../../stores/rpgDaPasta'
import { usePreludio } from '../estado/preludio'
import { prepararMidia, urlDaMidia } from '../midia'
import { comAFicha } from './mesaNaJanela'
import type { ComoVaiAoMapa, VerbeteParaOMapa } from './protocolo'

/**
 * O VERBETE INTEIRO NA MESA (E3, 16/11), do lado da janela principal: o que a
 * mesa prepara antes de pôr a ferramenta na mão do mestre. Lê o verbete do
 * disco (nada de texto nem imagem vem pelo fio) e confere o tipo.
 *
 * - Lugar: o texto (`textoDoLugar`, segredo nunca) e a imagem da forma em
 *   data URL no tamanho do cartão do pino (`pinImageFromBlob`).
 * - Item: o item do Acervo ligado ao verbete pelo id (`idDoItemDoVerbete`) ou
 *   de MESMO nome, ou um novo com nome, descrição e imagem
 *   (`novoItemDoCatalogo` + `salvarItem`), como pino de item pegável.
 * - Personagem: a ficha ligada tem de estar na pasta do mapa aberto (é dela
 *   que o token lê HP e técnicas); sem ficha, o token só com o retrato.
 */

const TIPO_POR_EXTENSAO: Readonly<Record<string, string>> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }

/** Os bytes de uma imagem do Prelúdio (`midia/<sha>.<ext>`); `null` = sem imagem ou não deu para ler. */
async function blobDaMidia(midia: string | null): Promise<Blob | null> {
  if (midia === null) return null
  const raiz = await prepararMidia()
  const url = raiz === null ? null : urlDaMidia(raiz, midia)
  if (url === null) return null
  try {
    const resposta = await fetch(url)
    if (!resposta.ok) return null
    const bruto = await resposta.blob()
    // O protocolo de arquivos nem sempre diz o tipo: a extensão do nome (que a importação deu pelos bytes) diz.
    const tipo = TIPO_POR_EXTENSAO[midia.slice(midia.lastIndexOf('.') + 1).toLowerCase()]
    return bruto.type === '' && tipo !== undefined ? new Blob([bruto], { type: tipo }) : bruto
  } catch {
    return null
  }
}

/** Tenta; falhou = `null` (a imagem é um extra: sem ela o lugar, o item e o token vão do mesmo jeito). */
async function talvez<T>(fazer: () => Promise<T>): Promise<T | null> {
  try {
    return await fazer()
  } catch {
    return null
  }
}

/**
 * O ITEM DO VERBETE LIGADO PELO ID (levantamento de 25/11/2026, achado 28): o
 * item do Acervo que nasce de um verbete ganha um id fixo, tirado do verbete,
 * como o das peças desenhadas (`idDoItemDaPeca`). Renomear o item no Acervo
 * ou o verbete no Grimório não cria mais um item repetido: o verbete o acha
 * pelo id. O nome continua valendo para o item que nasceu antes disto (id
 * sorteado) e para o que o mestre fez à mão com o mesmo nome. `null` = o id
 * do verbete não cabe num id de item (a regra do Acervo, `itemDoCatalogoLido`):
 * fica só o nome, como antes.
 */
function idDoItemDoVerbete(verbeteId: string): string | null {
  const id = `item_verbete_${verbeteId}`
  return itemDoCatalogoLido({ ...novoItemDoCatalogo(), id }) === null ? null : id
}

export type VerbetePreparado = { readonly ok: true; readonly nome: string; readonly coisa: CoisaDoVerbete } | { readonly ok: false; readonly motivo: string }

const TIPO_DO_COMO: Readonly<Record<ComoVaiAoMapa, Verbete['tipo']>> = { token: 'personagem', item: 'item', lugar: 'lugar' }

/**
 * Por que o token não vai: a ficha (de jogador ou de NPC) mora numa pasta e o
 * mapa aberto é de outra, de pasta nenhuma, ou usa fichas só dele. Diz qual abrir.
 */
export function motivoDaOutraPasta(ficha: Pick<Personagem, 'tipo' | 'nome'> | null, pastaDaFicha: string, aberta: Pick<PastaAberta, 'nome' | 'proprio'> | null): string {
  const qual = ficha === null ? 'A ficha ligada a este verbete' : `A ficha ${ficha.tipo === 'jogador' ? 'de jogador' : 'de NPC'} de ${ficha.nome}`
  if (aberta !== null && aberta.proprio) return `${qual} mora na pasta ${pastaDaFicha}, e o mapa aberto usa fichas só dele. Abra um mapa que use as fichas da pasta ${pastaDaFicha} e tente de novo.`
  const onde = aberta === null ? 'e nenhum mapa de pasta está aberto' : `e o mapa aberto é da pasta ${aberta.nome}`
  return `${qual} mora na pasta ${pastaDaFicha}, ${onde}. Abra um mapa de ${pastaDaFicha} e tente de novo.`
}

/** O verbete do disco, pronto para o clique; ou o motivo de não ir. */
export async function prepararVerbeteNaMesa(fonte: VerbeteParaOMapa, como: ComoVaiAoMapa, ficha: LigaFicha | null): Promise<VerbetePreparado> {
  const preludio = usePreludio.getState()
  if (preludio.carga.t === 'pronta') await preludio.relerDoDisco({ o: 'verbete', id: fonte.verbeteId })
  else await preludio.carregar()
  const { carga, verbetes } = usePreludio.getState()
  if (carga.t !== 'pronta') return { ok: false, motivo: 'A janela do mapa não conseguiu ler o Prelúdio.' }
  const verbete = verbetes.get(fonte.verbeteId)
  if (verbete === undefined) return { ok: false, motivo: 'Este verbete ainda não está no disco. Espere o Prelúdio gravar e tente de novo.' }
  if (verbete.tipo !== TIPO_DO_COMO[como]) return { ok: false, motivo: 'O tipo deste verbete mudou. Abra-o de novo e tente outra vez.' }
  const forma = verbete.formas.find((uma) => uma.id === fonte.formaId) ?? verbete.formas[0]
  if (forma === undefined) return { ok: false, motivo: 'Este verbete não tem forma para pôr no mapa.' }
  const nome = verbete.titulo.slice(0, PIN_NOME_MAX_LENGTH).trim()
  const imagem = imagemDaForma(forma)

  if (como === 'lugar') {
    const blob = await blobDaMidia(imagem)
    const dataUrl = blob === null ? null : await talvez(() => pinImageFromBlob(blob))
    return { ok: true, nome, coisa: { o: 'lugar', texto: textoDoLugar(verbete, forma, verbetes), imagem: dataUrl } }
  }

  if (como === 'item') {
    const acervo = useAcervoDeItensStore.getState()
    if (!acervo.podeGravar) await acervo.recarregar()
    const { itens, podeGravar, salvarItem } = useAcervoDeItensStore.getState()
    const idLigado = idDoItemDoVerbete(verbete.id)
    const existente = itens.find((um) => um.id === idLigado) ?? itemComOMesmoNome(itens, nome)
    let item: ItemDoCatalogo
    if (existente !== null) item = existente
    else {
      if (!podeGravar) return { ok: false, motivo: 'O Acervo de itens não está disponível aqui (só no aplicativo, com o acervo lido).' }
      const blob = await blobDaMidia(imagem)
      const midiaDoItem = blob === null ? null : await talvez(() => imagemDoItemDoBlob(blob))
      const novo = novoItemDoCatalogo()
      item = { ...novo, id: idLigado ?? novo.id, nome: nome || 'Item sem nome', descricao: textoDoLugar(verbete, forma, verbetes), imagem: midiaDoItem }
      try {
        await salvarItem(item)
      } catch (erro) {
        return { ok: false, motivo: `Não deu para pôr o item no Acervo: ${erro instanceof Error ? erro.message : String(erro)}` }
      }
    }
    const noMapa = itemDoAcervoNoMapa(itemParaDar(item, useAcervoDeItensStore.getState().itens))
    if (noMapa === null) return { ok: false, motivo: 'O item precisa de um nome para ir ao mapa.' }
    return { ok: true, nome, coisa: { o: 'item', item: noMapa, novoNoAcervo: existente === null } }
  }

  // Token.
  if (ficha === null) {
    const blob = await blobDaMidia(imagem)
    const foto = blob === null ? null : await talvez(() => buildTokenPhotoData(blob))
    return { ok: true, nome, coisa: { o: 'token', characterId: null, npc: true, foto } }
  }
  const pasta = useAdventureStore.getState().pasta
  if (pasta === null || pasta.pastaId !== ficha.pastaId || pasta.proprio === true) {
    // Só no caminho do "não vai": o nome da pasta da ficha e de quem é a ficha, para dizer qual mapa abrir.
    const [{ indice }, lido] = await Promise.all([lerIndiceDasPastas(), lerRpgDaPasta(ficha.pastaId)])
    const nomeDaPasta = indice.pastas.find((uma) => uma.id === ficha.pastaId)?.nome
    if (nomeDaPasta === undefined) return { ok: false, motivo: 'A pasta da ficha ligada a este verbete não existe mais. Ligue outra ficha na Ficha do Livro.' }
    const daFicha = lido.ok ? (lido.rpg.personagens.find((um) => um.id === ficha.personagemId) ?? null) : null
    return { ok: false, motivo: motivoDaOutraPasta(daFicha, nomeDaPasta, pasta) }
  }
  const personagem = pasta.personagens.find((um) => um.id === ficha.personagemId)
  if (personagem === undefined) return { ok: false, motivo: 'A ficha ligada a este verbete não está mais na pasta.' }
  return { ok: true, nome: personagem.nome || nome, coisa: { o: 'token', characterId: personagem.id, npc: personagem.tipo === 'npc', foto: await fotoDoRetrato(personagem.retrato) } }
}

/** "Virar NPC" pela mesa: a ficha entra na pasta (ou troca a de mesmo id) por `editarRpgDaPasta`, que também põe na cópia aberta. */
export async function gravarFichaPelaMesa(pastaId: string, personagem: Personagem): Promise<string | null> {
  try {
    await editarRpgDaPasta(pastaId, (rpg) => ({ ...rpg, personagens: comAFicha(rpg.personagens, personagem) }))
    return null
  } catch (erro) {
    return erro instanceof Error ? erro.message : String(erro)
  }
}
