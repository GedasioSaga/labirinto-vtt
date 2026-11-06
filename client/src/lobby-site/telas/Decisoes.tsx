import { useEffect, useRef, useState } from 'react'
import { AvisoDeConflito, type EscolhaDoAviso } from '../../components/nuvem/AvisoDeConflito'
import type { EntradaDaFila } from '../../lib/nuvem/fila'
import type { MembroProjetado } from '../../lib/nuvem/tipos'
import type { Personagem } from '../../lib/personagem'
import type { SistemaDeRpg } from '../../lib/sistemaDeRpg'
import type { EscolhaDaDecisao, EstadoDaCampanha } from '../dados/sessaoDaCampanha'
import { useSite } from './contexto'
import { textoDaFalha } from './enviar'
import { enviouHaPouco, idDoAviso, marcarEnvio, pedirFocoNoAviso, tomarFocoPedido } from './foco'
import { motivoEmTexto, quandoRelativo, rotuloDoCaminho, valorDaMinha, valorEmTexto } from './textos'

/**
 * "PRECISAM DA SUA DECISÃO" de uma ficha, em lista acima dela (§5.2, §5.6 e
 * Si3: na v1 o aviso fica acima da ficha, não junto ao campo). Cada conflito
 * e cada negada vira o `AvisoDeConflito` da A6 (o mesmo das "Mudanças para
 * decidir" do app); a escolha vai à sessão da S2.
 */

/** Os botões do aviso no site: os dois iguais, como no protótipo (tela 5). */
const BOTAO_DO_AVISO = (): string => 'lo-btn'

interface DecisoesProps {
  campanha: EstadoDaCampanha
  ficha: Personagem
  sistema: SistemaDeRpg
}

/** Quem mudou primeiro, como a frase diz: "O mestre", "Você, em outro aparelho", "Caio". */
function quemMudou(nome: string, membros: readonly MembroProjetado[], eu: MembroProjetado | null): string {
  if (eu !== null && nome === eu.nome) return 'Você, em outro aparelho,'
  return membros.some((membro) => membro.papel === 'mestre' && membro.nome === nome) ? 'O mestre' : nome
}

interface TextoDaDecisao {
  tom: 'conflito' | 'negado'
  frase: string
  minha?: string
  detalhe: string
  /** As escolhas, da que mantém o servidor à que manda a minha. */
  opcoes: { rotulo: string; escolha: EscolhaDaDecisao; precisaDeRede: boolean }[]
}

function textoDaDecisao(entrada: EntradaDaFila, rotulo: string, campanha: EstadoDaCampanha, agora: number): TextoDaDecisao {
  const { op, situacao } = entrada
  const ficar: EscolhaDaDecisao = { t: 'ficar-com-a-atual' }
  const reenviar: EscolhaDaDecisao = { t: 'reenviar' }
  if (situacao.t === 'negado') {
    return {
      tom: 'negado',
      frase: `O servidor não aceitou a sua mudança em ${rotulo}: ${motivoEmTexto(situacao.motivo)}.`,
      detalhe: `${situacao.detalhe ?? 'Ela ficou guardada aqui.'} Enquanto você não decidir, a ficha mostra o seu valor com o aviso "não aceito pelo servidor".`,
      opcoes: [{ rotulo: 'Desfazer aqui', escolha: ficar, precisaDeRede: false }],
    }
  }
  // Só conflito e negada chegam aqui (o filtro de `Decisoes`); o resto não espera escolha.
  if (situacao.t !== 'conflito') return { tom: 'conflito', frase: `A sua mudança em ${rotulo} espera o servidor.`, detalhe: '', opcoes: [] }
  const { conflito } = situacao
  const quem = quemMudou(conflito.quem, campanha.membros, campanha.eu)
  const detalhe = `${conflito.quem} mudou primeiro, ${quandoRelativo(conflito.quando, agora)}. Escolha o que fica; nada muda até você escolher.`
  if (conflito.fichaApagada === true) {
    return { tom: 'conflito', frase: `${quem} apagou esta ficha antes da sua mudança em ${rotulo} chegar.`, detalhe, opcoes: [{ rotulo: 'Entendi, deixar como está', escolha: ficar, precisaDeRede: false }] }
  }
  if (conflito.porCausaDe !== undefined) {
    return {
      tom: 'conflito',
      frase: `A sua mudança em ${rotulo} ia junto com outra que bateu com a de ${conflito.quem}.`,
      detalhe,
      opcoes: [
        { rotulo: 'Deixar como está', escolha: ficar, precisaDeRede: false },
        { rotulo: 'Mandar a minha de novo', escolha: reenviar, precisaDeRede: true },
      ],
    }
  }
  const atual = conflito.valorAtual === undefined ? 'sem valor' : valorEmTexto(conflito.valorAtual)
  const minha = valorDaMinha(op)
  if (op.acao === 'somar') {
    return {
      tom: 'conflito',
      frase: `${quem} acabou de mudar ${rotulo} para ${atual}`,
      minha: `(você tinha somado ${minha})`,
      detalhe,
      opcoes: [
        { rotulo: `Ficar com ${atual}`, escolha: ficar, precisaDeRede: false },
        { rotulo: `Somar o meu também (${minha})`, escolha: reenviar, precisaDeRede: true },
      ],
    }
  }
  if (op.acao === 'definir') {
    return {
      tom: 'conflito',
      frase: `${quem} acabou de mudar ${rotulo} para ${atual}`,
      minha: `(você tinha posto ${minha})`,
      detalhe,
      opcoes: [
        { rotulo: `Ficar com ${atual}`, escolha: ficar, precisaDeRede: false },
        { rotulo: `Usar a minha (${minha})`, escolha: reenviar, precisaDeRede: true },
      ],
    }
  }
  return {
    tom: 'conflito',
    frase: `${quem} mexeu em ${rotulo} antes da sua mudança chegar.`,
    detalhe,
    opcoes: [
      { rotulo: 'Deixar como está', escolha: ficar, precisaDeRede: false },
      { rotulo: 'Mandar a minha de novo', escolha: reenviar, precisaDeRede: true },
    ],
  }
}

interface AvisoNaFichaProps {
  opId: string
  onde: string
  texto: TextoDaDecisao
  online: boolean
  ocupado: boolean
  erro: string | null
  /** Acabou de chegar: entra uma vez, com movimento (os re-renders seguintes não repetem). */
  novo: boolean
  aoEscolher: (escolha: EscolhaDaDecisao) => void
}

/**
 * Um aviso na lista: a casca do site (o foco pedido pelo "Ver" da faixa, a
 * entrada com movimento) em volta do aviso puro da A6. Sem internet, a escolha
 * que manda a sua de novo sai da lista, com o motivo escrito embaixo.
 */
function AvisoNaFicha({ opId, onde, texto, online, ocupado, erro, novo, aoEscolher }: AvisoNaFichaProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (tomarFocoPedido(opId)) ref.current?.focus()
  })
  const presas = texto.opcoes.filter((opcao) => opcao.precisaDeRede && !online)
  const escolhas: EscolhaDoAviso[] = texto.opcoes
    .filter((opcao) => !presas.includes(opcao))
    .map((opcao) => ({ rotulo: opcao.rotulo, onEscolher: () => aoEscolher(opcao.escolha) }))
  return (
    <div ref={ref} className="lo-conflito" data-tom={texto.tom} data-novo={novo ? '1' : undefined} tabIndex={-1} id={idDoAviso(opId)}>
      <AvisoDeConflito
        tom={texto.tom}
        onde={onde}
        titulo={texto.minha === undefined ? texto.frase : `${texto.frase} ${texto.minha}`}
        detalhe={texto.detalhe === '' ? undefined : texto.detalhe}
        escolhas={escolhas}
        ocupado={ocupado}
        erro={erro}
        classeDoBotao={BOTAO_DO_AVISO}
      />
      {presas.length > 0 && <p className="lo-motivo lo-conflito__motivo">Sem internet: “{presas.map((opcao) => opcao.rotulo).join('”, “')}” volta quando a conexão voltar.</p>}
    </div>
  )
}

export function Decisoes({ campanha, ficha, sistema }: DecisoesProps) {
  const site = useSite()
  const [erro, setErro] = useState<{ opId: string; texto: string } | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const daFicha = campanha.paraDecidir.filter((entrada) => entrada.op.fichaId === ficha.id && (entrada.situacao.t === 'conflito' || entrada.situacao.t === 'negado'))
  // O que já estava aqui quando a tela abriu não "chega" de novo: só o novo entra com movimento.
  const vistos = useRef<Set<string> | null>(null)
  if (vistos.current === null) vistos.current = new Set(daFicha.map((entrada) => entrada.op.opId))
  const jaVistos = vistos.current
  // O aviso que responde a um envio desta tela (o Salvar, o −/+) leva o foco; o resto só é anunciado.
  const primeiroNovo = daFicha.find((entrada) => !jaVistos.has(entrada.op.opId))
  if (primeiroNovo !== undefined && enviouHaPouco()) pedirFocoNoAviso(primeiroNovo.op.opId)
  useEffect(() => {
    for (const entrada of daFicha) jaVistos.add(entrada.op.opId)
  })

  if (daFicha.length === 0) return null
  const online = campanha.conexao === 'em-dia'
  const agora = Date.now()

  function escolher(opId: string, escolha: EscolhaDaDecisao) {
    const sessao = site.sessao()
    if (sessao === null) return
    setErro(null)
    setEnviando(opId)
    if (escolha.t !== 'ficar-com-a-atual') marcarEnvio()
    sessao.resolver(opId, escolha).then(
      (resultado) => {
        setEnviando(null)
        if (!resultado.ok) {
          setErro({ opId, texto: textoDaFalha(resultado) })
          return
        }
        // O aviso decidido some com o botão focado: o foco vai ao próximo aviso, ou volta à ficha.
        requestAnimationFrame(() => {
          if (document.activeElement !== null && document.activeElement !== document.body) return
          const destino = document.querySelector<HTMLElement>('.lo-conflito') ?? document.querySelector<HTMLElement>('.pp-ficha') ?? document.getElementById('conteudo')
          destino?.focus()
        })
      },
      (falha: unknown) => {
        setEnviando(null)
        setErro({ opId, texto: `Não deu para guardar a escolha neste navegador: ${falha instanceof Error ? falha.message : String(falha)}` })
      },
    )
  }

  return (
    <div className="lo-decisoes" aria-live="polite">
      {daFicha.map((entrada) => {
        const { opId } = entrada.op
        const rotulo = rotuloDoCaminho(sistema, ficha, entrada.op.caminho, entrada.op.valor)
        return (
          <AvisoNaFicha
            key={opId}
            opId={opId}
            onde={ficha.nome}
            texto={textoDaDecisao(entrada, rotulo, campanha, agora)}
            online={online}
            ocupado={enviando === opId}
            erro={erro?.opId === opId ? erro.texto : null}
            novo={!jaVistos.has(opId)}
            aoEscolher={(escolha) => escolher(opId, escolha)}
          />
        )
      })}
    </div>
  )
}
