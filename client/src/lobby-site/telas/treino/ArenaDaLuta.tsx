import { useEffect, useRef, type AnimationEvent } from 'react'
import { maximoComposto } from '../../../lib/ajusteDaFicha'
import { cartaDaVez } from '../../../lib/batalha/turnos'
import type { Personagem } from '../../../lib/personagem'
import type { DueloNoFio } from '../../../lib/treino/duelo'
import type { LadoDoTreino, VagaDoTreino } from '../../../lib/treino/mesaEmMemoria'
import { recursoDeVida, vidaDoPersonagem } from '../../../lib/vidaDaFicha'
import { SISTEMA_DO_LOBBY } from '../contexto'

/**
 * A ARENA de uma luta (fatia T7): os dois lados com a Vida e a Energia de
 * cada cópia, quem está na vez, quem caiu, e o registro do que aconteceu, o
 * mais novo embaixo. Serve à luta de treino e ao duelo: os dois chegam no
 * formato do fio (`DueloNoFio`). As barras não animam (regra do app: mudam a
 * cada golpe); só a linha nova do registro entra com um deslize curto.
 */

const RECURSOS_COM_BARRA = SISTEMA_DO_LOBBY.recursos.filter((recurso) => recurso.atualEMaximo === true)
const RECURSO_DA_VIDA = recursoDeVida(SISTEMA_DO_LOBBY)
/** Quantas linhas do registro ficam à vista (o servidor manda as 50 mais novas). */
const LINHAS_A_VISTA = 14

/** A cópia de pé? Sem vida legível, de pé (a mesma leitura do fim da luta). */
export function dePe(doc: Personagem): boolean {
  const vida = RECURSO_DA_VIDA === null ? null : vidaDoPersonagem(doc, RECURSO_DA_VIDA)
  return vida === null || vida.atual > 0
}

/**
 * A entrada animada acontece uma vez: as abas do treino ficam montadas e só
 * escondidas, e o navegador repete a animação de tudo ao mostrar a aba de
 * novo. Depois da primeira, a animação sai do elemento.
 */
export function assentarAnimacao(evento: AnimationEvent<HTMLElement>): void {
  evento.currentTarget.style.animation = 'none'
}

/** O nome de quem está na vez agora; `null` = ninguém (acabou ou não começou). */
export function nomeDaVez(duelo: DueloNoFio): { nome: string; lado: LadoDoTreino } | null {
  const carta = cartaDaVez(duelo.turnos)
  if (carta === null) return null
  const vaga = duelo.lutadores.vagas.find((candidata) => candidata.tokenId === carta.tokenId)
  if (vaga === undefined) return null
  const doc = duelo.lutadores.personagens.find((personagem) => personagem.id === vaga.personagemId)
  return { nome: doc?.nome ?? 'Alguém', lado: vaga.lado }
}

function Lutador({ vaga, doc, naVez }: { vaga: VagaDoTreino; doc: Personagem | undefined; naVez: boolean }) {
  if (doc === undefined) return null
  const caiu = !dePe(doc)
  const escudo = doc.recursos.escudo ?? 0
  return (
    <li className="lo-tr-lutador" data-vez={naVez ? '1' : undefined} data-caiu={caiu ? '1' : undefined}>
      <div className="lo-tr-lutador__cab">
        <span className="lo-tr-lutador__nome">{doc.nome}</span>
        {naVez && <span className="lo-tag lo-tag--sua">Na vez</span>}
        {caiu && <span className="lo-tag lo-tag--brasa">Caiu</span>}
      </div>
      <div className="lo-medidores">
        {RECURSOS_COM_BARRA.map((recurso) => {
          const atual = doc.recursos[recurso.id] ?? 0
          const maximo = maximoComposto(doc, recurso.id).total
          const parte = maximo > 0 ? Math.max(0, Math.min(1, atual / maximo)) : 0
          return (
            <div key={recurso.id} className="lo-medidor" data-tom={recurso.tom}>
              <span className="lo-medidor__nome">{recurso.nome}</span>
              <span className="lo-barra" aria-hidden="true">
                <span style={{ transform: `scaleX(${parte.toFixed(3)})` }} />
              </span>
              <span className="lo-medidor__valor">
                {atual.toLocaleString('pt-BR')} <small>/ {maximo.toLocaleString('pt-BR')}</small>
              </span>
            </div>
          )
        })}
      </div>
      {escudo > 0 && <p className="lo-tr-lutador__escudo">Escudo {escudo.toLocaleString('pt-BR')}</p>}
      <span className="lo-sr">{vaga.lado === 'a' ? 'Lado A' : 'Lado B'}</span>
    </li>
  )
}

function Lado({ duelo, lado, titulo, vezDe }: { duelo: DueloNoFio; lado: LadoDoTreino; titulo: string; vezDe: string | null }) {
  const vagas = duelo.lutadores.vagas.filter((vaga) => vaga.lado === lado)
  const porId = new Map(duelo.lutadores.personagens.map((personagem) => [personagem.id, personagem]))
  return (
    <section className="lo-tr-lado" data-lado={lado} aria-label={titulo}>
      <h3 className="lo-tr-lado__titulo">{titulo}</h3>
      <ul className="lo-tr-lutadores">
        {vagas.map((vaga) => (
          <Lutador key={vaga.id} vaga={vaga} doc={porId.get(vaga.personagemId)} naVez={vezDe === vaga.tokenId} />
        ))}
      </ul>
    </section>
  )
}

export function ArenaDaLuta({ duelo, meuLado, nomeDoMeuLado, nomeDoOutroLado }: { duelo: DueloNoFio; meuLado: LadoDoTreino; nomeDoMeuLado: string; nomeDoOutroLado: string }) {
  const outroLado: LadoDoTreino = meuLado === 'a' ? 'b' : 'a'
  const carta = duelo.fim === null ? cartaDaVez(duelo.turnos) : null
  const linhas = duelo.registro.slice(-LINHAS_A_VISTA)
  const fimDoRegistro = useRef<HTMLOListElement>(null)

  // O registro rola sozinho para a linha nova, dentro da caixa dele (a página não pula).
  useEffect(() => {
    const lista = fimDoRegistro.current
    if (lista !== null) lista.scrollTop = lista.scrollHeight
  }, [linhas.length, linhas.at(-1)?.id])

  return (
    <div className="lo-tr-arena">
      <div className="lo-tr-lados">
        <Lado duelo={duelo} lado={meuLado} titulo={nomeDoMeuLado} vezDe={carta?.tokenId ?? null} />
        <Lado duelo={duelo} lado={outroLado} titulo={nomeDoOutroLado} vezDe={carta?.tokenId ?? null} />
      </div>
      <section className="lo-tr-registro" aria-label="O que aconteceu">
        <h3 className="lo-tr-lado__titulo">Registro</h3>
        {linhas.length === 0 ? (
          <p className="lo-motivo">Nada ainda. O primeiro golpe aparece aqui.</p>
        ) : (
          <ol className="lo-tr-registro__linhas" role="log" ref={fimDoRegistro}>
            {linhas.map((linha) => (
              <li key={linha.id} className="lo-tr-linha" onAnimationEnd={assentarAnimacao}>
                <span className="lo-tr-linha__rodada">R{linha.rodada}</span>
                <span>{linha.texto}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}
