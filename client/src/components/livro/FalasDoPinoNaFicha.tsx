import { useEffect, useState } from 'react'
import { chaveDaFala, ETIQUETAS_DA_FALA, comFalas, falasDoPino, idDeFalaNova, novaFala } from '../../lib/falasDoPino'
import { caminhoDaFonte } from '../../lib/fonteNoPreludio'
import { preparoLigado } from '../../lib/preparo/chave'
import { lerPreludioParaAFicha } from '../../lib/vigiaDosPinosLigados'
import { abrirNoPreludio } from '../../preludio/janela/portaDaJanela'
import { useSituacaoDosPinosLigados, type PersonagemQueDiz } from '../../stores/colocacaoDoPreludio'
import { useMapStore } from '../../stores/mapStore'
import { dizerFalaAgora, nomesDe, useMesaDoPino } from '../../stores/mesaDoPino'
import type { EtiquetaDaFala, FalaDoPino } from '../../types/cenarioEFalas'
import type { FonteNoPreludio, Pin } from '../../types/map'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoSel, CampoTexto, type OpcaoDoSel } from '../grimorio/CampoTexto'
import { Nota } from '../grimorio/Nota'
import type { ShowPinNowCandidate } from '../ShowPinNowControls'
import { mudarPino } from './CenarioDoPinoNaFicha'

/*
 * "?" FALAS E PISTAS NA FICHA DO PINO (P5, protótipo de 15/11, fluxo 3): uma
 * lista curta de coisas para DIZER. Cada entrada nasce oculta; o mestre diz
 * ("Dizer agora", a todos da cena ou a um) ou marca "Livre". O jogador nunca
 * sabe quantas estão ocultas (`lib/falasDoPino.ts`).
 *
 * Do Prelúdio: a entrada ligada a uma seção mostra o texto só para ler (edita-se
 * lá; "Desligar" devolve o texto ao pino), e quem diz pode ser um Personagem
 * (o nome segue o verbete).
 */

const OPCOES_DA_ETIQUETA: readonly OpcaoDoSeg<EtiquetaDaFala>[] = ETIQUETAS_DA_FALA.map((etiqueta) => ({ valor: etiqueta, rotulo: etiqueta }))

/** O valor da lista de Personagens quando ninguém do Prelúdio diz (o nome é o que o mestre escreve). */
const SEM_PERSONAGEM = ''

export interface FalasDoPinoNaFichaProps {
  pinId: string
  /** Quem pode ouvir agora (conectado, com ficha, nesta cena); `null` = sem sala ou pino oculto. */
  candidatos: readonly ShowPinNowCandidate[] | null
}

/** Troca as entradas do pino num passo do desfazer; o "?" antigo vira lista na primeira mudança. */
function mudarFalas(pinId: string, mudar: (falas: readonly FalaDoPino[]) => FalaDoPino[]): void {
  mudarPino(pinId, (antes) => comFalas(antes, mudar(falasDoPino(antes))))
}

function mudarFala(pinId: string, falaId: string, mudar: (fala: FalaDoPino) => FalaDoPino): void {
  mudarFalas(pinId, (falas) => falas.map((fala) => (fala.id === falaId ? mudar(fala) : fala)))
}

/** A entrada sem a ligação à seção: o texto fica nela e passa a se editar aqui. */
function semFonte(fala: FalaDoPino): FalaDoPino {
  const { fonte: _fonte, ...comum } = fala
  return comum
}

/** A lista de quem diz: "ninguém do Prelúdio" e os Personagens; o escolhido que sumiu fica com o nome guardado. */
function opcoesDeQuemDiz(personagens: readonly PersonagemQueDiz[], fala: FalaDoPino, lido: boolean): OpcaoDoSel<string>[] {
  const opcoes: OpcaoDoSel<string>[] = [{ valor: SEM_PERSONAGEM, rotulo: 'Ninguém do Prelúdio' }, ...personagens.map((um) => ({ valor: um.id, rotulo: um.nome }))]
  const escolhido = fala.quemVerbeteId
  if (escolhido !== undefined && !personagens.some((um) => um.id === escolhido)) {
    opcoes.push({ valor: escolhido, rotulo: `${fala.quem ?? 'Personagem'} (${lido ? 'não achado no Prelúdio' : 'Prelúdio ainda não lido'})` })
  }
  return opcoes
}

interface TextoLigadoProps {
  fonte: FonteNoPreludio
  texto: string
  /** A situação da seção, contada por quem segue o Prelúdio; `undefined` = ainda não lida. */
  situacao: 'ok' | 'segredo' | 'sumiu' | undefined
  lido: boolean
  onDesligar: () => void
}

/** O texto da entrada ligada a uma seção do Prelúdio (P5): só leitura, com os avisos do pino ligado (P3). */
function TextoLigado({ fonte, texto, situacao, lido, onDesligar }: TextoLigadoProps) {
  return (
    <div className="lb-pino-ligado" role="group" aria-label="Texto do Prelúdio">
      <div className="lb-pino-ligado__de">Do Prelúdio · o jogador lê</div>
      <div className="lb-pino-ligado__caminho">{caminhoDaFonte(fonte)}</div>
      <p className="lb-pino-ligado__texto">{texto.trim() === '' ? 'A seção ainda não tem texto.' : texto}</p>
      {situacao === 'segredo' && <Nota>Esta seção virou segredo no Prelúdio. O jogador lê "Texto indisponível." até você tirar o segredo ou desligar a entrada.</Nota>}
      {situacao === 'sumiu' && <Nota>A fonte sumiu do Prelúdio (o verbete ou a seção foram apagados). O jogador lê a cópia guardada na entrada.</Nota>}
      {!lido && <Nota>O Prelúdio ainda não foi lido nesta janela: o jogador lê a cópia guardada na entrada.</Nota>}
      <Acoes>
        <Botao variante="latao" tamanho="p" onClick={() => abrirNoPreludio({ verbeteId: fonte.verbeteId, aba: null, secaoId: fonte.secaoId })}>
          Abrir no Prelúdio
        </Botao>
        <Botao variante="fantasma" tamanho="p" onClick={onDesligar}>
          Desligar
        </Botao>
      </Acoes>
    </div>
  )
}

/** A situação da seção de uma entrada: a do "?" antigo ligado mora no id do pino (P3), a da lista, na chave da entrada. */
function chaveDaSituacao(pin: Pin, fala: FalaDoPino): string {
  return Array.isArray(pin.falas) ? chaveDaFala(pin.id, fala.id) : pin.id
}

export function FalasDoPinoNaFicha({ pinId, candidatos }: FalasDoPinoNaFichaProps) {
  const pin = useMapStore((estado) => estado.map.pins.find((um) => um.id === pinId))
  const ditas = useMesaDoPino((estado) => estado.ditas[pinId])
  const situacoes = useSituacaoDosPinosLigados((estado) => estado.porPino)
  const lido = useSituacaoDosPinosLigados((estado) => estado.lido)
  const personagens = useSituacaoDosPinosLigados((estado) => estado.personagens)
  const [escolhendo, setEscolhendo] = useState<string | null>(null)
  const comPreludio = preparoLigado()
  // Escolher quem diz pede os Personagens: lê o Prelúdio nesta janela (uma vez, só com a chave ligada).
  useEffect(() => {
    if (comPreludio) lerPreludioParaAFicha()
  }, [comPreludio])
  if (pin === undefined || pin.kind !== 'interrogacao') return null
  const falas = falasDoPino(pin)
  const lista = candidatos ?? []
  const jogadores = useMesaDoPino.getState().acoes?.jogadores() ?? []

  const dizer = (falaId: string, ids: readonly string[] | null) => {
    if (dizerFalaAgora(pinId, falaId, ids).ok) setEscolhendo(null)
  }
  const adicionar = () => mudarFalas(pinId, (antes) => [...antes, novaFala(idDeFalaNova(), 'Fala', '')])
  const apagar = (falaId: string) => mudarFalas(pinId, (antes) => antes.filter((fala) => fala.id !== falaId))
  // Escrever o nome à mão solta o Personagem: senão o nome dele voltaria por cima no próximo acerto.
  const trocarQuem = (falaId: string, quem: string) =>
    mudarFala(pinId, falaId, (fala) => {
      const nova: FalaDoPino = { ...fala, quem }
      if (quem.trim() === '') delete nova.quem
      delete nova.quemVerbeteId
      return nova
    })
  const escolherPersonagem = (falaId: string, verbeteId: string) =>
    mudarFala(pinId, falaId, (fala) => {
      if (verbeteId === SEM_PERSONAGEM) {
        const nova: FalaDoPino = { ...fala }
        delete nova.quemVerbeteId
        return nova
      }
      const personagem = personagens.find((um) => um.id === verbeteId)
      if (personagem === undefined) return fala
      return { ...fala, quemVerbeteId: personagem.id, quem: personagem.nome }
    })
  const desligar = (falaId: string) => mudarFala(pinId, falaId, semFonte)
  const trocarLivre = (falaId: string) =>
    mudarFala(pinId, falaId, (fala) => {
      const nova: FalaDoPino = { ...fala, livre: true }
      if (fala.livre === true) delete nova.livre
      return nova
    })

  return (
    <div className="lb-falas-ficha" role="group" aria-label="Falas e pistas: o mestre diz">
      <p className="lb-cenario-ficha__ajuda">Cada entrada fica oculta até você dizer. Livre: qualquer um lê ao tocar. O jogador nunca vê quantas faltam.</p>
      {falas.length === 0 && <Nota>Nenhuma entrada ainda.</Nota>}
      <ol className="lb-falas-ficha__lista">
        {falas.map((fala, indice) => {
          const quemOuviu = ditas?.[fala.id] ?? []
          const estado = fala.livre === true ? 'livre' : quemOuviu.length > 0 ? `dita a ${nomesDe(quemOuviu, jogadores)}` : 'oculta'
          const podeDizer = candidatos !== null && lista.length > 0 && fala.texto.trim() !== ''
          return (
            <li key={fala.id} className="lb-falas-ficha__entrada" data-livre={fala.livre === true ? '' : undefined}>
              <div className="lb-falas-ficha__cabeca">
                <span className="lb-falas-ficha__numero">{indice + 1}</span>
                <em className="lb-falas-ficha__estado">{estado}</em>
              </div>
              <CampoSeg rotulo="Tipo" nomeAcessivel={`Tipo da entrada ${indice + 1}`} opcoes={OPCOES_DA_ETIQUETA} valor={fala.etiqueta} onChange={(etiqueta) => mudarFala(pinId, fala.id, (antes) => ({ ...antes, etiqueta }))} />
              {comPreludio && (
                <CampoSel rotulo="Personagem que diz" opcoes={opcoesDeQuemDiz(personagens, fala, lido)} valor={fala.quemVerbeteId ?? SEM_PERSONAGEM} onChange={(verbeteId) => escolherPersonagem(fala.id, verbeteId)} />
              )}
              {/* Com um Personagem escolhido, o nome é o dele (segue o verbete); sem a chave do Prelúdio, fica editável. */}
              {(fala.quemVerbeteId === undefined || !comPreludio) && (
                <CampoTexto id={`lb-fala-quem-${fala.id}`} rotulo="Quem diz" placeholder="Bento (opcional)" valor={fala.quem ?? ''} maxLength={60} onChange={(quem) => trocarQuem(fala.id, quem)} />
              )}
              {fala.fonte === undefined ? (
                <CampoTexto id={`lb-fala-texto-${fala.id}`} rotulo="O que diz · o jogador lê" valor={fala.texto} multilinha onChange={(texto) => mudarFala(pinId, fala.id, (antes) => ({ ...antes, texto }))} />
              ) : (
                <TextoLigado fonte={fala.fonte} texto={fala.texto} situacao={situacoes.get(chaveDaSituacao(pin, fala))} lido={lido} onDesligar={() => desligar(fala.id)} />
              )}
              <Acoes>
                <button type="button" className="lb-falas-ficha__livre" aria-pressed={fala.livre === true} onClick={() => trocarLivre(fala.id)}>
                  Livre
                </button>
                {podeDizer && escolhendo !== fala.id && (
                  <>
                    <Botao variante="primario" tamanho="p" onClick={() => dizer(fala.id, null)}>
                      Dizer agora
                    </Botao>
                    <Botao variante="latao" tamanho="p" onClick={() => setEscolhendo(fala.id)}>
                      Dizer a…
                    </Botao>
                  </>
                )}
                <Botao variante="fantasma" tamanho="p" onClick={() => apagar(fala.id)}>
                  Apagar
                </Botao>
              </Acoes>
              {podeDizer && escolhendo === fala.id && (
                <div className="lb-cenario-ficha__chips" role="group" aria-label="Dizer a quem">
                  {lista.map((c) => (
                    <button key={c.playerId} type="button" className="lb-cenario-ficha__chip" onClick={() => dizer(fala.id, [c.playerId])}>
                      <span className="lb-cenario-ficha__ponto" style={{ background: c.color }} aria-hidden="true" />
                      {c.name}
                    </button>
                  ))}
                  <button type="button" className="lb-cenario-ficha__chip" onClick={() => setEscolhendo(null)}>
                    Cancelar
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {candidatos === null && <Nota>Dizer agora precisa da sala aberta e do pino visível aos jogadores.</Nota>}
      {candidatos !== null && lista.length === 0 && <Nota>Nenhum jogador conectado está nesta cena.</Nota>}
      <Acoes>
        <Botao variante="latao" tamanho="p" onClick={adicionar}>
          Adicionar entrada
        </Botao>
      </Acoes>
    </div>
  )
}
