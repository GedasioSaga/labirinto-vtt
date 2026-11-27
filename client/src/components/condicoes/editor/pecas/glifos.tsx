import { Glifo } from '../../../batalha/editor/pecas/glifos'

/**
 * OS ÍCONES DAS PEÇAS DA CONDIÇÃO (rework das condições, PLANO.md E4; `GLIFOS` do protótipo,
 * prototipo.html:493-501). As famílias que o editor de habilidades já desenha (o Muda atributo, o Depois de
 * X turnos e a Marca: `status`, `gatilho`, `marca`) vêm de lá, o mesmo traço; aqui ficam só as cinco que
 * são da condição. Traço de 24 px, sem preenchimento, na cor de quem desenha (`currentColor`). Decorativos:
 * o nome da peça anda sempre junto.
 */

type Traco = { d: string } | { circulo: readonly [number, number, number]; tracejado?: string } | { caixa: readonly [number, number, number, number, number] }

const GLIFOS_DA_CONDICAO = {
  vez: [{ d: 'M20 12a8 8 0 1 1-2.3-5.6' }, { d: 'M20 4.5v4h-4' }],
  trava: [{ caixa: [5, 10.5, 14, 10, 2] }, { d: 'M8 10.5V7.5a4 4 0 0 1 8 0v3' }],
  balanca: [{ d: 'M12 4v16M7.5 20h9M5 7.5h14' }, { d: 'M5 7.5 2.5 13a2.6 2.6 0 0 0 5 0zM19 7.5 16.5 13a2.6 2.6 0 0 0 5 0z' }],
  aura: [{ circulo: [12, 12, 2.6] }, { circulo: [12, 12, 6.2], tracejado: '2.2 2.6' }, { circulo: [12, 12, 9.6], tracejado: '2.2 3.2' }],
  contra: [{ d: 'M4 8h12.5l-3.5-3.5M20 16H7.5l3.5 3.5' }],
} satisfies Record<string, readonly Traco[]>

type NomeDoGlifoDaCondicao = keyof typeof GLIFOS_DA_CONDICAO

function ehGlifoDaCondicao(nome: string): nome is NomeDoGlifoDaCondicao {
  return Object.hasOwn(GLIFOS_DA_CONDICAO, nome)
}

/** O ícone de uma peça da condição (`PecaDaCondicaoNaTela.icone`); o que não é daqui sai pelo `Glifo` das habilidades. */
export function GlifoDaCondicao({ nome, className }: { nome: string; className?: string }) {
  if (!ehGlifoDaCondicao(nome)) return <Glifo nome={nome} className={className} />
  const tracos: readonly Traco[] = GLIFOS_DA_CONDICAO[nome]
  return (
    <svg className={className === undefined ? 'lb-pc__ic' : `lb-pc__ic ${className}`} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {tracos.map((traco, indice) => {
        if ('d' in traco) return <path key={indice} d={traco.d} />
        if ('circulo' in traco) return <circle key={indice} cx={traco.circulo[0]} cy={traco.circulo[1]} r={traco.circulo[2]} strokeDasharray={traco.tracejado} />
        return <rect key={indice} x={traco.caixa[0]} y={traco.caixa[1]} width={traco.caixa[2]} height={traco.caixa[3]} rx={traco.caixa[4]} />
      })}
    </svg>
  )
}
