import * as THREE from 'three';
import * as DemoUtils from './utils';


/**
 * Surface reticle.
 */
export default class Reticle extends THREE.Object3D {
    protected ring: THREE.Mesh;
    protected session: XRSession;
    protected camera: THREE.Camera;
    protected raycaster: THREE.Raycaster;


    /**
     * Constructor.
     *
     * @param xrSession WebXR Session.
     * @param camera Camera used to render the scene.
     */
    constructor(xrSession: XRSession, camera: THREE.Camera) {
        super();

        const geometry = new THREE.RingBufferGeometry(0.1, 0.11, 32, 1);
        // Orient the geometry so its position is flat on a horizontal surface
        geometry.applyMatrix(
            new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-90))
        );

        this.ring = new THREE.Mesh(
            geometry,
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );

        this.add(this.ring);

        this.session = xrSession;
        this.visible = false;
        this.camera = camera;
        this.raycaster = new THREE.Raycaster();
    }

    /**
     * Fires a hit test in the middle of the screen and places the reticle upon
     * the surface if found.
     *
     * @param frameOfRef The frame of reference.
     */
    public async update(frameOfRef: XRCoordinateSystem): Promise<void> {
        this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
        const ray = this.raycaster.ray;

        const origin = new Float32Array(ray.origin.toArray());
        const direction = new Float32Array(ray.direction.toArray());
        const hits = await this.session.requestHitTest(
            origin, direction, frameOfRef
        );

        if (hits.length > 0) {
            const hit = hits[0];
            const hitMatrix = new THREE.Matrix4().fromArray(hit.hitMatrix);

            // Now apply the position from the hitMatrix onto our model:
            this.position.setFromMatrixPosition(hitMatrix);

            DemoUtils.lookAtOnY(this, this.camera);

            this.visible = true;
        }
    }
}
