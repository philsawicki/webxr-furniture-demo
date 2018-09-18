import typescript from 'rollup-plugin-typescript';


const applicationConfig = {
    input: './src/main.ts',
    output: {
        file: './dist/app.js',
        sourcemap: true,
        format: 'iife',
        globals: {
            three: 'THREE'
        }
    },
    external: ['three'],
    plugins: [
        typescript({
            typescript: require('typescript')
        })
    ]
};

const serviceWorkerConfig = {
    input: './src/service-worker.ts',
    output: {
        file: './dist/service-worker.js',
        sourcemap: true,
        format: 'iife'
    },
    plugins: [
        typescript({
            typescript: require('typescript')
        })
    ]
};


export default [
    applicationConfig,
    serviceWorkerConfig
];
