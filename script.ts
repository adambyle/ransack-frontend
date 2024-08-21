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

// navigator.geolocation.watchPosition(position => {
//     refreshes++;
//     const newCoords = new Coords(position.coords.latitude, position.coords.longitude);
//     elOffsetDebug.innerText = `Offset: ${newCoords.distanceTo(myCoords)}`
//     myCoords = newCoords;
//     elCoordsDebug.innerText = `${myCoords.lat} ${myCoords.lng}`;
//     elRefreshesDebug.innerText = `Refreshes: ${refreshes}`;
//     if (position.coords.speed) {
//         mySpeed = position.coords.speed;
//     }
//     myAccuracy = position.coords.accuracy;
// }, geolocationError, { enableHighAccuracy: true, maximumAge: 1000 });

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
                while (beta < 0) {
                    beta += 360;
                }
                beta -= 90;
                beta = Math.min(-90, Math.max(beta, 0));
            }
        });
    }

    // if ("requestPermission" in DeviceOrientationEvent) {
    //     (<any>DeviceOrientationEvent).requestPermission()
    //         .then(listenOrientation);
    // } else {
    //     listenOrientation();
    // }
}

Object.assign(window, { activateOrientation });

// Draw loop.

let loopInstance = Date.now();

let xDegreesPerMeter = 0;
let yDegreesPerMeter = 0;

const metersPerGridline = 10;
const gridlineLength = 1;
const mapWidth = 300;
const pxPerMeter = gridlineLength / metersPerGridline;

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

const nearPlane = pxPerMeter;
const xFov = Math.PI / 4;
const yFov = xFov * elCanvas.height / elCanvas.width;
const xFovLength = 2 * nearPlane * Math.tan(xFov / 2);
const yFovLength = 2 * nearPlane * Math.tan(yFov / 2);
let showPerspective = false;

function grid() {
    // Useful values.

    const lngOffset = (renderCoords.lat % xDegreesPerMeter) / xDegreesPerMeter * pxPerMeter;
    const latOffset = (renderCoords.lat % yDegreesPerMeter) / xDegreesPerMeter * pxPerMeter;

    const alphaRad = alpha * Math.PI / 180;
    const betaRad = beta * Math.PI / 180;

    const gridlineCount = 40;

    const extreme = gridlineCount * gridlineLength;

    const z = (5 - 45 * Math.sin(betaRad) ** 1) * pxPerMeter;
    const backup = 20 * pxPerMeter;

    // Drawing functions.

    function inFov(
        [gridX, gridY]: [number, number],
    ): [number, number, number] {
        let x = gridX;
        let y = gridY;

        // Offset based on player position.
        x += lngOffset;
        y += latOffset;

        // Rotate.
        [x, y] = [
            x * Math.cos(alphaRad) - y * Math.sin(alphaRad),
            y = x * Math.sin(alphaRad) + y * Math.cos(alphaRad),
        ];

        // Determine location relative to center of frame of view.
        let fovX = x; // Horizontal distance from the center of the frame of view.
        let fovY = y * Math.cos(betaRad) - z * Math.sin(betaRad); // Outward distance from viewer.
        let fovZ = -z * Math.cos(betaRad) - y * Math.sin(betaRad); // Height above viewer.

        fovY += backup;

        return [fovX, fovY, fovZ];
    }

    function point(
        [fovX, fovY, fovZ]: [number, number, number]
    ): [number, number] {
        // Project onto the near plane.
        [fovX, fovZ] = [
            fovX * nearPlane / fovY,
            fovZ * nearPlane / fovY,
        ];

        // Expand to canvas.
        let [x, y] = [
            fovX / xFovLength * elCanvas.width,
            fovZ / yFovLength * elCanvas.height,
        ];
        
        // Flip Y.
        y = -y;

        // Map coordinates to canvas.
        x += elCanvas.width / 2;
        y += elCanvas.height / 2;

        return [x, y];
    }

    function line(
        startGridX: number,
        startGridY: number,
        endGridX: number,
        endGridY: number,
        color: string,
    ) {
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
        } else if (endY < nearPlane) {
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

    // Grid lines.

    const shadeFactor = 50 - 77 * Math.sin(betaRad);

    for (let y = -gridlineCount; y <= gridlineCount; y++) {
        const shade = Math.min(255, (gridlineCount - Math.abs(y)) / gridlineCount * shadeFactor);
        const color = `rgb(${shade}, ${shade}, ${shade})`;

        const startGridX = -extreme;
        const startGridY = y * gridlineLength;
        const endGridX = extreme;
        const endGridY = y * gridlineLength;

        line(startGridX, startGridY, endGridX, endGridY, color );
    }

    for (let x = -gridlineCount; x <= gridlineCount; x++) {
        const shade = Math.min(255, (gridlineCount - Math.abs(x)) / gridlineCount * shadeFactor);
        const color = `rgb(${shade}, ${shade}, ${shade})`;

        const startGridX = x * gridlineLength;
        const startGridY = -extreme;
        const endGridX = x * gridlineLength;
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

document.addEventListener("keydown", ev => {
    if (ev.key == "ArrowDown") {
        beta -= 2;
    } else if (ev.key == "ArrowUp") {
        beta += 2;
    } else if (ev.key == "ArrowLeft") {
        alpha -= 2;
    } else if (ev.key == "ArrowRight") {
        alpha += 2;
    } else if (ev.key == " ") {
        showPerspective = !showPerspective;
    }
});
