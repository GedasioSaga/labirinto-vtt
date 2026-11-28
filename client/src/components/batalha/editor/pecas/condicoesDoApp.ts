import { CONFIRA_DA_CONDICAO_MAX } from '../../../../lib/condicoes/modelo'
import { criarCondicaoPropria } from '../../../../lib/condicoesProprias'
import { useCondicoesPropriasStore } from '../../../../stores/condicoesPropriasStore'
import { useToastStore } from '../../../../stores/toastStore'
import { registrarCondicoesDoApp, type CondicoesDoApp } from './condicoesNoSeletor'

/**
 * AS CONDIÇÕES DO APP NOS SELETORES (rework das condições, E7). SÓ O APP IMPORTA ESTE MÓDULO: ele puxa a
 * store das criadas, que lê o disco pelo Tauri, e o site do Lobby não pode carregar o Tauri. Importar
 * já registra (`registrarCondicoesDoApp`): as criadas da pasta entram nos seletores e o "Virar condição
 * nova" grava na lista da pasta. Quem importa: a entrada do app e as janelas só do app (o editor do item,
 * o "Pôr selo…" da batalha).
 */

export const CONDICOES_DO_APP: CondicoesDoApp = {
  fonte: {
    ler: () => useCondicoesPropriasStore.getState().catalogo,
    seguir: (aviso) => useCondicoesPropriasStore.subscribe(() => aviso()),
  },
  // PENDENCIAS nº 10: antes gravava direto na lista (e o "Confira" se perdia); agora abre o editor com o rascunho.
  virar: ({ rascunho, confira }, aoVirar) => {
    const nova = criarCondicaoPropria(rascunho)
    if (nova === null) return false
    const texto = confira.join(' · ').slice(0, CONFIRA_DA_CONDICAO_MAX)
    const comConfira = texto === '' ? nova : { ...nova, confira: texto }
    // O editor carrega sob demanda: este módulo entra na abertura do app, e o editor (com o boneco) é pesado.
    import('../../../condicoes/editor/EditorDaCondicao')
      .then(({ abrirEditorDaCondicao }) => abrirEditorDaCondicao({ abertura: { tipo: 'rascunho', rascunho: comConfira }, onSalvou: (condicao) => aoVirar(condicao.nome) }))
      .catch(() => useToastStore.getState().push('error', 'Não deu para abrir o editor da condição. Tente de novo.'))
    return true
  },
}

registrarCondicoesDoApp(CONDICOES_DO_APP)
