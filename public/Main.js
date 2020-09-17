const quarterPi = Math.PI / 4, halfPi = Math.PI / 2, Pi = Math.PI, twoPi = Math.PI * 2,
    xAxis = Vector3(1, 0, 0),
    yAxis = Vector3(0, 1, 0),
    zAxis = Vector3(0, 0, 1);

class Button {
    constructor(data = {}) {
        defaultsValues(data, {
            name: randomName(),
            object: createMesh({
                position: Vector3(0, 0, -5)
            }),
            speed: 0.075
        });
        this.name = data.name;
        this.object = data.object;
        this.object.name = this.name + 'h';
        this.speed = data.speed;

        this.object.geometry.computeBoundingBox();
        let size = Vector3();
        this.object.geometry.boundingBox.getSize(size);
        size.multiplyScalar(2);
        let center = new THREE.Vector3().add(this.object.geometry.boundingBox.min).add(this.object.geometry.boundingBox.max).divideScalar(2);
        this.boundingbox = createMesh({
            visible: false,
            geometry: new THREE.BoxGeometry(size.x, size.y, size.z)
        });
        addObject(this.object, this.boundingbox, this.name + 'h');
        this.object.geometry.translate(-center.x, -center.y, -center.z);

        this.selected = false;
        this.time = 0;

        this.update();
    }

    update() {
        if (this.selected) {
            this.time = min(this.time + this.speed, 1);
        } else {
            this.time = max(this.time - this.speed, 0);
        }
        this.object.material.color.r = 0.01;
        this.object.material.color.g = map(this.time, 0, 1, 0, 0.08);
        this.object.material.color.b = map(this.time, 1, 0, 0, 0.08);
        let scale = map(this.time, 0, 1, 1, 1.5);
        this.object.scale.set(scale, scale, scale);
    }

}

class Menu {
    constructor(domElement, mouse) {
        this.domElement = domElement;

        this.scene = new THREE.Group();
        addObject(this.scene, new THREE.PointLight(0xf0f0f0, 10));
        addObject(this.scene, createMesh({
            color: 0x000510,
            geometry: new THREE.PlaneGeometry(1000, 1000),
            position: Vector3(0, 0, -30)
        }));

        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
        addObject(this.scene, this.camera);

        this.mouse = new Vector2();

        this.buttons = {};

        this.buttonObjects = new THREE.Group();
        addObject(this.scene, this.buttonObjects);

        this.onMousemove(mouse);

        this.domElement.addEventListener('resize', () => {
            this.onResize();
        });
        this.domElement.addEventListener('mousemove', event => {
            this.onMousemove(event);
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    onMousemove(event) {
        this.mouse.set((event.x / window.innerWidth) * 2 - 1, -(event.y / window.innerHeight) * 2 + 1);
        this.update();
    };

    update() {
        this.camera.rotation.x = this.mouse.y / 5;
        this.camera.rotation.y = -this.mouse.x / 5;

        Object.values(this.buttons).forEach(button => {
            button.selected = false;
        });

        let raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(this.mouse, this.camera);
        raycaster.intersectObjects(this.buttonObjects.children, true).forEach(object => {
            this.buttons[object.object.name.slice(0, -1)].selected = true;
        });

        Object.values(this.buttons).forEach(button => {
            button.update();
        });
    }

    addButton(button = new Button()) {
        this.buttons[button.name] = button;
        addObject(this.buttonObjects, button.object);
    }

    addText(button = new Button()) {
        addObject(this.scene, button.object);
    }
}

class Game {
    constructor(domElement, data = {}) {
        this.domElement = domElement;
        defaultsValues(data, {
            extraLength: 4,
            maxLength: 6,
            minSpeed: 0.08,
            maxSpeed: 0.12,
            radius: 0.5,
            curvature: 2.5,
            shift: 0.75
        });
        this.extraLength = data.object;
        this.maxLength = data.maxLength;
        this.minSpeed = data.minSpeed;
        this.maxSpeed = data.maxSpeed;
        this.radius = data.radius;
        this.curvature = data.curvature;
        this.shift = data.shift;

        this.directions = [1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5, 0, 2, 8, 8, 4, 1, 9, 7, 1, 6, 9];
        this.speeds = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
        //this.lengths = [6, 8, 5, 8, 16, 5, 3, 7, 10, 10, 9, 10, 10, 2, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 14, 3];
        this.lengths = [8, 8, 5, 8, 16, 5, 3, 7, 10, 10, 9, 10, 10, 2, 12, 10, 10, 10, 16, 6, 6, 10, 10, 9, 10, 10, 3];
        if (this.lengths.length > 0) {
            this.lengths.forEach(length => {
                this.maxLength = max(this.maxLength, length);
            });
        }
        clog(this.maxLength);

        this.turning = true;
        this.turned = false;
        this.started = true;
        this.paused = false;
        this.ended = false;

        this.mouse = Vector2();

        this.setNextSpeed();
        this.setNextDirection();
        this.setNextLength();

        this.scene = new THREE.Group();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
        this.player = new THREE.Group();
        addObject(this.player, this.camera);
        addObject(this.player, this.createLights());
        this.player.rotation.z = this.nextDirection * halfPi;
        this.player.position.set(0, 0, -this.radius);

        this.create();
        this.refresh();

        this.domElement.addEventListener('resize', () => {
            this.onResize();
        });
        this.domElement.addEventListener('keydown', event => {
            this.onKeydown(event);
        });
        this.domElement.addEventListener('mousedown', event => {
            this.onMousedown(event);
        });
        this.domElement.addEventListener('mouseup', event => {
            this.onMouseup(event);
        });
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }

    onKeydown(event) {
        let keyCode = event.keyCode;
        if (keyCode === constrain(keyCode, 37, 40)) {
            this.turn((keyCode - 35) % 4);
        }
    }

    onMousedown(event) {
        this.mouse.set(event.x, event.y);
    }

    onMouseup(event) {
        if (this.started) {
            let v = new Vector2(event.x, event.y).sub(this.mouse);
            if (v.length() >= 1) {
                if (!this.paused) {
                    this.turn(floor(v.angle() / halfPi + 0.5) % 4);
                }
            }/* else {
                if (this.paused) {
                    audio.play();
                    this.paused = false;
                } else {
                    audio.pause();
                    this.paused = true;
                }
            }*/
        }
    }

    create() {
        addObject(this.scene, this.player, 'player');
        addObject(this.scene, this.createTunnel({
            position: Vector3(this.extraLength, 0, 0),
            rotation: Euler(0, halfPi, 0),
            length: this.extraLength
        }), 'previousTunnel');
        addObject(this.scene, this.createArrow({
            position: Vector3(0, 0, 0),
            rotation: Euler(0, halfPi, 0)
        }), 'arrow1');
        let blocks = this.createBlocks();
        for (let i = 1; i <= this.maxLength; i++) {
            let clone = blocks.clone();
            clone.position.copy(Vector3(0, 0, -i));
            addObject(this.scene, clone, 'currentTunnel' + i);
        }
        addObject(this.scene, this.createArrow({
            position: Vector3(0, 0, -this.nextLength)
        }), 'arrow2');
        addObject(this.scene, this.createTunnel({
            position: Vector3(0, 0, -this.nextLength),
            rotation: Euler(0, -halfPi, 0, 'YXZ'),
            length: this.extraLength
        }), 'nextTunnel');
    }

    refresh(angle = 0, length = this.nextLength) {
        for (let i = 1; i < length; i++) {
            getObject(this.scene, 'currentTunnel' + i).visible = true;
        }
        for (let i = length; i <= this.maxLength; i++) {
            getObject(this.scene, 'currentTunnel' + i).visible = false;
        }

        getObject(this.scene, 'arrow2').position.z = -length;
        getObject(this.scene, 'arrow2').rotation.z = angle;
        getObject(this.scene, 'nextTunnel').position.z = -length;
        getObject(this.scene, 'nextTunnel').rotation.x = angle;
    }

    setNextLength() {
        if (this.lengths.length > 0) {
            this.nextLength = this.lengths[0];
            this.lengths.shift();
        }
    }

    setNextDirection() {
        if (this.directions.length > 0) {
            this.nextDirection = this.directions[0] % 4;
            this.directions.shift();
        }
    }

    setNextSpeed() {
        if (this.speeds.length > 0) {
            this.nextSpeed = this.speeds[0];
            this.speeds.shift();
        }
    }

    step() {
        if (this.turning) {
            this.rotateCamera();
            if (this.player.position.z <= -this.radius) {
                this.turning = false;
                this.player.position.x = 0;
                this.player.rotation.y = 0;
            }
        } else {
            this.translateCamera();
            if (this.player.position.z <= -this.nextLength + this.radius) {
                if (!this.turned) {
                    this.ended = true;
                    audio.stop();
                }
                this.turned = false;
                getObject(this.scene, 'pointLigth').color.set(0xff0000);
                this.turning = true;
                this.player.position.set(this.radius, 0, 0);
                this.player.rotation.set(0, halfPi, this.nextDirection * halfPi);

                this.setNextSpeed();
                this.setNextDirection();
                this.setNextLength();

                this.refresh(this.player.rotation.z - this.nextDirection * halfPi, this.nextLength);
            }
        }
    }

    turn(direction) {
        if (this.player.position.z < -this.nextLength + 2) {
            clog('turn');
            if (this.nextDirection === direction) {
                this.turned = true;
                getObject(this.scene, 'pointLigth').color.set(0x00ff00);
            } else {
                this.ended = true;
                audio.stop();
            }
        }
    }

    translateCamera() {
        let x = map(this.player.position.z, -this.radius, -this.nextLength + this.radius, 0, 1), speed;
        if (x < 0.5) {
            speed = mappedEase(x, 1.5, 0.25, 0, 0.5, this.minSpeed, this.maxSpeed) * this.nextSpeed;
        } else {
            speed = mappedEase(x, 1.5, 0.75, 0.5, 1, this.maxSpeed, this.minSpeed) * this.nextSpeed;
        }
        this.player.position.z -= speed;
    }

    rotateCamera() {
        let v = this.player.position.clone();
        v.sub(Vector3(this.radius, 0, -this.radius));
        v.applyAxisAngle(yAxis, -this.minSpeed * this.nextSpeed / this.radius);
        let x = Math.atan2(v.x, v.z) + halfPi;
        this.player.rotation.y = mappedEase(x, this.curvature, this.shift, halfPi, 0, halfPi, 0);
        v.add(Vector3(this.radius, 0, -this.radius));
        this.player.position.copy(v);
    }


    createLights() {
        let light;
        let group = new THREE.Group();

        light = new THREE.SpotLight(0xffffff, 0.5, 0, 0.5, 0.5);
        light.position.set(0, 0, 1);
        addObject(group, light.target);
        addObject(group, light);

        light = new THREE.PointLight(0xff0000, 0.5);
        light.position.set(0, 0, -0.5);
        addObject(group, light, 'pointLigth');

        return group;
    }

    createArrow(data = {}) {
        defaultsValues(data, {
            position: Vector3(),
            rotation: Euler()
        });

        let group = new THREE.Group();
        addObject(group, this.createBlock({
            position: Vector3(0, 0, -1),
            rotation: Euler(halfPi, -halfPi, 0),
            front: false
        }));
        addObject(group, this.createBlock({
            position: Vector3(-1, 0, 0),
            rotation: Euler(0, 0, -halfPi)
        }));
        addObject(group, this.createBlock({
            position: Vector3(0, -1, 0),
            right: false
        }));
        addObject(group, this.createBlock({
            position: Vector3(0, 1, 0),
            rotation: Euler(0, 0, Pi),
            left: false
        }));

        let arrow = new THREE.Shape();
        arrow.moveTo(4, 0);
        arrow.lineTo(1, 3);
        arrow.lineTo(1, 1);
        arrow.lineTo(-5, 1);
        arrow.lineTo(-5, -1);
        arrow.lineTo(1, -1);
        arrow.lineTo(1, -3);
        arrow.lineTo(4, 0);
        addObject(group, createMesh({
            geometry: new THREE.ShapeGeometry(arrow),
            standard: false,
            color: 0x000000,
            position: Vector3(0.1, 0, -0.45),
            scale: 0.07
        }));

        group.position.copy(data.position);
        group.rotation.copy(data.rotation);

        return group;
    }

    createTunnel(data = {}) {
        defaultsValues(data, {
            position: Vector3(),
            rotation: Euler(),
            length: this.nextLength
        });

        let group = new THREE.Group();
        let blocks = this.createBlocks();
        for (let i = 1; i < data.length; i++) {
            let clone = blocks.clone();
            clone.position.copy(Vector3(0, 0, -i));
            addObject(group, clone);
        }

        group.position.copy(data.position);
        group.rotation.copy(data.rotation);

        return group;
    }

    createBlocks(data = {}) {
        defaultsValues(data, {
            position: Vector3(),
            rotation: Euler()
        });

        let group = new THREE.Group();
        let block = this.createBlock();
        for (let angle = 0; angle < 4; angle++) {
            let position = Vector3(0, -1, 0);
            let rotation = Euler();
            position.applyAxisAngle(zAxis, angle * halfPi);
            rotation.z = angle * halfPi;
            let clone = block.clone();
            clone.position.copy(position);
            clone.rotation.copy(rotation);
            addObject(group, clone);
        }

        group.position.copy(data.position);
        group.rotation.copy(data.rotation);

        return group;
    }

    createBlock(data = {}) {
        defaultsValues(data, {
            position: Vector3(),
            rotation: Euler(),
            left: true,
            right: true,
            from: true
        });

        let group = new THREE.Group();
        addObject(group, createMesh());
        if (data.right) {
            addObject(group, createMesh({
                geometry: new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, false, Pi, halfPi),
                position: Vector3(0.5, 0.5, 0),
                rotation: Euler(halfPi, 0, 0)
            }));
            addObject(group, createMesh({
                geometry: new THREE.SphereGeometry(0.15, 10, 20, -halfPi, halfPi),
                position: Vector3(0.5, 0.5, -0.5),
                rotation: Euler(halfPi, 0, 0)
            }));
        }
        if (data.left) {
            addObject(group, createMesh({
                geometry: new THREE.CylinderGeometry(0.1, 0.1, 1, 10, 1, false, halfPi, halfPi),
                position: Vector3(-0.5, 0.5, 0),
                rotation: Euler(halfPi, 0, 0)
            }));
            addObject(group, createMesh({
                geometry: new THREE.SphereGeometry(0.15, 10, 20, Pi, halfPi),
                position: Vector3(-0.5, 0.5, -0.5),
                rotation: Euler(halfPi, 0, 0)
            }));
        }

        group.position.copy(data.position);
        group.rotation.copy(data.rotation);

        return group;
    }
}

let font, listener, audio,
    renderer, scene, state, mouse,
    mainMenu, restartMenu, game,
    time = 0,
    spectatorCamera, spectatorControls;

//alert('Click anywhere to start the game');
main();

async function main() {
    await preload();
    setup();
    draw();
}

async function preload() {
    new THREE.FontLoader().load('files/font.json', file => {
        font = file;
    });
    listener = new THREE.AudioListener();
    new THREE.AudioLoader().load('music/Island.mp3', file => {
        audio = new THREE.Audio(listener);
        audio.setBuffer(file);
        audio.setLoop(true);
        audio.setVolume(0.2);
    });
    await sleep(2000);
}

function setup() {
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x303030);

    spectatorCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
    scene.add(spectatorCamera);

    spectatorControls = new THREE.OrbitControls(spectatorCamera, renderer.domElement);
    spectatorCamera.rotation.x = halfPi;
    spectatorControls.minDistance = 0.1;
    spectatorControls.maxDistance = 10000;

    state = 0;

    mouse = Vector2();

    mainMenu = new Menu(window, mouse);
    mainMenu.addText(new Button({
        object: createMesh({
            geometry: createText({
                text: 'Distorted tunnel',
                size: 0.8
            }),
            position: Vector3(0, 3, -10)
        })
    }));
    mainMenu.addButton(new Button({
        name: 'playButton',
        object: createMesh({
            geometry: createText({
                text: 'Play',
                size: 0.4
            }),
            position: Vector3(0, -1, -10)
        })
    }));

    restartMenu = new Menu(window, mouse);
    restartMenu.addText(new Button({
        object: createMesh({
            geometry: createText({
                text: 'Game over',
                size: 0.8
            }),
            position: Vector3(0, 3, -10)
        })
    }));
    restartMenu.addButton(new Button({
        name: 'mainMenuButton',
        object: createMesh({
            geometry: createText({
                text: 'Main menu',
                size: 0.4
            }),
            position: Vector3(0, -1, -10)
        })
    }));

    setupMainMenu();


    window.addEventListener('resize', () => {
        onResize();
    });
    window.addEventListener('mousemove', (event) => {
        onMousemove(event);
    });
    window.addEventListener('mouseup', (event) => {
        onMouseup(event);
    });
}

function draw() {
    if (state === 0) {
        mainMenu.update();
        renderer.render(scene, mainMenu.camera);
    } else if (state === 1) {
        if (game.ended) {
            removeObject(scene, game.scene.name);
            setupRestartMenu();
        } else if (!game.paused) {
            game.step();
            renderer.render(scene, game.camera);
        }
    } else if (state === 2) {
        restartMenu.update();
        renderer.render(scene, restartMenu.camera);
    }
    /*spectatorControls.update();
    renderer.render(scene, spectatorCamera);*/

    requestAnimationFrame(draw);
}

function onResize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMousemove(event) {
    mouse.set(event.x, event.y);
}

function onMouseup(event) {
    onMousemove(event);
    if (state === 0) {
        if (mainMenu.buttons['playButton'].selected) {
            removeObject(scene, mainMenu.scene.name);
            setupGame();
        }
    } else if (state === 2) {
        if (restartMenu.buttons['mainMenuButton'].selected) {
            removeObject(scene, restartMenu.scene.name);
            setupMainMenu();
        }
    }
}


function setupMainMenu() {
    state = 0;
    addObject(scene, mainMenu.scene);
    addObject(scene, listener);
}

function setupGame() {
    state = 1;
    game = new Game(window);
    audio.play();
    addObject(scene, game.scene);
}

function setupRestartMenu() {
    state = 2;
    addObject(scene, restartMenu.scene);
}


function createText(data = {}) {
    defaultsValues(data, {
        text: '',
        font: font,
        size: 1,
        height: 0.5,
        bevelEnabled: true,
        bevelThickness: 0.05,
        bevelSize: 0.05,
        curveSegments: 8,
        bevelSegments: 5
    });

    defaultsValues(data, {
        height: data.size * 0.5,
        bevelThickness: data.size * 0.1,
        bevelSize: data.size * 0.1
    });

    return new THREE.TextGeometry(data.text, {
        font: data.font,
        size: data.size,
        height: data.size * data.height,
        bevelSegments: data.bevelSegments,
        bevelThickness: data.size * data.bevelThickness,
        bevelSize: data.size * data.bevelSize,
        curveSegments: data.curveSegments,
        bevelEnabled: data.bevelEnabled
    });
}

function createMesh(data = {}) {
    defaultsValues(data, {
        geometry: new THREE.PlaneGeometry().translate(0, 0, 0.5).rotateX(-halfPi),
        standard: true,
        color: 0xffffff,
        roughness: 0.65,
        visible: true,
        scale: 1,
        position: Vector3(),
        rotation: Euler(),
    });

    let material;
    if (data.standard) {
        material = new THREE.MeshStandardMaterial({
            color: data.color,
            roughness: data.roughness,
            //map: new THREE.TextureLoader().load('files/brick.jpg')
        });
    } else {
        material = new THREE.MeshBasicMaterial({
            color: data.color
        });
    }

    let mesh = new THREE.Mesh(data.geometry, material);

    mesh.visible = data.visible;
    mesh.scale.set(data.scale, data.scale, data.scale);
    mesh.position.copy(data.position);
    mesh.rotation.copy(data.rotation);

    return mesh;
}


function addObject(parent, object, name) {
    if (object.name === '') {
        object.name = randomName();
    }
    if (!isUndefined(name)) {
        object.name = name;
    }
    parent.add(object);
}

function getObject(parent, name) {
    return parent.getObjectByName(name);
}

function getObjects(parent, name) {
    if (isUndefined(name)) {
        return this.getObjects(this.scene, parent);
    }

    if (parent.name === name) {
        return [parent];
    }

    let list = [];
    parent.children.forEach(object => {
        list = list.concat(this.getObjects(object, name));
    });

    return list;
}

function removeObject(parent, name) {
    parent.remove(getObject(parent, name));
}

function removeObjects(parent, name) {
    getObjects(parent, name).forEach(object => {
        parent.remove(object);
    });
}


function defaultsValues(object, defaults = {}) {
    Object.keys(defaults).forEach(key => {
        if (isUndefined(object[key])) {
            object[key] = defaults[key];
        }
    });
}

function Vector2(x = 0, y = 0) {
    return new THREE.Vector2(x, y);
}

function Vector3(x = 0, y = 0, z = 0) {
    return new THREE.Vector3(x, y, z);
}

function Scale(scale) {
    return Vector3(scale, scale, scale);
}

function Euler(x = 0, y = 0, z = 0, order = 'XYZ') {
    return new THREE.Euler(x, y, z, order);
}

function normalizedEase(x, c = 1, s = 0.5) {
    if (x <= s) {
        return Math.pow(x / s, c) * s;
    }
    let e = 1 / s - 1;

    return (1 + e - e * Math.pow((1 - x) / (1 - s), c)) * s;
}

function mappedEase(x, c = 1, s = 0.5, fromLeft = 0, fromRight = 1, toLeft = 0, toRight = 1) {
    return normalizedEase((x - fromLeft) / (fromRight - fromLeft), c, s) * (toRight - toLeft) + toLeft;
}

function constrain(x, min = 0, max = 1) {
    return Math.min(Math.max(x, min), max);
}

function min(x, y) {
    return Math.min(x, y)
}

function max(x, y) {
    return Math.max(x, y)
}

function floor(x) {
    return Math.floor(x);
}

function map(x, fromLeft = 0, fromRight = 1, toLeft = 0, toRight = 1) {
    return (x - fromLeft) / (fromRight - fromLeft) * (toRight - toLeft) + toLeft;
}

function random(min = 100, max) {
    if (isUndefined(max)) {
        return Math.random() * min;
    }
    if (min === max) {
        return min;
    }
    return Math.random() * (max - min) + min;
}

function randomName() {
    return 'name_' + Math.floor(random(1000000, 10000000));
}

function isUndefined(object) {
    return object === undefined;
}

function clog(object) {
    console.log(object);
}

function timeRestart() {
    time = Date.now();
}

function timeLog(out = '') {
    clog(out, Date.now() - time);
}

function sleep(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}
