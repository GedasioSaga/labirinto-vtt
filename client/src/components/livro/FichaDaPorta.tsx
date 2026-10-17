import { useId, useSyncExternalStore, type ReactNode } from 'react'
import type { DoorKind, DoorSide, DoorState } from '../../types/map'
import { assinarAnimacoesDePorta, listarAnimacoesDePorta, type AnimacaoDePorta } from '../../portas/animacoesDePorta'
import { useLivroDoMestreStore } from '../../stores/livroDoMestreStore'
import { Acoes, Botao } from '../grimorio/Botao'
import { CampoSeg, type OpcaoDoSeg } from '../grimorio/CampoSeg'
import { CampoSel, type OpcaoDoSel } from '../grimorio/CampoTexto'
import { Essencial } from '../grimorio/Cartoes'
import { Fichas } from '../grimorio/Ficha'
import { Nota } from '../grimorio/Nota'
import { DOOR_KIND_OPTIONS } from '../DoorKindControls'
import { BotaoProcurarAnimacoes } from '../ProcurarAnimacoes'
import { Toggle } from '../Toggle'
import { DoorKeyField, type WallDoorControlsProps } from '../WallDoorControls'
import { FichaLembrada, type FichaLembradaProps } from './FichaLembrada'
import { IconeDoLivro } from './icones'
import './fichaDaPorta.css'

/*
 * FICHA DA PORTA (fatia 11 do design consolidado, docs/design/consolidado/PLANO.md):
 * abaixo da cabeça (a medalha com a folha que gira), o bloco essencial —
 * Estado, Trancada, Secreta com "Revelar passagem" e Espiar — e as fichas
 * recolhidas Quem abre, Aparência, Parede em volta e Depende do estado. "Virar
 * parede sólida", "Abrir agora" e "Trancar" moram no "Mais ações" da cabeça
 * (`doorActions`). Os controles e os handlers são os de antes: muda o lugar e
 * o visual. A "Animação ao abrir" é um seletor (decisão 2 do plano): Sem
 * animação, Girar, Deslizar e as do pacote.
 */

/** Chave da escolha lembrada de cada ficha: a família `lb-section:<id>` das seções recolhíveis. */
const PREFIXO_LEMBRADO = 'lb-section:ficha-porta-'

export interface FichaDaPortaProps extends Omit<WallDoorControlsProps, 'door' | 'onToggleDoor'> {
  door: DoorState
  /** Tipo da porta selecionada (`setWallDoorKind`, com histórico). */
  onKindChange: (kind: DoorKind) => void
  /** O bloco "Parede" da parede em que a porta mora (espessura e estilo). */
  paredeEmVolta?: ReactNode
  /** "Depende do estado" (`EstadoDaPorta`): só com uma aventura aberta. */
  estadoDaPorta?: ReactNode
}

type Estado = 'aberta' | 'fechada'
const OPCOES_DO_ESTADO: readonly OpcaoDoSeg<Estado>[] = [
  { valor: 'aberta', rotulo: 'Aberta', icone: <IconeDoLivro nome="portaAberta" /> },
  { valor: 'fechada', rotulo: 'Fechada', icone: <IconeDoLivro nome="portaFechada" /> },
]

type Lados = 'dois' | 'um'
const OPCOES_DO_LADO: readonly OpcaoDoSeg<Lados>[] = [
  { valor: 'dois', rotulo: 'Os dois lados' },
  { valor: 'um', rotulo: 'Só deste lado' },
]

const OPCOES_DO_TIPO: readonly OpcaoDoSeg<DoorKind>[] = DOOR_KIND_OPTIONS.map((opcao) => ({ valor: opcao.kind, rotulo: opcao.label }))

/** Lado que "Só deste lado" liga primeiro; "Trocar o lado" inverte. */
const PRIMEIRO_LADO: DoorSide = 'right'

function outroLado(lado: DoorSide): DoorSide {
  return lado === 'right' ? 'left' : 'right'
}

/** Valor de "Sem animação" na lista: fora da forma de id, não colide com nenhuma animação. */
const SEM_ANIMACAO = ''

/**
 * Quem abre, numa palavra e sem mentir: trancada, só quem tem o item (ou o
 * mestre); destrancada, qualquer jogador encostado, de um lado ou dos dois.
 */
function resumoDeQuemAbre(door: DoorState): string {
  if (door.locked) return door.abreCom?.trim() || 'Só o mestre'
  return door.opensFrom === undefined ? 'Os dois lados' : 'Só deste lado'
}

function resumoDaAparencia(door: DoorState, animacoes: readonly AnimacaoDePorta[]): string {
  const tipo = OPCOES_DO_TIPO.find((opcao) => opcao.valor === door.kind)?.rotulo ?? 'Normal'
  if (door.animacao === undefined) return `${tipo}, sem animação`
  return animacoes.some((animacao) => animacao.id === door.animacao) ? tipo : `${tipo}, animação não instalada`
}

/** Ficha da porta com a escolha lembrada: todas nascem fechadas, como no protótipo. */
function FichaDaPortaLembrada(props: Omit<FichaLembradaProps, 'prefixo' | 'padrao'>) {
  return <FichaLembrada prefixo={PREFIXO_LEMBRADO} padrao={false} {...props} />
}

export function FichaDaPorta({
  door,
  onToggleOpen,
  onToggleLocked,
  onToggleSemEspiar,
  onToggleSecret,
  onRevealPassage,
  onKeyChange,
  onOpensFromChange,
  onAnimacaoChange,
  onKindChange,
  paredeEmVolta,
  estadoDaPorta,
}: FichaDaPortaProps) {
  const secretaAjudaId = `${useId()}-secreta`
  const animacoes = useSyncExternalStore(assinarAnimacoesDePorta, listarAnimacoesDePorta)
  const secreta = door.secret === true
  const lado = door.opensFrom
  const umLado = lado !== undefined
  return (
    <div className="lb-ficha-da-porta">
      <Essencial>
        <CampoSeg
          rotulo="Estado"
          opcoes={OPCOES_DO_ESTADO}
          valor={door.open ? 'aberta' : 'fechada'}
          onChange={(estado) => {
            // O handler alterna: só chama quando a escolha muda o estado.
            if ((estado === 'aberta') !== door.open) onToggleOpen()
          }}
        />
        <Toggle label="Trancada" checked={door.locked} onChange={onToggleLocked} />
        {/* A ajuda fica na linha da Secreta, embaixo do rótulo (o liga com ajuda do protótipo), e fora do <label>: o nome do interruptor segue "Secreta". */}
        <div className="lb-switch-com-ajuda">
          <Toggle label="Secreta" checked={secreta} onChange={onToggleSecret} describedBy={secretaAjudaId} />
          <p id={secretaAjudaId} className="gr-nota">
            Os jogadores veem parede até você revelar.
          </p>
        </div>
        {secreta && (
          <Acoes>
            <Botao variante="latao" tamanho="p" onClick={onRevealPassage}>
              <IconeDoLivro nome="olho" />
              Revelar passagem
            </Botao>
          </Acoes>
        )}
        {/* Na porta secreta não há o que espiar: para o jogador ela é parede. */}
        {!secreta && <Toggle label="Jogador pode espiar" checked={door.semEspiar !== true} onChange={onToggleSemEspiar} />}
      </Essencial>
      <Fichas>
        <FichaDaPortaLembrada id="quem-abre" titulo="Quem abre" icone="chave" resumo={resumoDeQuemAbre(door)}>
          {/* "Abre com" só vale para a porta trancada: destrancada, qualquer jogador encostado abre. */}
          {door.locked && onKeyChange !== undefined && (
            <DoorKeyField value={door.abreCom ?? ''} onChange={onKeyChange} placeholder="Vazio: só o mestre abre" />
          )}
          <CampoSeg
            rotulo="Abre por"
            opcoes={OPCOES_DO_LADO}
            valor={umLado ? 'um' : 'dois'}
            onChange={(lados) => {
              if ((lados === 'um') === umLado) return
              onOpensFromChange(lados === 'um' ? PRIMEIRO_LADO : null)
            }}
          />
          <Nota>{umLado ? 'A seta no mapa mostra o lado que abre. Do outro, o jogador lê "Não abre deste lado".' : 'Qualquer jogador encostado abre.'}</Nota>
          {lado !== undefined && (
            <Acoes>
              <Botao onClick={() => onOpensFromChange(outroLado(lado))}>
                <IconeDoLivro nome="troca" />
                Trocar o lado
              </Botao>
            </Acoes>
          )}
        </FichaDaPortaLembrada>
        <FichaDaPortaLembrada id="aparencia" titulo="Aparência" icone="porta" resumo={resumoDaAparencia(door, animacoes)}>
          <CampoSeg
            rotulo="Tipo de porta"
            opcoes={OPCOES_DO_TIPO}
            valor={door.kind}
            onChange={(kind) => {
              if (kind !== door.kind) onKindChange(kind)
            }}
          />
          {onAnimacaoChange !== undefined && <AnimacaoAoAbrir animacao={door.animacao} animacoes={animacoes} onAnimacaoChange={onAnimacaoChange} />}
        </FichaDaPortaLembrada>
        {paredeEmVolta !== undefined && (
          <FichaDaPortaLembrada id="parede" titulo="Parede em volta" icone="parede">
            {paredeEmVolta}
          </FichaDaPortaLembrada>
        )}
        {estadoDaPorta !== undefined && (
          <FichaDaPortaLembrada id="estado" titulo="Depende do estado" icone="pulso" resumo={door.porEstado === undefined ? 'Sempre' : 'Muda com o estado'}>
            {estadoDaPorta}
            <Nota ir={{ rotulo: 'Ir para Aventura', onClick: (evento) => useLivroDoMestreStore.getState().abrirPagina('aventura', evento.detail > 0) }}>
              Os valores vêm do Estado do mundo, no marcador Aventura.
            </Nota>
          </FichaDaPortaLembrada>
        )}
      </Fichas>
    </div>
  )
}

/**
 * PORTA ANIMADA: "Animação ao abrir". A lista vem do registro e acompanha as
 * que chegarem depois (pacote baixado) sem reabrir o painel. Id gravado que
 * este app não conhece (pacote ainda não baixado) aparece como opção própria
 * em vez de virar "Sem animação" calado: a lista não mente sobre o mapa, e
 * escolher outra coisa é que troca o campo.
 */
function AnimacaoAoAbrir({
  animacao,
  animacoes,
  onAnimacaoChange,
}: {
  animacao: string | undefined
  animacoes: readonly AnimacaoDePorta[]
  onAnimacaoChange: (id: string | null) => void
}) {
  const desconhecida = animacao !== undefined && !animacoes.some((a) => a.id === animacao)
  const opcoes: OpcaoDoSel<string>[] = [
    { valor: SEM_ANIMACAO, rotulo: 'Sem animação' },
    ...animacoes.map((a) => ({ valor: a.id, rotulo: a.nome })),
    ...(desconhecida ? [{ valor: animacao, rotulo: `Não instalada (${animacao})` }] : []),
  ]
  return (
    <>
      <CampoSel rotulo="Animação ao abrir" opcoes={opcoes} valor={animacao ?? SEM_ANIMACAO} onChange={(id) => onAnimacaoChange(id === SEM_ANIMACAO ? null : id)} />
      <BotaoProcurarAnimacoes />
    </>
  )
}
