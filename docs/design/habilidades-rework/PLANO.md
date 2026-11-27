# Plano de construção: rework do editor de habilidades (versão 0.6.5)

Fontes: pedidos literais em `PEDIDOS.md` (26/11 22:40 a 23:23), protótipo aprovado `prototipo.html` (6cc7a401: 17 decisões da aba "Como era x como fica" e a tabela "Tudo o que já existia", 34 linhas) e o mapa do código `MAPA.md` (217a827), que tem os arquivo:linha citados aqui. Regras do dono: plano aplicado sem perguntar (as decisões abaixo são do Claude e valem como recomendadas); Opus xhigh, Opus max no que é complexo; nenhum teste durante a construção, 1 a 3 testes certeiros no fim, com prints; publicar quando completo. Caminhos relativos a `client/src/`.

## 0. Respostas diretas

- **O Worker precisa sair junto? Sim, só o deploy.** Ele embute o motor da batalha (Arena e duelo puxam `lib/treino/duelo.ts`); nenhum arquivo de `lobby/nuvem/src` muda. Publicar pelo caminho normal, `node scripts/publicar-versao.cjs --publicar`, que manda Worker, depois Pages, depois o release (MAPA §4.1). Sem o Worker novo, a Arena lê a técnica nova como "atualize o app" e a faz à mão. `VERSAO_DO_MOTOR_DA_LUTA` não sobe: o estado só ganha campos opcionais.
- **Algo exige tocar `net/protocol.ts`? Não.** Nem `net/protocoloDaBatalha.ts`. As peças viajam dentro de `cartao.mecanica` (opaca no fio); as respostas da pergunta e do imbuir vão no `respostas` que já existe; o estado novo da batalha é só do host; "técnica ligada" chega ao jogador pelo `passivasAtivas` que já vai no recorte (D7). Os dois arquivos ficam fora de todas as etapas. Se a prova da E8 mostrar o jogador sem um dado, a E9 (isolada, marcada) entra depois que a outra sessão fechar `net/protocol.ts`.

## 1. Decisões de arquitetura (do Claude, aplicadas)

- **D1. Formato.** `mecanica` versão 5 = a 4 com mais peças: `uso` ganha `passiva` e `manter` ("Ligar e manter"); `pecas` guarda as famílias do protótipo (`pergunta`, `imbuir`, `gatilho`, `raca`, `transformacao`, `status`, `diminui`, `marca`, `invocacao`, `devolve`). `precisaDaVersao5` só com essas peças ou esses usos: o resto continua gravado como 1 a 4 e roda no app de antes. Tipos e leitor num arquivo novo, `lib/batalha/mecanica/pecas.ts`, chamado por `lerMecanica`; peça desconhecida = inválida (tudo ou nada, como hoje). A peça guarda só o que difere do padrão de `pecaNova` do protótipo.
- **D2. Nada novo fora da `mecanica`.** O leitor do cartão apaga chave desconhecida no app velho, no fio e no Worker (MAPA §1.3). Continuam onde estão: `requisitos`, `marcas`, `alcance`, `acumulador`, `modificadores`, `imagem`, `subcartoes`, `extras`.
- **D3. Executar é traduzir.** As peças viram campos de `MecanicaAMao` em `mecanica/leitura.ts`: os que existem (`perguntas`, `respostasMudam`, `emTodoGolpe`, `raca`, `golpesSaoOverload`, `duraVezesDoDono`, `seloEmQuemUsa`, `selosAMais`, `avisoAoCair`, `rebate`) e os novos (`imbuir`, `gatilhos`, `diminui`, `forma`). O motor nunca lê peça crua, como hoje.
- **D4. Busca pelo cartão.** `chavesDoDono` devolve `ChaveDaMecanica[]` (o cartão; `raca:` e `ficha:` seguem texto) e as funções que leem `cartoesAtivos` recebem os cartões ligados (MAPA §4.3). Cartão com linha na tabela à mão nunca é montado pela conversão.
- **D5. A forma continua morando na aba Transformações** (`cartoesAtivos`, subcartões, Arena, site e app de antes seguem lendo). A peça Transformação mora na `mecanica` da forma; gravar gera os campos de texto de antes (Ação, Custo, Duração, Usos, Ataques extras, Dano recebido, Deslocamento, Grupo) e os `modificadores`. Na ficha, as duas abas viram uma lista só, com o filtro Transformações (decisão 16). Pôr a peça numa habilidade passa o cartão para a aba Transformações ao salvar (mesmo id); tirar, volta.
- **D6. Passiva com peças** (decisão 4): `uso: 'passiva'`; `lerTipo`, `ehPassiva`, a categoria e o texto gerado aceitam a passiva montada; a de texto segue como hoje. "Dispara sozinha" sem "Pergunta antes de disparar" aplica na hora, com linha no registro e Desfazer, pelo MESMO caminho do Ativar de hoje; com a pergunta, é o lembrete de hoje.
- **D7. "Ligar e manter"** (decisão 5) = a técnica mantida de hoje (`custoPorTurno.ts`, `stores/batalha/formas.ts:387`) com custo por vez opcional, mais um selo no dono (`donoId` + `cartaoId`) enquanto ligada. Por ele o navegador do jogador sabe que está ligada (`passivasAtivas`, `lib/batalha/vistaDoJogador.ts:790`), porque o `mantidas` não vai ao jogador. O Imbuir só pergunta com a técnica ligada.
- **D8. Ligações moram em Requisitos** (decisão 6). "Só liga pela técnica" = `requisitos.forma.soLigaPor`; "Parte da forma, em ordem" = `requisitos.forma.partesEmOrdem`; "Numa forma" = B3. Modelo e motor já existem; entra a tela. "Libera a técnica X" da Transformação grava B3 no requisito de X; "Ao chegar a N: libera" do Acumulador grava A4 na técnica liberada. Um lugar só: o requisito; a peça mostra e leva até ele.
- **D9. Acumulador** (decisão 7): a peça edita o `cartao.acumulador` do cartão dono, sem cópia na mecânica. O cartão criado pelo "+ Acumulador" vira a habilidade dona; a faixa da ficha só mostra e abre a dona; sai o "+ Acumulador". Descida nova `{ quando: 'desliga' }` ("zera quando a técnica desliga"); o app de antes a guarda como regra não lida.
- **D10. Condições** (decisões 10 a 12). Marca = selo Marcado no alvo; o próximo golpe DO DONO nela dá ×2 e ela some; com a forma ligada, cada acerto deixa outra. Fadiga = selo comum no dono quando a forma acaba (padrão −10 de Agilidade por 2 turnos, números na peça) e entrada nova no catálogo de condições de fábrica; forma da versão 5 não aplica o cansaço antigo do Overload. Diminui atributo = selo no alvo com `mods` negativos que crescem a cada vez de quem o tem (`passo`), a partir do turno N (`desde`), fixo ou % do atributo (fixado no acerto), com teto opcional; golpe novo no mesmo alvo não soma, só recomeça o prazo (a renovação prevista em `modelo.ts:538` passa a rodar). "Velocidade" = a Agilidade que ordena a vez, como na Ignição. Tudo no selo da batalha: vale na Arena e no treino, onde a condição na ficha não roda.
- **D11. Conversão das antigas** (decisão 3): pura e idempotente, em `lib/batalha/mecanica/conversao/`. Roda na leitura (lista e editor) e não grava nada; grava quando o mestre salva (ou o dono, como proposta). Converte técnica, passiva, forma, invocação, marca, reação e o contador de antes; pula cartão com `mecanica` e cartão com linha na tabela à mão, também a cópia (`temLinhaNaTabela`): a regra à mão continua valendo e o mestre remonta quando quiser. O texto inteiro de antes vai ao extra "Texto de antes" (já existe; nenhuma vista o mostra). O que o leitor não entendeu vai para a Descrição numa linha "Confira: ..."; a lista mostra "Convertida: confira" enquanto a linha existir (nenhuma marca nova que force a versão 5). Cópia de segurança por arquivo, uma vez, ao abrir na 0.6.5 e antes de qualquer gravação: `rpg.json.antes-habilidades-v2` e `catalogo.json.antes-habilidades-v2`, no molde de `stores/conversaoDosItens.ts:23` e `lib/livros/catalogoNoDisco.ts:94`.
- **D12. Teto.** O editor mostra o tamanho da mecânica e não salva acima de 12.000 caracteres (o leitor descarta acima de 16.000, `personagem.ts:643`).
- **D13. Rede.** Nenhuma mensagem nova (§0). `RESPOSTAS_MAX` (`perguntaNaHora.ts:16`) sobe de 8 para 12 (3 perguntas, o imbuir, a raça e os requisitos no mesmo pedido); vale no host e no Worker, que saem juntos.
- **D14. Editor único** (decisões 1, 2, 15): o mesmo na ficha (app, site e jogador) e em Livros > Habilidades. Topo: Nome, imagem, "Descrição para ambientar" (o único texto livre), Ação (com Passiva e Ligar e manter) e Marcas; depois as Peças; depois as linhas de hoje. Saem "Só texto", "Montar", "Desmontar", "Abrir sem montar" e "Editar como texto". O botão vira "Salvar na ficha", com "Guardar também no catálogo do livro". Os ramos arma e item do editor não mudam. Contrato entre E6 e E7 (rodam juntas): as props públicas de `HabilidadeNaFicha` e `EditorDaHabilidade` só ganham opcionais (`abaDoCartao`, `relatorio` da conversão, `guardarNoCatalogo`).
- **D15. Modelos.** Os 22 de hoje + os 10 do protótipo (`MODELOS_NOVOS`, `prototipo.html:1413`: Grande Chifre, Imbuir Elementos, Fôlego de Batalha, Sangue de Ogro, A Caçada Começa, Foco do Atirador, Forma Híbrida, Fúria do Dragão, Corte Gelado, Armadura Humana).
- **D16. Testar no boneco** (decisão 14): sem sorte (todo golpe acerta, o d20 da defesa rola 10, a escolha da rodada vale para todos os ataques dela).
- **D17. Fora**: Dragon Ball; Perícias, Vantagens e Desvantagens (decisão 17); mochila, equipamento e o editor do item.

## 2. Ondas e etapas

No máximo 3 escritores por onda, todos na main, sem worktree; dentro da onda os arquivos não se cruzam. "max" = Opus max; "xhigh" = Opus xhigh. Agente sugerido: `programador` nas etapas de motor e dados, `programador-frontend` nas de tela.

| Onda | Etapa | Modelo | Depende de |
|---|---|---|---|
| 0 | E1 Núcleo de dados v5 e busca pelo cartão | max | nada |
| 1 | E2 Conversão das antigas e cópia de segurança | max | E1 |
| 1 | E3 Motor do golpe | max | E1 |
| 1 | E4 Peças no editor | xhigh | E1 |
| 2 | E5 Motor da vez, da passiva e da forma | max | E1, E3 |
| 2 | E6 Editor único | xhigh | E1, E2, E4 |
| 2 | E7 Ficha e Livros | xhigh | E1, E2 |
| 3 | E8 Testes certeiros, prints e publicação | xhigh | todas |

Por que estas quatro em max: E1 define o formato que o app, o site e o Worker vão ler para sempre e mexe nos chamadores do motor; E2 é proteção de dado (nenhuma ficha pode perder texto); E3 e E5 mexem no coração da batalha (golpe 1718 + 1492 linhas; vez, forma e passiva com Desfazer), que o Worker também roda.

### Onda 0

**E1. Núcleo de dados v5 e busca pelo cartão (max, 1 escritor)**
- Arquivos: `lib/batalha/mecanica/{modelo,leitura,golpe,categoria,textoGerado,resumo}.ts`; `lib/batalha/mecanica/pecas.ts` (novo); `lib/batalha/combate.ts` e `lib/batalha/turnos.ts` (só tipos); `lib/batalha/tiposDaHabilidade.ts`; `lib/batalha/requisitos/modelo.ts` (só o tipo da descida nova do acumulador, D9); `lib/batalha/mecanicasAMao.ts` (só os campos novos de `MecanicaAMao` e a troca para cartão); chamadores da troca: `components/batalha/{BatalhaDoMestre.tsx,dadosDoMenu.ts}`, `lib/batalha/golpe.ts`, `lib/treino/duelo.ts`, `stores/batalha/{golpe,vez,formas}.ts`; `components/batalha/editor/pecas/registro.ts` (novo: o contrato de cada peça na tela, lista vazia).
- Faz: D1, D2, D3, D4; a leitura da passiva montada (D6); os tipos só do host de D7 e D10 (selo com `passo`, `desde`, `teto`; forma com ações a mais, marca a cada acerto e fadiga); o texto gerado e o resumo das peças novas (o cartão se escreve sozinho, decisão 2).
- Pronto quando: `rtk proxy npx tsc --noEmit` limpo no client e o `tsc --noEmit -p lobby/nuvem/tsconfig.json` limpo; `lerMecanica` aceita cada família nova e recusa chave desconhecida; nenhuma chamada passa só o id a `chavesDoDono`, `golpesSaoOverload`, `fatorDaVelocidade`, `vezesDaForma` ou `perdaNoFimDaVez`; `linhaDasPecas` só ganhou ramos novos (cartão de versão 1 a 4 dá a mesma linha; a E8 confere pela suíte); commit só destes caminhos.

### Onda 1

**E2. Conversão das antigas e cópia de segurança (max)**
- Arquivos: `lib/batalha/mecanica/conversao/*.ts` (novo); `stores/conversaoDasHabilidades.ts` (novo); `App.tsx` (a chamada da cópia ao abrir, ao lado da dos itens, `App.tsx:268`); `lib/livros/catalogoNoDisco.ts` (a cópia do catálogo).
- Faz: D11 inteira, mais o relatório por ficha (o que converteu e o que pede "Confira") que a lista e o editor mostram. Reaproveita os leitores de texto de hoje (`leituraDaFicha`, `passivas`, `transformacao`, `marca`, `invocacao`, `escolhaEEvolucao`, `contador`, `requisitos/antigos`, `alcance/antigos`) só por import.
- Pronto quando: tsc limpo; a conversão é pura e devolve a MESMA referência na segunda passada; cartão com `mecanica` ou com linha na tabela sai intocado; todo texto de antes está no "Texto de antes" ou na Descrição; a cópia nasce uma vez e não é regravada; nada grava ao abrir além da cópia; commit só destes caminhos.

**E3. Motor do golpe (max)**
- Arquivos: `lib/batalha/{golpe,mecanicasAMao,reducaoDoDano,marca,selos,condicoes,perguntaNaHora,reacaoComTecnica}.ts`; `stores/batalha/{golpe,selos}.ts`; `lib/treino/robo.ts`.
- Faz: mecânica 1 (a resposta troca o tipo do golpe, com o selo e a perfuração da tabela de `mecanica/golpe.ts`; perfuração em %; até 3 perguntas); 2 (imbuir com vários elementos, só com a técnica ligada pelo selo de D7, "Não" grátis, condição do elemento no acerto, veto da forma); 4 (raça lida de cartão montado; "+N" em golpe físico ou só corpo a corpo; o corte de % antes do Escudo, decisão 13); 8 (diminui: `passo`, `desde`, %, teto e renovação em `comSeloNovo` e `contarSelos`); marca da forma e só do dono (D10); "Devolve o golpe" com a soma de um atributo; `RESPOSTAS_MAX` 12 (D13); o robô responde a primeira opção e não imbui.
- Pronto quando: tsc limpo no client e no Worker; cada item acima lê um campo de `MecanicaAMao` da E1 (nenhuma peça crua); o caminho de texto e as linhas da tabela à mão sem mudança de comportamento; commit só destes caminhos.

**E4. Peças no editor (xhigh)**
- Arquivos: `components/batalha/editor/pecas/*` (novo: um componente por família, e o preenchimento do `registro.ts`); `components/batalha/blocos/{BlocoDosRequisitos.tsx,requisitosNaTela.ts}`; `components/batalha/editor/linhas/LinhaDosRequisitos.tsx`.
- Faz: as 11 famílias do protótipo (`PECAS`, `prototipo.html:612`), com os nomes, ícones, cores e padrões dele; a Acumulador edita o `cartao.acumulador` (D9) reaproveitando por import as partes do `EditorDoAcumulador.tsx`; nos Requisitos, "Só liga pela técnica" e "Parte da forma, em ordem" (D8). Skills de design do Emil antes da tela (`emil-design-eng`).
- Pronto quando: tsc limpo; cada família tem componente e entrada no registro; nenhuma peça grava fora da `mecanica` (só a Acumulador, no `acumulador`); commit só destes caminhos.

### Onda 2

**E5. Motor da vez, da passiva e da forma (max)**
- Arquivos: `lib/batalha/{passivas,transformacao,acoes,acumuladorNaBatalha,custoPorTurno,recursosDaBatalha,invocacao}.ts`; `lib/batalha/requisitos/ler.ts`; `lib/condicoes/catalogo.ts`; `stores/batalha/{passivas,formas,vez,nucleo}.ts`; `components/batalha/{PassivasDaBatalha,ListaDeFormas}.tsx`.
- Faz: mecânica 3 (gatilhos começo da vez, ao receber dano, ao acertar, ao cair com "fica com N de vida"; efeitos sobe atributo, recupera por turno, ganha Escudo, condição em si ou no alvo, aviso; "sempre" ou "uma por batalha"; disparo sozinho de D6, com `ehPassiva` aceitando a passiva montada); 5 (Overload de transformação: liga como ação Livre no começo da vez e já age, ações a mais, 1 por batalha, golpes sem desvio por padrão (dá para desligar), desliga sozinha no fim de X vezes, Fadiga no fim sem o cansaço antigo, técnica liberada por B3); 7 (descida "desliga" do acumulador); "Ligar e manter" com o selo do dono (D7); Invocação lida da peça antes do texto; a Fadiga no catálogo de fábrica; a tira Passivas e a lista de formas mostram as novas.
- Pronto quando: tsc limpo no client e no Worker; passiva e forma de texto seguem pelo ramo de hoje (o diff não muda esse ramo); todo efeito novo entra no registro com Desfazer; commit só destes caminhos.

**E6. Editor único (xhigh)**
- Arquivos: `components/batalha/editor/{EditorDaHabilidade,HabilidadeNaFicha,ColunaDoPapel,PapelDoCartao,ComecarDeUmModelo}.tsx`; `components/batalha/editor/{gravarNoCartao,modelosDoEditor}.ts`; `components/batalha/editor/linhas/{LinhaDaAcao,LinhaDosCampos}.tsx`; `components/batalha/editor/editor.css`; `lib/batalha/mecanica/modelos.ts`; `lib/batalha/ensaio/ensaio.ts`; `components/ensaio/PainelDeEnsaio.tsx`.
- Faz: D14, D15, D16; as peças do registro (E4) no corpo do editor; abre a técnica antiga já convertida pela E2, com os "Confira" à vista; Ação com Passiva e "Ligar e manter"; até 3 perguntas e 6 respostas, NPC com a primeira (decisão 8); Overload de transformação na tela (decisão 9); o tamanho da mecânica e o bloqueio de D12. Skills de design do Emil antes da tela.
- Pronto quando: tsc limpo; nenhum "Só texto", "Montar", "Desmontar" nem "Abrir sem montar" no ramo técnica (`rg` em `components/batalha/editor`); os ramos arma e item com o mesmo comportamento (o diff só toca o ramo técnica); props públicas só com opcionais novos (D14); commit só destes caminhos.

**E7. Ficha e Livros (xhigh)**
- Arquivos: `components/FichaAbas.tsx`; `components/habilidades/*` (novo: a lista de habilidades da ficha); `components/batalha/acumulador/AcumuladoresNaFicha.tsx`; `components/livros/{PaginaItens,EntradaDoCatalogoDialog}.tsx`; `lib/livros/catalogo.ts`.
- Faz: a lista única da ficha (decisões 15 e 16): filtro Transformações, "+ Habilidade", "+ Transformação" (abre já com a peça), tocar e "Trazer de outra ficha" abrem o editor; etiqueta "Convertida: confira"; some o "Editar como texto" nas abas Habilidades e Transformações; a faixa Acumuladores só mostra e abre a dona; Livros > Habilidades: "Nova habilidade" abre o editor direto, com "Guardar também no catálogo"; o "Pôr em" leva a forma para a aba Transformações (`abaDeDestino` pela peça, `catalogo.ts:290`). Perícias, Vantagens, Desvantagens, Armas, Itens e Mochila não mudam.
- Pronto quando: tsc limpo; as três portas da ficha (app; site, `lobby-site/telas/TelaFicha.tsx:383`; jogador, `player/PlayerFicha.tsx:509`) passam pela mesma lista; nenhum campo solto de Ação, Efeito, Custo, Tempo ou Dano nas abas Habilidades e Transformações; commit só destes caminhos.

### Onda 3

**E8. Testes certeiros, prints e publicação (xhigh, 1 escritor)**
- Arquivos: só `*.test.ts(x)` novos e `docs/design/habilidades-rework/provas/`.
- Os 3 testes:
  1. **Conversão sem perda (núcleo)**: as fichas reais dos testkits (`lib/batalha/fichasDaFatiaF.testkit.ts` e as das fatias B a E) passam pela conversão; nenhum texto de antes some (está no "Texto de antes" ou na Descrição); a segunda passada devolve a mesma referência; os cartões da tabela à mão e os montados saem intocados; a técnica convertida tem o mesmo custo, ação e dano que a leitura de texto dava.
  2. **Overload de transformação do exemplo do dono, na batalha** (`stores/batalhaFabrica`): a forma nova "A Caçada Começa" (dura 3 vezes, +1 ação, +20 de Agilidade, marca a cada ataque, sem desvio, Fadiga −10 de Agilidade por 2 turnos). Liga e age 2 vezes na mesma vez; cada acerto deixa a marca; o golpe do dono no marcado dá o dobro e a marca some; o alvo não tem esquiva; a Agilidade soma 20 enquanto dura; no fim da 3ª vez desliga sozinha e a Fadiga entra; ligar de novo na mesma batalha é recusado.
  3. **Diminuir atributo por turno**: Corte Gelado (−5 de Velocidade por vez a partir da 1ª, teto 15, volta em 4): a Agilidade do alvo cai 5, 10, 15, 15; um golpe novo não soma, só recomeça o prazo; no fim do prazo volta ao normal.
- Depois: a suíte inteira uma vez (verde, fora as vermelhas já conhecidas); tsc do client, do site e do Worker; 3 prints (editor com as peças; ficha com a lista e o filtro; batalha com a Overload e a marca); uma jornada só por cliques (abrir a ficha, "+ Habilidade", montar, salvar, ligar na batalha); `verificador-realidade` item por item contra os pedidos literais de 22:40 a 23:23; publicar a 0.6.5 com `publicar-versao.cjs --publicar` (app, Worker e site juntos); avisar o dono para atualizar o app em todos os PCs.
- Pronto quando: os 3 testes passam; a suíte passa; os prints estão em `provas/`; o verificador não acha item do pedido faltando; a 0.6.5 está publicada.

**E9. Só se a E8 pedir (isolada, marcada).** Se o navegador do jogador precisar de um dado que hoje não chega (ex.: "Overload: faltam N vezes"), uma etapa sozinha mexe em `net/protocoloDaBatalha.ts` e `lib/batalha/vistaDoJogador.ts`, depois que a outra sessão fechar `net/protocol.ts`. Hoje nenhuma das 8 mecânicas pede.

## 3. Regras para os escritores (main, sem worktree)

1. Antes de cada onda: conferir o estado do repositório e não pegar arquivo que a outra sessão esteja mexendo (hoje `net/protocol.ts` e `stores/batalha/ordem.ts`, nenhum deles em etapa deste plano). Conferir também o espaço em disco (piso de 8 GB).
2. Cada etapa escreve só nos arquivos dela; arquivo novo nasce na pasta da etapa. Precisou de outro arquivo: anota no relatório e não edita (quem é dono dele faz, ou vai para a onda seguinte).
3. Commit só dos próprios caminhos (`git commit -- <caminhos>`, nunca o stage inteiro), mensagem curta em inglês, com a linha de autoria.
4. Erro de `tsc` fora dos próprios arquivos é de outra etapa em curso: ignorar. O `tsc` limpo do client, do site e do Worker é conferido no fim de cada onda, antes da seguinte.
5. Nenhum teste novo antes da E8; nada publicado antes da E8.
6. Fora de todas as etapas: `lobby/nuvem/src`, `net/protocol.ts`, `net/protocoloDaBatalha.ts`, `lib/dbt`, `components/dbt`, `components/EfeitoDaArmaCampos.tsx` e os ramos arma e item do editor.
7. Nos prompts dos agentes, código entre aspas simples (crase de markdown fecha o script do Workflow).
8. Função exportada que outra etapa usa (da mesma onda ou de onda anterior) não muda de assinatura: a E2 importa leitores de texto que a E3 e a E5 refazem. Acrescentar função nova, nunca trocar a de hoje.
9. Ajuste ao MAPA §5: o tipo da descida nova do acumulador nasce na E1 (`requisitos/modelo.ts`), para a E4 já poder mostrá-la; a E5 fica só com `requisitos/ler.ts`. Onde o MAPA e este plano diferem, vale este plano.

## 4. O que o dono vai perceber, por onda

- Onda 0 e 1: nada na tela ainda (formato, conversão, motor do golpe e as peças prontas por dentro).
- Onda 2: o editor novo na ficha e no livro; a lista com o filtro Transformações; as passivas e a Overload de transformação funcionando na batalha.
- Onda 3: a 0.6.5 publicada (app, site e Worker), com as 3 provas e os prints em `docs/design/habilidades-rework/provas/`.
