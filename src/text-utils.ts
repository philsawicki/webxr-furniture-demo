import * as THREE from 'three';


// tslint:disable-next-line:interface-name
interface TextOptions {
    size?: number;
    fontFace?: 'helvetiker' | 'droid_sans';
    height?: number;
    bold?: boolean;
    color?: number;
}

/**
 * Load a mesh for the given text.
 *
 * @param message Message to display.
 * @param options Text geometry options.
 * @return A Promise to be fulfilled with the mesh for the given text.
 */
export function load3DText(message: string, options?: TextOptions): Promise<THREE.Mesh> {
    const fontOptions = {
        size: options.size || 1.0,
        height: options.height || 0.01
    };
    const fontColor = options.color || 0xFFFFFF;
    const fontFace = options.fontFace || 'helvetiker';
    const fontStyle = options.bold ? 'bold' : 'regular';
    const fontURL = `fonts/${fontFace}_${fontStyle}.typeface.json`;

    const loader = new THREE.FontLoader();

    return new Promise((resolve, reject) => {
        loader.load(fontURL, font => {
            const textObject = new THREE.Mesh(
                new THREE.TextGeometry(message, {
                    ...fontOptions,
                    font,
                }),
                new THREE.MeshBasicMaterial({
                    color: fontColor,
                    transparent: true,
                    opacity: 1.0,
                    side: THREE.DoubleSide
                })
            );

            resolve(textObject);
        }, null, reject);
    });
}
