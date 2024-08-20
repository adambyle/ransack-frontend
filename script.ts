// Canvas initialization and resize control.

const elCanvas = <HTMLCanvasElement>document.getElementById("canvas");
const ctx = elCanvas.getContext("2d")!;

function sizeCanvas() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    elCanvas.width = width;
    elCanvas.height = height;
}

sizeCanvas();

window.addEventListener("resize", sizeCanvas);

// Draw loop.

let loopInstance = Date.now();

function draw() {
    const dt = (Date.now() - loopInstance) / 1000;
    loopInstance = Date.now();

    ctx.clearRect(0, 0, elCanvas.width, elCanvas.height);

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, elCanvas.width / 2, elCanvas.height / 2);

    setTimeout(draw, 1000 / 30);
}

draw();

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

let myCoords: Coords;
