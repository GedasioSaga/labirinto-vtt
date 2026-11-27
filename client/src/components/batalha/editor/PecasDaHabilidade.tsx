import { useState } from 'react'
import type { MecanicaV1, UsoDaMecanica } from '../../../lib/batalha/mecanica/modelo'
import { trocarUso } from '../../../lib/batalha/mecanica/modelos'
import { GATILHOS_MAX, motivoDasPecasComOUso, pecaNova, PECAS_MAX, type FamiliaDaPeca, type PecaDaMecanica } from '../../../lib/batalha/mecanica/pecas'
import { acumuladorParaGuardar, lerAcumulador } from '../../../lib/batalha/requisitos/ler'
import type { AcumuladorDaFicha } from '../../../lib/batalha/requisitos/modelo'
import type { CartaoDaFicha, Personagem } from '../../../lib/personagem'
import type { SistemaDeRpg } from '../../../lib/sistemaDeRpg'
import type { MudarNoEditor } from './mudarNoEditor'
import { avisoDaPeca, MolduraDaPeca } from './pecas/MolduraDaPeca'
import { useVariavelCss } from './pecas/controlesDaPeca'
import { Glifo } from './pecas/glifos'
import { entradaDaPeca, ORDEM_NA_TELA, REGISTRO_DAS_PECAS, type ArredoresDaPeca } from './pecas/registro'

/**
 * AS PEÇAS NO EDITOR (rework das habilidades, E6; protótipo aprovado, `blocoPecas`): as peças da
 * mecânica, uma por moldura, na ordem da lista (subir, descer, tirar), e o catálogo "Pôr peça" com as
 * 11 famílias. O corpo de cada peça é o componente do registro (E4); aqui mora só a lista.
 *
 * O Acumulador não é peça da mecânica (D9): a moldura dele edita o `cartao.acumulador` do próprio
 * cartão. A peça que só vale num jeito de usar (a Passiva, o "Ligar e manter", a reação) troca a Ação
 * do topo ao entrar, com aviso e Desfazer, quando as outras peças deixam; senão a moldura avisa.
 */

interface PecasDaHabilidadeProps {
  mecanica: MecanicaV1
  cartao: CartaoDaFicha
  personagem: Personagem
  sistema: SistemaDeRpg
  onMudar: MudarNoEditor
  /** O cartão editado mudou fora da mecânica (o Acumulador); `aviso` = um passo próprio no Ctrl+Z. */
  onMudarCartao: (cartao: CartaoDaFicha, aviso?: string) => void
  /** D8: a ligação que mora no requisito de outro cartão da ficha; ausente = a peça só explica. */
  onMudarOutroCartao?: (cartao: CartaoDaFicha) => void
  /** O id da seção de cada peça (o papel leva até a lista). */
  prefixo: string
}

/** O jeito de usar que cada família pede (`motivoDasPecasComOUso`); `null` = vale em vários. */
const USO_QUE_PEDE: Readonly<Partial<Record<FamiliaDaPeca, UsoDaMecanica>>> = { gatilho: 'passiva', raca: 'passiva', imbuir: 'manter', transformacao: 'manter', devolve: 'reacao' }

/** Por que a família não entra mais (o teto da lista, uma por família, até 5 gatilhos); `null` = entra. */
function motivoDeNaoCaber(familia: FamiliaDaPeca, pecas: readonly PecaDaMecanica[]): string | null {
  if (pecas.length >= PECAS_MAX) return `Até ${PECAS_MAX} peças numa habilidade.`
  const iguais = pecas.filter((peca) => peca.tipo === familia).length
  if (familia === 'gatilho') return iguais >= GATILHOS_MAX ? `Até ${GATILHOS_MAX} gatilhos numa passiva.` : null
  return iguais > 0 ? 'Esta peça entra uma vez só; edite a que já está na lista.' : null
}

/**
 * A mecânica com a peça nova no fim. Se a peça não roda com a Ação de agora e a troca para a Ação que
 * ela pede não quebra as outras, a Ação troca junto (com o aviso que diz isso).
 */
function comAPecaNova(mecanica: MecanicaV1, peca: PecaDaMecanica): { mecanica: MecanicaV1; trocouPara: UsoDaMecanica | null } {
  const pecas = [...(mecanica.pecas ?? []), peca]
  const overload = mecanica.limite.overload === true
  const junto: MecanicaV1 = { ...mecanica, pecas }
  if (motivoDasPecasComOUso([peca], { ...(mecanica.uso === undefined ? {} : { uso: mecanica.uso }), overload }) === null) return { mecanica: junto, trocouPara: null }
  const pede = USO_QUE_PEDE[peca.tipo]
  // A forma Overload já vale (Overload de transformação): só a Transformação fora dela pede o "Ligar e manter".
  if (pede === undefined) return { mecanica: junto, trocouPara: null }
  const trocada = { ...trocarUso(mecanica, pede), pecas }
  const cabe = motivoDasPecasComOUso(pecas, { ...(trocada.uso === undefined ? {} : { uso: trocada.uso }), overload: trocada.limite.overload === true }) === null
  return cabe ? { mecanica: trocada, trocouPara: pede } : { mecanica: junto, trocouPara: null }
}

const NOME_DO_USO: Readonly<Record<UsoDaMecanica, string>> = { ativa: 'na vez', reacao: 'Reação', ativaOuReacao: 'Reação (ou na vez)', passiva: 'Passiva', manter: 'Ligar e manter' }

export function PecasDaHabilidade({ mecanica, cartao, personagem, sistema, onMudar, onMudarCartao, onMudarOutroCartao, prefixo }: PecasDaHabilidadeProps) {
  // Só a peça que acabou de entrar anima (as que já estavam, ao abrir, não).
  const [novaEm, setNovaEm] = useState<number | 'acumulador' | null>(null)
  const [comAcumulador, setComAcumulador] = useState(false)
  const pecas = mecanica.pecas ?? []
  const acumulador = lerAcumulador(cartao.acumulador).acumulador ?? undefined
  const mostraAcumulador = acumulador !== undefined || comAcumulador
  const arredores: ArredoresDaPeca = {
    cartao: { id: cartao.id, nome: cartao.nome },
    personagem,
    atributos: sistema.atributos.map((atributo) => ({ id: atributo.id, nome: atributo.nome })),
    ...(onMudarOutroCartao === undefined ? {} : { aoMudarOutroCartao: onMudarOutroCartao }),
  }

  const comPecas = (lista: readonly PecaDaMecanica[]): MecanicaV1 => {
    if (lista.length > 0) return { ...mecanica, pecas: lista }
    const { pecas: _fora, ...sem } = mecanica
    return sem
  }
  const trocarNa = (indice: number, peca: PecaDaMecanica) => onMudar(comPecas(pecas.map((atual, i) => (i === indice ? peca : atual))))
  const mover = (indice: number, para: number) => {
    const lista = [...pecas]
    const [peca] = lista.splice(indice, 1)
    if (peca === undefined) return
    lista.splice(para, 0, peca)
    setNovaEm(null)
    onMudar(comPecas(lista), `${entradaDaPeca(peca.tipo).nome} ${para < indice ? 'subiu' : 'desceu'}.`)
  }
  const tirar = (indice: number) => {
    const peca = pecas[indice]
    if (peca === undefined) return
    setNovaEm(null)
    onMudar(
      comPecas(pecas.filter((_atual, i) => i !== indice)),
      `${entradaDaPeca(peca.tipo).nome} saiu.`,
    )
  }
  const por = (familia: FamiliaDaPeca) => {
    const { mecanica: depois, trocouPara } = comAPecaNova(mecanica, pecaNova(familia))
    setNovaEm(pecas.length)
    const nome = entradaDaPeca(familia).nome
    onMudar(depois, trocouPara === null ? `${nome} entrou: ajuste os números na peça.` : `${nome} entrou e a Ação virou ${NOME_DO_USO[trocouPara]}, que esta peça pede.`)
  }
  const porAcumulador = () => {
    setComAcumulador(true)
    setNovaEm('acumulador')
  }
  const mudarAcumulador = (definicao: AcumuladorDaFicha) => onMudarCartao({ ...cartao, acumulador: acumuladorParaGuardar(definicao) })
  const tirarAcumulador = () => {
    setComAcumulador(false)
    setNovaEm(null)
    const { acumulador: _fora, ...sem } = cartao
    onMudarCartao(sem, acumulador === undefined ? undefined : `O medidor ${acumulador.nome} saiu deste cartão.`)
  }

  const entradaDoAcumulador = REGISTRO_DAS_PECAS.acumulador
  return (
    <>
      {(pecas.length > 0 || mostraAcumulador) && (
        <div className="lb-ed__pecas">
          {pecas.map((peca, indice) => {
            const entrada = entradaDaPeca(peca.tipo)
            const { Componente } = entrada
            return (
              <MolduraDaPeca
                // A família e a posição: subir e descer trocam a peça de lugar sem perder o que ela tem na tela.
                key={`${peca.tipo}-${indice}`}
                id={`${prefixo}-peca-${indice}`}
                entrada={entrada}
                aviso={avisoDaPeca(peca, mecanica)}
                nova={novaEm === indice}
                {...(indice > 0 ? { onSubir: () => mover(indice, indice - 1) } : {})}
                {...(indice < pecas.length - 1 ? { onDescer: () => mover(indice, indice + 1) } : {})}
                onTirar={() => tirar(indice)}
              >
                <Componente peca={peca} mecanica={mecanica} aoMudar={(nova) => trocarNa(indice, nova)} aoMudarAMecanica={(nova) => onMudar(nova)} arredores={arredores} />
              </MolduraDaPeca>
            )
          })}
          {mostraAcumulador && entradaDoAcumulador !== undefined && (
            <MolduraDaPeca entrada={entradaDoAcumulador} nova={novaEm === 'acumulador'} onTirar={tirarAcumulador} id={`${prefixo}-peca-acumulador`}>
              <entradaDoAcumulador.Componente acumulador={acumulador} aoMudar={mudarAcumulador} arredores={arredores} />
            </MolduraDaPeca>
          )}
        </div>
      )}
      <div className="lb-ed__por-peca" role="group" aria-label="Pôr peça">
        <p className="lb-ed__por-peca-tit">Pôr peça</p>
        <div className="lb-ed__tipos-peca">
          {ORDEM_NA_TELA.map((familia) => {
            if (familia === 'acumulador') {
              if (entradaDoAcumulador === undefined) return null
              return <BotaoDoCatalogo key={familia} entrada={entradaDoAcumulador} motivo={mostraAcumulador ? 'O cartão já tem o medidor: edite na lista.' : null} onPor={porAcumulador} />
            }
            const entrada = entradaDaPeca(familia)
            return <BotaoDoCatalogo key={familia} entrada={entrada} motivo={motivoDeNaoCaber(familia, pecas)} onPor={() => por(familia)} />
          })}
        </div>
      </div>
    </>
  )
}

interface EntradaNoCatalogo {
  nome: string
  faz: string
  icone: string
  cor: string
  novo: boolean
}

/** Um botão do "Pôr peça": medalhão, nome (com "novo"), a frase do que faz. Apagado, diz por quê. */
function BotaoDoCatalogo({ entrada, motivo, onPor }: { entrada: EntradaNoCatalogo; motivo: string | null; onPor: () => void }) {
  const pintar = useVariavelCss('--cor-peca', entrada.cor)
  return (
    <button ref={pintar} type="button" className="lb-ed__tipo-peca" disabled={motivo !== null} title={motivo ?? undefined} onClick={onPor}>
      <span className="lb-pc__med lb-pc__med--p" aria-hidden="true">
        <Glifo nome={entrada.icone} />
      </span>
      <b>
        {entrada.nome}
        {entrada.novo && <span className="lb-ed__selo-novo">novo</span>}
      </b>
      <small>{motivo ?? entrada.faz}</small>
    </button>
  )
}

/** O medalhão de uma família (o "Começar de um modelo" mostra a peça que o modelo novo traz). */
export function MedalhaoDaPeca({ familia }: { familia: FamiliaDaPeca }) {
  const entrada = entradaDaPeca(familia)
  const pintar = useVariavelCss('--cor-peca', entrada.cor)
  return (
    <span ref={pintar} className="lb-pc__med lb-pc__med--p" aria-hidden="true">
      <Glifo nome={entrada.icone} />
    </span>
  )
}
