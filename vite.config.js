import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
    build: {
        outDir: 'dist',
        lib: {
            entry: resolve(__dirname, 'src/index.js'),
            name: 'AudioMIDISyncer',
            fileName: 'amsync',
        }
    }
})