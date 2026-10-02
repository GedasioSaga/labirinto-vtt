/// <reference types="vite/client" />
import { usePatrulhaAndandoStore } from './patrulhaAndandoStore'
import { usePausaDosNpcsStore } from './pausaDosNpcsStore'
import { useRotinaAndandoStore } from './rotinaAndandoStore'

/**
 * NPCS ANDANDO — o que a barra de cima e o Shift+P enxergam: há alguém
 * andando sozinho (rotina OU patrulha) e a pausa geral dos dois. Mora fora de
 * cada store para nenhum relógio precisar conhecer o outro.
 */

/** Algum NPC com rotina ou patrulha ligada (pausado ou não). */
export function useAlgumNpcAndando(): boolean {
  const rotinas = useRotinaAndandoStore((state) => state.andando.size)
  const patrulhas = usePatrulhaAndandoStore((state) => state.andando.size)
  return rotinas + patrulhas > 0
}

function algumNpcAndando(): boolean {
  return useRotinaAndandoStore.getState().andando.size + usePatrulhaAndandoStore.getState().andando.size > 0
}

/**
 * O botão "Pausar NPCs" / "Retomar NPCs" e o Shift+P. Sem ninguém andando,
 * pausar não faz nada (o botão nem aparece); retomar vale sempre.
 */
export function alternarPausaDosNpcs(): void {
  const pausa = usePausaDosNpcsStore.getState()
  if (pausa.pausadaDesde !== null) pausa.retomar()
  else if (algumNpcAndando()) pausa.pausar()
}

/**
 * Pausa sem ninguém andando não existe: o botão some quando o último para, e
 * uma pausa esquecida faria o próximo "Patrulhar sozinha" não sair do lugar,
 * sem botão à vista que explicasse.
 */
function soltarPausaVazia(): void {
  if (!algumNpcAndando()) usePausaDosNpcsStore.getState().retomar()
}

const cancelarRotina = useRotinaAndandoStore.subscribe(soltarPausaVazia)
const cancelarPatrulha = usePatrulhaAndandoStore.subscribe(soltarPausaVazia)

import.meta.hot?.accept(() => import.meta.hot?.invalidate())
import.meta.hot?.dispose(() => {
  cancelarRotina()
  cancelarPatrulha()
})
