import { useEffect, useState } from 'react'

/**
 * A VEZ DO TEXTO NO CARTÃO (F3c, medido no build de produção): o maior quadro
 * do mestre (137 cartões) desenhava o texto formatado de todos os cartões no
 * mesmo quadro da tela, e a abertura travava (tarefas longas de 0,9 s a 1,4 s,
 * quase tudo layout). O texto entra aos poucos, alguns cartões por quadro da
 * tela, depois que o quadro já apareceu: o cartão mostra nome, foto e tamanho
 * desde o começo, e o texto chega logo em seguida.
 */
const CARTOES_POR_VEZ = 8

const fila: Array<() => void> = []
let agendado = false

function rodar(): void {
  agendado = false
  for (const liberar of fila.splice(0, CARTOES_POR_VEZ)) liberar()
  if (fila.length > 0) agendar()
}

function agendar(): void {
  if (agendado) return
  agendado = true
  // Depois do próximo desenho da tela: cada leva ganha o seu quadro, e o layout dela vai junto.
  requestAnimationFrame(() => setTimeout(rodar, 0))
}

/** `true` quando o cartão já pode desenhar o texto. `agora` pula a fila (exportar, editar). */
export function useVezDoTexto(agora: boolean): boolean {
  const [vez, setVez] = useState(agora)
  const liberado = vez || agora
  useEffect(() => {
    if (liberado) return
    const liberar = () => setVez(true)
    fila.push(liberar)
    agendar()
    return () => {
      const posicao = fila.indexOf(liberar)
      if (posicao >= 0) fila.splice(posicao, 1)
    }
  }, [liberado])
  return liberado
}
