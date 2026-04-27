import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GUI } from 'lil-gui';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a1a);

const camera = new THREE.PerspectiveCamera(
    75, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000
);
camera.position.set(3, 3, 5);
camera.up.set(0, 0, 1);
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const grid = new THREE.GridHelper(10, 10, 0x00ff00, 0x00ff00);
grid.rotation.x = Math.PI / 2;
scene.add(grid);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const light = new THREE.DirectionalLight(0xffffff, 0.8);
light.position.set(5, 5, 5);
camera.add(light);

// ============ MANIFOLD GENERATORS ============

// Hopf Fibration (4D → 3D stereographic projection)
function stereographic(q) {
    const w = q.w;
    const denom = Math.max(1e-4, 1.0 - w);
    const scale = 1.5;
    
    return new THREE.Vector3(
        scale * q.x / denom,
        scale * q.y / denom,
        scale * q.z / denom
    );
}

function generateHopf(params) {
    const pts = [];
    const segments = 240;
    
    for (let i = 0; i <= segments; i++) {
        const t = 2 * Math.PI * i / segments;
        const ct = Math.cos(t);
        const st = Math.sin(t);
        
        const q = {
            w: params.a * ct - params.b * st,
            x: params.a * st + params.b * ct,
            y: params.c * ct - params.d * st,
            z: params.c * st + params.d * ct
        };
        
        pts.push(stereographic(q));
    }
    
    return pts;
}

// Torus
function generateTorus(params) {
    const pts = [];
    const segments = 240;
    const R = params.majorRadius || 2.0;
    const r = params.minorRadius || 0.7;
    const winding = params.winding || 1;
    
    for (let i = 0; i <= segments; i++) {
        const u = 2 * Math.PI * i / segments;
        const v = 2 * Math.PI * winding * i / segments;
        
        const x = (R + r * Math.cos(v)) * Math.cos(u);
        const y = (R + r * Math.cos(v)) * Math.sin(u);
        const z = r * Math.sin(v);
        
        pts.push(new THREE.Vector3(x, y, z));
    }
    
    return pts;
}

// Möbius Strip
function generateMobius(params) {
    const pts = [];
    const segments = 240;
    const width = params.width || 0.5;
    const twist = params.twist || 1;
    const flow = params.flow || 0.0;
    
    for (let i = 0; i <= segments; i++) {
        const u = 2 * Math.PI * i / segments;
        const v = width * (flow + Math.sin(i / segments * Math.PI * 4));
        
        const x = (1 + v * Math.cos(twist * u / 2)) * Math.cos(u);
        const y = (1 + v * Math.cos(twist * u / 2)) * Math.sin(u);
        const z = v * Math.sin(twist * u / 2);
        
        pts.push(new THREE.Vector3(x, y, z));
    }
    
    return pts;
}

// Klein Bottle
function generateKlein(params) {
    const pts = [];
    const segments = 240;
    const a = params.a || 2.0;
    const v = params.v || 0.5;
    const twist = params.twist || 1;
    
    for (let i = 0; i <= segments; i++) {
        const u = 2 * Math.PI * i / segments * twist;
        
        const r = a * (1 - Math.cos(u) / 2);
        const x = r * Math.cos(u) + a * Math.cos(u) * Math.cos(v);
        const y = r * Math.sin(u) + a * Math.sin(u) * Math.cos(v);
        const z = a * Math.sin(v);
        
        pts.push(new THREE.Vector3(x, y, z));
    }
    
    return pts;
}

// ============ UNIFIED POINT GENERATION ============

function generatePoints(mode, params) {
    switch (mode) {
        case 'hopf':
            return generateHopf(params);
        case 'torus':
            return generateTorus(params);
        case 'mobius':
            return generateMobius(params);
        case 'klein':
            return generateKlein(params);
        default:
            return generateHopf(params);
    }
}

// ============ MESH CREATION ============

function createManifoldMesh(points, color, tubeRadius, tubularSegments, radialSegments) {
    const curve = new THREE.CatmullRomCurve3(points, true);
    
    const geometry = new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, radialSegments, true);
    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15
    });
    
    return new THREE.Mesh(geometry, material);
}

// ============ MANIFOLD MESHES ============

let manifoldMeshes = [];

// ============ PARAMETERS ============

const params = {
    // Mode selection
    mode: 'hopf',
    
    // Common parameters
    tubeRadius: 0.025,
    tubularSegments: 240,
    radialSegments: 12,
    showGrid: true,
    
    // Hopf parameters
    hopf: {
        thetaDivisions: 5,
        phiDivisions: 8,
        thetaMin: 80,
        thetaMax: 98,
        phiMin: 100,
        phiMax: 136
    },
    
    // Torus parameters
    torus: {
        majorRadius: 2.0,
        minorRadius: 0.7,
        winding: 3,
        count: 12
    },
    
    // Möbius parameters
    mobius: {
        width: 0.5,
        twist: 1,
        flow: 0.3,
        count: 12
    },
    
    // Klein parameters
    klein: {
        a: 2.0,
        v: 0.5,
        twist: 2,
        count: 12
    }
};

// ============ UPDATE FUNCTION ============

function updateManifolds() {
    // Remove old meshes
    manifoldMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    manifoldMeshes = [];
    
    const mode = params.mode;
    
    if (mode === 'hopf') {
        // Generate multiple Hopf fibers
        const hopfParams = params.hopf;
        const thetaDivs = Math.max(1, hopfParams.thetaDivisions);
        const phiDivs = Math.max(1, hopfParams.phiDivisions);
        
        let fiberCount = 0;
        const totalFibers = thetaDivs * phiDivs;
        
        for (let i = 0; i < thetaDivs; i++) {
            for (let j = 0; j < phiDivs; j++) {
                const theta = hopfParams.thetaMin + (hopfParams.thetaMax - hopfParams.thetaMin) * i / Math.max(1, thetaDivs - 1);
                const phi = hopfParams.phiMin + (hopfParams.phiMax - hopfParams.phiMin) * j / Math.max(1, phiDivs - 1);
                
                const thetaRad = (theta * Math.PI) / 180;
                const phiRad = (phi * Math.PI) / 180;
                
                const a = Math.cos(thetaRad / 2);
                const b = 0.0;
                const c = Math.sin(thetaRad / 2) * Math.cos(phiRad);
                const d = Math.sin(thetaRad / 2) * Math.sin(phiRad);
                
                const hue = fiberCount / totalFibers;
                const color = new THREE.Color().setHSL(hue, 0.75, 0.55);
                
                const points = generatePoints(mode, { a, b, c, d });
                const mesh = createManifoldMesh(points, color, params.tubeRadius, params.tubularSegments, params.radialSegments);
                scene.add(mesh);
                manifoldMeshes.push(mesh);
                
                fiberCount++;
            }
        }
    } else if (mode === 'torus') {
        // Generate multiple torus curves
        const torusParams = params.torus;
        const count = torusParams.count;
        
        for (let i = 0; i < count; i++) {
            const winding = torusParams.winding + i * 0.2;
            const hue = i / count;
            const color = new THREE.Color().setHSL(hue, 0.75, 0.55);
            
            const points = generatePoints(mode, {
                majorRadius: torusParams.majorRadius,
                minorRadius: torusParams.minorRadius,
                winding: winding
            });
            
            const mesh = createManifoldMesh(points, color, params.tubeRadius, params.tubularSegments, params.radialSegments);
            scene.add(mesh);
            manifoldMeshes.push(mesh);
        }
    } else if (mode === 'mobius') {
        // Generate multiple Möbius strips
        const mobiusParams = params.mobius;
        const count = mobiusParams.count;
        
        for (let i = 0; i < count; i++) {
            const angle = (i / count) * 2 * Math.PI;
            const flow = mobiusParams.flow * Math.cos(angle);
            const hue = i / count;
            const color = new THREE.Color().setHSL(hue, 0.75, 0.55);
            
            const points = generatePoints(mode, {
                width: mobiusParams.width,
                twist: mobiusParams.twist,
                flow: flow
            });
            
            const mesh = createManifoldMesh(points, color, params.tubeRadius, params.tubularSegments, params.radialSegments);
            scene.add(mesh);
            manifoldMeshes.push(mesh);
        }
    } else if (mode === 'klein') {
        // Generate multiple Klein bottle curves
        const kleinParams = params.klein;
        const count = kleinParams.count;
        
        for (let i = 0; i < count; i++) {
            const v = (i / count) * Math.PI;
            const hue = i / count;
            const color = new THREE.Color().setHSL(hue, 0.75, 0.55);
            
            const points = generatePoints(mode, {
                a: kleinParams.a,
                v: v,
                twist: kleinParams.twist
            });
            
            const mesh = createManifoldMesh(points, color, params.tubeRadius, params.tubularSegments, params.radialSegments);
            scene.add(mesh);
            manifoldMeshes.push(mesh);
        }
    }
}

// Storage for maintaining width behavior in Hopf mode
let prevThetaMin = params.hopf.thetaMin;
let prevPhiMin = params.hopf.phiMin;

// Initialize
updateManifolds();

// ============ GUI SETUP ============

const gui = new GUI();

// Mode selection
const modeController = gui.add(params, 'mode', ['hopf', 'torus', 'mobius', 'klein'])
    .name('Manifold Type')
    .onChange(() => {
        updateManifolds();
        updateGUIVisibility();
    });

// Hopf controls
const hopfFolder = gui.addFolder('Hopf Parameters');
const hopfThetaDivsCtrl = hopfFolder.add(params.hopf, 'thetaDivisions', 1, 20, 1)
    .name('Theta Divisions')
    .onChange(updateManifolds);
const hopfPhiDivsCtrl = hopfFolder.add(params.hopf, 'phiDivisions', 1, 30, 1)
    .name('Phi Divisions')
    .onChange(updateManifolds);

const hopfThetaMinCtrl = hopfFolder.add(params.hopf, 'thetaMin', 0, 180, 1)
    .name('Theta Min')
    .onChange((value) => {
        const delta = value - prevThetaMin;
        params.hopf.thetaMax = Math.min(180, params.hopf.thetaMax + delta);
        prevThetaMin = value;
        hopfThetaMaxCtrl.updateDisplay();
        updateManifolds();
    });
const hopfThetaMaxCtrl = hopfFolder.add(params.hopf, 'thetaMax', 0, 180, 1)
    .name('Theta Max')
    .onChange((value) => {
        if (value < params.hopf.thetaMin) {
            params.hopf.thetaMax = params.hopf.thetaMin;
            hopfThetaMaxCtrl.updateDisplay();
        }
        updateManifolds();
    });

const hopfPhiMinCtrl = hopfFolder.add(params.hopf, 'phiMin', 0, 360, 1)
    .name('Phi Min')
    .onChange((value) => {
        const delta = value - prevPhiMin;
        params.hopf.phiMax = Math.min(360, params.hopf.phiMax + delta);
        prevPhiMin = value;
        hopfPhiMaxCtrl.updateDisplay();
        updateManifolds();
    });
const hopfPhiMaxCtrl = hopfFolder.add(params.hopf, 'phiMax', 0, 360, 1)
    .name('Phi Max')
    .onChange((value) => {
        if (value < params.hopf.phiMin) {
            params.hopf.phiMax = params.hopf.phiMin;
            hopfPhiMaxCtrl.updateDisplay();
        }
        updateManifolds();
    });

// Torus controls
const torusFolder = gui.addFolder('Torus Parameters');
torusFolder.add(params.torus, 'majorRadius', 0.5, 5, 0.1)
    .name('Major Radius')
    .onChange(updateManifolds);
torusFolder.add(params.torus, 'minorRadius', 0.1, 2, 0.1)
    .name('Minor Radius')
    .onChange(updateManifolds);
torusFolder.add(params.torus, 'winding', 1, 50, 1)
    .name('Winding')
    .onChange(updateManifolds);
torusFolder.add(params.torus, 'count', 1, 100, 1)
    .name('Curve Count')
    .onChange(updateManifolds);

// Möbius controls
const mobiusFolder = gui.addFolder('Möbius Parameters');
mobiusFolder.add(params.mobius, 'width', 0.1, 1.5, 0.05)
    .name('Width')
    .onChange(updateManifolds);
mobiusFolder.add(params.mobius, 'twist', 0.5, 3, 0.05)
    .name('Twist')
    .onChange(updateManifolds);
mobiusFolder.add(params.mobius, 'flow', 0, 1, 0.05)
    .name('Flow')
    .onChange(updateManifolds);
mobiusFolder.add(params.mobius, 'count', 1, 50, 1)
    .name('Curve Count')
    .onChange(updateManifolds);

// Klein controls
const kleinFolder = gui.addFolder('Klein Parameters');
kleinFolder.add(params.klein, 'a', 0.5, 4, 0.1)
    .name('Scale')
    .onChange(updateManifolds);
kleinFolder.add(params.klein, 'twist', 1, 5, 1)
    .name('Twist')
    .onChange(updateManifolds);
kleinFolder.add(params.klein, 'count', 1, 50, 1)
    .name('Curve Count')
    .onChange(updateManifolds);

// Common appearance controls
const appearanceFolder = gui.addFolder('Appearance');
appearanceFolder.add(params, 'tubeRadius', 0.005, 0.1, 0.001)
    .name('Tube Radius')
    .onChange(updateManifolds);
appearanceFolder.add(params, 'tubularSegments', 10, 500, 10)
    .name('Length Segments')
    .onChange(updateManifolds);
appearanceFolder.add(params, 'radialSegments', 3, 32, 1)
    .name('Radial Segments')
    .onChange(updateManifolds);
appearanceFolder.add(params, 'showGrid')
    .name('Show Grid')
    .onChange((value) => {
        grid.visible = value;
    });
appearanceFolder.open();

// Function to show/hide folders based on mode
function updateGUIVisibility() {
    const mode = params.mode;
    
    if (mode === 'hopf') {
        hopfFolder.show().open();
        torusFolder.hide();
        mobiusFolder.hide();
        kleinFolder.hide();
    } else if (mode === 'torus') {
        hopfFolder.hide();
        torusFolder.show().open();
        mobiusFolder.hide();
        kleinFolder.hide();
    } else if (mode === 'mobius') {
        hopfFolder.hide();
        torusFolder.hide();
        mobiusFolder.show().open();
        kleinFolder.hide();
    } else if (mode === 'klein') {
        hopfFolder.hide();
        torusFolder.hide();
        mobiusFolder.hide();
        kleinFolder.show().open();
    }
}

// Initial visibility
updateGUIVisibility();

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
