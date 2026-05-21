// --- ЛОГИКА WEBSOCKET ЧАТА ---
const urlParams = new URLSearchParams(window.location.search);
const chatUuid = urlParams.get('uuid');

function chatInit(chatUuid, recipient){
    if (!chatUuid) {
        console.error("UUID не найден в URL");
    } else {
        const chatSocket = new WebSocket(`wss://nofelet.duckdns.org:8444/chat/${chatUuid}`);

        chatSocket.onopen = () => {
            console.log("Чат подключен");
            const nick = sessionStorage.getItem('myNickname') || 'Аноним';
            sendChatEvent("join", { chat_id: chatUuid, nick: nick });
        };

        chatSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'ping') {
                    sendChatEvent('pong', {});
                } else if (data.type === 'message') {
                    appendMessage(data.payload.sender, data.payload.content, false);
                }
            } catch (e) {
                console.error("Ошибка парсинга сообщения:", e);
            }
        };

        chatSocket.onerror = (e) => console.error("Ошибка чата:", e);

        // Функция отправки
        function sendChatEvent(type, payload) {
            if (chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({ type: type, payload: payload }));
            }
        }

        // Обработка набора текста (typing)
        const chatInput = document.getElementById('chatInput');
        chatInput.addEventListener('input', () => {
            sendChatEvent("typing", { chat_id: chatUuid, is_typing: true });
        });

        // Обработка отправки сообщения
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const text = chatInput.value.trim();
            if (text && chatSocket.readyState === WebSocket.OPEN) {
                sendChatEvent("text", {
                    chat_id: chatUuid,
                    sender: sessionStorage.getItem('myNickname') || 'Аноним',
                    recipient: recipient,
                    content: text
                });
                appendMessage('Вы', text, true);
                chatInput.value = '';
            } else if (chatSocket.readyState !== WebSocket.OPEN) {
                alert("Соединение с чатом потеряно!");
            }
        });
    }
}

function appendMessage(author, text, isMe) {
    const container = document.getElementById('chatMessages');
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${isMe ? 'me' : 'other'}`;
    msgDiv.innerHTML = `
        <div class="message-author">${author}</div>
        <div class="message-text">${text}</div>
    `;
    container.appendChild(msgDiv);
    container.scrollTop = container.scrollHeight;
}

function toggleChat() {
    const sidebar = document.getElementById('chatSidebar');
    sidebar.classList.toggle('active');
    document.body.classList.toggle('chat-open');
    if (sidebar.classList.contains('active')) {
        document.getElementById('chatBadge').style.display = 'none';
    }
}