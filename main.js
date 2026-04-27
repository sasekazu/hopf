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

// Hopf Fibration Implementation
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

function makeFiber(a, b, c, d, segments = 240) {
    const pts = [];
    
    for (let i = 0; i <= segments; i++) {
        const t = 2 * Math.PI * i / segments;
        const ct = Math.cos(t);
        const st = Math.sin(t);
        
        const q = {
            w: a * ct - b * st,
            x: a * st + b * ct,
            y: c * ct - d * st,
            z: c * st + d * ct
        };
        
        pts.push(stereographic(q));
    }
    
    return pts;
}

function addFiber(scene, a, b, c, d, color, radius = 0.025) {
    const pts = makeFiber(a, b, c, d);
    const curve = new THREE.CatmullRomCurve3(pts, true);
    
    const geometry = new THREE.TubeGeometry(curve, 240, radius, 12, true);
    const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: 0.15
    });
    
    return new THREE.Mesh(geometry, material);
}

// Hopf fiber meshes
let fiberMeshes = [];

// Parameters
const params = {
    thetaDivisions: 5,
    phiDivisions: 8,
    thetaMin: 80,
    thetaMax: 98,
    phiMin: 100,
    phiMax: 136,
    tubeRadius: 0.025,
    showGrid: true
};

// Store previous values for maintaining width
let prevThetaMin = params.thetaMin;
let prevPhiMin = params.phiMin;

function updateFibers() {
    // Remove old fibers
    fiberMeshes.forEach(mesh => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        mesh.material.dispose();
    });
    fiberMeshes = [];
    
    // Generate multiple fibers
    const thetaDivs = Math.max(1, params.thetaDivisions);
    const phiDivs = Math.max(1, params.phiDivisions);
    
    let fiberCount = 0;
    const totalFibers = thetaDivs * phiDivs;
    
    for (let i = 0; i < thetaDivs; i++) {
        for (let j = 0; j < phiDivs; j++) {
            const theta = params.thetaMin + (params.thetaMax - params.thetaMin) * i / Math.max(1, thetaDivs - 1);
            const phi = params.phiMin + (params.phiMax - params.phiMin) * j / Math.max(1, phiDivs - 1);
            
            const thetaRad = (theta * Math.PI) / 180;
            const phiRad = (phi * Math.PI) / 180;
            
            const a = Math.cos(thetaRad / 2);
            const b = 0.0;
            const c = Math.sin(thetaRad / 2) * Math.cos(phiRad);
            const d = Math.sin(thetaRad / 2) * Math.sin(phiRad);
            
            const hue = fiberCount / totalFibers;
            const color = new THREE.Color().setHSL(hue, 0.75, 0.55);
            
            const mesh = addFiber(scene, a, b, c, d, color, params.tubeRadius);
            scene.add(mesh);
            fiberMeshes.push(mesh);
            
            fiberCount++;
        }
    }
}

// Initialize fibers
updateFibers();

// GUI setup
const gui = new GUI();

const divisionFolder = gui.addFolder('Divisions');
divisionFolder.add(params, 'thetaDivisions', 1, 20, 1)
    .name('Theta Divisions')
    .onChange(updateFibers);
divisionFolder.add(params, 'phiDivisions', 1, 30, 1)
    .name('Phi Divisions')
    .onChange(updateFibers);
divisionFolder.open();

const thetaFolder = gui.addFolder('Theta Range');
const thetaMinController = thetaFolder.add(params, 'thetaMin', 0, 180, 1)
    .name('Min')
    .onChange((value) => {
        const delta = value - prevThetaMin;
        params.thetaMax = Math.min(180, params.thetaMax + delta);
        prevThetaMin = value;
        thetaMaxController.updateDisplay();
        updateFibers();
    });
const thetaMaxController = thetaFolder.add(params, 'thetaMax', 0, 180, 1)
    .name('Max')
    .onChange((value) => {
        if (value < params.thetaMin) {
            params.thetaMax = params.thetaMin;
            thetaMaxController.updateDisplay();
        }
        updateFibers();
    });
thetaFolder.open();

const phiFolder = gui.addFolder('Phi Range');
const phiMinController = phiFolder.add(params, 'phiMin', 0, 360, 1)
    .name('Min')
    .onChange((value) => {
        const delta = value - prevPhiMin;
        params.phiMax = Math.min(360, params.phiMax + delta);
        prevPhiMin = value;
        phiMaxController.updateDisplay();
        updateFibers();
    });
const phiMaxController = phiFolder.add(params, 'phiMax', 0, 360, 1)
    .name('Max')
    .onChange((value) => {
        if (value < params.phiMin) {
            params.phiMax = params.phiMin;
            phiMaxController.updateDisplay();
        }
        updateFibers();
    });
phiFolder.open();

const appearanceFolder = gui.addFolder('Appearance');
appearanceFolder.add(params, 'tubeRadius', 0.005, 0.1, 0.001)
    .name('Tube Radius')
    .onChange(updateFibers);
appearanceFolder.add(params, 'showGrid')
    .name('Show Grid')
    .onChange((value) => {
        grid.visible = value;
    });
appearanceFolder.open();

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
