const phrases = [
 ['Темна','Тёмная','Dark'],['Стандартна','Стандартная','Standard'],['Авто','Авто','Auto'],['Вибрати тему','Выбрать тему','Choose theme'],['Виберіть вашу тему','Выберите вашу тему','Choose your theme'],['Виберіть бажану тему, щоб налаштувати інтерфейс','Выберите предпочтительную тему, чтобы настроить интерфейс','Choose your preferred interface theme'],['Темна тема для всіх розділів','Тёмная тема для всех разделов','Dark theme for every section'],['Світлий спорт, темне казино','Светлый спорт, тёмное казино','Light sports, dark casino'],['Відповідає налаштуванням вашого пристрою','Соответствует настройкам вашего устройства','Matches your device settings'],['Мій акаунт','Мой аккаунт','My account'],['Служба підтримки','Служба поддержки','Support'],['Бонуси','Бонусы','Bonuses'],
 ['Головне','Главное','Main'],['Події','События','Events'],['Час матчів','Время матчей','Match time'],
 ['Головна','Главная','Home'],['Спорт','Спорт','Sport'],['Мої ставки','Мои ставки','My bets'],['Казино','Казино','Casino'],['Профіль','Профиль','Profile'],['Меню','Меню','Menu'],
 ['Поповнити','Пополнить','Deposit'],['Поповнити рахунок','Пополнить счёт','Deposit funds'],['+ Поповнити рахунок','+ Пополнить счёт','+ Deposit funds'],['Вивести','Вывести','Withdraw'],['Баланс','Баланс','Balance'],
 ['Акції','Акции','Promotions'],['Персональні дані','Персональные данные','Personal details'],['Підтвердження акаунта','Подтверждение аккаунта','Account verification'],['Історія платежів','История платежей','Payment history'],
 ['Залишити відгук','Оставить отзыв','Leave feedback'],['Налаштування','Настройки','Settings'],['Допомога та інформація','Помощь и информация','Help and information'],['Вихід','Выход','Log out'],['Вийти','Выйти','Log out'],['Вийти з акаунта','Выйти из аккаунта','Log out of account'],
 ['Змінити мову','Изменить язык','Change language'],['Редагувати ставки','Редактировать ставки','Edit bets'],['Видалити','Удалить','Delete'],['Мова','Язык','Language'],['Безпека','Безопасность','Security'],['Налаштування сповіщень','Настройки уведомлений','Notification settings'],['Налаштування спорту','Настройки спорта','Sport settings'],['Зберегти','Сохранить','Save'],
 ['Магазин бонусів','Магазин бонусов','Bonus shop'],['Турніри','Турниры','Tournaments'],['Головне','Главное','Overview'],['Події','События','Events'],
 ['Нерозраховані','Нерассчитанные','Unsettled'],['Розраховані','Рассчитанные','Settled'],['Сума ставки','Сумма ставки','Stake'],['Можлива виплата','Возможная выплата','Potential payout'],['Виплата','Выплата','Payout'],
 ['Повторити','Повторить','Repeat'],['Поділитися','Поделиться','Share'],['Поділитися ставкою','Поделиться ставкой','Share bet'],['Показати суму ставки:','Показать сумму ставки:','Show stake:'],['Зберегти зображення','Сохранить изображение','Save image'],['зображення','изображение','image'],['ставкою','ставкой','bet'],
 ['Переможець','Победитель','Winner'],['Результат матчу','Результат матча','Match result'],['Тотал','Тотал','Total'],['Тотал карт','Тотал карт','Total maps'],['Фора','Фора','Handicap'],['Фора за картами','Фора по картам','Map handicap'],['Точний рахунок','Точный счёт','Correct score'],['Нічия','Ничья','Draw'],['Більше','Больше','Over'],['Менше','Меньше','Under'],['Парний / непарний','Чётный / нечётный','Even / odd'],['Парний','Чётный','Even'],['Непарний','Нечётный','Odd'],
 ['Ординар','Ординар','Single'],['Експрес','Экспресс','Accumulator'],['Система','Система','System'],['Лайв','Лайв','Live'],['ЛАЙВ','ЛАЙВ','LIVE'],['Прематч','Прематч','Prematch'],['ПРЕМАТЧ','ПРЕМАТЧ','PREMATCH'],['ЛОББІ','ЛОББИ','LOBBY'],['ПЕРЕРВА','ПЕРЕРЫВ','BREAK'],['СЬОГОДНІ','СЕГОДНЯ','TODAY'],['ЗАВЕРШЕНО','ЗАВЕРШЕНО','FINISHED'],
 ['Вибране','Избранное','Favorites'],['Футбол','Футбол','Football'],['Теніс','Теннис','Tennis'],['Настільний теніс','Настольный теннис','Table tennis'],['Хокей','Хоккей','Hockey'],['Кіберспорт','Киберспорт','Esports'],['Баскетбол','Баскетбол','Basketball'],['Волейбол','Волейбол','Volleyball'],['Снукер','Снукер','Snooker'],
 ['Всі','Все','All'],['Основне','Основное','Main'],['Всі події','Все события','All events'],['Скоро','Скоро','Soon'],['Сьогодні','Сегодня','Today'],['Завтра','Завтра','Tomorrow'],['Вихідні','Выходные','Weekend'],['Огляд матчу','Обзор матча','Match overview'],['Огляд коефіцієнтів','Обзор коэффициентов','Odds overview'],['Особисті зустрічі','Личные встречи','Head to head'],['При відкритті','При открытии','On opening'],['Зараз','Сейчас','Now'],['Результат','Результат','Result'],
 ['Увійти','Войти','Sign in'],['Увійти','Увійти','Sign in'],['Реєстрація','Регистрация','Registration'],['Вхід','Вход','Sign in'],['Створити акаунт','Создать аккаунт','Create account'],['Ім’я','Имя','First name'],['Прізвище','Фамилия','Last name'],['Пароль','Пароль','Password'],['Змінити пароль','Изменить пароль','Change password'],['Поточний пароль','Текущий пароль','Current password'],['Новий пароль','Новый пароль','New password'],['Контакти','Контакты','Contact details'],['Номер рахунку','Номер счёта','Account number'],['Номер телефону','Номер телефона','Phone number'],['Не вказано','Не указан','Not provided'],['Персональна інформація','Персональная информация','Personal information'],['Мої дані','Мои данные','My details'],
 ['Назад','Назад','Back'],['Закрити','Закрыть','Close'],['Пошук','Поиск','Search'],['Сповіщення','Уведомления','Notifications'],['Нових сповіщень немає','Новых уведомлений нет','No new notifications'],['Допомога','Помощь','Help'],['Продовжити','Продолжить','Continue'],
 ['Зробити ставку','Сделать ставку','Place bet'],['Ставку прийнято','Ставка принята','Bet accepted'],['Сума купону','Сумма купона','Bet slip total'],['Можливий виграш','Возможный выигрыш','Potential winnings'],['Твій купон порожній','Твой купон пуст','Your bet slip is empty'],['Клікни на коефіцієнт, щоб додати ставку до купону','Нажми на коэффициент, чтобы добавить ставку в купон','Select odds to add a bet to your slip'],['На все','На всё','All in'],['Коефіцієнти недоступні','Коэффициенты недоступны','Odds unavailable'],['Прийняти зміни коефіцієнтів','Принять изменения коэффициентов','Accept odds changes'],
 ['Оновити','Обновить','Refresh'],['Пошук матчу','Поиск матча','Search matches'],['Команда або турнір','Команда или турнир','Team or tournament'],['Матчів не знайдено','Матчи не найдены','No matches found'],['Завантаження матчів','Загрузка матчей','Loading matches'],['Завантаження коефіцієнтів…','Загрузка коэффициентов…','Loading odds…'],['Ринки призупинено','Рынки приостановлены','Markets suspended'],['Вибраних матчів поки немає','Избранных матчей пока нет','No favorite matches yet'],['У цьому розділі зараз немає матчів','В этом разделе сейчас нет матчей','No matches in this section'],['Переглянути прематч','Посмотреть прематч','View prematch'],['До спорту','К спорту','Back to sport'],
 ['Нерозрахованих ставок немає','Нерассчитанных ставок нет','No unsettled bets'],['Розрахованих ставок ще немає','Рассчитанных ставок ещё нет','No settled bets yet'],['Операцій поки немає','Операций пока нет','No transactions yet'],['Виплата за ставкою','Выплата по ставке','Bet payout'],['Поповнення','Пополнение','Deposit'],['Виведення','Вывод','Withdrawal'],
 ['Активних бонусів немає','Активных бонусов нет','No active bonuses'],['Відгук','Отзыв','Feedback'],['Текст відгуку','Текст отзыва','Your feedback'],['Зберегти відгук','Сохранить отзыв','Save feedback'],['Відгук збережено на цьому пристрої','Отзыв сохранён на этом устройстве','Feedback saved on this device'],['Розрахунок ставок','Расчёт ставок','Bet settlement'],['Початковий розділ','Начальный раздел','Default section'],['Сортування матчів','Сортировка матчей','Match sorting'],['За часом','По времени','By start time'],['За турніром','По турниру','By tournament'],
 ['Готуємо купон…','Готовим купон…','Preparing coupon…'],['Профіль і віртуальний баланс зберігаються в цьому браузері.','Профиль и виртуальный баланс хранятся в этом браузере.','Your profile and virtual balance are stored in this browser.'],['Дані цього профілю належать лише Arena Line.','Данные этого профиля относятся только к Arena Line.','This profile belongs only to Arena Line.'],['Зміни з моменту відкриття цієї сторінки. Поточні коефіцієнти оновлюються з лінії.','Изменения с момента открытия этой страницы. Текущие коэффициенты обновляются из линии.','Changes since this page was opened. Current odds update from the live feed.']
];
let language='uk';
try {language=localStorage.getItem('arena-language-v1')||'uk';}catch{}
if(!['uk','ru','en'].includes(language))language='uk';
const lookup=new Map();
for(const values of phrases)for(const value of values)if(!lookup.has(value))lookup.set(value,values);
export const getLanguage=()=>language;
export const getLocale=()=>({uk:'uk-UA',ru:'ru-UA',en:'en-GB'})[language];
export function t(value) {
  const text=String(value??''),trim=text.trim(),column={uk:0,ru:1,en:2}[language];
  const exact=lookup.get(trim);
  if(exact)return text.replace(trim,exact[column]);
  let result=text.replace(/\b(\d+)\s*[чЧгГ]\b/g,(_,n)=>`${n}${language==='uk'?'Г':language==='ru'?'Ч':'H'}`);
  result=result.replace(/(?:Карта|Map)\s+(\d+)/g,(_,n)=>`${language==='en'?'Map':'Карта'} ${n}`);
  if(/ · | — /.test(result))result=result.split(/( · | — )/).map(part=>lookup.get(part)?.[column]||part).join('');
  return result;
}
const originals=new WeakMap();
export function translatePage(root=document.body) {
  const walker=document.createTreeWalker(root,4);let node;
  while((node=walker.nextNode())) {
    if(node.parentElement?.closest('script,style,textarea,[data-no-translate]'))continue;
    const prior=originals.get(node),original=prior&&node.nodeValue===prior.translated?prior.original:node.nodeValue;
    const translated=t(original);originals.set(node,{original,translated});if(node.nodeValue!==translated)node.nodeValue=translated;
  }
  for(const element of root.querySelectorAll('[placeholder],[aria-label],[title]')) for(const attr of ['placeholder','aria-label','title']) {
    if(!element.hasAttribute(attr))continue;
    const value=element.getAttribute(attr),data=originals.get(element)||{},prior=data[attr];
    const original=prior&&value===prior.translated?prior.original:value,translated=t(original);
    data[attr]={original,translated};originals.set(element,data);if(value!==translated)element.setAttribute(attr,translated);
  }
  document.documentElement.lang=language;
}
export function setLanguage(value) {
  if(!['uk','ru','en'].includes(value))return;
  language=value;localStorage.setItem('arena-language-v1',value);
  window.dispatchEvent(new CustomEvent('arena-language-change'));translatePage();
}
export function startTranslations() {
  translatePage();let scheduled=false;
  new MutationObserver(()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;translatePage();});}).observe(document.body,{childList:true,subtree:true,characterData:true});
}
