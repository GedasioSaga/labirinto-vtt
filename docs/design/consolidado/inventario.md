# Inventario da UI do Labirinto VTT (estado de 09/10/2026, arvore de trabalho com mudancas nao commitadas)

Base: leitura de C:/dev/labirinto/client/src (App.tsx, components/, player/, lib/) + os 4 prints em C:/dev/hud-evidencia/pedido-ui-*.png.
Legenda de frequencia: **[SEMPRE]** = mexido toda sessao / toda cena; **[AS VEZES]** = construcao do mapa ou algumas vezes por sessao; **[RARO]** = configuracao, uma vez por mapa/aventura, ou atras de flag.
Quem usa: M = mestre (editor Tauri), J = jogador (navegador/celular).
Flags DESLIGADAS hoje (lib/features.ts): Pistas, Iniciativa, Relogio da campanha, Confronto, Andar do predio, Gatilho de area na Sala, Perigo da Sala (Por fogo/agua), Ferramenta Token (K), Link de cenario, outros tipos de mapa. Existem no codigo mas NAO aparecem: no redesenho, no maximo um slot futuro.

---------------------------------------------------------------------
## 1. Barra da ESQUERDA do editor (M) - components/PropertiesPanel.tsx

Uma coluna so (~260 px) que hoje mistura CINCO papeis: identidade do app/mapa, inspetor do item selecionado, opcoes da ferramenta armada, navegacao da aventura/cena, e duas bibliotecas (acervos). Ordem de cima para baixo:

### 1.1 Cabecalho fixo (PropertiesPanel.tsx:555-595) - sempre visivel
| Controle | O que faz | Freq |
|---|---|---|
| Logo + "Labirinto" + linha do mapa ("Nome · LxA · Npx") | identidade; a linha corta com reticencias (print: "Tasmaturi...") e o tooltip mostra inteira | - |
| "+ Token" (BotaoMais, :571) | abre o campo "Nome do novo token" (NovoTokenForm: Adicionar/Cancelar) no topo do corpo; Enter cria e seleciona a ficha | [SEMPRE] |
| Icone de "expandir" (:572-583) | **NAO e tela cheia**: e "Ver todas as cenas" (abre SceneOverviewDialog, miniaturas de todas as cenas por pasta, App.tsx:3112). O icone engana | [AS VEZES] |
| Engrenagem (MapSettingsButton, :584) | abre "Configuracoes do mapa" (MapSettingsDialog): Grade (mostrar, formato, cor, opacidade, espessura, estilo da linha), Alinhar grade a imagem (colunas/linhas, deslocamento X/Y, previa), Medicao (unidades por celula, unidade, casas decimais, modo), Rostos so de perto (casas), Movimento dos jogadores (Livre / Fichas ocupam espaco), Tamanho do mapa, Texto de chegada, Categorias do painel, Sistema de RPG; [flag off: Link de cenario, Andar do predio] | [RARO] |

### 1.2 Corpo rolavel - topo contextual (o "inspetor")
| Bloco | Quando aparece | O que faz | Freq |
|---|---|---|---|
| "Nada selecionado" (NadaSelecionado, :601) | nada selecionado | faixa vazia (print) | - |
| Faixa da selecao (SelectionHeader, :606) | algo selecionado | icone+nome do tipo (Token, Parede, Sala, Porta, Luz, Escada, Peca, Desenho, Texto, Peca de chao, Selecao), Apagar ("Apagar token selecionado"), menu "Mais acoes" (levar ao piso de cima/baixo quando ha pisos) | [SEMPRE] |
| Campo do novo token (:630) | depois do "+ Token" | nome + Adicionar/Cancelar | [SEMPRE] |
| Endireitar (EndireitarControl, :642) | selecao tem linha/parede solta/caminho torto | endireita | [RARO] |
| "Ferramenta · nome" (:648) | ferramenta armada e nada selecionado (exceto Selecionar, Parede, Regiao) | titulo da ferramenta | - |
| Bloco do item / opcoes da ferramenta (:655-1007) | ver secoes 3 e 4 | - | [SEMPRE] |
| Selecao (grupo selection, :1012) | sempre montado; conteudo com selecao multipla | "Limpar selecao de area", "Alinhar e distribuir" (Distribuir precisa 3+), "Oculto para jogadores" em lote | [AS VEZES] |

### 1.3 Grupo "AVENTURA" (:1023-1031) - some quando a preferencia "categorias so sem selecao" esta ligada e ha ferramenta/selecao
| Secao | Quando | O que faz | Freq |
|---|---|---|---|
| Pinos (PinsSection) | sempre ("Nenhum pino no mapa ainda.") | busca "Nome ou descricao", filtro de cena ("Todas as cenas"), lista de TODOS os pinos da aventura pelo nome do mestre; clicar abre a cena com o pino selecionado | [AS VEZES] |
| Agenda (AgendaSection) | so com aventura aberta | eventos (nome, dia, apito, "Soar alarme ao disparar"), Novo evento, Proximo apito, Proximo dia | [RARO] |
| Estado do mundo (WorldStateSection) | so com aventura | estados com valores ("Mare: alta, baixa"), trocar valor (dispara rotina dos NPCs), Novo estado | [RARO] |

### 1.4 Grupo "ESTA CENA" (:1034-1078)
| Secao | Quando | O que faz | Freq |
|---|---|---|---|
| Objetos do mapa (MapObjectsSection) | sempre, nasce recolhida | busca (Ctrl+K abre com cursor aqui), lista de salas/portas/pinos/tokens/textos, Ir ate la, achados de OUTRAS cenas, "Mandar ficha para ca (Shift+Enter)" com sala aberta | [SEMPRE] via Ctrl+K |
| Marcas dos jogadores (MarcasDaCena) | ha marcas de jogadores | reler e Apagar bilhetes | [RARO] |
| Locais (PlaceTreeSection) | sempre | arvore de salas ("3 locais. Clique num local para enquadra-lo."); clicar enquadra | [SEMPRE] |
| Territorio (TerritorioControls) | so no "momento de mapa" (Selecionar + nada selecionado); nasce fechada | "Faccoes do mapa" (pinta salas pela cor da faccao, so no editor), "Alerta da cena" (nivel de barulho, jogador nao ve) | [RARO] |
| Chao do mapa (FloorStyleControls) | momento de mapa OU ferramenta Chao; aberta por padrao no momento de mapa | Cor do chao, Contorno + cor, Precisao do contorno, Render fiel (minimapa), Moldura com titulo + Titulo | [AS VEZES] |
| Camadas do chao (FloorLayersList) | ha pecas de chao ou pincel de chao na mao | pecas: cor, trava, ocultar, subir/descer, renomear, "+ Nova camada" | [RARO] |
| Camadas (LayersPanel) | momento de mapa; aberta por padrao | olho por camada (Paredes, Portas, Salas, Escadas, Objetos, Decoracao, Iluminacao, Tokens, Anotacoes) + atalhos rapidos da grade | [AS VEZES] |

### 1.5 Bibliotecas, fora dos grupos (:1084-1085) - sempre no fim do scroll
| Secao | O que faz | Freq |
|---|---|---|
| ACERVO DE TOKENS (TokenLibraryPanel) | estante de NPCs do APP (nao da aventura): pastas com contagem (print: NPCs 29, Veiculos 0, Jogadores 10, Sem pasta 1), "+ Pasta", arrastar ficha ao mapa, guardar token selecionado, mover de pasta, apagar do acervo, apagar pasta mantendo tokens | [SEMPRE] (arrastar NPC na sessao) |
| ACERVO DE ITENS (AcervoDeItensPanel) | itens do app com imagem: Itens/Categorias, Novo item, Nova categoria | [RARO] |

### 1.6 Barra de acoes do mapa (ActionBar, no mesmo rail da esquerda, App.tsx:3922)
Desfazer (Ctrl+Z), Refazer (Ctrl+Y), Voltar (cena anterior), Salvar, Abrir..., menu "Imagem de fundo e conversao" (Trocar imagem de fundo, Chao a partir da imagem, Linhas e portas a partir da imagem, Recriar minimapa completo), Exportar mapa (pasta), Exportar imagem (PNG), Importar mapa (pasta), Inicio, Atalhos do teclado (?). Desfazer/Salvar [SEMPRE], resto [RARO]. Posicao exata na tela nao conferida (fora dos prints).

---------------------------------------------------------------------
## 2. Barra da DIREITA (M) - components/RightColumn.tsx + components/RoomPanel.tsx
So existe no app Tauri (App.tsx:1083). Estrutura:
- botao "Esconder a coluna da direita"; no topo, "Pausa geral dos NPCs" (quando ha NPC andando).
- Abas: **Jogo** | **Chat** (contador de nao lidas).
- Embaixo das abas, regiao **Cenas** (ScenesSection) com divisor arrastavel "Altura das Cenas" (duplo clique volta).

### 2.1 Aba Jogo SEM sala aberta (RoomPanel.tsx:1518-1531) - o print
| Secao | O que faz | Freq |
|---|---|---|
| SALA · "Abrir sala" (OpenRoom) | abre a sessao LAN; com mesa salva pergunta "Retomar a mesa?" listando nomes | [SEMPRE] 1x por sessao |
| "Visao de jogador" (VisaoDeJogadorBotao) | janela de TESTE com a visao de uma ficha (picker com retrato), X fecha; ajuda "So voce ve. Nada fica no jogo." | [AS VEZES] |
| REDE LOCAL (FirewallHint) | paragrafo fixo sobre liberar o Firewall do Windows | [RARO], mas ocupa espaco sempre |
| Livro de regras | botao fantasma; abre o livro do sistema (so se o sistema tem livro) | [AS VEZES] |
| Personagens (colapsavel, contagem) | retrato, selo Jogador/NPC, abrir ficha, apagar (confirma); "+ Personagem", "Importar personagens..."; aviso sem sistema | [AS VEZES] |
| Contas dos jogadores (colapsavel, contagem) | "So com conta" (checkbox + explicacao), lista "Nome · N personagens · N aparelhos · x" (nomes cortam no print), por conta trocar PIN, aparelhos lembrados, personagens de quem; Nova conta (Nome + PIN) | [RARO] |
| [flag off] Iniciativa, Relogio da campanha | - | - |

### 2.2 Aba Jogo COM sala aberta (RoomPanel.tsx:1534-1643)
| Secao | O que faz | Freq |
|---|---|---|
| Cabecalho: "Sala" + CODIGO + Laser | codigo que o jogador digita; laser do mestre (toggle) | [SEMPRE] |
| Visao de jogador | idem 2.1 | [AS VEZES] |
| Livro / Personagens / Contas | idem 2.1 | [AS VEZES]/[RARO] |
| Som da mesa (ControleDeSom) | volume + mudo dos sons de clima neste PC | [AS VEZES] |
| Ruido (NoiseControl) | arma o clique de ruido + alcance em casas | [RARO] |
| GRUPO (GrupoCompacto) | coracao da mesa: "Buscar", filtro "Pedindo" (passagem, ficha longe, personagem), grupo "Chegando" (sem ficha: Atribuir), grupos por cena (Ir a cena, Congelar/Descongelar cena, Pausar cena, pedidos de passagem: Deixar ir / Nao / Liberar uma vez / A barra aguenta), linha por jogador com abas Mochila · Visao · Ficha e acoes: Ir la, Seguir, Ver tela, Recado, Mandar para..., Trazer, Atribuir/Tirar ficha, Emprestar ajudante, Emprestar fichas/Encerrar, Passar a outro jogador, Guardar fichas, Dispensar, Expulsar, raio/fator de visao, Revelar planta/Esconder de novo, Dar o que o grupo viu, Mostrar mapa de um a outro, Mapa de papel, itens (Tirar, Devolver ao chao, Dar item...), Moedas..., Propor troca...; "Congelar todos/Descongelar todos" | [SEMPRE] |
| Teste secreto (SecretCheckSection) | so com jogadores: rotulo (ex. Percepcao), Para quem, Pedir teste, Encerrar | [AS VEZES] |
| Diario de viagem (TravelLogSection) | so com aventura: viagens recentes + Desfazer | [RARO] |
| Tela da mesa (TableScreenSection) | URL da tela da TV/mesa, "Cena na tela" | [RARO] |
| Convidar jogadores | Link publico (tunel liga/desliga), Enderecos na rede local, QR, dica do firewall | [SEMPRE] 1x por sessao |
| Fechar sala (botao perigo) | encerra a sessao | 1x por sessao |
| [flag off] Pistas, Iniciativa, Relogio, Confronto | - | - |

### 2.3 Aba Chat (MasterChatPanel)
Sem sala: "O chat dos jogadores abre junto com a sala." + "Ir para Jogo". Com sala: conversa por cena, enviar, apagar, rostos. [SEMPRE] na sessao.

### 2.4 Regiao Cenas (ScenesSection, 81 KB) - [SEMPRE] com aventura
Lista hierarquica com pastas: cena inicial, selecionar, renomear (nome do mestre + nome publico), contagem de fichas, quem esta e ha quanto tempo espera, Configurar (visao dos jogadores nesta cena), Planta conhecida por todos, Pausar, Recado para quem esta na cena, Abalo (texto por distancia), Alarme, Mover para dentro de outra cena, Duplicar/mover/apagar, Revelar planta para..., filtro, Visao geral, andares empilhados, Revisor da aventura.

---------------------------------------------------------------------
## 3. Barra de FERRAMENTAS inferior (M) - components/Toolbar.tsx, components/labels.ts:152 (TOOLBAR_SLOTS), lib/keymap.ts:129, lib/toolVariants.ts:361, lib/toolProperties.ts:219
4 grupos separados por divisor. "Setinha" = submenu (ToolVariantMenu) com opcoes do PROXIMO desenho. "Painel" = o que a barra esquerda mostra com a ferramenta armada e nada selecionado.

| Grupo | Ferramenta | Atalho | Submenu (setinha) | Painel que abre | Freq |
|---|---|---|---|---|---|
| G1 | Selecionar | V | - | momento de mapa: Chao do mapa, Camadas, Territorio, navegacao | [SEMPRE] |
| G2 | Parede | W | Tipo de parede: Externa / Interna | Parede (Cor, Padrao, Espessura, Ajuste fino, Parede interna, Janela (ve, nao passa), Deixa passar, Deixa ver; Avancado: Ponta e canto) | [AS VEZES] |
| G2 | Porta | D | Tipo de porta: Normal / Dupla / Portao | "Abrir na parede" (porta ou vao) + Tipo de porta | [AS VEZES] |
| G2 | Luz | H | - | so o titulo (luz se edita depois de criada) | [RARO] |
| G2 | Regiao | G | Preenchimento: Solido / Hachurado | Regiao (Cor, Hachurado, Espessura e Cantos do contorno, Criar parede na borda, Suavizar contorno) + Preenchimento (Preenchido, Opacidade) + Avancado | [RARO] |
| G2 | Sala | N | Preenchimento | igual Regiao (titulo "Ferramenta · Sala") | [SEMPRE] na construcao |
| G2 | Sala Circular | J | Preenchimento | igual | [RARO] |
| G2 | Poligono Regular | Q | Preenchimento + Lados (3,4,5,6,8,10,12) | igual + Lados | [RARO] |
| G2 | Sala livre | (sem) | Criar: Sala / Parede; Arredondar: Desligado / Ligado; Preenchimento | Regiao+Preenchimento (modo Parede: nada) | [AS VEZES] |
| G2 | Chao | I | Forma: Retangulo / Elipse / Poligono regular / Corredor / Pincel de blocos / Balde; Tinta: Chao, Mar, Grama, Terra, Pedra, Lava; Tamanho do pincel (N blocos); Operacao: Somar / Subtrair; Lados | Chao do mapa (estilo) + Camadas do chao | [AS VEZES] |
| G2 | Caminho | (sem) | - | Caminho: Cor deste caminho, Largura | [RARO] |
| G2 | Escada | S | Tamanho: Pequena / Media / Grande | so o titulo | [AS VEZES] |
| G2 | Peca (imagem) | B | - | so o titulo; ao clicar escolhe imagem | [RARO] |
| G2 | Zona oculta | X | - | so o titulo (zona se edita depois) | [AS VEZES] |
| G2 | Pincel de revelar | (sem) | - | "Ao pintar" Revelar/Esconder + Largura do pincel | [AS VEZES] no jogo |
| G3 | Objetos (mobilia) | (sem) | Objeto: Barril, Caixa, Bau, Cama, Mesa, Cadeira (com icone) | so o titulo | [RARO] |
| G4 | Desenho (grupo: Pincel P, Linha L, Curva U, Circulo C, Elipse O, Retangulo R, Poligono A) | P L U C O R A | Forma (as 7, com icone); no Pincel tambem Modo (Traco livre / Balde) e Textura (Caneta / Lapis / Marcador) | Estilo de desenho (Cor, Espessura, Preenchido, Opacidade) + Estilo do traco (Ponta, Traco) para pincel/linha/curva | [AS VEZES] |
| G4 | Texto | T | - | Estilo de desenho (cor, fonte, tamanho) | [RARO] |
| G4 | Pino | Y | - | so "Tipo do pino" do proximo: Exclamacao (!) / Interrogacao (?) / Viagem / Alavanca | [SEMPRE] |
| G4 | Medir | M | - | - | [AS VEZES] |
| G4 | Borracha | E | Modo: Objeto inteiro / So uma parte | - | [AS VEZES] |
| - | Token | K | - | - | flag off, fora da barra |
Obs.: a barra ecoa a variante escolhida no proprio botao. No print sao 22 botoes (1 + 14 + 1 + 5 com o grupo Desenho), quase todos com setinha; o grupo de construcao (14) e o mais carregado e tem 4 formas de "sala" + Regiao lado a lado.

---------------------------------------------------------------------
## 4. PROPRIEDADES por tipo de objeto selecionado (M) - painel esquerdo, PropertiesPanel.tsx:655-1007
Todos ganham no topo a faixa da selecao (tipo, Apagar, Mais acoes/levar ao piso).

### 4.1 TOKEN / ficha (PropertiesPanel.tsx:878-967), na ordem atual
1. "Visto por: ..." / "Ninguem ve" (TokenSeenBy) - so com sala. [SEMPRE]
2. Nome (TokenNameControls) + "Nome para os jogadores": O mesmo / Outro (campo, ex. "Estivador") / Nenhum. [SEMPRE]
3. Vida (TokenHealthControls): Vida atual, Vida maxima, "Jogadores veem a barra". [SEMPRE] no combate
4. Tamanho da ficha: 1 / 2 / 3 quadrados. [AS VEZES]
5. Condicoes: Envenenado, Caido, Dormindo, Atordoado, Invisivel (aparecem sobre a ficha, tambem para jogadores). [SEMPRE] no combate
6. "Trava e visibilidade" (ItemTransformControls): Travado, Congelado, Oculto para jogadores; Avancado: Rotacao, Oculto no editor. [AS VEZES]
7. Cor (paleta + "Cor padrao"). [AS VEZES]
8. Imagem do token: Escolher / Trocar / Remover imagem (voltar ao circulo) / Salvar no acervo. [AS VEZES]
9. "Comportamento": Ficha de NPC; Ficha de jogador; Personagem (ligar ficha de RPG, Abrir ficha); Vigia ("Esta ficha vigia": Para onde olha, Abertura do olhar, Alcance, Em volta); Patrulha (Marcar ponto aqui, Tirar ultimo ponto, Apagar rota, Ronda, Velocidade, Seguir, Patrulhar sozinha/Parar, Avancar patrulha); Levar junto ("Vai junto de"); Veiculo ("Esta ficha e um veiculo", Lugares +/-, A bordo); Rotina (com aventura: posto por valor do Estado do mundo, Andar sozinha/Parar); Luzes nesta ficha. [RARO] cada
10. Piso (quando a cena tem pisos). [RARO]
11. "Levar para..." outra cena/pino (TokenSceneCarryControls). [AS VEZES]
Fora do painel: o JOGADOR DONO se define na aba Jogo > Grupo (Atribuir/Emprestar); menu de contexto da ficha no mapa: Congelar/Descongelar, "Enviar mensagem...".

### 4.2 PINO (PinControls.tsx:356-470) - titulo: "Ponto de interesse" / "Pino de viagem" / "Alavanca"
- Tipo do pino: Exclamacao (!), Interrogacao (?), Viagem, Alavanca. [AS VEZES]
- Icone no mapa (grade, "Sem icone") - nao em viagem/alavanca.
- So o circulo, sem haste. Nome do local. "Descricao · o jogador le". Travado.
- Item pegavel (Nome do item, "Pega sem pedir ao mestre") - so ! e ?.
- Alcance: "Marco: todos veem" (mesmo na nevoa) / "Ler so de perto" (casas).
- Fechadura com segredo (Combinacao, Como o jogador abre, Destranca tambem uma porta, Trancar de novo).
- Peca de colecao (Peca n, De quantas, Colecao, Frase ou item inteiro).
- Loja com precos (Mercadorias nome + preco, + Mercadoria, Tirar, Sem conta).
- Cabine continua (leva a, Avancar esteiras); com aventura em pino de viagem: Fila de chamadas, Nova cabine, Trazer a cabine, Atender, Limpar a fila.
- Acoes de MESA: "Quem vem para o pino" (Reunir), "Mostrar o cartao a".
- Imagem: soltar arquivo, Escolher/Trocar/Remover.
- Animacao do Cenario (CenarioSection): Estilo (Panoramica...), Nevoa, Raios de sol, Particulas, Som do vento, Quando o jogador ve, Assistir inteira.
- Excluir pino.
- "Quem ve este pino" (PlayerSecretControls): Todos / So estes (checkbox por jogador) / Ninguem.
- Com aventura: Depende do estado.
**Pino de VIAGEM** (PinTravelControls, 48 KB): Destino (Buscar cena, "+ Cena nova..." Nome + Criar e ligar), Ir, Desligar, Passagem desta saida (livre / pede ao mestre / trancada com "Por que esta fechada" / chave "Nome do item" / Cracha / Aceita tentativas), Mao unica, Da vista, So chegada, Nome da saida, Casas em volta do pino de chegada, Fichas com passe / Item do passe, Criar pino de chegada, Preso a ficha (veiculo), Transicao especial (Nenhuma / Chega direto / galeria + Assistir inteira).
**Alavanca**: porta ligada ("Abre a porta"), "Acionar agora".
Freq: ! e viagem [SEMPRE] na preparacao; fechadura/colecao/loja/cabine [RARO].

### 4.3 PORTA (PropertiesPanel.tsx:830-847)
- WallDoorControls: Aberta, Trancada, Secreta (+ Revelar passagem), Jogador pode espiar, Abre com (item; vazio = so o mestre abre), Abre por: Os dois lados / So deste lado + Trocar o lado, Animacao ao abrir, Virar parede solida. Aberta/Trancada [SEMPRE] no jogo
- Tipo de porta: Normal / Dupla / Portao. [RARO]
- Com aventura: Depende do estado. [RARO]
- Depois a secao Parede. Menu de contexto da porta no mapa: Abrir/Fechar, Trancar/Destrancar, Deixar espiar.

### 4.4 PAREDE (WallStyleControls, :829)
Cor + Padrao, Espessura + Ajuste fino, Parede interna, Janela, Deixa passar, Deixa ver, Avancado: Ponta e canto; "Virar porta". Parede presa a desenho: aviso + Selecionar desenho / Soltar paredes. [AS VEZES]

### 4.5 ESCADA (:980-1006)
Sentido: Sobe / Desce; Forma: Reta / Espiral; Tamanho: Pequena / Media / Grande; Passagem da escada; Leva a (outra cena); Piso + Leva ao piso; Transicao especial; Oculto para jogadores / Revelar para. [AS VEZES]

### 4.6 SALA (RoomControls.tsx:623-886 + blocos seguintes)
- Sala: "Dentro de: mae", Nome, Titulo no mapa (tamanho, cor, fundo, orientacao), Largura/Altura (px, retangulo reto), Rotacao (-90/+90).
- Interruptores (cada um com paragrafo de ajuda): Jogadores veem o nome, Teto fechado para jogadores, Comodo (so depois de visto), Sala escura, De dentro ve la fora, De fora ve aqui dentro.
- Opcionais "+" (uma linha ate preencher): Ao entrar o jogador le, Nota do mestre, Faccao, Raio de visao aqui, Perigo, Esteira, Criar sala dentro, Abrir para o corredor.
- "Sala" (ItemTransformControls): Travado + Oculto para jogadores.
- Regiao (cor, hachura, contorno), Preenchimento, "Pintar parte da sala de outra cor" (segunda cor, direcao, onde corta), Avancado (cantos, Suavizar contorno). [flag off: Gatilho, Por fogo/agua]
Freq: Nome/Ao entrar [SEMPRE] na preparacao; interruptores [AS VEZES]; resto [RARO]. E o painel mais longo do app.

### 4.7 REGIAO (nao-sala): estilo, Preenchimento, Travado/Oculto para jogadores, Avancado. [RARO]
### 4.8 LUZ (LightControls): Cor, Intensidade, Prender na ficha / Soltar, Vista de longe; com aventura Depende do estado. [AS VEZES]
### 4.9 OBJETO / PECA / MOBILIA (:848-870): Movel (Tipo, Vista, Preencher) OU Item no chao (Nome do item, Quantidade, Pega sem pedir); Rotacao, Travado, Oculto no editor, Oculto para jogadores; Camada do objeto; Para os jogadores: Rotulo (ex. Guarda-roupa), Mostrar imagem ao jogador. [AS VEZES]
### 4.10 DESENHO: Cor, Espessura, Preenchido, Opacidade, Ponta/Traco, Formato da linha (Reta/Curva), Paredes ao redor (Aparencia, Passagem, Soltar), Oculto para jogadores. [RARO]
### 4.11 TEXTO: texto, Cor, Tamanho da fonte, Fonte, Oculto para jogadores. [RARO]
### 4.12 PECA DE CHAO (FloorPieceControls): Centro X/Y, Largura/Altura ou Raios, Lados, Rotacao, Arredondar, Borda irregular (Intensidade, Dente, Semente), Somar/Subtrair, Cor desta peca / Voltar a cor do chao, Descer/Subir, Travar, Apagar. [RARO]
### 4.13 ZONA OCULTA: Nome, "Revelar para jogadores", Excluir zona; com aventura Depende do estado. [AS VEZES] no jogo
### 4.14 PERIGO: opcional "Perigo" dentro da Sala (HazardControls: tipo, Avancar um passo); botoes Por fogo/Por agua atras de flag DESLIGADA. [RARO]
### 4.15 CAMINHO ja tracado: cai em Estilo de desenho (cor + espessura). [RARO]

---------------------------------------------------------------------
## 5. PAINEL DO JOGADOR (J) - player/PlayerPanel.tsx (player/main.tsx monta o resto da tela)

### 5.1 Barra de cima (PlayerPanel.tsx:638-704) - sempre visivel, mesmo com o painel recolhido
| Botao | O que faz | Freq |
|---|---|---|
| "Painel" (chevron) | abre/fecha o painel; ponto de mencao nova no chat | [SEMPRE] |
| "Minha ficha" (mira) | centraliza a camera na ficha | [SEMPRE] |
| "Inventario" + tecla I | abre o dialogo do inventario (PlayerInventory) | [SEMPRE] |
| "Ficha" | abre a ficha de personagem do sistema de RPG (PlayerFicha) | [AS VEZES] |
Abaixo de 380 px so os icones.

### 5.2 Abas: Jogo | Caderno | Lugares | Dados | Chat (Chat so quando ha chat)

### 5.3 Aba JOGO (PlayerPanel.tsx:730-917), na ordem
| Bloco | O que faz | Freq |
|---|---|---|
| MEUS PERSONAGENS | bolinha da cor + nome; clicar centraliza; fichas em outra cena "Em outro lugar · sala" (olhar por ela); acordo ("Emprestado pelo mestre") | [SEMPRE] |
| Sinalizar (toggle "Toque no mapa...") + dica "No PC: Alt+clique ou segure o clique parado." | ping | [SEMPRE] |
| Marcacoes (menu) | Marcar/Mudar/Cancelar destino, Anotar, Deixar marca aqui..., Tirar marca | [AS VEZES] |
| Medir (toggle) + dica | regua | [AS VEZES] |
| Laser (toggle) + dica | aponta para quem esta na cena | [AS VEZES] |
| Mostrar meu mapa a... | colega da cena ve o seu mapa | [RARO] |
| Volto ja + explicacao | ausencia rapida | [RARO] |
| Sair (confirma; so com conta) | sai da sala e do aparelho | [RARO] |
| COMIGO (PlayerBackpack) | "Nada com voce.", Dar a..., Pagar a..., Quantas moedas | [AS VEZES] |
| GRUPO | colegas e onde estao ("So voce na mesa.") | [AS VEZES] |
| MEU PERSONAGEM (quando ha) | Nome, Foto (arquivo), Esconder (pede ao mestre) | [RARO] |
| VISAO | Brilho do explorado (slider %), Grade, Nomes, Camera segue minha ficha | [RARO] |
### 5.4 Aba CADERNO: Minhas notas (lista, ir ate, apagar); Levar para casa ("Baixar meu caderno"). [RARO]
### 5.5 Aba LUGARES: Pontos conhecidos, Onde ja estive (miniaturas, renomear, "Voce esta aqui"), Minhas pistas por lugar. [AS VEZES]
### 5.6 Aba DADOS: Tipo de dado, Quantidade, Modificador, Rolar escondido, Rolar; rolagens. [AS VEZES]
### 5.7 Aba CHAT (PlayerChat): Canal, mensagem, Mencionar. [SEMPRE]
### 5.8 Fora do painel (player/main.tsx): Chamar o mestre (mao + Motivo), zoom (Aproximar/Afastar), Centralizar a ficha, abas de Andares do predio, relogio, faixa de turno/confronto, alarme, cartoes (pino, ficha, item, marca, nota, pista, troca, teste secreto), Escada, Ferrolho, Espiar porta, menu de acoes no ponto, controle de som, feed de dados, Reconectando. Nao inventariados controle a controle.

---------------------------------------------------------------------
## 6. Resumo de frequencia (para priorizar)
**Toda hora (mestre):** + Token; faixa da selecao (Apagar); ficha: Nome, Vida, Condicoes, Congelado/Oculto; porta: Aberta/Trancada; Locais; Objetos do mapa (Ctrl+K); Acervo de tokens (arrastar NPC); barra: Selecionar, Sala, Pino, Parede/Porta; direita: Codigo+Laser, Grupo, Chat, Cenas.
**As vezes:** Pinos, Chao do mapa, Camadas, Visao de jogador, Livro de regras, Personagens, Som, Teste secreto, Ver todas as cenas, Zona oculta/Pincel de revelar, Medir, Borracha, Desenho, Escada.
**Raro:** Engrenagem, Territorio, Agenda, Estado do mundo, Camadas do chao, Marcas, Acervo de itens, Contas dos jogadores, Rede local (paragrafo fixo), Tela da mesa, Diario de viagem, Ruido, quase todo o Comportamento da ficha, opcionais da Sala, peca de chao, texto.
**Jogador toda hora:** Painel, Minha ficha, Inventario, Sinalizar, Chat, Meus personagens. Raro: Visao, Caderno, Volto ja, Mostrar meu mapa, Meu personagem.

## 7. Atritos visiveis no codigo/prints (insumo de design, nao proposta de fix)
- Esquerda: 5 papeis na mesma coluna; navegacao (Aventura/Esta cena) e bibliotecas competem com o inspetor; secoes de mapa so somem/aparecem pelo "momento de mapa".
- Icone de expandir parece "tela cheia" mas e "Ver todas as cenas"; nome do mapa truncado.
- Acervo de tokens sempre no fim do scroll, longe quando ha ficha aberta (o proprio comentario do codigo admite, :467-472).
- Direita sem sala: "Rede local" e paragrafo fixo; "Livro de regras" parece texto solto; Personagens/Contas viram listas longas; nomes cortados.
- Toolbar: 22 botoes, 14 no grupo de construcao, 4 formas de sala + Regiao; quase tudo com setinha.
- Sala e Token sao paineis muito longos (dezenas de controles + paragrafos de ajuda sempre abertos).
- Jogador: 6 botoes de largura total com o mesmo peso (Sinalizar, Marcacoes, Medir, Laser, Mostrar meu mapa, Volto ja); toggles parecem botoes comuns; dica de texto entre cada um.

## Pontas soltas
- ScenesSection (81 KB) e GrupoCompacto (35 KB): inventariados pelos rotulos, nao linha a linha.
- MapSettingsDialog: secoes pelos componentes montados; Texto de chegada, Categorias do painel e Sistema de RPG nao abertos.
- Dialogos grandes fora: Ficha de personagem (mestre e jogador), Inventario do jogador, Visao geral das cenas, Livro de regras, Editor de sistema.
- Posicao da ActionBar na tela nao confirmada (sem print).
- Grafo (graphify) nao consultado: mapa saiu de leitura direta + rg.
- Working tree com mudancas nao commitadas (PinControls, cenario/, mapFile...): o inventario reflete o estado de hoje.
