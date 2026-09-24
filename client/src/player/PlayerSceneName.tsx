interface PlayerSceneNameProps {
  /** Nome para os jogadores da cena onde ele está (`state.sceneName`); ausente ou vazio = sem selo. */
  name: string | undefined
}

/**
 * "ONDE ESTOU": o selo com o nome público da cena, no canto de cima à direita.
 * Só existe quando o mestre deu à cena um nome para os jogadores — corredores
 * parecidos, andares iguais, e o jogador sabe em que andar está. É texto puro
 * (o React escapa); `role="status"` anuncia a troca de cena a quem usa leitor
 * de tela, e o selo não pega toque, para não roubar arrasto do mapa.
 */
export function PlayerSceneName({ name }: PlayerSceneNameProps) {
  if (name === undefined || name.length === 0) return null
  return (
    <p className="pp-scene-name" role="status" aria-live="polite">
      <span className="pp-scene-name__label">Onde estou</span>{' '}
      <span className="pp-scene-name__value">{name}</span>
    </p>
  )
}
