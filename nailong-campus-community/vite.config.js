import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
export default defineConfig({
 plugins:[vue()],
 build:{rollupOptions:{output:{manualChunks(id){if(id.includes('/node_modules/three/'))return 'three-vendor';}}}},
 server:{fs:{allow:[fileURLToPath(new URL('..',import.meta.url))]},proxy:{'/api':{target:'http://127.0.0.1:5180',changeOrigin:true}}}
});
