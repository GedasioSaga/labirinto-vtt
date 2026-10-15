# Onde foi parar cada controle

Gerado por `scripts/onde-foi-parar-doc.mjs` a partir de `client/e2e/helpers/ondeFoiParar.ts`; não edite à mão.
O spec `client/e2e/ui-onde-foi-parar.spec.ts` alcança cada linha no app pelo caminho anotado (fatia 0 do
`docs/design/consolidado/PLANO.md`). A fatia que muda um controle de lugar troca o caminho na lista e roda o gerador.

"Hoje" é o layout de 15/10/2026; "Vai para" vem do protótipo consolidado (ONDE do `app.js` + PLANO §1).

## Mestre (editor, 1440x900)

### Cabeçalho da esquerda

Parte de: editor aberto, Selecionar, nada selecionado. Vai para: Topo do livro do mestre. Fatia: 2.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Logo e nome do app | heading "Labirinto" | (coluna da esquerda) | (do bloco) |
| + Token | button "Adicionar token" | (coluna da esquerda) | (do bloco) |
| Campo do novo token | textbox "Nome do novo token" | (coluna da esquerda) > clicar button "Adicionar token" | (do bloco) |
| Adicionar (novo token) | button "Adicionar" | (coluna da esquerda) > clicar button "Adicionar token" | (do bloco) |
| Cancelar (novo token) | button "Cancelar" | (coluna da esquerda) > clicar button "Adicionar token" | (do bloco) |
| Ver todas as cenas (ícone de expandir) | button "Ver todas as cenas" | (coluna da esquerda) | Chip da cena, "Ver todas as cenas" (fatia 3) |
| Engrenagem (Configurações do mapa) | button "Configurações do mapa" | (coluna da esquerda) | (do bloco) |
| Faixa "Nada selecionado" | button "Nada selecionado" | (coluna da esquerda) | Página Ficha, vazio com atalhos (fatia 7) |

### Ações do mapa

Parte de: editor aberto. Vai para: Topo do livro do mestre (ícones) e menu Arquivo. Fatia: 2.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Desfazer | button "Desfazer (Ctrl+Z)" | (barra de ações) | (do bloco) |
| Refazer | button "Refazer (Ctrl+Y)" | (barra de ações) | (do bloco) |
| Salvar | button "Salvar" | (barra de ações) | (do bloco) |
| Abrir... | button "Abrir..." | (barra de ações) | Menu Arquivo |
| Imagem de fundo (sem imagem: importar) | button "Importar imagem de fundo" | (barra de ações) | Menu Arquivo |
| Exportar mapa (pasta) | button "Exportar mapa (pasta)" | (barra de ações) | Menu Arquivo |
| Exportar imagem (PNG) | button "Exportar imagem (PNG)" | (barra de ações) | Menu Arquivo |
| Importar mapa (pasta) | button "Importar mapa (pasta)" | (barra de ações) | Menu Arquivo |
| Início | button "Início" | (barra de ações) | Menu Arquivo, "Voltar ao início" |
| Atalhos do teclado (?) | button "Atalhos do teclado (?)" | (barra de ações) | Ícone "?" no topo do livro |

### Grupo Aventura

Parte de: editor com aventura, nada selecionado. Vai para: Marcador Aventura do livro do mestre. Fatia: 2 (casca) e 18 (restilo).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Pinos: busca | searchbox "Buscar pino" | (coluna da esquerda) > clicar button "Pinos" | (do bloco) |
| Pinos: pino da lista (abre a cena) | button "Altar Cripta" | (coluna da esquerda) > clicar button "Pinos" | (do bloco) |
| Agenda: Próximo apito | button "Próximo apito" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: Próximo dia | button "Próximo dia" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: nome do evento | textbox "Evento" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: dia | spinbutton "Dia" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: apito | combobox "Apito" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: Soar alarme ao disparar | checkbox "Soar alarme ao disparar" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Agenda: Marcar | button "Marcar" | (coluna da esquerda) > clicar button "Agenda" | (do bloco) |
| Estado do mundo: Novo estado | button "Novo estado" | (coluna da esquerda) > clicar button "Estado do mundo" | (do bloco) |

### Grupo Esta cena

Parte de: editor com aventura, Selecionar, nada selecionado. Vai para: Marcador Cena do livro do mestre, em fichas recolhíveis. Fatia: 2 (casca) e 18 (restilo).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Objetos do mapa: busca | searchbox "Buscar objeto" | (coluna da esquerda) > clicar button "Objetos do mapa" | Busca do topo do marcador Cena |
| Objetos do mapa: Ctrl+K põe o cursor na busca | searchbox "Buscar objeto" | (coluna da esquerda) > tecla Control+k | Ctrl+K foca a busca da página Cena |
| Objetos do mapa: item da lista (Ir até lá) | button "Goblin" | (coluna da esquerda) > clicar button "Objetos do mapa" | (do bloco) |
| Locais: sala da árvore (enquadra) | button "Salão" | (coluna da esquerda) > clicar button "Locais" | (do bloco) |
| Território: Quem manda aqui | checkbox "Quem manda aqui" | (coluna da esquerda) > clicar button "Território" | (do bloco) |
| Território: Alerta da cena | radiogroup "Alerta da cena" | (coluna da esquerda) > clicar button "Território" | (do bloco) |
| Chão do mapa: Cor do chão | textbox "Cor do chão" | (coluna da esquerda) > clicar button "Chão do mapa" | (do bloco) |
| Chão do mapa: conta-gotas da cor | button "Pegar do mapa a cor do chão" | (coluna da esquerda) > clicar button "Chão do mapa" | (do bloco) |
| Chão do mapa: Contorno | checkbox "Contorno" | (coluna da esquerda) > clicar button "Chão do mapa" | (do bloco) |
| Camadas: Mostrar grade | checkbox "Mostrar grade" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Token no centro | checkbox "Grudar Token no centro" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Parede na grade | checkbox "Grudar Parede na grade" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: Grudar Objeto na grade | checkbox "Grudar Objeto na grade" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Paredes | button "Ocultar Paredes" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Paredes | button "Travar Paredes" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Portas | button "Ocultar Portas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Portas | button "Travar Portas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Salas | button "Ocultar Salas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Salas | button "Travar Salas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Escadas | button "Ocultar Escadas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Escadas | button "Travar Escadas" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Objetos | button "Ocultar Objetos" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Objetos | button "Travar Objetos" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Decoração | button "Ocultar Decoração" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Decoração | button "Travar Decoração" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Iluminação | button "Ocultar Iluminação" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Iluminação | button "Travar Iluminação" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Tokens | button "Ocultar Tokens" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Tokens | button "Travar Tokens" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: olho de Anotações | button "Ocultar Anotações" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |
| Camadas: trava de Anotações | button "Travar Anotações" | (coluna da esquerda) > clicar button "Camadas" | (do bloco) |

### Camadas do chão

Parte de: peça de chão selecionada. Vai para: Marcador Cena, ficha Camadas do chão (nota "ir: cena" com a ferramenta Chão). Fatia: 7 e 18.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Camadas do chão: lista das peças | heading "Camadas do chão" | (coluna da esquerda) | (do bloco) |

### Acervos

Parte de: editor aberto. Vai para: Marcador Acervo, Tokens e Itens lado a lado. Fatia: 2 (casca) e 18 (restilo).

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Acervo de tokens | heading "Acervo de tokens" | (coluna da esquerda) | (do bloco) |
| Acervo de tokens: + Pasta | button "Nova pasta" | (coluna da esquerda) | (do bloco) |
| Acervo de itens | region "Itens" | (coluna da esquerda) | (do bloco) |
| Acervo de itens: Categorias | button "Categorias" | (coluna da esquerda) | (do bloco) |
| Acervo de itens: Novo item | button "Novo item" | (coluna da esquerda) | (do bloco) |

### Botões da barra

Parte de: editor aberto. Vai para: Barra nova: Escolher / Construir / Terreno / Esconder e revelar / Anotar (Sala junta 5 formas, Objeto junta mobília e peça). Fatia: 6.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Selecionar | button "Selecionar" | (barra de ferramentas) | (do bloco) |
| Parede | button "Parede" | (barra de ferramentas) | (do bloco) |
| Porta | button "Porta" | (barra de ferramentas) | (do bloco) |
| Luz | button "Luz" | (barra de ferramentas) | (do bloco) |
| Região | button "Região" | (barra de ferramentas) | (do bloco) |
| Sala | button "Sala" | (barra de ferramentas) | (do bloco) |
| Sala Circular | button "Sala Circular" | (barra de ferramentas) | (do bloco) |
| Polígono Regular | button "Polígono Regular" | (barra de ferramentas) | (do bloco) |
| Sala livre | button "Sala livre" | (barra de ferramentas) | (do bloco) |
| Chão | button "Chão" | (barra de ferramentas) | (do bloco) |
| Caminho | button "Caminho" | (barra de ferramentas) | (do bloco) |
| Penhasco | button "Penhasco" | (barra de ferramentas) | (do bloco) |
| Texturas | button "Texturas" | (barra de ferramentas) | (do bloco) |
| Carimbos | button "Carimbos" | (barra de ferramentas) | (do bloco) |
| Escada | button "Escada" | (barra de ferramentas) | (do bloco) |
| Peça | button "Peça" | (barra de ferramentas) | (do bloco) |
| Zona oculta | button "Zona oculta" | (barra de ferramentas) | (do bloco) |
| Pincel de revelar | button "Pincel de revelar" | (barra de ferramentas) | (do bloco) |
| Objetos | button "Objetos" | (barra de ferramentas) | (do bloco) |
| Desenho | button "Desenho" | (barra de ferramentas) | (do bloco) |
| Texto | button "Texto" | (barra de ferramentas) | (do bloco) |
| Pino | button "Pino" | (barra de ferramentas) | (do bloco) |
| Medir | button "Medir" | (barra de ferramentas) | (do bloco) |
| Borracha | button "Borracha" | (barra de ferramentas) | (do bloco) |

### Variantes da barra (setinhas)

Parte de: editor aberto. Vai para: Cantinho do botão (clique direito ou segurar) + ficha da ferramenta. Fatia: 6.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Parede: Tipo de parede | radiogroup "Tipo de parede" | (tela) > clicar button "Opções de Parede" | (do bloco) |
| Porta: Tipo de porta | radiogroup "Tipo de porta" | (tela) > clicar button "Opções de Porta" | (do bloco) |
| Região: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Região" | (do bloco) |
| Sala: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Sala" | (do bloco) |
| Sala Circular: Preenchimento | radiogroup "Preenchimento" | (tela) > clicar button "Opções de Sala Circular" | (do bloco) |
| Polígono Regular: Lados do polígono | radiogroup "Lados do polígono" | (tela) > clicar button "Opções de Polígono Regular" | (do bloco) |
| Sala livre: Criar (Sala / Parede) | radiogroup "Criar" | (tela) > clicar button "Opções de Sala livre" | (do bloco) |
| Sala livre: Arredondar | radiogroup "Arredondar" | (tela) > clicar button "Opções de Sala livre" | (do bloco) |
| Chão: Forma | radiogroup "Forma" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Tinta | radiogroup "Tinta" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Tamanho do pincel | radiogroup "Tamanho do pincel" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Chão: Operação | radiogroup "Operação" | (tela) > clicar button "Opções de Chão" | (do bloco) |
| Escada: Tamanho | radiogroup "Tamanho" | (tela) > clicar button "Opções de Escada" | (do bloco) |
| Objetos: Barril | radio "Barril" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Caixa | radio "Caixa" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Baú | radio "Baú" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Cama | radio "Cama" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Mesa | radio "Mesa" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Cadeira | radio "Cadeira" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Cerca | radio "Cerca" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Armário de cozinha | radio "Armário de cozinha" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Aparador | radio "Aparador" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Fogueira | radio "Fogueira" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Objetos: Tapete | radio "Tapete" | (tela) > clicar button "Opções de Objetos" | (do bloco) |
| Desenho: Forma (7 formas) | radiogroup "Forma" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Desenho: Modo (Traço livre / Balde) | radiogroup "Modo" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Desenho: Textura do traço | radiogroup "Textura do traço" | (tela) > clicar button "Opções de Desenho" | (do bloco) |
| Borracha: Modo | radiogroup "Modo" | (tela) > clicar button "Opções de Borracha" | (do bloco) |

### Ficha da ferramenta: Parede

Parte de: ferramenta Parede armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Parede | heading "Parede" | (coluna da esquerda) | (do bloco) |
| Parede interna | checkbox "Parede interna" | (coluna da esquerda) | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Porta

Parte de: ferramenta Porta armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Porta | heading "Ferramenta · Porta" | (coluna da esquerda) | (do bloco) |
| Abrir na parede | radiogroup "Abrir na parede" | (coluna da esquerda) | (do bloco) |
| Tipo de porta | radiogroup "Tipo de porta" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Luz

Parte de: ferramenta Luz armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Luz | heading "Ferramenta · Luz" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Região

Parte de: ferramenta Região armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Região | heading "Região" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (coluna da esquerda) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Sala

Parte de: ferramenta Sala armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Sala | heading "Ferramenta · Sala" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (coluna da esquerda) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Chão

Parte de: ferramenta Chão armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Chão | heading "Ferramenta · Chão" | (coluna da esquerda) | (do bloco) |
| Chão do mapa | button "Chão do mapa" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Caminho

Parte de: ferramenta Caminho armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Caminho | heading "Ferramenta · Caminho" | (coluna da esquerda) | (do bloco) |
| Cor deste caminho | textbox "Cor deste caminho" | (coluna da esquerda) | (do bloco) |
| Largura | slider "Largura" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Penhasco

Parte de: ferramenta Penhasco armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (biblioteca em grade de cartões). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Penhasco | heading "Ferramenta · Penhasco" | (coluna da esquerda) | (do bloco) |
| Ao riscar | radiogroup "Ao riscar" | (coluna da esquerda) | (do bloco) |
| Largura do pincel | radiogroup "Largura do pincel" | (coluna da esquerda) | (do bloco) |
| Altura do penhasco | radiogroup "Altura do penhasco" | (coluna da esquerda) | (do bloco) |
| Ligar o relevo | button "Ligar o relevo" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Texturas

Parte de: ferramenta Texturas armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (biblioteca em grade de cartões). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Texturas | heading "Ferramenta · Texturas" | (coluna da esquerda) | (do bloco) |
| Ao pintar | radiogroup "Ao pintar" | (coluna da esquerda) | (do bloco) |
| Textura | radiogroup "Textura" | (coluna da esquerda) | (do bloco) |
| Colar ou soltar a imagem da nova textura | region "Colar ou soltar a imagem da nova textura" | (coluna da esquerda) | (do bloco) |
| Escolher imagem… | button "Escolher imagem…" | (coluna da esquerda) | (do bloco) |
| Procurar texturas novas | button "Procurar texturas novas" | (coluna da esquerda) | (do bloco) |
| Tamanho do pincel | slider "Tamanho do pincel" | (coluna da esquerda) | (do bloco) |
| Força | slider "Força" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Carimbos

Parte de: ferramenta Carimbos armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (biblioteca em grade de cartões). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Carimbos | heading "Ferramenta · Carimbos" | (coluna da esquerda) | (do bloco) |
| Ao clicar | radiogroup "Ao clicar" | (coluna da esquerda) | (do bloco) |
| Objeto | radiogroup "Objeto" | (coluna da esquerda) | (do bloco) |
| Árvore | radio "Árvore" | (coluna da esquerda) | (do bloco) |
| Colar ou soltar a imagem do novo carimbo | region "Colar ou soltar a imagem do novo carimbo" | (coluna da esquerda) | (do bloco) |
| Escolher imagem… | button "Escolher imagem…" | (coluna da esquerda) | (do bloco) |
| Procurar carimbos novos | button "Procurar carimbos novos" | (coluna da esquerda) | (do bloco) |
| Tamanho | slider "Tamanho" | (coluna da esquerda) | (do bloco) |
| Largura do spray | slider "Largura do spray" | (coluna da esquerda) | (do bloco) |
| Densidade do spray | slider "Densidade do spray" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Escada

Parte de: ferramenta Escada armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Escada | heading "Ferramenta · Escada" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Peça

Parte de: ferramenta Peça armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Peça | heading "Ferramenta · Peça" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Zona oculta

Parte de: ferramenta Zona oculta armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Zona oculta | heading "Ferramenta · Zona oculta" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Pincel de revelar

Parte de: ferramenta Pincel de revelar armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pincel de revelar | heading "Ferramenta · Pincel de revelar" | (coluna da esquerda) | (do bloco) |
| Ao pintar | radiogroup "Ao pintar" | (coluna da esquerda) | (do bloco) |
| Largura do pincel | radiogroup "Largura do pincel" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Objetos

Parte de: ferramenta Objetos armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Objetos | heading "Ferramenta · Objetos" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Desenho

Parte de: ferramenta Desenho armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pincel | heading "Ferramenta · Pincel" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Espessura | slider "Espessura" | (coluna da esquerda) | (do bloco) |
| Ponta da linha | radiogroup "Ponta da linha" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Texto

Parte de: ferramenta Texto armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Texto | heading "Ferramenta · Texto" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Tamanho da fonte | slider "Tamanho da fonte" | (coluna da esquerda) | (do bloco) |
| Fonte | combobox "Fonte" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Pino

Parte de: ferramenta Pino armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Pino | heading "Ferramenta · Pino" | (coluna da esquerda) | (do bloco) |
| Tipo do pino | radiogroup "Tipo do pino" | (coluna da esquerda) | (do bloco) |
| Ícone no mapa | radiogroup "Ícone no mapa" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Medir

Parte de: ferramenta Medir armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Medir | heading "Ferramenta · Medir" | (coluna da esquerda) | (do bloco) |

### Ficha da ferramenta: Borracha

Parte de: ferramenta Borracha armada, nada selecionado. Vai para: Página Ficha, ficha da ferramenta (cabeça com dica e kbd). Fatia: 7.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Ferramenta · Borracha | heading "Ferramenta · Borracha" | (coluna da esquerda) | (do bloco) |

### Faixa da seleção

Parte de: token selecionado no mapa. Vai para: Cabeça da ficha (Apagar e "Mais ações"). Fatia: 8.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar | button "Apagar token selecionado" | (coluna da esquerda) | (do bloco) |
| Mais ações | button "Mais ações" | (coluna da esquerda) | (do bloco) |

### Ficha do token

Parte de: token selecionado no mapa. Vai para: Página Ficha: Tipo de ficha, Nome, Condições, No mapa, Levar para outra cena, cartões de Comportamento. Fatia: 9.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome | textbox "Nome" | (coluna da esquerda) | (do bloco) |
| Nome para os jogadores | radiogroup "Nome para os jogadores" | (coluna da esquerda) | (do bloco) |
| Vida atual | spinbutton "Vida atual" | (coluna da esquerda) | Sai na fatia 9; a vida vem da ficha do sistema (fatia 10, D) |
| Vida máxima | spinbutton "Vida máxima" | (coluna da esquerda) | Sai na fatia 9; a vida vem da ficha do sistema (fatia 10, D) |
| Tamanho da ficha | radiogroup "Tamanho da ficha" | (coluna da esquerda) | (do bloco) |
| Condição: Envenenado | button "Envenenado" | (coluna da esquerda) > clicar button "Condições" | (do bloco) |
| Condição: Caído | button "Caído" | (coluna da esquerda) > clicar button "Condições" | (do bloco) |
| Condição: Dormindo | button "Dormindo" | (coluna da esquerda) > clicar button "Condições" | (do bloco) |
| Condição: Atordoado | button "Atordoado" | (coluna da esquerda) > clicar button "Condições" | (do bloco) |
| Condição: Invisível | button "Invisível" | (coluna da esquerda) > clicar button "Condições" | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Congelado | checkbox "Congelado" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Avançado: Rotação | spinbutton "Rotação" | (coluna da esquerda) > clicar button "Avançado" | (do bloco) |
| Avançado: Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) > clicar button "Avançado" | (do bloco) |
| Cor da ficha | radiogroup "Cor da ficha" | (coluna da esquerda) | (do bloco) |
| Escolher imagem... | button "Escolher imagem..." | (coluna da esquerda) | (do bloco) |
| Salvar no acervo | button "Salvar no acervo" | (coluna da esquerda) | (do bloco) |
| Ficha de NPC | checkbox "Ficha de NPC" | (coluna da esquerda) | (do bloco) |
| Ficha de jogador | checkbox "Ficha de jogador" | (coluna da esquerda) | (do bloco) |
| Personagem | combobox "Personagem" | (coluna da esquerda) | (do bloco) |
| Esta ficha vigia | checkbox "Esta ficha vigia" | (coluna da esquerda) | (do bloco) |
| Patrulha: Marcar ponto aqui | button "Marcar ponto aqui" | (coluna da esquerda) > clicar button "Patrulha" | (do bloco) |
| Patrulha: Patrulhar sozinha | button "Patrulhar sozinha" | (coluna da esquerda) > clicar button "Patrulha" | (do bloco) |
| Patrulha: Avançar patrulha | button "Avançar patrulha" | (coluna da esquerda) > clicar button "Patrulha" | (do bloco) |
| Esta ficha é um veículo | checkbox "Esta ficha é um veículo" | (coluna da esquerda) | (do bloco) |
| Piso | spinbutton "Piso" | (coluna da esquerda) | (do bloco) |

### Ficha do pino (!)

Parte de: pino de exclamação selecionado. Vai para: Página Ficha do pino: essencial + "+ Adicionar ao pino" + Mais da viagem, Aparência, Na mesa. Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo do pino | radiogroup "Tipo do pino" | (coluna da esquerda) | (do bloco) |
| Só o círculo, sem haste | checkbox "Só o círculo, sem haste" | (coluna da esquerda) | (do bloco) |
| Nome do local | textbox "Nome do local" | (coluna da esquerda) | (do bloco) |
| Descrição · o jogador lê | textbox "Descrição · o jogador lê" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Marco: todos veem | checkbox "Marco: todos veem" | (coluna da esquerda) | (do bloco) |
| Ler só de perto | checkbox "Ler só de perto" | (coluna da esquerda) | (do bloco) |
| Fechadura com segredo | checkbox "Fechadura com segredo" | (coluna da esquerda) | (do bloco) |
| Peça de coleção | checkbox "Peça de coleção" | (coluna da esquerda) | (do bloco) |
| Escolher imagem... | button "Escolher imagem..." | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Ícone no mapa | radiogroup "Ícone no mapa" | (coluna da esquerda) | (do bloco) |
| Item pegável | checkbox "Item pegável" | (coluna da esquerda) | (do bloco) |
| Loja com preços | checkbox "Loja com preços" | (coluna da esquerda) | (do bloco) |
| Cabine contínua: leva a | combobox "Cabine contínua: leva a" | (coluna da esquerda) | (do bloco) |
| Animação do Cenário | heading "Animação do Cenário" | (coluna da esquerda) | (do bloco) |
| Excluir ponto de interesse | button "Excluir ponto de interesse" | (coluna da esquerda) | (do bloco) |

### Ficha do pino de viagem

Parte de: pino de viagem selecionado. Vai para: Página Ficha do pino, ficha "Mais da viagem". Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Leva a… | button "Leva a…" | (coluna da esquerda) | (do bloco) |
| Passagem | radiogroup "Passagem" | (coluna da esquerda) | (do bloco) |
| Transição ao atravessar | heading "Transição ao atravessar" | (coluna da esquerda) | (do bloco) |
| Nenhuma Chega direto | button "Nenhuma Chega direto" | (coluna da esquerda) | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (coluna da esquerda) | (do bloco) |
| Preso à ficha | combobox "Preso à ficha" | (coluna da esquerda) | (do bloco) |
| Cabine (elevador, cesto) | combobox "Cabine (elevador, cesto)" | (coluna da esquerda) | (do bloco) |
| Nova cabine | textbox "Nova cabine" | (coluna da esquerda) | (do bloco) |
| Criar cabine aqui | button "Criar cabine aqui" | (coluna da esquerda) | (do bloco) |
| Excluir pino de viagem | button "Excluir pino de viagem" | (coluna da esquerda) | (do bloco) |

### Ficha da alavanca

Parte de: alavanca selecionada. Vai para: Página Ficha do pino (alavanca com "Acionar agora"). Fatia: 12.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Abre a porta | combobox "Abre a porta" | (coluna da esquerda) | (do bloco) |
| Excluir alavanca | button "Excluir alavanca" | (coluna da esquerda) | (do bloco) |

### Ficha da porta

Parte de: porta selecionada no mapa. Vai para: Página Ficha da porta: Estado, Trancada, Secreta, Espiar + Quem abre, Aparência, Parede em volta, Depende do estado. Fatia: 11.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Virar parede sólida | button "Virar parede sólida" | (coluna da esquerda) | (do bloco) |
| Aberta | checkbox "Aberta" | (coluna da esquerda) | (do bloco) |
| Trancada | checkbox "Trancada" | (coluna da esquerda) | (do bloco) |
| Jogador pode espiar | checkbox "Jogador pode espiar" | (coluna da esquerda) | (do bloco) |
| Secreta | checkbox "Secreta" | (coluna da esquerda) | (do bloco) |
| Abre por | radiogroup "Abre por" | (coluna da esquerda) | (do bloco) |
| Animação ao abrir | combobox "Animação ao abrir" | (coluna da esquerda) | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (coluna da esquerda) | (do bloco) |
| Tipo de porta | radiogroup "Tipo de porta" | (coluna da esquerda) | (do bloco) |
| Parede interna | checkbox "Parede interna" | (coluna da esquerda) | (do bloco) |
| Pegar do mapa a cor da parede | button "Pegar do mapa a cor da parede" | (coluna da esquerda) | (do bloco) |
| Cor da parede | textbox "Cor da parede" | (coluna da esquerda) | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |

### Ficha da parede

Parte de: parede selecionada no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Parede interna | checkbox "Parede interna" | (coluna da esquerda) | (do bloco) |
| Pegar do mapa a cor da parede | button "Pegar do mapa a cor da parede" | (coluna da esquerda) | (do bloco) |
| Cor da parede | textbox "Cor da parede" | (coluna da esquerda) | (do bloco) |
| Espessura da parede | radiogroup "Espessura da parede" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |
| Janela (vê, não passa) | checkbox "Janela (vê, não passa)" | (coluna da esquerda) | (do bloco) |
| Deixa passar (a ficha atravessa) | checkbox "Deixa passar (a ficha atravessa)" | (coluna da esquerda) | (do bloco) |
| Deixa ver (a visão atravessa) | checkbox "Deixa ver (a visão atravessa)" | (coluna da esquerda) | (do bloco) |
| Virar porta | button "Virar porta" | (coluna da esquerda) | (do bloco) |

### Ficha da escada

Parte de: escada selecionada no mapa. Vai para: Página Ficha da escada (Comprimento, Largura e Curva na ficha; alças no mapa). Fatia: 16b e 17.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Sentido da escada | radiogroup "Sentido da escada" | (coluna da esquerda) | (do bloco) |
| Forma da escada | radiogroup "Forma da escada" | (coluna da esquerda) | (do bloco) |
| Tamanho da escada | radiogroup "Tamanho da escada" | (coluna da esquerda) | (do bloco) |
| Comprimento | textbox "Comprimento" | (coluna da esquerda) | (do bloco) |
| Diminuir o comprimento | button "Diminuir o comprimento" | (coluna da esquerda) | (do bloco) |
| Aumentar o comprimento | button "Aumentar o comprimento" | (coluna da esquerda) | (do bloco) |
| Largura | textbox "Largura" | (coluna da esquerda) | (do bloco) |
| Diminuir a largura | button "Diminuir a largura" | (coluna da esquerda) | (do bloco) |
| Aumentar a largura | button "Aumentar a largura" | (coluna da esquerda) | (do bloco) |
| Curva | slider "Curva" | (coluna da esquerda) | (do bloco) |
| Leva a | combobox "Leva a" | (coluna da esquerda) | (do bloco) |
| Passagem da escada | radiogroup "Passagem da escada" | (coluna da esquerda) | (do bloco) |
| Criar andar de cima | button "Criar andar de cima" | (coluna da esquerda) | (do bloco) |
| Piso | spinbutton "Piso" | (coluna da esquerda) | (do bloco) |
| Leva ao piso | spinbutton "Leva ao piso" | (coluna da esquerda) | (do bloco) |
| Transição ao trocar de piso | heading "Transição ao trocar de piso" | (coluna da esquerda) | (do bloco) |
| Nenhuma Chega direto | button "Nenhuma Chega direto" | (coluna da esquerda) | (do bloco) |
| Procurar animações novas | button "Procurar animações novas" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |

### Ficha da sala

Parte de: sala selecionada no mapa. Vai para: Página Ficha da sala: Sala, O que veem, Acrescentar, Aparência, Medidas e título, Trava. Fatia: 15.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome | textbox "Nome" | (coluna da esquerda) | (do bloco) |
| Fundo do título | checkbox "Fundo do título" | (coluna da esquerda) | (do bloco) |
| Tamanho do título | slider "Tamanho do título" | (coluna da esquerda) | (do bloco) |
| Cor do título | textbox "Cor do título" | (coluna da esquerda) | (do bloco) |
| Orientação do título | radiogroup "Orientação do título" | (coluna da esquerda) | (do bloco) |
| Largura | spinbutton "Largura" | (coluna da esquerda) | (do bloco) |
| Altura | spinbutton "Altura" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| −90° | button "−90°" | (coluna da esquerda) | (do bloco) |
| +90° | button "+90°" | (coluna da esquerda) | (do bloco) |
| Jogadores veem o nome | checkbox "Jogadores veem o nome" | (coluna da esquerda) | (do bloco) |
| Teto fechado para jogadores | checkbox "Teto fechado para jogadores" | (coluna da esquerda) | (do bloco) |
| Cômodo: aparece só depois de visto | checkbox "Cômodo: aparece só depois de visto" | (coluna da esquerda) | (do bloco) |
| Sala escura | checkbox "Sala escura" | (coluna da esquerda) | (do bloco) |
| De dentro, vê lá fora | checkbox "De dentro, vê lá fora" | (coluna da esquerda) | (do bloco) |
| De fora, vê aqui dentro | checkbox "De fora, vê aqui dentro" | (coluna da esquerda) | (do bloco) |
| Ao entrar, o jogador lê | button "Ao entrar, o jogador lê" | (coluna da esquerda) | (do bloco) |
| Nota do mestre | button "Nota do mestre" | (coluna da esquerda) | (do bloco) |
| Facção | button "Facção" | (coluna da esquerda) | (do bloco) |
| Raio de visão aqui | button "Raio de visão aqui" | (coluna da esquerda) | (do bloco) |
| Perigo | button "Perigo" | (coluna da esquerda) | (do bloco) |
| Esteira | button "Esteira" | (coluna da esquerda) | (do bloco) |
| Criar sala dentro | button "Criar sala dentro" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (coluna da esquerda) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |
| Criar parede na borda | button "Criar parede na borda" | (coluna da esquerda) | (do bloco) |
| Pintar parte da sala de outra cor | checkbox "Pintar parte da sala de outra cor" | (coluna da esquerda) | (do bloco) |
| Mais ações: levar ao piso | menuitem "/^Levar ao/" | (coluna da esquerda) > clicar button "Mais ações" | "Mais ações" da cabeça da ficha (fatia 8) |

### Ficha da região (não sala)

Parte de: região selecionada no mapa. Vai para: Página Ficha, gramática nova. Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Hachurado | checkbox "Hachurado" | (coluna da esquerda) | (do bloco) |
| Espessura do contorno | radiogroup "Espessura do contorno" | (coluna da esquerda) | (do bloco) |
| Ajuste fino | slider "Ajuste fino" | (coluna da esquerda) | (do bloco) |
| Preenchido | checkbox "Preenchido" | (coluna da esquerda) | (do bloco) |
| Avançado | button "Avançado" | (coluna da esquerda) | (do bloco) |
| Criar parede na borda | button "Criar parede na borda" | (coluna da esquerda) | (do bloco) |

### Ficha da luz

Parte de: luz selecionada no mapa. Vai para: Página Ficha, gramática nova. Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Intensidade | slider "Intensidade" | (coluna da esquerda) | (do bloco) |
| Prender na ficha | combobox "Prender na ficha" | (coluna da esquerda) | (do bloco) |
| Vista de longe | checkbox "Vista de longe" | (coluna da esquerda) | (do bloco) |

### Ficha da peça (imagem)

Parte de: peça de imagem selecionada. Vai para: Página Ficha, gramática nova. Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: barril

Parte de: objeto "m-barril" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: catre

Parte de: objeto "m-catre" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor do travesseiro | textbox "Cor do travesseiro" | (coluna da esquerda) | (do bloco) |
| Paleta: cor do travesseiro | radiogroup "Paleta: cor do travesseiro" | (coluna da esquerda) | (do bloco) |
| Cor do cobertor | textbox "Cor do cobertor" | (coluna da esquerda) | (do bloco) |
| Paleta: cor do cobertor | radiogroup "Paleta: cor do cobertor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: cerca

Parte de: objeto "m-cerca" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: armario

Parte de: objeto "m-armario" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Vista | radiogroup "Vista" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: aparador

Parte de: objeto "m-aparador" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Vista | radiogroup "Vista" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: fogueira

Parte de: objeto "m-fogueira" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Vista | radiogroup "Vista" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do objeto: tapete

Parte de: objeto "m-tapete" selecionado no mapa. Vai para: Página Ficha, gramática nova (decisão 4.1). Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Tipo | combobox "Tipo" | (coluna da esquerda) | (do bloco) |
| Vista | radiogroup "Vista" | (coluna da esquerda) | (do bloco) |
| Forma | radiogroup "Forma" | (coluna da esquerda) | (do bloco) |
| Preencher | checkbox "Preencher" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Cor da linha | textbox "Cor da linha" | (coluna da esquerda) | (do bloco) |
| Rotação | spinbutton "Rotação" | (coluna da esquerda) | (do bloco) |
| Travado | checkbox "Travado" | (coluna da esquerda) | (do bloco) |
| Oculto no editor | checkbox "Oculto no editor" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Camada do objeto selecionado | radiogroup "Camada do objeto selecionado" | (coluna da esquerda) | (do bloco) |
| Rótulo para jogadores | textbox "Rótulo para jogadores" | (coluna da esquerda) | (do bloco) |
| Mostrar imagem ao jogador | checkbox "Mostrar imagem ao jogador" | (coluna da esquerda) | (do bloco) |

### Ficha do desenho

Parte de: linha desenhada selecionada. Vai para: Página Ficha, gramática nova (Endireitar no "Mais ações"). Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Endireitar | button "Endireitar" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Espessura | slider "Espessura" | (coluna da esquerda) | (do bloco) |
| Paredes ao redor | checkbox "Paredes ao redor" | (coluna da esquerda) | (do bloco) |

### Ficha do texto

Parte de: texto selecionado. Vai para: Página Ficha, gramática nova. Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Rótulo de texto | heading "Rótulo de texto" | (coluna da esquerda) | (do bloco) |
| Cor | textbox "Cor" | (coluna da esquerda) | (do bloco) |
| Tamanho da fonte | slider "Tamanho da fonte" | (coluna da esquerda) | (do bloco) |
| Fonte | combobox "Fonte" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores | checkbox "Oculto para jogadores" | (coluna da esquerda) | (do bloco) |

### Ficha da peça de chão

Parte de: peça de chão selecionada. Vai para: Página Ficha, gramática nova. Fatia: 16b.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar peça de chão selecionada | button "Apagar peça de chão selecionada" | (coluna da esquerda) | (do bloco) |
| Mais ações | button "Mais ações" | (coluna da esquerda) | (do bloco) |

### Ficha da zona oculta

Parte de: zona oculta selecionada. Vai para: Página Ficha, gramática nova. Fatia: 16a.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Nome | textbox "Nome" | (coluna da esquerda) | (do bloco) |
| Revelar para jogadores | checkbox "Revelar para jogadores" | (coluna da esquerda) | (do bloco) |
| Excluir zona | button "Excluir zona" | (coluna da esquerda) | (do bloco) |

### Seleção múltipla

Parte de: token e parede selecionados juntos. Vai para: Página Ficha com 2 ou mais itens. Fatia: 8.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Apagar 2 itens selecionados | button "Apagar 2 itens selecionados" | (coluna da esquerda) | (do bloco) |
| Agrupar (Ctrl+G) | button "Agrupar (Ctrl+G)" | (coluna da esquerda) | (do bloco) |
| Limpar seleção de área | button "Limpar seleção de área" | (coluna da esquerda) | (do bloco) |
| Alinhar à esquerda | button "Alinhar à esquerda" | (coluna da esquerda) | (do bloco) |
| Alinhar ao centro | button "Alinhar ao centro" | (coluna da esquerda) | (do bloco) |
| Alinhar à direita | button "Alinhar à direita" | (coluna da esquerda) | (do bloco) |
| Alinhar ao topo | button "Alinhar ao topo" | (coluna da esquerda) | (do bloco) |
| Alinhar ao meio | button "Alinhar ao meio" | (coluna da esquerda) | (do bloco) |
| Alinhar à base | button "Alinhar à base" | (coluna da esquerda) | (do bloco) |
| Distribuir na horizontal | button "Distribuir na horizontal" | (coluna da esquerda) | (do bloco) |
| Distribuir na vertical | button "Distribuir na vertical" | (coluna da esquerda) | (do bloco) |
| Oculto para jogadores (1) | checkbox "Oculto para jogadores (1)" | (coluna da esquerda) | (do bloco) |

### Configurações do mapa

Parte de: diálogo aberto pela engrenagem. Vai para: Mesmo diálogo, casca nova com navegação vertical. Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Formato da grade | radiogroup "Formato da grade" | (tela) | (do bloco) |
| Cor da grade | textbox "Cor da grade" | (tela) | (do bloco) |
| Opacidade | slider "Opacidade" | (tela) | (do bloco) |
| Espessura | slider "Espessura" | (tela) | (do bloco) |
| Estilo da linha da grade | radiogroup "Estilo da linha da grade" | (tela) | (do bloco) |
| Alinhar grade à imagem | heading "Alinhar grade à imagem" | (tela) | (do bloco) |
| Unidades por célula | spinbutton "Unidades por célula" | (tela) | (do bloco) |
| Unidade | textbox "Unidade" | (tela) | (do bloco) |
| Casas decimais | spinbutton "Casas decimais" | (tela) | (do bloco) |
| Modo de medição | combobox "Modo de medição" | (tela) | (do bloco) |
| Passo máximo (quadrados) | spinbutton "Passo máximo (quadrados)" | (tela) | (do bloco) |
| Fichas ocupam espaço | checkbox "Fichas ocupam espaço" | (tela) | (do bloco) |
| Largura (quadros) | spinbutton "Largura (quadros)" | (tela) | (do bloco) |
| Altura (quadros) | spinbutton "Altura (quadros)" | (tela) | (do bloco) |
| Aplicar 30 × 20 | button "Aplicar 30 × 20" | (tela) | (do bloco) |
| Texto de chegada | textbox "Texto de chegada" | (tela) | (do bloco) |
| Rostos só de perto | checkbox "Rostos só de perto" | (tela) | (do bloco) |
| Casas | spinbutton "Casas" | (tela) | (do bloco) |
| Escolher sistema… | button "Escolher sistema…" | (tela) | (do bloco) |
| Esconder Aventura e Esta cena ao usar ferramenta | checkbox "Esconder Aventura e Esta cena ao usar ferramenta" | (tela) | (do bloco) |

### Configurar cena

Parte de: diálogo aberto pela engrenagem da cena (coluna da direita, Cenas). Vai para: Configurar cena com navegação vertical; Relevo, Nomes dos lugares e Nuvens na seção "Mapa vivo". Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Visão nesta cena (quadrados) | spinbutton "Visão nesta cena (quadrados)" | (tela) | (do bloco) |
| Cena escura | checkbox "Cena escura" | (tela) | (do bloco) |
| Tipo de mapa | radiogroup "Tipo de mapa" | (tela) | (do bloco) |
| Relevo | checkbox "Relevo" | (tela) | (do bloco) |
| Nomes dos lugares | checkbox "Nomes dos lugares" | (tela) | (do bloco) |
| Nuvens | checkbox "Nuvens" | (tela) | (do bloco) |
| Grupo anda junto (caravana), em mapa Continente | checkbox "Grupo anda junto (caravana)" | (tela) > clicar radio "Continente" | (do bloco) |

### Todas as cenas

Parte de: aberto pelo ícone "Ver todas as cenas". Vai para: Chip da cena, "Ver todas as cenas". Fatia: 3 e 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Miniatura da cena | button "/^Cripta, 1 token/" | (tela) | (do bloco) |

### Atalhos do teclado

Parte de: aberto pelo "?". Vai para: Diálogo Atalhos com a lista nova. Fatia: 20.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Lista de atalhos | dialog "Atalhos do teclado" | (tela) | (do bloco) |

### Coluna da direita, sala fechada

Parte de: app do mestre, aba Jogo, sala fechada. Vai para: Livro da mesa: topo da Sala (sala fechada) e marcadores Grupo e Mesa. Fatia: 4 e 5.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Aba Jogo | tab "Jogo" | (coluna da direita) | (do bloco) |
| Abrir sala | button "Abrir sala" | (coluna da direita) | Topo do livro da mesa |
| Visão de jogador | button "Visão de jogador" | (coluna da direita) | Topo do livro da mesa e marcador Mesa |
| Personagens: + Personagem | button "+ Personagem" | (coluna da direita) > clicar button "Personagens" | (do bloco) |
| Personagens: Importar personagens | button "Importar personagens…" | (coluna da direita) > clicar button "Personagens" | (do bloco) |
| Contas: Só com conta | checkbox "Só com conta" | (coluna da direita) > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: nome da nova conta | textbox "Nome do jogador" | (coluna da direita) > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: PIN | textbox "PIN" | (coluna da direita) > clicar button "Contas dos jogadores" | (do bloco) |
| Contas: + Conta | button "+ Conta" | (coluna da direita) > clicar button "Contas dos jogadores" | (do bloco) |
| Esconder a coluna da direita | button "Esconder a coluna da direita" | (coluna da direita) | Seta no pé da lombada |
| Divisor "Altura das Cenas" | separator "Altura das Cenas" | (coluna da direita) | Some: Cenas vira marcador próprio |

### Chat do mestre

Parte de: sala fechada. Vai para: Marcador Chat do livro da mesa. Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Aba Chat: Ir para Jogo | button "Ir para Jogo" | (coluna da direita) > clicar tab "Chat" | (do bloco) |

### Cenas

Parte de: aventura aberta, coluna da direita. Vai para: Marcador Cenas do livro da mesa. Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Cripta | button "Cripta" | (coluna da direita) | (do bloco) |
| Renomear Cripta | button "Renomear Cripta" | (coluna da direita) | (do bloco) |
| Mover Cripta para… | button "Mover Cripta para…" | (coluna da direita) | (do bloco) |
| Planta de Cripta | button "Planta de Cripta" | (coluna da direita) | (do bloco) |
| Configurar Cripta | button "Configurar Cripta" | (coluna da direita) | (do bloco) |
| + Nova cena | button "+ Nova cena" | (coluna da direita) | (do bloco) |
| Revisar aventura | button "Revisar aventura" | (coluna da direita) | (do bloco) |
| Mais ações da cena: Duplicar | menuitem "Duplicar" | (coluna da direita) > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Subir | menuitem "Subir" | (coluna da direita) > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Descer | menuitem "Descer" | (coluna da direita) > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: É a cena inicial | menuitem "É a cena inicial" | (coluna da direita) > clicar button "Mais ações de Cripta" | (do bloco) |
| Mais ações da cena: Apagar cena… | menuitem "Apagar cena…" | (coluna da direita) > clicar button "Mais ações de Cripta" | (do bloco) |

## Mestre com a sala aberta

### Coluna da direita, sala aberta

Parte de: sala aberta (código ONDE01), aba Jogo. Vai para: Livro da mesa: topo da Sala (código, Mais da sala, Laser, Som, Convidar) e página Mesa. Fatia: 4.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Código da sala | heading "Sala" | (coluna da direita) | Topo do livro da mesa, código para copiar |
| Laser do mestre | button "Laser" | (coluna da direita) | Topo do livro da mesa |
| Som da mesa | button "Som da mesa" | (coluna da direita) | Botão Som do topo e página Mesa |
| Ruído | button "Ruído" | (coluna da direita) | Página Mesa |
| Alcance do ruído | combobox "Alcance do ruído" | (coluna da direita) | Página Mesa |
| Grupo | heading "Grupo" | (coluna da direita) | Marcador Grupo |
| Diário de viagens | heading "Diário de viagens" | (coluna da direita) | Página Mesa |
| Tela da mesa: Cena na tela | combobox "Cena na tela" | (coluna da direita) | Página Mesa |
| Convidar jogadores: Tornar pública | button "Tornar pública" | (coluna da direita) | Botão Convidar do topo |
| Fechar sala | button "Fechar sala" | (coluna da direita) | Menu "Mais da sala" do topo, com confirmação |

## Jogador (celular, 390 px)

### Jogador: barra de cima e cantos

Parte de: jogador no celular (390 px), painel fechado. Vai para: Faixa de couro com 4 atalhos + mão flutuante de latão. Fatia: 19.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Painel | button "Painel" | (tela) | (do bloco) |
| Minha ficha | button "Minha ficha" | (tela) | (do bloco) |
| Inventário | button "Inventário" | (tela) | (do bloco) |
| Aproximar | button "Aproximar" | (tela) | (do bloco) |
| Afastar | button "Afastar" | (tela) | (do bloco) |
| Som | button "Som" | (tela) | (do bloco) |
| Chamar o mestre | button "Chamar o mestre" | (tela) | (do bloco) |

### Jogador: aba Jogo

Parte de: jogador no celular, painel aberto. Vai para: Folha com abas: "No mapa" (4 peças), 2 linhas, fichas Comigo, Grupo, Meu personagem, Visão; Sair no rodapé. Fatia: 19.

| Controle | Nome acessível | Caminho hoje | Vai para |
|---|---|---|---|
| Jogo | tab "Jogo" | (tela) | (do bloco) |
| Caderno | tab "Caderno" | (tela) | (do bloco) |
| Lugares | tab "Lugares" | (tela) | (do bloco) |
| Dados | tab "Dados" | (tela) | (do bloco) |
| Chat | tab "Chat" | (tela) | (do bloco) |
| Centralizar em Heroi | button "Centralizar em Heroi" | (tela) | (do bloco) |
| Sinalizar | button "Sinalizar" | (tela) | (do bloco) |
| Marcações | button "Marcações" | (tela) | (do bloco) |
| Medir | button "Medir" | (tela) | (do bloco) |
| Laser | button "Laser" | (tela) | (do bloco) |
| Mostrar meu mapa a… | button "Mostrar meu mapa a…" | (tela) | (do bloco) |
| Volto já | button "Volto já" | (tela) | (do bloco) |
| Sair | button "Sair" | (tela) | (do bloco) |
| Comigo | heading "Comigo" | (tela) | (do bloco) |
| Nome | textbox "Nome" | (tela) | (do bloco) |
| Foto | button "Foto" | (tela) | (do bloco) |
| Esconder | button "Esconder" | (tela) | (do bloco) |
| Brilho do explorado 55% | slider "Brilho do explorado 55%" | (tela) | (do bloco) |
| Grade | checkbox "Grade" | (tela) | (do bloco) |
| Nomes | checkbox "Nomes" | (tela) | (do bloco) |
| Câmera segue minha ficha | checkbox "Câmera segue minha ficha" | (tela) | (do bloco) |
| Efeitos do mapa | checkbox "Efeitos do mapa" | (tela) | (do bloco) |

## Fora do spec (e por quê)

| Controle | Por que não está no spec |
|---|---|
| Voltar (cena anterior), na barra de ações | só aparece depois de viajar entre cenas |
| Menu "Imagem de fundo e conversão" (Chão a partir da imagem, Linhas e portas, Recriar minimapa) | só com imagem de fundo; sem ela o botão é "Importar imagem de fundo" (coberto) |
| Endireitar na sala ou parede solta | só com traço torto; coberto no desenho |
| Marcas dos jogadores (MarcasDaCena) | só com marcas deixadas por jogadores |
| Visto por / Ninguém vê, Levar para..., Rotina, Luzes nesta ficha (token) | pedem sala aberta, outra cena ou Estado do mundo com valores |
| Livro de regras | só com sistema de RPG que tem livro |
| Grupo do mestre: as 25+ ações por jogador, Pedindo, Chegando, Congelar/Pausar cena | pedem jogador conectado; ficam para a fatia 5, que traz o spec do grupo |
| Teste secreto | só com jogadores na sala |
| Pausa geral dos NPCs | só com NPC andando |
| Depende do estado (porta, luz, zona, pino) | só com Estado do mundo criado |
| Jogador: Ficha, Grupo, Meus personagens em outra cena, abas Caderno/Lugares/Dados por dentro | pedem sistema de RPG, colegas ou histórico; as abas estão cobertas |

Total: 547 controles em 62 blocos.
