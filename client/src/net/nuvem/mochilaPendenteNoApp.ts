import { isTauri } from '@tauri-apps/api/core'
import {
  textoDoIgnorado,
  textoDoIgnoradoSemSaber,
  textoDoIncerto,
  textoDoPendente,
  textoDoQueSaiu,
  textoDoTrazido,
  textoDoTrazidoSemAnotar,
  type ItemPendente,
} from '../../lib/mochila/pendentes'
import type { PastaAberta, RpgDaPasta } from '../../lib/pastasDeMapas'
import type { Personagem } from '../../lib/personagem'
import { readRecoveryCopy, type RecoveryCopy } from '../../lib/recoveryCopy'
import { fichasDonasDoProprioMapa, useAdventureStore } from '../../stores/adventureStore'
import { captureEditorWork } from '../../stores/recoveryAutosave'
import { editarRpgDaPasta } from '../../stores/rpgDaPasta'
import { useToastStore } from '../../stores/toastStore'
import { ARQUIVO_DO_MAPA, discoDoApp, PASTA_DOS_MAPAS } from './migracaoDaMochila'
import {
  chaveDoCaminho,
  conferirMapaQueEntrou,
  ignorarPendente,
  mapaSaiuDaPasta,
  marcarAntesDaVoltaDoSistema,
  marcarFichasQueEntram,
  marcarMapaQueEntrou,
  marcarMapaQueVaiUsarAPasta,
  pendentesDaPasta,
  retirarPendentesSemEspelho,
  retirarPendentesSemFicha,
  sistemaDaPastaMudou,
  trazerPendente,
  type AntesDaVoltaDoSistema,
  type DecisaoTomada,
  type FichasQueEntram,
  type PendentesAntesDoEspelho,
} from './mochilaPendente'

/**
 * MOCHILA NA FICHA (correção C2) — o mapa que entra numa pasta convertida, no
 * app: o "Mover…" do Carregar Mapa (entrar e sair), o "Configurar pasta" (o
 * Sistema universal e as fichas novas), a importação e a abertura chamam daqui
 * (o núcleo, com disco injetado, é `mochilaPendente.ts`). Cada pendente vira
 * um aviso na caixa "Mochila" com "Trazer para a ficha" e "Ignorar". O ×
 * só tira o aviso da tela: o pendente continua no relatório da pasta e volta
 * na próxima abertura de um mapa dela — nada some sem o mestre decidir.
 * Nunca lança. Fora do app (navegador dos testes), não faz nada.
 */

const GRUPO_DA_MOCHILA = 'Mochila'

function motivo(erro: unknown): string {
  return erro instanceof Error ? erro.message : String(erro)
}

function avisarPendentes(pastaId: string, pendentes: readonly ItemPendente[]): void {
  const { push } = useToastStore.getState()
  for (const pendente of pendentes) {
    push('instrucao', textoDoPendente(pendente), null, {
      actions: [
        { label: 'Trazer para a ficha', run: () => void trazerNoApp(pastaId, pendente) },
        { label: 'Ignorar', run: () => void ignorarNoApp(pastaId, pendente) },
      ],
      grupo: GRUPO_DA_MOCHILA,
      sempreEmCaixa: true,
      // A mesma linha mostrada de novo (outra abertura) troca a que está na tela, não empilha.
      chave: `mochila-pendente:${pendente.id}`,
    })
  }
}

async function trazerNoApp(pastaId: string, pendente: ItemPendente): Promise<void> {
  const { push } = useToastStore.getState()
  try {
    const feito = await trazerPendente(pastaId, pendente.id, discoDoApp, (mudar) => editarRpgDaPasta(pastaId, mudar))
    if (feito.ok) {
      if (feito.naoAnotado === undefined) {
        push('info', textoDoTrazido(feito.pendente, feito.moedasDeFora))
        return
      }
      push('error', textoDoTrazidoSemAnotar(feito.pendente, feito.moedasDeFora, feito.naoAnotado))
    } else if (feito.porque === 'saiu') {
      push('info', textoDoQueSaiu(feito.pendente))
      return
    } else if (feito.porque === 'incerto') {
      push('error', textoDoIncerto(feito.pendente))
    } else if (feito.porque === 'sem-ficha') {
      push('error', `A ficha de ${pendente.personagem} não está mais na pasta: o aviso continua, e "Ignorar" o tira da lista.`)
    } else {
      // `nao-achado`/`ja-decidido`: outro clique já resolveu.
      return
    }
  } catch (erro) {
    // A soma pode ter chegado à ficha antes da falha: o próximo "Trazer" confere pela marca do relatório e não soma duas vezes.
    push('error', `Não deu para terminar de levar à ficha (${motivo(erro)}): o aviso continua, e "Trazer para a ficha" de novo confere a ficha antes de somar.`)
  }
  // O clique tirou o aviso da tela; sem decisão gravada, ele volta.
  avisarPendentes(pastaId, [pendente])
}

/** O aviso do "Ignorar" pelo que ficou anotado: o de um "Trazer" que caiu no meio nunca diz "ficou fora" sem saber. */
function textoDoIgnorar(feito: Extract<DecisaoTomada, { ok: true }>): string {
  if (feito.decisao === 'trazido') return textoDoTrazido(feito.pendente, feito.moedasDeFora)
  return feito.decisao === 'incerto' ? textoDoIgnoradoSemSaber(feito.pendente) : textoDoIgnorado(feito.pendente)
}

async function ignorarNoApp(pastaId: string, pendente: ItemPendente): Promise<void> {
  const { push } = useToastStore.getState()
  try {
    const feito = await ignorarPendente(pastaId, pendente.id, discoDoApp)
    if (feito.ok) push('info', textoDoIgnorar(feito))
    else if (feito.porque === 'saiu') push('info', textoDoQueSaiu(feito.pendente))
  } catch (erro) {
    push('error', `Não deu para anotar o "Ignorar" (${motivo(erro)}): o aviso continua.`)
    avisarPendentes(pastaId, [pendente])
  }
}

/** Mostra os pendentes da pasta que ainda esperam o mestre. */
async function avisarPendentesDaPasta(pastaId: string): Promise<void> {
  avisarPendentes(pastaId, await pendentesDaPasta(pastaId, discoDoApp))
}

/** A mudança do RPG da pasta que o "Configurar pasta" grava. */
export type MudarRpgDaPasta = (rpg: RpgDaPasta) => RpgDaPasta

/** O que ficou anotado antes de gravar o `rpg.json` da volta do sistema, e o trabalho do mapa aberto conferido. */
interface AnotadoAntesDaVolta {
  aberto: TrabalhoAberto | null
  antes: AntesDaVoltaDoSistema
}

const NADA_ANTES_DA_VOLTA: AntesDaVoltaDoSistema = { marcados: [], novos: [], abertoConferido: false }

/**
 * ANTES de gravar a volta do sistema: os mapas da pasta ficam marcados, e o
 * aberto ganha os pendentes do trabalho dele (`marcarAntesDaVoltaDoSistema`).
 * Não deu: lança com a razão, e nada foi gravado.
 */
async function anotarAntesDaVolta(pastaId: string, mudar: MudarRpgDaPasta, recuperacao: RecoveryCopy | null): Promise<AnotadoAntesDaVolta> {
  const daPasta = useAdventureStore.getState().pasta
  const chaveAberta = daPasta !== null && daPasta.pastaId === pastaId ? daPasta.chave : null
  const aberto = await trabalhoAberto((pasta) => pasta.pastaId === pastaId)
  try {
    const antes = await marcarAntesDaVoltaDoSistema(pastaId, mudar, discoDoApp, {
      aberto: chaveAberta,
      recuperado: aberto?.copia ?? null,
      fichasDoMapa: aberto?.fichasDoMapa ?? [],
      recuperacao,
    })
    return { aberto, antes }
  } catch (erro) {
    throw new Error(`O que os bonecos desta pasta carregam não pôde ser anotado (${motivo(erro)}): nada foi gravado, e o sistema não mudou.`)
  }
}

/** O que vale para cada mapa da pasta quando a conferência logo depois da volta do sistema caiu. */
function textoDaVoltaPorConferir(antes: AntesDaVoltaDoSistema): string {
  if (antes.marcados.length === 0) return 'Antes de abrir um mapa dela, confira o que os bonecos ganharam sem o sistema.'
  if (!antes.abertoConferido) return 'Cada mapa da pasta salvo sem o sistema ficou marcado e confere ao abrir, antes de a ficha valer nele.'
  return 'O que os bonecos do mapa aberto carregavam ficou anotado antes de a ficha valer nele; cada mapa da pasta salvo sem o sistema ficou marcado e confere ao abrir.'
}

/**
 * "Configurar pasta" que pode mudar o Sistema universal ("Sistema universal",
 * "Copiar de um mapa"): `gravar` grava `mudar` (e lança com a razão, para
 * quem chama mostrar). Pasta convertida que fica sem sistema: anota desde
 * quando. Que volta a ter: ANTES de gravar, os mapas dela salvos nesse
 * meio-tempo (e o aberto) ficam marcados, e o que só os bonecos do mapa aberto
 * ganharam vira pendente — gravado o `rpg.json`, o espelho os esvazia na hora.
 * Não deu para anotar: lança, e o sistema não muda. Não gravou: os pendentes
 * desse espelho que não valeu saem, e lança. Gravado, os mapas marcados são
 * conferidos já; daí em diante nunca lança.
 */
export async function trocarSistemaDaPasta(pastaId: string, vinhaSemSistema: boolean, mudar: MudarRpgDaPasta, gravar: (mudar: MudarRpgDaPasta) => Promise<void>): Promise<void> {
  if (!isTauri()) {
    await gravar(mudar)
    return
  }
  const recuperacao = await copiaDeRecuperacao()
  const { aberto, antes } = vinhaSemSistema ? await anotarAntesDaVolta(pastaId, mudar, recuperacao) : { aberto: null, antes: NADA_ANTES_DA_VOLTA }
  try {
    await gravar(mudar)
  } catch (erro) {
    // O sistema não voltou: o espelho não tocou os bonecos, e o aviso seria falso.
    await retirarPendentesSemEspelho(pastaId, idsDe(antes.novos), discoDoApp).catch(() => undefined)
    throw erro
  }
  try {
    const marcados = await sistemaDaPastaMudou(pastaId, vinhaSemSistema, discoDoApp, { aberto: aberto?.chave ?? null, recuperacao })
    await conferirEAvisar(pastaId, marcados, aberto)
  } catch (erro) {
    // Os pendentes do mapa aberto já estão no relatório: aparecem mesmo assim.
    avisarPendentes(pastaId, antes.novos)
    useToastStore.getState().push('error', `Não deu para conferir a mochila dos bonecos desta pasta (${motivo(erro)}). ${textoDaVoltaPorConferir(antes)}`)
  }
}

function idsDe(pendentes: readonly ItemPendente[]): string[] {
  return pendentes.map((pendente) => pendente.id)
}

/**
 * "Usar o da pasta" do mapa aberto `chave` (`trocarModoDoMapa(false)`):
 * `gravar` grava o modo no índice e o passa ao editor (e lança com a razão).
 * Gravado, o espelho põe as fichas da pasta nos bonecos na hora — a de mesmo
 * id vence o boneco. ANTES, o que só os bonecos carregam, contra as fichas da
 * pasta, vira pendente no relatório, a partir do trabalho aberto (o não salvo
 * também); com a aventura já migrada, o que só as fichas do próprio mapa têm
 * (a dona da mochila ali é a ficha, e o boneco dela pode nem estar numa cena
 * lida). Não deu para anotar: lança, e o modo não muda. Não gravou: os
 * pendentes desse espelho que não valeu saem, e lança. Gravado: mostra os
 * pendentes. Fora do app, só `gravar`.
 */
export async function usarOdaPastaNoMapaAberto(chave: string, gravar: () => Promise<void>): Promise<void> {
  if (!isTauri()) {
    await gravar()
    return
  }
  const aberto = await trabalhoAberto((pasta) => pasta.chave === chave)
  let anotado: PendentesAntesDoEspelho | null
  try {
    anotado = await marcarMapaQueVaiUsarAPasta(chave, discoDoApp, { recuperado: aberto?.copia ?? null, fichasDoMapa: aberto?.fichasDoMapa ?? [] })
  } catch (erro) {
    throw new Error(`o que os bonecos deste mapa carregam não pôde ser anotado (${motivo(erro)}), e o mapa continua com o próprio sistema e personagens.`)
  }
  try {
    await gravar()
  } catch (erro) {
    // O mapa continua no próprio: o espelho da pasta não tocou os bonecos, e o aviso seria falso.
    if (anotado !== null) await retirarPendentesSemEspelho(anotado.pastaId, idsDe(anotado.novos), discoDoApp).catch(() => undefined)
    throw erro
  }
  if (anotado !== null) avisarPendentes(anotado.pastaId, anotado.novos)
}

/** A cópia de recuperação no disco (o app caiu com trabalho sem salvar); `null` = nenhuma, ou não deu para ler. */
async function copiaDeRecuperacao(): Promise<RecoveryCopy | null> {
  try {
    return await readRecoveryCopy()
  } catch {
    return null
  }
}

/** Confere já os mapas `marcados` da pasta (o aberto, com o trabalho do editor) e mostra os pendentes dela. A marca fica: a abertura confere de novo. */
async function conferirEAvisar(pastaId: string, marcados: readonly string[], aberto: TrabalhoAberto | null): Promise<void> {
  let conferiu = false
  for (const chave of marcados) {
    const conferido = await conferirMapaQueEntrou(chave, discoDoApp, { baixarMarca: false, recuperado: aberto?.chave === chave ? aberto.copia : null })
    if (conferido !== null) conferiu = true
  }
  if (conferiu) await avisarPendentesDaPasta(pastaId)
}

/**
 * "Importar personagens…" e "Copiar de um mapa" do "Configurar pasta", que
 * põem `fichas` na pasta: `gravar` grava o `rpg.json` (e lança com a razão).
 * Pasta convertida: os mapas dela com boneco dessas fichas ficam marcados
 * ANTES de gravar — sem a marca, o espelho da abertura faria a ficha nova
 * (sem mochila) vencer o boneco, e o que ele carrega sumiria calado — e o
 * mapa aberto, que o espelho esvazia assim que o `rpg.json` grava, ganha os
 * pendentes já. Não deu para marcar: lança, e nada é gravado. Não gravou:
 * os pendentes da ficha que não entrou saem, e lança. Gravado, confere já e
 * mostra os pendentes; daí em diante nunca lança (cada mapa confere ao abrir).
 */
export async function fichasEntramNaPasta(pastaId: string, fichas: readonly Personagem[], gravar: () => Promise<void>): Promise<void> {
  if (!isTauri() || fichas.length === 0) {
    await gravar()
    return
  }
  // ANTES de gravar: a ficha nova espelha na hora as cenas abertas desta pasta.
  const aberto = await trabalhoAberto((pasta) => pasta.pastaId === pastaId)
  // O mapa da pasta aberto cujo trabalho não deu para copiar: o disco não sabe o que os bonecos dele ganharam sem salvar.
  const abertoSemCopia = aberto === null && useAdventureStore.getState().pasta?.pastaId === pastaId
  let anotado: FichasQueEntram
  try {
    anotado = await marcarFichasQueEntram(pastaId, fichas, discoDoApp, { recuperado: aberto?.copia ?? null, aberto: aberto?.chave ?? null })
  } catch (erro) {
    throw new Error(`Não deu para anotar o que os bonecos dessas fichas carregam (${motivo(erro)}): nada foi gravado.`)
  }
  try {
    await gravar()
  } catch (erro) {
    // A ficha que não entrou não espelhou nada: o aviso do mapa aberto seria falso. Se nem isso gravar, o "Trazer" dele diz que a ficha não está na pasta.
    await retirarPendentesSemFicha(
      pastaId,
      anotado.novos.map((pendente) => pendente.id),
      discoDoApp,
    ).catch(() => undefined)
    throw erro
  }
  try {
    await conferirEAvisar(pastaId, anotado.marcados, aberto)
  } catch (erro) {
    // Os pendentes do mapa aberto já estão no relatório: aparecem mesmo assim.
    avisarPendentes(pastaId, anotado.novos)
    useToastStore.getState().push('error', `Não deu para conferir a mochila dos bonecos das fichas novas (${motivo(erro)}). ${textoDosMapasPorConferir(aberto, abertoSemCopia)}`)
  }
}

/** O que acontece com cada mapa da pasta quando a conferência logo depois de gravar as fichas novas caiu. */
function textoDosMapasPorConferir(aberto: TrabalhoAberto | null, abertoSemCopia: boolean): string {
  const outros = 'os outros mapas da pasta conferem ao abrir, antes de a ficha valer neles.'
  if (abertoSemCopia) return `Não salve o mapa aberto: feche sem salvar e abra de novo, para a abertura conferir os bonecos dele; ${outros}`
  if (aberto !== null) return `O que os bonecos do mapa aberto carregavam ficou anotado antes de a ficha valer nele; ${outros}`
  return 'Cada mapa da pasta confere ao abrir, antes de a ficha valer nele.'
}

/** O mapa aberto no editor e o trabalho dele agora (inclusive o não salvo). */
export interface TrabalhoAberto {
  chave: string
  copia: RecoveryCopy
  /** As fichas do próprio mapa que mandam na mochila dos bonecos dele (`fichasDonasDoProprioMapa`), do mesmo instante da cópia. */
  fichasDoMapa: readonly Personagem[]
}

/**
 * O trabalho do mapa aberto, quando ele está numa pasta e `eDele` diz que é o
 * mapa em questão; `null` = não é, ou não deu para copiar (aí vale o disco).
 * Nunca lança.
 */
async function trabalhoAberto(eDele: (pasta: PastaAberta) => boolean): Promise<TrabalhoAberto | null> {
  if (!isTauri()) return null
  const { pasta } = useAdventureStore.getState()
  if (pasta === null || !eDele(pasta)) return null
  try {
    const soltoEm = await discoDoApp.juntar(await discoDoApp.pastaDoApp(), PASTA_DOS_MAPAS, pasta.chave, ARQUIVO_DO_MAPA)
    // Sem `await` entre as duas leituras: `captureEditorWork` lê o editor antes do primeiro `await` dela, e a ficha e o boneco que a mostra saem do mesmo instante.
    const fichasDoMapa = fichasDonasDoProprioMapa(useAdventureStore.getState())
    return { chave: pasta.chave, copia: await captureEditorWork(() => soltoEm, Date.now()), fichasDoMapa }
  } catch {
    return null
  }
}

/** Para o "Mover…" chamar ANTES de gravar o índice: o trabalho do mapa `chave`, se é ele o aberto. */
export function trabalhoDoMapaAberto(chave: string): Promise<TrabalhoAberto | null> {
  return trabalhoAberto((pasta) => pasta.chave === chave)
}

/**
 * "Mover…" (ou arrastar) do Carregar Mapa, depois de gravado o índice. O mapa
 * que saiu de uma pasta convertida: o pendente que o boneco ainda carrega sai
 * do aviso (é do boneco de novo); `aberto` é o trabalho do mapa, se era ele o
 * aberto (o espelho já tirou dele o que só o pendente guarda). O mapa que
 * entrou numa pasta convertida é anotado e conferido já — o mestre vê o que
 * só os bonecos dele têm sem precisar abrir. A abertura confere de novo.
 */
export async function mapaMudouDePasta(chave: string, origem: string | null, destino: string | null, aberto: TrabalhoAberto | null): Promise<void> {
  if (!isTauri()) return
  try {
    if (origem !== null) await mapaSaiuDaPasta(chave, origem, discoDoApp, { recuperado: aberto?.chave === chave ? aberto.copia : null })
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para conferir os avisos da mochila da pasta de onde o mapa saiu (${motivo(erro)}). Antes de "Trazer para a ficha", confira se o boneco ainda tem o item.`)
  }
  if (destino === null) return
  try {
    if ((await marcarMapaQueEntrou(chave, discoDoApp)) === null) return
    const conferido = await conferirMapaQueEntrou(chave, discoDoApp, { baixarMarca: false })
    if (conferido !== null) await avisarPendentesDaPasta(conferido.pastaId)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para anotar os itens dos bonecos deste mapa (${motivo(erro)}). Antes de abri-lo, confira a mochila dos bonecos.`)
  }
}

/** Importar mapa (App.tsx): a importação que cai num mapa já numa pasta convertida só anota; a abertura, logo depois, confere. */
export async function marcarMapaImportado(chave: string): Promise<void> {
  if (!isTauri()) return
  try {
    await marcarMapaQueEntrou(chave, discoDoApp)
  } catch (erro) {
    useToastStore.getState().push('error', `Não deu para anotar os itens dos bonecos do mapa importado (${motivo(erro)}). Antes de salvá-lo, confira a mochila dos bonecos.`)
  }
}

/**
 * A abertura (App.tsx, depois da migração e ANTES de o editor ler as fichas):
 * confere o mapa anotado e mostra os pendentes da pasta dele. Falhou: avisa —
 * o mapa abre, mas o espelho mostra a ficha, e salvar tiraria o item do boneco.
 */
export async function conferirMochilaAoAbrir(caminhoDoMapa: string, recuperado: RecoveryCopy | null = null): Promise<void> {
  if (!isTauri()) return
  try {
    const chave = await chaveDoCaminho(caminhoDoMapa, discoDoApp)
    if (chave === null) return
    const conferido = await conferirMapaQueEntrou(chave, discoDoApp, { recuperado, baixarMarca: true })
    if (conferido !== null) await avisarPendentesDaPasta(conferido.pastaId)
  } catch (erro) {
    useToastStore
      .getState()
      .push('error', `Não deu para anotar os itens que só os bonecos deste mapa têm (${motivo(erro)}). Salvar agora pode tirá-los dos bonecos: feche sem salvar e abra de novo.`)
  }
}
