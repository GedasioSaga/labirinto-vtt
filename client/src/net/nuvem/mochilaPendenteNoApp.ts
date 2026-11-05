import { isTauri } from '@tauri-apps/api/core'
import { textoDoIgnorado, textoDoPendente, textoDoTrazido, type ItemPendente } from '../../lib/mochila/pendentes'
import type { RecoveryCopy } from '../../lib/recoveryCopy'
import { editarRpgDaPasta } from '../../stores/rpgDaPasta'
import { useToastStore } from '../../stores/toastStore'
import { discoDoApp } from './migracaoDaMochila'
import { chaveDoCaminho, conferirMapaQueEntrou, ignorarPendente, marcarMapaQueEntrou, pendentesDaPasta, trazerPendente } from './mochilaPendente'

/**
 * MOCHILA NA FICHA (correção C2) — o mapa que entra numa pasta convertida, no
 * app: o "Mover…" do Carregar Mapa, a importação e a abertura chamam daqui
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
      push('info', textoDoTrazido(feito.pendente, feito.moedasDeFora))
      return
    }
    if (feito.porque !== 'sem-ficha') return
    push('error', `A ficha de ${pendente.personagem} não está mais na pasta: o aviso continua, e "Ignorar" o tira da lista.`)
  } catch (erro) {
    push('error', `Não deu para levar à ficha (${motivo(erro)}): o aviso continua.`)
  }
  // O clique tirou o aviso da tela; sem decisão gravada, ele volta.
  avisarPendentes(pastaId, [pendente])
}

async function ignorarNoApp(pastaId: string, pendente: ItemPendente): Promise<void> {
  const { push } = useToastStore.getState()
  try {
    const feito = await ignorarPendente(pastaId, pendente.id, discoDoApp)
    if (feito.ok) push('info', textoDoIgnorado(feito.pendente))
  } catch (erro) {
    push('error', `Não deu para anotar o "Ignorar" (${motivo(erro)}): o aviso continua.`)
    avisarPendentes(pastaId, [pendente])
  }
}

/** Mostra os pendentes da pasta que ainda esperam o mestre. */
async function avisarPendentesDaPasta(pastaId: string): Promise<void> {
  avisarPendentes(pastaId, await pendentesDaPasta(pastaId, discoDoApp))
}

/**
 * "Mover…" (ou arrastar) do Carregar Mapa, depois de gravado o índice: o
 * mapa que entrou numa pasta convertida é anotado e conferido já — o mestre
 * vê o que só os bonecos dele têm sem precisar abrir. A abertura confere de novo.
 */
export async function mapaEntrouNaPasta(chave: string): Promise<void> {
  if (!isTauri()) return
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
