document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('regForm');
    const loginForm = document.getElementById('loginForm');

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    };

    const handleFormSubmit = async (e, apiUrl) => {
        e.preventDefault();
        const form = e.target;
        const loginInput = form.querySelector('#login');
        const passwordInput = form.querySelector('#password');
        const loginError = form.querySelector('#loginError');
        const passwordError = form.querySelector('#passwordError');

        let isValid = true;

        // Валидация логина (email)
        if (!loginInput.value || !validateEmail(loginInput.value)) {
            loginInput.classList.add('is-invalid-custom');
            loginError.style.display = 'block';
            isValid = false;
        } else {
            loginInput.classList.remove('is-invalid-custom');
            loginError.style.display = 'none';
        }

        // Валидация пароля
        if (!passwordInput.value) {
            passwordInput.classList.add('is-invalid-custom');
            passwordError.style.display = 'block';
            isValid = false;
        } else {
            passwordInput.classList.remove('is-invalid-custom');
            passwordError.style.display = 'none';
        }

        if (!isValid) return;

        // Подготовка данных
        const payload = {
            login: loginInput.value,
            password: passwordInput.value
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Успех:', result);
                alert('Готово! Сейчас перенаправим...');
                // window.location.href = 'choose.html';
            } else {
                alert('Ошибка сервера. Попробуйте позже.');
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            alert('Не удалось связаться с сервером. Проверьте консоль.');
        }
    };

    if (regForm) {
        regForm.addEventListener('submit', (e) =>
            handleFormSubmit(e, 'https://nofelet.duckdns.org:8080/nofelet-web/api/v1/registration')
        );
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) =>
            // Тут можно указать другой URL для логина, если он есть
            handleFormSubmit(e, 'https://nofelet.duckdns.org:8080/nofelet-web/api/v1/auth')
        );
    }
});