/* ==========================================
   MINIJUEGOS - src/juegos/juegosManager.js
   Tres minijuegos jugables dentro de la pestaña "Juegos" (Rincón de los
   Peques, ver #view-juegos en index.html): Memotest, Trivia y Ta-Te-Ti.
   Cada uno vive en su propio modal (.modal-overlay), reutilizando el
   componente genérico de src/styles/_components.css. Sin dependencias de
   Firebase: todo el estado es local a este módulo.
   ========================================== */

export function initJuegos() {
    document.querySelectorAll('[data-juego]').forEach(boton => {
        boton.addEventListener('click', () => abrirJuego(boton.dataset.juego));
    });

    document.querySelectorAll('[data-cerrar-juego]').forEach(boton => {
        boton.addEventListener('click', () => cerrarModal(boton.closest('.modal-overlay')));
    });

    document.getElementById('memotest-reiniciar')?.addEventListener('click', iniciarMemotest);
    document.getElementById('tateti-reiniciar')?.addEventListener('click', iniciarTateti);
}

function abrirJuego(juego) {
    const modal = document.getElementById(`modal-${juego}`);
    if (!modal) return;
    modal.classList.add('active');

    if (juego === 'memotest') iniciarMemotest();
    if (juego === 'trivia') iniciarTrivia();
    if (juego === 'tateti') iniciarTateti();
}

function cerrarModal(modal) {
    modal?.classList.remove('active');
}

/* ---------- MEMOTEST CORRENTINO ---------- */

const EMOJIS_MEMOTEST = ['🐊', '🎣', '☀️', '🎭', '🌊', '🎶'];

let memotestCartas = [];
let memotestSeleccion = [];
let memotestMovimientos = 0;
let memotestBloqueado = false;

function mezclarArray(array) {
    const copia = [...array];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia;
}

function iniciarMemotest() {
    memotestCartas = mezclarArray([...EMOJIS_MEMOTEST, ...EMOJIS_MEMOTEST]).map((emoji, indice) => ({
        id: indice,
        emoji,
        volteada: false,
        encontrada: false
    }));
    memotestSeleccion = [];
    memotestMovimientos = 0;
    memotestBloqueado = false;

    actualizarMovimientos();
    const mensajeGanaste = document.getElementById('memotest-ganaste');
    if (mensajeGanaste) mensajeGanaste.hidden = true;

    renderMemotest();
}

function actualizarMovimientos() {
    const contador = document.getElementById('memotest-movimientos');
    if (contador) contador.textContent = `Movimientos: ${memotestMovimientos}`;
}

function renderMemotest() {
    const tablero = document.getElementById('memotest-tablero');
    if (!tablero) return;

    tablero.innerHTML = memotestCartas.map(carta => `
        <button class="memotest-carta ${carta.volteada || carta.encontrada ? 'volteada' : ''} ${carta.encontrada ? 'encontrada' : ''}"
                data-id="${carta.id}" type="button" ${carta.encontrada ? 'disabled' : ''}>
            <span class="memotest-carta-cara">${carta.volteada || carta.encontrada ? carta.emoji : '❔'}</span>
        </button>
    `).join('');

    tablero.querySelectorAll('.memotest-carta').forEach(boton => {
        boton.addEventListener('click', () => voltearCarta(Number(boton.dataset.id)));
    });
}

function voltearCarta(id) {
    if (memotestBloqueado) return;
    const carta = memotestCartas.find(c => c.id === id);
    if (!carta || carta.volteada || carta.encontrada) return;

    carta.volteada = true;
    memotestSeleccion.push(carta);
    renderMemotest();

    if (memotestSeleccion.length === 2) {
        memotestMovimientos++;
        actualizarMovimientos();
        memotestBloqueado = true;

        const [a, b] = memotestSeleccion;
        if (a.emoji === b.emoji) {
            a.encontrada = true;
            b.encontrada = true;
            memotestSeleccion = [];
            memotestBloqueado = false;
            renderMemotest();
            verificarVictoriaMemotest();
        } else {
            setTimeout(() => {
                a.volteada = false;
                b.volteada = false;
                memotestSeleccion = [];
                memotestBloqueado = false;
                renderMemotest();
            }, 800);
        }
    }
}

function verificarVictoriaMemotest() {
    if (!memotestCartas.every(c => c.encontrada)) return;
    const mensaje = document.getElementById('memotest-ganaste');
    if (mensaje) {
        mensaje.textContent = `🎉 ¡Ganaste en ${memotestMovimientos} movimientos!`;
        mensaje.hidden = false;
    }
}

/* ---------- TRIVIA DE CORRIENTES ---------- */

const PREGUNTAS_TRIVIA = [
    {
        pregunta: '¿Cómo se llama el famoso carnaval de Corrientes?',
        opciones: ['Carnaval del País', 'Carnaval de Río', 'Fiesta de la Vendimia', 'Carnaval Correntino'],
        correcta: 0
    },
    {
        pregunta: '¿Qué río bordea la ciudad de Corrientes?',
        opciones: ['Uruguay', 'Paraná', 'Bermejo', 'Iguazú'],
        correcta: 1
    },
    {
        pregunta: '¿Cómo se llama el género musical típico del litoral correntino?',
        opciones: ['Cuarteto', 'Chacarera', 'Chamamé', 'Zamba'],
        correcta: 2
    },
    {
        pregunta: '¿Qué animal es un símbolo típico de los esteros del Iberá?',
        opciones: ['Pingüino', 'Yacaré', 'Camello', 'Oso panda'],
        correcta: 1
    },
    {
        pregunta: '¿Cómo se llaman los famosos humedales de la provincia de Corrientes?',
        opciones: ['Cataratas del Iguazú', 'Valle de la Luna', 'Esteros del Iberá', 'Salinas Grandes'],
        correcta: 2
    },
    {
        pregunta: '¿Con qué ciudad conecta el Puente General Belgrano, cruzando el río Paraná?',
        opciones: ['Resistencia', 'Posadas', 'Formosa', 'Santa Fe'],
        correcta: 0
    }
];

let triviaIndice = 0;
let triviaPuntaje = 0;

function iniciarTrivia() {
    triviaIndice = 0;
    triviaPuntaje = 0;
    renderPreguntaTrivia();
}

function renderPreguntaTrivia() {
    const contenedor = document.getElementById('trivia-contenido');
    if (!contenedor) return;

    if (triviaIndice >= PREGUNTAS_TRIVIA.length) {
        contenedor.innerHTML = `
            <p class="minijuego-ganaste">🎉 ¡Terminaste! Puntaje: ${triviaPuntaje} de ${PREGUNTAS_TRIVIA.length}</p>
            <button id="trivia-jugar-de-nuevo" class="minijuego-btn-secundario" type="button">Jugar de nuevo</button>
        `;
        document.getElementById('trivia-jugar-de-nuevo')?.addEventListener('click', iniciarTrivia);
        return;
    }

    const actual = PREGUNTAS_TRIVIA[triviaIndice];
    contenedor.innerHTML = `
        <div class="minijuego-toolbar">
            <span>Pregunta ${triviaIndice + 1} de ${PREGUNTAS_TRIVIA.length}</span>
            <span>Puntaje: ${triviaPuntaje}</span>
        </div>
        <p class="trivia-pregunta">${actual.pregunta}</p>
        <div class="trivia-opciones">
            ${actual.opciones.map((opcion, indice) => `
                <button class="trivia-opcion" data-indice="${indice}" type="button">${opcion}</button>
            `).join('')}
        </div>
    `;

    contenedor.querySelectorAll('.trivia-opcion').forEach(boton => {
        boton.addEventListener('click', () => responderTrivia(Number(boton.dataset.indice), actual, contenedor));
    });
}

function responderTrivia(indiceElegido, pregunta, contenedor) {
    const esCorrecta = indiceElegido === pregunta.correcta;
    if (esCorrecta) triviaPuntaje++;

    contenedor.querySelectorAll('.trivia-opcion').forEach((boton, indice) => {
        boton.disabled = true;
        if (indice === pregunta.correcta) boton.classList.add('trivia-opcion-correcta');
        else if (indice === indiceElegido) boton.classList.add('trivia-opcion-incorrecta');
    });

    setTimeout(() => {
        triviaIndice++;
        renderPreguntaTrivia();
    }, 900);
}

/* ---------- TA-TE-TI ---------- */

let tatetiTablero = [];
let tatetiTurno = '❌';
let tatetiFinalizado = false;

const COMBINACIONES_GANADORAS = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

function iniciarTateti() {
    tatetiTablero = Array(9).fill(null);
    tatetiTurno = '❌';
    tatetiFinalizado = false;

    const resultado = document.getElementById('tateti-resultado');
    if (resultado) resultado.hidden = true;

    actualizarTurno();
    renderTateti();
}

function actualizarTurno() {
    const turnoEl = document.getElementById('tateti-turno');
    if (turnoEl) turnoEl.textContent = `Turno: ${tatetiTurno}`;
}

function renderTateti() {
    const tablero = document.getElementById('tateti-tablero');
    if (!tablero) return;

    tablero.innerHTML = tatetiTablero.map((valor, indice) => `
        <button class="tateti-celda" data-indice="${indice}" type="button" ${valor ? 'disabled' : ''}>${valor || ''}</button>
    `).join('');

    tablero.querySelectorAll('.tateti-celda').forEach(boton => {
        boton.addEventListener('click', () => jugarTateti(Number(boton.dataset.indice)));
    });
}

function jugarTateti(indice) {
    if (tatetiFinalizado || tatetiTablero[indice]) return;

    tatetiTablero[indice] = tatetiTurno;
    renderTateti();

    const ganador = obtenerGanadorTateti();
    if (ganador) {
        tatetiFinalizado = true;
        mostrarResultadoTateti(`🎉 ¡Ganó ${ganador}!`);
        return;
    }

    if (tatetiTablero.every(celda => celda)) {
        tatetiFinalizado = true;
        mostrarResultadoTateti('🤝 ¡Empate!');
        return;
    }

    tatetiTurno = tatetiTurno === '❌' ? '⭕' : '❌';
    actualizarTurno();
}

function obtenerGanadorTateti() {
    for (const [a, b, c] of COMBINACIONES_GANADORAS) {
        if (tatetiTablero[a] && tatetiTablero[a] === tatetiTablero[b] && tatetiTablero[b] === tatetiTablero[c]) {
            return tatetiTablero[a];
        }
    }
    return null;
}

function mostrarResultadoTateti(texto) {
    const resultado = document.getElementById('tateti-resultado');
    if (resultado) {
        resultado.textContent = texto;
        resultado.hidden = false;
    }
}
