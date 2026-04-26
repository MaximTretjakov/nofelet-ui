document.addEventListener('DOMContentLoaded', () => {
    const regForm = document.getElementById('regForm');
    const loginForm = document.getElementById('loginForm');

    const validateEmail = (email) => {
        return String(email)
            .toLowerCase()
            .match(/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
    };

    const handleLoginFormSubmit = async (e, apiUrl) => {
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
                if (result.data && result.data.token) {
                    localStorage.setItem('token', result.data.token);
                }
                window.location.href = 'choose.html';
            } else {
                alert('Ошибка сервера. Попробуйте позже.');
            }
        } catch (error) {
            console.error('Ошибка сети:', error);
            alert('Не удалось связаться с сервером. Проверьте консоль.');
        }
    };

    const handleRegFormSubmit = async (e, apiUrl) => {
        e.preventDefault();
        const form = e.target;
        const loginInput = form.querySelector('#login');
        const userNameInput = form.querySelector('#userName');
        const passwordInput = form.querySelector('#password');
        const loginError = form.querySelector('#loginError');
        const userNameError = form.querySelector('#userNameError');
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

        // Валидация имени пользователя
        if (!userNameInput.value) {
            userNameInput.classList.add('is-invalid-custom');
            userNameError.style.display = 'block';
            isValid = false;
        } else {
            userNameInput.classList.remove('is-invalid-custom');
            userNameError.style.display = 'none';
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
            userName: userNameInput.value,
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
                if (result.data && result.data.token) {
                    localStorage.setItem('token', result.data.token);
                }
                window.location.href = 'choose.html';
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
            handleRegFormSubmit(e, 'https://nofelet.duckdns.org:8080/nofelet-web/api/v1/registration')
        );
    }

    if (loginForm) {
        loginForm.addEventListener('submit', (e) =>
            // Тут можно указать другой URL для логина, если он есть
            handleLoginFormSubmit(e, 'https://nofelet.duckdns.org:8080/nofelet-web/api/v1/auth')
        );
    }
});