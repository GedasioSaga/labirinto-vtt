import { itemParaDar, novoItemDoCatalogo, type ItemDoCatalogo } from '../../lib/acervoDeItens'
import { pinImageFromBlob } from '../../lib/imageImport'
import { imagemDoItemDoBlob } from '../../lib/imagemDoItem'
import { itemDoAcervoNoMapa } from '../../lib/itemNoMapa'
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
 * - Item: o item do Acervo de MESMO nome, ou um novo com nome, descrição e
 *   imagem (`novoItemDoCatalogo` + `salvarItem`), como pino de item pegável.
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

export type VerbetePreparado = { readonly ok: true; readonly nome: string; readonly coisa: CoisaDoVerbete } | { readonly ok: false; readonly motivo: string }

const TIPO_DO_COMO: Readonly<Record<ComoVaiAoMapa, Verbete['tipo']>> = { token: 'personagem', item: 'item', lugar: 'lugar' }

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
    const existente = itemComOMesmoNome(itens, nome)
    let item: ItemDoCatalogo
    if (existente !== null) item = existente
    else {
      if (!podeGravar) return { ok: false, motivo: 'O Acervo de itens não está disponível aqui (só no aplicativo, com o acervo lido).' }
      const blob = await blobDaMidia(imagem)
      const midiaDoItem = blob === null ? null : await talvez(() => imagemDoItemDoBlob(blob))
      item = { ...novoItemDoCatalogo(), nome: nome || 'Item sem nome', descricao: textoDoLugar(verbete, forma, verbetes), imagem: midiaDoItem }
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
    return { ok: false, motivo: 'O mapa aberto não usa a pasta onde está a ficha deste NPC. Abra um mapa dessa pasta e tente de novo.' }
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
