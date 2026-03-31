// Импортируем обертку, сгенерированную wasm-pack
import init, { process_data } from '../wasm/wasm_image_processor.js';

let wasmReady = false;

// Инициализируем Wasm при старте воркера
init().then(() => {
    wasmReady = true;
    postMessage({ type: 'READY' });
});

self.onmessage = function(e) {
    if (!wasmReady) return; // Защита на случай, если пришлют задачу до загрузки
    
    const { imageData, params } = e.data;
    
    // В wasm-bindgen мы передаем сам Uint8ClampedArray напрямую.
    // Rust изменит его содержимое "на месте" (in-place).
    process_data(
        imageData.data, 
        imageData.width, 
        imageData.height,
        params.p1, 
        params.p2, 
        params.p3,
        params.p4, 
        params.p5,
        params.p6
    );

    // Возвращаем измененный массив обратно
    self.postMessage({ pixels: imageData.data }, [imageData.data.buffer]);
};