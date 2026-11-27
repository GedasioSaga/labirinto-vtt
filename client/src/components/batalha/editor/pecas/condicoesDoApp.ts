import { criarCondicaoPropria } from '../../../../lib/condicoesProprias'
import { useCondicoesPropriasStore } from '../../../../stores/condicoesPropriasStore'
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
  virar: ({ rascunho }) => {
    const nova = criarCondicaoPropria(rascunho)
    if (nova === null) return null
    return useCondicoesPropriasStore.getState().salvar(nova) ? nova.nome : null
  },
}

registrarCondicoesDoApp(CONDICOES_DO_APP)
