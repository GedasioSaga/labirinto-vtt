import { useEffect, useState } from 'react'
import { ligarSomDoCombate, ouvirMudoDoCombate, somDoCombateLigado } from '../../lib/sons/sonsDoCombate'
import { cameraDaBatalhaLigada, ligarCameraDaBatalha } from '../../pixi/cameraDaBatalha'

/**
 * As CHAVES DO COMBATE, guardadas neste computador:
 *
 *   BotaoDoSomDoCombate      D5: liga e desliga os sons do combate (ligados por padrão).
 *   BotaoDaCameraDaBatalha   D7: o mestre desliga a câmera que traz a ficha da vez
 *                            para a vista (ligada por padrão). Feito para o painel da
 *                            batalha do mestre: quem monta o painel põe onde couber.
 *
 * Os dois são o mesmo carimbo pequeno do rodapé do menu (`.bt-botao--p`), com o
 * estado no texto ("Som: ligado") e em `aria-pressed`.
 */

export function BotaoDoSomDoCombate() {
  const [ligado, setLigado] = useState(somDoCombateLigado)
  useEffect(() => ouvirMudoDoCombate(() => setLigado(somDoCombateLigado())), [])
  return (
    <button
      type="button"
      className="bt-botao bt-botao--p bt-chave-do-combate"
      aria-pressed={ligado}
      title={ligado ? 'Desliga os sons do combate neste computador' : 'Liga os sons do combate neste computador'}
      onClick={() => ligarSomDoCombate(!ligado)}
    >
      Som: {ligado ? 'ligado' : 'mudo'}
    </button>
  )
}

export function BotaoDaCameraDaBatalha() {
  const [ligada, setLigada] = useState(cameraDaBatalhaLigada)
  return (
    <button
      type="button"
      className="bt-botao bt-botao--p bt-chave-do-combate"
      aria-pressed={ligada}
      title={ligada ? 'A câmera traz a ficha da vez para a vista quando ela está fora da tela ou na borda' : 'A câmera fica onde você deixar'}
      onClick={() => {
        ligarCameraDaBatalha(!ligada)
        setLigada(!ligada)
      }}
    >
      Câmera segue a vez: {ligada ? 'sim' : 'não'}
    </button>
  )
}
