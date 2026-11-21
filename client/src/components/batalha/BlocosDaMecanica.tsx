import { BlocoDoAlvo } from './blocos/BlocoDoAlvo'
import { BlocoDoDano } from './blocos/BlocoDoDano'
import { BlocoDosEfeitos } from './blocos/BlocoDosEfeitos'
import { BlocoDoTeste } from './blocos/BlocoDoTeste'
import { BlocoDaAcao, BlocoDoCusto, BlocoDoUso } from './blocos/BlocosDoComeco'
import { BlocoDaReacao, BlocoDosLimites } from './blocos/BlocosDoFim'
import type { BlocosProps } from './blocos/controles'

export type { BlocosProps } from './blocos/controles'

/**
 * OS BLOCOS da tela de montar a mecânica (construtor, fatia C2; seção 3 do
 * plano), na ordem em que o motor resolve o golpe. Cada bloco é uma seção que
 * abre e fecha; fechada, o cabeçalho diz em frase o que está escolhido. Só
 * aparecem as peças que o motor já executa (C1): o que não executa não vira
 * botão, vira lembrete à mão. Desde a fase 5 (SISTEMA.md §8) é o degrau 3, o
 * Avançado, e cada bloco mora no seu arquivo em `./blocos/`.
 */
export function BlocosDaMecanica(props: BlocosProps) {
  return (
    <div className="lb-mec__blocos">
      {props.naArma !== true && <BlocoDoUso mecanica={props.mecanica} onChange={props.onChange} />}
      <BlocoDoCusto mecanica={props.mecanica} onChange={props.onChange} />
      {/* Fase 4: só no lugar da reação, a ação, o alvo, o teste e o dano da vez não existem. */}
      {props.mecanica.uso !== 'reacao' && (
        <>
          <BlocoDaAcao mecanica={props.mecanica} onChange={props.onChange} />
          <BlocoDoAlvo mecanica={props.mecanica} onChange={props.onChange} />
          <BlocoDoTeste mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
          <BlocoDoDano {...props} />
        </>
      )}
      <BlocoDosEfeitos mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDaReacao mecanica={props.mecanica} ficha={props.ficha} onChange={props.onChange} />
      <BlocoDosLimites mecanica={props.mecanica} onChange={props.onChange} />
    </div>
  )
}
