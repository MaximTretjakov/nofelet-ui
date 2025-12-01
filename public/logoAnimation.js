function startAnimation() {
    const wordElement = document.getElementById('word');
    const originalWord = "Nofelet";
    const reversedWord = "Telefon";

    const letters = document.querySelectorAll('.letter');

    // Этап 1: Переворот букв с задержкой
    letters.forEach((letter, index) => {
    setTimeout(() => {
    letter.classList.add('flip');

    // После завершения переворота меняем букву
    setTimeout(() => {
    letter.textContent = reversedWord[index];
    letter.classList.remove('flip');
}, 800);

}, index * 200);
});

    // После завершения переворота всех букв
    setTimeout(() => {
    // Пауза 3 секунды
    setTimeout(() => {
    // Этап 2: Возврат к исходному слову
    letters.forEach((letter, index) => {
    setTimeout(() => {
    letter.classList.add('flip');

    // После завершения переворота возвращаем исходную букву
    setTimeout(() => {
    letter.textContent = originalWord[index];
    letter.classList.remove('flip');
}, 800);

}, index * 200);
});
}, 3000);
}, letters.length * 200 + 1000);
}

// Запуск анимации через 1 секунду после загрузки страницы
window.onload = setTimeout(startAnimation, 1000);
