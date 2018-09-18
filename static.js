function loadText(message, options = {}) {
    const loader = new THREE.FontLoader();
    const fontOptions = {
        size: options.size || 1,
        height: options.height || 0.05
    };
    const fontFace = options.fontFace || 'helvetiker';
    const fontStyle = options.bold ? 'bold' : 'regular';
    const fontURL = `fonts/${fontFace}_${fontStyle}.typeface.json`;

    return new Promise((resolve, reject) => {
        loader.load(fontURL, font => {
            const textObject = new THREE.Mesh(
                new THREE.TextGeometry(message, {
                    ...fontOptions,
                    font
                }),
                new THREE.MeshBasicMaterial({
                    color: 0x000000,
                    transparent: true,
                    opacity: 1.0,
                    side: THREE.DoubleSide
                })
            );

            resolve(textObject);
        }, () => {}, reject);
    });
}

function loadModel(objURL, mtlURL) {
    // OBJLoader and MTLLoader are not a part of three.js core, and must be
    // included as separate scripts.
    const objLoader = new THREE.OBJLoader();
    const mtlLoader = new THREE.MTLLoader();

    // Set texture path so that the loader knows where to find linked resources
    mtlLoader.setTexturePath(mtlURL.substr(0, mtlURL.lastIndexOf('/') + 1));

    // remaps ka, kd, & ks values of 0,0,0 -> 1,1,1, models from Poly benefit
    // due to how they were encoded.
    mtlLoader.setMaterialOptions({ ignoreZeroRGBs: true });

    // tslint:disable-next-line:no-empty
    const noop = () => { };

    // OBJLoader and MTLLoader provide callback interfaces; let's return a
    // Promise and resolve or reject based off of the asset downloading.
    return new Promise((resolve, reject) => {
        mtlLoader.load(mtlURL, materialCreator => {
            // We have our material package parsed from the .mtl file. Be sure
            // to preload it.
            materialCreator.preload();

            // Remap opacity values in the material to 1 if they're set as 0;
            // this is another peculiarity of Poly models and some MTL
            // materials.
            const materials = Object.values(materialCreator.materials);
            for (const material of materials) {
                opacityRemap(material);
            }

            // Give our OBJ loader our materials to apply it properly to the
            // model
            objLoader.setMaterials(materialCreator);

            // Finally load our OBJ, and resolve the promise once found.
            objLoader.load(objURL, resolve, noop, reject);
        }, noop, reject);
    });
}

const opacityRemap = mat => {
    if (mat.opacity === 0) {
        mat.opacity = 1;
    }
};

function loadSofa() {
    const scale = 0.1;
    const loader = new THREE.GLTFLoader();

    return new Promise((resolve, reject) => {
        loader.load('assets/couch/sofa.gltf', gltf => {
            gltf.scene.scale.set(scale, scale, scale);
            gltf.scene.rotateY(-Math.PI / 2);
            gltf.scene.traverse(node => {
                if (node instanceof THREE.Mesh) {
                    node.receiveShadow = true;
                    node.castShadow = true;
                }
            });

            resolve(gltf.scene);
        }, () => {}, reject);
    });
}

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.z = 4;

const controls = new THREE.OrbitControls(camera);
controls.target.set(0, 0, 0);
controls.update();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(0xcccccc);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.body.appendChild(renderer.domElement);


const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1, 10);
scene.add(ambientLight);

const spotLight = new THREE.SpotLight(0xFFFFFF);
spotLight.position.set(0, 4, 0);
spotLight.castShadow = true;
spotLight.shadow.mapSize.width = 1024;
spotLight.shadow.mapSize.height = 1024;
scene.add(spotLight);

const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x433F81 });
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);

const planeGeometry = new THREE.PlaneBufferGeometry(15, 15, 32, 32);
planeGeometry.rotateX(-Math.PI / 2);
const shadowMesh = new THREE.Mesh(
    planeGeometry,
    new THREE.MeshStandardMaterial({ color: 0x00FF00 })
);
shadowMesh.receiveShadow = true;
shadowMesh.material.side = THREE.DoubleSide;

scene.add(shadowMesh);

const assetGroup = new THREE.Group();
const textGroup = new THREE.Group();
scene.add(assetGroup);
scene.add(textGroup);

(function loadAssets() {
    Promise.all([
        loadText('SØFÄ', { fontFace: 'droid_sans', bold: true }),
        loadText('1,200 kr.', { fontFace: 'helvetiker', size: 0.5 }),
        loadSofa()
    ]).then(objects => {
        const [ title, description, sofa ] = objects;

        // Adjust position of the description text:
        description.position.y -= 0.7;

        // Adjust overall position of the text group:
        textGroup.position.x += 1.5;
        textGroup.position.y -= 1.3;

        sofa.name = 'sofa';

        textGroup.add(title);
        textGroup.add(description);
        assetGroup.add(sofa);

        setSofaBlack();
    });
})();

let allTweensDone = false;

const alternativeColors = [
    // Grey
    [
        new THREE.Color(0x333333),
        new THREE.Color(0.47451, 0.333333, 0.282353)
    ],
    // Black
    [
        new THREE.Color(0x111111),
        new THREE.Color(0.47451, 0.333333, 0.282353)
    ]
];
let alternativeColorsCounter = 0;

function setSofaColor(color) {
    const sofa = scene.getObjectByName('sofa')
    if (sofa !== undefined) {
        let segmentCounter = 0;

        sofa.traverse(node => {
            if (node instanceof THREE.Mesh && node.material instanceof THREE.MeshStandardMaterial) {
                node.material.color = color[segmentCounter];
                node.material.needsUpdate = true;
                ++segmentCounter;
            }
        });
    }
}

function setSofaGrey() {
    setSofaColor(alternativeColors[0]);
}
function setSofaBlack() {
    setSofaColor(alternativeColors[1]);
}

document.getElementById('color-grey').addEventListener('click', e => {
    e.preventDefault();
    setSofaGrey();

    document.querySelector('#color-picker a.selected').classList.remove('selected');
    e.target.classList.add('selected');
});
document.getElementById('color-black').addEventListener('click', e => {
    e.preventDefault();
    setSofaBlack();

    document.querySelector('#color-picker a.selected').classList.remove('selected');
    e.target.classList.add('selected');
});


window.addEventListener('dblclick', e => {
    allTweensDone = false;

    const initialPosition = { y: 0 };
    let deltaY = 0;
    let assetTweenDone = false;
    const assetTween = new TWEEN.Tween(initialPosition)
        .to({ y: 0.2 }, 1000)
        .onUpdate(() => {
            deltaY = initialPosition.y - deltaY;
            assetGroup.position.y += deltaY;
            deltaY = initialPosition.y;
        })
        .onComplete(() => {
            assetTweenDone = true;
            allTweensDone = assetTweenDone && textTweenDone;
        })
        //.start();

    const textInitialPosition = { y: 0 };
    let textDeltaY = 0;
    let textTweenDone = false;
    const textTween = new TWEEN.Tween(textInitialPosition)
        .to({ y: 2.25 }, 850)
        .easing(TWEEN.Easing.Sinusoidal.Out)
        .delay(250)
        .onUpdate(() => {
            textDeltaY = textInitialPosition.y - textDeltaY;
            textGroup.position.y += textDeltaY;
            textDeltaY = textInitialPosition.y;
        })
        .onComplete(() => {
            textTweenDone = true;
            allTweensDone = assetTweenDone && textTweenDone;
        })
        .start();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});


function render(dt) {
    requestAnimationFrame(render);

    renderer.render(scene, camera);

    if (!allTweensDone) {
        TWEEN.update(dt);
    }
}

render();
