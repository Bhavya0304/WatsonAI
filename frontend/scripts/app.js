const API_URL = "http://localhost:8000/chat";

/*
|--------------------------------------------------------------------------
| Session Management
|--------------------------------------------------------------------------
*/

function getSessionId() {

    let sessionId = localStorage.getItem("session_id");

    if (!sessionId) {

        sessionId = crypto.randomUUID();

        localStorage.setItem(
            "session_id",
            sessionId
        );
    }

    return sessionId;
}

const SESSION_ID = getSessionId();

/*
|--------------------------------------------------------------------------
| DOM References
|--------------------------------------------------------------------------
*/

const messagesDiv =
    document.getElementById("messages");

const input =
    document.getElementById("messageInput");

const sendBtn =
    document.getElementById("sendBtn");

/*
|--------------------------------------------------------------------------
| Particles Background
|--------------------------------------------------------------------------
*/

tsParticles.load("particles", {

    particles: {

        number: {
            value: 80
        },

        color: {
            value: "#ffffff"
        },

        links: {
            enable: true,
            color: "#ffffff",
            distance: 150,
            opacity: 0.15
        },

        move: {
            enable: true,
            speed: 1
        },

        opacity: {
            value: 0.3
        },

        size: {
            value: {
                min: 1,
                max: 3
            }
        }
    },

    background: {
        color: {
            value: "#050816"
        }
    }
});

/*
|--------------------------------------------------------------------------
| Intro Animation
|--------------------------------------------------------------------------
*/

async function playIntro() {

    const lines =
        document.querySelectorAll(".intro-line");

    for (const line of lines) {

        await new Promise(resolve => {

            setTimeout(() => {

                line.classList.add("show");

                resolve();

            }, 700);

        });
    }

    setTimeout(() => {

        document
            .getElementById("intro-screen")
            .classList
            .add("hide");

        document
            .getElementById("chat-container")
            .classList
            .add("show");

    }, 2500);
}

playIntro();

/*
|--------------------------------------------------------------------------
| Message Rendering
|--------------------------------------------------------------------------
*/

function scrollToBottom() {

    messagesDiv.scrollTop =
        messagesDiv.scrollHeight;
}

function addMessage(text, role) {

    const div =
        document.createElement("div");

    div.className =
        `message ${role}`;

    if(role === "assistant") {

        div.innerHTML =
            marked.parse(text);

    } else {

        div.textContent =
            text;
    }

    messagesDiv.appendChild(div);

    scrollToBottom();

    return div;
}

function addTypingIndicator() {

    const div =
        document.createElement("div");

    div.className =
        "message assistant";

    div.innerHTML = `
        <div class="typing">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;

    messagesDiv.appendChild(div);

    scrollToBottom();

    return div;
}

/*
|--------------------------------------------------------------------------
| Chat API
|--------------------------------------------------------------------------
*/

async function sendMessage() {

    const text =
        input.value.trim();

    if (!text)
        return;

    addMessage(
        text,
        "user"
    );

    input.value = "";

    const typing =
        addTypingIndicator();

    try {

        const response =
            await fetch(
                API_URL,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({
                        session_id:
                            SESSION_ID,

                        message:
                            text
                    })
                }
            );

        if (!response.ok) {

            throw new Error(
                "Request failed"
            );
        }

        const data =
            await response.json();

        typing.remove();

        addMessage(
            data.response,
            "assistant"
        );

    }
    catch (error) {

        console.error(error);

        typing.remove();

        addMessage(
            "Watson appears to have wandered off. Try again.",
            "assistant"
        );
    }
}

/*
|--------------------------------------------------------------------------
| Events
|--------------------------------------------------------------------------
*/

sendBtn.addEventListener(
    "click",
    sendMessage
);

input.addEventListener(
    "keydown",
    (e) => {

        if (
            e.key === "Enter" &&
            !e.shiftKey
        ) {

            e.preventDefault();

            sendMessage();
        }
    }
);

/*
|--------------------------------------------------------------------------
| Welcome Message
|--------------------------------------------------------------------------
*/

setTimeout(() => {

    addMessage(
        "Hello. I'm Watson. Ask me anything about Bhavya, his projects, experience, or the engineering rabbit holes he occasionally disappears into.",
        "assistant"
    );

}, 7000);