import * as THREE from 'three';
import Reticle from './reticle';
import * as Settings from './settings';
import * as TextUtils from './text-utils';
import * as DemoUtils from './utils';


/**
 * Sofa colors.
 */
enum SofaColor {
    BLACK = 0x111111,
    GREY = 0x333333
};

/**
 * Mapping of UI Buttons to sofa colors.
 */
const COLOR_PICKER_MAPPING = [
    { buttonID: 'color-black', sofaColor: SofaColor.BLACK },
    { buttonID: 'color-grey', sofaColor: SofaColor.GREY }
];


/**
 * Container class to manage connecting to the WebXR Device API and handle
 * rendering on every frame.
 */
export default class Application {
    public gl: WebGLRenderingContext;
    public session: XRSession;
    protected device: XRDevice;
    protected renderer: THREE.WebGLRenderer;
    protected camera: THREE.PerspectiveCamera;
    protected reticle: Reticle;
    protected scene: THREE.Scene;
    protected model: THREE.Group;
    protected frameOfRef: XRFrameOfReference;
    protected stabilized: boolean;
    protected raycaster: THREE.Raycaster;

    protected textGroup: THREE.Group;


    /**
     * Constructor.
     */
    constructor() {
        this.onXRFrame = this.onXRFrame.bind(this);
        this.onEnterAR = this.onEnterAR.bind(this);
        this.onClick = this.onClick.bind(this);

        this.revealModel = this.revealModel.bind(this);
        this.loadText = this.loadText.bind(this);

        this.bindColorPickerListeners = this.bindColorPickerListeners.bind(this);
        this.setSofaColor = this.setSofaColor.bind(this);

        this.init();
    }

    /**
     * Fetches the XRDevice, if available.
     */
    protected async init(): Promise<void> {
        const navigatorInstance = navigator as Navigator;

        // The entry point of the WebXR Device API is on `navigator.xr`. We also
        // want to ensure that `XRSession` has `requestHitTest`, indicating that
        // the #webxr-hit-test flag is enabled.
        if (navigatorInstance.xr && XRSession.prototype.requestHitTest) {
            try {
                this.device = await navigatorInstance.xr.requestDevice();
            } catch (e) {
                // If there are no valid XRDevice's on the system,
                // `requestDevice()` rejects the promise. Catch our
                // awaited promise and display message indicating there
                // are no valid devices.
                this.onNoXRDevice();
                return;
            }
        } else {
            // If `navigator.xr` or `XRSession.prototype.requestHitTest`
            // does not exist, we must display a message indicating there
            // are no valid devices.
            this.onNoXRDevice();
            return;
        }

        // We found an XRDevice! Bind a click listener on our "Enter AR" button
        // since the spec requires calling `device.requestSession()` within a
        // user gesture.
        document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
    }

    /**
     * Handle a click event on the '#enter-ar' button and attempt to start an
     * XRSession.
     */
    protected async onEnterAR(): Promise<void> {
        // Now that we have an XRDevice, and are responding to a user gesture,
        // we must create an XRPresentationContext on a canvas element.
        const outputCanvas = document.createElement('canvas');
        const ctx = outputCanvas.getContext('xrpresent');

        try {
            // Request a session for the XRDevice with the XRPresentationContext
            // we just created.
            // Note: `device.requestSession()` must be called in response to a
            // user gesture, hence this function being a click handler.
            const session = await this.device.requestSession({
                outputContext: ctx,
                environmentIntegration: true,
            });

            // If `requestSession` is successful, add the canvas to the
            // DOM since we know it will now be used.
            document.body.appendChild(outputCanvas);
            this.onSessionStarted(session);

            // Bind listeners to the color picker buttons:
            this.bindColorPickerListeners();
        } catch (e) {
            // If `requestSession` fails, the canvas is not added, and we
            // call our function for unsupported browsers.
            this.onNoXRDevice();
        }
    }

    /**
     * Toggle on a class on the page to disable the "Enter AR" button and
     * display the unsupported browser message.
     */
    protected onNoXRDevice(): void {
        document.body.classList.add('unsupported');
    }

    /**
     * Called when the XRSession has begun. Here we set up our three.js
     * renderer, scene, and camera and attach our XRWebGLLayer to the XRSession
     * and kick off the render loop.
     */
    protected async onSessionStarted(session: XRSession): Promise<void> {
        this.session = session;

        // Add the `ar` class to our body, which will hide our 2D components
        document.body.classList.add('ar');

        // To help with working with 3D on the web, we'll use three.js. Set up
        // the WebGLRenderer, which handles rendering to our session's base
        // layer.
        this.renderer = new THREE.WebGLRenderer({
            alpha: true,
            preserveDrawingBuffer: true,
        });
        this.renderer.autoClear = false;

        // We must tell the renderer that it needs to render shadows.
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        this.gl = this.renderer.getContext();

        // Ensure that the context we want to write to is compatible with our
        // XRDevice
        await this.gl.setCompatibleXRDevice(this.session.device);

        // Set our session's baseLayer to an XRWebGLLayer using our new
        // renderer's context
        this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);

        // A THREE.Scene contains the scene graph for all objects in the render
        // scene. Call our utility which gives us a THREE.Scene with a few
        // lights and surface to render our shadows. Lights need to be
        // configured in order to use shadows, see `shared/utils.js` for more
        // information.
        this.scene = DemoUtils.createLitScene();

        // Fixes an issue with three.js switching framebuffer back to 0 after
        // using a render target, fixes an issue with shadows.
        DemoUtils.fixFramebuffer(this);

        // Use the DemoUtils.loadModel to load our OBJ and MTL. The promise
        // resolves to a THREE.Group containing our mesh information. Don't
        // await this promise, as we want to start the rendering process before
        // this finishes.
        Promise.all([
            DemoUtils.loadGLTFModel(Settings.MODEL_GLTF_URL),
            this.loadText()
        ]).then(data => {
            const [ sofa ] = data;
            sofa.scene.name = Settings.MODEL_NAME;

            // Every model is different -- you may have to adjust the scale of a
            // model depending on the use.
            sofa.scene.scale.set(
                Settings.MODEL_SCALE,
                Settings.MODEL_SCALE,
                Settings.MODEL_SCALE
            );

            sofa.scene.rotateY(-Math.PI / 2);

            // Some models contain multiple meshes, so we want to make sure all
            // of our meshes within the model case a shadow.
            if (Settings.CAST_MODEL_SHADOWS) {
                sofa.scene.traverse(node => {
                    if (node instanceof THREE.Mesh) {
                        node.receiveShadow = true;
                        node.castShadow = true;
                    }
                });
            }

            this.model = new THREE.Group();
            this.model.add(sofa.scene);
        });

        // We'll update the camera matrices directly from API, so disable matrix
        // auto updates so three.js doesn't attempt to handle the matrices
        // independently.
        this.camera = new THREE.PerspectiveCamera();
        this.camera.matrixAutoUpdate = false;

        // Add a Reticle object, which will help us find surfaces by drawing a
        // ring shape onto found surfaces. See source code of Reticle in
        // "utils.ts" for more details.
        this.reticle = new Reticle(this.session, this.camera);
        this.scene.add(this.reticle);

        this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
        this.session.requestAnimationFrame(this.onXRFrame);

        window.addEventListener('click', this.onClick);
    }

    /**
     * Load and create text geometry.
     */
    protected async loadText() {
        const [ titleText, description ] = await Promise.all([
            TextUtils.load3DText('SØFÄ', { fontFace: 'droid_sans', size: 0.10, bold: true }),
            TextUtils.load3DText('1,200 kr.', { size: 0.05 })
        ]);

        // Move the description label below the title:
        description.translateX(0.0125);
        description.translateY(-0.075);

        // Adjust position of the description text:
        // description.position.x += 0.125;
        // description.position.y -= 0.7;

        this.textGroup = new THREE.Group();
        this.textGroup.add(titleText);
        this.textGroup.add(description);
    }

    /**
     * Called on the XRSession's requestAnimationFrame.
     * Called with the time and XRPresentationFrame.
     */
    protected onXRFrame(time: number, frame: XRFrame): void {
        const session = frame.session;
        const pose = frame.getDevicePose(this.frameOfRef);

        // Update the reticle's position
        this.reticle.update(this.frameOfRef);

        // If the reticle has found a hit (is visible) and we have not yet
        // marked our app as stabilized, do so
        if (this.reticle.visible && !this.stabilized) {
            this.stabilized = true;
            document.body.classList.add('stabilized');
        }

        // Queue up the next frame
        session.requestAnimationFrame(this.onXRFrame);

        // Bind the framebuffer to our baseLayer's framebuffer
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);

        if (pose) {
            // Our XRFrame has an array of views. In the VR case, we'll have two
            // views, one for each eye. In mobile AR, however, we only have one
            // view.
            for (const view of frame.views) {
                const viewport = session.baseLayer.getViewport(view);
                this.renderer.setSize(viewport.width, viewport.height);

                // Set the view matrix and projection matrix from XRDevicePose
                // and XRView onto our THREE.Camera.
                this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                const viewMatrix = new THREE.Matrix4().fromArray(pose.getViewMatrix(view));
                this.camera.matrix.getInverse(viewMatrix);
                this.camera.updateMatrixWorld(true);

                this.renderer.clearDepth();

                // Render our scene with our THREE.WebGLRenderer
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    /**
     * This method is called when tapping on the page once an XRSession has
     * started. We're going to be firing a ray from the center of the screen,
     * and if a hit is found, use it to place our object at the point of
     * collision.
     */
    protected async onClick(e: MouseEvent) {
        // If our model is not yet loaded, abort:
        if (!this.model && !this.textGroup) {
            return;
        }

        const buttonElements = COLOR_PICKER_MAPPING
            .map(entry => document.getElementById(entry.buttonID));
        if (buttonElements.includes(e.target as HTMLElement)) {
            return;
        }

        // We're going to be firing a ray from the center of the screen. The
        // requestHitTest function takes an x and y coordinate in Normalized
        // Device Coordinates, where the upper left is (-1, 1) and the bottom
        // right is (1, -1). This makes (0, 0) our center.
        const x = 0;
        const y = 0;

        // Create a THREE.Raycaster if one doesn't already exist, and use it to
        // generate an origin and direction from our camera (device) using the
        // tap coordinates.
        // Learn more about THREE.Raycaster:
        // https://threejs.org/docs/#api/core/Raycaster
        this.raycaster = this.raycaster || new THREE.Raycaster();
        this.raycaster.setFromCamera({ x, y }, this.camera);
        const ray = this.raycaster.ray;

        // Fire the hit test to see if our ray collides with a real surface.
        // Note that we must turn our THREE.Vector3 origin and direction into an
        // array of x, y, and z values. The proposal for
        // `XRSession.prototype.requestHitTest` can be found here:
        // https://github.com/immersive-web/hit-test
        const origin = new Float32Array(ray.origin.toArray());
        const direction = new Float32Array(ray.direction.toArray());
        const hits = await this.session.requestHitTest(
            origin, direction, this.frameOfRef
        );

        // If we found at least one hit...
        if (hits.length > 0) {
            document.body.classList.add('placed');

            // We can have multiple collisions per hit test. Let's just take the
            // first hit, the nearest, for now.
            const hit = hits[0];

            // Our XRHitResult object has one property, `hitMatrix`, a
            // Float32Array(16) representing a 4x4 Matrix encoding position
            // where the ray hit an object, and the orientation has a Y-axis
            // that corresponds with the normal of the object at that location.
            // Turn this matrix into a THREE.Matrix4().
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

            // Now apply the position from the hitMatrix onto our model.
            this.model.position.setFromMatrixPosition(hitMatrix);

            this.textGroup.position.setFromMatrixPosition(hitMatrix);
            this.textGroup.translateX(1.2);
            this.textGroup.translateY(0.8);
            // this.reticle.visible = false;

            // Rather than using the rotation encoded by the `modelMatrix`,
            // rotate the model to face the camera. Use this utility to rotate
            // the model only on the Y axis.
            DemoUtils.lookAtOnY(this.model, this.camera);

            // Now that we've found a collision from the hit test, let's use the
            // Y position of that hit and assume that's the floor. We created a
            // mesh in `DemoUtils.createLitScene()` that receives shadows, so
            // set it's Y position to that of the hit matrix so that shadows
            // appear to be cast on the ground under the model.
            const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
            shadowMesh.position.y = this.model.position.y;

            // Ensure our model has been added to the scene.
            this.scene.add(this.model);

            // Set the initial sofa color to grey:
            this.setSofaColor(SofaColor.GREY);

            this.scene.add(this.textGroup);

            // this.revealModel();
        }
    }

    /**
     * Reveal the assets by having them move up from the floor.
     */
    protected revealModel(): void {
        let allTweensCompleted = false;
        const checkAllTweensCompleted = () => {
            allTweensCompleted = assetTweenCompleted && textTweenCompleted;
        };

        // Asset tween:
        let assetDeltaY = 0.0;
        const initialAssetPosition = { y: 0.0 };
        let assetTweenCompleted = false;
        const assetTween = new TWEEN.Tween(initialAssetPosition)
            .to({ y: 0.5 }, 2.5 * 1000)
            .onUpdate(() => {
                assetDeltaY = initialAssetPosition.y - assetDeltaY;
                this.model.translateY(assetDeltaY);
                assetDeltaY = initialAssetPosition.y;
            })
            .onComplete(() => {
                assetTweenCompleted = true;
                checkAllTweensCompleted();
            })
            .start();

        // Text tween:
        let textDeltaY = 0.0;
        const initialTextPosition = { y: 0.0 };
        let textTweenCompleted = false;
        const textTween = new TWEEN.Tween(initialTextPosition)
            .to({ y: 1.0 }, 2 * 1000)
            .delay(500)
            .onUpdate(() => {
                textDeltaY = initialTextPosition.y - textDeltaY;
                this.textGroup.translateY(textDeltaY);
                textDeltaY = initialTextPosition.y;
            })
            .onComplete(() => {
                textTweenCompleted = true;
                checkAllTweensCompleted();
            })
            .start();

        const animate = (time: number) => {
            if (!allTweensCompleted) {
                this.session.requestAnimationFrame(animate);
                TWEEN.update(time);
            }
        };

        this.session.requestAnimationFrame(animate);
    }

    /**
     * Bind click listeners to the UI buttons tasked with toggling the sofa's
     * color.
     */
    protected bindColorPickerListeners() {
        for (const colorPickerMap of COLOR_PICKER_MAPPING) {
            const { buttonID, sofaColor } = colorPickerMap;

            document.getElementById(buttonID).addEventListener('click', e => {
                e.preventDefault();
                this.setSofaColor(sofaColor);

                document.querySelector('#color-picker a.selected')
                    .classList.remove('selected');
                const button = e.target as HTMLElement;
                button.classList.add('selected');
            });
        }
    }

    /**
     * Set the sofa's color.
     *
     * @param color The color of the sofa model.
     */
    protected setSofaColor(color: SofaColor) {
        const sofa = this.scene.getObjectByName(Settings.MODEL_NAME)
        if (sofa !== undefined) {
            // The first material is the sofa's fabric color, the second one is
            // the sofa's feet color. Here we only care about changing the color
            // of the fabric:
            let materialIterator = 0;

            sofa.traverse(node => {
                if (node instanceof THREE.Mesh
                        && node.material instanceof THREE.MeshStandardMaterial
                        && materialIterator++ === 0) {
                    node.material.color = new THREE.Color(color);
                    node.material.needsUpdate = true;
                }
            });
        }
    }
}
