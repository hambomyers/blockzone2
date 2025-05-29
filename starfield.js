/**
 * starfield.js - Scientifically accurate night sky for Charlottesville, VA
 * 
 * Secret easter egg: Hold S+T+A+R keys on menu screen
 * Shows the actual stars visible from Charlottesville at current date/time
 * 
 * Uses Yale Bright Star Catalog subset for performance
 * Includes Milky Way, deep sky objects, and accurate star colors
 */

// Charlottesville, VA coordinates
const OBSERVER_LAT = 38.0293; // degrees N
const OBSERVER_LON = -78.4767; // degrees W (negative for west)

// Comprehensive star catalog with proper names
// Format: [RA (hours), Dec (degrees), Magnitude, ColorIndex, Name]
const STAR_CATALOG = [
    // MAGNITUDE -2 to 0: The brightest stars
    [6.75, -16.71, -1.46, 0.0, "Sirius"],         // Alpha Canis Majoris
    [6.40, -52.70, -0.72, 0.23, "Canopus"],       // Alpha Carinae
    [14.26, 19.18, -0.04, 1.23, "Arcturus"],      // Alpha Bootis
    [5.24, -8.20, 0.13, -0.03, "Rigel"],          // Beta Orionis
    [18.62, 38.78, 0.03, 0.08, "Vega"],           // Alpha Lyrae
    [7.66, 28.03, 0.08, 0.60, "Procyon"],         // Alpha Canis Minoris
    [5.92, 7.41, 0.45, 1.85, "Betelgeuse"],       // Alpha Orionis
    [19.85, 8.87, 0.76, 0.22, "Altair"],          // Alpha Aquilae
    [4.60, 16.51, 0.85, 1.54, "Aldebaran"],       // Alpha Tauri
    [16.49, -26.43, 0.91, 1.15, "Antares"],       // Alpha Scorpii
    [14.85, -60.84, 0.01, 0.71, "Alpha Centauri"], // Rigil Kentaurus
    [12.27, -63.10, 0.77, -0.24, "Acrux"],        // Alpha Crucis
    [5.28, 45.94, 0.08, -0.19, "Capella"],        // Alpha Aurigae
    
    // MAGNITUDE 0 to 1: Very bright stars
    [13.42, -11.16, 0.97, -0.23, "Spica"],        // Alpha Virginis
    [7.64, 5.23, 1.14, -0.11, "Pollux"],          // Beta Geminorum
    [20.41, 45.28, 1.25, 0.09, "Deneb"],          // Alpha Cygni
    [10.14, 11.97, 1.35, 0.08, "Regulus"],        // Alpha Leonis
    [12.69, -59.69, 1.33, -0.24, "Gacrux"],       // Gamma Crucis
    [1.98, 29.58, 1.65, 1.17, "Hamal"],           // Alpha Arietis
    [12.90, 38.32, 1.14, 1.59, "Alioth"],         // Epsilon Ursae Majoris
    [5.60, -1.20, 1.69, -0.22, "Alnilam"],        // Epsilon Orionis
    [5.68, -1.94, 1.77, -0.24, "Alnitak"],        // Zeta Orionis
    [5.42, -0.30, 1.64, -0.21, "Mintaka"],        // Delta Orionis
    [23.06, 15.21, 1.16, 0.09, "Alpheratz"],      // Alpha Andromedae
    [2.07, 23.46, 1.65, 1.01, "Mirach"],          // Beta Andromedae
    [2.53, 89.26, 1.97, 0.60, "Polaris"],         // Alpha Ursae Minoris
    [3.41, 49.86, 1.79, 0.03, "Mirfak"],          // Alpha Persei
    [7.41, 27.93, 1.93, 0.89, "Castor"],          // Alpha Geminorum
    
    // MAGNITUDE 1 to 2: Bright stars
    [10.90, 61.75, 1.77, 0.03, "Dubhe"],          // Alpha Ursae Majoris
    [11.06, 56.38, 1.79, 1.14, "Merak"],          // Beta Ursae Majoris
    [0.66, 56.54, 2.27, 1.03, "Schedar"],         // Alpha Cassiopeiae
    [0.14, 59.15, 2.23, -0.05, "Caph"],           // Beta Cassiopeiae
    [13.79, 49.31, 1.85, 0.08, "Alkaid"],         // Eta Ursae Majoris
    [6.98, -27.93, 2.00, -0.12, "Wezen"],         // Delta Canis Majoris
    [7.14, -26.39, 1.50, 0.45, "Adhara"],         // Epsilon Canis Majoris
    [8.38, -59.51, 2.25, 1.20, "Avior"],          // Epsilon Carinae
    [14.06, 64.38, 2.08, 1.83, "Kochab"],         // Beta Ursae Minoris
    [12.93, 55.96, 1.86, -0.19, "Phecda"],        // Gamma Ursae Majoris
    [15.74, 26.71, 2.22, 1.24, "Alphecca"],       // Alpha Coronae Borealis
    [1.16, 35.62, 2.00, 0.48, "Almach"],          // Gamma Andromedae
    [11.82, 53.69, 2.37, 0.09, "Megrez"],         // Delta Ursae Majoris
    [12.26, 57.03, 2.27, 0.02, "Alioth"],         // Epsilon Ursae Majoris
    [11.90, 53.69, 2.44, 0.08, "Megrez"],         // Delta Ursae Majoris
    
    // MAGNITUDE 2 to 3: Visible constellation stars
    [5.66, -34.07, 2.60, -0.22, "Saiph"],         // Kappa Orionis
    [5.79, -9.67, 2.77, -0.17, "Bellatrix"],      // Gamma Orionis
    [21.31, 62.59, 2.48, 0.02, "Alderamin"],      // Alpha Cephei
    [16.24, 61.51, 2.74, 1.04, "Eltanin"],        // Gamma Draconis
    [22.96, -29.62, 2.39, 0.98, "Fomalhaut"],     // Alpha Piscis Austrini
    [3.08, 40.96, 2.06, 1.37, "Almach"],          // Gamma Andromedae
    [5.41, 49.86, 2.65, -0.05, "Menkalinan"],     // Beta Aurigae
    [15.58, 40.39, 2.63, 0.04, "Gemma"],          // Alpha Coronae Borealis
    [19.51, 27.96, 2.71, 0.14, "Sadr"],           // Gamma Cygni
    [17.15, -10.18, 2.43, 0.16, "Sabik"],         // Eta Ophiuchi
    [4.33, 15.97, 2.87, 0.09, "Alcyone"],         // Eta Tauri (Pleiades)
    [8.74, 18.40, 2.85, 1.17, "Alphard"],         // Alpha Hydrae
    [3.79, 24.11, 2.87, 0.09, "Atlas"],           // 27 Tauri (Pleiades)
    [7.58, 28.03, 2.88, 0.34, "Mebsuta"],         // Epsilon Geminorum
    [22.69, 10.83, 2.95, 0.85, "Sadalsuud"],      // Beta Aquarii
    
    // MAGNITUDE 3 to 4: Fainter constellation stars
    [0.85, 60.72, 3.35, 0.11, "Segin"],           // Epsilon Cassiopeiae
    [1.43, 60.24, 3.66, -0.20, "Ruchbah"],        // Delta Cassiopeiae
    [2.29, 67.41, 3.46, 0.38, "Gamma Cephei"],    // Gamma Cephei
    [3.89, 31.88, 3.27, 1.58, "Atik"],            // Omicron Persei
    [4.95, 33.17, 3.76, -0.09, "Epsilon Persei"], // Epsilon Persei
    [5.53, -0.64, 3.69, -0.25, "Pi3 Orionis"],    // Pi3 Orionis
    [6.41, 9.89, 3.54, 0.43, "Mu Geminorum"],     // Mu Geminorum
    [7.04, 20.57, 3.58, -0.11, "Wasat"],          // Delta Geminorum
    [7.82, 28.89, 3.79, 0.34, "Kappa Geminorum"], // Kappa Geminorum
    [9.46, -8.66, 3.11, 1.71, "Ukdah"],           // Iota Hydrae
    [10.12, -18.30, 3.91, 0.48, "Nu Hydrae"],     // Nu Hydrae
    [10.83, 34.21, 3.52, 0.00, "Lambda Leonis"],  // Lambda Leonis
    [11.24, 15.43, 3.32, 0.43, "Epsilon Leonis"], // Epsilon Leonis
    [11.82, 14.57, 3.85, 0.09, "Zavijava"],       // Beta Virginis
    [13.02, 10.96, 3.73, -0.11, "Zaniah"],        // Eta Virginis
    [14.85, 74.16, 3.17, 0.96, "Pherkad"],        // Gamma Ursae Minoris
    [15.23, 40.39, 3.49, 0.04, "Nusakan"],        // Beta Coronae Borealis
    [16.31, 61.51, 3.04, 1.40, "Rastaban"],       // Beta Draconis
    [17.94, 51.49, 3.24, 0.08, "Dziban"],         // Psi Draconis
    [18.35, 39.40, 3.89, 0.44, "Sheliak"],        // Beta Lyrae
    [20.37, 14.64, 3.77, 0.85, "Sualocin"],       // Alpha Delphini
    [21.26, 10.13, 3.95, 0.46, "Theta Aquarii"],  // Theta Aquarii
    
    // MAGNITUDE 4 to 5: Background field stars (many unnamed)
    [0.40, 56.79, 4.54, 0.00, null],
    [1.25, 60.14, 4.63, 0.57, null],
    [2.02, 72.42, 4.29, 0.43, "Iota Cephei"],
    [2.53, 55.90, 4.62, 0.14, null],
    [3.24, 59.94, 4.98, -0.08, null],
    [3.72, 47.79, 4.35, 0.01, null],
    [4.01, 62.32, 4.80, 0.42, null],
    [4.57, 53.51, 4.89, -0.10, null],
    [5.02, 43.82, 4.14, -0.17, "Nu Aurigae"],
    [5.41, 49.23, 4.76, 0.90, null],
    [5.79, 54.28, 4.55, 0.05, null],
    [6.23, 22.51, 4.66, 0.89, null],
    [6.55, 21.98, 4.89, 0.34, null],
    [7.18, 24.40, 4.48, 0.09, "Propus"],
    [7.57, 37.25, 4.60, 0.93, null],
    [8.12, 17.65, 4.91, -0.01, null],
    [8.78, 28.76, 4.67, 0.11, null],
    [9.31, 9.18, 4.45, 0.44, null],
    [9.88, 16.76, 4.83, 0.52, null],
    [10.33, 19.84, 4.48, 0.01, "31 Leonis"],
    [10.89, 20.52, 4.84, 0.31, null],
    [11.53, 53.69, 4.56, 0.09, null],
    [12.15, 57.03, 4.74, 0.02, null],
    [12.69, 38.32, 4.26, 0.00, null],
    [13.29, 54.93, 4.67, 0.59, null],
    [13.79, 18.40, 4.97, 0.28, null],
    [14.27, 38.31, 4.64, 0.06, null],
    [14.84, 29.58, 4.82, 0.95, null],
    [15.39, 36.64, 4.73, 0.02, null],
    [15.94, 47.46, 4.59, 1.15, null],
    [16.52, 38.92, 4.65, 0.17, null],
    [17.10, 54.47, 4.57, 0.91, null],
    [17.65, 46.00, 4.87, 0.97, null],
    [18.21, 2.90, 4.62, 0.00, null],
    [18.87, 36.90, 4.44, -0.03, null],
    [19.42, 30.15, 4.82, 0.13, null],
    [19.95, 35.08, 4.49, 1.02, null],
    [20.52, 49.23, 4.73, 0.69, null],
    [21.04, 43.93, 4.94, 0.35, null],
    [21.74, 28.60, 4.79, 0.86, null],
    [22.36, 33.72, 4.84, 0.10, null],
    [22.91, 42.33, 4.79, -0.13, null],
    [23.48, 57.82, 4.61, 0.45, null],
    
    // MAGNITUDE 5 to 6: Very faint stars (limit of naked eye)
    [0.15, 58.97, 5.28, 0.01, null],
    [0.73, 57.82, 5.45, -0.16, null],
    [1.07, 63.67, 5.04, 1.77, null],
    [1.93, 29.35, 5.23, 0.00, null],
    [2.12, 34.99, 5.09, 0.13, null],
    [2.65, 50.71, 5.07, 0.95, null],
    [3.04, 53.51, 5.17, -0.18, null],
    [3.42, 47.99, 5.33, 0.02, null],
    [3.96, 40.01, 5.04, 0.48, null],
    [4.24, 34.32, 5.29, -0.09, null],
    [4.67, 44.95, 5.25, 0.01, null],
    [5.07, 41.23, 5.05, 0.04, null],
    [5.33, 32.19, 5.73, 0.12, null],
    [5.59, -5.91, 5.32, -0.20, null],
    [5.95, 35.04, 5.45, 0.27, null],
    [6.17, 14.78, 5.24, 0.01, null],
    [6.65, 17.05, 5.70, 0.94, null],
    [7.01, 12.90, 5.44, 0.32, null],
    [7.37, 21.59, 5.14, 0.45, null],
    [7.75, 18.24, 5.22, 0.03, null],
    [8.27, 5.94, 5.78, 0.29, null],
    [8.67, 19.73, 5.83, 0.09, null],
    [9.14, 22.71, 5.60, 0.31, null],
    [9.52, 26.01, 5.58, 0.08, null],
    [10.07, 16.46, 5.41, 1.63, null],
    [10.38, 9.31, 5.35, 0.12, null],
    [10.77, 24.75, 5.48, 0.27, null],
    [11.19, 31.53, 5.40, 0.00, null],
    [11.55, 46.00, 5.39, 0.28, null],
    [11.88, 37.72, 5.47, -0.03, null],
    [12.33, 41.48, 5.46, -0.11, null],
    [12.81, 25.92, 5.27, 0.18, null],
    [13.17, 17.53, 5.22, 1.74, null],
    [13.51, 47.20, 5.89, 0.36, null],
    [13.91, 18.15, 5.37, -0.11, null],
    [14.35, 51.79, 5.40, 0.08, null],
    [14.75, 27.08, 5.60, -0.10, null],
    [15.18, 33.31, 5.41, 0.96, null],
    [15.65, 29.11, 5.66, 0.05, null],
    [16.03, 33.86, 5.68, 0.37, null],
    [16.71, 31.60, 5.21, 0.20, null],
    [17.23, 24.84, 5.49, 0.01, null],
    [17.58, 12.56, 5.00, 0.04, null],
    [17.99, 30.19, 5.62, 1.14, null],
    [18.44, 39.67, 5.73, 0.00, null],
    [18.91, 39.15, 5.37, -0.13, null],
    [19.27, 11.60, 5.46, 0.43, null],
    [19.77, 10.61, 5.28, 0.32, null],
    [20.21, 46.73, 5.46, -0.11, null],
    [20.63, 33.05, 5.62, 1.52, null],
    [21.16, 5.25, 5.24, 0.48, null],
    [21.53, 62.99, 5.19, 0.40, null],
    [22.03, 64.63, 5.42, 0.01, null],
    [22.49, 52.23, 5.25, 0.27, null],
    [22.87, 15.35, 5.16, 0.44, null],
    [23.39, 77.38, 5.48, -0.03, null],
    [23.66, 77.63, 5.90, 0.06, null],
];

// Deep sky objects
const DEEP_SKY_OBJECTS = [
    { name: 'M31', ra: 0.712, dec: 41.27, mag: 3.4, size: 3.0 },  // Andromeda
    { name: 'M45', ra: 3.79, dec: 24.12, mag: 1.6, size: 1.8 },   // Pleiades
    { name: 'M42', ra: 5.59, dec: -5.39, mag: 4.0, size: 1.0 },   // Orion Nebula
    { name: 'M44', ra: 8.67, dec: 19.98, mag: 3.7, size: 1.5 },   // Beehive Cluster
    { name: 'M13', ra: 16.69, dec: 36.46, mag: 5.8, size: 0.5 },  // Hercules Cluster
];

// Milky Way approximation points (galactic coordinates)
const MILKY_WAY_PATH = [
    { l: 0, b: 0 }, { l: 30, b: 0 }, { l: 60, b: 0 }, { l: 90, b: 0 },
    // ... more points to define the band
];

export class Starfield {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = null;
        this.enabled = false;  // Always start dark
        this.lastUpdate = 0;
        this.stars = [];
    }
    
    setupCanvas(width, height) {
        if (!this.canvas) return;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        if (!this.ctx) {
            this.ctx = this.canvas.getContext('2d');
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        
        if (this.enabled) {
            this.render();
        } else {
            this.clear();
        }
        
        return this.enabled;
    }
    
    clear() {
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
    
    render() {
        if (!this.enabled || !this.ctx) return;
        
        const now = Date.now();
        
        if (now - this.lastUpdate > 3600000 || this.lastUpdate === 0) {
            this.calculateVisibleStars();
            this.lastUpdate = now;
        }
        
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Slightly lighter gradient with cosmic mist effect
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, 'rgba(12, 12, 18, 0.4)');
        gradient.addColorStop(0.5, 'rgba(8, 8, 12, 0.25)');
        gradient.addColorStop(1, 'rgba(10, 5, 8, 0.3)');
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.renderCosmicMist();
        this.renderMilkyWay();
        this.renderStars();
        this.renderDeepSkyObjects();
    }
    
    calculateVisibleStars() {
        this.stars = [];
        
        const jd = this.getJulianDate();
        const lst = this.getLocalSiderealTime(jd);
        
        STAR_CATALOG.forEach(([ra, dec, mag, colorIndex, name]) => {
            const pos = this.equatorialToHorizontal(ra, dec, lst);
            
            if (pos.alt > 0) {
                this.stars.push({
                    x: this.azimuthToX(pos.az),
                    y: this.altitudeToY(pos.alt),
                    magnitude: mag,
                    color: this.getStarColor(colorIndex),
                    altitude: pos.alt,
                    name: name
                });
            }
        });
    }
    
    getJulianDate() {
        const now = new Date();
        const a = Math.floor((14 - (now.getMonth() + 1)) / 12);
        const y = now.getFullYear() + 4800 - a;
        const m = (now.getMonth() + 1) + 12 * a - 3;
        
        const jdn = now.getDate() + Math.floor((153 * m + 2) / 5) + 365 * y + 
                    Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
        
        const jd = jdn + (now.getHours() - 12) / 24 + 
                   now.getMinutes() / 1440 + now.getSeconds() / 86400;
        
        return jd;
    }
    
    getLocalSiderealTime(jd) {
        const T = (jd - 2451545.0) / 36525.0;
        const gst = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 
                    0.000387933 * T * T - T * T * T / 38710000.0;
        
        const lst = (gst + OBSERVER_LON) % 360;
        return lst / 15;
    }
    
    equatorialToHorizontal(ra, dec, lst) {
        const ha = (lst - ra) * 15;
        
        const haRad = ha * Math.PI / 180;
        const decRad = dec * Math.PI / 180;
        const latRad = OBSERVER_LAT * Math.PI / 180;
        
        const sinAlt = Math.sin(decRad) * Math.sin(latRad) + 
                       Math.cos(decRad) * Math.cos(latRad) * Math.cos(haRad);
        const alt = Math.asin(sinAlt) * 180 / Math.PI;
        
        const cosA = (Math.sin(decRad) - Math.sin(alt * Math.PI / 180) * Math.sin(latRad)) / 
                     (Math.cos(alt * Math.PI / 180) * Math.cos(latRad));
        const A = Math.acos(Math.max(-1, Math.min(1, cosA))) * 180 / Math.PI;
        
        const az = Math.sin(haRad) > 0 ? 360 - A : A;
        
        return { alt, az };
    }
    
    azimuthToX(azimuth) {
        return (azimuth / 360) * this.canvas.width;
    }
    
    altitudeToY(altitude) {
        return this.canvas.height - (altitude / 90) * this.canvas.height;
    }
    
    getStarColor(colorIndex) {
        if (colorIndex < -0.4) return '#f8f8ff';
        if (colorIndex < -0.2) return '#fafaff';
        if (colorIndex < 0.0) return '#fcfcff';
        if (colorIndex < 0.2) return '#fffffe';
        if (colorIndex < 0.6) return '#fffefb';
        if (colorIndex < 1.0) return '#fffdf8';
        if (colorIndex < 1.5) return '#fffbf5';
        return '#fff9f2';
    }
    
    renderStars() {
        this.stars.forEach(star => {
            const size = this.magnitudeToSize(star.magnitude);
            const opacity = this.getStarOpacity(star.altitude, star.magnitude);
            
            this.ctx.save();
            this.ctx.globalAlpha = Math.min(1, opacity * 1.05); // Increase opacity by 5%
            
            const glowColor = star.magnitude < 1.0 ? star.color : '#ffffff';
            
            const glow = this.ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, size * 2.2);
            glow.addColorStop(0, glowColor);
            glow.addColorStop(0.25, `${glowColor}55`);
            glow.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = glow;
            this.ctx.fillRect(star.x - size * 2.2, star.y - size * 2.2, size * 4.4, size * 4.4);
            
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });
    }
    
    magnitudeToSize(magnitude) {
        if (magnitude < -1) return 1.5;
        if (magnitude < 0) return 1.3;
        if (magnitude < 1) return 1.1;
        if (magnitude < 2) return 0.9;
        if (magnitude < 3) return 0.7;
        if (magnitude < 4) return 0.5;
        if (magnitude < 5) return 0.4;
        return 0.3;
    }
    
    getStarOpacity(altitude, magnitude) {
        const extinctionFactor = Math.min(1, altitude / 15);
        const magnitudeFactor = Math.max(0.25, 1 - magnitude / 7.5);
        return Math.min(1, extinctionFactor * magnitudeFactor * 1.05); // 5% boost
    }
    
    renderMilkyWay() {
        this.ctx.save();
        this.ctx.globalAlpha = 0.1;
        
        for (let pass = 0; pass < 3; pass++) {
            this.ctx.fillStyle = `rgba(180, 180, 200, ${0.03 - pass * 0.01})`;
            this.ctx.filter = `blur(${20 - pass * 5}px)`;
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, this.canvas.height * 0.7);
            this.ctx.quadraticCurveTo(
                this.canvas.width * 0.3, this.canvas.height * 0.5,
                this.canvas.width * 0.6, this.canvas.height * 0.3
            );
            this.ctx.quadraticCurveTo(
                this.canvas.width * 0.8, this.canvas.height * 0.2,
                this.canvas.width, this.canvas.height * 0.4
            );
            this.ctx.lineWidth = 60 - pass * 10;
            this.ctx.stroke();
        }
        
        this.ctx.filter = 'none';
        this.ctx.restore();
    }
    
    renderCosmicMist() {
        this.ctx.save();
        
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * this.canvas.width;
            const y = Math.random() * this.canvas.height;
            const radius = 100 + Math.random() * 200;
            
            const mist = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
            mist.addColorStop(0, 'rgba(150, 150, 170, 0.01575)'); // Increased by 5%
            mist.addColorStop(0.5, 'rgba(140, 140, 160, 0.0084)'); // Increased by 5%
            mist.addColorStop(1, 'transparent');
            
            this.ctx.fillStyle = mist;
            this.ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
        
        this.ctx.restore();
    }
    
    renderDeepSkyObjects() {
        DEEP_SKY_OBJECTS.forEach(obj => {
            const lst = this.getLocalSiderealTime(this.getJulianDate());
            const pos = this.equatorialToHorizontal(obj.ra, obj.dec, lst);
            
            if (pos.alt > 0) {
                const x = this.azimuthToX(pos.az);
                const y = this.altitudeToY(pos.alt);
                const size = obj.size * 5;
                
                this.ctx.save();
                this.ctx.globalAlpha = this.getStarOpacity(pos.alt, obj.mag);
                
                const nebula = this.ctx.createRadialGradient(x, y, 0, x, y, size);
                nebula.addColorStop(0, 'rgba(200, 200, 255, 0.3)');
                nebula.addColorStop(0.5, 'rgba(180, 180, 255, 0.1)');
                nebula.addColorStop(1, 'transparent');
                
                this.ctx.fillStyle = nebula;
                this.ctx.fillRect(x - size, y - size, size * 2, size * 2);
                
                this.ctx.restore();
            }
        });
    }
}