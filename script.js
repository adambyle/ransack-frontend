"use strict";
// Location services.
class Coords {
    constructor(lat, lng) {
        this.lat = lat;
        this.lng = lng;
    }
    distanceTo(other) {
        // Haversine formula.
        const earthRadius = 6371e3; // meters
        const phi1 = this.lat * Math.PI / 180;
        const phi2 = other.lat * Math.PI / 180;
        const deltaPhi = (other.lat - this.lat) * Math.PI / 180;
        const deltaLda = (other.lng - this.lng) * Math.PI / 180;
        const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLda / 2) * Math.sin(deltaLda / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = earthRadius * c; // meters
        return distance;
    }
    bearingTo(other) {
        const phi1 = this.lat * Math.PI / 180;
        const phi2 = other.lat * Math.PI / 180;
        const lda1 = this.lng * Math.PI / 180;
        const lda2 = other.lng * Math.PI / 180;
        const y = Math.sin(lda2 - lda1) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) *
                Math.cos(phi2) *
                Math.cos(lda2 - lda1);
        const theta = Math.atan2(y, x);
        return theta;
    }
}
let myCoords = new Coords(0, 0);
let renderCoords = new Coords(0, 0);
let mySpeed = 0;
let myAccuracy = 0;
function geolocationError() {
    alert("Please enable geolocation services and reload the page!");
}
if (!("geolocation" in navigator)) {
    geolocationError();
}
const elRefreshesDebug = document.getElementById("refreshes-debug");
const elCoordsDebug = document.getElementById("coords-debug");
const elOffsetDebug = document.getElementById("offset-debug");
const elAngleDebug = document.getElementById("angle-debug");
let refreshes = 0;
navigator.geolocation.watchPosition(position => {
    refreshes++;
    const newCoords = new Coords(position.coords.latitude, position.coords.longitude);
    elOffsetDebug.innerText = `Offset: ${newCoords.distanceTo(myCoords)}`;
    myCoords = newCoords;
    elCoordsDebug.innerText = `${myCoords.lat} ${myCoords.lng}`;
    elRefreshesDebug.innerText = `Refreshes: ${refreshes}`;
    if (position.coords.speed) {
        mySpeed = position.coords.speed;
    }
    myAccuracy = position.coords.accuracy;
}, geolocationError, { enableHighAccuracy: true, maximumAge: 1000 });
let alpha = 0; // Tip north, + west
let beta = 0; // Screen up, + tipped toward
function activateOrientation() {
    function listenOrientation() {
        addEventListener("deviceorientation", ev => {
            if (ev.alpha) {
                if ("webkitCompassHeading" in ev) {
                    alpha = ev.webkitCompassHeading;
                }
                else {
                    alpha = ev.alpha;
                }
            }
            if (ev.beta) {
                elAngleDebug.innerText = `${ev.beta}`;
                beta = Math.min(90, Math.max(0, ev.beta * 1)) - 90;
            }
        });
    }
    if ("requestPermission" in DeviceOrientationEvent) {
        DeviceOrientationEvent.requestPermission()
            .then(listenOrientation);
    }
    else {
        listenOrientation();
    }
}
Object.assign(window, { activateOrientation });
// Draw loop.
let loopInstance = Date.now();
let xDegreesPerMeter = 0;
let yDegreesPerMeter = 0;
const metersPerGridline = 10;
const gridlineLength = 1;
const mapWidth = 200;
const pxPerMeter = gridlineLength / metersPerGridline;
let inBetweenTime = 0;
let xMetersPerDegree = 0;
let yMetersPerDegree = 0;
function draw() {
    if (xMetersPerDegree == 0) {
        xMetersPerDegree = renderCoords.distanceTo(new Coords(renderCoords.lat, renderCoords.lng + 1));
        xDegreesPerMeter = 1 / xMetersPerDegree;
        yMetersPerDegree = renderCoords.distanceTo(new Coords(renderCoords.lat + 1, renderCoords.lng));
        yDegreesPerMeter = 1 / yMetersPerDegree;
    }
    const drawStart = Date.now();
    const dt = (Date.now() - loopInstance) / 1000;
    loopInstance = Date.now();
    if (renderCoords.lat - myCoords.lat > 10 * xDegreesPerMeter
        || renderCoords.lng - myCoords.lng > 10 * yDegreesPerMeter) {
        renderCoords = myCoords;
    }
    else {
        renderCoords.lat = renderCoords.lat + (myCoords.lat - renderCoords.lat) * dt;
        renderCoords.lng = renderCoords.lng + (myCoords.lng - renderCoords.lng) * dt;
    }
    ctx.clearRect(0, 0, width, height);
    grid();
    inBetweenTime = Date.now();
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
let testStart = Date.now();
let width;
let height;
let xFov;
let yFov;
let xFovLength;
let yFovLength;
const nearPlane = pxPerMeter;
// Canvas initialization and resize control.
const elCanvas = document.getElementById("canvas");
const ctx = elCanvas.getContext("2d");
function sizeCanvas() {
    width = innerWidth;
    height = innerHeight;
    elCanvas.width = width;
    elCanvas.height = height;
    xFov = Math.PI / 4;
    yFov = xFov * height / width;
    xFovLength = 2 * nearPlane * Math.tan(xFov / 2);
    yFovLength = 2 * nearPlane * Math.tan(yFov / 2);
}
sizeCanvas();
addEventListener("resize", sizeCanvas);
// Grid drawing.
function grid() {
    // Useful values.
    const lngOffset = (renderCoords.lat % xDegreesPerMeter) / xDegreesPerMeter * pxPerMeter;
    const latOffset = (renderCoords.lat % yDegreesPerMeter) / yDegreesPerMeter * pxPerMeter;
    console.log((renderCoords.lat % xDegreesPerMeter) / xDegreesPerMeter);
    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;
    const cosAlpha = Math.cos(alphaRad);
    const sinAlpha = Math.sin(alphaRad);
    const cosBeta = Math.cos(betaRad);
    const sinBeta = Math.sin(betaRad);
    const gridlineCount = 20;
    const extreme = gridlineCount * gridlineLength;
    const z = 5 * pxPerMeter;
    const backup = (20 - 80 * sinBeta ** 1) * pxPerMeter;
    // Drawing functions.
    function inFov([gridX, gridY]) {
        let x = gridX;
        let y = gridY;
        // Rotate.
        [x, y] = [
            x * cosAlpha - y * sinAlpha,
            y = x * sinAlpha + y * cosAlpha,
        ];
        // Determine location relative to center of frame of view.
        let fovX = x; // Horizontal distance from the center of the frame of view.
        let fovY = y * cosBeta - z * sinBeta; // Outward distance from viewer.
        let fovZ = -z * cosBeta - y * sinBeta; // Height above viewer.
        fovY += backup;
        return [fovX, fovY, fovZ];
    }
    function point([fovX, fovY, fovZ]) {
        // Project onto the near plane.
        [fovX, fovZ] = [
            fovX * nearPlane / fovY,
            fovZ * nearPlane / fovY,
        ];
        // Expand to canvas.
        let [x, y] = [
            fovX / xFovLength * width,
            fovZ / yFovLength * height,
        ];
        // Flip Y.
        y = -y;
        // Map coordinates to canvas.
        x += width / 2;
        y += height / 2;
        return [x, y];
    }
    function line(startGridX, startGridY, endGridX, endGridY, color) {
        let [startX, startY, startZ] = inFov([startGridX, startGridY]);
        let [endX, endY, endZ] = inFov([endGridX, endGridY]);
        if (startY < nearPlane && endY < nearPlane) {
            return;
        }
        if (startY < nearPlane) {
            const xDif = endX - startX;
            const yDif = endY - startY;
            const zDif = endZ - startZ;
            const recoveryFactor = (yDif - endY + nearPlane) / yDif;
            [startX, startY, startZ] = [
                startX + xDif * recoveryFactor,
                startY + yDif * recoveryFactor,
                startZ + zDif * recoveryFactor,
            ];
        }
        else if (endY < nearPlane) {
            const xDif = startX - endX;
            const yDif = startY - endY;
            const zDif = startZ - endZ;
            const recoveryFactor = (yDif - startY + nearPlane) / yDif;
            [endX, endY, endZ] = [
                endX + xDif * recoveryFactor,
                endY + yDif * recoveryFactor,
                endZ + zDif * recoveryFactor,
            ];
        }
        [startX, startY] = point([startX, startY, startZ]);
        [endX, endY] = point([endX, endY, endZ]);
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
    }
    // ctx.strokeStyle = "white";
    // ctx.beginPath();
    // ctx.arc(width / 2, height / 2, mapWidth, 0, 2 * Math.PI);
    // ctx.stroke();
    // ctx.clip();
    // Grid lines.
    const shadeFactor = 50 - 77 * sinBeta;
    for (let y = -gridlineCount; y <= gridlineCount; y++) {
        const shade = Math.min(255, (gridlineCount - Math.abs(y)) / gridlineCount * shadeFactor);
        const color = `rgb(${shade}, ${shade}, ${shade})`;
        const startGridX = -extreme;
        const startGridY = y * gridlineLength - latOffset;
        const endGridX = extreme;
        const endGridY = y * gridlineLength - latOffset;
        line(startGridX, startGridY, endGridX, endGridY, color);
    }
    for (let x = -gridlineCount; x <= gridlineCount; x++) {
        const shade = Math.min(255, (gridlineCount - Math.abs(x)) / gridlineCount * shadeFactor);
        const color = `rgb(${shade}, ${shade}, ${shade})`;
        const startGridX = x * gridlineLength - lngOffset;
        const startGridY = -extreme;
        const endGridX = x * gridlineLength - lngOffset;
        const endGridY = extreme;
        line(startGridX, startGridY, endGridX, endGridY, color);
    }
    // Player dot.
    ctx.strokeStyle = "red";
    ctx.beginPath();
    const playerFovLoc = inFov([0, 0]);
    if (playerFovLoc[1] > 0) {
        const [x, y] = point(playerFovLoc);
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.stroke();
    }
}
draw();
