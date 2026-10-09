/*
 * SafeBriefing – Demo-Datenbasis
 *
 * Alle Übersetzungen in dieser Datei sind DEMO-Übersetzungen. Vor jedem
 * echten Einsatz: Muttersprachler-Check und fachliche Freigabe durch die
 * Fachkraft für Arbeitssicherheit (Sifa) des Betriebs.
 *
 * Werk, Personen und Firmen sind fiktiv.
 */
(function (root) {
  'use strict';

  var LANGS = [
    { code: 'de', name: 'Deutsch', native: 'Deutsch', dir: 'ltr', tts: 'de-DE' },
    { code: 'pl', name: 'Polnisch', native: 'Polski', dir: 'ltr', tts: 'pl-PL' },
    { code: 'ro', name: 'Rumänisch', native: 'Română', dir: 'ltr', tts: 'ro-RO' },
    { code: 'tr', name: 'Türkisch', native: 'Türkçe', dir: 'ltr', tts: 'tr-TR' },
    { code: 'ar', name: 'Arabisch', native: 'العربية', dir: 'rtl', tts: 'ar' },
    { code: 'uk', name: 'Ukrainisch', native: 'Українська', dir: 'ltr', tts: 'uk-UA' },
    { code: 'bg', name: 'Bulgarisch', native: 'Български', dir: 'ltr', tts: 'bg-BG' },
    { code: 'ru', name: 'Russisch', native: 'Русский', dir: 'ltr', tts: 'ru-RU' },
    { code: 'en', name: 'Englisch', native: 'English', dir: 'ltr', tts: 'en-GB' }
  ];

  // Texte der Beschäftigten-Ansicht (Handy, Brille, Pforte)
  var UI = {
    de: {
      chooseLang: 'Sprache wählen', live: 'Live-Unterweisung', waiting: 'Warte auf die nächste Anweisung …',
      understood: 'Verstanden', question: 'Nicht verstanden', listen: 'Vorlesen', showGerman: 'Deutsch zeigen',
      checkTitle: 'Verständnisfrage', correct: 'Richtig!', wrong: 'Nicht ganz. Bitte fragen Sie Ihre Führungskraft.',
      anonymous: 'Ihre Antwort ist anonym.', held: 'Diese Anweisung wird für Ihre Sprache noch geprüft. Bitte warten oder Führungskraft fragen.',
      verified: 'Geprüfte Übersetzung', aiLabel: 'KI-übersetzt · geprüft', sent: 'Gesendet. Die Führungskraft sieht Ihre Rückmeldung anonym.',
      quickTitle: 'Rückmeldung an die Führungskraft', askTitle: 'Frage stellen', askPlaceholder: 'Ihre Frage …',
      askHint: 'Antworten nur aus freigegebenen Unterweisungsinhalten.', fallback: 'Dazu gibt es keine freigegebene Antwort. Bitte fragen Sie Ihre Führungskraft.',
      privacy: 'Keine Anmeldung, keine App. Ihre Stimme wird nicht gespeichert.', sign: 'Teilnahme bestätigen', name: 'Name', company: 'Firma',
      confirm: 'Bestätigen', confirmed: 'Teilnahme bestätigt', passTitle: 'Einweisungs-Nachweis', validUntil: 'gültig bis', next: 'Weiter', back: 'Zurück',
      start: 'Einweisung starten', rulesTitle: 'Werksregeln', passed: 'Bestanden', retry: 'Bitte die Regeln noch einmal ansehen.',
      showAtGate: 'Diesen Nachweis an der Pforte und dem Koordinator zeigen.', send: 'Senden', ask: 'Fragen', source: 'Quelle'
    },
    pl: {
      chooseLang: 'Wybierz język', live: 'Instruktaż na żywo', waiting: 'Czekaj na następne polecenie …',
      understood: 'Rozumiem', question: 'Nie rozumiem', listen: 'Odsłuchaj', showGerman: 'Pokaż po niemiecku',
      checkTitle: 'Pytanie kontrolne', correct: 'Dobrze!', wrong: 'Niezupełnie. Zapytaj przełożonego.',
      anonymous: 'Twoja odpowiedź jest anonimowa.', held: 'To polecenie jest jeszcze sprawdzane dla Twojego języka. Poczekaj lub zapytaj przełożonego.',
      verified: 'Sprawdzone tłumaczenie', aiLabel: 'Przetłumaczone przez AI · sprawdzone', sent: 'Wysłano. Przełożony widzi Twoją odpowiedź anonimowo.',
      quickTitle: 'Informacja dla przełożonego', askTitle: 'Zadaj pytanie', askPlaceholder: 'Twoje pytanie …',
      askHint: 'Odpowiedzi tylko z zatwierdzonych treści instruktażu.', fallback: 'Brak zatwierdzonej odpowiedzi. Zapytaj przełożonego.',
      privacy: 'Bez logowania, bez aplikacji. Twój głos nie jest zapisywany.', sign: 'Potwierdź udział', name: 'Imię i nazwisko', company: 'Firma',
      confirm: 'Potwierdź', confirmed: 'Udział potwierdzony', passTitle: 'Potwierdzenie instruktażu', validUntil: 'ważne do', next: 'Dalej', back: 'Wstecz',
      start: 'Rozpocznij instruktaż', rulesTitle: 'Zasady zakładu', passed: 'Zaliczone', retry: 'Przejrzyj zasady jeszcze raz.',
      showAtGate: 'Pokaż to potwierdzenie na portierni i koordynatorowi.', send: 'Wyślij', ask: 'Zapytaj', source: 'Źródło'
    },
    ro: {
      chooseLang: 'Alegeți limba', live: 'Instruire live', waiting: 'Așteptați următoarea instrucțiune …',
      understood: 'Am înțeles', question: 'Nu am înțeles', listen: 'Ascultă', showGerman: 'Arată în germană',
      checkTitle: 'Întrebare de verificare', correct: 'Corect!', wrong: 'Nu chiar. Întrebați-l pe șeful direct.',
      anonymous: 'Răspunsul dumneavoastră este anonim.', held: 'Această instrucțiune este încă verificată pentru limba dumneavoastră. Așteptați sau întrebați-l pe șef.',
      verified: 'Traducere verificată', aiLabel: 'Tradus cu AI · verificat', sent: 'Trimis. Șeful vede mesajul dumneavoastră anonim.',
      quickTitle: 'Mesaj pentru șef', askTitle: 'Puneți o întrebare', askPlaceholder: 'Întrebarea dumneavoastră …',
      askHint: 'Răspunsuri doar din conținuturi de instruire aprobate.', fallback: 'Nu există un răspuns aprobat. Întrebați-l pe șeful direct.',
      privacy: 'Fără cont, fără aplicație. Vocea dumneavoastră nu este salvată.', sign: 'Confirmați participarea', name: 'Nume', company: 'Firmă',
      confirm: 'Confirmă', confirmed: 'Participare confirmată', passTitle: 'Dovada instruirii', validUntil: 'valabil până la', next: 'Înainte', back: 'Înapoi',
      start: 'Începe instruirea', rulesTitle: 'Regulile uzinei', passed: 'Promovat', retry: 'Vă rugăm să revedeți regulile.',
      showAtGate: 'Arătați această dovadă la poartă și coordonatorului.', send: 'Trimite', ask: 'Întreabă', source: 'Sursă'
    },
    tr: {
      chooseLang: 'Dil seçin', live: 'Canlı bilgilendirme', waiting: 'Bir sonraki talimat bekleniyor …',
      understood: 'Anladım', question: 'Anlamadım', listen: 'Sesli dinle', showGerman: 'Almancasını göster',
      checkTitle: 'Kontrol sorusu', correct: 'Doğru!', wrong: 'Tam değil. Lütfen amirinize sorun.',
      anonymous: 'Cevabınız anonimdir.', held: 'Bu talimat sizin diliniz için hâlâ kontrol ediliyor. Lütfen bekleyin veya amirinize sorun.',
      verified: 'Kontrol edilmiş çeviri', aiLabel: 'Yapay zekâ ile çevrildi · kontrol edildi', sent: 'Gönderildi. Amiriniz geri bildiriminizi anonim olarak görür.',
      quickTitle: 'Amire geri bildirim', askTitle: 'Soru sorun', askPlaceholder: 'Sorunuz …',
      askHint: 'Cevaplar yalnızca onaylı eğitim içeriklerinden.', fallback: 'Bunun için onaylı bir cevap yok. Lütfen amirinize sorun.',
      privacy: 'Kayıt yok, uygulama yok. Sesiniz kaydedilmez.', sign: 'Katılımı onayla', name: 'Ad Soyad', company: 'Firma',
      confirm: 'Onayla', confirmed: 'Katılım onaylandı', passTitle: 'Eğitim belgesi', validUntil: 'geçerlilik tarihi', next: 'İleri', back: 'Geri',
      start: 'Eğitimi başlat', rulesTitle: 'Fabrika kuralları', passed: 'Başarılı', retry: 'Lütfen kuralları tekrar inceleyin.',
      showAtGate: 'Bu belgeyi kapıda ve koordinatöre gösterin.', send: 'Gönder', ask: 'Sor', source: 'Kaynak'
    },
    ar: {
      chooseLang: 'اختر اللغة', live: 'توجيه مباشر', waiting: 'في انتظار التعليمات التالية …',
      understood: 'فهمت', question: 'لم أفهم', listen: 'استمع', showGerman: 'عرض بالألمانية',
      checkTitle: 'سؤال للتحقق من الفهم', correct: 'صحيح!', wrong: 'ليس تماماً. يرجى سؤال المسؤول.',
      anonymous: 'إجابتك مجهولة الهوية.', held: 'لا تزال هذه التعليمات قيد التدقيق للغتك. يرجى الانتظار أو سؤال المسؤول.',
      verified: 'ترجمة مدققة', aiLabel: 'ترجمة بالذكاء الاصطناعي · مدققة', sent: 'تم الإرسال. يرى المسؤول ملاحظتك دون ذكر اسمك.',
      quickTitle: 'ملاحظة إلى المسؤول', askTitle: 'اطرح سؤالاً', askPlaceholder: 'سؤالك …',
      askHint: 'الإجابات فقط من محتوى التوجيه المعتمد.', fallback: 'لا توجد إجابة معتمدة لهذا السؤال. يرجى سؤال المسؤول.',
      privacy: 'بدون تسجيل وبدون تطبيق. لا يتم حفظ صوتك.', sign: 'تأكيد المشاركة', name: 'الاسم', company: 'الشركة',
      confirm: 'تأكيد', confirmed: 'تم تأكيد المشاركة', passTitle: 'إثبات التوجيه', validUntil: 'صالح حتى', next: 'التالي', back: 'رجوع',
      start: 'ابدأ التوجيه', rulesTitle: 'قواعد المصنع', passed: 'ناجح', retry: 'يرجى مراجعة القواعد مرة أخرى.',
      showAtGate: 'أظهر هذا الإثبات عند البوابة وللمنسق.', send: 'إرسال', ask: 'اسأل', source: 'المصدر'
    },
    uk: {
      chooseLang: 'Оберіть мову', live: 'Інструктаж наживо', waiting: 'Очікування наступної вказівки …',
      understood: 'Зрозуміло', question: 'Не зрозуміло', listen: 'Прослухати', showGerman: 'Показати німецькою',
      checkTitle: 'Контрольне питання', correct: 'Правильно!', wrong: 'Не зовсім. Запитайте свого керівника.',
      anonymous: 'Ваша відповідь анонімна.', held: 'Цю вказівку ще перевіряють для вашої мови. Зачекайте або запитайте керівника.',
      verified: 'Перевірений переклад', aiLabel: 'Перекладено ШІ · перевірено', sent: 'Надіслано. Керівник бачить ваш відгук анонімно.',
      quickTitle: 'Відгук для керівника', askTitle: 'Поставити питання', askPlaceholder: 'Ваше питання …',
      askHint: 'Відповіді лише із затверджених матеріалів інструктажу.', fallback: 'На це немає затвердженої відповіді. Запитайте свого керівника.',
      privacy: 'Без реєстрації, без застосунку. Ваш голос не зберігається.', sign: 'Підтвердити участь', name: 'Ім’я', company: 'Фірма',
      confirm: 'Підтвердити', confirmed: 'Участь підтверджено', passTitle: 'Підтвердження інструктажу', validUntil: 'дійсне до', next: 'Далі', back: 'Назад',
      start: 'Почати інструктаж', rulesTitle: 'Правила заводу', passed: 'Складено', retry: 'Будь ласка, перегляньте правила ще раз.',
      showAtGate: 'Покажіть це підтвердження на прохідній і координатору.', send: 'Надіслати', ask: 'Запитати', source: 'Джерело'
    },
    bg: {
      chooseLang: 'Изберете език', live: 'Инструктаж на живо', waiting: 'Изчакване на следващото указание …',
      understood: 'Разбрах', question: 'Не разбрах', listen: 'Прочети на глас', showGerman: 'Покажи на немски',
      checkTitle: 'Контролен въпрос', correct: 'Правилно!', wrong: 'Не съвсем. Моля, попитайте ръководителя си.',
      anonymous: 'Отговорът ви е анонимен.', held: 'Това указание все още се проверява за вашия език. Моля, изчакайте или попитайте ръководителя.',
      verified: 'Проверен превод', aiLabel: 'Преведено с ИИ · проверено', sent: 'Изпратено. Ръководителят вижда обратната ви връзка анонимно.',
      quickTitle: 'Обратна връзка към ръководителя', askTitle: 'Задайте въпрос', askPlaceholder: 'Вашият въпрос …',
      askHint: 'Отговори само от одобрени материали за инструктаж.', fallback: 'Няма одобрен отговор на този въпрос. Моля, попитайте ръководителя си.',
      privacy: 'Без регистрация, без приложение. Гласът ви не се записва.', sign: 'Потвърдете участие', name: 'Име', company: 'Фирма',
      confirm: 'Потвърди', confirmed: 'Участието е потвърдено', passTitle: 'Удостоверение за инструктаж', validUntil: 'валидно до', next: 'Напред', back: 'Назад',
      start: 'Започни инструктажа', rulesTitle: 'Правила на завода', passed: 'Издържан', retry: 'Моля, прегледайте правилата отново.',
      showAtGate: 'Покажете това удостоверение на портала и на координатора.', send: 'Изпрати', ask: 'Питай', source: 'Източник'
    },
    ru: {
      chooseLang: 'Выберите язык', live: 'Инструктаж в прямом эфире', waiting: 'Ожидание следующего указания …',
      understood: 'Понятно', question: 'Не понятно', listen: 'Прослушать', showGerman: 'Показать по-немецки',
      checkTitle: 'Контрольный вопрос', correct: 'Правильно!', wrong: 'Не совсем. Спросите своего руководителя.',
      anonymous: 'Ваш ответ анонимен.', held: 'Это указание ещё проверяется для вашего языка. Подождите или спросите руководителя.',
      verified: 'Проверенный перевод', aiLabel: 'Переведено ИИ · проверено', sent: 'Отправлено. Руководитель видит ваш отзыв анонимно.',
      quickTitle: 'Отзыв для руководителя', askTitle: 'Задать вопрос', askPlaceholder: 'Ваш вопрос …',
      askHint: 'Ответы только из утверждённых материалов инструктажа.', fallback: 'Утверждённого ответа нет. Спросите своего руководителя.',
      privacy: 'Без регистрации и приложения. Ваш голос не сохраняется.', sign: 'Подтвердить участие', name: 'Имя', company: 'Фирма',
      confirm: 'Подтвердить', confirmed: 'Участие подтверждено', passTitle: 'Подтверждение инструктажа', validUntil: 'действительно до', next: 'Далее', back: 'Назад',
      start: 'Начать инструктаж', rulesTitle: 'Правила завода', passed: 'Сдано', retry: 'Пожалуйста, просмотрите правила ещё раз.',
      showAtGate: 'Покажите это подтверждение на проходной и координатору.', send: 'Отправить', ask: 'Спросить', source: 'Источник'
    },
    en: {
      chooseLang: 'Choose language', live: 'Live briefing', waiting: 'Waiting for the next instruction …',
      understood: 'Understood', question: 'Not understood', listen: 'Read aloud', showGerman: 'Show German',
      checkTitle: 'Check question', correct: 'Correct!', wrong: 'Not quite. Please ask your supervisor.',
      anonymous: 'Your answer is anonymous.', held: 'This instruction is still being checked for your language. Please wait or ask your supervisor.',
      verified: 'Verified translation', aiLabel: 'AI-translated · checked', sent: 'Sent. Your supervisor sees your feedback anonymously.',
      quickTitle: 'Feedback to your supervisor', askTitle: 'Ask a question', askPlaceholder: 'Your question …',
      askHint: 'Answers only from approved briefing content.', fallback: 'There is no approved answer to this. Please ask your supervisor.',
      privacy: 'No login, no app. Your voice is not stored.', sign: 'Confirm attendance', name: 'Name', company: 'Company',
      confirm: 'Confirm', confirmed: 'Attendance confirmed', passTitle: 'Induction record', validUntil: 'valid until', next: 'Next', back: 'Back',
      start: 'Start induction', rulesTitle: 'Site rules', passed: 'Passed', retry: 'Please review the rules again.',
      showAtGate: 'Show this record at the gate and to the coordinator.', send: 'Send', ask: 'Ask', source: 'Source'
    }
  };

  // Werks-Glossar: freigegebene Zielbegriffe, Erkennungsmuster und unzulässige Übersetzungen
  var GLOSSARY = [
    { id: 'nothalt', de: 'Not-Halt', cat: 'Maschinen', critical: true, picto: 'nothalt', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Einheitlich „Not-Halt“ (auch „Not-Aus“ gesprochen). Nie mit „Notausgang“ verwechseln.',
      match: ['nothalt', 'notaus', 'notstopp'], exclude: ['notausgang', 'notausstieg'],
      t: {
        en: { term: 'emergency stop', match: ['emergency stop', 'e-stop'], forbidden: ['emergency exit'] },
        pl: { term: 'wyłącznik awaryjny', match: ['wyłącznik awaryjn', 'wyłącznika awaryjn', 'wyłącznikiem awaryjn', 'zatrzymania awaryjnego', 'zatrzymanie awaryjne'], forbidden: ['wyjście awaryjne', 'wyjścia awaryjnego'] },
        ro: { term: 'oprire de urgență', match: ['oprire de urgen', 'oprirea de urgen', 'opririi de urgen', 'butonul de urgen'], forbidden: ['ieșire de urgență', 'ieșirea de urgență'] },
        tr: { term: 'acil durdurma', match: ['acil durdur', 'acil stop'], forbidden: ['acil çıkış'] },
        ar: { term: 'إيقاف الطوارئ', match: ['إيقاف الطوارئ', 'الإيقاف الطارئ', 'إيقاف طارئ', 'زر الطوارئ'], forbidden: ['مخرج الطوارئ'] },
        uk: { term: 'аварійна зупинка', match: ['аварійна зупин', 'аварійної зупин', 'аварійну зупин', 'аварійний вимикач', 'аварійного вимикача'], forbidden: ['аварійний вихід'] },
        bg: { term: 'аварийно спиране', match: ['аварийно спиран', 'аварийния бутон', 'авариен стоп', 'аварийния стоп'], forbidden: ['авариен изход'] },
        ru: { term: 'аварийная остановка', match: ['аварийная останов', 'аварийной останов', 'аварийную останов', 'аварийный стоп', 'аварийный выключат', 'аварийного выключат'], forbidden: ['аварийный выход'] }
      } },
    { id: 'freischalten', de: 'freischalten', cat: 'Elektro / HV', critical: true, picto: 'spannung', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Elektrotechnisch: von der Energieversorgung trennen (1. der 5 Sicherheitsregeln). Typischer Fehler: als „freigeben“ oder „einschalten“ übersetzt.',
      match: ['freischalt', 'freigeschalt'],
      t: {
        en: { term: 'isolate (disconnect from power)', match: ['isolat', 'disconnect', 'de-energi', 'switch off'], forbidden: ['switch on', 'turn on', 'enable', 'unlock', 'release'] },
        pl: { term: 'odłączyć od zasilania', match: ['odłącz', 'wyłącz', 'spod napięcia'], forbidden: ['włącz', 'załącz', 'odblokuj', 'uruchom'] },
        ro: { term: 'deconectați de la alimentare', match: ['deconect', 'de sub tensiune'], forbidden: ['porniți', 'conectați', 'activați', 'deblocați'] },
        tr: { term: 'enerjisini kesin', match: ['enerjisini kes', 'enerjiyi kes', 'elektriğini kes', 'gerilimden ayır', 'gerilimsiz'], forbidden: ['çalıştır', 'devreye al', 'etkinleştir', 'enerji ver'] },
        ar: { term: 'افصل التيار الكهربائي', match: ['فصل التيار', 'افصل التيار', 'فصل الكهرباء', 'قطع التيار', 'اقطع التيار'], forbidden: ['تشغيل', 'شغّل', 'تفعيل'] },
        uk: { term: 'знеструмити', match: ['знеструм', 'вимкн', 'відключ', 'від мережі'], forbidden: ['увімкн', 'ввімкн', 'запуст'] },
        bg: { term: 'изключете от захранването', match: ['изключ', 'обезточ'], forbidden: ['включ', 'пуснете', 'пускане'] },
        ru: { term: 'обесточить', match: ['обесточ', 'отключ', 'выключ'], forbidden: ['включ', 'запуст', 'разблокир'] }
      } },
    { id: 'hochvolt', de: 'Hochvolt (HV)', cat: 'Elektro / HV', critical: true, picto: 'spannung', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'HV-Komponenten in Fahrzeugen und Batterien. Arbeiten nur mit Qualifikation und Freigabe.',
      match: ['hochvolt', 'hv', 'hochspannung'],
      t: {
        en: { term: 'high-voltage', match: ['high-voltage', 'high voltage'] },
        pl: { term: 'wysokie napięcie', match: ['wysokiego napięcia', 'wysokie napięcie', 'wysokim napięciu', 'wysokonapięciow'] },
        ro: { term: 'înaltă tensiune', match: ['înaltă tensiune', 'înalte tensiuni', 'tensiune înaltă'] },
        tr: { term: 'yüksek gerilim', match: ['yüksek gerilim', 'yüksek voltaj'] },
        ar: { term: 'الجهد العالي', match: ['الجهد العالي', 'جهد عال'] },
        uk: { term: 'висока напруга', match: ['висока напруга', 'високої напруги', 'високою напругою', 'високій напрузі', 'високовольт'] },
        bg: { term: 'високо напрежение', match: ['високо напрежение', 'високото напрежение', 'високоволтов'] },
        ru: { term: 'высокое напряжение', match: ['высокое напряжение', 'высокого напряжения', 'высоким напряжением', 'высоком напряжении', 'высоковольт'] }
      } },
    { id: 'stapler', de: 'Gabelstapler', cat: 'Verkehr', critical: false, picto: 'stapler', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Fachsprachlich „Flurförderzeug“. In der Unterweisung „Stapler“ sagen.',
      match: ['gabelstapler', 'stapler', 'flurförderzeug'],
      t: {
        en: { term: 'forklift', match: ['forklift', 'fork-lift', 'lift truck'] },
        pl: { term: 'wózek widłowy', match: ['widłow'] },
        ro: { term: 'stivuitor', match: ['stivuito'] },
        tr: { term: 'forklift', match: ['forklift', 'istif makin'] },
        ar: { term: 'رافعة شوكية', match: ['شوكية'] },
        uk: { term: 'навантажувач', match: ['навантажувач'] },
        bg: { term: 'мотокар', match: ['мотокар', 'електрокар', 'вилков'] },
        ru: { term: 'погрузчик', match: ['погрузчик'] }
      } },
    { id: 'schutzbrille', de: 'Schutzbrille', cat: 'PSA', critical: false, picto: 'brille', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Gebotszeichen M004 „Augenschutz benutzen“.',
      match: ['schutzbrille', 'augenschutz'],
      t: {
        en: { term: 'safety glasses', match: ['safety glasses', 'safety goggles', 'eye protection', 'protective glasses'] },
        pl: { term: 'okulary ochronne', match: ['okulary ochronn', 'okularach ochronn', 'okularów ochronn', 'ochrona oczu', 'ochronę oczu'] },
        ro: { term: 'ochelari de protecție', match: ['ochelari de protec', 'ochelarii de protec', 'protecția ochilor'] },
        tr: { term: 'koruyucu gözlük', match: ['koruyucu gözlük', 'iş gözlüğü', 'göz koruyucu'] },
        ar: { term: 'نظارات واقية', match: ['نظارات واقية', 'نظارة واقية', 'النظارات الواقية', 'النظارة الواقية'] },
        uk: { term: 'захисні окуляри', match: ['захисні окуляр', 'захисних окуляр'] },
        bg: { term: 'предпазни очила', match: ['предпазни очила', 'защитни очила'] },
        ru: { term: 'защитные очки', match: ['защитные очки', 'защитных очк', 'защитными очк'] }
      } },
    { id: 'gehoerschutz', de: 'Gehörschutz', cat: 'PSA', critical: false, picto: 'gehoer', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Gebotszeichen M003 „Gehörschutz benutzen“. Ab 85 dB(A) Tragepflicht.',
      match: ['gehörschutz'],
      t: {
        en: { term: 'hearing protection', match: ['hearing protection', 'ear protection', 'ear defenders', 'earplugs', 'ear muffs'] },
        pl: { term: 'ochronniki słuchu', match: ['ochronnik', 'ochrona słuchu', 'ochronę słuchu', 'ochrony słuchu', 'zatyczk'] },
        ro: { term: 'antifoane', match: ['antifoan', 'protecție auditivă', 'protecția auzului'] },
        tr: { term: 'kulak koruyucu', match: ['kulak koruyucu', 'kulak tıkac'] },
        ar: { term: 'واقي السمع', match: ['واقي السمع', 'واقيات السمع', 'حماية السمع', 'سدادات الأذن'] },
        uk: { term: 'засоби захисту органів слуху', match: ['захисту слуху', 'захисту органів слуху', 'навушник', 'беруш'] },
        bg: { term: 'антифони', match: ['антифон', 'защита на слуха'] },
        ru: { term: 'средства защиты слуха', match: ['защиты слуха', 'защиту слуха', 'беруш', 'противошумн'] }
      } },
    { id: 'absperrung', de: 'Absperrung', cat: 'Zutritt', critical: false, picto: 'zutritt', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Abgesperrte Bereiche nie betreten – auch nicht kurz.',
      match: ['absperr', 'abgesperrt'],
      t: {
        en: { term: 'barrier / cordoned-off', match: ['barrier', 'cordon', 'fenced'] },
        pl: { term: 'odgrodzony / bariera', match: ['odgrodz', 'barier', 'ogrodzeni'] },
        ro: { term: 'îngrădit / barieră', match: ['îngrădit', 'barier', 'delimitat'] },
        tr: { term: 'bariyer', match: ['bariyer', 'çitle', 'kordon'] },
        ar: { term: 'حاجز / مطوّقة', match: ['حاجز', 'مطوقة', 'سياج'] },
        uk: { term: 'огородження', match: ['огородж', 'загородж'] },
        bg: { term: 'заграждение', match: ['загражд', 'заграден', 'бариер'] },
        ru: { term: 'ограждение', match: ['огражд', 'огорож', 'заграждени'] }
      } },
    { id: 'sammelstelle', de: 'Sammelstelle', cat: 'Notfall', critical: true, picto: 'sammelstelle', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Rettungszeichen E007. Notfallhinweise immer als geprüfter Kernsatz.',
      match: ['sammelstelle', 'sammelplatz', 'sammelpunkt'],
      t: {
        en: { term: 'assembly point', match: ['assembly point', 'muster point'] },
        pl: { term: 'miejsce zbiórki', match: ['zbiórki'] },
        ro: { term: 'punctul de adunare', match: ['de adunare'] },
        tr: { term: 'toplanma alanı', match: ['toplanma'] },
        ar: { term: 'نقطة التجمع', match: ['التجمع'] },
        uk: { term: 'місце збору', match: ['збору'] },
        bg: { term: 'място за събиране', match: ['за събиране', 'сборн'] },
        ru: { term: 'место сбора', match: ['сбора'] }
      } },
    { id: 'erlaubnisschein', de: 'Erlaubnisschein', cat: 'Fremdfirmen', critical: true, picto: 'erlaubnis', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Für Heißarbeiten, Arbeiten in Behältern und an elektrischen Anlagen.',
      match: ['erlaubnisschein', 'freigabeschein', 'arbeitserlaubnis', 'feuererlaubnis'],
      t: {
        en: { term: 'permit to work', match: ['permit'] },
        pl: { term: 'pozwolenie na pracę', match: ['pozwoleni', 'zezwoleni'] },
        ro: { term: 'permis de lucru', match: ['permis de lucru', 'permisul de lucru', 'autorizație de lucru'] },
        tr: { term: 'çalışma izni', match: ['çalışma izn', 'iş izn'] },
        ar: { term: 'تصريح العمل', match: ['تصريح'] },
        uk: { term: 'наряд-допуск', match: ['наряд'] },
        bg: { term: 'разрешение за работа', match: ['разрешение за работа', 'наряд'] },
        ru: { term: 'наряд-допуск', match: ['наряд'] }
      } },
    { id: 'koordinator', de: 'Koordinator', cat: 'Fremdfirmen', critical: false, picto: 'erlaubnis', status: 'freigegeben', approvedBy: 'Sifa (Demo)', approvedAt: '2026-10-06',
      note: 'Person, die die Arbeiten mehrerer Firmen aufeinander abstimmt (DGUV Vorschrift 1 § 6).',
      match: ['koordinator'],
      t: {
        en: { term: 'coordinator', match: ['coordinator'] },
        pl: { term: 'koordynator', match: ['koordynator'] },
        ro: { term: 'coordonator', match: ['coordonator'] },
        tr: { term: 'koordinatör', match: ['koordinatör'] },
        ar: { term: 'المنسق', match: ['منسق'] },
        uk: { term: 'координатор', match: ['координатор'] },
        bg: { term: 'координатор', match: ['координатор'] },
        ru: { term: 'координатор', match: ['координатор'] }
      } },
    { id: 'quetschgefahr', de: 'Quetschgefahr', cat: 'Maschinen', critical: true, picto: 'quetsch', status: 'entwurf', approvedBy: '', approvedAt: '',
      note: 'Entwurf: arabischer Zielbegriff fehlt noch, Freigabe durch die Sifa offen.',
      match: ['quetsch'],
      t: {
        en: { term: 'crushing hazard', match: ['crush'] },
        pl: { term: 'niebezpieczeństwo zgniecenia', match: ['zgniec', 'zmiażdż'] },
        ro: { term: 'pericol de strivire', match: ['strivir'] },
        tr: { term: 'ezilme tehlikesi', match: ['ezilme', 'sıkışma'] },
        uk: { term: 'небезпека затискання', match: ['затиск', 'защемл', 'розчавл'] },
        bg: { term: 'опасност от притискане', match: ['притискан', 'смачкван'] },
        ru: { term: 'опасность защемления', match: ['защемлен', 'раздавлив', 'зажат'] }
      } }
  ];

  // Vorab geprüfte Kernsätze: fachlich freigegeben, nie live übersetzt
  var KERNSAETZE = [
    { id: 'k-brille', cat: 'PSA', pictos: ['brille'], quiz: null,
      de: 'Schutzbrille in der ganzen Halle tragen.',
      t: {
        en: 'Wear safety glasses throughout the entire hall.',
        pl: 'W całej hali noś okulary ochronne.',
        ro: 'Purtați ochelari de protecție în toată hala.',
        tr: 'Tüm üretim holünde koruyucu gözlük takın.',
        ar: 'ارتدِ النظارات الواقية في جميع أنحاء صالة الإنتاج.',
        uk: 'Носіть захисні окуляри в усьому цеху.',
        bg: 'Носете предпазни очила в цялото хале.',
        ru: 'Носите защитные очки во всём цехе.'
      } },
    { id: 'k-gehoer', cat: 'PSA', pictos: ['gehoer'], quiz: null,
      de: 'Gehörschutz tragen: Der Lärm liegt über 85 dB(A).',
      t: {
        en: 'Wear hearing protection: the noise level is above 85 dB(A).',
        pl: 'Noś ochronniki słuchu: hałas przekracza 85 dB(A).',
        ro: 'Purtați antifoane: zgomotul depășește 85 dB(A).',
        tr: 'Kulak koruyucu takın: Gürültü 85 dB(A) üzerinde.',
        ar: 'ارتدِ واقي السمع: مستوى الضوضاء أعلى من 85 ديسيبل.',
        uk: 'Використовуйте засоби захисту органів слуху: шум перевищує 85 дБ(А).',
        bg: 'Носете антифони: шумът е над 85 dB(A).',
        ru: 'Носите средства защиты слуха: шум превышает 85 дБ(А).'
      } },
    { id: 'k-wege', cat: 'Verkehr', pictos: ['stapler'], quiz: null,
      de: 'Achtung Staplerverkehr: Nur die markierten Fußwege benutzen.',
      t: {
        en: 'Caution, forklift traffic: use only the marked walkways.',
        pl: 'Uwaga, ruch wózków widłowych: korzystaj tylko z oznakowanych ciągów pieszych.',
        ro: 'Atenție, trafic de stivuitoare: folosiți numai căile pietonale marcate.',
        tr: 'Dikkat, forklift trafiği: Yalnızca işaretli yaya yollarını kullanın.',
        ar: 'انتبه، حركة الرافعات الشوكية: استخدم فقط ممرات المشاة المحددة.',
        uk: 'Увага, рух навантажувачів: користуйтеся лише позначеними пішохідними доріжками.',
        bg: 'Внимание, движение на мотокари: използвайте само обозначените пешеходни пътеки.',
        ru: 'Внимание, движение погрузчиков: пользуйтесь только обозначенными пешеходными дорожками.'
      } },
    { id: 'k-stapler', cat: 'Verkehr', pictos: ['stapler'], quiz: 'q-stapler',
      de: 'Wenn sich ein Stapler nähert: stehen bleiben und Blickkontakt mit dem Fahrer suchen.',
      t: {
        en: 'If a forklift approaches: stop and make eye contact with the driver.',
        pl: 'Gdy zbliża się wózek widłowy: zatrzymaj się i nawiąż kontakt wzrokowy z kierowcą.',
        ro: 'Când se apropie un stivuitor: opriți-vă și căutați contactul vizual cu șoferul.',
        tr: 'Bir forklift yaklaştığında: Durun ve sürücüyle göz teması kurun.',
        ar: 'عندما تقترب رافعة شوكية: توقف وتواصل بصرياً مع السائق.',
        uk: 'Коли наближається навантажувач: зупиніться та встановіть зоровий контакт із водієм.',
        bg: 'Когато наближава мотокар: спрете и потърсете зрителен контакт с водача.',
        ru: 'Если приближается погрузчик: остановитесь и установите зрительный контакт с водителем.'
      } },
    { id: 'k-stoerung', cat: 'Maschinen', pictos: ['achtung'], quiz: 'q-stoerung',
      de: 'Bei einer Störung an der Anlage gilt: anhalten – rufen – warten.',
      t: {
        en: 'If the machine malfunctions: stop – call – wait.',
        pl: 'W razie awarii instalacji obowiązuje zasada: zatrzymaj – zawołaj – czekaj.',
        ro: 'La o defecțiune a instalației: opriți – chemați – așteptați.',
        tr: 'Tesiste arıza olduğunda: Dur – seslen – bekle.',
        ar: 'عند حدوث عطل في المنشأة: توقف – نادِ – انتظر.',
        uk: 'У разі несправності установки: зупинись – поклич – чекай.',
        bg: 'При повреда на съоръжението: спри – извикай – изчакай.',
        ru: 'При неисправности установки: остановись – позови – жди.'
      } },
    { id: 'k-nothalt', cat: 'Maschinen', pictos: ['nothalt'], quiz: null,
      de: 'Vor dem Eingreifen in die Linie den Not-Halt drücken.',
      t: {
        en: 'Press the emergency stop before reaching into the line.',
        pl: 'Przed sięgnięciem do linii naciśnij wyłącznik awaryjny.',
        ro: 'Înainte de a interveni în linie, apăsați butonul de oprire de urgență.',
        tr: 'Hatta müdahale etmeden önce acil durdurma butonuna basın.',
        ar: 'اضغط زر إيقاف الطوارئ قبل التدخل في خط الإنتاج.',
        uk: 'Перш ніж втручатися в роботу лінії, натисніть кнопку аварійної зупинки.',
        bg: 'Преди да бъркате в линията, натиснете аварийния бутон за спиране.',
        ru: 'Перед вмешательством в работу линии нажмите кнопку аварийной остановки.'
      } },
    { id: 'k-loto', cat: 'Elektro / HV', pictos: ['spannung', 'loto'], quiz: 'q-loto',
      de: 'Vor Wartungsarbeiten die Anlage freischalten und gegen Wiedereinschalten sichern.',
      t: {
        en: 'Before maintenance work, isolate the machine and secure it against being switched on again.',
        pl: 'Przed pracami konserwacyjnymi odłącz instalację od zasilania i zabezpiecz ją przed ponownym włączeniem.',
        ro: 'Înainte de lucrările de întreținere, deconectați instalația de la alimentare și asigurați-o împotriva repornirii.',
        tr: 'Bakım çalışmalarından önce tesisin enerjisini kesin ve yeniden çalıştırılmaya karşı emniyete alın.',
        ar: 'قبل أعمال الصيانة افصل التيار الكهربائي عن المنشأة وأمّنها ضد إعادة التشغيل.',
        uk: 'Перед технічним обслуговуванням знеструмте установку та захистіть її від повторного ввімкнення.',
        bg: 'Преди работи по поддръжката изключете съоръжението от захранването и го обезопасете срещу повторно включване.',
        ru: 'Перед техническим обслуживанием обесточьте установку и защитите её от повторного включения.'
      } },
    { id: 'k-hv', cat: 'Elektro / HV', pictos: ['spannung'], quiz: null,
      de: 'Arbeiten an Hochvolt-Komponenten nur mit Qualifikation und schriftlicher Freigabe.',
      t: {
        en: 'Work on high-voltage components only with the required qualification and written authorisation.',
        pl: 'Prace przy komponentach wysokiego napięcia tylko z kwalifikacjami i pisemnym zezwoleniem.',
        ro: 'Lucrările la componente de înaltă tensiune numai cu calificare și aprobare scrisă.',
        tr: 'Yüksek gerilim bileşenlerinde yalnızca yeterlilik ve yazılı onay ile çalışın.',
        ar: 'العمل على مكونات الجهد العالي فقط مع التأهيل اللازم والتصريح الكتابي.',
        uk: 'Роботи з компонентами під високою напругою – лише за наявності кваліфікації та письмового дозволу.',
        bg: 'Работа по компоненти с високо напрежение само с квалификация и писмено разрешение.',
        ru: 'Работы с компонентами под высоким напряжением – только при наличии квалификации и письменного допуска.'
      } },
    { id: 'k-zutritt', cat: 'Zutritt', pictos: ['zutritt'], quiz: null,
      de: 'Den abgesperrten Bereich nicht betreten.',
      t: {
        en: 'Do not enter the cordoned-off area.',
        pl: 'Nie wchodź do odgrodzonego obszaru.',
        ro: 'Nu intrați în zona îngrădită.',
        tr: 'Bariyerle ayrılmış alana girmeyin.',
        ar: 'لا تدخل المنطقة المطوّقة بالحاجز.',
        uk: 'Не заходьте на огороджену ділянку.',
        bg: 'Не влизайте в заградената зона.',
        ru: 'Не заходите в огороженную зону.'
      } },
    { id: 'k-feuer', cat: 'Notfall', emergency: true, pictos: ['sammelstelle'], quiz: 'q-feuer',
      de: 'Bei Feueralarm: Arbeit sofort beenden und zur Sammelstelle gehen.',
      t: {
        en: 'In the event of a fire alarm: stop work immediately and go to the assembly point.',
        pl: 'W razie alarmu pożarowego: natychmiast przerwij pracę i udaj się do miejsca zbiórki.',
        ro: 'La alarmă de incendiu: opriți imediat lucrul și mergeți la punctul de adunare.',
        tr: 'Yangın alarmında: İşi hemen bırakın ve toplanma alanına gidin.',
        ar: 'عند إنذار الحريق: أوقف العمل فوراً واذهب إلى نقطة التجمع.',
        uk: 'У разі пожежної тривоги: негайно припиніть роботу та йдіть до місця збору.',
        bg: 'При пожарна тревога: незабавно прекратете работа и отидете на мястото за събиране.',
        ru: 'При пожарной тревоге: немедленно прекратите работу и идите к месту сбора.'
      } },
    { id: 'k-unfall', cat: 'Notfall', emergency: true, pictos: ['erstehilfe'], quiz: null,
      de: 'Jeden Unfall und jede Verletzung sofort der Führungskraft melden – auch kleine.',
      t: {
        en: 'Report every accident and every injury to your supervisor immediately – even minor ones.',
        pl: 'Każdy wypadek i każdy uraz natychmiast zgłoś przełożonemu – także drobne.',
        ro: 'Raportați imediat șefului direct orice accident și orice rănire – chiar și pe cele mici.',
        tr: 'Her kazayı ve her yaralanmayı hemen amirinize bildirin – küçük olanları da.',
        ar: 'أبلغ مسؤولك فوراً عن كل حادث وكل إصابة – حتى البسيطة منها.',
        uk: 'Про кожен нещасний випадок і кожну травму негайно повідомляйте керівника – навіть про незначні.',
        bg: 'Докладвайте незабавно на ръководителя всяка злополука и всяко нараняване – дори дребните.',
        ru: 'О каждом несчастном случае и каждой травме сразу сообщайте руководителю – даже о мелких.'
      } },
    { id: 'k-heiss', cat: 'Fremdfirmen', pictos: ['feuer', 'erlaubnis'], quiz: null,
      de: 'Schweiß-, Schneid- und Schleifarbeiten nur mit gültigem Erlaubnisschein.',
      t: {
        en: 'Welding, cutting and grinding work only with a valid permit to work.',
        pl: 'Prace spawalnicze, cięcie i szlifowanie tylko z ważnym pozwoleniem na pracę.',
        ro: 'Lucrările de sudare, tăiere și polizare numai cu permis de lucru valabil.',
        tr: 'Kaynak, kesme ve taşlama işleri yalnızca geçerli çalışma izniyle yapılır.',
        ar: 'أعمال اللحام والقطع والجلخ فقط بتصريح عمل ساري المفعول.',
        uk: 'Зварювальні роботи, різання та шліфування – лише з чинним нарядом-допуском.',
        bg: 'Заваряване, рязане и шлайфане само с валидно разрешение за работа.',
        ru: 'Сварочные работы, резка и шлифовка – только при наличии действующего наряда-допуска.'
      } }
  ];

  // Demo der Sicherheitsprüfung: simulierte Live-Engine mit typischen Fehlern
  var SCENARIOS = [
    { id: 's-sinn', label: 'Sinnverkehrung', hint: 'Polnisch: „freischalten“ wird zu „einschalten“',
      de: 'Vor Wartungsarbeiten die Anlage freischalten.',
      r: {
        en: ['Isolate the machine from the power supply before maintenance work.', 'Trennen Sie die Anlage vor Wartungsarbeiten von der Stromversorgung.'],
        pl: ['Przed pracami konserwacyjnymi włącz instalację.', 'Vor Wartungsarbeiten die Anlage einschalten.'],
        ro: ['Înainte de lucrările de întreținere, deconectați instalația de la alimentare.', 'Vor Wartungsarbeiten die Anlage von der Stromversorgung trennen.'],
        tr: ['Bakım çalışmalarından önce tesisin enerjisini kesin.', 'Vor Wartungsarbeiten die Energie der Anlage abschalten.'],
        ar: ['قبل أعمال الصيانة افصل التيار الكهربائي عن المنشأة.', 'Vor Wartungsarbeiten den Strom von der Anlage trennen.'],
        uk: ['Перед технічним обслуговуванням знеструмте установку.', 'Vor der Wartung die Anlage stromlos machen.'],
        bg: ['Преди работи по поддръжката изключете съоръжението от захранването.', 'Vor Wartungsarbeiten die Anlage von der Stromversorgung trennen.'],
        ru: ['Перед техническим обслуживанием обесточьте установку.', 'Vor der Wartung die Anlage stromlos schalten.']
      } },
    { id: 's-neg', label: 'Verbot geht verloren', hint: 'Türkisch: „nicht betreten“ wird zu „betreten“',
      de: 'Den Bereich hinter der Absperrung nicht betreten.',
      r: {
        en: ['Do not enter the area behind the barrier.', 'Betreten Sie den Bereich hinter der Absperrung nicht.'],
        pl: ['Nie wchodź na teren za barierą.', 'Betreten Sie das Gelände hinter der Absperrung nicht.'],
        ro: ['Nu intrați în zona din spatele barierei.', 'Betreten Sie nicht den Bereich hinter der Absperrung.'],
        tr: ['Bariyerin arkasındaki alana girin.', 'Betreten Sie den Bereich hinter der Absperrung.'],
        ar: ['لا تدخل المنطقة خلف الحاجز.', 'Betreten Sie nicht den Bereich hinter der Absperrung.'],
        uk: ['Не заходьте на ділянку за огородженням.', 'Betreten Sie den Bereich hinter der Absperrung nicht.'],
        bg: ['Не влизайте в зоната зад заграждението.', 'Betreten Sie die Zone hinter der Absperrung nicht.'],
        ru: ['Не заходите в зону за ограждением.', 'Betreten Sie die Zone hinter der Absperrung nicht.']
      } },
    { id: 's-zahl', label: 'Zahl falsch', hint: 'Rumänisch: 6 km/h wird zu 60 km/h',
      de: 'Im Werk gilt Schrittgeschwindigkeit: höchstens 6 km/h.',
      r: {
        en: ['Walking speed applies on site: no more than 6 km/h.', 'Im Werk gilt Schrittgeschwindigkeit: nicht mehr als 6 km/h.'],
        pl: ['Na terenie zakładu obowiązuje prędkość pieszego: maksymalnie 6 km/h.', 'Auf dem Werksgelände gilt Schrittgeschwindigkeit: maximal 6 km/h.'],
        ro: ['În uzină se circulă cu viteza pasului: maximum 60 km/h.', 'Im Werk fährt man mit Schrittgeschwindigkeit: maximal 60 km/h.'],
        tr: ['Fabrikada yürüme hızı geçerlidir: en fazla 6 km/sa.', 'Im Werk gilt Schrittgeschwindigkeit: höchstens 6 km/h.'],
        ar: ['في المصنع تُطبق سرعة المشي: 6 كم/ساعة كحد أقصى.', 'Im Werk gilt Schrittgeschwindigkeit: maximal 6 km/h.'],
        uk: ['На заводі діє швидкість пішохода: не більше 6 км/год.', 'Im Werk gilt Schrittgeschwindigkeit: nicht mehr als 6 km/h.'],
        bg: ['В завода се движи с пешеходна скорост: най-много 6 км/ч.', 'Im Werk gilt Schrittgeschwindigkeit: höchstens 6 km/h.'],
        ru: ['На заводе действует скорость пешехода: не более 6 км/ч.', 'Im Werk gilt Schrittgeschwindigkeit: höchstens 6 km/h.']
      } },
    { id: 's-glossar', label: 'Fachbegriff falsch', hint: 'Arabisch: „Gabelstapler“ als „Bodenfahrzeug“',
      de: 'Achtung: Der Gabelstapler fährt rückwärts aus der Halle.',
      r: {
        en: ['Caution: the forklift is reversing out of the hall.', 'Achtung: Der Gabelstapler fährt rückwärts aus der Halle.'],
        pl: ['Uwaga: wózek widłowy wyjeżdża tyłem z hali.', 'Achtung: Der Gabelstapler fährt rückwärts aus der Halle.'],
        ro: ['Atenție: stivuitorul iese cu spatele din hală.', 'Achtung: Der Stapler fährt rückwärts aus der Halle.'],
        tr: ['Dikkat: Forklift geri geri holden çıkıyor.', 'Achtung: Der Gabelstapler fährt rückwärts aus der Halle.'],
        ar: ['انتبه: المركبة الأرضية تخرج من الصالة إلى الخلف.', 'Achtung: Das Bodenfahrzeug fährt rückwärts aus der Halle.'],
        uk: ['Увага: навантажувач виїжджає заднім ходом із цеху.', 'Achtung: Der Stapler fährt rückwärts aus der Werkhalle.'],
        bg: ['Внимание: мотокарът излиза на заден ход от халето.', 'Achtung: Der Stapler fährt im Rückwärtsgang aus der Halle.'],
        ru: ['Внимание: погрузчик выезжает задним ходом из цеха.', 'Achtung: Der Gabelstapler fährt rückwärts aus der Halle.']
      } }
  ];

  // Verständnisfragen (Antworten anonym, nur aggregiert ausgewertet)
  var QUIZ = [
    { id: 'q-stapler', kernsatz: 'k-stapler', correct: 1,
      q: { de: 'Ein Stapler kommt auf Sie zu. Was tun Sie?', pl: 'Zbliża się do Ciebie wózek widłowy. Co robisz?', ro: 'Un stivuitor vine spre dumneavoastră. Ce faceți?', tr: 'Bir forklift size doğru geliyor. Ne yaparsınız?', ar: 'رافعة شوكية تقترب منك. ماذا تفعل؟', uk: 'До вас наближається навантажувач. Що ви робите?', bg: 'Мотокар идва към вас. Какво правите?', ru: 'К вам приближается погрузчик. Что вы делаете?', en: 'A forklift is coming towards you. What do you do?' },
      a: [
        { de: 'Weitergehen', pl: 'Idę dalej', ro: 'Merg mai departe', tr: 'Yürümeye devam ederim', ar: 'أواصل السير', uk: 'Іду далі', bg: 'Продължавам да вървя', ru: 'Иду дальше', en: 'Keep walking' },
        { de: 'Stehen bleiben, Blickkontakt suchen', pl: 'Zatrzymuję się i nawiązuję kontakt wzrokowy', ro: 'Mă opresc și caut contactul vizual', tr: 'Durur, göz teması kurarım', ar: 'أتوقف وأتواصل بصرياً', uk: 'Зупиняюся, шукаю зоровий контакт', bg: 'Спирам и търся зрителен контакт', ru: 'Останавливаюсь, ищу зрительный контакт', en: 'Stop and make eye contact' },
        { de: 'Schnell vor dem Stapler vorbeilaufen', pl: 'Szybko przebiegam przed wózkiem', ro: 'Trec repede prin fața stivuitorului', tr: 'Forkliftin önünden hızla geçerim', ar: 'أمرّ بسرعة أمام الرافعة', uk: 'Швидко пробігаю перед навантажувачем', bg: 'Минавам бързо пред мотокара', ru: 'Быстро пробегаю перед погрузчиком', en: 'Run past in front of the forklift' }
      ] },
    { id: 'q-stoerung', kernsatz: 'k-stoerung', correct: 1,
      q: { de: 'Die Anlage hat eine Störung. Was ist richtig?', pl: 'Instalacja ma awarię. Co jest prawidłowe?', ro: 'Instalația are o defecțiune. Ce este corect?', tr: 'Tesiste arıza var. Doğru olan hangisi?', ar: 'حدث عطل في المنشأة. ما هو التصرف الصحيح؟', uk: 'В установці несправність. Що правильно?', bg: 'Съоръжението има повреда. Кое е правилно?', ru: 'В установке неисправность. Что правильно?', en: 'The machine has a malfunction. What is correct?' },
      a: [
        { de: 'Selbst hineingreifen und reparieren', pl: 'Sam sięgam do środka i naprawiam', ro: 'Intervin singur și repar', tr: 'Kendim müdahale edip onarırım', ar: 'أتدخل بنفسي وأصلح العطل', uk: 'Сам втручаюся і ремонтую', bg: 'Сам бъркам и поправям', ru: 'Сам вмешиваюсь и ремонтирую', en: 'Reach in and repair it myself' },
        { de: 'Anhalten – rufen – warten', pl: 'Zatrzymaj – zawołaj – czekaj', ro: 'Opriți – chemați – așteptați', tr: 'Dur – seslen – bekle', ar: 'توقف – نادِ – انتظر', uk: 'Зупинись – поклич – чекай', bg: 'Спри – извикай – изчакай', ru: 'Остановись – позови – жди', en: 'Stop – call – wait' },
        { de: 'Weiterarbeiten', pl: 'Pracuję dalej', ro: 'Continui lucrul', tr: 'Çalışmaya devam ederim', ar: 'أواصل العمل', uk: 'Працюю далі', bg: 'Продължавам работа', ru: 'Продолжаю работать', en: 'Keep working' }
      ] },
    { id: 'q-feuer', kernsatz: 'k-feuer', correct: 0,
      q: { de: 'Feueralarm. Wohin gehen Sie?', pl: 'Alarm pożarowy. Dokąd idziesz?', ro: 'Alarmă de incendiu. Unde mergeți?', tr: 'Yangın alarmı. Nereye gidersiniz?', ar: 'إنذار حريق. إلى أين تذهب؟', uk: 'Пожежна тривога. Куди ви йдете?', bg: 'Пожарна тревога. Къде отивате?', ru: 'Пожарная тревога. Куда вы идёте?', en: 'Fire alarm. Where do you go?' },
      a: [
        { de: 'Zur Sammelstelle', pl: 'Do miejsca zbiórki', ro: 'La punctul de adunare', tr: 'Toplanma alanına', ar: 'إلى نقطة التجمع', uk: 'До місця збору', bg: 'На мястото за събиране', ru: 'К месту сбора', en: 'To the assembly point' },
        { de: 'In die Kantine', pl: 'Do stołówki', ro: 'La cantină', tr: 'Yemekhaneye', ar: 'إلى المقصف', uk: 'До їдальні', bg: 'В столовата', ru: 'В столовую', en: 'To the canteen' },
        { de: 'Zum Spind, Sachen holen', pl: 'Do szafki po rzeczy', ro: 'La vestiar, după lucruri', tr: 'Dolabıma, eşyalarımı almaya', ar: 'إلى الخزانة لأخذ أغراضي', uk: 'До шафки по речі', bg: 'До шкафчето за нещата си', ru: 'К шкафчику за вещами', en: 'To my locker to get my things' }
      ] },
    { id: 'q-loto', kernsatz: 'k-loto', correct: 0,
      q: { de: 'Was kommt vor jeder Wartung?', pl: 'Co robisz przed każdą konserwacją?', ro: 'Ce faceți înainte de orice întreținere?', tr: 'Her bakımdan önce ne yapılır?', ar: 'ماذا تفعل قبل كل صيانة؟', uk: 'Що робити перед кожним обслуговуванням?', bg: 'Какво правите преди всяка поддръжка?', ru: 'Что делать перед каждым обслуживанием?', en: 'What comes before any maintenance?' },
      a: [
        { de: 'Freischalten und gegen Wiedereinschalten sichern', pl: 'Odłączyć od zasilania i zabezpieczyć przed ponownym włączeniem', ro: 'Deconectare de la alimentare și asigurare împotriva repornirii', tr: 'Enerjiyi kesip yeniden çalıştırmaya karşı emniyete almak', ar: 'فصل التيار والتأمين ضد إعادة التشغيل', uk: 'Знеструмити і захистити від повторного ввімкнення', bg: 'Изключване от захранването и обезопасяване срещу повторно включване', ru: 'Обесточить и защитить от повторного включения', en: 'Isolate and secure against switching on again' },
        { de: 'Anlage weiterlaufen lassen', pl: 'Pozostawić instalację w ruchu', ro: 'Lăsați instalația să funcționeze', tr: 'Tesisi çalışır durumda bırakmak', ar: 'ترك المنشأة تعمل', uk: 'Залишити установку працювати', bg: 'Оставям съоръжението да работи', ru: 'Оставить установку работать', en: 'Leave the machine running' },
        { de: 'Schutzbrille abnehmen', pl: 'Zdjąć okulary ochronne', ro: 'Scoateți ochelarii de protecție', tr: 'Koruyucu gözlüğü çıkarmak', ar: 'خلع النظارات الواقية', uk: 'Зняти захисні окуляри', bg: 'Свалям предпазните очила', ru: 'Снять защитные очки', en: 'Take off safety glasses' }
      ] }
  ];

  // Rückmeldungen der Beschäftigten (vorübersetzt, damit die Führungskraft sie sofort versteht)
  var QUICK_REPLIES = [
    { id: 'wdh', t: { de: 'Bitte wiederholen.', pl: 'Proszę powtórzyć.', ro: 'Vă rog să repetați.', tr: 'Lütfen tekrar edin.', ar: 'يرجى الإعادة.', uk: 'Повторіть, будь ласка.', bg: 'Моля, повторете.', ru: 'Повторите, пожалуйста.', en: 'Please repeat.' } },
    { id: 'langsam', t: { de: 'Bitte langsamer sprechen.', pl: 'Proszę mówić wolniej.', ro: 'Vă rog să vorbiți mai rar.', tr: 'Lütfen daha yavaş konuşun.', ar: 'يرجى التحدث ببطء أكثر.', uk: 'Говоріть повільніше, будь ласка.', bg: 'Моля, говорете по-бавно.', ru: 'Говорите медленнее, пожалуйста.', en: 'Please speak more slowly.' } },
    { id: 'psa', t: { de: 'Welche Schutzausrüstung brauche ich?', pl: 'Jakich środków ochrony potrzebuję?', ro: 'Ce echipament de protecție îmi trebuie?', tr: 'Hangi koruyucu ekipmana ihtiyacım var?', ar: 'ما معدات الحماية التي أحتاجها؟', uk: 'Яке захисне спорядження мені потрібне?', bg: 'Какви предпазни средства ми трябват?', ru: 'Какие средства защиты мне нужны?', en: 'What protective equipment do I need?' } },
    { id: 'zeigen', t: { de: 'Bitte zeigen Sie es mir vor Ort.', pl: 'Proszę mi to pokazać na miejscu.', ro: 'Vă rog să-mi arătați la fața locului.', tr: 'Lütfen bana yerinde gösterin.', ar: 'يرجى أن تريني ذلك في المكان.', uk: 'Покажіть мені це на місці, будь ласка.', bg: 'Моля, покажете ми на място.', ru: 'Покажите мне это на месте, пожалуйста.', en: 'Please show me on site.' } }
  ];

  // Fremdfirmen-Einweisung an der Pforte (per QR-Code, ohne Firmenkonto)
  var FREMDFIRMEN = {
    rules: [
      { id: 'f-anmeldung', picto: 'erlaubnis',
        title: { de: 'Anmelden', pl: 'Zgłoszenie', ro: 'Înregistrare', tr: 'Kayıt', ar: 'التسجيل', uk: 'Реєстрація', bg: 'Регистрация', ru: 'Регистрация', en: 'Sign in' },
        text: { de: 'Vor Arbeitsbeginn beim Koordinator melden. Erst nach der Einweisung mit der Arbeit beginnen.', pl: 'Przed rozpoczęciem pracy zgłoś się do koordynatora. Pracę zaczynaj dopiero po instruktażu.', ro: 'Înainte de începerea lucrului, prezentați-vă la coordonator. Începeți lucrul doar după instruire.', tr: 'İşe başlamadan önce koordinatöre bildirin. İşe ancak eğitimden sonra başlayın.', ar: 'قبل بدء العمل سجّل لدى المنسق. ابدأ العمل فقط بعد التوجيه.', uk: 'Перед початком роботи зареєструйтеся в координатора. Починайте роботу лише після інструктажу.', bg: 'Преди започване на работа се явете при координатора. Започвайте работа само след инструктажа.', ru: 'Перед началом работы обратитесь к координатору. Начинайте работу только после инструктажа.', en: 'Report to the coordinator before starting work. Only start work after the induction.' } },
      { id: 'f-psa', picto: 'weste',
        title: { de: 'Schutzausrüstung', pl: 'Środki ochrony', ro: 'Echipament de protecție', tr: 'Koruyucu ekipman', ar: 'معدات الحماية', uk: 'Захисне спорядження', bg: 'Предпазни средства', ru: 'Средства защиты', en: 'Protective equipment' },
        text: { de: 'Auf dem ganzen Gelände Sicherheitsschuhe und Warnweste tragen. In den Hallen zusätzlich Schutzbrille.', pl: 'Na całym terenie noś obuwie ochronne i kamizelkę odblaskową. W halach dodatkowo okulary ochronne.', ro: 'Pe tot terenul purtați încălțăminte de protecție și vestă reflectorizantă. În hale, în plus, ochelari de protecție.', tr: 'Tüm alanda iş ayakkabısı ve reflektörlü yelek giyin. Hollerde ayrıca koruyucu gözlük takın.', ar: 'ارتدِ أحذية السلامة والسترة العاكسة في كامل الموقع. وفي الصالات ارتدِ أيضاً النظارات الواقية.', uk: 'На всій території носіть захисне взуття та сигнальний жилет. У цехах – додатково захисні окуляри.', bg: 'На цялата територия носете предпазни обувки и светлоотразителна жилетка. В халетата – и предпазни очила.', ru: 'На всей территории носите защитную обувь и сигнальный жилет. В цехах – дополнительно защитные очки.', en: 'Wear safety shoes and a high-visibility vest everywhere on site. In the halls, also wear safety glasses.' } },
      { id: 'f-verkehr', picto: 'stapler',
        title: { de: 'Verkehr', pl: 'Ruch', ro: 'Trafic', tr: 'Trafik', ar: 'حركة المرور', uk: 'Рух', bg: 'Движение', ru: 'Движение', en: 'Traffic' },
        text: { de: 'Nur markierte Fußwege benutzen. Stapler haben Vorrang. Mit Fahrzeugen höchstens 6 km/h.', pl: 'Korzystaj tylko z oznakowanych ciągów pieszych. Wózki widłowe mają pierwszeństwo. Pojazdami maksymalnie 6 km/h.', ro: 'Folosiți numai căile pietonale marcate. Stivuitoarele au prioritate. Cu vehicule maximum 6 km/h.', tr: 'Yalnızca işaretli yaya yollarını kullanın. Forkliftlerin önceliği vardır. Araçlarla en fazla 6 km/sa.', ar: 'استخدم فقط ممرات المشاة المحددة. للرافعات الشوكية حق الأولوية. السرعة القصوى للمركبات 6 كم/ساعة.', uk: 'Користуйтеся лише позначеними пішохідними доріжками. Навантажувачі мають перевагу. Транспортом – не більше 6 км/год.', bg: 'Използвайте само обозначените пешеходни пътеки. Мотокарите имат предимство. С превозни средства най-много 6 км/ч.', ru: 'Пользуйтесь только обозначенными пешеходными дорожками. Погрузчики имеют преимущество. На транспорте – не более 6 км/ч.', en: 'Use only marked walkways. Forklifts have right of way. Vehicles at no more than 6 km/h.' } },
      { id: 'f-erlaubnis', picto: 'feuer',
        title: { de: 'Erlaubnisschein', pl: 'Pozwolenie na pracę', ro: 'Permis de lucru', tr: 'Çalışma izni', ar: 'تصريح العمل', uk: 'Наряд-допуск', bg: 'Разрешение за работа', ru: 'Наряд-допуск', en: 'Permit to work' },
        text: { de: 'Schweißen, Schneiden, Schleifen, Arbeiten in Behältern und an elektrischen Anlagen nur mit gültigem Erlaubnisschein.', pl: 'Spawanie, cięcie, szlifowanie, prace w zbiornikach i przy instalacjach elektrycznych tylko z ważnym pozwoleniem na pracę.', ro: 'Sudare, tăiere, polizare, lucrări în recipiente și la instalații electrice numai cu permis de lucru valabil.', tr: 'Kaynak, kesme, taşlama, tank içinde ve elektrik tesisatında çalışma yalnızca geçerli çalışma izniyle.', ar: 'اللحام والقطع والجلخ والعمل داخل الخزانات وعلى المنشآت الكهربائية فقط بتصريح عمل ساري المفعول.', uk: 'Зварювання, різання, шліфування, роботи в ємностях і на електроустановках – лише з чинним нарядом-допуском.', bg: 'Заваряване, рязане, шлайфане, работа в съдове и по електрически инсталации само с валидно разрешение за работа.', ru: 'Сварка, резка, шлифовка, работы в ёмкостях и на электроустановках – только с действующим нарядом-допуском.', en: 'Welding, cutting, grinding, work inside vessels and on electrical systems only with a valid permit to work.' } },
      { id: 'f-notfall', picto: 'sammelstelle',
        title: { de: 'Notfall', pl: 'Sytuacja awaryjna', ro: 'Urgență', tr: 'Acil durum', ar: 'حالة الطوارئ', uk: 'Надзвичайна ситуація', bg: 'Спешен случай', ru: 'Чрезвычайная ситуация', en: 'Emergency' },
        text: { de: 'Bei Alarm Arbeit beenden und zur Sammelstelle gehen. Werknotruf: 2222.', pl: 'Przy alarmie przerwij pracę i idź do miejsca zbiórki. Telefon alarmowy zakładu: 2222.', ro: 'La alarmă opriți lucrul și mergeți la punctul de adunare. Numărul de urgență al uzinei: 2222.', tr: 'Alarm olduğunda işi bırakın ve toplanma alanına gidin. Fabrika acil hattı: 2222.', ar: 'عند الإنذار أوقف العمل واذهب إلى نقطة التجمع. رقم طوارئ المصنع: 2222.', uk: 'Під час тривоги припиніть роботу і йдіть до місця збору. Аварійний номер заводу: 2222.', bg: 'При тревога прекратете работа и отидете на мястото за събиране. Авариен телефон на завода: 2222.', ru: 'При тревоге прекратите работу и идите к месту сбора. Аварийный номер завода: 2222.', en: 'In case of alarm, stop work and go to the assembly point. Site emergency number: 2222.' } },
      { id: 'f-melden', picto: 'foto',
        title: { de: 'Melden und Fotoverbot', pl: 'Zgłaszanie i zakaz fotografowania', ro: 'Raportare și interdicție foto', tr: 'Bildirim ve fotoğraf yasağı', ar: 'الإبلاغ وحظر التصوير', uk: 'Повідомлення і заборона фото', bg: 'Докладване и забрана за снимане', ru: 'Сообщения и запрет фотосъёмки', en: 'Reporting and no photos' },
        text: { de: 'Unfälle, Beinaheunfälle und Schäden sofort dem Koordinator melden. Fotografieren auf dem Gelände ist verboten.', pl: 'Wypadki, zdarzenia potencjalnie wypadkowe i szkody natychmiast zgłaszaj koordynatorowi. Fotografowanie na terenie zakładu jest zabronione.', ro: 'Raportați imediat coordonatorului accidentele, incidentele periculoase și pagubele. Fotografierea pe teren este interzisă.', tr: 'Kazaları, ramak kala olayları ve hasarları hemen koordinatöre bildirin. Alanda fotoğraf çekmek yasaktır.', ar: 'أبلغ المنسق فوراً عن الحوادث وشبه الحوادث والأضرار. التصوير داخل الموقع ممنوع.', uk: 'Про нещасні випадки, небезпечні ситуації та пошкодження негайно повідомляйте координатора. Фотографувати на території заборонено.', bg: 'Докладвайте незабавно на координатора злополуки, почти-инциденти и щети. Снимането на територията е забранено.', ru: 'О несчастных случаях, опасных ситуациях и повреждениях сразу сообщайте координатору. Фотосъёмка на территории запрещена.', en: 'Report accidents, near misses and damage to the coordinator immediately. Taking photos on site is prohibited.' } }
    ],
    quiz: [
      { id: 'fq-start', correct: 1,
        q: { de: 'Wann dürfen Sie mit der Arbeit beginnen?', pl: 'Kiedy możesz rozpocząć pracę?', ro: 'Când aveți voie să începeți lucrul?', tr: 'İşe ne zaman başlayabilirsiniz?', ar: 'متى يُسمح لك ببدء العمل؟', uk: 'Коли ви можете почати роботу?', bg: 'Кога можете да започнете работа?', ru: 'Когда вам можно начинать работу?', en: 'When may you start work?' },
        a: [
          { de: 'Sofort nach der Ankunft', pl: 'Zaraz po przyjeździe', ro: 'Imediat după sosire', tr: 'Varır varmaz', ar: 'فور الوصول', uk: 'Одразу після прибуття', bg: 'Веднага след пристигане', ru: 'Сразу после прибытия', en: 'Straight after arrival' },
          { de: 'Nach Einweisung und Anmeldung beim Koordinator', pl: 'Po instruktażu i zgłoszeniu u koordynatora', ro: 'După instruire și înregistrare la coordonator', tr: 'Eğitim ve koordinatöre kayıttan sonra', ar: 'بعد التوجيه والتسجيل لدى المنسق', uk: 'Після інструктажу та реєстрації в координатора', bg: 'След инструктаж и регистрация при координатора', ru: 'После инструктажа и регистрации у координатора', en: 'After the induction and signing in with the coordinator' },
          { de: 'Wenn das Material da ist', pl: 'Gdy dotrze materiał', ro: 'Când a sosit materialul', tr: 'Malzeme geldiğinde', ar: 'عندما تصل المواد', uk: 'Коли привезуть матеріал', bg: 'Когато материалът пристигне', ru: 'Когда привезут материал', en: 'When the material has arrived' }
        ] },
      { id: 'fq-schweissen', correct: 0,
        q: { de: 'Sie wollen schweißen. Was brauchen Sie?', pl: 'Chcesz spawać. Czego potrzebujesz?', ro: 'Vreți să sudați. De ce aveți nevoie?', tr: 'Kaynak yapmak istiyorsunuz. Neye ihtiyacınız var?', ar: 'تريد القيام بأعمال اللحام. ماذا تحتاج؟', uk: 'Ви хочете зварювати. Що вам потрібно?', bg: 'Искате да заварявате. Какво ви трябва?', ru: 'Вы хотите варить. Что вам нужно?', en: 'You want to weld. What do you need?' },
        a: [
          { de: 'Einen gültigen Erlaubnisschein', pl: 'Ważne pozwolenie na pracę', ro: 'Un permis de lucru valabil', tr: 'Geçerli bir çalışma izni', ar: 'تصريح عمل ساري المفعول', uk: 'Чинний наряд-допуск', bg: 'Валидно разрешение за работа', ru: 'Действующий наряд-допуск', en: 'A valid permit to work' },
          { de: 'Nur das Schweißgerät', pl: 'Tylko spawarkę', ro: 'Doar aparatul de sudură', tr: 'Sadece kaynak makinesi', ar: 'جهاز اللحام فقط', uk: 'Лише зварювальний апарат', bg: 'Само заваръчния апарат', ru: 'Только сварочный аппарат', en: 'Just the welding machine' },
          { de: 'Eine mündliche Zusage eines Kollegen', pl: 'Ustną zgodę kolegi', ro: 'Acordul verbal al unui coleg', tr: 'Bir iş arkadaşının sözlü onayı', ar: 'موافقة شفهية من زميل', uk: 'Усну згоду колеги', bg: 'Устно съгласие от колега', ru: 'Устное согласие коллеги', en: 'A colleague saying it is fine' }
        ] },
      { id: 'fq-alarm', correct: 0,
        q: { de: 'Es gibt Alarm. Was tun Sie?', pl: 'Jest alarm. Co robisz?', ro: 'Sună alarma. Ce faceți?', tr: 'Alarm çalıyor. Ne yaparsınız?', ar: 'هناك إنذار. ماذا تفعل؟', uk: 'Лунає тривога. Що ви робите?', bg: 'Има тревога. Какво правите?', ru: 'Звучит тревога. Что вы делаете?', en: 'The alarm sounds. What do you do?' },
        a: [
          { de: 'Arbeit beenden, zur Sammelstelle gehen', pl: 'Przerywam pracę i idę do miejsca zbiórki', ro: 'Opresc lucrul și merg la punctul de adunare', tr: 'İşi bırakır, toplanma alanına giderim', ar: 'أوقف العمل وأذهب إلى نقطة التجمع', uk: 'Припиняю роботу, йду до місця збору', bg: 'Спирам работа и отивам на мястото за събиране', ru: 'Прекращаю работу, иду к месту сбора', en: 'Stop work and go to the assembly point' },
          { de: 'Weiterarbeiten', pl: 'Pracuję dalej', ro: 'Continui lucrul', tr: 'Çalışmaya devam ederim', ar: 'أواصل العمل', uk: 'Працюю далі', bg: 'Продължавам работа', ru: 'Продолжаю работать', en: 'Keep working' },
          { de: 'Erst das Werkzeug aufräumen', pl: 'Najpierw sprzątam narzędzia', ro: 'Mai întâi strâng sculele', tr: 'Önce aletleri toplarım', ar: 'أرتب الأدوات أولاً', uk: 'Спочатку прибираю інструмент', bg: 'Първо прибирам инструментите', ru: 'Сначала убираю инструмент', en: 'Tidy up my tools first' }
        ] }
    ]
  };

  // Beispieldaten für Cockpit, Nachweise und Fremdfirmen (fiktiv)
  var DEMO = {
    contractors: [
      { id: 'c1', name: 'A. Nowak', firma: 'Elektro-Montage Ost (Beispiel)', lang: 'pl', bereich: 'Halle 3 · Elektroinstallation', koordinator: 'Instandhaltung Halle 3', since: '2026-09-14', until: '2027-09-14', permits: ['Arbeiten an elektrischen Anlagen'] },
      { id: 'c2', name: 'M. Popescu', firma: 'Gerüstbau Süd (Beispiel)', lang: 'ro', bereich: 'Halle 1 · Gerüst Dach', koordinator: 'Bauleitung Werk', since: '2025-10-20', until: '2026-10-20', permits: [] },
      { id: 'c3', name: 'E. Yılmaz', firma: 'Industriereinigung Nord (Beispiel)', lang: 'tr', bereich: 'Lackiererei · Reinigung', koordinator: 'Facility Management', since: '2026-03-02', until: '2027-03-02', permits: ['Arbeiten in Behältern'] },
      { id: 'c4', name: 'O. Kovalenko', firma: 'Logistik-Service West (Beispiel)', lang: 'uk', bereich: 'Wareneingang', koordinator: 'Logistik', since: '2025-08-11', until: '2026-08-11', permits: [] },
      { id: 'c5', name: 'K. Haddad', firma: 'Stahlbau Mitte (Beispiel)', lang: 'ar', bereich: 'Halle 3 · Stahlbau Bühne', koordinator: 'Bauleitung Werk', since: '2026-10-05', until: '2027-10-05', permits: ['Schweiß- und Schneidarbeiten'] },
      { id: 'c6', name: 'D. Ivanova', firma: 'Gebäudetechnik Ost (Beispiel)', lang: 'bg', bereich: 'Technikzentrale', koordinator: 'Facility Management', since: '2025-11-03', until: '2026-11-03', permits: [] }
    ],
    sessions: [
      { id: 'n-1005', type: 'briefing', date: '2026-10-05', start: '06:02', end: '06:11', topic: 'Schichtbriefing Halle 3 · Schicht A', leader: 'Schichtleitung Halle 3', langs: ['pl', 'ro', 'tr', 'ar'], released: 6, blocked: 1, confirmed: 1, participants: 14, quiz: { correct: 11, total: 13 } },
      { id: 'n-1006', type: 'briefing', date: '2026-10-06', start: '06:01', end: '06:09', topic: 'Schichtbriefing Halle 3 · Schicht A', leader: 'Schichtleitung Halle 3', langs: ['pl', 'ro', 'tr', 'ar'], released: 5, blocked: 0, confirmed: 2, participants: 13, quiz: { correct: 12, total: 13 } },
      { id: 'n-1007', type: 'fremdfirma', date: '2026-10-07', start: '07:30', end: '07:42', topic: 'Fremdfirmen-Einweisung · Stahlbau Bühne', leader: 'Bauleitung Werk', langs: ['ar', 'pl'], released: 6, blocked: 0, confirmed: 0, participants: 4, quiz: { correct: 11, total: 12 } },
      { id: 'n-1008', type: 'briefing', date: '2026-10-08', start: '06:03', end: '06:14', topic: 'Neue Verkehrsführung Halle 3', leader: 'Schichtleitung Halle 3', langs: ['pl', 'ro', 'tr', 'ar', 'uk'], released: 8, blocked: 2, confirmed: 1, participants: 16, quiz: { correct: 13, total: 15 } },
      { id: 'n-1009', type: 'briefing', date: '2026-10-09', start: '06:00', end: '06:08', topic: 'Schichtbriefing Halle 3 · Schicht A', leader: 'Schichtleitung Halle 3', langs: ['pl', 'ro', 'tr', 'ar', 'uk'], released: 5, blocked: 1, confirmed: 0, participants: 15, quiz: { correct: 14, total: 15 } }
    ],
    // Verteilung der simulierten Geräte im Briefing
    simDevices: { pl: 4, ro: 3, tr: 2, ar: 2, uk: 1 }
  };

  root.SB_DATA = {
    version: '2026-10-09',
    site: { werk: 'Musterwerk', halle: 'Halle 3', schicht: 'Schicht A', leader: 'Schichtleitung Halle 3' },
    languages: LANGS,
    ui: UI,
    glossary: GLOSSARY,
    kernsaetze: KERNSAETZE,
    scenarios: SCENARIOS,
    quiz: QUIZ,
    quickReplies: QUICK_REPLIES,
    fremdfirmen: FREMDFIRMEN,
    demo: DEMO
  };
  if (typeof module === 'object' && module.exports) module.exports = root.SB_DATA;
})(typeof globalThis !== 'undefined' ? globalThis : this);
