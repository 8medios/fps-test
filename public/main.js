// Configuración inicial
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Iluminación mejorada
const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(10, 20, 10);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Texturas
const textureLoader = new THREE.TextureLoader();
const floorTexture = textureLoader.load('https://threejs.org/examples/textures/hardwood2_diffuse.jpg');
floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
floorTexture.repeat.set(10, 10);

const wallTexture = textureLoader.load('https://threejs.org/examples/textures/brick_diffuse.jpg');
wallTexture.wrapS = wallTexture.wrapT = THREE.RepeatWrapping;
wallTexture.repeat.set(2, 1);

// Suelo
const floorGeometry = new THREE.PlaneGeometry(100, 100);
const floorMaterial = new THREE.MeshStandardMaterial({ 
    map: floorTexture,
    roughness: 0.8,
    metalness: 0.2
});
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// Paredes
class Wall extends THREE.Mesh {
    constructor(width, height, depth, position, rotation) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({ 
            map: wallTexture,
            roughness: 0.7,
            metalness: 0.1
        });
        super(geometry, material);
        this.position.copy(position);
        this.rotation.y = rotation;
        this.castShadow = true;
        this.receiveShadow = true;
    }
}

const walls = [
    new Wall(20, 5, 0.5, new THREE.Vector3(0, 2.5, -10), 0),
    new Wall(20, 5, 0.5, new THREE.Vector3(-10, 2.5, 0), Math.PI / 2),
    new Wall(20, 5, 0.5, new THREE.Vector3(10, 2.5, 0), Math.PI / 2),
    new Wall(20, 5, 0.5, new THREE.Vector3(0, 2.5, 10), 0)
];
walls.forEach(wall => scene.add(wall));

// Clase Enemy mejorada
class Enemy {
    constructor(x, z) {
        this.geometry = new THREE.BoxGeometry(1, 2, 1);
        this.material = new THREE.MeshStandardMaterial({ 
            color: 0xff0000,
            roughness: 0.5,
            metalness: 0.5
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(x, 1, z);
        this.mesh.castShadow = true;
        this.health = 100;
        this.speed = 0.03;
        this.targetPosition = new THREE.Vector3();
        scene.add(this.mesh);
    }

    update(playerPosition) {
        if (this.health <= 0) return;
        
        // Movimiento de persecución al jugador
        this.targetPosition.copy(playerPosition);
        const direction = this.targetPosition.sub(this.mesh.position).normalize();
        this.mesh.position.x += direction.x * this.speed;
        this.mesh.position.z += direction.z * this.speed;
        
        // Rotación hacia el jugador
        this.mesh.lookAt(playerPosition);
    }

    damage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.die();
        }
    }

    die() {
        scene.remove(this.mesh);
    }
}

// Sistema de armas
class Weapon {
    constructor() {
        this.damage = 25;
        this.range = 50;
        this.cooldown = 500; // milisegundos
        this.lastShot = 0;
        
        // Modelo del arma
        const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.3);
        const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        this.model = new THREE.Mesh(gunGeometry, gunMaterial);
        this.model.position.set(0.3, -0.2, -0.5);
        camera.add(this.model);
    }

    shoot(enemies) {
        const now = Date.now();
        if (now - this.lastShot < this.cooldown) return;
        
        this.lastShot = now;
        
        // Efecto de retroceso
        this.model.position.z += 0.1;
        setTimeout(() => {
            this.model.position.z -= 0.1;
        }, 50);

        // Raycaster para detección de impactos
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(), camera);

        const hits = raycaster.intersectObjects(enemies.map(e => e.mesh));
        if (hits.length > 0) {
            const hitEnemy = enemies.find(e => e.mesh === hits[0].object);
            if (hitEnemy) {
                hitEnemy.damage(this.damage);
                this.createHitEffect(hits[0].point);
            }
        }
    }

    createHitEffect(position) {
        const particles = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
            new THREE.PointsMaterial({ color: 0xff0000, size: 0.5 })
        );
        particles.position.copy(position);
        scene.add(particles);
        setTimeout(() => scene.remove(particles), 100);
    }
}

// Configuración del jugador
const player = {
    speed: 0.15,
    jumpForce: 0.3,
    gravity: 0.01,
    velocityY: 0,
    isOnGround: true,
    weapon: new Weapon()
};

camera.position.set(0, 1.6, 5);

// Control del mouse
const mouseSensitivity = 0.002;
let yaw = 0;
let pitch = 0;

document.addEventListener('click', () => {
    document.body.requestPointerLock();
});

document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement === document.body) {
        yaw -= event.movementX * mouseSensitivity;
        pitch -= event.movementY * mouseSensitivity;
        pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
    }
});

// Movimiento del jugador
const keysPressed = {};
document.addEventListener('keydown', (e) => keysPressed[e.key] = true);
document.addEventListener('keyup', (e) => keysPressed[e.key] = false);

// Disparo
document.addEventListener('mousedown', (e) => {
    if (e.button === 0) { // Click izquierdo
        player.weapon.shoot(enemies);
    }
});

// Crear enemigos
const enemies = [];
for (let i = 0; i < 5; i++) {
    const x = (Math.random() - 0.5) * 30;
    const z = (Math.random() - 0.5) * 30;
    enemies.push(new Enemy(x, z));
}

// Sistema de colisiones mejorado
function checkCollisions() {
    const playerRadius = 0.5;
    const playerPosition = camera.position.clone();
    
    // Colisión con paredes
    for (const wall of walls) {
        const wallBox = new THREE.Box3().setFromObject(wall);
        const playerBox = new THREE.Box3().setFromCenterAndSize(
            playerPosition,
            new THREE.Vector3(playerRadius * 2, 3.2, playerRadius * 2)
        );
        
        if (playerBox.intersectsBox(wallBox)) {
            // Calcular dirección de empuje
            const wallCenter = new THREE.Vector3();
            wallBox.getCenter(wallCenter);
            const pushDirection = playerPosition.clone().sub(wallCenter).normalize();
            camera.position.add(pushDirection.multiplyScalar(0.1));
        }
    }
    
    // Mantener al jugador dentro de los límites
    const mapSize = 50;
    camera.position.x = Math.max(-mapSize, Math.min(mapSize, camera.position.x));
    camera.position.z = Math.max(-mapSize, Math.min(mapSize, camera.position.z));
}

// Función de movimiento mejorada
function handleMovement() {
    const moveSpeed = player.speed;
    
    if (keysPressed['w']) camera.translateZ(-moveSpeed);
    if (keysPressed['s']) camera.translateZ(moveSpeed);
    if (keysPressed['a']) camera.translateX(-moveSpeed);
    if (keysPressed['d']) camera.translateX(moveSpeed);
    
    if (keysPressed[' '] && player.isOnGround) {
        player.velocityY = player.jumpForce;
        player.isOnGround = false;
    }
    
    // Aplicar gravedad
    player.velocityY -= player.gravity;
    camera.position.y += player.velocityY;
    
    // Colisión con el suelo
    if (camera.position.y <= 1.6) {
        camera.position.y = 1.6;
        player.velocityY = 0;
        player.isOnGround = true;
    }
}

// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    handleMovement();
    checkCollisions();
    
    // Actualizar enemigos
    enemies.forEach(enemy => {
        if (enemy.health > 0) {
            enemy.update(camera.position);
        }
    });
    
    renderer.render(scene, camera);
}

// Manejo de redimensionamiento de ventana
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();