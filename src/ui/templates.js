// src/ui/templates.js

export const feedCardTemplate = (lugar, isFav, catIcon, colorClass, imgUrl, cardClass, distanciaTxt) => `
    <div class="${cardClass}" onclick="event.target.closest('.card-fav-btn') ? toggleFavorite('${lugar.nombre}') : abrirFichaNombre('${lugar.nombre}')">
        <img src="${imgUrl}" loading="lazy" alt="${lugar.nombre}">
        <div class="card-gradient"></div>
        <span class="card-badge-cat ${colorClass}">
            <ion-icon name="${catIcon}"></ion-icon> 
            ${lugar.categoria.split(' ')[0]}
        </span>
        ${distanciaTxt}
        <button class="card-fav-btn ${isFav ? 'active' : ''}">
            <ion-icon name="${isFav ? 'heart' : 'heart-outline'}"></ion-icon>
        </button>
        <div class="card-info-box">
            <h3>${lugar.nombre}</h3>
            <div class="card-actions-mini">
                <span onclick="event.stopPropagation(); abrirFichaNombre('${lugar.nombre}')">
                    <ion-icon name="information-circle"></ion-icon> Ver
                </span>
                <span onclick="event.stopPropagation(); cambiarTab('map'); setTimeout(()=>window.stateMapFlyTo(${lugar.lat},${lugar.lng}),300)">
                    <ion-icon name="map"></ion-icon> Mapa
                </span>
            </div>
        </div>
    </div>
`;

export const fichaLugarTemplate = (lugar, isFav, bgStyle, heroHeightStyle, parkingDispoHTML, lineasHTML, audioGuiaHTML, menuHTML) => `
    <div class="sheet-grabber"></div>
    <div class="ficha-hero" style="${heroHeightStyle}">
        ${bgStyle}
        <button class="btn-back-float" onclick="cerrarFicha()"><ion-icon name="close"></ion-icon></button>
        <button class="btn-fav-float ${isFav ? 'active' : ''}" onclick="toggleFavorite('${lugar.nombre}')">
            <ion-icon name="${isFav ? 'heart' : 'heart-outline'}"></ion-icon>
        </button>
    </div>
    <div class="ficha-content">
        <div class="ficha-header">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span class="tag-cat">${lugar.categoria.split(' ')[0]}</span>
                ${lugar.destacado ? '<span class="tag-top">⭐ TOP</span>' : ''}
            </div>
            <h1>${lugar.nombre}</h1>
            <p>${lugar.desc || 'Explora este lugar increíble.'}</p>
            ${audioGuiaHTML}
        </div>
        
        ${parkingDispoHTML}
        ${lineasHTML}

        <div class="action-grid" style="margin-top: 15px;">
            <button onclick="iniciarRuta('ficha')" class="btn-action primary"><ion-icon name="navigate"></ion-icon> IR AHORA</button>
            <button onclick="compartirLugar('${lugar.nombre}')" class="btn-action secondary"><ion-icon name="share-social"></ion-icon></button>
            ${lugar.wp ? `<a href="https://wa.me/${lugar.wp}" target="_blank" class="btn-action whatsapp"><ion-icon name="logo-whatsapp"></ion-icon></a>` : ''}
        </div>
        ${menuHTML}
        <button id="btn-checkin-dynamic" onclick="triggerCheckIn()" class="btn-checkin-big disabled">
            <ion-icon name="radio"></ion-icon> <span>Ubicando...</span>
        </button>
        <input type="file" id="foto-checkin" accept="image/*" capture="environment" style="display:none" onchange="procesarFotoCheckin(this)">
        <div class="comments-section">
            <h3>Reseñas</h3>
            <div class="review-input-box">
                <input type="text" id="input-review" placeholder="Deja tu opinión...">
                <button onclick="enviarComentario()"><ion-icon name="send"></ion-icon></button>
            </div>
            <div id="lista-comentarios">Cargando...</div>
        </div>
    </div>
`;

export const couponTemplate = (puntosUser, p, puede) => `
    <div class="coupon-card ${puede ? '' : 'disabled'}">
        <div class="coupon-left">
            <span class="coupon-cost">${p.costo} PTS</span>
            <h3>${p.nombre}</h3>
        </div>
        <button class="coupon-btn" onclick="canjearPremio(${p.id})">${puede ? 'CANJEAR' : 'FALTA'}</button>
    </div>
`;