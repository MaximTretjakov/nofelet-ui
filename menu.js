document.addEventListener('DOMContentLoaded', function() {
    // 1. Сначала определяем состояние: авторизован или нет
    const token = localStorage.getItem('token');
    const nav = document.querySelector('.nav-masthead');
    if (!nav) return;

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    // 2. Рендерим (рисуем) меню в зависимости от токена
    renderMenu(nav, token);

    // 3. Твоя логика подсветки активного пункта (теперь работает с уже отрисованным меню)
    highlightActiveLink(nav, currentPage);

    // 4. Логика для кнопки "Выход", если она появилась
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
});

// Функция, которая решает, какие кнопки показать
function renderMenu(container, token) {
    if (!token) {
        // Меню для гостей
        container.innerHTML = `
            <a class="nav-link" href="index.html">Главная</a>
            <a class="nav-link" href="login.html">Вход</a>
        `;

        // Защита: если гость забрел на страницу звонков — кидаем на главную
        const protectedPages = ['choose.html', 'call.html'];
        const currentPage = window.location.pathname.split('/').pop();
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'index.html';
        }
    } else {
        // Меню для авторизованных
        container.innerHTML = `
            <a class="nav-link" href="choose.html">Звонки</a>
            <a class="nav-link" href="contacts.html">Контакты</a>
            <a class="nav-link" href="#" id="logoutBtn">Выход</a>
        `;
    }
}

// Твоя улучшенная логика подсветки
function highlightActiveLink(container, currentPage) {
    const navLinks = container.querySelectorAll('.nav-link');

    navLinks.forEach(link => {
        link.classList.remove('active');
        link.removeAttribute('aria-current');

        // Достаем имя файла из href ссылки
        const linkPage = link.getAttribute('href').split('/').pop();

        if (linkPage === currentPage) {
            link.classList.add('active');
            link.setAttribute('aria-current', 'page');
        }
    });
}

// Функция выхода
async function handleLogout(e) {
    e.preventDefault();
    const token = localStorage.getItem('token');

    try {
        // Опционально: уведомляем бек о логауте
        await fetch('https://nofelet.duckdns.org:8080/nofelet-web/api/v1/logout', {
            method: 'POST',
            headers: { 'Authorization': token }
        });
    } catch (err) {
        console.warn('Сервер не ответил на logout, но мы всё равно выходим');
    }

    localStorage.removeItem('token');
    window.location.href = 'index.html';
}