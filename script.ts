// Canvas initialization and resize control.

const elCanvas = <HTMLCanvasElement>document.getElementById("canvas");
const ctx = elCanvas.getContext("2d")!;

function sizeCanvas() {
    const width = innerWidth;
    const height = innerHeight;

    elCanvas.width = width;
    elCanvas.height = height;
}

sizeCanvas();

addEventListener("resize", sizeCanvas);

// Location services.

class Coords {
    lat: number;
    lng: number;

    constructor(lat: number, lng: number) {
        this.lat = lat;
        this.lng = lng;
    }

    distanceTo(other: Coords): number {
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

    bearingTo(other: Coords): number {
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

let myCoords: Coords = new Coords(0, 0);
let renderCoords: Coords = new Coords(0, 0);
let mySpeed = 0;
let myAccuracy = 0;

function geolocationError() {
    alert("Please enable geolocation services and reload the page!");
}

if (!("geolocation" in navigator)) {
    geolocationError();
}

const elRefreshesDebug = <HTMLParagraphElement>document.getElementById("refreshes-debug");
const elCoordsDebug = <HTMLParagraphElement>document.getElementById("coords-debug");
const elOffsetDebug = <HTMLParagraphElement>document.getElementById("offset-debug");

let refreshes = 0;

navigator.geolocation.watchPosition(position => {
    refreshes++;
    const newCoords = new Coords(position.coords.latitude, position.coords.longitude);
    elOffsetDebug.innerText = `Offset: ${newCoords.distanceTo(myCoords)}`
    myCoords = newCoords;
    elCoordsDebug.innerText = `${myCoords.lat} ${myCoords.lng}`;
    elRefreshesDebug.innerText = `Refreshes: ${refreshes}`;
    if (position.coords.speed) {
        mySpeed = position.coords.speed;
    }
    myAccuracy = position.coords.accuracy;
}, geolocationError, { enableHighAccuracy: true, maximumAge: 1000 });

let alpha: number = 0; // Tip north, + west
let beta: number = 0; // Screen up, + tipped toward

function activateOrientation() {
    function listenOrientation() {
        addEventListener("deviceorientation", ev => {
            if (ev.alpha) {
                if ("webkitCompassHeading" in ev) {
                    alpha = <number>ev.webkitCompassHeading;
                } else {
                    alpha = ev.alpha;
                }
            }
            if (ev.beta) {
                beta = ev.beta;
            }
        });
    }

    if ("requestPermission" in DeviceOrientationEvent) {
        (<any>DeviceOrientationEvent).requestPermission()
            .then(listenOrientation);
    } else {
        listenOrientation();
    }
}

Object.assign(window, { activateOrientation });

// Draw loop.

let loopInstance = Date.now();

let xDegreesPerMeter = 0;
let yDegreesPerMeter = 0;

const gridSpacing = 100;
const gridlineLength = 10;

function draw() {
    const dt = (Date.now() - loopInstance) / 1000;
    loopInstance = Date.now();

    const xMetersPerDegree = renderCoords.distanceTo(
        new Coords(renderCoords.lat, renderCoords.lng + 1));
    xDegreesPerMeter = 1 / xMetersPerDegree;
    const yMetersPerDegree = renderCoords.distanceTo(
        new Coords(renderCoords.lat + 1, renderCoords.lng));
    yDegreesPerMeter = 1 / yMetersPerDegree;

    if (renderCoords.lat - myCoords.lat > xDegreesPerMeter * gridlineLength * 10
        || renderCoords.lng - myCoords.lng > yDegreesPerMeter * gridlineLength * 10
    ) {
        renderCoords = myCoords;
    } else {
        renderCoords.lat = renderCoords.lat + (myCoords.lat - renderCoords.lat) * dt;
        renderCoords.lng = renderCoords.lng + (myCoords.lng - renderCoords.lng) * dt;
    }

    ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);

    grid();

    setTimeout(draw, 1000 / 30);
}

let testStart = Date.now();

function grid() {
    ctx.strokeStyle = "gray";

    const lngOffset = (renderCoords.lng % (xDegreesPerMeter * gridlineLength)) / (xDegreesPerMeter * gridlineLength) * gridSpacing;
    const latOffset = (renderCoords.lat % (yDegreesPerMeter * gridlineLength)) / (yDegreesPerMeter * gridlineLength) * gridSpacing;
    console.log(renderCoords.lng, xDegreesPerMeter, gridSpacing);

    const alphaRad = -alpha * Math.PI / 180;
    const betaRad = Math.max(0, beta * Math.PI / 180);

    const lineExtreme = 10 * Math.max(elCanvas.width, elCanvas.height);

    function point([x, y]: [number, number]): [number, number] {
        let x2 = x * Math.cos(alphaRad) - y * Math.sin(alphaRad);
        let y2 = y * Math.cos(alphaRad) + x * Math.sin(alphaRad);
        y2 *= Math.cos(betaRad);

        return [x2, y2];
    }

    ctx.beginPath();

    for (let xFactor = -20; xFactor <= 20; xFactor++) {
        let lineX = gridSpacing * xFactor - lngOffset;

        let [startX, startY] = point([lineX, -lineExtreme]);
        let [endX, endY] = point([lineX, lineExtreme]);

        startX += elCanvas.width / 2;
        endX += elCanvas.width / 2;
        startY += elCanvas.height / 2;
        endY += elCanvas.height / 2;

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    }

    for (let yFactor = -20; yFactor <= 20; yFactor++) {
        let lineY = gridSpacing * yFactor - latOffset;

        let [startX, startY] = point([-lineExtreme, lineY]);
        let [endX, endY] = point([lineExtreme, lineY]);

        startX += elCanvas.width / 2;
        endX += elCanvas.width / 2;
        startY += elCanvas.height / 2;
        endY += elCanvas.height / 2;

        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
    }

    ctx.stroke();

    ctx.strokeStyle = "red";
    ctx.beginPath();
    ctx.arc(elCanvas.width / 2, elCanvas.height / 2, 10, 0, 2 * Math.PI);
    ctx.stroke();
}

draw();
