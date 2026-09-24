interface PlayerScreenAwakeProps {
  /** A tela está travada acesa agora (`useScreenWakeLock`). */
  active: boolean
}

/**
 * "Tela acesa": o selo discreto, no canto de baixo à esquerda, que diz que o
 * celular não vai apagar a tela durante a sessão. Só existe com a trava ativa:
 * navegador sem suporte ou que recusou não mostra nada. Não é controle — não
 * pega toque (o arrasto do mapa passa por baixo) nem entra na ordem do Tab.
 */
export function PlayerScreenAwake({ active }: PlayerScreenAwakeProps) {
  if (!active) return null
  return (
    <p className="pp-awake" title="O celular não apaga a tela enquanto você está na sessão.">
      <span className="pp-awake__dot" aria-hidden="true" />
      Tela acesa
    </p>
  )
}
