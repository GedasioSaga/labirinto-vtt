import { useMapStore } from './mapStore'

/*
 * As ligações do painel do mestre com o mapa para "Raio de visão aqui" (Sala)
 * e "Vista de longe" (luz). Moram aqui, e não inline em App.tsx, para o teste
 * do painel usar EXATAMENTE a ligação que o App passa: o `PropertiesPanel`
 * exige as duas (`room.onRaioDeVisaoChange`, `lightControls.onVistaDeLongeChange`),
 * então tirá-las do App quebra o tipo, e trocá-las por outra coisa quebra o teste.
 */

/** "Raio de visão aqui" da Sala → mapa, com histórico; `null` volta ao raio do jogador. */
export function mudarRaioDeVisaoDaSala(salaId: string, raio: number | null): void {
  useMapStore.getState().setRoomVisionRadius(salaId, raio)
}

/** Interruptor "Vista de longe" → mapa. Desligada, a chave some do arquivo (`undefined` === como era antes). */
export function mudarVistaDeLonge(luzId: string, vistaDeLonge: boolean): void {
  useMapStore.getState().updateLight(luzId, { vistaDeLonge: vistaDeLonge || undefined })
}
