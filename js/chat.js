// --- ЛОГИКА WEBSOCKET ЧАТА ---
const urlParams = new URLSearchParams(window.location.search);
const chatUuid = urlParams.get('uuid');
const activeParticipants = new Map(); // ID -> Nickname
let currentRecipient = "all"; // "all" или ID пользователя

function chatInit(chatUuid){
    if (!chatUuid) {
        console.error("UUID не найден в URL");
    } else {
        const chatSocket = new WebSocket(`wss://nofelet.duckdns.org:8444/chat/${chatUuid}`);

        chatSocket.onopen = () => {
            console.log("Чат подключен");
            const nick = sessionStorage.getItem('myNickname') || 'Аноним';
            // Отправка согласно новому контракту
            sendChatEvent("join_room", { chat_id: chatUuid, nick: nick });
        };

        chatSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const payload = data.payload;

                switch (data.type) {
                    case 'room_state':
                        // Обработка снапшота всех пользователей
                        handleRoomState(payload.room_state);
                        break;
                    case 'user_joined':
                        // Логика добавления одного юзера (можно добавить в лог чата)
                        appendMessage('System', `${payload.user_joined.nick} присоединился`, false);
                        const nick = payload.user_joined.nick;
                        activeParticipants.set(nick, nick);
                        updateParticipantsList();
                        break;
                    case 'leave_room':
                        appendMessage('System', `${payload.leave_room.nick} покинул чат`, false);
                        activeParticipants.delete(payload.nick);
                        updateParticipantsList();
                        break;
                    case 'new_message':
                        // Обработка входящего сообщения
                        const msg = payload.new_message;
                        appendMessage(msg.sender, msg.content, false);
                        break;
                }
            } catch (e) {
                console.error("Ошибка парсинга:", e);
            }
        };

        chatSocket.onerror = (e) => console.error("Ошибка чата:", e);

        // Функция отправки
        function sendChatEvent(type, payload) {
            if (chatSocket.readyState === WebSocket.OPEN) {
                chatSocket.send(JSON.stringify({ type: type, payload: payload }));
            }
        }

        // Обработка отправки сообщения
        document.getElementById('chatForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const chatInput = document.getElementById('chatInput');
            const text = chatInput.value.trim();

            if (text && chatSocket.readyState === WebSocket.OPEN) {
                sendChatEvent("send_message", {
                    chat_id: chatUuid,
                    sender: sessionStorage.getItem('myNickname') || 'Аноним',
                    recipient: currentRecipient,
                    content: text
                });
                appendMessage('Вы', text, true);
                chatInput.value = '';
            }
        });
    }
}

function handleRoomState(usersObj) {
    activeParticipants.clear();
    for (const [id, nick] of Object.entries(usersObj)) {
        activeParticipants.set(id, nick);
    }
    updateParticipantsList();
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

// --- УПРАВЛЕНИЕ UI ---

function toggleChat() {
    const sidebar = document.getElementById('chatSidebar');
    sidebar.classList.toggle('active');
    document.body.classList.toggle('chat-open');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    const targetTab = document.getElementById(`tab-${tabName}`);
    targetTab.style.display = (tabName === 'chat') ? 'flex' : 'block';

    event.currentTarget.classList.add('active');
}

function updateParticipantsList() {
    const list = document.getElementById('participantsList');
    list.innerHTML = '';

    const all = document.createElement('div');
    all.className = 'participant-item';
    all.textContent = "🔊 Всем (Общий чат)";
    all.onclick = () => setRecipient("all", "Всем");
    list.appendChild(all);

    activeParticipants.forEach((nick, id) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.textContent = nick;
        item.onclick = () => setRecipient(id, nick);
        list.appendChild(item);
    });
}

function setRecipient(id, nick) {
    currentRecipient = id;
    const indicator = document.getElementById('replyIndicator');
    const input = document.getElementById('chatInput');

    if (id === "all") {
        indicator.style.display = 'none';
        input.placeholder = "Сообщение...";
    } else {
        indicator.style.display = 'block';
        indicator.textContent = `Пишете пользователю: ${nick}`;
        input.placeholder = `Сообщение для ${nick}...`;
    }
    switchTab('chat');
}