/* ==========================================
   DIBUJO DE RUTA TEMÁTICA EN EL MAPA - src/map/routing/rutaTematicaRenderer.js
   Conecta los lugares de una ruta temática con una línea punteada + pines
   numerados. Deliberadamente distinto del trazado de routingService.js
   (línea sólida azul, sigue las calles vía OSRM): acá es una línea recta
   violeta punteada, porque es un orden sugerido de paradas, no una
   indicación de manejo turno a turno.
   ========================================== */

let capasRutaTematica = [];

export function limpiarRutaTematica(mapa) {
    capasRutaTematica.forEach((capa) => mapa.removeLayer(capa));
    capasRutaTematica = [];
}

// lugares: array de { nombre, lat, lng } en el orden de la ruta.
export function dibujarRutaTematica(mapa, lugares) {
    limpiarRutaTematica(mapa);

    const coords = lugares.map((l) => [l.lat, l.lng]);
    if (coords.length < 2) return;

    const linea = L.polyline(coords, {
        color: '#af52de',
        weight: 4,
        opacity: 0.85,
        dashArray: '2, 10',
        lineCap: 'round',
    }).addTo(mapa);
    capasRutaTematica.push(linea);

    lugares.forEach((lugar, i) => {
        const numeroIcon = L.divIcon({
            className: 'ruta-tematica-pin',
            html: `<div class="ruta-tematica-pin-circulo">${i + 1}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
        });
        const marker = L.marker([lugar.lat, lugar.lng], { icon: numeroIcon, zIndexOffset: 700 }).addTo(mapa);
        marker.bindTooltip(lugar.nombre, { direction: 'top', offset: [0, -16] });
        capasRutaTematica.push(marker);
    });

    mapa.fitBounds(linea.getBounds(), { padding: [50, 50] });
}
