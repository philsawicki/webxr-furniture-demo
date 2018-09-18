interface DOMPointReadOnly {}
interface WebGL2RenderingContext {}

declare const TWEEN: any;


declare class WebXRPolyfill { }
declare class WebXRVersionShim { }
declare interface Window {
    WebXRPolyfill: WebXRPolyfill;
    WebXRVersionShim: WebXRVersionShim;
}

declare interface GLTFModel {
    animations: THREE.AnimationClip[];
    scene: THREE.Scene;
    scenes: THREE.Scene[];
    cameras: THREE.Camera[];
    asset: {}
}





declare interface Navigator {
    // Attributes
    readonly xr: XR;
}

/**
 * Device Enumeration
 */

interface XR extends EventTarget {
    // Methods
    requestDevice(): Promise<XRDevice>;

    // Events
    ondevicechange: EventHandlerNonNull;
}

interface XRDevice {
    // Methods
    supportsSession(options?: XRSessionCreationOptions): Promise<void>;
    requestSession(options?: XRSessionCreationOptions): Promise<XRSession>;
}

/**
 * Session
 */

interface XRSessionCreationOptions {
    // immersive: boolean; // Defaults to "false"
    outputContext: XRPresentationContext;

    // Non-standard
    environmentIntegration: boolean;
    immersive?: boolean; // Defaults to "false"
}
declare enum XREnvironmentBlendMode {
    'opaque' = 'opaque',
    'additive' = 'additive',
    'alpha-blend' = 'alpha-blend'
}
declare class XRSession extends EventTarget {
    // Attributes
    readonly device: XRDevice;
    readonly immersive: boolean;
    readonly outputContext: XRPresentationContext;
    readonly environmentBlendMode: XREnvironmentBlendMode;

    depthNear: number;
    depthFar: number;
    baseLayer: XRLayer;

    // Methods
    requestFrameOfReference(type: XRFrameOfReferenceType, options?: XRFrameOfReferenceOptions): Promise<XRFrameOfReference>;

    getInputSources(): XRInputSource[];

    requestAnimationFrame(callback: XRFrameRequestCallback): number;
    cancelAnimationFrame(handle: number): void;

    end(): Promise<void>;

    // Events
    onblur: EventHandlerNonNull;
    onfocus: EventHandlerNonNull;
    onresetpose: EventHandlerNonNull;
    onend: EventHandlerNonNull;
    onselect: EventHandlerNonNull;
    onselectstart: EventHandlerNonNull;
    onselectend: EventHandlerNonNull;

    // Non-standard
    requestHitTest: (origin: Float32Array, direction: Float32Array, frameOfRef: XRCoordinateSystem) => any;
}
declare type XRFrameRequestCallback = (time: number, frame:XRFrame) => void;

/**
 * Frame Loop
 */

interface XRFrame {
    readonly session: XRSession;
    readonly views: XRView[];

    getDevicePose(coordinateSystem: XRCoordinateSystem): XRDevicePose;
    getInputPose(inputSource: XRInputPose, coordinateSystem: XRCoordinateSystem): XRInputPose;
}
interface XRCoordinateSystem extends EventTarget {
    getTransformTo(other: XRCoordinateSystem): Float32Array;
}

/**
 * Coordinate Systems
 */

type XRFrameOfReferenceType = 'head-model' | 'eye-level' | 'stage';
declare interface XRFrameOfReferenceOptions {
    disableStageEmulation: boolean; // Defaults to "false"
    stageEmulationHeight: number; // Defaults to "0.0"
}
interface XRCoordinateSystem {}
interface XRFrameOfReference extends XRCoordinateSystem {
    // Attributes
    readonly bounds: XRStageBounds;
    readonly emulatedHeight: number;

    // Events
    onboundschange: EventHandlerNonNull;
}
interface XRStageBounds {
    // Attributes
    readonly geometry: DOMPointReadOnly[];
}

/**
 * Views
 */

declare enum XREye {
    'left' = 'left',
    'right' = 'right'
}
interface XRView {
    // Attributes
    readonly eye: XREye;
    readonly projectionMatrix: number[]; // Should be "Float32Array"
}
interface XRViewport {
    // Attributes
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * Pose
 */

interface XRDevicePose {
    // Attributes
    readonly poseModelMatrix: Float32Array;

    // Methods
    getViewMatrix(view: XRView): number[]; // Should be "Float32Array"
}

/**
 * Input
 */

declare enum XRHandedness {
    '',
    'left',
    'right'
}
declare enum XRTargetRayMode {
    'gaze',
    'tracked-pointer',
    'screen'
}
interface XRInputSource {
    // Attributes
    readonly handedness: XRHandedness;
    readonly targetRayMode: XRTargetRayMode;
}
interface XRRay {
    // Attributes
    readonly origin: DOMPointReadOnly;
    readonly direction: DOMPointReadOnly;
    readonly transformMatrix: Float32Array;
}
interface XRInputPose {
    // Attributes
    readonly emulatedPosition: boolean;
    readonly targetRay: XRRay;
    readonly gripMatrix: Float32Array;
}

/**
 * Layers
 */

type XRWebGLRenderingContext = WebGLRenderingContext | WebGL2RenderingContext;
type XRWebGLLayerInit = {
    antialias: boolean; // Defaults to "true"
    depth: boolean; // Defaults to "true"
    stencil: boolean; // Defaults to "false"
    alpha: boolean; // Defaults to "true"
    multiview: boolean; // Defaults to "false"
    framebufferScaleFactor: number; // Defaults to "1.0"
}
declare class XRLayer {
    // Non-standard
    readonly framebuffer: WebGLFramebuffer;

    // Methods
    getViewport(view: XRView): XRViewport;
}
declare class XRWebGLLayer extends XRLayer {
    // Attributes
    readonly contet: XRWebGLRenderingContext;

    readonly antialias: boolean;
    readonly depth: boolean;
    readonly stencil: boolean;
    readonly alpha: boolean;
    readonly multiview: boolean;

    // readonly framebuffer: WebGLFramebuffer;
    readonly framebufferwidth: number;
    readonly framebufferheight: number;

    // Methods
    // getViewport(view: XRView): XRViewport;
    requestViewportScaling(viewportScaleFactor: number): void;

    // Static methods
    getNativeFramebufferScaleFactor(session: XRSession): number; // "static"

    constructor(session: XRSession, context: XRWebGLRenderingContext);
}

declare interface WebGLContextAttributes { // Partial
    compatibleXRDevice: XRDevice; // Defaults to "null"
}
declare interface WebGLRenderingContext { // Partial
    setCompatibleXRDevice(device: XRDevice): Promise<void>;
}

/**
 * Canvas Rendering Context
 */

interface XRPresentationContext {
    // Attributes
    readonly canvas: HTMLCanvasElement;
}

/**
 * Events
 */

interface XRSessionEvent extends Event {
    // Attributes
    readonly session: XRSession;
}
interface XRSessionEventInit extends EventInit {
    session: XRSession;
}
interface XRInputSourceEvent extends Event {
    // Attributes
    readonly frame: XRFrame;
    readonly inputSource: XRInputSource;
}
interface XRInputSourceEventInit extends EventInit {
    frame: XRFrame;
    inputSource: XRInputSource;
}
interface XRCoordinateSystemEvent extends Event {
    // Attributes:
    readonly coordinateSystem: XRCoordinateSystem;
}
interface XRCoordinateSystemEventInit extends EventInit {
    coordinateSystem: XRCoordinateSystem;
}
