(function (THREE$1) {
    'use strict';

    /**
     * @author Rich Tibbett / https://github.com/richtr
     * @author mrdoob / http://mrdoob.com/
     * @author Tony Parisi / http://www.tonyparisi.com/
     * @author Takahiro / https://github.com/takahirox
     * @author Don McCurdy / https://www.donmccurdy.com
     */

    const GLTFLoader = ( function () {

        function GLTFLoader( manager ) {

            this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;
            this.dracoLoader = null;

        }

        GLTFLoader.prototype = {

            constructor: GLTFLoader,

            crossOrigin: 'anonymous',

            load: function ( url, onLoad, onProgress, onError ) {

                var scope = this;

                var path = this.path !== undefined ? this.path : THREE.LoaderUtils.extractUrlBase( url );

                // Tells the LoadingManager to track an extra item, which resolves after
                // the model is fully loaded. This means the count of items loaded will
                // be incorrect, but ensures manager.onLoad() does not fire early.
                scope.manager.itemStart( url );

                var _onError = function ( e ) {

                    if ( onError ) {

                        onError( e );

                    } else {

                        console.error( e );

                    }

                    scope.manager.itemEnd( url );
                    scope.manager.itemError( url );

                };

                var loader = new THREE.FileLoader( scope.manager );

                loader.setResponseType( 'arraybuffer' );

                loader.load( url, function ( data ) {

                    try {

                        scope.parse( data, path, function ( gltf ) {

                            onLoad( gltf );

                            scope.manager.itemEnd( url );

                        }, _onError );

                    } catch ( e ) {

                        _onError( e );

                    }

                }, onProgress, _onError );

            },

            setCrossOrigin: function ( value ) {

                this.crossOrigin = value;
                return this;

            },

            setPath: function ( value ) {

                this.path = value;
                return this;

            },

            setDRACOLoader: function ( dracoLoader ) {

                this.dracoLoader = dracoLoader;
                return this;

            },

            parse: function ( data, path, onLoad, onError ) {

                var content;
                var extensions = {};

                if ( typeof data === 'string' ) {

                    content = data;

                } else {

                    var magic = THREE.LoaderUtils.decodeText( new Uint8Array( data, 0, 4 ) );

                    if ( magic === BINARY_EXTENSION_HEADER_MAGIC ) {

                        try {

                            extensions[ EXTENSIONS.KHR_BINARY_GLTF ] = new GLTFBinaryExtension( data );

                        } catch ( error ) {

                            if ( onError ) onError( error );
                            return;

                        }

                        content = extensions[ EXTENSIONS.KHR_BINARY_GLTF ].content;

                    } else {

                        content = THREE.LoaderUtils.decodeText( new Uint8Array( data ) );

                    }

                }

                var json = JSON.parse( content );

                if ( json.asset === undefined || json.asset.version[ 0 ] < 2 ) {

                    if ( onError ) onError( new Error( 'THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported. Use LegacyGLTFLoader instead.' ) );
                    return;

                }

                if ( json.extensionsUsed ) {

                    for ( var i = 0; i < json.extensionsUsed.length; ++ i ) {

                        var extensionName = json.extensionsUsed[ i ];
                        var extensionsRequired = json.extensionsRequired || [];

                        switch ( extensionName ) {

                            case EXTENSIONS.KHR_LIGHTS_PUNCTUAL:
                                extensions[ extensionName ] = new GLTFLightsExtension( json );
                                break;

                            case EXTENSIONS.KHR_MATERIALS_UNLIT:
                                extensions[ extensionName ] = new GLTFMaterialsUnlitExtension( json );
                                break;

                            case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
                                extensions[ extensionName ] = new GLTFMaterialsPbrSpecularGlossinessExtension();
                                break;

                            case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
                                extensions[ extensionName ] = new GLTFDracoMeshCompressionExtension( json, this.dracoLoader );
                                break;

                            case EXTENSIONS.MSFT_TEXTURE_DDS:
                                extensions[ EXTENSIONS.MSFT_TEXTURE_DDS ] = new GLTFTextureDDSExtension();
                                break;

                            default:

                                if ( extensionsRequired.indexOf( extensionName ) >= 0 ) {

                                    console.warn( 'THREE.GLTFLoader: Unknown extension "' + extensionName + '".' );

                                }

                        }

                    }

                }

                var parser = new GLTFParser( json, extensions, {

                    path: path || this.path || '',
                    crossOrigin: this.crossOrigin,
                    manager: this.manager

                } );

                parser.parse( function ( scene, scenes, cameras, animations, json ) {

                    var glTF = {
                        scene: scene,
                        scenes: scenes,
                        cameras: cameras,
                        animations: animations,
                        asset: json.asset,
                        parser: parser,
                        userData: {}
                    };

                    addUnknownExtensionsToUserData( extensions, glTF, json );

                    onLoad( glTF );

                }, onError );

            }

        };

        /* GLTFREGISTRY */

        function GLTFRegistry() {

            var objects = {};

            return	{

                get: function ( key ) {

                    return objects[ key ];

                },

                add: function ( key, object ) {

                    objects[ key ] = object;

                },

                remove: function ( key ) {

                    delete objects[ key ];

                },

                removeAll: function () {

                    objects = {};

                }

            };

        }

        /*********************************/
        /********** EXTENSIONS ***********/
        /*********************************/

        var EXTENSIONS = {
            KHR_BINARY_GLTF: 'KHR_binary_glTF',
            KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
            KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
            KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
            KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
            MSFT_TEXTURE_DDS: 'MSFT_texture_dds'
        };

        /**
         * DDS Texture Extension
         *
         * Specification:
         * https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/MSFT_texture_dds
         *
         */
        function GLTFTextureDDSExtension() {

            if ( ! THREE.DDSLoader ) {

                throw new Error( 'THREE.GLTFLoader: Attempting to load .dds texture without importing THREE.DDSLoader' );

            }

            this.name = EXTENSIONS.MSFT_TEXTURE_DDS;
            this.ddsLoader = new THREE.DDSLoader();

        }

        /**
         * Lights Extension
         *
         * Specification: PENDING
         */
        function GLTFLightsExtension( json ) {

            this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL;

            this.lights = [];

            var extension = ( json.extensions && json.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ] ) || {};
            var lightDefs = extension.lights || [];

            for ( var i = 0; i < lightDefs.length; i ++ ) {

                var lightDef = lightDefs[ i ];
                var lightNode;

                var color = new THREE.Color( 0xffffff );
                if ( lightDef.color !== undefined ) color.fromArray( lightDef.color );

                var range = lightDef.range !== undefined ? lightDef.range : 0;

                switch ( lightDef.type ) {

                    case 'directional':
                        lightNode = new THREE.DirectionalLight( color );
                        lightNode.target.position.set( 0, 0, 1 );
                        lightNode.add( lightNode.target );
                        break;

                    case 'point':
                        lightNode = new THREE.PointLight( color );
                        lightNode.distance = range;
                        break;

                    case 'spot':
                        lightNode = new THREE.SpotLight( color );
                        lightNode.distance = range;
                        // Handle spotlight properties.
                        lightDef.spot = lightDef.spot || {};
                        lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0;
                        lightDef.spot.outerConeAngle = lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0;
                        lightNode.angle = lightDef.spot.outerConeAngle;
                        lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle;
                        lightNode.target.position.set( 0, 0, 1 );
                        lightNode.add( lightNode.target );
                        break;

                    default:
                        throw new Error( 'THREE.GLTFLoader: Unexpected light type, "' + lightDef.type + '".' );

                }

                lightNode.decay = 2;

                if ( lightDef.intensity !== undefined ) lightNode.intensity = lightDef.intensity;

                lightNode.name = lightDef.name || ( 'light_' + i );

                this.lights.push( lightNode );

            }

        }

        /**
         * Unlit Materials Extension (pending)
         *
         * PR: https://github.com/KhronosGroup/glTF/pull/1163
         */
        function GLTFMaterialsUnlitExtension( json ) {

            this.name = EXTENSIONS.KHR_MATERIALS_UNLIT;

        }

        GLTFMaterialsUnlitExtension.prototype.getMaterialType = function ( material ) {

            return THREE.MeshBasicMaterial;

        };

        GLTFMaterialsUnlitExtension.prototype.extendParams = function ( materialParams, material, parser ) {

            var pending = [];

            materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
            materialParams.opacity = 1.0;

            var metallicRoughness = material.pbrMetallicRoughness;

            if ( metallicRoughness ) {

                if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

                    var array = metallicRoughness.baseColorFactor;

                    materialParams.color.fromArray( array );
                    materialParams.opacity = array[ 3 ];

                }

                if ( metallicRoughness.baseColorTexture !== undefined ) {

                    pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture.index ) );

                }

            }

            return Promise.all( pending );

        };
        var BINARY_EXTENSION_HEADER_MAGIC = 'glTF';
        var BINARY_EXTENSION_HEADER_LENGTH = 12;
        var BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4E4F534A, BIN: 0x004E4942 };

        function GLTFBinaryExtension( data ) {

            this.name = EXTENSIONS.KHR_BINARY_GLTF;
            this.content = null;
            this.body = null;

            var headerView = new DataView( data, 0, BINARY_EXTENSION_HEADER_LENGTH );

            this.header = {
                magic: THREE.LoaderUtils.decodeText( new Uint8Array( data.slice( 0, 4 ) ) ),
                version: headerView.getUint32( 4, true ),
                length: headerView.getUint32( 8, true )
            };

            if ( this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC ) {

                throw new Error( 'THREE.GLTFLoader: Unsupported glTF-Binary header.' );

            } else if ( this.header.version < 2.0 ) {

                throw new Error( 'THREE.GLTFLoader: Legacy binary file detected. Use LegacyGLTFLoader instead.' );

            }

            var chunkView = new DataView( data, BINARY_EXTENSION_HEADER_LENGTH );
            var chunkIndex = 0;

            while ( chunkIndex < chunkView.byteLength ) {

                var chunkLength = chunkView.getUint32( chunkIndex, true );
                chunkIndex += 4;

                var chunkType = chunkView.getUint32( chunkIndex, true );
                chunkIndex += 4;

                if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON ) {

                    var contentArray = new Uint8Array( data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength );
                    this.content = THREE.LoaderUtils.decodeText( contentArray );

                } else if ( chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN ) {

                    var byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex;
                    this.body = data.slice( byteOffset, byteOffset + chunkLength );

                }

                // Clients must ignore chunks with unknown types.

                chunkIndex += chunkLength;

            }

            if ( this.content === null ) {

                throw new Error( 'THREE.GLTFLoader: JSON content not found.' );

            }

        }

        /**
         * DRACO Mesh Compression Extension
         *
         * Specification: https://github.com/KhronosGroup/glTF/pull/874
         */
        function GLTFDracoMeshCompressionExtension( json, dracoLoader ) {

            if ( ! dracoLoader ) {

                throw new Error( 'THREE.GLTFLoader: No DRACOLoader instance provided.' );

            }

            this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION;
            this.json = json;
            this.dracoLoader = dracoLoader;

        }

        GLTFDracoMeshCompressionExtension.prototype.decodePrimitive = function ( primitive, parser ) {

            var json = this.json;
            var dracoLoader = this.dracoLoader;
            var bufferViewIndex = primitive.extensions[ this.name ].bufferView;
            var gltfAttributeMap = primitive.extensions[ this.name ].attributes;
            var threeAttributeMap = {};
            var attributeNormalizedMap = {};
            var attributeTypeMap = {};

            for ( var attributeName in gltfAttributeMap ) {

                if ( ! ( attributeName in ATTRIBUTES ) ) continue;

                threeAttributeMap[ ATTRIBUTES[ attributeName ] ] = gltfAttributeMap[ attributeName ];

            }

            for ( attributeName in primitive.attributes ) {

                if ( ATTRIBUTES[ attributeName ] !== undefined && gltfAttributeMap[ attributeName ] !== undefined ) {

                    var accessorDef = json.accessors[ primitive.attributes[ attributeName ] ];
                    var componentType = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

                    attributeTypeMap[ ATTRIBUTES[ attributeName ] ] = componentType;
                    attributeNormalizedMap[ ATTRIBUTES[ attributeName ] ] = accessorDef.normalized === true;

                }

            }

            return parser.getDependency( 'bufferView', bufferViewIndex ).then( function ( bufferView ) {

                return new Promise( function ( resolve ) {

                    dracoLoader.decodeDracoFile( bufferView, function ( geometry ) {

                        for ( var attributeName in geometry.attributes ) {

                            var attribute = geometry.attributes[ attributeName ];
                            var normalized = attributeNormalizedMap[ attributeName ];

                            if ( normalized !== undefined ) attribute.normalized = normalized;

                        }

                        resolve( geometry );

                    }, threeAttributeMap, attributeTypeMap );

                } );

            } );

        };

        /**
         * Specular-Glossiness Extension
         *
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
         */
        function GLTFMaterialsPbrSpecularGlossinessExtension() {

            return {

                name: EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS,

                specularGlossinessParams: [
                    'color',
                    'map',
                    'lightMap',
                    'lightMapIntensity',
                    'aoMap',
                    'aoMapIntensity',
                    'emissive',
                    'emissiveIntensity',
                    'emissiveMap',
                    'bumpMap',
                    'bumpScale',
                    'normalMap',
                    'displacementMap',
                    'displacementScale',
                    'displacementBias',
                    'specularMap',
                    'specular',
                    'glossinessMap',
                    'glossiness',
                    'alphaMap',
                    'envMap',
                    'envMapIntensity',
                    'refractionRatio',
                ],

                getMaterialType: function () {

                    return THREE.ShaderMaterial;

                },

                extendParams: function ( params, material, parser ) {

                    var pbrSpecularGlossiness = material.extensions[ this.name ];

                    var shader = THREE.ShaderLib[ 'standard' ];

                    var uniforms = THREE.UniformsUtils.clone( shader.uniforms );

                    var specularMapParsFragmentChunk = [
                        '#ifdef USE_SPECULARMAP',
                        '	uniform sampler2D specularMap;',
                        '#endif'
                    ].join( '\n' );

                    var glossinessMapParsFragmentChunk = [
                        '#ifdef USE_GLOSSINESSMAP',
                        '	uniform sampler2D glossinessMap;',
                        '#endif'
                    ].join( '\n' );

                    var specularMapFragmentChunk = [
                        'vec3 specularFactor = specular;',
                        '#ifdef USE_SPECULARMAP',
                        '	vec4 texelSpecular = texture2D( specularMap, vUv );',
                        '	texelSpecular = sRGBToLinear( texelSpecular );',
                        '	// reads channel RGB, compatible with a glTF Specular-Glossiness (RGBA) texture',
                        '	specularFactor *= texelSpecular.rgb;',
                        '#endif'
                    ].join( '\n' );

                    var glossinessMapFragmentChunk = [
                        'float glossinessFactor = glossiness;',
                        '#ifdef USE_GLOSSINESSMAP',
                        '	vec4 texelGlossiness = texture2D( glossinessMap, vUv );',
                        '	// reads channel A, compatible with a glTF Specular-Glossiness (RGBA) texture',
                        '	glossinessFactor *= texelGlossiness.a;',
                        '#endif'
                    ].join( '\n' );

                    var lightPhysicalFragmentChunk = [
                        'PhysicalMaterial material;',
                        'material.diffuseColor = diffuseColor.rgb;',
                        'material.specularRoughness = clamp( 1.0 - glossinessFactor, 0.04, 1.0 );',
                        'material.specularColor = specularFactor.rgb;',
                    ].join( '\n' );

                    var fragmentShader = shader.fragmentShader
                        .replace( 'uniform float roughness;', 'uniform vec3 specular;' )
                        .replace( 'uniform float metalness;', 'uniform float glossiness;' )
                        .replace( '#include <roughnessmap_pars_fragment>', specularMapParsFragmentChunk )
                        .replace( '#include <metalnessmap_pars_fragment>', glossinessMapParsFragmentChunk )
                        .replace( '#include <roughnessmap_fragment>', specularMapFragmentChunk )
                        .replace( '#include <metalnessmap_fragment>', glossinessMapFragmentChunk )
                        .replace( '#include <lights_physical_fragment>', lightPhysicalFragmentChunk );

                    delete uniforms.roughness;
                    delete uniforms.metalness;
                    delete uniforms.roughnessMap;
                    delete uniforms.metalnessMap;

                    uniforms.specular = { value: new THREE.Color().setHex( 0x111111 ) };
                    uniforms.glossiness = { value: 0.5 };
                    uniforms.specularMap = { value: null };
                    uniforms.glossinessMap = { value: null };

                    params.vertexShader = shader.vertexShader;
                    params.fragmentShader = fragmentShader;
                    params.uniforms = uniforms;
                    params.defines = { 'STANDARD': '' };

                    params.color = new THREE.Color( 1.0, 1.0, 1.0 );
                    params.opacity = 1.0;

                    var pending = [];

                    if ( Array.isArray( pbrSpecularGlossiness.diffuseFactor ) ) {

                        var array = pbrSpecularGlossiness.diffuseFactor;

                        params.color.fromArray( array );
                        params.opacity = array[ 3 ];

                    }

                    if ( pbrSpecularGlossiness.diffuseTexture !== undefined ) {

                        pending.push( parser.assignTexture( params, 'map', pbrSpecularGlossiness.diffuseTexture.index ) );

                    }

                    params.emissive = new THREE.Color( 0.0, 0.0, 0.0 );
                    params.glossiness = pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0;
                    params.specular = new THREE.Color( 1.0, 1.0, 1.0 );

                    if ( Array.isArray( pbrSpecularGlossiness.specularFactor ) ) {

                        params.specular.fromArray( pbrSpecularGlossiness.specularFactor );

                    }

                    if ( pbrSpecularGlossiness.specularGlossinessTexture !== undefined ) {

                        var specGlossIndex = pbrSpecularGlossiness.specularGlossinessTexture.index;
                        pending.push( parser.assignTexture( params, 'glossinessMap', specGlossIndex ) );
                        pending.push( parser.assignTexture( params, 'specularMap', specGlossIndex ) );

                    }

                    return Promise.all( pending );

                },

                createMaterial: function ( params ) {

                    // setup material properties based on MeshStandardMaterial for Specular-Glossiness

                    var material = new THREE.ShaderMaterial( {
                        defines: params.defines,
                        vertexShader: params.vertexShader,
                        fragmentShader: params.fragmentShader,
                        uniforms: params.uniforms,
                        fog: true,
                        lights: true,
                        opacity: params.opacity,
                        transparent: params.transparent
                    } );

                    material.isGLTFSpecularGlossinessMaterial = true;

                    material.color = params.color;

                    material.map = params.map === undefined ? null : params.map;

                    material.lightMap = null;
                    material.lightMapIntensity = 1.0;

                    material.aoMap = params.aoMap === undefined ? null : params.aoMap;
                    material.aoMapIntensity = 1.0;

                    material.emissive = params.emissive;
                    material.emissiveIntensity = 1.0;
                    material.emissiveMap = params.emissiveMap === undefined ? null : params.emissiveMap;

                    material.bumpMap = params.bumpMap === undefined ? null : params.bumpMap;
                    material.bumpScale = 1;

                    material.normalMap = params.normalMap === undefined ? null : params.normalMap;
                    if ( params.normalScale ) material.normalScale = params.normalScale;

                    material.displacementMap = null;
                    material.displacementScale = 1;
                    material.displacementBias = 0;

                    material.specularMap = params.specularMap === undefined ? null : params.specularMap;
                    material.specular = params.specular;

                    material.glossinessMap = params.glossinessMap === undefined ? null : params.glossinessMap;
                    material.glossiness = params.glossiness;

                    material.alphaMap = null;

                    material.envMap = params.envMap === undefined ? null : params.envMap;
                    material.envMapIntensity = 1.0;

                    material.refractionRatio = 0.98;

                    material.extensions.derivatives = true;

                    return material;

                },

                /**
                 * Clones a GLTFSpecularGlossinessMaterial instance. The ShaderMaterial.copy() method can
                 * copy only properties it knows about or inherits, and misses many properties that would
                 * normally be defined by MeshStandardMaterial.
                 *
                 * This method allows GLTFSpecularGlossinessMaterials to be cloned in the process of
                 * loading a glTF model, but cloning later (e.g. by the user) would require these changes
                 * AND also updating `.onBeforeRender` on the parent mesh.
                 *
                 * @param  {THREE.ShaderMaterial} source
                 * @return {THREE.ShaderMaterial}
                 */
                cloneMaterial: function ( source ) {

                    var target = source.clone();

                    target.isGLTFSpecularGlossinessMaterial = true;

                    var params = this.specularGlossinessParams;

                    for ( var i = 0, il = params.length; i < il; i ++ ) {

                        target[ params[ i ] ] = source[ params[ i ] ];

                    }

                    return target;

                },

                // Here's based on refreshUniformsCommon() and refreshUniformsStandard() in WebGLRenderer.
                refreshUniforms: function ( renderer, scene, camera, geometry, material, group ) {

                    if ( material.isGLTFSpecularGlossinessMaterial !== true ) {

                        return;

                    }

                    var uniforms = material.uniforms;
                    var defines = material.defines;

                    uniforms.opacity.value = material.opacity;

                    uniforms.diffuse.value.copy( material.color );
                    uniforms.emissive.value.copy( material.emissive ).multiplyScalar( material.emissiveIntensity );

                    uniforms.map.value = material.map;
                    uniforms.specularMap.value = material.specularMap;
                    uniforms.alphaMap.value = material.alphaMap;

                    uniforms.lightMap.value = material.lightMap;
                    uniforms.lightMapIntensity.value = material.lightMapIntensity;

                    uniforms.aoMap.value = material.aoMap;
                    uniforms.aoMapIntensity.value = material.aoMapIntensity;

                    // uv repeat and offset setting priorities
                    // 1. color map
                    // 2. specular map
                    // 3. normal map
                    // 4. bump map
                    // 5. alpha map
                    // 6. emissive map

                    var uvScaleMap;

                    if ( material.map ) {

                        uvScaleMap = material.map;

                    } else if ( material.specularMap ) {

                        uvScaleMap = material.specularMap;

                    } else if ( material.displacementMap ) {

                        uvScaleMap = material.displacementMap;

                    } else if ( material.normalMap ) {

                        uvScaleMap = material.normalMap;

                    } else if ( material.bumpMap ) {

                        uvScaleMap = material.bumpMap;

                    } else if ( material.glossinessMap ) {

                        uvScaleMap = material.glossinessMap;

                    } else if ( material.alphaMap ) {

                        uvScaleMap = material.alphaMap;

                    } else if ( material.emissiveMap ) {

                        uvScaleMap = material.emissiveMap;

                    }

                    if ( uvScaleMap !== undefined ) {

                        // backwards compatibility
                        if ( uvScaleMap.isWebGLRenderTarget ) {

                            uvScaleMap = uvScaleMap.texture;

                        }

                        if ( uvScaleMap.matrixAutoUpdate === true ) {

                            uvScaleMap.updateMatrix();

                        }

                        uniforms.uvTransform.value.copy( uvScaleMap.matrix );

                    }

                    uniforms.envMap.value = material.envMap;
                    uniforms.envMapIntensity.value = material.envMapIntensity;
                    uniforms.flipEnvMap.value = ( material.envMap && material.envMap.isCubeTexture ) ? - 1 : 1;

                    uniforms.refractionRatio.value = material.refractionRatio;

                    uniforms.specular.value.copy( material.specular );
                    uniforms.glossiness.value = material.glossiness;

                    uniforms.glossinessMap.value = material.glossinessMap;

                    uniforms.emissiveMap.value = material.emissiveMap;
                    uniforms.bumpMap.value = material.bumpMap;
                    uniforms.normalMap.value = material.normalMap;

                    uniforms.displacementMap.value = material.displacementMap;
                    uniforms.displacementScale.value = material.displacementScale;
                    uniforms.displacementBias.value = material.displacementBias;

                    if ( uniforms.glossinessMap.value !== null && defines.USE_GLOSSINESSMAP === undefined ) {

                        defines.USE_GLOSSINESSMAP = '';
                        // set USE_ROUGHNESSMAP to enable vUv
                        defines.USE_ROUGHNESSMAP = '';

                    }

                    if ( uniforms.glossinessMap.value === null && defines.USE_GLOSSINESSMAP !== undefined ) {

                        delete defines.USE_GLOSSINESSMAP;
                        delete defines.USE_ROUGHNESSMAP;

                    }

                }

            };

        }

        /*********************************/
        /********** INTERPOLATION ********/
        /*********************************/

        // Spline Interpolation
        // Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
        function GLTFCubicSplineInterpolant( parameterPositions, sampleValues, sampleSize, resultBuffer ) {

            THREE.Interpolant.call( this, parameterPositions, sampleValues, sampleSize, resultBuffer );

        }

        GLTFCubicSplineInterpolant.prototype = Object.create( THREE.Interpolant.prototype );
        GLTFCubicSplineInterpolant.prototype.constructor = GLTFCubicSplineInterpolant;

        GLTFCubicSplineInterpolant.prototype.copySampleValue_ = function ( index ) {

            // Copies a sample value to the result buffer. See description of glTF
            // CUBICSPLINE values layout in interpolate_() function below.

            var result = this.resultBuffer,
                values = this.sampleValues,
                valueSize = this.valueSize,
                offset = index * valueSize * 3 + valueSize;

            for ( var i = 0; i !== valueSize; i ++ ) {

                result[ i ] = values[ offset + i ];

            }

            return result;

        };

        GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

        GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_;

        GLTFCubicSplineInterpolant.prototype.interpolate_ = function ( i1, t0, t, t1 ) {

            var result = this.resultBuffer;
            var values = this.sampleValues;
            var stride = this.valueSize;

            var stride2 = stride * 2;
            var stride3 = stride * 3;

            var td = t1 - t0;

            var p = ( t - t0 ) / td;
            var pp = p * p;
            var ppp = pp * p;

            var offset1 = i1 * stride3;
            var offset0 = offset1 - stride3;

            var s0 = 2 * ppp - 3 * pp + 1;
            var s1 = ppp - 2 * pp + p;
            var s2 = - 2 * ppp + 3 * pp;
            var s3 = ppp - pp;

            // Layout of keyframe output values for CUBICSPLINE animations:
            //   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
            for ( var i = 0; i !== stride; i ++ ) {

                var p0 = values[ offset0 + i + stride ]; // splineVertex_k
                var m0 = values[ offset0 + i + stride2 ] * td; // outTangent_k * (t_k+1 - t_k)
                var p1 = values[ offset1 + i + stride ]; // splineVertex_k+1
                var m1 = values[ offset1 + i ] * td; // inTangent_k+1 * (t_k+1 - t_k)

                result[ i ] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1;

            }

            return result;

        };

        /*********************************/
        /********** INTERNALS ************/
        /*********************************/

        /* CONSTANTS */

        var WEBGL_CONSTANTS = {
            FLOAT: 5126,
            //FLOAT_MAT2: 35674,
            FLOAT_MAT3: 35675,
            FLOAT_MAT4: 35676,
            FLOAT_VEC2: 35664,
            FLOAT_VEC3: 35665,
            FLOAT_VEC4: 35666,
            LINEAR: 9729,
            REPEAT: 10497,
            SAMPLER_2D: 35678,
            POINTS: 0,
            LINES: 1,
            LINE_LOOP: 2,
            LINE_STRIP: 3,
            TRIANGLES: 4,
            TRIANGLE_STRIP: 5,
            TRIANGLE_FAN: 6,
            UNSIGNED_BYTE: 5121,
            UNSIGNED_SHORT: 5123
        };

        var WEBGL_TYPE = {
            5126: Number,
            //35674: THREE.Matrix2,
            35675: THREE.Matrix3,
            35676: THREE.Matrix4,
            35664: THREE.Vector2,
            35665: THREE.Vector3,
            35666: THREE.Vector4,
            35678: THREE.Texture
        };

        var WEBGL_COMPONENT_TYPES = {
            5120: Int8Array,
            5121: Uint8Array,
            5122: Int16Array,
            5123: Uint16Array,
            5125: Uint32Array,
            5126: Float32Array
        };

        var WEBGL_FILTERS = {
            9728: THREE.NearestFilter,
            9729: THREE.LinearFilter,
            9984: THREE.NearestMipMapNearestFilter,
            9985: THREE.LinearMipMapNearestFilter,
            9986: THREE.NearestMipMapLinearFilter,
            9987: THREE.LinearMipMapLinearFilter
        };

        var WEBGL_WRAPPINGS = {
            33071: THREE.ClampToEdgeWrapping,
            33648: THREE.MirroredRepeatWrapping,
            10497: THREE.RepeatWrapping
        };

        var WEBGL_SIDES = {
            1028: THREE.BackSide, // Culling front
            1029: THREE.FrontSide // Culling back
            //1032: THREE.NoSide   // Culling front and back, what to do?
        };

        var WEBGL_DEPTH_FUNCS = {
            512: THREE.NeverDepth,
            513: THREE.LessDepth,
            514: THREE.EqualDepth,
            515: THREE.LessEqualDepth,
            516: THREE.GreaterEqualDepth,
            517: THREE.NotEqualDepth,
            518: THREE.GreaterEqualDepth,
            519: THREE.AlwaysDepth
        };

        var WEBGL_BLEND_EQUATIONS = {
            32774: THREE.AddEquation,
            32778: THREE.SubtractEquation,
            32779: THREE.ReverseSubtractEquation
        };

        var WEBGL_BLEND_FUNCS = {
            0: THREE.ZeroFactor,
            1: THREE.OneFactor,
            768: THREE.SrcColorFactor,
            769: THREE.OneMinusSrcColorFactor,
            770: THREE.SrcAlphaFactor,
            771: THREE.OneMinusSrcAlphaFactor,
            772: THREE.DstAlphaFactor,
            773: THREE.OneMinusDstAlphaFactor,
            774: THREE.DstColorFactor,
            775: THREE.OneMinusDstColorFactor,
            776: THREE.SrcAlphaSaturateFactor
            // The followings are not supported by Three.js yet
            //32769: CONSTANT_COLOR,
            //32770: ONE_MINUS_CONSTANT_COLOR,
            //32771: CONSTANT_ALPHA,
            //32772: ONE_MINUS_CONSTANT_COLOR
        };

        var WEBGL_TYPE_SIZES = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        };

        var ATTRIBUTES = {
            POSITION: 'position',
            NORMAL: 'normal',
            TEXCOORD_0: 'uv',
            TEXCOORD0: 'uv', // deprecated
            TEXCOORD: 'uv', // deprecated
            TEXCOORD_1: 'uv2',
            COLOR_0: 'color',
            COLOR0: 'color', // deprecated
            COLOR: 'color', // deprecated
            WEIGHTS_0: 'skinWeight',
            WEIGHT: 'skinWeight', // deprecated
            JOINTS_0: 'skinIndex',
            JOINT: 'skinIndex' // deprecated
        };

        var PATH_PROPERTIES = {
            scale: 'scale',
            translation: 'position',
            rotation: 'quaternion',
            weights: 'morphTargetInfluences'
        };

        var INTERPOLATION = {
            CUBICSPLINE: THREE.InterpolateSmooth, // We use custom interpolation GLTFCubicSplineInterpolation for CUBICSPLINE.
                                                  // KeyframeTrack.optimize() can't handle glTF Cubic Spline output values layout,
                                                  // using THREE.InterpolateSmooth for KeyframeTrack instantiation to prevent optimization.
                                                  // See KeyframeTrack.optimize() for the detail.
            LINEAR: THREE.InterpolateLinear,
            STEP: THREE.InterpolateDiscrete
        };

        var ALPHA_MODES = {
            OPAQUE: 'OPAQUE',
            MASK: 'MASK',
            BLEND: 'BLEND'
        };

        var MIME_TYPE_FORMATS = {
            'image/png': THREE.RGBAFormat,
            'image/jpeg': THREE.RGBFormat
        };

        /* UTILITY FUNCTIONS */

        function resolveURL( url, path ) {

            // Invalid URL
            if ( typeof url !== 'string' || url === '' ) return '';

            // Absolute URL http://,https://,//
            if ( /^(https?:)?\/\//i.test( url ) ) return url;

            // Data URI
            if ( /^data:.*,.*$/i.test( url ) ) return url;

            // Blob URL
            if ( /^blob:.*$/i.test( url ) ) return url;

            // Relative URL
            return path + url;

        }

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
         */
        function createDefaultMaterial() {

            return new THREE.MeshStandardMaterial( {
                color: 0xFFFFFF,
                emissive: 0x000000,
                metalness: 1,
                roughness: 1,
                transparent: false,
                depthTest: true,
                side: THREE.FrontSide
            } );

        }

        function addUnknownExtensionsToUserData( knownExtensions, object, objectDef ) {

            // Add unknown glTF extensions to an object's userData.

            for ( var name in objectDef.extensions ) {

                if ( knownExtensions[ name ] === undefined ) {

                    object.userData.gltfExtensions = object.userData.gltfExtensions || {};
                    object.userData.gltfExtensions[ name ] = objectDef.extensions[ name ];

                }

            }

        }

        /**
         * @param {THREE.Object3D|THREE.Material|THREE.BufferGeometry} object
         * @param {GLTF.definition} def
         */
        function assignExtrasToUserData( object, gltfDef ) {

            if ( gltfDef.extras !== undefined ) {

                if ( typeof gltfDef.extras === 'object' ) {

                    object.userData = gltfDef.extras;

                } else {

                    console.warn( 'THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras );

                }

            }

        }

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
         *
         * @param {THREE.BufferGeometry} geometry
         * @param {Array<GLTF.Target>} targets
         * @param {Array<THREE.BufferAttribute>} accessors
         */
        function addMorphTargets( geometry, targets, accessors ) {

            var hasMorphPosition = false;
            var hasMorphNormal = false;

            for ( var i = 0, il = targets.length; i < il; i ++ ) {

                var target = targets[ i ];

                if ( target.POSITION !== undefined ) hasMorphPosition = true;
                if ( target.NORMAL !== undefined ) hasMorphNormal = true;

                if ( hasMorphPosition && hasMorphNormal ) break;

            }

            if ( ! hasMorphPosition && ! hasMorphNormal ) return;

            var morphPositions = [];
            var morphNormals = [];

            for ( var i = 0, il = targets.length; i < il; i ++ ) {

                var target = targets[ i ];
                var attributeName = 'morphTarget' + i;

                if ( hasMorphPosition ) {

                    // Three.js morph position is absolute value. The formula is
                    //   basePosition
                    //     + weight0 * ( morphPosition0 - basePosition )
                    //     + weight1 * ( morphPosition1 - basePosition )
                    //     ...
                    // while the glTF one is relative
                    //   basePosition
                    //     + weight0 * glTFmorphPosition0
                    //     + weight1 * glTFmorphPosition1
                    //     ...
                    // then we need to convert from relative to absolute here.

                    if ( target.POSITION !== undefined ) {

                        // Cloning not to pollute original accessor
                        var positionAttribute = cloneBufferAttribute( accessors[ target.POSITION ] );
                        positionAttribute.name = attributeName;

                        var position = geometry.attributes.position;

                        for ( var j = 0, jl = positionAttribute.count; j < jl; j ++ ) {

                            positionAttribute.setXYZ(
                                j,
                                positionAttribute.getX( j ) + position.getX( j ),
                                positionAttribute.getY( j ) + position.getY( j ),
                                positionAttribute.getZ( j ) + position.getZ( j )
                            );

                        }

                    } else {

                        positionAttribute = geometry.attributes.position;

                    }

                    morphPositions.push( positionAttribute );

                }

                if ( hasMorphNormal ) {

                    // see target.POSITION's comment

                    var normalAttribute;

                    if ( target.NORMAL !== undefined ) {

                        var normalAttribute = cloneBufferAttribute( accessors[ target.NORMAL ] );
                        normalAttribute.name = attributeName;

                        var normal = geometry.attributes.normal;

                        for ( var j = 0, jl = normalAttribute.count; j < jl; j ++ ) {

                            normalAttribute.setXYZ(
                                j,
                                normalAttribute.getX( j ) + normal.getX( j ),
                                normalAttribute.getY( j ) + normal.getY( j ),
                                normalAttribute.getZ( j ) + normal.getZ( j )
                            );

                        }

                    } else {

                        normalAttribute = geometry.attributes.normal;

                    }

                    morphNormals.push( normalAttribute );

                }

            }

            if ( hasMorphPosition ) geometry.morphAttributes.position = morphPositions;
            if ( hasMorphNormal ) geometry.morphAttributes.normal = morphNormals;

        }

        /**
         * @param {THREE.Mesh} mesh
         * @param {GLTF.Mesh} meshDef
         */
        function updateMorphTargets( mesh, meshDef ) {

            mesh.updateMorphTargets();

            if ( meshDef.weights !== undefined ) {

                for ( var i = 0, il = meshDef.weights.length; i < il; i ++ ) {

                    mesh.morphTargetInfluences[ i ] = meshDef.weights[ i ];

                }

            }

            // .extras has user-defined data, so check that .extras.targetNames is an array.
            if ( meshDef.extras && Array.isArray( meshDef.extras.targetNames ) ) {

                var targetNames = meshDef.extras.targetNames;

                if ( mesh.morphTargetInfluences.length === targetNames.length ) {

                    mesh.morphTargetDictionary = {};

                    for ( var i = 0, il = targetNames.length; i < il; i ++ ) {

                        mesh.morphTargetDictionary[ targetNames[ i ] ] = i;

                    }

                } else {

                    console.warn( 'THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.' );

                }

            }

        }

        function isPrimitiveEqual( a, b ) {

            if ( a.indices !== b.indices ) {

                return false;

            }

            return isObjectEqual( a.attributes, b.attributes );

        }

        function isObjectEqual( a, b ) {

            if ( Object.keys( a ).length !== Object.keys( b ).length ) return false;

            for ( let key in a ) {

                if ( a[ key ] !== b[ key ] ) return false;

            }

            return true;

        }

        function isArrayEqual( a, b ) {

            if ( a.length !== b.length ) return false;

            for ( let i = 0, il = a.length; i < il; i ++ ) {

                if ( a[ i ] !== b[ i ] ) return false;

            }

            return true;

        }

        function getCachedGeometry( cache, newPrimitive ) {

            for ( let i = 0, il = cache.length; i < il; i ++ ) {

                let cached = cache[ i ];

                if ( isPrimitiveEqual( cached.primitive, newPrimitive ) ) return cached.promise;

            }

            return null;

        }

        function getCachedCombinedGeometry( cache, geometries ) {

            for ( let i = 0, il = cache.length; i < il; i ++ ) {

                let cached = cache[ i ];

                if ( isArrayEqual( geometries, cached.baseGeometries ) ) return cached.geometry;

            }

            return null;

        }

        function getCachedMultiPassGeometry( cache, geometry, primitives ) {

            for ( let i = 0, il = cache.length; i < il; i ++ ) {

                let cached = cache[ i ];

                if ( geometry === cached.baseGeometry && isArrayEqual( primitives, cached.primitives ) ) return cached.geometry;

            }

            return null;

        }

        function cloneBufferAttribute( attribute ) {

            if ( attribute.isInterleavedBufferAttribute ) {

                let count = attribute.count;
                let itemSize = attribute.itemSize;
                let array = attribute.array.slice( 0, count * itemSize );

                for ( let i = 0; i < count; ++ i ) {

                    array[ i ] = attribute.getX( i );
                    if ( itemSize >= 2 ) array[ i + 1 ] = attribute.getY( i );
                    if ( itemSize >= 3 ) array[ i + 2 ] = attribute.getZ( i );
                    if ( itemSize >= 4 ) array[ i + 3 ] = attribute.getW( i );

                }

                return new THREE.BufferAttribute( array, itemSize, attribute.normalized );

            }

            return attribute.clone();

        }

        /**
         * Checks if we can build a single Mesh with MultiMaterial from multiple primitives.
         * Returns true if all primitives use the same attributes/morphAttributes/mode
         * and also have index. Otherwise returns false.
         *
         * @param {Array<GLTF.Primitive>} primitives
         * @return {Boolean}
         */
        function isMultiPassGeometry( primitives ) {

            if ( primitives.length < 2 ) return false;

            let primitive0 = primitives[ 0 ];
            let targets0 = primitive0.targets || [];

            if ( primitive0.indices === undefined ) return false;

            for ( let i = 1, il = primitives.length; i < il; i ++ ) {

                let primitive = primitives[ i ];

                if ( primitive0.mode !== primitive.mode ) return false;
                if ( primitive.indices === undefined ) return false;
                if ( ! isObjectEqual( primitive0.attributes, primitive.attributes ) ) return false;

                let targets = primitive.targets || [];

                if ( targets0.length !== targets.length ) return false;

                for ( let j = 0, jl = targets0.length; j < jl; j ++ ) {

                    if ( ! isObjectEqual( targets0[ j ], targets[ j ] ) ) return false;

                }

            }

            return true;

        }

        /* GLTF PARSER */

        function GLTFParser( json, extensions, options ) {

            this.json = json || {};
            this.extensions = extensions || {};
            this.options = options || {};

            // loader object cache
            this.cache = new GLTFRegistry();

            // BufferGeometry caching
            this.primitiveCache = [];
            this.multiplePrimitivesCache = [];
            this.multiPassGeometryCache = [];

            this.textureLoader = new THREE.TextureLoader( this.options.manager );
            this.textureLoader.setCrossOrigin( this.options.crossOrigin );

            this.fileLoader = new THREE.FileLoader( this.options.manager );
            this.fileLoader.setResponseType( 'arraybuffer' );

        }

        GLTFParser.prototype.parse = function ( onLoad, onError ) {

            let json = this.json;

            // Clear the loader cache
            this.cache.removeAll();

            // Mark the special nodes/meshes in json for efficient parse
            this.markDefs();

            // Fire the callback on complete
            this.getMultiDependencies( [

                'scene',
                'animation',
                'camera'

            ] ).then( function ( dependencies ) {

                let scenes = dependencies.scenes || [];
                let scene = scenes[ json.scene || 0 ];
                let animations = dependencies.animations || [];
                let cameras = dependencies.cameras || [];

                onLoad( scene, scenes, cameras, animations, json );

            } ).catch( onError );

        };

        /**
         * Marks the special nodes/meshes in json for efficient parse.
         */
        GLTFParser.prototype.markDefs = function () {

            let nodeDefs = this.json.nodes || [];
            let skinDefs = this.json.skins || [];
            let meshDefs = this.json.meshes || [];

            let meshReferences = {};
            let meshUses = {};

            // Nothing in the node definition indicates whether it is a Bone or an
            // Object3D. Use the skins' joint references to mark bones.
            for ( let skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex ++ ) {

                let joints = skinDefs[ skinIndex ].joints;

                for ( let i = 0, il = joints.length; i < il; i ++ ) {

                    nodeDefs[ joints[ i ] ].isBone = true;

                }

            }

            // Meshes can (and should) be reused by multiple nodes in a glTF asset. To
            // avoid having more than one THREE.Mesh with the same name, count
            // references and rename instances below.
            //
            // Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
            for ( let nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex ++ ) {

                let nodeDef = nodeDefs[ nodeIndex ];

                if ( nodeDef.mesh !== undefined ) {

                    if ( meshReferences[ nodeDef.mesh ] === undefined ) {

                        meshReferences[ nodeDef.mesh ] = meshUses[ nodeDef.mesh ] = 0;

                    }

                    meshReferences[ nodeDef.mesh ] ++;

                    // Nothing in the mesh definition indicates whether it is
                    // a SkinnedMesh or Mesh. Use the node's mesh reference
                    // to mark SkinnedMesh if node has skin.
                    if ( nodeDef.skin !== undefined ) {

                        meshDefs[ nodeDef.mesh ].isSkinnedMesh = true;

                    }

                }

            }

            this.json.meshReferences = meshReferences;
            this.json.meshUses = meshUses;

        };

        /**
         * Requests the specified dependency asynchronously, with caching.
         * @param {string} type
         * @param {number} index
         * @return {Promise<Object>}
         */
        GLTFParser.prototype.getDependency = function ( type, index ) {

            let cacheKey = type + ':' + index;
            let dependency = this.cache.get( cacheKey );

            if ( ! dependency ) {

                switch ( type ) {

                    case 'scene':
                        dependency = this.loadScene( index );
                        break;

                    case 'node':
                        dependency = this.loadNode( index );
                        break;

                    case 'mesh':
                        dependency = this.loadMesh( index );
                        break;

                    case 'accessor':
                        dependency = this.loadAccessor( index );
                        break;

                    case 'bufferView':
                        dependency = this.loadBufferView( index );
                        break;

                    case 'buffer':
                        dependency = this.loadBuffer( index );
                        break;

                    case 'material':
                        dependency = this.loadMaterial( index );
                        break;

                    case 'texture':
                        dependency = this.loadTexture( index );
                        break;

                    case 'skin':
                        dependency = this.loadSkin( index );
                        break;

                    case 'animation':
                        dependency = this.loadAnimation( index );
                        break;

                    case 'camera':
                        dependency = this.loadCamera( index );
                        break;

                    default:
                        throw new Error( 'Unknown type: ' + type );

                }

                this.cache.add( cacheKey, dependency );

            }

            return dependency;

        };

        /**
         * Requests all dependencies of the specified type asynchronously, with caching.
         * @param {string} type
         * @return {Promise<Array<Object>>}
         */
        GLTFParser.prototype.getDependencies = function ( type ) {

            let dependencies = this.cache.get( type );

            if ( ! dependencies ) {

                let parser = this;
                let defs = this.json[ type + ( type === 'mesh' ? 'es' : 's' ) ] || [];

                dependencies = Promise.all( defs.map( function ( def, index ) {

                    return parser.getDependency( type, index );

                } ) );

                this.cache.add( type, dependencies );

            }

            return dependencies;

        };

        /**
         * Requests all multiple dependencies of the specified types asynchronously, with caching.
         * @param {Array<string>} types
         * @return {Promise<Object<Array<Object>>>}
         */
        GLTFParser.prototype.getMultiDependencies = function ( types ) {

            let results = {};
            let pendings = [];

            for ( let i = 0, il = types.length; i < il; i ++ ) {

                let type = types[ i ];
                let value = this.getDependencies( type );

                value = value.then( function ( key, value ) {

                    results[ key ] = value;

                }.bind( this, type + ( type === 'mesh' ? 'es' : 's' ) ) );

                pendings.push( value );

            }

            return Promise.all( pendings ).then( function () {

                return results;

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
         * @param {number} bufferIndex
         * @return {Promise<ArrayBuffer>}
         */
        GLTFParser.prototype.loadBuffer = function ( bufferIndex ) {

            let bufferDef = this.json.buffers[ bufferIndex ];
            let loader = this.fileLoader;

            if ( bufferDef.type && bufferDef.type !== 'arraybuffer' ) {

                throw new Error( 'THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.' );

            }

            // If present, GLB container is required to be the first buffer.
            if ( bufferDef.uri === undefined && bufferIndex === 0 ) {

                return Promise.resolve( this.extensions[ EXTENSIONS.KHR_BINARY_GLTF ].body );

            }

            let options = this.options;

            return new Promise( function ( resolve, reject ) {

                loader.load( resolveURL( bufferDef.uri, options.path ), resolve, undefined, function () {

                    reject( new Error( 'THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".' ) );

                } );

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
         * @param {number} bufferViewIndex
         * @return {Promise<ArrayBuffer>}
         */
        GLTFParser.prototype.loadBufferView = function ( bufferViewIndex ) {

            let bufferViewDef = this.json.bufferViews[ bufferViewIndex ];

            return this.getDependency( 'buffer', bufferViewDef.buffer ).then( function ( buffer ) {

                let byteLength = bufferViewDef.byteLength || 0;
                let byteOffset = bufferViewDef.byteOffset || 0;
                return buffer.slice( byteOffset, byteOffset + byteLength );

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
         * @param {number} accessorIndex
         * @return {Promise<THREE.BufferAttribute|THREE.InterleavedBufferAttribute>}
         */
        GLTFParser.prototype.loadAccessor = function ( accessorIndex ) {

            let parser = this;
            let json = this.json;

            let accessorDef = this.json.accessors[ accessorIndex ];

            if ( accessorDef.bufferView === undefined && accessorDef.sparse === undefined ) {

                // Ignore empty accessors, which may be used to declare runtime
                // information about attributes coming from another source (e.g. Draco
                // compression extension).
                return null;

            }

            let pendingBufferViews = [];

            if ( accessorDef.bufferView !== undefined ) {

                pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.bufferView ) );

            } else {

                pendingBufferViews.push( null );

            }

            if ( accessorDef.sparse !== undefined ) {

                pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.indices.bufferView ) );
                pendingBufferViews.push( this.getDependency( 'bufferView', accessorDef.sparse.values.bufferView ) );

            }

            return Promise.all( pendingBufferViews ).then( function ( bufferViews ) {

                let bufferView = bufferViews[ 0 ];

                let itemSize = WEBGL_TYPE_SIZES[ accessorDef.type ];
                let TypedArray = WEBGL_COMPONENT_TYPES[ accessorDef.componentType ];

                // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
                let elementBytes = TypedArray.BYTES_PER_ELEMENT;
                let itemBytes = elementBytes * itemSize;
                let byteOffset = accessorDef.byteOffset || 0;
                let byteStride = accessorDef.bufferView !== undefined ? json.bufferViews[ accessorDef.bufferView ].byteStride : undefined;
                let normalized = accessorDef.normalized === true;
                let array, bufferAttribute;

                // The buffer is not interleaved if the stride is the item size in bytes.
                if ( byteStride && byteStride !== itemBytes ) {

                    let ibCacheKey = 'InterleavedBuffer:' + accessorDef.bufferView + ':' + accessorDef.componentType;
                    let ib = parser.cache.get( ibCacheKey );

                    if ( ! ib ) {

                        // Use the full buffer if it's interleaved.
                        array = new TypedArray( bufferView );

                        // Integer parameters to IB/IBA are in array elements, not bytes.
                        ib = new THREE.InterleavedBuffer( array, byteStride / elementBytes );

                        parser.cache.add( ibCacheKey, ib );

                    }

                    bufferAttribute = new THREE.InterleavedBufferAttribute( ib, itemSize, byteOffset / elementBytes, normalized );

                } else {

                    if ( bufferView === null ) {

                        array = new TypedArray( accessorDef.count * itemSize );

                    } else {

                        array = new TypedArray( bufferView, byteOffset, accessorDef.count * itemSize );

                    }

                    bufferAttribute = new THREE.BufferAttribute( array, itemSize, normalized );

                }

                // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
                if ( accessorDef.sparse !== undefined ) {

                    let itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR;
                    let TypedArrayIndices = WEBGL_COMPONENT_TYPES[ accessorDef.sparse.indices.componentType ];

                    let byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0;
                    let byteOffsetValues = accessorDef.sparse.values.byteOffset || 0;

                    let sparseIndices = new TypedArrayIndices( bufferViews[ 1 ], byteOffsetIndices, accessorDef.sparse.count * itemSizeIndices );
                    let sparseValues = new TypedArray( bufferViews[ 2 ], byteOffsetValues, accessorDef.sparse.count * itemSize );

                    if ( bufferView !== null ) {

                        // Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
                        bufferAttribute.setArray( bufferAttribute.array.slice() );

                    }

                    for ( let i = 0, il = sparseIndices.length; i < il; i ++ ) {

                        let index = sparseIndices[ i ];

                        bufferAttribute.setX( index, sparseValues[ i * itemSize ] );
                        if ( itemSize >= 2 ) bufferAttribute.setY( index, sparseValues[ i * itemSize + 1 ] );
                        if ( itemSize >= 3 ) bufferAttribute.setZ( index, sparseValues[ i * itemSize + 2 ] );
                        if ( itemSize >= 4 ) bufferAttribute.setW( index, sparseValues[ i * itemSize + 3 ] );
                        if ( itemSize >= 5 ) throw new Error( 'THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.' );

                    }

                }

                return bufferAttribute;

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
         * @param {number} textureIndex
         * @return {Promise<THREE.Texture>}
         */
        GLTFParser.prototype.loadTexture = function ( textureIndex ) {

            let parser = this;
            let json = this.json;
            let options = this.options;
            let textureLoader = this.textureLoader;

            let URL = window.URL || window.webkitURL;

            let textureDef = json.textures[ textureIndex ];

            let textureExtensions = textureDef.extensions || {};

            let source;

            if ( textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ] ) {

                source = json.images[ textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ].source ];

            } else {

                source = json.images[ textureDef.source ];

            }

            let sourceURI = source.uri;
            let isObjectURL = false;

            if ( source.bufferView !== undefined ) {

                // Load binary image data from bufferView, if provided.

                sourceURI = parser.getDependency( 'bufferView', source.bufferView ).then( function ( bufferView ) {

                    isObjectURL = true;
                    let blob = new Blob( [ bufferView ], { type: source.mimeType } );
                    sourceURI = URL.createObjectURL( blob );
                    return sourceURI;

                } );

            }

            return Promise.resolve( sourceURI ).then( function ( sourceURI ) {

                // Load Texture resource.

                let loader = THREE.Loader.Handlers.get( sourceURI );

                if ( ! loader ) {

                    loader = textureExtensions[ EXTENSIONS.MSFT_TEXTURE_DDS ]
                        ? parser.extensions[ EXTENSIONS.MSFT_TEXTURE_DDS ].ddsLoader
                        : textureLoader;

                }

                return new Promise( function ( resolve, reject ) {

                    loader.load( resolveURL( sourceURI, options.path ), resolve, undefined, reject );

                } );

            } ).then( function ( texture ) {

                // Clean up resources and configure Texture.

                if ( isObjectURL === true ) {

                    URL.revokeObjectURL( sourceURI );

                }

                texture.flipY = false;

                if ( textureDef.name !== undefined ) texture.name = textureDef.name;

                // Ignore unknown mime types, like DDS files.
                if ( source.mimeType in MIME_TYPE_FORMATS ) {

                    texture.format = MIME_TYPE_FORMATS[ source.mimeType ];

                }

                let samplers = json.samplers || {};
                let sampler = samplers[ textureDef.sampler ] || {};

                texture.magFilter = WEBGL_FILTERS[ sampler.magFilter ] || THREE.LinearFilter;
                texture.minFilter = WEBGL_FILTERS[ sampler.minFilter ] || THREE.LinearMipMapLinearFilter;
                texture.wrapS = WEBGL_WRAPPINGS[ sampler.wrapS ] || THREE.RepeatWrapping;
                texture.wrapT = WEBGL_WRAPPINGS[ sampler.wrapT ] || THREE.RepeatWrapping;

                return texture;

            } );

        };

        /**
         * Asynchronously assigns a texture to the given material parameters.
         * @param {Object} materialParams
         * @param {string} textureName
         * @param {number} textureIndex
         * @return {Promise}
         */
        GLTFParser.prototype.assignTexture = function ( materialParams, textureName, textureIndex ) {

            return this.getDependency( 'texture', textureIndex ).then( function ( texture ) {

                materialParams[ textureName ] = texture;

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
         * @param {number} materialIndex
         * @return {Promise<THREE.Material>}
         */
        GLTFParser.prototype.loadMaterial = function ( materialIndex ) {

            let parser = this;
            let json = this.json;
            let extensions = this.extensions;
            let materialDef = json.materials[ materialIndex ];

            let materialType;
            let materialParams = {};
            let materialExtensions = materialDef.extensions || {};

            let pending = [];

            if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ] ) {

                let sgExtension = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ];
                materialType = sgExtension.getMaterialType( materialDef );
                pending.push( sgExtension.extendParams( materialParams, materialDef, parser ) );

            } else if ( materialExtensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ] ) {

                let kmuExtension = extensions[ EXTENSIONS.KHR_MATERIALS_UNLIT ];
                materialType = kmuExtension.getMaterialType( materialDef );
                pending.push( kmuExtension.extendParams( materialParams, materialDef, parser ) );

            } else {

                // Specification:
                // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

                materialType = THREE.MeshStandardMaterial;

                let metallicRoughness = materialDef.pbrMetallicRoughness || {};

                materialParams.color = new THREE.Color( 1.0, 1.0, 1.0 );
                materialParams.opacity = 1.0;

                if ( Array.isArray( metallicRoughness.baseColorFactor ) ) {

                    let array = metallicRoughness.baseColorFactor;

                    materialParams.color.fromArray( array );
                    materialParams.opacity = array[ 3 ];

                }

                if ( metallicRoughness.baseColorTexture !== undefined ) {

                    pending.push( parser.assignTexture( materialParams, 'map', metallicRoughness.baseColorTexture.index ) );

                }

                materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0;
                materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0;

                if ( metallicRoughness.metallicRoughnessTexture !== undefined ) {

                    let textureIndex = metallicRoughness.metallicRoughnessTexture.index;
                    pending.push( parser.assignTexture( materialParams, 'metalnessMap', textureIndex ) );
                    pending.push( parser.assignTexture( materialParams, 'roughnessMap', textureIndex ) );

                }

            }

            if ( materialDef.doubleSided === true ) {

                materialParams.side = THREE.DoubleSide;

            }

            let alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE;

            if ( alphaMode === ALPHA_MODES.BLEND ) {

                materialParams.transparent = true;

            } else {

                materialParams.transparent = false;

                if ( alphaMode === ALPHA_MODES.MASK ) {

                    materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5;

                }

            }

            if ( materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

                pending.push( parser.assignTexture( materialParams, 'normalMap', materialDef.normalTexture.index ) );

                materialParams.normalScale = new THREE.Vector2( 1, 1 );

                if ( materialDef.normalTexture.scale !== undefined ) {

                    materialParams.normalScale.set( materialDef.normalTexture.scale, materialDef.normalTexture.scale );

                }

            }

            if ( materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

                pending.push( parser.assignTexture( materialParams, 'aoMap', materialDef.occlusionTexture.index ) );

                if ( materialDef.occlusionTexture.strength !== undefined ) {

                    materialParams.aoMapIntensity = materialDef.occlusionTexture.strength;

                }

            }

            if ( materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial ) {

                materialParams.emissive = new THREE.Color().fromArray( materialDef.emissiveFactor );

            }

            if ( materialDef.emissiveTexture !== undefined && materialType !== THREE.MeshBasicMaterial ) {

                pending.push( parser.assignTexture( materialParams, 'emissiveMap', materialDef.emissiveTexture.index ) );

            }

            return Promise.all( pending ).then( function () {

                let material;

                if ( materialType === THREE.ShaderMaterial ) {

                    material = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].createMaterial( materialParams );

                } else {

                    material = new materialType( materialParams );

                }

                if ( materialDef.name !== undefined ) material.name = materialDef.name;

                // Normal map textures use OpenGL conventions:
                // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#materialnormaltexture
                if ( material.normalScale ) {

                    material.normalScale.y = - material.normalScale.y;

                }

                // baseColorTexture, emissiveTexture, and specularGlossinessTexture use sRGB encoding.
                if ( material.map ) material.map.encoding = THREE.sRGBEncoding;
                if ( material.emissiveMap ) material.emissiveMap.encoding = THREE.sRGBEncoding;
                if ( material.specularMap ) material.specularMap.encoding = THREE.sRGBEncoding;

                assignExtrasToUserData( material, materialDef );

                if ( materialDef.extensions ) addUnknownExtensionsToUserData( extensions, material, materialDef );

                return material;

            } );

        };

        /**
         * @param  {THREE.BufferGeometry} geometry
         * @param  {GLTF.Primitive} primitiveDef
         * @param  {Array<THREE.BufferAttribute>} accessors
         */
        function addPrimitiveAttributes( geometry, primitiveDef, accessors ) {

            let attributes = primitiveDef.attributes;

            for ( let gltfAttributeName in attributes ) {

                let threeAttributeName = ATTRIBUTES[ gltfAttributeName ];
                let bufferAttribute = accessors[ attributes[ gltfAttributeName ] ];

                // Skip attributes already provided by e.g. Draco extension.
                if ( ! threeAttributeName ) continue;
                if ( threeAttributeName in geometry.attributes ) continue;

                geometry.addAttribute( threeAttributeName, bufferAttribute );

            }

            if ( primitiveDef.indices !== undefined && ! geometry.index ) {

                geometry.setIndex( accessors[ primitiveDef.indices ] );

            }

            if ( primitiveDef.targets !== undefined ) {

                addMorphTargets( geometry, primitiveDef.targets, accessors );

            }

            assignExtrasToUserData( geometry, primitiveDef );

        }

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
         *
         * Creates BufferGeometries from primitives.
         * If we can build a single BufferGeometry with .groups from multiple primitives, returns one BufferGeometry.
         * Otherwise, returns BufferGeometries without .groups as many as primitives.
         *
         * @param {Array<Object>} primitives
         * @return {Promise<Array<THREE.BufferGeometry>>}
         */
        GLTFParser.prototype.loadGeometries = function ( primitives ) {

            let parser = this;
            let extensions = this.extensions;
            let cache = this.primitiveCache;

            let isMultiPass = isMultiPassGeometry( primitives );
            let originalPrimitives;

            if ( isMultiPass ) {

                originalPrimitives = primitives; // save original primitives and use later

                // We build a single BufferGeometry with .groups from multiple primitives
                // because all primitives share the same attributes/morph/mode and have indices.

                primitives = [ primitives[ 0 ] ];

                // Sets .groups and combined indices to a geometry later in this method.

            }

            return this.getDependencies( 'accessor' ).then( function ( accessors ) {

                let pending = [];

                for ( let i = 0, il = primitives.length; i < il; i ++ ) {

                    let primitive = primitives[ i ];

                    // See if we've already created this geometry
                    let cached = getCachedGeometry( cache, primitive );

                    if ( cached ) {

                        // Use the cached geometry if it exists
                        pending.push( cached );

                    } else if ( primitive.extensions && primitive.extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ] ) {

                        // Use DRACO geometry if available
                        let geometryPromise = extensions[ EXTENSIONS.KHR_DRACO_MESH_COMPRESSION ]
                            .decodePrimitive( primitive, parser )
                            .then( function ( geometry ) {

                                addPrimitiveAttributes( geometry, primitive, accessors );

                                return geometry;

                            } );

                        cache.push( { primitive: primitive, promise: geometryPromise } );

                        pending.push( geometryPromise );

                    } else {

                        // Otherwise create a new geometry
                        let geometry = new THREE.BufferGeometry();

                        addPrimitiveAttributes( geometry, primitive, accessors );

                        let geometryPromise = Promise.resolve( geometry );

                        // Cache this geometry
                        cache.push( { primitive: primitive, promise: geometryPromise } );

                        pending.push( geometryPromise );

                    }

                }

                return Promise.all( pending ).then( function ( geometries ) {

                    if ( isMultiPass ) {

                        let baseGeometry = geometries[ 0 ];

                        // See if we've already created this combined geometry
                        let cache = parser.multiPassGeometryCache;
                        let cached = getCachedMultiPassGeometry( cache, baseGeometry, originalPrimitives );

                        if ( cached !== null ) return [ cached.geometry ];

                        // Cloning geometry because of index override.
                        // Attributes can be reused so cloning by myself here.
                        let geometry = new THREE.BufferGeometry();

                        geometry.name = baseGeometry.name;
                        geometry.userData = baseGeometry.userData;

                        for ( let key in baseGeometry.attributes ) geometry.addAttribute( key, baseGeometry.attributes[ key ] );
                        for ( let key in baseGeometry.morphAttributes ) geometry.morphAttributes[ key ] = baseGeometry.morphAttributes[ key ];

                        let indices = [];
                        let offset = 0;

                        for ( let i = 0, il = originalPrimitives.length; i < il; i ++ ) {

                            let accessor = accessors[ originalPrimitives[ i ].indices ];

                            for ( let j = 0, jl = accessor.count; j < jl; j ++ ) indices.push( accessor.array[ j ] );

                            geometry.addGroup( offset, accessor.count, i );

                            offset += accessor.count;

                        }

                        geometry.setIndex( indices );

                        cache.push( { geometry: geometry, baseGeometry: baseGeometry, primitives: originalPrimitives } );

                        return [ geometry ];

                    } else if ( geometries.length > 1 && THREE.BufferGeometryUtils !== undefined ) {

                        // Tries to merge geometries with BufferGeometryUtils if possible

                        for ( let i = 1, il = primitives.length; i < il; i ++ ) {

                            // can't merge if draw mode is different
                            if ( primitives[ 0 ].mode !== primitives[ i ].mode ) return geometries;

                        }

                        // See if we've already created this combined geometry
                        let cache = parser.multiplePrimitivesCache;
                        let cached = getCachedCombinedGeometry( cache, geometries );

                        if ( cached ) {

                            if ( cached.geometry !== null ) return [ cached.geometry ];

                        } else {

                            let geometry = THREE.BufferGeometryUtils.mergeBufferGeometries( geometries, true );

                            cache.push( { geometry: geometry, baseGeometries: geometries } );

                            if ( geometry !== null ) return [ geometry ];

                        }

                    }

                    return geometries;

                } );

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
         * @param {number} meshIndex
         * @return {Promise<THREE.Group|THREE.Mesh|THREE.SkinnedMesh>}
         */
        GLTFParser.prototype.loadMesh = function ( meshIndex ) {

            let scope = this;
            let json = this.json;
            let extensions = this.extensions;

            let meshDef = json.meshes[ meshIndex ];

            return this.getMultiDependencies( [

                'accessor',
                'material'

            ] ).then( function ( dependencies ) {

                let primitives = meshDef.primitives;
                let originalMaterials = [];

                for ( let i = 0, il = primitives.length; i < il; i ++ ) {

                    originalMaterials[ i ] = primitives[ i ].material === undefined
                        ? createDefaultMaterial()
                        : dependencies.materials[ primitives[ i ].material ];

                }

                return scope.loadGeometries( primitives ).then( function ( geometries ) {

                    let isMultiMaterial = geometries.length === 1 && geometries[ 0 ].groups.length > 0;

                    let meshes = [];

                    for ( let i = 0, il = geometries.length; i < il; i ++ ) {

                        let geometry = geometries[ i ];
                        let primitive = primitives[ i ];

                        // 1. create Mesh

                        let mesh;

                        let material = isMultiMaterial ? originalMaterials : originalMaterials[ i ];

                        if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
                            primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
                            primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
                            primitive.mode === undefined ) {

                            // .isSkinnedMesh isn't in glTF spec. See .markDefs()
                            mesh = meshDef.isSkinnedMesh === true
                                ? new THREE.SkinnedMesh( geometry, material )
                                : new THREE.Mesh( geometry, material );

                            if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ) {

                                mesh.drawMode = THREE.TriangleStripDrawMode;

                            } else if ( primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ) {

                                mesh.drawMode = THREE.TriangleFanDrawMode;

                            }

                        } else if ( primitive.mode === WEBGL_CONSTANTS.LINES ) {

                            mesh = new THREE.LineSegments( geometry, material );

                        } else if ( primitive.mode === WEBGL_CONSTANTS.LINE_STRIP ) {

                            mesh = new THREE.Line( geometry, material );

                        } else if ( primitive.mode === WEBGL_CONSTANTS.LINE_LOOP ) {

                            mesh = new THREE.LineLoop( geometry, material );

                        } else if ( primitive.mode === WEBGL_CONSTANTS.POINTS ) {

                            mesh = new THREE.Points( geometry, material );

                        } else {

                            throw new Error( 'THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode );

                        }

                        if ( Object.keys( mesh.geometry.morphAttributes ).length > 0 ) {

                            updateMorphTargets( mesh, meshDef );

                        }

                        mesh.name = meshDef.name || ( 'mesh_' + meshIndex );

                        if ( geometries.length > 1 ) mesh.name += '_' + i;

                        assignExtrasToUserData( mesh, meshDef );

                        meshes.push( mesh );

                        // 2. update Material depending on Mesh and BufferGeometry

                        let materials = isMultiMaterial ? mesh.material : [ mesh.material ];

                        let useVertexColors = geometry.attributes.color !== undefined;
                        let useFlatShading = geometry.attributes.normal === undefined;
                        let useSkinning = mesh.isSkinnedMesh === true;
                        let useMorphTargets = Object.keys( geometry.morphAttributes ).length > 0;
                        let useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined;

                        for ( let j = 0, jl = materials.length; j < jl; j ++ ) {

                            let material = materials[ j ];

                            if ( mesh.isPoints ) {

                                let cacheKey = 'PointsMaterial:' + material.uuid;

                                let pointsMaterial = scope.cache.get( cacheKey );

                                if ( ! pointsMaterial ) {

                                    pointsMaterial = new THREE.PointsMaterial();
                                    THREE.Material.prototype.copy.call( pointsMaterial, material );
                                    pointsMaterial.color.copy( material.color );
                                    pointsMaterial.map = material.map;
                                    pointsMaterial.lights = false; // PointsMaterial doesn't support lights yet

                                    scope.cache.add( cacheKey, pointsMaterial );

                                }

                                material = pointsMaterial;

                            } else if ( mesh.isLine ) {

                                let cacheKey = 'LineBasicMaterial:' + material.uuid;

                                let lineMaterial = scope.cache.get( cacheKey );

                                if ( ! lineMaterial ) {

                                    lineMaterial = new THREE.LineBasicMaterial();
                                    THREE.Material.prototype.copy.call( lineMaterial, material );
                                    lineMaterial.color.copy( material.color );
                                    lineMaterial.lights = false; // LineBasicMaterial doesn't support lights yet

                                    scope.cache.add( cacheKey, lineMaterial );

                                }

                                material = lineMaterial;

                            }

                            // Clone the material if it will be modified
                            if ( useVertexColors || useFlatShading || useSkinning || useMorphTargets ) {

                                let cacheKey = 'ClonedMaterial:' + material.uuid + ':';

                                if ( material.isGLTFSpecularGlossinessMaterial ) cacheKey += 'specular-glossiness:';
                                if ( useSkinning ) cacheKey += 'skinning:';
                                if ( useVertexColors ) cacheKey += 'vertex-colors:';
                                if ( useFlatShading ) cacheKey += 'flat-shading:';
                                if ( useMorphTargets ) cacheKey += 'morph-targets:';
                                if ( useMorphNormals ) cacheKey += 'morph-normals:';

                                let cachedMaterial = scope.cache.get( cacheKey );

                                if ( ! cachedMaterial ) {

                                    cachedMaterial = material.isGLTFSpecularGlossinessMaterial
                                        ? extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].cloneMaterial( material )
                                        : material.clone();

                                    if ( useSkinning ) cachedMaterial.skinning = true;
                                    if ( useVertexColors ) cachedMaterial.vertexColors = THREE.VertexColors;
                                    if ( useFlatShading ) cachedMaterial.flatShading = true;
                                    if ( useMorphTargets ) cachedMaterial.morphTargets = true;
                                    if ( useMorphNormals ) cachedMaterial.morphNormals = true;

                                    scope.cache.add( cacheKey, cachedMaterial );

                                }

                                material = cachedMaterial;

                            }

                            materials[ j ] = material;

                            // workarounds for mesh and geometry

                            if ( material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined ) {

                                console.log( 'THREE.GLTFLoader: Duplicating UVs to support aoMap.' );
                                geometry.addAttribute( 'uv2', new THREE.BufferAttribute( geometry.attributes.uv.array, 2 ) );

                            }

                            if ( material.isGLTFSpecularGlossinessMaterial ) {

                                // for GLTFSpecularGlossinessMaterial(ShaderMaterial) uniforms runtime update
                                mesh.onBeforeRender = extensions[ EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS ].refreshUniforms;

                            }

                        }

                        mesh.material = isMultiMaterial ? materials : materials[ 0 ];

                    }

                    if ( meshes.length === 1 ) {

                        return meshes[ 0 ];

                    }

                    let group = new THREE.Group();

                    for ( let i = 0, il = meshes.length; i < il; i ++ ) {

                        group.add( meshes[ i ] );

                    }

                    return group;

                } );

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
         * @param {number} cameraIndex
         * @return {Promise<THREE.Camera>}
         */
        GLTFParser.prototype.loadCamera = function ( cameraIndex ) {

            let camera;
            let cameraDef = this.json.cameras[ cameraIndex ];
            let params = cameraDef[ cameraDef.type ];

            if ( ! params ) {

                console.warn( 'THREE.GLTFLoader: Missing camera parameters.' );
                return;

            }

            if ( cameraDef.type === 'perspective' ) {

                camera = new THREE.PerspectiveCamera( THREE.Math.radToDeg( params.yfov ), params.aspectRatio || 1, params.znear || 1, params.zfar || 2e6 );

            } else if ( cameraDef.type === 'orthographic' ) {

                camera = new THREE.OrthographicCamera( params.xmag / - 2, params.xmag / 2, params.ymag / 2, params.ymag / - 2, params.znear, params.zfar );

            }

            if ( cameraDef.name !== undefined ) camera.name = cameraDef.name;

            assignExtrasToUserData( camera, cameraDef );

            return Promise.resolve( camera );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
         * @param {number} skinIndex
         * @return {Promise<Object>}
         */
        GLTFParser.prototype.loadSkin = function ( skinIndex ) {

            let skinDef = this.json.skins[ skinIndex ];

            let skinEntry = { joints: skinDef.joints };

            if ( skinDef.inverseBindMatrices === undefined ) {

                return Promise.resolve( skinEntry );

            }

            return this.getDependency( 'accessor', skinDef.inverseBindMatrices ).then( function ( accessor ) {

                skinEntry.inverseBindMatrices = accessor;

                return skinEntry;

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
         * @param {number} animationIndex
         * @return {Promise<THREE.AnimationClip>}
         */
        GLTFParser.prototype.loadAnimation = function ( animationIndex ) {

            let json = this.json;

            let animationDef = json.animations[ animationIndex ];

            return this.getMultiDependencies( [

                'accessor',
                'node'

            ] ).then( function ( dependencies ) {

                let tracks = [];

                for ( let i = 0, il = animationDef.channels.length; i < il; i ++ ) {

                    let channel = animationDef.channels[ i ];
                    let sampler = animationDef.samplers[ channel.sampler ];

                    if ( sampler ) {

                        let target = channel.target;
                        let name = target.node !== undefined ? target.node : target.id; // NOTE: target.id is deprecated.
                        let input = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.input ] : sampler.input;
                        let output = animationDef.parameters !== undefined ? animationDef.parameters[ sampler.output ] : sampler.output;

                        let inputAccessor = dependencies.accessors[ input ];
                        let outputAccessor = dependencies.accessors[ output ];

                        let node = dependencies.nodes[ name ];

                        if ( node ) {

                            node.updateMatrix();
                            node.matrixAutoUpdate = true;

                            let TypedKeyframeTrack;

                            switch ( PATH_PROPERTIES[ target.path ] ) {

                                case PATH_PROPERTIES.weights:

                                    TypedKeyframeTrack = THREE.NumberKeyframeTrack;
                                    break;

                                case PATH_PROPERTIES.rotation:

                                    TypedKeyframeTrack = THREE.QuaternionKeyframeTrack;
                                    break;

                                case PATH_PROPERTIES.position:
                                case PATH_PROPERTIES.scale:
                                default:

                                    TypedKeyframeTrack = THREE.VectorKeyframeTrack;
                                    break;

                            }

                            let targetName = node.name ? node.name : node.uuid;

                            let interpolation = sampler.interpolation !== undefined ? INTERPOLATION[ sampler.interpolation ] : THREE.InterpolateLinear;

                            let targetNames = [];

                            if ( PATH_PROPERTIES[ target.path ] === PATH_PROPERTIES.weights ) {

                                // node can be THREE.Group here but
                                // PATH_PROPERTIES.weights(morphTargetInfluences) should be
                                // the property of a mesh object under group.

                                node.traverse( function ( object ) {

                                    if ( object.isMesh === true && object.morphTargetInfluences ) {

                                        targetNames.push( object.name ? object.name : object.uuid );

                                    }

                                } );

                            } else {

                                targetNames.push( targetName );

                            }

                            // KeyframeTrack.optimize() will modify given 'times' and 'values'
                            // buffers before creating a truncated copy to keep. Because buffers may
                            // be reused by other tracks, make copies here.
                            for ( let j = 0, jl = targetNames.length; j < jl; j ++ ) {

                                let track = new TypedKeyframeTrack(
                                    targetNames[ j ] + '.' + PATH_PROPERTIES[ target.path ],
                                    THREE.AnimationUtils.arraySlice( inputAccessor.array, 0 ),
                                    THREE.AnimationUtils.arraySlice( outputAccessor.array, 0 ),
                                    interpolation
                                );

                                // Here is the trick to enable custom interpolation.
                                // Overrides .createInterpolant in a factory method which creates custom interpolation.
                                if ( sampler.interpolation === 'CUBICSPLINE' ) {

                                    track.createInterpolant = function InterpolantFactoryMethodGLTFCubicSpline( result ) {

                                        // A CUBICSPLINE keyframe in glTF has three output values for each input value,
                                        // representing inTangent, splineVertex, and outTangent. As a result, track.getValueSize()
                                        // must be divided by three to get the interpolant's sampleSize argument.

                                        return new GLTFCubicSplineInterpolant( this.times, this.values, this.getValueSize() / 3, result );

                                    };

                                    // Workaround, provide an alternate way to know if the interpolant type is cubis spline to track.
                                    // track.getInterpolation() doesn't return valid value for custom interpolant.
                                    track.createInterpolant.isInterpolantFactoryMethodGLTFCubicSpline = true;

                                }

                                tracks.push( track );

                            }

                        }

                    }

                }

                let name = animationDef.name !== undefined ? animationDef.name : 'animation_' + animationIndex;

                return new THREE.AnimationClip( name, undefined, tracks );

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
         * @param {number} nodeIndex
         * @return {Promise<THREE.Object3D>}
         */
        GLTFParser.prototype.loadNode = function ( nodeIndex ) {

            let json = this.json;
            let extensions = this.extensions;

            let meshReferences = json.meshReferences;
            let meshUses = json.meshUses;

            let nodeDef = json.nodes[ nodeIndex ];

            return this.getMultiDependencies( [

                'mesh',
                'skin',
                'camera',
                'light'

            ] ).then( function ( dependencies ) {

                let node;

                // .isBone isn't in glTF spec. See .markDefs
                if ( nodeDef.isBone === true ) {

                    node = new THREE.Bone();

                } else if ( nodeDef.mesh !== undefined ) {

                    let mesh = dependencies.meshes[ nodeDef.mesh ];

                    if ( meshReferences[ nodeDef.mesh ] > 1 ) {

                        let instanceNum = meshUses[ nodeDef.mesh ] ++;

                        node = mesh.clone();
                        node.name += '_instance_' + instanceNum;

                        // onBeforeRender copy for Specular-Glossiness
                        node.onBeforeRender = mesh.onBeforeRender;

                        for ( let i = 0, il = node.children.length; i < il; i ++ ) {

                            node.children[ i ].name += '_instance_' + instanceNum;
                            node.children[ i ].onBeforeRender = mesh.children[ i ].onBeforeRender;

                        }

                    } else {

                        node = mesh;

                    }

                } else if ( nodeDef.camera !== undefined ) {

                    node = dependencies.cameras[ nodeDef.camera ];

                } else if ( nodeDef.extensions
                         && nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ]
                         && nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].light !== undefined ) {

                    let lights = extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].lights;
                    node = lights[ nodeDef.extensions[ EXTENSIONS.KHR_LIGHTS_PUNCTUAL ].light ];

                } else {

                    node = new THREE.Object3D();

                }

                if ( nodeDef.name !== undefined ) {

                    node.name = THREE.PropertyBinding.sanitizeNodeName( nodeDef.name );

                }

                assignExtrasToUserData( node, nodeDef );

                if ( nodeDef.extensions ) addUnknownExtensionsToUserData( extensions, node, nodeDef );

                if ( nodeDef.matrix !== undefined ) {

                    let matrix = new THREE.Matrix4();
                    matrix.fromArray( nodeDef.matrix );
                    node.applyMatrix( matrix );

                } else {

                    if ( nodeDef.translation !== undefined ) {

                        node.position.fromArray( nodeDef.translation );

                    }

                    if ( nodeDef.rotation !== undefined ) {

                        node.quaternion.fromArray( nodeDef.rotation );

                    }

                    if ( nodeDef.scale !== undefined ) {

                        node.scale.fromArray( nodeDef.scale );

                    }

                }

                return node;

            } );

        };

        /**
         * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
         * @param {number} sceneIndex
         * @return {Promise<THREE.Scene>}
         */
        GLTFParser.prototype.loadScene = function () {

            // scene node hierachy builder

            function buildNodeHierachy( nodeId, parentObject, json, allNodes, skins ) {

                let node = allNodes[ nodeId ];
                let nodeDef = json.nodes[ nodeId ];

                // build skeleton here as well

                if ( nodeDef.skin !== undefined ) {

                    let meshes = node.isGroup === true ? node.children : [ node ];

                    for ( let i = 0, il = meshes.length; i < il; i ++ ) {

                        let mesh = meshes[ i ];
                        let skinEntry = skins[ nodeDef.skin ];

                        let bones = [];
                        let boneInverses = [];

                        for ( let j = 0, jl = skinEntry.joints.length; j < jl; j ++ ) {

                            let jointId = skinEntry.joints[ j ];
                            let jointNode = allNodes[ jointId ];

                            if ( jointNode ) {

                                bones.push( jointNode );

                                let mat = new THREE.Matrix4();

                                if ( skinEntry.inverseBindMatrices !== undefined ) {

                                    mat.fromArray( skinEntry.inverseBindMatrices.array, j * 16 );

                                }

                                boneInverses.push( mat );

                            } else {

                                console.warn( 'THREE.GLTFLoader: Joint "%s" could not be found.', jointId );

                            }

                        }

                        mesh.bind( new THREE.Skeleton( bones, boneInverses ), mesh.matrixWorld );

                    }

                }

                // build node hierachy

                parentObject.add( node );

                if ( nodeDef.children ) {

                    let children = nodeDef.children;

                    for ( let i = 0, il = children.length; i < il; i ++ ) {

                        let child = children[ i ];
                        buildNodeHierachy( child, node, json, allNodes, skins );

                    }

                }

            }

            return function loadScene( sceneIndex ) {

                let json = this.json;
                let extensions = this.extensions;
                let sceneDef = this.json.scenes[ sceneIndex ];

                return this.getMultiDependencies( [

                    'node',
                    'skin'

                ] ).then( function ( dependencies ) {

                    let scene = new THREE.Scene();
                    if ( sceneDef.name !== undefined ) scene.name = sceneDef.name;

                    assignExtrasToUserData( scene, sceneDef );

                    if ( sceneDef.extensions ) addUnknownExtensionsToUserData( extensions, scene, sceneDef );

                    let nodeIds = sceneDef.nodes || [];

                    for ( let i = 0, il = nodeIds.length; i < il; i ++ ) {

                        buildNodeHierachy( nodeIds[ i ], scene, json, dependencies.nodes, dependencies.skins );

                    }

                    return scene;

                } );

            };

        }();

        return GLTFLoader;

    } )();

    const opacityRemap = (mat) => {
        if (mat.opacity === 0) {
            mat.opacity = 1;
        }
    };
    function createLitScene() {
        const scene = new THREE$1.Scene();
        const light = new THREE$1.AmbientLight(0xffffff, 1);
        const directionalLight = new THREE$1.DirectionalLight(0xffffff, 0.3);
        directionalLight.position.set(10, 15, 10);
        directionalLight.castShadow = true;
        const planeGeometry = new THREE$1.PlaneGeometry(2000, 2000);
        planeGeometry.rotateX(-Math.PI / 2);
        const shadowMesh = new THREE$1.Mesh(planeGeometry, new THREE$1.ShadowMaterial({
            opacity: 0.2,
        }));
        shadowMesh.name = 'shadowMesh';
        shadowMesh.receiveShadow = true;
        shadowMesh.position.y = 10 * 1000;
        scene.add(shadowMesh);
        scene.add(light);
        scene.add(directionalLight);
        return scene;
    }
    function loadGLTFModel(url) {
        const gltfLoader = new GLTFLoader();
        return new Promise(resolve => {
            gltfLoader.load(url, (gltf) => {
                gltf.scene.traverse(node => {
                    if (node instanceof THREE$1.Mesh) {
                        opacityRemap(node.material);
                    }
                });
                resolve(gltf);
            });
        });
    }
    function lookAtOnY(looker, target) {
        const targetPos = new THREE$1.Vector3().setFromMatrixPosition(target.matrixWorld);
        const angle = Math.atan2(targetPos.x - looker.position.x, targetPos.z - looker.position.z);
        looker.rotation.set(0, angle, 0);
    }
    function fixFramebuffer(app) {
        THREE$1.Object3D.prototype.onBeforeRender = () => {
            app.gl.bindFramebuffer(app.gl.FRAMEBUFFER, app.session.baseLayer.framebuffer);
        };
    }

    class Reticle extends THREE$1.Object3D {
        constructor(xrSession, camera) {
            super();
            const geometry = new THREE$1.RingBufferGeometry(0.1, 0.11, 32, 1);
            geometry.applyMatrix(new THREE$1.Matrix4().makeRotationX(THREE$1.Math.degToRad(-90)));
            this.ring = new THREE$1.Mesh(geometry, new THREE$1.MeshBasicMaterial({ color: 0xffffff }));
            this.add(this.ring);
            this.session = xrSession;
            this.visible = false;
            this.camera = camera;
            this.raycaster = new THREE$1.Raycaster();
        }
        async update(frameOfRef) {
            this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
            const ray = this.raycaster.ray;
            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());
            const hits = await this.session.requestHitTest(origin, direction, frameOfRef);
            if (hits.length > 0) {
                const hit = hits[0];
                const hitMatrix = new THREE$1.Matrix4().fromArray(hit.hitMatrix);
                this.position.setFromMatrixPosition(hitMatrix);
                lookAtOnY(this, this.camera);
                this.visible = true;
            }
        }
    }

    const MODEL_GLTF_URL = 'assets/couch/sofa.gltf';
    const MODEL_NAME = 'sofa';
    const MODEL_SCALE = 0.1;

    function load3DText(message, options) {
        const fontOptions = {
            size: options.size || 1.0,
            height: options.height || 0.01
        };
        const fontColor = options.color || 0xFFFFFF;
        const fontFace = options.fontFace || 'helvetiker';
        const fontStyle = options.bold ? 'bold' : 'regular';
        const fontURL = `fonts/${fontFace}_${fontStyle}.typeface.json`;
        const loader = new THREE$1.FontLoader();
        return new Promise((resolve, reject) => {
            loader.load(fontURL, font => {
                const textObject = new THREE$1.Mesh(new THREE$1.TextGeometry(message, Object.assign({}, fontOptions, { font })), new THREE$1.MeshBasicMaterial({
                    color: fontColor,
                    transparent: true,
                    opacity: 1.0,
                    side: THREE$1.DoubleSide
                }));
                resolve(textObject);
            }, null, reject);
        });
    }

    var SofaColor;
    (function (SofaColor) {
        SofaColor[SofaColor["BLACK"] = 1118481] = "BLACK";
        SofaColor[SofaColor["GREY"] = 3355443] = "GREY";
    })(SofaColor || (SofaColor = {}));
    const COLOR_PICKER_MAPPING = [
        { buttonID: 'color-black', sofaColor: SofaColor.BLACK },
        { buttonID: 'color-grey', sofaColor: SofaColor.GREY }
    ];
    class Application {
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
        async init() {
            const navigatorInstance = navigator;
            if (navigatorInstance.xr && XRSession.prototype.requestHitTest) {
                try {
                    this.device = await navigatorInstance.xr.requestDevice();
                }
                catch (e) {
                    this.onNoXRDevice();
                    return;
                }
            }
            else {
                this.onNoXRDevice();
                return;
            }
            document.querySelector('#enter-ar').addEventListener('click', this.onEnterAR);
        }
        async onEnterAR() {
            const outputCanvas = document.createElement('canvas');
            const ctx = outputCanvas.getContext('xrpresent');
            try {
                const session = await this.device.requestSession({
                    outputContext: ctx,
                    environmentIntegration: true,
                });
                document.body.appendChild(outputCanvas);
                this.onSessionStarted(session);
                this.bindColorPickerListeners();
            }
            catch (e) {
                this.onNoXRDevice();
            }
        }
        onNoXRDevice() {
            document.body.classList.add('unsupported');
        }
        async onSessionStarted(session) {
            this.session = session;
            document.body.classList.add('ar');
            this.renderer = new THREE$1.WebGLRenderer({
                alpha: true,
                preserveDrawingBuffer: true,
            });
            this.renderer.autoClear = false;
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE$1.PCFSoftShadowMap;
            this.gl = this.renderer.getContext();
            await this.gl.setCompatibleXRDevice(this.session.device);
            this.session.baseLayer = new XRWebGLLayer(this.session, this.gl);
            this.scene = createLitScene();
            fixFramebuffer(this);
            Promise.all([
                loadGLTFModel(MODEL_GLTF_URL),
                this.loadText()
            ]).then(data => {
                const [sofa] = data;
                sofa.scene.name = MODEL_NAME;
                sofa.scene.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
                sofa.scene.rotateY(-Math.PI / 2);
                this.model = new THREE$1.Group();
                this.model.add(sofa.scene);
            });
            this.camera = new THREE$1.PerspectiveCamera();
            this.camera.matrixAutoUpdate = false;
            this.reticle = new Reticle(this.session, this.camera);
            this.scene.add(this.reticle);
            this.frameOfRef = await this.session.requestFrameOfReference('eye-level');
            this.session.requestAnimationFrame(this.onXRFrame);
            window.addEventListener('click', this.onClick);
        }
        async loadText() {
            const [titleText, description] = await Promise.all([
                load3DText('SØFÄ', { fontFace: 'droid_sans', size: 0.10, bold: true }),
                load3DText('1,200 kr.', { size: 0.05 })
            ]);
            description.translateX(0.0125);
            description.translateY(-0.075);
            this.textGroup = new THREE$1.Group();
            this.textGroup.add(titleText);
            this.textGroup.add(description);
        }
        onXRFrame(time, frame) {
            const session = frame.session;
            const pose = frame.getDevicePose(this.frameOfRef);
            this.reticle.update(this.frameOfRef);
            if (this.reticle.visible && !this.stabilized) {
                this.stabilized = true;
                document.body.classList.add('stabilized');
            }
            session.requestAnimationFrame(this.onXRFrame);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.session.baseLayer.framebuffer);
            if (pose) {
                for (const view of frame.views) {
                    const viewport = session.baseLayer.getViewport(view);
                    this.renderer.setSize(viewport.width, viewport.height);
                    this.camera.projectionMatrix.fromArray(view.projectionMatrix);
                    const viewMatrix = new THREE$1.Matrix4().fromArray(pose.getViewMatrix(view));
                    this.camera.matrix.getInverse(viewMatrix);
                    this.camera.updateMatrixWorld(true);
                    this.renderer.clearDepth();
                    this.renderer.render(this.scene, this.camera);
                }
            }
        }
        async onClick(e) {
            if (!this.model && !this.textGroup) {
                return;
            }
            const buttonElements = COLOR_PICKER_MAPPING
                .map(entry => document.getElementById(entry.buttonID));
            if (buttonElements.includes(e.target)) {
                return;
            }
            const x = 0;
            const y = 0;
            this.raycaster = this.raycaster || new THREE$1.Raycaster();
            this.raycaster.setFromCamera({ x, y }, this.camera);
            const ray = this.raycaster.ray;
            const origin = new Float32Array(ray.origin.toArray());
            const direction = new Float32Array(ray.direction.toArray());
            const hits = await this.session.requestHitTest(origin, direction, this.frameOfRef);
            if (hits.length > 0) {
                document.body.classList.add('placed');
                const hit = hits[0];
                const hitMatrix = new THREE$1.Matrix4().fromArray(hit.hitMatrix);
                this.model.position.setFromMatrixPosition(hitMatrix);
                this.textGroup.position.setFromMatrixPosition(hitMatrix);
                this.textGroup.translateX(1.2);
                this.textGroup.translateY(0.8);
                lookAtOnY(this.model, this.camera);
                const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
                shadowMesh.position.y = this.model.position.y;
                this.scene.add(this.model);
                this.setSofaColor(SofaColor.GREY);
                this.scene.add(this.textGroup);
            }
        }
        revealModel() {
            let allTweensCompleted = false;
            const checkAllTweensCompleted = () => {
                allTweensCompleted = assetTweenCompleted && textTweenCompleted;
            };
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
            const animate = (time) => {
                if (!allTweensCompleted) {
                    this.session.requestAnimationFrame(animate);
                    TWEEN.update(time);
                }
            };
            this.session.requestAnimationFrame(animate);
        }
        bindColorPickerListeners() {
            for (const colorPickerMap of COLOR_PICKER_MAPPING) {
                const { buttonID, sofaColor } = colorPickerMap;
                document.getElementById(buttonID).addEventListener('click', e => {
                    e.preventDefault();
                    this.setSofaColor(sofaColor);
                    document.querySelector('#color-picker a.selected')
                        .classList.remove('selected');
                    const button = e.target;
                    button.classList.add('selected');
                });
            }
        }
        setSofaColor(color) {
            const sofa = this.scene.getObjectByName(MODEL_NAME);
            if (sofa !== undefined) {
                let materialIterator = 0;
                sofa.traverse(node => {
                    if (node instanceof THREE$1.Mesh
                        && node.material instanceof THREE$1.MeshStandardMaterial
                        && materialIterator++ === 0) {
                        node.material.color = new THREE$1.Color(color);
                        node.material.needsUpdate = true;
                    }
                });
            }
        }
    }

    if (window.WebXRPolyfill) {
        const polyfill = new WebXRPolyfill();
        if (window.WebXRVersionShim) {
            const versionShim = new WebXRVersionShim();
        }
    }
    const app = new Application();
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const navigatorInstance = navigator;
                const registration = await navigatorInstance.serviceWorker.register('service-worker.js');
                console.log('ServiceWorker registration successful with scope:', registration.scope);
            }
            catch (ex) {
                console.log('ServiceWorker registration failed:', ex);
            }
        });
    }

}(THREE));
//# sourceMappingURL=app.js.map
