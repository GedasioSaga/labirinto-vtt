# Rework das condições: o que ficou aberto (depois da E8)

Fonte: os relatórios das etapas E1 a E8 do workflow de 27/11/2026 e a conferência da E8. Cada linha diz onde mexer.
"Grande" = precisa de uma etapa própria; "pequena" = cabe numa peça curta.

## Fechadas na E8

- `lib/condicoes/pastilhas.ts`: `mesmaPastilha` agora compara o `desenho`. Antes, trocar só o desenho de uma criada não reenviava a pastilha ao jogador.
- `components/condicoes/editor/BonecoDaCondicao.tsx`: o boneco joga com o motor da E5 (`ensaiarCondicao`) por padrão. Antes, nenhuma tela passava o motor, e o boneco dizia "o motor ainda não chegou".
- `components/batalha/BatalhaDoMestre.tsx`: os lembretes do mestre recebem os selos da cena, e o "Tentar sair" e o Escudo saem com o texto certo.
- `lib/batalha/registro.ts`: o Desfazer devolve o lembrete "Tentar sair" (`lembreteVale`).
- `components/batalha/editor/ColunaDoPapel.tsx` e `components/livros/biblioteca/LadoDaEscolhida.tsx`: o pedaço do papel mostra a frase da condição no `title`.
- `main.tsx`: o import de `condicoesDoApp` registra as criadas nos seletores, sem depender de outra tela importar.

## Fechadas em 27/11/2026 (recuperação e pendências)

- Nº 4: `porCondicao` (`lib/condicoes/naFicha.ts`) segue a entrada da batalha: a Contra-condição apaga ao entrar e impede enquanto dura; "se ganhar de novo" soma pilha até o teto (o prazo fica) ou não muda nada.
- Nº 6: todo selo que a store cria nasce por `criarSeloComACondicao` (`stores/batalha/selos.ts`): o gatilho e a ligada (`nucleo.ts`), a preparação, a passiva, o "Ajustar" e o contador (`passivas.ts`) e o cansaço (`comOCansaco` recebe a função, `formas.ts`).
- Nº 8: vale o motor. `BONECO_BASE.mod` saiu (ninguém lia e dava +2); o modificador é o `modificadorDoTeste` (metade do rank).
- Nº 9: a duração do item vai até 10 em todo lugar: `duracaoLida` e `pecaDoEfeitoGuardado` por `ehDuracaoDaPeca`; as telas por `TURNOS_DA_PECA`, `duracaoDoTexto` e `rotuloDaDuracao` (`lib/itens/modelo.ts`).
- Nº 10: "Virar condição nova" abre o `EditorDaCondicao` com o rascunho e o "Confira"; o lugar só troca de condição depois do Salvar (`VirarCondicaoNova` com `aoVirar`).
- Nº 11: `alvosDaOrdem` (`mesaDoMestre.ts`) passa os selos de cada alvo; a mira do mestre e a janela da batalha (`espelhoOP.ts`, que monta por ali) deixam o Invisível cinza.
- Nº 12: com "Não pode usar técnica", as técnicas de reação ficam cinza com o motivo do host (`reacoesComOBloqueio`, no mestre e no jogador).
- Nº 13: renomear troca o prazo do token pelo nome novo (`trocarCondicaoPropriaNasFichas`) e os selos das batalhas ligadas (`renomearSelos` da store, `renomearSelosNasBatalhas`); o Desfazer volta os dois.
- Nº 21: o marcador Condições conta a lista da página (`catalogoDeCondicoes`), não as fichas com condição.
- Fora da lista: o "Recupera por turno" aplica as duas linhas (Vida e SP) no começo da vez (`ajustesDaRecuperacao`, `textoDaRecuperacaoGravada`); `ajusteDaRecuperacao`, `quantoDaRecuperacao` e `siglaDaRecuperacao` saíram.

Ainda abertas: 1, 2, 3, 5 e 7 (as notas de cada uma dizem o próximo passo), 14 a 20 (pequenas) e 22 e 23 (E9).

## Grandes (uma etapa cada)

1. **Aberta.** **Aura (D9) não existe.** A peça Aura é salva, mas não age. Faltam `lib/batalha/aura.ts`, `pixi/drawAuras.ts` e a linha em `pixi/PixiCanvas.tsx` (E5).
2. **Aberta.** **Fora da batalha (D11)**: falta o turno fora da batalha ler as peças (`lib/turnoForaDaBatalha.ts`, `stores/turnoForaDaBatalha.ts`). Hoje valem só a vida por vez, o "depois de X turnos" e o prazo (E5).
3. **Aberta.** **Ritmo do Muda atributo na ficha**: o "a cada vez / a partir de" só age nos selos da batalha, não na condição posta na ficha (`lib/batalha/transformacao.ts`, `stores/batalha/condicoesNaFicha.ts`) (E5).
4. **Feita 27/11.** **Contra e pilhas no `porCondicao`** (`lib/condicoes/naFicha.ts`): na ficha, fora da batalha, o Molhado não apaga o Queimando, e pôr de novo não soma pilha (E5).
5. **Aberta.** **Partes do motor a conferir ou fazer**: `regras.quedasAMais` (e o % delas), `regras.ficaEm` diferente de 0 e `regras.noMaximo`. O regenera do fim não dispara a saída "ao receber cura". O `n` próprio da condição posta pelo gatilho é ignorado. O gatilho põe a condição sem recalcular as pilhas (`comPilhasDaMesa` é privado). "Pagar a ação" não marca o gasto da vez: o Enraizado sai pagando a Simples sem gastá-la (E3/E5).

## Médias

6. **Feita 27/11.** **Selos criados crus** (sem passar por `pedidoComACondicao` / `seloPostoNaFicha`): `stores/batalha/nucleo.ts:62` e `:222`, `stores/batalha/passivas.ts:154`, `:304`, `:562` e `:641`, `lib/batalha/recursosDaBatalha.ts:69` (o cansaço). Um selo com nome de condição posto por esses caminhos não congela a regra.
7. **Aberta.** **Vida em % no começo** aplica sozinha, sem o Aplicar, porque `danoPorVezDoSelo` só conhece vida fixa (E3/E5). Próximo passo: `ehDoAplicar` e `vidaNoComecoDaVez` (`lib/batalha/condicoes.ts`, `condicoesNaVez.ts`) aceitarem `pctMax`/`pctAtual`, e o lembrete do Aplicar calcular o número com `quantoDoEfeito` e a vida da ficha na hora.
8. **Feita 27/11 (a parte do `mod`).** **Boneco**: o golpe não passa pelo % de dano recebido nem pela marca; o "bate" não passa pelo % de dano causado; não tem Aura. `BONECO_BASE.mod` (`components/condicoes/editor/registro.ts`) dá +2 e o motor dá a metade do rank (Resistência 20 = +0): decidir qual vale.
9. **Feita 27/11.** **Duração até 10 no item**: o leitor `lib/itens/pecasDoItem.ts` (`duracaoLida`, `inteiro(efeito.duracao, 1, 3)`) ainda corta em 3. Também cortam em 3: `DURACOES_NO_EDITOR` (`editorDoItem.ts`), `DURACOES` (`components/condicoes/editor/pecas/PecaGatilho.tsx`), `LinhaDoGatilho.tsx:40` e `ItemDoCatalogoDialog.tsx:416`. Até lá, "o prazo dela" de uma condição com mais de 3 turnos não chega ao item.
10. **Feita 27/11.** **"Virar condição nova"** (`components/batalha/editor/pecas/condicoesDoApp.ts`): grava direto na lista. Deveria abrir o `EditorDaCondicao` com o rascunho, e as linhas de "Confira" aparecerem lá.
11. **Feita 27/11.** **Mira do mestre sem bloqueio de alvo**: `components/batalha/mesaDoMestre.ts`, `BatalhaDoMestre.tsx` e `batalhaJanela/espelhoOP.ts` montam `DadosDoAlvo` sem `selos`. Por isso o Invisível só fica cinza na mira do jogador; o host recusa nos dois.
12. **Feita 27/11.** **Reação recusada calada**: com "Não pode usar técnica", a reação com técnica devolve `false` em `stores/batalha/golpe.ts` e a tela não diz o motivo.
13. **Feita 27/11.** **Renomear** não troca o nome nas criadas que vão inteiras nos tokens (`Token.condicoesProprias`) nem nos selos de uma batalha em andamento.

## Pequenas

14. A pílula da faixa (`components/batalha/dadosDaFaixa.ts`) mostra a frase só das de fábrica; a criada fica sem frase.
15. A lista do mapa solto mora no `localStorage`, sem cópia nem versão: o app de antes, no mesmo PC, a regravaria sem as peças.
16. Desenhos novos em 20 px (`lib/condicoesProprias.ts`, `DESENHOS_NOVOS`): a espiral vira um disco (sugestão: `espiral(1.6, 0.12, 0.86, 26)`); a raiz parece um boneco de palito; a boca calada e o olho riscado quase se confundem.
17. `components/CondicoesProprias.css`: as regras `.lb-cond-form*` do `FormDaCondicao` removido estão mortas.
18. O "Pôr selo…" da batalha oferece "Usar só a condição", mas não "Virar condição nova".
19. As constantes `NOME_DA_CURA_REDUZIDA`, `DANO_DO_SANGRAMENTO` e `CURA_REDUZIDA_PADRAO` (`lib/batalha/condicoes.ts`) ainda não saem da fábrica.
20. Para o apelido acender a pastilha ("Atordoada"), `apagarPeloNome` (`lib/condicaoPorNome.ts`) precisa aceitar o apelido na mesma mudança, senão a pastilha fica presa.
21. **Feita 27/11.** Livros › Condições: na jornada da E8, a aba mostrou "Condições 0" com uma criada já na lista. A conferir se o número conta outra coisa.

## Jogador (E9, só depois que a outra sessão fechar `net/protocol.ts`)

22. O lembrete "Tentar sair" não passa em `lib/batalha/vistaDoJogador.ts:791`, e `BatalhaDoJogador.tsx:325` não recebe os selos. O jogador dono ainda não tenta sair pela tela dele.
23. O jogador não recebe tipo, pilhas nem peças (`semARegra` só deixa passar o desenho). Por isso o bloqueio de uma condição criada não apaga o menu dele; o host recusa com o motivo.

## Verificação que ficou de fora da E8

- A suíte inteira não rodou: a tarefa mandou rodar só os 3 testes novos. Fica para antes da publicação, junto com `stores/condicoesPropriasStore.test.ts` e `lib/batalha/mecanica/selo.test.ts`, que as etapas não rodaram.
- `ux-driver medir` no editor e na batalha não rodou. A E6 mediu em jsdom: 45,6 ms no pior trecho.
- O `verificador-realidade` e a publicação da 0.6.7 rodam fora deste workflow.
- O teste 2 confere o Congelado (Impacto 30 vira 45, Fogo tira) pelas mesmas funções que o golpe chama (`reducoesDosSelos`, `selosQueSaemCom`), não por um golpe inteiro com tipo. Faltou uma ficha de teste com arma de tipo.
- O teste 3 confere o "só ação simples" do Lento no host (`motivoDoAgir`), não no menu.

## Provas da E8

- Testes: `client/src/stores/batalhaFabrica.condicoesNadaSome.test.ts`, `batalhaFabrica.condicoesPilhasEContra.test.ts` e `batalhaFabrica.condicoesBloqueioESaida.test.ts`, com 14 casos. Cada arquivo foi visto vermelho uma vez, com um número quebrado de propósito numa cópia apagada depois.
- Jornada só por cliques: `client/e2e/task-jornada-condicao-do-editor.spec.ts`. No Edge, ela passa por Livros › Condições › Sangrando › Usar como modelo, troca o nome e o número para 25, vê o boneco ir de −10 para −25, salva, põe pelo "Pôr selo…" da batalha e aplica o lembrete; o Pirata vai de 2000 para 1975.
- Prints: `docs/qualidade-de-vida/depois/rework-cond-01-livros-condicoes-com-o-filtro.png`, `rework-cond-02-editor-com-pecas-e-boneco.png` e `rework-cond-03-batalha-com-a-condicao-nova.png`.
