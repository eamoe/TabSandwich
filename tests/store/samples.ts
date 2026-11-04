/**
 * What the Chrome Web Store screenshots show in each language (tests/store/store-assets.spec.ts):
 * the words beside each picture, and a sample library as someone in that language would have it,
 * with categories named in the language and pages from sites in it. Every page here is visited
 * once while rendering, so it must exist: the run fails on one that doesn't.
 */

type Category = "work" | "reading" | "travel" | "recipes";

export type SampleTab = {
    title: string;
    url: string;
    category?: Category;
    daysAgo?: number;
    pinned?: boolean;
    note?: string;
    archivedDaysAgo?: number;
    /** The library shot sets a reminder on it, a few days off. */
    remindSoon?: boolean;
    /** The read-later shot shows its reminder come. */
    remindDue?: boolean;
};

type Shot = { headline: string; points: string[] };

export type Sample = {
    hero: Shot & { promise: string };
    panel: Shot;
    library: Shot & { search: string };
    window: Shot;
    waiting: Shot;
    categories: Record<Category, string>;
    tabs: SampleTab[];
    /** Added for the read-later shot: more reading that's been waiting, and a few tabs already archived. */
    extras: SampleTab[];
    /** The page the save card shows: opened as the active tab in the popup's window. */
    currentPage: string;
    /** The page beside the side panel: someone else's site, plainly not part of Tab Sandwich, and not yet saved. */
    panelPage: string;
    /** A window of open tabs, for "save the whole window" (the current page is the one you're on). */
    windowPages: string[];
};

const en: Sample = {
    hero: {
        headline: "Save the page you're on,<br>in one click",
        points: ["Pick a category as you save — it suggests one.", "Pin favorites, add a note, archive the rest."],
        promise: "Stored only in your browser. No account, no tracking.",
    },
    panel: {
        headline: "Keep your list open beside the page",
        points: ["All of Tab Sandwich, next to what you're reading.", "Right-click a link to save it, and it shows up here."],
    },
    library: {
        headline: "Find that link again",
        points: ["Search titles, sites and notes as you type.", "Sort by any column, edit many at once."],
        search: "wiki",
    },
    window: {
        headline: "Forty tabs open?<br>Save them all at once",
        points: ["One click saves the whole window, skipping what's already saved.", "It stays together in your list. Close the tabs, or keep them open."],
    },
    waiting: {
        headline: "Read it later,<br>or keep it for good",
        points: [
            "Saved to read? After a week, it shows as Waiting.",
            "A reminder brings it back on the day you pick.",
            "Everything else is kept, and never nags.",
            "Done with a tab? Archive it — out of the way, never lost.",
        ],
    },
    categories: { work: "Work", reading: "Reading", travel: "Travel", recipes: "Recipes" },
    tabs: [
        { title: "GitHub: Let's build from here", url: "https://github.com/", category: "work", pinned: true },
        { title: "MDN Web Docs", url: "https://developer.mozilla.org/en-US/", category: "work", daysAgo: 2 },
        { title: "Figma: The Collaborative Interface Design Tool", url: "https://www.figma.com/", category: "work", daysAgo: 12 },
        { title: "Sandwich - Wikipedia", url: "https://en.wikipedia.org/wiki/Sandwich", category: "reading", daysAgo: 9 },
        { title: "Hacker News", url: "https://news.ycombinator.com/", category: "reading", remindSoon: true },
        { title: "BBC News - Home", url: "https://www.bbc.com/news", category: "reading", daysAgo: 4 },
        { title: "Lisbon – Travel guide at Wikivoyage", url: "https://en.wikivoyage.org/wiki/Lisbon", category: "travel", daysAgo: 15, note: "for the May trip: day 2 is Belém", remindDue: true },
        { title: "BBC Food – Recipes", url: "https://www.bbc.co.uk/food", category: "recipes", daysAgo: 2 },
        { title: "Stack Overflow", url: "https://stackoverflow.com/", daysAgo: 1 },
    ],
    extras: [
        { title: "Cascading Style Sheets - Wikipedia", url: "https://en.wikipedia.org/wiki/Cascading_Style_Sheets", category: "reading", daysAgo: 34 },
        { title: "Picnic - Wikipedia", url: "https://en.wikipedia.org/wiki/Picnic", category: "reading", daysAgo: 18 },
        { title: "Hamburger - Wikipedia", url: "https://en.wikipedia.org/wiki/Hamburger", category: "reading", daysAgo: 23 },
        { title: "Google Flights", url: "https://www.google.com/travel/flights", category: "travel", daysAgo: 40, archivedDaysAgo: 6 },
        { title: "The Verge", url: "https://www.theverge.com/", category: "reading", daysAgo: 30, archivedDaysAgo: 2 },
    ],
    currentPage: "https://www.smashingmagazine.com/articles/",
    panelPage: "https://en.wikipedia.org/wiki/Club_sandwich",
    windowPages: ["https://vite.dev/", "https://preactjs.com/", "https://playwright.dev/", "https://www.typescriptlang.org/", "https://developer.chrome.com/docs/extensions"],
};

/** A language's own sample: its Wikipedia, Wikivoyage, MDN and Chrome docs, and sites of its own. */
type Local = {
    /** Wikipedia's (and Wikivoyage's) subdomain, and the path before a title ("wiki", or "zh-cn" for Simplified Chinese). */
    wiki: string;
    wikiPath?: string;
    /** "Sandwich – Wikipedia", as that Wikipedia titles a page. */
    wikiTitle: (title: string) => string;
    /** Wikipedia's titles of these articles in the language. */
    articles: { sandwich: string; css: string; picnic: string; hamburger: string; lettuce: string; bread: string; cheese: string; tomato: string; panel: string };
    lisbon: { page: string; title: string; note: string };
    /** MDN's and Google's language codes. */
    mdn: string;
    hl: string;
    news: [SampleTab, SampleTab];
    recipes: SampleTab;
    stackOverflow: SampleTab;
    flights: string;
};

function local(words: Omit<Sample, "tabs" | "extras" | "currentPage" | "panelPage" | "windowPages">, place: Local): Sample {
    const wiki = (title: string) => `https://${place.wiki}.wikipedia.org/${place.wikiPath ?? "wiki"}/${encodeURIComponent(title.replace(/ /g, "_"))}`;
    const page = (title: string, extra: Omit<SampleTab, "title" | "url">): SampleTab => ({ title: place.wikiTitle(title), url: wiki(title), ...extra });
    const a = place.articles;
    return {
        ...words,
        tabs: [
            { title: "GitHub", url: "https://github.com/", category: "work", pinned: true },
            { title: "MDN Web Docs", url: `https://developer.mozilla.org/${place.mdn}/`, category: "work", daysAgo: 2 },
            { title: "Figma", url: "https://www.figma.com/", category: "work", daysAgo: 12 },
            page(a.sandwich, { category: "reading", daysAgo: 9 }),
            { ...place.news[0], category: "reading", remindSoon: true },
            { ...place.news[1], category: "reading", daysAgo: 4 },
            { title: place.lisbon.title, url: `https://${place.wiki}.wikivoyage.org/${place.wikiPath ?? "wiki"}/${encodeURIComponent(place.lisbon.page)}`, category: "travel", daysAgo: 15, note: place.lisbon.note, remindDue: true },
            { ...place.recipes, category: "recipes", daysAgo: 2 },
            { ...place.stackOverflow, daysAgo: 1 },
        ],
        extras: [
            page(a.css, { category: "reading", daysAgo: 34 }),
            page(a.picnic, { category: "reading", daysAgo: 18 }),
            page(a.hamburger, { category: "reading", daysAgo: 23 }),
            { title: place.flights, url: `https://www.google.com/travel/flights?hl=${place.hl}`, category: "travel", daysAgo: 40, archivedDaysAgo: 6 },
            page(a.lettuce, { category: "reading", daysAgo: 30, archivedDaysAgo: 2 }),
        ],
        currentPage: `https://developer.mozilla.org/${place.mdn}/docs/Web/HTML`,
        panelPage: wiki(a.panel),
        windowPages: [wiki(a.bread), wiki(a.cheese), wiki(a.tomato), `https://developer.chrome.com/docs/extensions?hl=${place.hl}`, `https://web.dev/?hl=${place.hl}`],
    };
}

const de = local({
    hero: {
        headline: "Speichere die Seite, auf der du bist, mit einem Klick",
        points: ["Wähle beim Speichern eine Kategorie – eine ist schon vorgeschlagen.", "Favoriten anheften, eine Notiz dazu, den Rest archivieren."],
        promise: "Nur in deinem Browser gespeichert. Kein Konto, kein Tracking.",
    },
    panel: {
        headline: "Deine Liste offen, direkt neben der Seite",
        points: ["Ganz Tab Sandwich, neben dem, was du liest.", "Rechtsklick auf einen Link speichert ihn – und er erscheint hier."],
    },
    library: {
        headline: "Finde den Link wieder",
        points: ["Titel, Seiten und Notizen durchsuchen, schon beim Tippen.", "Nach jeder Spalte sortieren, viele auf einmal bearbeiten."],
        search: "wiki",
    },
    window: {
        headline: "Vierzig Tabs offen?<br>Speichere alle auf einmal",
        points: ["Ein Klick speichert das ganze Fenster, ohne schon Gespeichertes.", "Es bleibt in deiner Liste beisammen. Tabs schließen oder offen lassen."],
    },
    waiting: {
        headline: "Später lesen<br>oder für immer behalten",
        points: [
            "Zum Lesen gespeichert? Nach einer Woche ist es „Wartend“.",
            "Eine Erinnerung holt es am gewählten Tag zurück.",
            "Alles andere wird behalten und nervt nie.",
            "Fertig mit einem Tab? Archivieren – aus dem Weg, nie verloren.",
        ],
    },
    categories: { work: "Arbeit", reading: "Lesen", travel: "Reisen", recipes: "Rezepte" },
}, {
    wiki: "de",
    wikiTitle: (t) => `${t} – Wikipedia`,
    articles: { sandwich: "Sandwich", css: "Cascading Style Sheets", picnic: "Picknick", hamburger: "Hamburger", lettuce: "Gartensalat", bread: "Brot", cheese: "Käse", tomato: "Tomate", panel: "Club-Sandwich" },
    lisbon: { page: "Lissabon", title: "Lissabon – Reiseführer auf Wikivoyage", note: "für die Reise im Mai: Tag 2 ist Belém" },
    mdn: "de",
    hl: "de",
    news: [
        { title: "heise online – IT-News, Nachrichten und Hintergründe", url: "https://www.heise.de/" },
        { title: "tagesschau.de – Nachrichten", url: "https://www.tagesschau.de/" },
    ],
    recipes: { title: "Chefkoch – Rezepte und Kochen", url: "https://www.chefkoch.de/" },
    stackOverflow: { title: "Stack Overflow", url: "https://stackoverflow.com/" },
    flights: "Google Flüge",
});

const es = local({
    hero: {
        headline: "Guarda la página en la que estás, con un clic",
        points: ["Elige una categoría al guardar: te sugiere una.", "Fija tus favoritas, añade una nota, archiva el resto."],
        promise: "Solo se guarda en tu navegador. Sin cuenta, sin rastreo.",
    },
    panel: {
        headline: "Tu lista abierta junto a la página",
        points: ["Todo Tab Sandwich, junto a lo que estás leyendo.", "Haz clic derecho en un enlace para guardarlo, y aparece aquí."],
    },
    library: {
        headline: "Vuelve a encontrar ese enlace",
        points: ["Busca en títulos, sitios y notas mientras escribes.", "Ordena por cualquier columna, edita muchas a la vez."],
        search: "wiki",
    },
    window: {
        headline: "¿Cuarenta pestañas?<br>Guárdalas de una vez",
        points: ["Un clic guarda toda la ventana y se salta lo ya guardado.", "Se queda junta en tu lista. Cierra las pestañas o déjalas abiertas."],
    },
    waiting: {
        headline: "Léelo más tarde<br>o guárdalo para siempre",
        points: [
            "¿Guardado para leer? Tras una semana, pasa a En espera.",
            "Un recordatorio lo trae de vuelta el día que elijas.",
            "Todo lo demás se conserva y nunca molesta.",
            "¿Terminaste con una pestaña? Archívala: fuera de la vista, nunca perdida.",
        ],
    },
    categories: { work: "Trabajo", reading: "Lectura", travel: "Viajes", recipes: "Recetas" },
}, {
    wiki: "es",
    wikiTitle: (t) => `${t} - Wikipedia, la enciclopedia libre`,
    articles: { sandwich: "Sándwich", css: "CSS", picnic: "Pícnic", hamburger: "Hamburguesa", lettuce: "Lactuca sativa", bread: "Pan", cheese: "Queso", tomato: "Solanum lycopersicum", panel: "Club sandwich" },
    lisbon: { page: "Lisboa", title: "Lisboa – Guía de viaje en Wikiviajes", note: "para el viaje de mayo: el día 2, Belém" },
    mdn: "es",
    hl: "es",
    news: [
        { title: "EL PAÍS: el periódico global", url: "https://elpais.com/" },
        { title: "BBC News Mundo", url: "https://www.bbc.com/mundo" },
    ],
    recipes: { title: "Recetas de cocina – RecetasGratis", url: "https://www.recetasgratis.net/" },
    stackOverflow: { title: "Stack Overflow en español", url: "https://es.stackoverflow.com/" },
    flights: "Google Vuelos",
});

const fr = local({
    hero: {
        headline: "Enregistrez la page que vous lisez, en un clic",
        points: ["Choisissez une catégorie en enregistrant\u00a0: il vous en suggère une.", "Épinglez vos favoris, ajoutez une note, archivez le reste."],
        promise: "Stocké uniquement dans votre navigateur. Sans compte, sans pistage.",
    },
    panel: {
        headline: "Votre liste ouverte à côté de la page",
        points: ["Tout Tab Sandwich, à côté de ce que vous lisez.", "Un clic droit sur un lien l'enregistre, et il apparaît ici."],
    },
    library: {
        headline: "Retrouvez ce lien",
        points: ["Cherchez dans les titres, les sites et les notes dès la frappe.", "Triez par colonne, modifiez-en plusieurs à la fois."],
        search: "wiki",
    },
    window: {
        headline: "Quarante onglets\u00a0?<br>Tout enregistrer d'un clic",
        points: ["Un clic enregistre toute la fenêtre, sans ce qui l'est déjà.", "Elle reste groupée dans votre liste. Fermez les onglets, ou gardez-les."],
    },
    waiting: {
        headline: "Lisez plus tard,<br>ou gardez pour de bon",
        points: [
            "Enregistré pour plus tard\u00a0? Après une semaine, il passe En attente.",
            "Un rappel le ramène le jour que vous choisissez.",
            "Tout le reste est conservé, sans jamais vous relancer.",
            "Fini avec un onglet\u00a0? Archivez-le\u00a0: rangé, jamais perdu.",
        ],
    },
    categories: { work: "Travail", reading: "Lecture", travel: "Voyages", recipes: "Recettes" },
}, {
    wiki: "fr",
    wikiTitle: (t) => `${t} — Wikipédia`,
    articles: { sandwich: "Sandwich", css: "Feuilles de style en cascade", picnic: "Pique-nique", hamburger: "Hamburger", lettuce: "Laitue cultivée", bread: "Pain", cheese: "Fromage", tomato: "Tomate", panel: "Club sandwich" },
    lisbon: { page: "Lisbonne", title: "Lisbonne — Wikivoyage, le guide de voyage", note: "pour le voyage de mai\u00a0: jour 2, Belém" },
    mdn: "fr",
    hl: "fr",
    news: [
        { title: "Le Monde.fr – Actualités et infos en France et dans le monde", url: "https://www.lemonde.fr/" },
        { title: "BBC News Afrique", url: "https://www.bbc.com/afrique" },
    ],
    recipes: { title: "Marmiton\u00a0: recettes de cuisine", url: "https://www.marmiton.org/" },
    stackOverflow: { title: "Stack Overflow", url: "https://stackoverflow.com/" },
    flights: "Google Vols",
});

const pt_BR = local({
    hero: {
        headline: "Salve a página em que você está, com um clique",
        points: ["Escolha uma categoria ao salvar: ele sugere uma.", "Fixe as favoritas, adicione uma nota, arquive o resto."],
        promise: "Guardado só no seu navegador. Sem conta, sem rastreamento.",
    },
    panel: {
        headline: "Sua lista aberta ao lado da página",
        points: ["Todo o Tab Sandwich, ao lado do que você está lendo.", "Clique com o botão direito num link para salvá-lo, e ele aparece aqui."],
    },
    library: {
        headline: "Encontre aquele link de novo",
        points: ["Pesquise títulos, sites e notas enquanto digita.", "Ordene por qualquer coluna, edite várias de uma vez."],
        search: "wiki",
    },
    window: {
        headline: "Quarenta guias abertas?<br>Salve todas de uma vez",
        points: ["Um clique salva a janela inteira, pulando o que já está salvo.", "Ela fica junta na sua lista. Feche as guias ou deixe-as abertas."],
    },
    waiting: {
        headline: "Leia depois<br>ou guarde para sempre",
        points: [
            "Salvou para ler? Depois de uma semana, fica Aguardando.",
            "Um lembrete traz de volta no dia que você escolher.",
            "Todo o resto é mantido e nunca incomoda.",
            "Terminou com uma guia? Arquive: fora do caminho, nunca perdida.",
        ],
    },
    categories: { work: "Trabalho", reading: "Leitura", travel: "Viagens", recipes: "Receitas" },
}, {
    wiki: "pt",
    wikiTitle: (t) => `${t} – Wikipédia, a enciclopédia livre`,
    articles: { sandwich: "Sanduíche", css: "CSS", picnic: "Piquenique", hamburger: "Hambúrguer", lettuce: "Alface", bread: "Pão", cheese: "Queijo", tomato: "Tomate", panel: "Sanduíche BLT" },
    lisbon: { page: "Lisboa", title: "Lisboa – Wikivoyage", note: "para a viagem de maio: dia 2 é Belém" },
    mdn: "pt-BR",
    hl: "pt-br",
    news: [
        { title: "g1 – O portal de notícias da Globo", url: "https://g1.globo.com/" },
        { title: "BBC News Brasil", url: "https://www.bbc.com/portuguese" },
    ],
    recipes: { title: "TudoGostoso – Receitas", url: "https://www.tudogostoso.com.br/" },
    stackOverflow: { title: "Stack Overflow em Português", url: "https://pt.stackoverflow.com/" },
    flights: "Google Voos",
});

const ru = local({
    hero: {
        headline: "Сохраните открытую страницу в один клик",
        points: ["Выберите категорию при сохранении — подходящая уже предложена.", "Закрепите любимые, добавьте заметку, остальное — в архив."],
        promise: "Хранится только в вашем браузере. Без аккаунта и слежки.",
    },
    panel: {
        headline: "Список всегда рядом со страницей",
        points: ["Весь Tab Sandwich рядом с тем, что вы читаете.", "Сохраните ссылку правым кликом — и она сразу здесь."],
    },
    library: {
        headline: "Найдите ту самую ссылку",
        points: ["Поиск по заголовкам, сайтам и заметкам прямо при вводе.", "Сортировка по любому столбцу, правка многих сразу."],
        search: "вики",
    },
    window: {
        headline: "Сорок вкладок открыто?<br>Сохраните все разом",
        points: ["Один клик сохраняет всё окно, пропуская уже сохранённое.", "Оно остаётся вместе в списке. Закройте вкладки или оставьте их."],
    },
    waiting: {
        headline: "Прочитать позже<br>или хранить всегда",
        points: [
            "Сохранили, чтобы прочитать? Через неделю она в «Ждут».",
            "Напоминание вернёт её в выбранный день.",
            "Всё остальное хранится и не напоминает о себе.",
            "Вкладка больше не нужна? В архив: не мешает и не теряется.",
        ],
    },
    categories: { work: "Работа", reading: "Чтение", travel: "Поездки", recipes: "Рецепты" },
}, {
    wiki: "ru",
    wikiTitle: (t) => `${t} — Википедия`,
    articles: { sandwich: "Сэндвич", css: "CSS", picnic: "Пикник", hamburger: "Гамбургер", lettuce: "Латук посевной", bread: "Хлеб", cheese: "Сыр", tomato: "Томат", panel: "Клаб-сэндвич" },
    lisbon: { page: "Лиссабон", title: "Лиссабон — Викигид", note: "для поездки в мае: день 2 — Белен" },
    mdn: "ru",
    hl: "ru",
    news: [
        { title: "Хабр", url: "https://habr.com/ru/" },
        { title: "BBC News Русская служба", url: "https://www.bbc.com/russian" },
    ],
    recipes: { title: "Еда.ру — рецепты", url: "https://eda.ru/" },
    stackOverflow: { title: "Stack Overflow на русском", url: "https://ru.stackoverflow.com/" },
    flights: "Google Авиабилеты",
});

const ja = local({
    hero: {
        headline: "いま見ているページを、<br>ワンクリックで保存",
        points: ["保存するときにカテゴリを選べます。おすすめも出ます。", "お気に入りはピン留め、メモも残せて、残りはアーカイブ。"],
        promise: "保存先はブラウザの中だけ。アカウント不要、追跡なし。",
    },
    panel: {
        headline: "リストをページの横に開いたままに",
        points: ["Tab Sandwich のすべてを、読んでいるページの横に。", "リンクを右クリックで保存すると、ここに表示されます。"],
    },
    library: {
        headline: "あのリンクを、また見つける",
        points: ["タイトル・サイト・メモを入力しながら検索。", "どの列でも並べ替え、まとめて編集。"],
        search: "wiki",
    },
    window: {
        headline: "タブが40個も？<br>まとめて一度に保存",
        points: ["ワンクリックでウィンドウ全体を保存。保存済みは飛ばします。", "リストの中でひとまとまりに。タブは閉じても、開いたままでも。"],
    },
    waiting: {
        headline: "あとで読む？<br>ずっと残す？",
        points: [
            "読むために保存したら、1週間で「あとで」に。",
            "リマインダーで、選んだ日に戻ってきます。",
            "ほかのタブはそのまま。せかしません。",
            "用が済んだらアーカイブ。邪魔にならず、なくなりません。",
        ],
    },
    categories: { work: "仕事", reading: "読みもの", travel: "旅行", recipes: "レシピ" },
}, {
    wiki: "ja",
    wikiTitle: (t) => `${t} - Wikipedia`,
    articles: { sandwich: "サンドイッチ", css: "CSS (スタイルシート言語)", picnic: "ピクニック", hamburger: "ハンバーガー", lettuce: "レタス", bread: "パン", cheese: "チーズ", tomato: "トマト", panel: "アメリカンクラブハウスサンド" },
    lisbon: { page: "リスボン", title: "リスボン - Wikivoyage", note: "5月の旅行用：2日目はベレン" },
    mdn: "ja",
    hl: "ja",
    news: [
        { title: "NHKニュース", url: "https://www3.nhk.or.jp/news/" },
        { title: "Qiita", url: "https://qiita.com/" },
    ],
    recipes: { title: "クックパッド", url: "https://cookpad.com/jp" },
    stackOverflow: { title: "スタック・オーバーフロー", url: "https://ja.stackoverflow.com/" },
    flights: "Google フライト",
});

const zh_CN = local({
    hero: {
        headline: "一键保存<br>你正在看的页面",
        points: ["保存时选择分类，还会为你推荐一个。", "常用的置顶，加个备注，其余的归档。"],
        promise: "只保存在你的浏览器中。无需账号，不做跟踪。",
    },
    panel: {
        headline: "让列表一直开在页面旁边",
        points: ["完整的 Tab Sandwich，就在你阅读的内容旁边。", "右键点击链接即可保存，它会立刻出现在这里。"],
    },
    library: {
        headline: "再次找到那个链接",
        points: ["边输入边搜索标题、网站和备注。", "按任意列排序，一次编辑多个。"],
        search: "维基",
    },
    window: {
        headline: "开了四十个标签页？<br>一次全部保存",
        points: ["一键保存整个窗口，已保存的自动跳过。", "它们在列表中保持在一起。关掉标签页，或继续开着。"],
    },
    waiting: {
        headline: "稍后再读，<br>或永久保留",
        points: [
            "存起来要读？一周后会出现在“稍后看”。",
            "提醒会在你选的那天把它带回来。",
            "其他的都会保留，从不打扰。",
            "用完了？归档它：不碍事，也不会丢。",
        ],
    },
    categories: { work: "工作", reading: "阅读", travel: "旅行", recipes: "菜谱" },
}, {
    wiki: "zh",
    wikiPath: "zh-cn",
    wikiTitle: (t) => `${t} - 维基百科，自由的百科全书`,
    articles: { sandwich: "三明治", css: "CSS", picnic: "野餐", hamburger: "汉堡包", lettuce: "莴苣", bread: "面包", cheese: "奶酪", tomato: "番茄", panel: "培根生菜番茄三明治" },
    lisbon: { page: "里斯本", title: "里斯本 - 维基导游", note: "五月旅行用：第二天去贝伦" },
    mdn: "zh-CN",
    hl: "zh-cn",
    news: [
        { title: "BBC News 中文", url: "https://www.bbc.com/zhongwen/simp" },
        { title: "少数派", url: "https://sspai.com/" },
    ],
    recipes: { title: "下厨房", url: "https://www.xiachufang.com/" },
    stackOverflow: { title: "Stack Overflow", url: "https://stackoverflow.com/" },
    flights: "Google 机票",
});

/** By the dictionaries' own names (src/ui/strings.ts), which are also Chrome's spelling of each language. */
export const SAMPLES: Record<string, Sample> = { en, de, es, fr, ja, pt_BR, ru, zh_CN };
