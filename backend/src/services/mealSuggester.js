/**
 * Meal Suggester — sugere receitas com base no inventário
 * Filtros obrigatórios: tipo de refeição, restrições alimentares, alergias
 * Ordenação: urgencyScore → isCompleteMeal → matchScore → receitas pessoais → tempo
 */

const RECIPE_DB = [
  {
    id: 'rec001',
    name: 'Massa com atum',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['massa', 'atum'],
    optionalIngredients: ['tomate', 'cebola', 'azeite', 'alho'],
    amountsBase: { massa: '250g', atum: '1 lata', tomate: '2 un.', cebola: '1 un.', azeite: '2 col.' },
    time: '20 min',
    difficulty: 'fácil',
    tags: ['rápida', 'peixe', 'sem_carne'],
    servingsBase: 2,
    instructions: [
      'Coze a massa em água abundante com sal até ficar al dente.',
      'Escorre o atum.',
      'Se tiveres tomate e cebola, pica-os e mistura com o atum. Se tiveres azeite ou alho, usa para temperar.',
      'Escorre a massa e junta ao preparado de atum.',
      'Mistura bem, retifica o sal e serve.',
    ],
    description: 'Prato rápido com ingredientes de despensa.',
  },
  {
    id: 'rec002',
    name: 'Arroz de frango',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['arroz', 'frango'],
    optionalIngredients: ['cebola', 'alho', 'azeite', 'cenoura', 'tomate'],
    amountsBase: { arroz: '200g', frango: '400g', cebola: '1 un.', alho: '2 dentes', azeite: '3 col.' },
    time: '45 min',
    difficulty: 'médio',
    tags: ['carne', 'tradicional'],
    servingsBase: 3,
    instructions: [
      'Tempera o frango com sal e, se tiveres, alho e um fio de azeite.',
      'Aquece uma frigideira ou tacho. Se tiveres azeite e cebola, refoga a cebola picada 2 minutos antes de juntar o frango.',
      'Junta o frango e deixa cozinhar até dourar bem.',
      'Adiciona o arroz, mistura e cobre com o dobro do volume em água.',
      'Se tiveres tomate ou cenoura, junta agora em pedaços.',
      'Cozinha em lume brando durante 18 minutos. Retifica o sal e serve.',
    ],
    description: 'Clássico português reconfortante.',
  },
  {
    id: 'rec003',
    name: 'Ovos mexidos com queijo',
    mealType: 'breakfast',
    cookingMethod: 'stove',
    requiredIngredients: ['ovos', 'queijo'],
    optionalIngredients: ['manteiga', 'fiambre', 'tomate'],
    amountsBase: { ovos: '3 un.', queijo: '50g', manteiga: '1 noz' },
    time: '10 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'sem_carne', 'pequeno-almoco'],
    servingsBase: 1,
    instructions: [
      'Parte os ovos e bate ligeiramente com um garfo. Tempera com sal.',
      'Aquece uma frigideira antiaderente em lume médio — usa manteiga se tiveres, caso contrário aquece a frigideira a seco.',
      'Junta os ovos e mexe constantemente com uma espátula.',
      'Quando quase prontos, junta o queijo ralado ou partido em pedaços.',
      'Se tiveres fiambre ou tomate, junta também neste momento.',
      'Retira do lume ainda cremosos e serve imediatamente.',
    ],
    description: 'Pequeno-almoço proteico rápido.',
  },
  {
    id: 'rec004',
    name: 'Sopa de legumes',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['cenoura', 'batata'],
    optionalIngredients: ['cebola', 'alho', 'azeite', 'espinafres', 'brocolo'],
    amountsBase: { cenoura: '3 un.', batata: '2 un.', cebola: '1 un.', azeite: '2 col.' },
    time: '35 min',
    difficulty: 'fácil',
    tags: ['sopa', 'vegetariano', 'sem_carne', 'saudável'],
    servingsBase: 4,
    instructions: [
      'Descasca e corta a cenoura e a batata em pedaços.',
      'Junta os legumes numa panela e cobre com água.',
      'Se tiveres cebola ou alho, junta também cortados grosseiramente.',
      'Cozinha em lume médio 25 minutos até todos os legumes estarem tenros.',
      'Se tiveres espinafres ou brócolos, adiciona nos últimos 5 minutos.',
      'Tritura com varinha mágica, retifica o sal e serve. Um fio de azeite no prato é ótimo se tiveres.',
    ],
    description: 'Sopa nutritiva com legumes variados.',
  },
  {
    id: 'rec005',
    name: 'Frango grelhado com arroz',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['frango', 'arroz'],
    optionalIngredients: ['limao', 'alho', 'azeite', 'cenoura'],
    amountsBase: { frango: '400g', arroz: '180g', limao: '1 un.', alho: '2 dentes' },
    time: '35 min',
    difficulty: 'fácil',
    tags: ['carne', 'saudável'],
    servingsBase: 2,
    instructions: [
      'Tempera o frango com sal e, se tiveres, sumo de limão e alho picado.',
      'Grelha o frango numa frigideira quente, 6-7 minutos de cada lado até ficar dourado.',
      'Entretanto, coze o arroz em água com sal seguindo as instruções da embalagem.',
      'Serve o frango fatiado sobre o arroz. Um fio de azeite por cima é opcional.',
    ],
    description: 'Refeição equilibrada e fácil de preparar.',
  },
  {
    id: 'rec006',
    name: 'Esparguete à bolonhesa',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['massa', 'carne picada'],
    optionalIngredients: ['tomate', 'cebola', 'alho', 'azeite', 'queijo ralado'],
    amountsBase: { massa: '250g', 'carne picada': '300g', tomate: '2 un.', cebola: '1 un.' },
    time: '40 min',
    difficulty: 'médio',
    tags: ['carne', 'italiano'],
    servingsBase: 3,
    instructions: [
      'Aquece um tacho. Se tiveres azeite, cebola e alho, refoga-os 2 minutos primeiro.',
      'Junta a carne picada e deixa dourar, mexendo para soltar.',
      'Se tiveres tomate, adiciona picado. Tempera com sal e deixa cozinhar 20 minutos em lume brando.',
      'Entretanto, coze a massa em água abundante com sal até ficar al dente.',
      'Escorre a massa e junta ao molho de carne. Se tiveres queijo ralado, polvilha por cima ao servir.',
    ],
    description: 'Clássico italiano com carne picada.',
  },
  {
    id: 'rec007',
    name: 'Omelete de ovos',
    mealType: 'breakfast',
    cookingMethod: 'stove',
    requiredIngredients: ['ovos'],
    optionalIngredients: ['queijo', 'tomate', 'cebola', 'espinafres', 'fiambre'],
    amountsBase: { ovos: '3 un.', queijo: '40g', tomate: '1 un.' },
    time: '15 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'sem_carne', 'pequeno-almoco'],
    servingsBase: 1,
    instructions: [
      'Bate os ovos com uma pitada de sal.',
      'Aquece uma frigideira antiaderente em lume médio (não é necessário adicionar gordura).',
      'Deita os ovos na frigideira e deixa cozinhar sem mexer até as bordas começarem a firmar.',
      'Se tiveres queijo, tomate, espinafres ou fiambre, coloca-os sobre metade da omelete agora.',
      'Dobra a omelete ao meio com uma espátula e serve.',
    ],
    description: 'Pequeno-almoço simples e versátil.',
  },
  {
    id: 'rec008',
    name: 'Bacalhau com batatas',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['bacalhau', 'batata'],
    optionalIngredients: ['cebola', 'alho', 'azeite', 'ovos'],
    amountsBase: { bacalhau: '400g', batata: '4 un.', cebola: '2 un.', azeite: '4 col.' },
    time: '50 min',
    difficulty: 'médio',
    tags: ['peixe', 'tradicional', 'português'],
    servingsBase: 4,
    instructions: [
      'Coze o bacalhau em água sem sal durante 15 minutos. Retira e reserva.',
      'Na mesma água coze as batatas até ficarem macias.',
      'Lasca o bacalhau, retirando pele e espinhas, e corta as batatas em rodelas.',
      'Se tiveres ovos, coze-os também e parte em quartos.',
      'Se tiveres cebola e alho, refoga-os em azeite até dourar e rega o prato por cima.',
      'Monta o prato com camadas de bacalhau e batatas. Rega com azeite a gosto se tiveres.',
    ],
    description: 'Prato tradicional português.',
  },
  {
    id: 'rec009',
    name: 'Salada de atum',
    mealType: 'lunch_dinner',
    cookingMethod: 'no_cook',
    requiredIngredients: ['atum', 'alface'],
    optionalIngredients: ['tomate', 'cebola', 'milho', 'azeite', 'limao'],
    amountsBase: { atum: '1 lata', alface: 'meia cabeça', tomate: '2 un.', milho: '3 col.' },
    time: '10 min',
    difficulty: 'fácil',
    tags: ['rápida', 'peixe', 'sem_carne', 'saudável', 'salada'],
    servingsBase: 2,
    instructions: [
      'Lava e corta a alface para uma tigela.',
      'Escorre o atum e coloca por cima da alface.',
      'Se tiveres tomate, corta em quartos e adiciona.',
      'Se tiveres cebola, milho, azeite ou limão, usa para completar e temperar.',
      'Mistura bem e serve de imediato.',
    ],
    description: 'Salada rápida e nutritiva.',
  },
  {
    id: 'rec010',
    name: 'Frango salteado',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['frango'],
    optionalIngredients: ['alho', 'limao', 'azeite', 'tomate', 'cebola'],
    amountsBase: { frango: '400g', alho: '3 dentes', limao: '1 un.', azeite: '2 col.' },
    time: '25 min',
    difficulty: 'fácil',
    tags: ['carne', 'rápida', 'saudável'],
    servingsBase: 2,
    instructions: [
      'Corta o frango em tiras e tempera com sal.',
      'Aquece uma frigideira em lume alto. Adiciona azeite se tiveres.',
      'Junta o frango e deixa dourar 4-5 minutos sem mexer para ganhar cor.',
      'Vira o frango e cozinha mais 3-4 minutos.',
      'Se tiveres alho picado, junta no fim junto com sumo de limão se disponível.',
      'Serve com arroz, salada ou o que tiveres como acompanhamento.',
    ],
    description: 'Frango rápido para qualquer refeição.',
  },
  {
    id: 'rec011',
    name: 'Massa cremosa com natas',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['massa', 'natas'],
    optionalIngredients: ['queijo', 'alho', 'azeite', 'fiambre', 'cogumelo'],
    amountsBase: { massa: '250g', natas: '100ml', queijo: '60g', alho: '2 dentes' },
    time: '25 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'cremoso'],
    servingsBase: 2,
    instructions: [
      'Coze a massa em água abundante com sal.',
      'Numa frigideira, aquece as natas em lume médio.',
      'Se tiveres alho, junta picado às natas e deixa cozinhar 1 minuto.',
      'Se tiveres cogumelos, salteia-os antes de juntar as natas.',
      'Se tiveres queijo ralado, junta às natas e mexe até derreter.',
      'Escorre a massa, reserva um pouco da água de cozedura e junta a massa ao molho.',
      'Adiciona fiambre se tiveres. Mistura bem e serve.',
    ],
    description: 'Massa cremosa rápida — ótima para usar natas abertas.',
  },
  {
    id: 'rec012',
    name: 'Feijão com chouriço',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['feijao', 'chourico'],
    optionalIngredients: ['cebola', 'alho', 'azeite', 'tomate'],
    amountsBase: { feijao: '400g', chourico: '150g', cebola: '1 un.', azeite: '2 col.' },
    time: '30 min',
    difficulty: 'fácil',
    tags: ['tradicional', 'português', 'carne'],
    servingsBase: 3,
    instructions: [
      'Fatiase o chouriço em rodelas.',
      'Se tiveres cebola e alho, refoga-os em azeite num tacho até amolecer. Caso contrário, começa diretamente com o chouriço.',
      'Junta o chouriço fatiado e deixa alourar 3-4 minutos.',
      'Adiciona o feijão (de lata escorrido ou previamente cozido).',
      'Se tiveres tomate picado, adiciona agora. Cozinha 15 minutos em lume brando.',
      'Retifica os temperos e serve com arroz ou pão se disponível.',
    ],
    description: 'Prato tradicional português de feijão.',
  },
  {
    id: 'rec013',
    name: 'Frango com natas',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['frango', 'natas'],
    optionalIngredients: ['cogumelo', 'cebola', 'alho', 'azeite'],
    amountsBase: { frango: '400g', natas: '200ml', cogumelo: '150g', cebola: '1 un.' },
    time: '35 min',
    difficulty: 'médio',
    tags: ['carne', 'cremoso'],
    servingsBase: 3,
    instructions: [
      'Corta o frango em pedaços e tempera com sal.',
      'Se tiveres cebola e azeite, refoga a cebola em azeite num tacho até ficar translúcida.',
      'Junta o frango e deixa dourar de todos os lados.',
      'Se tiveres cogumelos, adiciona fatiados e cozinha 5 minutos.',
      'Verte as natas e cozinha em lume brando, mexendo, até o molho engrossar (5-8 min).',
      'Retifica o sal e serve com massa ou arroz.',
    ],
    description: 'Frango cremoso — ideal para usar natas abertas.',
  },
  {
    id: 'rec014',
    name: 'Arroz de legumes',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['arroz', 'cenoura'],
    optionalIngredients: ['ervilhas', 'cebola', 'alho', 'azeite', 'tomate'],
    amountsBase: { arroz: '200g', cenoura: '2 un.', ervilhas: '100g', cebola: '1 un.' },
    time: '30 min',
    difficulty: 'fácil',
    tags: ['vegetariano', 'saudável', 'sem_carne'],
    servingsBase: 3,
    instructions: [
      'Descasca e corta a cenoura em cubos pequenos.',
      'Junta o arroz e a cenoura numa panela. Cobre com o dobro do volume em água.',
      'Se tiveres cebola e alho, podes refogar em azeite antes de juntar o arroz para mais sabor.',
      'Cozinha em lume brando durante 18 minutos.',
      'Se tiveres ervilhas, adiciona a meio da cozedura.',
      'Retifica o sal e serve.',
    ],
    description: 'Arroz colorido com legumes da despensa.',
  },
  {
    id: 'rec015',
    name: 'Tosta de fiambre e queijo',
    mealType: 'breakfast',
    cookingMethod: 'oven',
    requiredIngredients: ['pao', 'fiambre', 'queijo'],
    optionalIngredients: ['manteiga', 'tomate'],
    amountsBase: { pao: '4 fatias', fiambre: '4 fatias', queijo: '4 fatias' },
    time: '10 min',
    difficulty: 'fácil',
    tags: ['rápida', 'pequeno-almoco'],
    servingsBase: 2,
    instructions: [
      'Corta o pão em fatias.',
      'Barra manteiga se tiveres.',
      'Coloca o fiambre e o queijo sobre o pão.',
      'Leva ao forno pré-aquecido a 200°C (ou torradeira) durante 5-8 minutos até o queijo derreter.',
      'Serve quente. Junta tomate fatiado se tiveres.',
    ],
    description: 'Tosta quente simples e rápida.',
  },
  {
    id: 'rec016',
    name: 'Peixe cozido com batata',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['peixe', 'batata'],
    optionalIngredients: ['cenoura', 'cebola', 'azeite'],
    amountsBase: { peixe: '400g', batata: '4 un.', cenoura: '2 un.', azeite: '3 col.' },
    time: '35 min',
    difficulty: 'fácil',
    tags: ['peixe', 'saudável'],
    servingsBase: 2,
    instructions: [
      'Coloca água com sal a ferver numa panela.',
      'Junta as batatas descascadas e cortadas em quartos. Coze 15 minutos.',
      'Adiciona o peixe e, se tiveres cenoura cortada, junta também.',
      'Coze mais 10-12 minutos até o peixe estar cozinhado.',
      'Escorre e serve. Rega com azeite a gosto se tiveres.',
    ],
    description: 'Refeição simples e saudável.',
  },
  {
    id: 'rec017',
    name: 'Creme de cenoura',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['cenoura'],
    optionalIngredients: ['batata', 'cebola', 'alho', 'azeite', 'natas'],
    amountsBase: { cenoura: '500g', batata: '2 un.', cebola: '1 un.', natas: '50ml' },
    time: '30 min',
    difficulty: 'fácil',
    tags: ['sopa', 'vegetariano', 'sem_carne', 'saudável'],
    servingsBase: 4,
    instructions: [
      'Descasca e corta as cenouras em rodelas.',
      'Coloca numa panela e cobre com água.',
      'Se tiveres batata, cebola ou alho, adiciona também cortados.',
      'Cozinha em lume médio 20-25 minutos até tudo estar macio.',
      'Tritura com varinha mágica até obter um creme suave.',
      'Se tiveres natas, junta uma colher e mexe. Retifica o sal e serve quente.',
    ],
    description: 'Sopa creme de cenoura suave.',
  },
  {
    id: 'rec018',
    name: 'Salada de arroz com atum',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['arroz', 'atum'],
    optionalIngredients: ['tomate', 'cebola', 'milho', 'azeite', 'limao'],
    amountsBase: { arroz: '150g', atum: '1 lata', tomate: '2 un.', milho: '3 col.' },
    time: '20 min',
    difficulty: 'fácil',
    tags: ['rápida', 'peixe', 'sem_carne', 'verão'],
    servingsBase: 2,
    instructions: [
      'Coze o arroz em água com sal e deixa arrefecer completamente.',
      'Escorre o atum e desfaz com um garfo.',
      'Mistura o arroz frio com o atum.',
      'Acrescenta tomate, milho e cebola picada se tiveres.',
      'Tempera com azeite, sal e sumo de limão se disponíveis. Serve frio.',
    ],
    description: 'Salada de arroz refrescante.',
  },
  {
    id: 'rec019',
    name: 'Grão com espinafres',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['grao', 'espinafres'],
    optionalIngredients: ['cebola', 'alho', 'azeite', 'tomate'],
    amountsBase: { grao: '400g', espinafres: '200g', cebola: '1 un.', azeite: '3 col.' },
    time: '25 min',
    difficulty: 'fácil',
    tags: ['vegetariano', 'sem_carne', 'saudável', 'tradicional'],
    servingsBase: 3,
    instructions: [
      'Se tiveres cebola e alho, refoga-os em azeite num tacho até amolecer.',
      'Adiciona o grão (de lata escorrido ou previamente cozido) ao tacho.',
      'Junta os espinafres e mexe até murcharem (2-3 minutos).',
      'Se tiveres tomate, adiciona picado e cozinha mais 5 minutos.',
      'Tempera com sal e serve com arroz ou pão.',
    ],
    description: 'Prato vegetariano rico em proteína.',
  },
  {
    id: 'rec020',
    name: 'Salmão no forno',
    mealType: 'lunch_dinner',
    cookingMethod: 'oven',
    requiredIngredients: ['salmao'],
    optionalIngredients: ['limao', 'alho', 'azeite', 'batata', 'tomate'],
    amountsBase: { salmao: '400g', limao: '1 un.', alho: '3 dentes', azeite: '2 col.' },
    time: '30 min',
    difficulty: 'fácil',
    tags: ['peixe', 'saudável'],
    servingsBase: 2,
    instructions: [
      'Pré-aquece o forno a 200°C.',
      'Coloca o salmão num tabuleiro forrado com papel de forno.',
      'Tempera com sal. Se tiveres limão, rega com sumo. Se tiveres alho e azeite, usa também.',
      'Se tiveres batata, corta em rodelas finas e coloca à volta do salmão.',
      'Assa durante 15-20 minutos até o salmão estar opaco no centro.',
      'Serve com salada ou legumes.',
    ],
    description: 'Salmão assado simples e saudável.',
  },
  {
    id: 'rec021',
    name: 'Puré de batata com ovo',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['batata', 'ovos'],
    optionalIngredients: ['manteiga', 'leite', 'queijo'],
    amountsBase: { batata: '500g', ovos: '2 un.', manteiga: '30g', leite: '50ml' },
    time: '30 min',
    difficulty: 'fácil',
    tags: ['vegetariano', 'sem_carne'],
    servingsBase: 2,
    instructions: [
      'Descasca as batatas, corta em pedaços e coze em água com sal até ficarem bem macias.',
      'Escorre as batatas e esmaga com um garfo.',
      'Se tiveres manteiga e leite quente, junta até ficar cremoso. Caso contrário, usa um pouco da água de cozedura.',
      'Entretanto, num tacho separado, faz os ovos estrelados ou cozidos conforme preferires.',
      'Serve o puré com os ovos por cima.',
    ],
    description: 'Puré caseiro reconfortante.',
  },
  {
    id: 'rec022',
    name: 'Camarão com alho',
    mealType: 'lunch_dinner',
    cookingMethod: 'stove',
    requiredIngredients: ['camarao', 'alho'],
    optionalIngredients: ['azeite', 'limao', 'pao', 'manteiga'],
    amountsBase: { camarao: '400g', alho: '4 dentes', azeite: '3 col.', limao: '1 un.' },
    time: '15 min',
    difficulty: 'fácil',
    tags: ['peixe', 'rápida', 'marisco'],
    servingsBase: 2,
    instructions: [
      'Descasca e pica o alho.',
      'Aquece uma frigideira em lume médio-alto. Adiciona azeite ou manteiga se tiveres.',
      'Junta o alho fatiado e deixa dourar 1 minuto sem queimar.',
      'Adiciona o camarão e salteia 2-3 minutos de cada lado até ficarem rosados.',
      'Se tiveres limão, rega no fim. Serve imediatamente com pão se disponível.',
    ],
    description: 'Camarão com alho rápido e delicioso.',
  },
  {
    id: 'rec023',
    name: 'Arroz com leite',
    mealType: 'breakfast',
    cookingMethod: 'stove',
    requiredIngredients: ['arroz', 'leite'],
    optionalIngredients: ['acucar', 'canela'],
    amountsBase: { arroz: '150g', leite: '750ml', acucar: '4 col.' },
    time: '35 min',
    difficulty: 'fácil',
    tags: ['sobremesa', 'vegetariano', 'sem_carne', 'tradicional', 'pequeno-almoco'],
    servingsBase: 4,
    instructions: [
      'Coze o arroz em água até absorver quase toda a água.',
      'Junta o leite quente.',
      'Adiciona açúcar a gosto se tiveres e cozinha em lume brando, mexendo sempre, até engrossar (15-20 min).',
      'Polvilha com canela se tiveres e serve quente ou frio.',
    ],
    description: 'Sobremesa ou pequeno-almoço tradicional.',
  },
  {
    id: 'rec024',
    name: 'Iogurte com fruta',
    mealType: 'breakfast',
    cookingMethod: 'no_cook',
    requiredIngredients: ['iogurte'],
    optionalIngredients: ['banana', 'maca', 'mirtilo', 'morango', 'granola', 'mel'],
    amountsBase: { iogurte: '200g', banana: '1 un.', granola: '3 col.' },
    time: '5 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'sem_carne', 'saudável', 'pequeno-almoco'],
    servingsBase: 1,
    instructions: [
      'Coloca o iogurte numa taça.',
      'Corta a fruta que tiveres (banana, maçã, morangos, mirtilos) e coloca por cima.',
      'Se tiveres granola, polvilha por cima para dar textura.',
      'Rega com mel a gosto se disponível e serve de imediato.',
    ],
    description: 'Pequeno-almoço rápido e saudável.',
  },
  {
    id: 'rec025',
    name: 'Papas de aveia',
    mealType: 'breakfast',
    cookingMethod: 'stove',
    requiredIngredients: ['aveia', 'leite'],
    optionalIngredients: ['banana', 'mel', 'canela', 'frutos vermelhos'],
    amountsBase: { aveia: '80g', leite: '250ml', banana: '1 un.', mel: '1 col.' },
    time: '10 min',
    difficulty: 'fácil',
    tags: ['vegetariano', 'sem_carne', 'saudável', 'pequeno-almoco'],
    servingsBase: 1,
    instructions: [
      'Junta a aveia e o leite num tacho pequeno.',
      'Cozinha em lume médio, mexendo sempre, até a mistura engrossar (3-5 minutos).',
      'Verte para uma taça.',
      'Decora com banana fatiada, frutos vermelhos ou mel se tiveres.',
      'Polvilha com canela se disponível e serve.',
    ],
    description: 'Papas de aveia reconfortantes e nutritivas.',
  },
  {
    id: 'rec026',
    name: 'Torrada com manteiga',
    mealType: 'breakfast',
    cookingMethod: 'oven',
    requiredIngredients: ['pao', 'manteiga'],
    optionalIngredients: ['compotas', 'mel', 'queijo', 'fiambre'],
    amountsBase: { pao: '4 fatias', manteiga: '20g' },
    time: '5 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'pequeno-almoco'],
    servingsBase: 2,
    instructions: [
      'Tosta as fatias de pão na torradeira ou no forno a 200°C durante 3-5 minutos.',
      'Barra com manteiga enquanto ainda está quente.',
      'Completa com compota, mel, queijo ou fiambre se tiveres.',
    ],
    description: 'Torrada clássica para começar o dia.',
  },
  {
    id: 'rec027',
    name: 'Overnight oats com banana',
    mealType: 'breakfast',
    cookingMethod: 'no_cook',
    requiredIngredients: ['aveia', 'iogurte'],
    optionalIngredients: ['banana', 'mel', 'leite', 'frutos vermelhos', 'canela'],
    amountsBase: { aveia: '80g', iogurte: '150g', banana: '1 un.', mel: '1 col.' },
    time: '10 min',
    difficulty: 'fácil',
    tags: ['rápida', 'vegetariano', 'sem_carne', 'saudável', 'pequeno-almoco'],
    servingsBase: 1,
    instructions: [
      'Na noite anterior: mistura a aveia com o iogurte e leite se tiveres num frasco ou taça.',
      'Se tiveres mel e canela, adiciona agora. Tapa e leva ao frigorífico toda a noite.',
      'De manhã, retira do frigorífico e mexe bem.',
      'Coloca banana fatiada ou frutos vermelhos por cima se disponíveis.',
      'Serve frio — está pronto a comer!',
    ],
    description: 'Pequeno-almoço preparado na véspera, sem cozinhar.',
  },
  // ── Snacks ────────────────────────────────────────────────────────────────────
  {
    id: 'rec028',
    name: 'Banana',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['banana'],
    optionalIngredients: [],
    amountsBase: { banana: '1 un.' },
    time: '1 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida', 'fruta', 'vegetariano', 'sem_carne'],
    servingsBase: 1,
    instructions: ['Descasca e come.'],
    description: 'Snack natural e energético.',
  },
  {
    id: 'rec029',
    name: 'Maçã',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['maca'],
    optionalIngredients: [],
    amountsBase: { maca: '1 un.' },
    time: '1 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida', 'fruta', 'vegetariano', 'sem_carne'],
    servingsBase: 1,
    instructions: ['Lava e come.'],
    description: 'Snack fresco e natural.',
  },
  {
    id: 'rec030',
    name: 'Iogurte natural',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['iogurte'],
    optionalIngredients: ['mel', 'banana'],
    amountsBase: { iogurte: '125g', mel: '1 col.' },
    time: '2 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida', 'vegetariano'],
    servingsBase: 1,
    instructions: [
      'Abre o iogurte.',
      'Se tiveres mel, rega por cima. Se tiveres banana, corta em rodelas e coloca por cima.',
    ],
    description: 'Snack proteico e leve.',
  },
  {
    id: 'rec031',
    name: 'Bolachas',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['bolachas'],
    optionalIngredients: ['queijo', 'fiambre'],
    amountsBase: { bolachas: '5 un.' },
    time: '1 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida'],
    servingsBase: 1,
    instructions: [
      'Serve as bolachas num prato.',
      'Podes adicionar queijo ou fiambre por cima se tiveres.',
    ],
    description: 'Snack rápido.',
  },
  {
    id: 'rec032',
    name: 'Frutos secos',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['frutos secos'],
    optionalIngredients: [],
    amountsBase: { 'frutos secos': '30g' },
    time: '1 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida', 'vegetariano', 'sem_carne'],
    servingsBase: 1,
    instructions: ['Coloca numa taça e come.'],
    description: 'Snack energético rico em gorduras saudáveis.',
  },
  {
    id: 'rec033',
    name: 'Laranja',
    mealType: 'snack',
    cookingMethod: 'no_cook',
    requiredIngredients: ['laranja'],
    optionalIngredients: [],
    amountsBase: { laranja: '1 un.' },
    time: '1 min',
    difficulty: 'fácil',
    tags: ['snack', 'rápida', 'fruta', 'vegetariano', 'sem_carne'],
    servingsBase: 1,
    instructions: ['Descasca e come.'],
    description: 'Snack rico em vitamina C.',
  },
  {
    id: 'rec034',
    name: 'Ovo cozido',
    mealType: 'snack',
    cookingMethod: 'stove',
    requiredIngredients: ['ovos'],
    optionalIngredients: [],
    amountsBase: { ovos: '1 un.' },
    time: '12 min',
    difficulty: 'fácil',
    tags: ['snack', 'proteico', 'sem_carne'],
    servingsBase: 1,
    instructions: [
      'Coloca o ovo numa panela coberto com água fria.',
      'Leva ao lume e quando ferver, coze mais 8-10 minutos.',
      'Arrefece em água fria e descasca.',
    ],
    description: 'Snack proteico simples.',
  },
];

// ── Normalização de texto ─────────────────────────────────────────────────────

function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

const STOP_WORDS = new Set(['de', 'do', 'da', 'dos', 'das', 'com', 'e', 'a', 'o', 'as', 'os', 'em', 'no', 'na', 'um', 'uma']);

// Strip trailing plural 's' / 'es' for simple Portuguese stemming
function stem(w) {
  if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
  if (w.endsWith('s') && w.length > 3) return w.slice(0, -1);
  return w;
}

function significantStems(text) {
  return normalize(text)
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map(stem);
}

// ── Ingredientes por categoria ────────────────────────────────────────────────

const GLUTEN_INGREDIENTS = ['massa', 'pao', 'farinha', 'esparguete', 'bolachas', 'biscoito', 'aveia'];
const LACTOSE_INGREDIENTS = ['leite', 'queijo', 'natas', 'manteiga', 'iogurte', 'requeijao', 'creme fraiche'];
const MEAT_INGREDIENTS = ['frango', 'carne', 'porco', 'vitela', 'borrego', 'peru', 'chourico', 'fiambre', 'bacon', 'salsicha', 'presunto'];
const FISH_INGREDIENTS = ['peixe', 'atum', 'bacalhau', 'sardinha', 'salmao', 'salmon', 'camarao'];
const PROTEIN_INGREDIENTS = [
  ...MEAT_INGREDIENTS, ...FISH_INGREDIENTS,
  'ovos', 'feijao', 'grao', 'lentilhas', 'tofu', 'queijo', 'iogurte',
];
const CARB_INGREDIENTS = ['arroz', 'massa', 'batata', 'pao', 'couscous', 'quinoa', 'aveia', 'feijao', 'grao'];

// ── Filtro de tipo de refeição ────────────────────────────────────────────────

function getMealTypeFilter(mealType) {
  if (!mealType) return null;
  if (['breakfast', 'pequeno-almoco'].includes(mealType)) return 'breakfast';
  if (['lunch_dinner', 'almoco', 'jantar'].includes(mealType)) return 'lunch_dinner';
  if (mealType === 'snack') return 'snack';
  if (mealType === 'rapida') return 'rapida';
  return null;
}

function recipeMatchesMealType(recipe, mealTypeFilter) {
  if (!mealTypeFilter) return true;
  if (mealTypeFilter === 'breakfast') return recipe.mealType === 'breakfast';
  if (mealTypeFilter === 'lunch_dinner') return recipe.mealType === 'lunch_dinner';
  if (mealTypeFilter === 'snack') {
    return recipe.mealType === 'snack';
  }
  if (mealTypeFilter === 'rapida') {
    const timeMin = parseInt(recipe.time);
    return !isNaN(timeMin) && timeMin <= 20;
  }
  return true;
}

// ── Verificar restrições (hard filter) ───────────────────────────────────────

function hasRestrictionConflict(ingredientList, restrictions) {
  if (!restrictions || restrictions.length === 0) return false;
  const allIngredients = ingredientList.map(normalize);

  for (const restriction of restrictions) {
    if (restriction === 'nenhuma') continue;

    if (restriction === 'vegetariano') {
      const hasMeat = allIngredients.some((i) => MEAT_INGREDIENTS.some((m) => i.includes(m) || m.includes(i)));
      if (hasMeat) return true;
    }
    if (restriction === 'vegano') {
      const hasMeat = allIngredients.some((i) => MEAT_INGREDIENTS.some((m) => i.includes(m) || m.includes(i)));
      const hasFish = allIngredients.some((i) => FISH_INGREDIENTS.some((f) => i.includes(f) || f.includes(i)));
      const hasDairy = allIngredients.some((i) => LACTOSE_INGREDIENTS.some((d) => i.includes(d) || d.includes(i)));
      if (hasMeat || hasFish || hasDairy) return true;
    }
    if (restriction === 'sem_lactose') {
      const hasDairy = allIngredients.some((i) => LACTOSE_INGREDIENTS.some((d) => i.includes(d) || d.includes(i)));
      if (hasDairy) return true;
    }
    if (restriction === 'sem_gluten') {
      const hasGluten = allIngredients.some((i) => GLUTEN_INGREDIENTS.some((g) => i.includes(g) || g.includes(i)));
      if (hasGluten) return true;
    }
  }
  return false;
}

function hasAllergyConflict(ingredientList, allergiesText) {
  if (!allergiesText || !allergiesText.trim()) return false;
  const allergens = allergiesText.toLowerCase().split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  if (allergens.length === 0) return false;
  const allIngredients = ingredientList.map(normalize);
  return allIngredients.some((ing) =>
    allergens.some((allergen) => ing.includes(allergen) || allergen.includes(ing))
  );
}

// Função exportada para validação externa
function validateMealAgainstRestrictions(ingredientList, restrictions, allergiesText) {
  if (hasRestrictionConflict(ingredientList, restrictions)) return false;
  if (hasAllergyConflict(ingredientList, allergiesText)) return false;
  return true;
}

// ── Urgency score ─────────────────────────────────────────────────────────────

function computeUrgencyScore(allMatches) {
  const hasUrgentToday = allMatches.some((m) => m.item?.priority === 'usar_hoje');
  const hasUrgentSoon  = allMatches.some((m) => m.item?.priority === 'usar_breve');
  const hasOpen        = allMatches.some((m) => m.item?.state === 'aberto');
  if (hasUrgentToday) return 100;
  if (hasUrgentSoon)  return 75;
  if (hasOpen)        return 50;
  return 0;
}

// ── Match entre inventário e ingredientes ─────────────────────────────────────

function findInventoryItem(ingredientName, inventoryItems) {
  const normIng = normalize(ingredientName);
  const ingStems = significantStems(ingredientName);

  return inventoryItems.find((item) => {
    const normItem = normalize(item.name);
    // Fast path: exact substring (e.g. "frango" in "peito de frango")
    if (normItem.includes(normIng) || normIng.includes(normItem)) return true;
    // Word path: every ingredient word must appear in the item name
    // e.g. ["carne","picada"] ⊆ ["carne","vaca","picada"] → match
    if (ingStems.length === 0) return false;
    const itemStems = significantStems(item.name);
    return ingStems.every((s) => itemStems.includes(s));
  }) || null;
}

function getScaledAmount(recipe, ingredientName, servings) {
  const base = recipe.amountsBase?.[ingredientName] || '';
  if (!base || !servings || !recipe.servingsBase) return base;
  if (servings === recipe.servingsBase) return base;
  const match = base.match(/^(\d+(?:\.\d+)?)(.*)/);
  if (match) {
    const scaled = Math.round((parseFloat(match[1]) * servings) / recipe.servingsBase);
    return `${scaled}${match[2]}`;
  }
  return base;
}

// ── Verificação de quantidade suficiente ─────────────────────────────────────

const QTY_WEIGHT = { g: 1, gr: 1, grama: 1, gramas: 1, kg: 1000, kilo: 1000 };
const QTY_VOLUME = { ml: 1, cl: 10, dl: 100, l: 1000, litro: 1000, litros: 1000 };

function parseIngQty(str) {
  if (!str || typeof str !== 'string') return null;
  const s = str.trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)\s*([a-zçãéíóú.]*)/);
  if (!m) return null;
  const value = parseFloat(m[1]);
  if (isNaN(value) || value <= 0) return null;
  const unit = m[2].replace(/\.$/, '').trim();
  return { value, unit };
}

function hasEnoughQty(inventoryQtyStr, recipeAmountStr) {
  if (!inventoryQtyStr || !recipeAmountStr) return true;
  const inv = parseIngQty(inventoryQtyStr);
  const rec = parseIngQty(recipeAmountStr);
  if (!inv || !rec) return true;
  let invBase, recBase;
  if (QTY_WEIGHT[inv.unit] !== undefined && QTY_WEIGHT[rec.unit] !== undefined) {
    invBase = inv.value * QTY_WEIGHT[inv.unit];
    recBase = rec.value * QTY_WEIGHT[rec.unit];
  } else if (QTY_VOLUME[inv.unit] !== undefined && QTY_VOLUME[rec.unit] !== undefined) {
    invBase = inv.value * QTY_VOLUME[inv.unit];
    recBase = rec.value * QTY_VOLUME[rec.unit];
  } else if (inv.unit === rec.unit) {
    invBase = inv.value;
    recBase = rec.value;
  } else {
    return true; // unidades incompatíveis — não é possível comparar, assume suficiente
  }
  return invBase >= recBase * 0.5;
}

// ── Verificar completude da refeição ─────────────────────────────────────────

function computeCompleteness(recipe, availableIngNames) {
  if (recipe.mealType === 'breakfast') {
    return { isCompleteMeal: true, mealCompletenessReason: 'Pequeno-almoço equilibrado.' };
  }
  if (recipe.tags?.includes('sopa')) {
    return { isCompleteMeal: true, mealCompletenessReason: 'Sopa completa com legumes.' };
  }

  const normedAvail = availableIngNames.map(normalize);

  const hasProtein = normedAvail.some((n) =>
    PROTEIN_INGREDIENTS.some((p) => n.includes(p) || p.includes(n))
  );
  const hasCarb = normedAvail.some((n) =>
    CARB_INGREDIENTS.some((c) => n.includes(c) || c.includes(n))
  );

  if (hasProtein && hasCarb) {
    return { isCompleteMeal: true, mealCompletenessReason: 'Inclui proteína e base de hidratos.' };
  }
  if (hasProtein) {
    return { isCompleteMeal: false, mealCompletenessReason: 'Falta base de hidratos para refeição completa.' };
  }
  return { isCompleteMeal: false, mealCompletenessReason: 'Faltam proteína e hidratos para refeição completa.' };
}

// ── Função principal de sugestão ──────────────────────────────────────────────

// ── Calorias e macros estimados por receita ───────────────────────────────────
// NOTA: valores são TOTAIS para servingsBase porções (ver RECIPE_DB)
// A escala por porções pedidas é feita abaixo com scaleFactor = servings/servingsBase
const RECIPE_NUTRITION = {
  // rec001: Massa com atum — servingsBase: 2 (250g massa + 1 lata atum + legumes)
  rec001: { calories: 1100, protein: 60,  carbs: 185, fat: 18 },
  // rec002: Arroz de frango — servingsBase: 3 (200g arroz + 400g frango + legumes)
  rec002: { calories: 1500, protein: 115, carbs: 150, fat: 38 },
  // rec003: Ovos mexidos com queijo — servingsBase: 1 (3 ovos + 50g queijo + manteiga)
  rec003: { calories: 460,  protein: 32,  carbs: 4,   fat: 35 },
  // rec004: Sopa de legumes — servingsBase: 4 (3 cenouras + 2 batatas + cebola + azeite)
  rec004: { calories: 620,  protein: 16,  carbs: 108, fat: 16 },
  // rec005: Frango grelhado com arroz — servingsBase: 2 (400g frango + 180g arroz)
  rec005: { calories: 1280, protein: 88,  carbs: 188, fat: 26 },
  // rec006: Esparguete à bolonhesa — servingsBase: 3 (250g massa + 300g carne picada)
  rec006: { calories: 1720, protein: 98,  carbs: 205, fat: 54 },
  // rec007: Omelete de ovos — servingsBase: 1 (3 ovos + 40g queijo + legumes opcionais)
  rec007: { calories: 400,  protein: 28,  carbs: 4,   fat: 30 },
  // rec008: Bacalhau com batatas — servingsBase: 4 (400g bacalhau + 4 batatas + azeite)
  rec008: { calories: 1440, protein: 102, carbs: 138, fat: 42 },
  // rec009: Salada de atum — servingsBase: 2 (1 lata atum + alface + tomate)
  rec009: { calories: 280,  protein: 32,  carbs: 18,  fat: 8  },
  // rec010: Frango salteado — servingsBase: 2 (400g frango + azeite + alho)
  rec010: { calories: 760,  protein: 82,  carbs: 6,   fat: 46 },
  // rec011: Massa cremosa com natas — servingsBase: 2 (250g massa + 100ml natas + 60g queijo)
  rec011: { calories: 1380, protein: 40,  carbs: 182, fat: 60 },
  // rec012: Feijão com chouriço — servingsBase: 3 (400g feijão + 150g chouriço)
  rec012: { calories: 1050, protein: 56,  carbs: 96,  fat: 42 },
  // rec013: Frango com natas — servingsBase: 3 (400g frango + 200ml natas + cogumelos)
  rec013: { calories: 1260, protein: 80,  carbs: 14,  fat: 90 },
  // rec014: Arroz de legumes — servingsBase: 3 (200g arroz + cenouras + ervilhas)
  rec014: { calories: 930,  protein: 22,  carbs: 188, fat: 14 },
  // rec015: Tosta de fiambre e queijo — servingsBase: 2 (4 fatias pão + fiambre + queijo)
  rec015: { calories: 840,  protein: 50,  carbs: 66,  fat: 38 },
  // rec016: Peixe cozido com batata — servingsBase: 2 (400g peixe + 4 batatas + cenoura)
  rec016: { calories: 1100, protein: 86,  carbs: 155, fat: 24 },
  // rec017: Creme de cenoura — servingsBase: 4 (500g cenoura + 2 batatas + natas)
  rec017: { calories: 760,  protein: 18,  carbs: 132, fat: 20 },
  // rec018: Salada de arroz com atum — servingsBase: 2 (150g arroz + 1 lata atum + tomate)
  rec018: { calories: 760,  protein: 48,  carbs: 100, fat: 12 },
  // rec019: Grão com espinafres — servingsBase: 3 (400g grão + 200g espinafres + azeite)
  rec019: { calories: 850,  protein: 40,  carbs: 115, fat: 26 },
  // rec020: Salmão no forno — servingsBase: 2 (400g salmão + azeite + limão)
  rec020: { calories: 980,  protein: 82,  carbs: 8,   fat: 66 },
  // rec021: Puré de batata com ovo — servingsBase: 2 (500g batata + 2 ovos + manteiga)
  rec021: { calories: 800,  protein: 24,  carbs: 104, fat: 32 },
  // rec022: Camarão com alho — servingsBase: 2 (400g camarão + azeite + alho)
  rec022: { calories: 600,  protein: 78,  carbs: 6,   fat: 28 },
  // rec023: Arroz com leite — servingsBase: 4 (150g arroz + 750ml leite + açúcar)
  rec023: { calories: 1200, protein: 36,  carbs: 214, fat: 22 },
  // rec024: Iogurte com fruta — servingsBase: 1 (200g iogurte + banana + granola)
  rec024: { calories: 340,  protein: 12,  carbs: 56,  fat: 8  },
  // rec025: Papas de aveia — servingsBase: 1 (80g aveia + 250ml leite + banana)
  rec025: { calories: 580,  protein: 18,  carbs: 96,  fat: 14 },
  // rec026: Torrada com manteiga — servingsBase: 2 (4 fatias pão + 20g manteiga)
  rec026: { calories: 520,  protein: 12,  carbs: 70,  fat: 22 },
  // rec027: Overnight oats com banana — servingsBase: 1 (80g aveia + 150g iogurte + banana)
  rec027: { calories: 490,  protein: 18,  carbs: 80,  fat: 10 },
  // rec028–034: snacks, servingsBase: 1 (valores por porção)
  rec028: { calories: 90,   protein: 1,   carbs: 23,  fat: 0  }, // Banana
  rec029: { calories: 80,   protein: 0,   carbs: 21,  fat: 0  }, // Maçã
  rec030: { calories: 120,  protein: 8,   carbs: 14,  fat: 3  }, // Iogurte natural
  rec031: { calories: 150,  protein: 3,   carbs: 22,  fat: 6  }, // Bolachas
  rec032: { calories: 180,  protein: 4,   carbs: 8,   fat: 15 }, // Frutos secos
  rec033: { calories: 60,   protein: 1,   carbs: 15,  fat: 0  }, // Laranja
  rec034: { calories: 80,   protein: 7,   carbs: 1,   fat: 5  }, // Ovo cozido
};

function suggestMeals({ inventoryItems = [], restrictions = [], allergies = '', servings = 2, userRecipes = [], mealType = null, fitnessProfile = null, dailyNutritionLog = null }) {
  const suggestions = [];
  const mealTypeFilter = getMealTypeFilter(mealType);
  const hasRestrictions = restrictions && restrictions.length > 0 && !restrictions.every((r) => r === 'nenhuma');
  const hasAllergies = !!allergies && allergies.trim().length > 0;

  // ── Receitas da base de dados ──
  for (const recipe of RECIPE_DB) {
    // Filtro obrigatório: tipo de refeição
    if (mealTypeFilter && !recipeMatchesMealType(recipe, mealTypeFilter)) continue;

    const allIngNamesForCheck = [...recipe.requiredIngredients, ...recipe.optionalIngredients];

    // Filtro obrigatório: restrições alimentares
    if (hasRestrictions && hasRestrictionConflict(allIngNamesForCheck, restrictions)) continue;

    // Filtro obrigatório: alergias
    if (hasAllergies && hasAllergyConflict(allIngNamesForCheck, allergies)) continue;

    // Match de ingredientes obrigatórios
    const requiredMatches = recipe.requiredIngredients.map((ing) => ({
      name: ing,
      item: findInventoryItem(ing, inventoryItems),
    }));

    const matchedRequired = requiredMatches.filter((m) =>
      m.item !== null && hasEnoughQty(m.item.quantity, getScaledAmount(recipe, m.name, servings))
    ).length;
    const totalRequired = recipe.requiredIngredients.length;
    const requiredScore = (matchedRequired / totalRequired) * 100;

    // Mínimo: 50% dos ingredientes obrigatórios
    if (requiredScore < 50) continue;

    const optionalMatches = recipe.optionalIngredients.map((ing) => ({
      name: ing,
      item: findInventoryItem(ing, inventoryItems),
    }));
    const matchedOptional = optionalMatches.filter((m) => m.item !== null).length;
    const optionalBonus = recipe.optionalIngredients.length > 0
      ? (matchedOptional / recipe.optionalIngredients.length) * 10
      : 0;
    const matchScore = Math.min(100, Math.round(requiredScore * 0.9 + optionalBonus));

    const allMatches = [...requiredMatches, ...optionalMatches];

    // urgencyScore: prioridade para produtos urgentes e abertos
    const urgencyScore = computeUrgencyScore(allMatches);

    const usesUrgentItems = allMatches.some(
      (m) => m.item && ['usar_hoje', 'usar_breve'].includes(m.item.priority)
    );
    const urgentItemsUsed = allMatches
      .filter((m) => m.item && ['usar_hoje', 'usar_breve'].includes(m.item.priority))
      .map((m) => m.item.name);

    // Construir lista de ingredientes com estado
    const ingredients = recipe.requiredIngredients.map((ing) => {
      const invItem = findInventoryItem(ing, inventoryItems);
      const scaledAmount = getScaledAmount(recipe, ing, servings);
      const insufficientQty = !!invItem && !hasEnoughQty(invItem.quantity, scaledAmount);
      return {
        name: ing.charAt(0).toUpperCase() + ing.slice(1),
        amount: scaledAmount,
        hasIt: !!invItem,
        insufficientQty,
        required: true,
        urgent: invItem ? ['usar_hoje', 'usar_breve'].includes(invItem.priority) : false,
        urgentPriority: invItem?.priority || null,
        state: invItem?.state || null,
        inventoryItemId: invItem?._id?.toString() || null,
        inventoryQuantity: invItem?.quantity || '',
      };
    });

    const optionalIngredients = recipe.optionalIngredients.map((ing) => {
      const invItem = findInventoryItem(ing, inventoryItems);
      const scaledAmount = getScaledAmount(recipe, ing, servings);
      const insufficientQty = !!invItem && !hasEnoughQty(invItem.quantity, scaledAmount);
      return {
        name: ing.charAt(0).toUpperCase() + ing.slice(1),
        amount: scaledAmount,
        hasIt: !!invItem,
        insufficientQty,
        required: false,
        urgent: invItem ? ['usar_hoje', 'usar_breve'].includes(invItem.priority) : false,
        urgentPriority: invItem?.priority || null,
        state: invItem?.state || null,
        inventoryItemId: invItem?._id?.toString() || null,
        inventoryQuantity: invItem?.quantity || '',
        optional: true,
      };
    });

    const missingRequired = ingredients.filter((i) => !i.hasIt || i.insufficientQty).length;
    let availabilityBadge;
    if (missingRequired === 0 && optionalIngredients.filter((i) => !i.hasIt || i.insufficientQty).length === 0) {
      availabilityBadge = 'Tens tudo';
    } else if (missingRequired === 0) {
      availabilityBadge = 'Tens o essencial';
    } else if (missingRequired === 1) {
      availabilityBadge = 'Falta 1 obrigatório';
    } else if (missingRequired <= 2) {
      availabilityBadge = `Faltam ${missingRequired} obrigatórios`;
    } else {
      availabilityBadge = 'Faltam vários obrigatórios';
    }

    const availableIngNames = [...ingredients, ...optionalIngredients]
      .filter((i) => i.hasIt)
      .map((i) => i.name);
    const { isCompleteMeal, mealCompletenessReason } = computeCompleteness(recipe, availableIngNames);

    const allIngNorms = [...recipe.requiredIngredients, ...recipe.optionalIngredients].map(normalize);
    const dietaryTags = {
      hasMeat:    allIngNorms.some((n) => MEAT_INGREDIENTS.some((m) => n.includes(m) || m.includes(n))),
      hasFish:    allIngNorms.some((n) => FISH_INGREDIENTS.some((f) => n.includes(f) || f.includes(n))),
      hasLactose: allIngNorms.some((n) => LACTOSE_INGREDIENTS.some((l) => n.includes(l) || l.includes(n))),
      hasGluten:  allIngNorms.some((n) => GLUTEN_INGREDIENTS.some((g) => n.includes(g) || g.includes(n))),
    };

    const nutrition = RECIPE_NUTRITION[recipe.id] || { calories: 0, protein: 0, carbs: 0, fat: 0 };
    // Escalar para as porções pedidas
    const scaleFactor = servings / (recipe.servingsBase || 2);
    const scaledNutrition = {
      calories: Math.round(nutrition.calories * scaleFactor),
      macros: {
        protein: Math.round(nutrition.protein * scaleFactor),
        carbs:   Math.round(nutrition.carbs   * scaleFactor),
        fat:     Math.round(nutrition.fat     * scaleFactor),
      },
    };

    // fitnessScore
    let fitnessScore = 50;
    if (fitnessProfile && fitnessProfile.dailyCaloriesTarget) {
      const caloriesConsumed = dailyNutritionLog?.caloriesConsumed || 0;
      const macrosConsumed   = dailyNutritionLog?.macrosConsumed   || {};
      const caloriesRemaining = fitnessProfile.dailyCaloriesTarget - caloriesConsumed;
      const proteinRemaining  = (fitnessProfile.macrosTarget?.protein || 150) - (macrosConsumed.protein || 0);
      const mealCal = scaledNutrition.calories;
      const mealPro = scaledNutrition.macros.protein;
      if (mealCal > 0 && caloriesRemaining > 0) {
        const fit = mealCal / caloriesRemaining;
        if (fit >= 0.2 && fit <= 1.0) fitnessScore += 20;
        else if (fit > 1.0) fitnessScore -= 15;
        else fitnessScore += 5;
      }
      if (mealPro > 0 && proteinRemaining > 0) {
        fitnessScore += mealPro / proteinRemaining >= 0.2 ? 20 : 5;
      }
      const goal = fitnessProfile.goal;
      if ((goal === 'ganhar_massa_muscular' || goal === 'mais_proteina') && mealPro >= 20) fitnessScore += 10;
      if (goal === 'perder_peso' && mealCal > 0 && mealCal <= 500) fitnessScore += 10;
      fitnessScore = Math.min(100, Math.max(0, fitnessScore));
    }

    suggestions.push({
      id: recipe.id,
      name: recipe.name,
      source: 'suggested',
      mealType: recipe.mealType,
      cookingMethod: recipe.cookingMethod,
      time: recipe.time,
      difficulty: recipe.difficulty,
      servings,
      calories: scaledNutrition.calories,
      macros: scaledNutrition.macros,
      matchScore,
      urgencyScore,
      fitnessScore,
      missingRequired,
      ingredients,
      optionalIngredients,
      allIngredients: [...ingredients, ...optionalIngredients],
      usesUrgentItems,
      urgentItemsUsed,
      availabilityBadge,
      dietaryTags,
      tags: recipe.tags,
      isCompleteMeal,
      mealCompletenessReason,
      instructions: recipe.instructions.map((step, i) => ({ step: i + 1, text: step })),
      description: recipe.description,
    });
  }

  // ── Receitas pessoais do utilizador ──
  for (const recipe of userRecipes) {
    if (!recipe.isActive) continue;

    // breakfast/pequeno-almoco: excluir receitas pessoais (sem mealType definido)
    if (mealTypeFilter === 'breakfast') continue;

    const userIngNames = recipe.ingredients.map((i) => i.name);

    // Filtro obrigatório: restrições e alergias
    if (hasRestrictions && hasRestrictionConflict(userIngNames, restrictions)) continue;
    if (hasAllergies && hasAllergyConflict(userIngNames, allergies)) continue;

    const recipeIngredients = recipe.ingredients.map((ing) => {
      const invItem = findInventoryItem(ing.name, inventoryItems);
      const insufficientQty = !!invItem && !hasEnoughQty(invItem.quantity, ing.amount);
      return {
        name: ing.name,
        amount: ing.amount || '',
        hasIt: !!invItem,
        insufficientQty,
        required: true,
        urgent: invItem ? ['usar_hoje', 'usar_breve'].includes(invItem.priority) : false,
        urgentPriority: invItem?.priority || null,
        state: invItem?.state || null,
        inventoryItemId: invItem?._id?.toString() || null,
        inventoryQuantity: invItem?.quantity || '',
        _invItem: invItem,
      };
    });

    const matchedCount = recipeIngredients.filter((i) => i.hasIt && !i.insufficientQty).length;
    const matchScore = Math.round((matchedCount / recipeIngredients.length) * 100);
    if (matchScore < 30) continue;

    // Para snack/rapida: aplicar filtro de tempo se definido pelo utilizador
    if (mealTypeFilter === 'rapida' || mealTypeFilter === 'snack') {
      const timeMin = parseInt(recipe.time);
      if (!isNaN(timeMin) && timeMin > 20) continue;
    }

    const urgencyScore = computeUrgencyScore(recipeIngredients.map((i) => ({ item: i._invItem })));
    const usesUrgentItems = recipeIngredients.some((i) => i.urgent);
    const urgentItemsUsed = recipeIngredients.filter((i) => i.urgent).map((i) => i.name);

    const missingRequired = recipeIngredients.filter((i) => !i.hasIt || i.insufficientQty).length;
    let availabilityBadge;
    if (missingRequired === 0) availabilityBadge = 'Tens tudo';
    else if (missingRequired <= 2) availabilityBadge = `Falta${missingRequired === 1 ? '' : 'm'} ${missingRequired} obrigatório${missingRequired === 1 ? '' : 's'}`;
    else availabilityBadge = 'Faltam vários obrigatórios';

    const userIngNorms = userIngNames.map(normalize);
    const dietaryTags = {
      hasMeat:    userIngNorms.some((n) => MEAT_INGREDIENTS.some((m) => n.includes(m) || m.includes(n))),
      hasFish:    userIngNorms.some((n) => FISH_INGREDIENTS.some((f) => n.includes(f) || f.includes(n))),
      hasLactose: userIngNorms.some((n) => LACTOSE_INGREDIENTS.some((l) => n.includes(l) || l.includes(n))),
      hasGluten:  userIngNorms.some((n) => GLUTEN_INGREDIENTS.some((g) => n.includes(g) || g.includes(n))),
    };

    const availableIngNames = recipeIngredients.filter((i) => i.hasIt).map((i) => i.name);
    const { isCompleteMeal, mealCompletenessReason } = computeCompleteness(
      { mealType: 'lunch_dinner', tags: [] },
      availableIngNames
    );

    // Remover referência interna antes de enviar
    const cleanIngredients = recipeIngredients.map(({ _invItem, ...rest }) => rest);

    suggestions.push({
      id: recipe._id.toString(),
      name: recipe.name,
      source: 'user',
      mealType: 'lunch_dinner',
      cookingMethod: null,
      time: recipe.time || '',
      difficulty: recipe.difficulty || 'fácil',
      servings,
      matchScore,
      urgencyScore,
      missingRequired,
      ingredients: cleanIngredients,
      optionalIngredients: [],
      allIngredients: cleanIngredients,
      usesUrgentItems,
      urgentItemsUsed,
      availabilityBadge,
      dietaryTags,
      tags: [],
      isCompleteMeal,
      mealCompletenessReason,
      instructions: (recipe.instructions || []).map((step, i) => ({ step: i + 1, text: step })),
      description: recipe.notes || '',
    });
  }

  // ── Ordenação ──
  const isFitnessMode = !!fitnessProfile;
  suggestions.sort((a, b) => {
    if (a.missingRequired !== b.missingRequired) return a.missingRequired - b.missingRequired;
    if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
    // Modo fitness: fitnessScore tem mais peso que isCompleteMeal
    if (isFitnessMode) {
      if (b.fitnessScore !== a.fitnessScore) return b.fitnessScore - a.fitnessScore;
    }
    if (b.isCompleteMeal !== a.isCompleteMeal) return (b.isCompleteMeal ? 1 : 0) - (a.isCompleteMeal ? 1 : 0);
    if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
    if (a.source === 'user' && b.source !== 'user') return -1;
    if (b.source === 'user' && a.source !== 'user') return 1;
    return (parseInt(a.time) || 999) - (parseInt(b.time) || 999);
  });

  return suggestions.slice(0, 20);
}

module.exports = { suggestMeals, validateMealAgainstRestrictions };
