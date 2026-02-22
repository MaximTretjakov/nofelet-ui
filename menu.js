// Когда страница полностью загрузится
    document.addEventListener('DOMContentLoaded', function() {
    // 1. Получаем текущий URL страницы (например, "http://.../about.html")
    const currentPage = window.location.pathname.split('/').pop();

    // 2. Находим все ссылки в навигационном меню
    const navLinks = document.querySelectorAll('.nav-link');

    // 3. Перебираем все ссылки
    navLinks.forEach(link => {
        // Сначала удаляем класс 'active' у всех ссылок (если он где-то остался)
        link.classList.remove('active');
        const hrefP = link.href.split('/').pop()
        // 4. Сравниваем URL ссылки с текущим URL страницы
        if (hrefP === currentPage) {
            // Если совпадает, делаем эту ссылку активной
            link.classList.add('active');
            // Также можно добавить aria-current для доступности, как рекомендует Bootstrap
            link.setAttribute('aria-current', 'page');
        }
    });

    // Специальная обработка для главной страницы, если она называется index.html
    // Если currentPage пуст (например, вы просто на главной странице example.com/)
    if (currentPage === '' || currentPage === 'index.html') {
    // Находим ссылку на index.html и делаем её активной
    const homeLink = document.querySelector('a[href="index.html"]');
        if (homeLink) {
            homeLink.classList.add('active');
            homeLink.setAttribute('aria-current', 'page');
        }
    }
});

