let mediaRecorder;
let audioChunks = [];
let cardsData = [];
let allHidden = false;
let currentCardIndex = 0;
let selectedCardIndex = null;

let pomodoroInterval;
let isWorkTime = true;
let workDuration = 25 * 60; // 25 minutos
let breakDuration = 5 * 60; // 5 minutos
let longBreakDuration = 15 * 60; // 15 minutos
let cycleCount = 0;
let timeRemaining = workDuration;
let completedCycles = 0;

let videoElement = document.querySelector(".videoContainer video");
let currentFullScreenCard;

document.getElementById("importarArquivo").addEventListener("change", lerArquivo);
document.getElementById("importarVideo").addEventListener("change", lerVideo);

document.addEventListener('keydown', (event) => {
    if (selectedCardIndex !== null) {
        switch(event.key) {
            case 'ArrowUp':
                ajustarTempoLegenda(selectedCardIndex, 'start', 1);
                break;
            case 'ArrowDown':
                ajustarTempoLegenda(selectedCardIndex, 'start', -1);
                break;
            case 'ArrowRight':
                ajustarTempoLegenda(selectedCardIndex, 'end', 1);
                break;
            case 'ArrowLeft':
                ajustarTempoLegenda(selectedCardIndex, 'end', -1);
                break;
        }
    }
});

function lerArquivo(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const extension = file.name.split(".").pop().toLowerCase();
            let texto = e.target.result;

            if (extension === "srt") {
                const result = srtParaTexto(texto);
                texto = result.texto;
                cardsData = result.cardsData;
                criarCards(true);
            } else if (extension === "txt") {
                texto = limparTexto(texto);
                const paragrafos = texto
                    .split(/\n\s*\n/)
                    .filter((p) => p.trim() !== "");
                cardsData = paragrafos.map((paragrafo, index) => ({
                    texto: paragrafo,
                    startTime: index * 10, // Define um placeholder para start time
                    endTime: (index + 1) * 10, // Define um placeholder para end time
                }));
                document.getElementById("texto").value = texto;
                document.getElementById("quebrarLinhasBtn").disabled = false;
            } else {
                alert(
                    "Formato de arquivo não suportado. Por favor, importe um arquivo .txt ou .srt."
                );
            }
        };
        reader.readAsText(file);
    }
}

function lerVideo(event) {
    const file = event.target.files[0];
    if (file) {
        const videoUrl = URL.createObjectURL(file);
        videoElement.src = videoUrl;
        videoElement.style.display = "block"; // Assegura que o vídeo esteja visível
    }
}

function limparTexto(texto) {
    texto = texto.replace(
        /<b>|<\/b>|<i>|<\/i>|<u>|<\/u>|<font[^>]*>|<\/font>/g,
        ""
    );
    texto = texto.replace(/♪[^♪]*♪/g, "");
    texto = texto.replace(/\[.*?\]/g, "");
    texto = texto.replace(/^[^:\n]+:\s*/gm, ""); // Remove os nomes dos personagens
    return texto;
}

function srtParaTexto(srt) {
    const regex =
        /\d+\s+(\d{2}):(\d{2}):(\d{2}),\d{3} --> (\d{2}):(\d{2}):(\d{2}),\d{3}\s+(.*?)\s+(?=\d+\s+\d{2}:\d{2}:\d{2},\d{3}|$)/gs;
    let texto = "";
    let cardsData = [];
    let match;
    while ((match = regex.exec(srt)) !== null) {
        const startHours = parseInt(match[1]);
        const startMinutes = parseInt(match[2]);
        const startSeconds = parseInt(match[3]);
        const endHours = parseInt(match[4]);
        const endMinutes = parseInt(match[5]);
        const endSeconds = parseInt(match[6]);
        const startTime =
            startHours * 3600 + startMinutes * 60 + startSeconds;
        const endTime = endHours * 3600 + endMinutes * 60 + endSeconds;
        let text = match[7].replace(/\r?\n/g, " ");
        text = limparTexto(text);
        texto += text + "\n\n";
        cardsData.push({ startTime, endTime, texto: text });
    }
    return { texto: texto.trim(), cardsData };
}

function quebrarLinhas() {
    const texto = document.getElementById("texto").value;
    const paragrafos = formatarTexto(texto)
        .split(/\n\s*\n/)
        .filter((p) => p.trim() !== "");

    cardsData = paragrafos.map((paragrafo, index) => ({
        texto: paragrafo,
        comparado: false,
        audioUrl: null,
        startTime: index * 10, // Exemplo: cada parágrafo começa a 10 segundos de intervalo
        endTime: (index + 1) * 10, // Exemplo: cada parágrafo termina a 20 segundos de intervalo
    }));

    criarCards(false);
}

function criarCards(fromSRT) {
    const textoContainer = document.getElementById("textoContainer");
    const cardsContainer = document.getElementById("cardsContainer");

    textoContainer.style.display = "none";
    cardsContainer.innerHTML = ""; // Limpa o conteúdo anterior

    cardsData.forEach((cardData, index) => {
        const card = document.createElement("div");
        card.classList.add("card");
        card.id = `card-${index}`;
        if (index === 0) {
            card.classList.add("enabled");
        }

        const hideButton = document.createElement("button");
        hideButton.classList.add("hide-button", "icon-button");
        hideButton.innerHTML = `<img src="/data/hide.svg" alt="Ocultar">`;
        hideButton.title = "Ocultar";
        hideButton.addEventListener("click", () => toggleVisibility());

        const paragrafoElement = document.createElement("p");
        paragrafoElement.textContent = `${cardData.texto} (${formatarTempo(cardData.startTime)} --> ${formatarTempo(cardData.endTime)})`;
        paragrafoElement.addEventListener("click", () => selecionarLegenda(index));
        paragrafoElement.addEventListener("dblclick", () => selecionarPalavra(paragrafoElement));

        const compareInput = document.createElement("input");
        compareInput.setAttribute("type", "text");
        compareInput.setAttribute("placeholder", "Digite para comparar");
        compareInput.classList.add("compareInput");
        compareInput.addEventListener("input", () => compararTexto(compareInput, paragrafoElement, index));
        compareInput.addEventListener("input", startPomodoro);
        if (index !== 0) {
            compareInput.disabled = true;
        }

        const audioControls = document.createElement("div");
        audioControls.classList.add("audioControls");

        const buttonGroup = document.createElement("div");
        buttonGroup.classList.add("buttonGroup");

        const playPauseButton = document.createElement("button");
        playPauseButton.classList.add("icon-button");
        playPauseButton.title = "Microfone";
        playPauseButton.innerHTML = `<img src="/data/microfone.svg" alt="Microfone">`;
        playPauseButton.addEventListener("click", () => toggleRecording(playPauseButton, index));
        if (index !== 0) {
            playPauseButton.disabled = true;
        }

        const playAudioButton = document.createElement("button");
        playAudioButton.classList.add("icon-button");
        playAudioButton.title = "Reproduzir Parágrafo";
        playAudioButton.innerHTML = `<img src="/data/reproduzir paragrafo.svg" alt="Reproduzir">`;
        playAudioButton.addEventListener("click", () => reproduzirParagrafoOuTTS(index));

        const unirLegendaButton = document.createElement("button");
        unirLegendaButton.classList.add("icon-button");
        unirLegendaButton.title = "Unir Legenda";
        unirLegendaButton.innerHTML = `<img src="/data/unir.svg" alt="Unir">`;
        unirLegendaButton.addEventListener("click", () => unirComProxima(index));

        const importarVideoButton = document.createElement("button");
        importarVideoButton.classList.add("icon-button");
        importarVideoButton.title = "Importar vídeo";
        importarVideoButton.innerHTML = `<img src="/data/video.svg" alt="Importar">`;
        importarVideoButton.setAttribute("data-card-id", `card-${index}`);
        importarVideoButton.style.display = "block";
        importarVideoButton.addEventListener("click", () => {
            document.getElementById("importarVideo").click();
        });

        const adicionarFraseButton = document.createElement("button");
        adicionarFraseButton.classList.add("icon-button");
        adicionarFraseButton.title = "Adicionar Frase";
        adicionarFraseButton.innerHTML = `<img src="/data/plus.svg" alt="Adicionar Frase">`;
        adicionarFraseButton.addEventListener("click", () => adicionarFrase(index));

        buttonGroup.appendChild(playPauseButton);
        buttonGroup.appendChild(playAudioButton);
        buttonGroup.appendChild(unirLegendaButton);
        buttonGroup.appendChild(importarVideoButton);
        buttonGroup.appendChild(adicionarFraseButton); // Adiciona o botão "Adicionar Frase"

        audioControls.appendChild(buttonGroup);

        card.appendChild(hideButton);
        card.appendChild(paragrafoElement);
        card.appendChild(compareInput);
        card.appendChild(audioControls);

        // Criação da lista ordenada
        const listaOrdenada = document.createElement("ol");
        listaOrdenada.id = `listaOrdenada-${index}`;
        card.appendChild(listaOrdenada);

        cardsContainer.appendChild(card);
    });

    // Mostrar a seção de palavras selecionadas e parágrafos visíveis
    document.getElementById("selectedWords").style.display = "block";
    document.getElementById("paragrafosVisiveisContainer").style.display = "block";
    document.getElementById("paragrafosVisiveis").textContent = cardsData.length;
}

function adicionarFrase(index) {
    // Obtém o card correspondente pelo índice
    const card = document.getElementById(`card-${index}`);
    // Obtém o conteúdo da tag <p> e os tempos de início e fim
    const pElement = card.querySelector('p');
    const pContent = pElement.textContent;
    const startTime = cardsData[index].startTime;
    const endTime = cardsData[index].endTime;

    // Adiciona a frase ao card como anteriormente
    let listaOrdenada = card.querySelector('.listaOrdenada');
    if (!listaOrdenada) {
        listaOrdenada = document.createElement('ol');
        listaOrdenada.classList.add('listaOrdenada');
        card.appendChild(listaOrdenada);
    }
    const listItem = document.createElement('li');
    listItem.textContent = pContent;
    listaOrdenada.appendChild(listItem);

    // Adiciona a frase ao container de frases
    const frasesList = document.getElementById("frasesList");
    const novaFraseItem = document.createElement("li");
    novaFraseItem.textContent = pContent;
    novaFraseItem.setAttribute("data-start-time", startTime);
    novaFraseItem.setAttribute("data-end-time", endTime);
    frasesList.appendChild(novaFraseItem);

    // Adiciona o event listener para reproduzir o vídeo
    novaFraseItem.addEventListener("click", () => {
        irParaPontoDoVideo(startTime, endTime);
    });
}

function irParaPontoDoVideo(startTime, endTime) {
    if (videoElement) {
        videoElement.currentTime = startTime;
        videoElement.play();

        // Adiciona um listener para pausar o vídeo no final do trecho
        videoElement.addEventListener("timeupdate", function onTimeUpdate() {
            if (videoElement.currentTime >= endTime) {
                videoElement.pause();
                videoElement.removeEventListener("timeupdate", onTimeUpdate);
            }
        });
    }
}

function criarListaOrdenada(index, novaFrase) {
    // Cria ou atualiza a lista ordenada de legendas unidas
    let ol = document.querySelector(`#listaOrdenada-${index}`);
    
    if (!ol) {
        ol = document.createElement("ol");
        ol.id = `listaOrdenada-${index}`;
        document.getElementById(`card-${index}`).appendChild(ol);
    }
    
    const li = document.createElement("li");
    li.textContent = novaFrase;
    ol.appendChild(li);
}

function formatarTexto(texto) {
    return texto.replace(/([.?!])\s*/g, "$1\n\n");
}

function toggleVisibility() {
    const paragrafoElements = document.querySelectorAll(".card p");
    const cardsContainer = document.getElementById("cardsContainer");

    if (allHidden) {
        paragrafoElements.forEach((paragrafo) => {
            paragrafo.style.display = "block";
        });
        allHidden = false;
    } else {
        paragrafoElements.forEach((paragrafo) => {
            paragrafo.style.display = "none";
        });
        allHidden = true;
    }
}

async function toggleRecording(button, index) {
    if (button.textContent === "Play") {
        button.textContent = "Pause";
        await startRecording(index); // Adicionei await para garantir que a gravação comece antes de continuar
    } else {
        button.textContent = "Play";
        stopRecording(index);
    }
}

async function startRecording(index) {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.addEventListener("dataavailable", (event) => {
            audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener("stop", () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/mpeg" });
            const audioUrl = URL.createObjectURL(audioBlob);

            cardsData[index].audioUrl = audioUrl;

            audioChunks = []; // Limpar chunks para a próxima gravação

            // Reproduzir o áudio gravado após a gravação
            const áudio = new Audio(audioUrl);
            áudio.play();
        });

        mediaRecorder.start();
    } catch (error) {
        console.error("Erro ao iniciar gravação de áudio:", error);
    }
}

function stopRecording(index) {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
    }
}

function reproduzirParagrafoOuTTS(index) {
    if (
        videoElement &&
        cardsData[index] &&
        cardsData[index].startTime !== undefined
    ) {
        const startTime = cardsData[index].startTime;
        const endTime = cardsData[index].endTime;
        videoElement.currentTime = startTime;

        videoElement.play();
        videoElement.addEventListener("timeupdate", function onTimeUpdate() {
            if (videoElement.currentTime >= endTime) {
                videoElement.pause();
                videoElement.removeEventListener("timeupdate", onTimeUpdate);
            }
        });
    } else {
        const texto = cardsData[index].texto;
        const msg = new SpeechSynthesisUtterance(texto);
        window.speechSynthesis.speak(msg);
    }
}

function compararTexto(input, paragrafoElement, index) {
    const textoDigitado = input.value.trim();
    const textoParagrafo = paragrafoElement.textContent.trim();

    const normalizeText = (text) => text.replace(/\s+/g, " ").toLowerCase();

    if (normalizeText(textoDigitado) === normalizeText(textoParagrafo)) {
        input.style.backgroundColor = "lightblue";
        cardsData[index].comparado = true;
        input.disabled = true;

        habilitarProximoCard(index + 1);
        diminuirParagrafosVisiveis();
    } else if (
        normalizeText(textoParagrafo).startsWith(normalizeText(textoDigitado))
    ) {
        input.style.backgroundColor = "lightgreen";
        cardsData[index].comparado = false;
        input.disabled = false;
    } else {
        input.style.backgroundColor = "lightcoral";
        cardsData[index].comparado = false;
        input.disabled = false;
    }
}

function habilitarProximoCard(index) {
    const cardsContainer = document.getElementById("cardsContainer");
    const cards = cardsContainer.querySelectorAll(".card");

    cards.forEach((card, i) => {
        const compareInput = card.querySelector(".compareInput");
        const playPauseButton = card.querySelector("button");

        if (i === index) {
            card.classList.add("enabled");
            card.classList.remove("disabled");
            compareInput.disabled = false;
            playPauseButton.disabled = false;
            compareInput.focus();
            currentCardIndex = index;
        } else {
            card.classList.remove("enabled");
            card.classList.add("disabled");
            compareInput.disabled = true;
            playPauseButton.disabled = true;
        }
    });

    if (index >= 0 && index < cards.length) {
        const compareInput = cards[index].querySelector(".compareInput");
        const playPauseButton = cards[index].querySelector("button");

        cards[index].classList.add("enabled");
        cards[index].classList.remove("disabled");
        compareInput.disabled = false;
        playPauseButton.disabled = false;
        compareInput.focus();
    } else if (index >= cards.length) {
        // Pausar o Pomodoro se todos os cards foram completados
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
}

function selecionarPalavra(paragrafoElement) {
    const selectedText = window.getSelection().toString().trim();

    if (selectedText) {
        const existingItems = document.querySelectorAll("#wordList li");
        let alreadyExists = false;
        existingItems.forEach((item) => {
            if (item.getAttribute("data-text") === selectedText) {
                alreadyExists = true;
            }
        });
        if (alreadyExists) {
            return;
        }

        const span = document.createElement("span");
        span.className = "highlight";
        span.textContent = selectedText;
        span.addEventListener("click", () => deselecionarPalavra(span));

        const wordList = document.getElementById("wordList");
        const listItem = document.createElement("li");
        listItem.textContent = selectedText;
        listItem.setAttribute("data-text", selectedText);
        wordList.appendChild(listItem);

        paragrafoElement.innerHTML = paragrafoElement.innerHTML.replace(
            selectedText,
            span.outerHTML
        );
    }
}

function deselecionarPalavra(spanElement) {
    const wordList = document.getElementById("wordList");
    const items = wordList.querySelectorAll("li");
    items.forEach((item) => {
        if (item.getAttribute("data-text") === spanElement.textContent) {
            wordList.removeChild(item);
        }
    });

    const parent = spanElement.parentNode;
    parent.innerHTML = parent.innerHTML.replace(
        spanElement.outerHTML,
        spanElement.textContent
    );
}

function criarArquivoTxt() {
    const wordList = document.getElementById("wordList");
    const words = [];
    wordList.querySelectorAll("li").forEach((item) => {
        words.push(item.textContent);
    });

    if (words.length === 0) {
        alert(
            "Nenhuma palavra selecionada. Não é possível criar o arquivo TXT."
        );
        return;
    }

    const nomeArquivo = prompt(
        "Digite o nome do arquivo:",
        "palavras_selecionadas.txt"
    );
    if (nomeArquivo === null || nomeArquivo.trim() === "") {
        alert("Nome de arquivo inválido. O arquivo não foi criado.");
        return;
    }

    const blob = new Blob([words.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
}

function startPomodoro() {
    if (pomodoroInterval) {
        return; // Pomodoro já está rodando
    }

    pomodoroInterval = setInterval(() => {
        if (timeRemaining <= 0) {
            completedCycles++;
            document.getElementById("completedCycles").textContent = completedCycles;
            if (isWorkTime) {
                cycleCount++;
                isWorkTime = false;
                timeRemaining = cycleCount % 4 === 0 ? longBreakDuration : breakDuration;
                document.getElementById("timerLabel").textContent = "Descanso";
            } else {
                isWorkTime = true;
                timeRemaining = workDuration;
                document.getElementById("timerLabel").textContent = "Foco";
            }
        } else {
            timeRemaining--;
        }
        updatePomodoroTimer();
        updateProgressCircle(); // Adiciona esta linha para atualizar o círculo de progresso
    }, 1000);
}

function resetPomodoro() {
    clearInterval(pomodoroInterval);
    pomodoroInterval = null;
    isWorkTime = true;
    timeRemaining = workDuration;
    cycleCount = 0;
    document.getElementById("timerLabel").textContent = "Foco";
    updatePomodoroTimer();
    updateProgressCircle(); // Adiciona esta linha para redefinir o círculo de progresso
}

function unirComProxima(index) {
    if (index < cardsData.length - 1) {
        const cardAtual = cardsData[index];
        const cardProximo = cardsData[index + 1];

        cardAtual.texto += " " + cardProximo.texto;
        cardAtual.endTime = cardProximo.endTime;

        cardsData.splice(index + 1, 1);
        criarCards(false);
        setTimeout(() => habilitarProximoCard(index), 0); // Manter o índice atual após unir
    }
}

function updatePomodoroTimer() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById("timer").textContent = `${
        minutes < 10 ? "0" : ""
    }${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function updateProgressCircle() {
    const progressCircle = document.querySelector('.progress-ring__circle');
    const radius = progressCircle.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;

    progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
    progressCircle.style.strokeDashoffset = circumference;

    function setProgress(percent) {
        const offset = circumference - (percent / 100) * circumference;
        progressCircle.style.strokeDashoffset = offset;
    }

    const totalDuration = isWorkTime ? workDuration : (cycleCount % 4 === 0 ? longBreakDuration : breakDuration);
    const percent = ((totalDuration - timeRemaining) / totalDuration) * 100;
    setProgress(percent);
}

document.getElementById("texto").addEventListener("input", () => {
    document.getElementById("quebrarLinhasBtn").disabled =
        document.getElementById("texto").value.trim() === "";
});

function toggleFullScreen() {
    const videoContainer = videoElement.parentElement;
    if (!document.fullscreenElement) {
        videoContainer.classList.add("full-screen");
        videoElement.requestFullscreen().catch((err) => {
            alert(
                `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
            );
        });
    } else {
        document.exitFullscreen();
        videoContainer.classList.remove("full-screen");
    }
}

function selecionarLegenda(index) {
    selectedCardIndex = index;
    // Opcional: adicionar uma classe CSS para destacar a legenda selecionada
}

function ajustarTempoLegenda(index, type, ajuste) {
    if (index !== null && index >= 0 && index < cardsData.length) {
        if (type === 'start') {
            cardsData[index].startTime += ajuste;
            cardsData[index].startTime = Math.max(cardsData[index].startTime, 0); // Assegura que o tempo não seja negativo
        } else if (type === 'end') {
            cardsData[index].endTime += ajuste;
            cardsData[index].endTime = Math.max(cardsData[index].endTime, cardsData[index].startTime); // Garantir que o endTime não seja menor que startTime
        }
        atualizarTempoLegenda(index);
    }
}

function atualizarTempoLegenda(index) {
    const card = document.getElementById(`card-${index}`);
    if (card) {
        const pElement = card.querySelector('p');
        const startTime = formatarTempo(cardsData[index].startTime);
        const endTime = formatarTempo(cardsData[index].endTime);
        pElement.textContent = `${cardsData[index].texto} (${startTime} --> ${endTime})`;
    }
}

function formatarTempo(segundos) {
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;
    return `${minutos.toString().padStart(2, '0')}:${segundosRestantes.toString().padStart(2, '0')}`;
}
