/* ==========================================
   DEEP LINKS DE TRANSPORTE - src/map/transporte/deepLinks.js
   Abre Uber/DiDi con el destino pre-cargado. No dependen de ningún backend
   propio: son enlaces que arma el propio cliente con lat/lng.
   ========================================== */
import { showToast } from '../../utils/helpers.js';

// Universal link de Uber: si la app está instalada, el sistema operativo la
// abre directo con el viaje pre-cargado; si no, cae solo al fallback web
// (m.uber.com), sin necesitar detectar nada del lado nuestro.
export function abrirUber(lat, lng, nombreDestino) {
    const url = `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${lat}&dropoff[longitude]=${lng}&dropoff[nickname]=${encodeURIComponent(nombreDestino)}`;
    window.open(url, '_blank', 'noopener');
}

// DiDi no tiene un universal link web estable y público como Uber; el
// esquema nativo (didi://) sí funciona en Android/iOS con la app instalada,
// pero no hay evento de error para saber si falló, así que se avisa con un
// toast solo si seguimos en la página después de un instante (indicio de
// que el sistema operativo no encontró ninguna app para abrir el esquema).
export function abrirDiDi(lat, lng) {
    const url = `didi://global?product=moto&lat=${lat}&lng=${lng}`;
    window.location.href = url;
    setTimeout(() => {
        if (document.hasFocus()) {
            showToast('⚠️ No encontramos la app de DiDi instalada');
        }
    }, 1200);
}
