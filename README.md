# 📷 UnPlastic: Peel Away the Synthetic AI Look

![UnPlastic App UI](preview-ui.png)

**UnPlastic** is a high-performance, completely browser-based post-processing tool designed to fix the common flaws of AI-generated images (Z-Image-Turbo, Qwen-Image, Midjourney, Stable Diffusion). It mathematically retrieves lost micro-details, eliminates the "plastic" skin texture, and restores a photographic feel to your generations.

Powered by a custom **Rust-compiled WebAssembly (WASM)** engine running inside Web Workers, it delivers desktop-grade image processing speeds with **100% privacy** (zero server uploads).

[🚀 Try UnPlastic Live Here](https://thetacursed.github.io/unplastic/) 

---

## ✨ Features

### 🧠 Proprietary Processing Engine (WASM)
* **Intelligent Micro-Texture Recovery:** Safely extracts ultra-fine details (like skin pores, dirt, and fabric weaves) using an advanced edge-aware algorithm. It automatically protects high-contrast boundaries, ensuring a clean, photographic look without introducing ugly digital halos.
* **True 3D Volume & Structure:** Eliminates the flat, 2D appearance common in AI art. Our engine intelligently reshapes local contrast to restore natural depth and physical structure to faces and environments, all while perfectly preserving your original color grading.
* **Organic, Luminance-Responsive Grain:** Forget cheap, static noise overlays. UnPlastic generates a dynamic, mathematical grain profile that adapts to the lighting of your image. It blends naturally into shadows to mimic real camera sensor behavior and break up artificial digital gradients.
* **Dynamic Unveil (Dehaze):** Strips away the artificial "fog" and washed-out look often produced by generative models, recovering deep, natural contrast and atmospheric clarity.
* **Lossless Full-Resolution Export:** While the real-time viewport is heavily optimized for smooth browser performance, clicking "Save" reroutes your original, uncompressed image through the WASM core to guarantee maximum quality and pixel-perfect export.

### 🎨 UI/UX
* **Infinite Pan & Zoom:** Navigate images smoothly using `Mouse Wheel` to zoom and `Spacebar + Drag` to pan.
* **Instant A/B Comparison:** Hold `C` or click the compare button to instantly see the original image.
* **Session Memory:** Sliders automatically save their state via `localStorage` so you don't lose your custom preset between sessions.
* **Drag & Drop:** Drop images directly into the browser window.

---

## ⌨️ Keyboard Shortcuts

Power users can navigate the app entirely without a mouse:

| Key | Action |
| :--- | :--- |
| `Space + Drag` | Pan around the zoomed image |
| `C` (Hold) | Compare with original image |
| `S` | Save / Export full-resolution image |
| `R` | Reset all sliders to zero |
| `F` | Toggle Fullscreen mode |
| `Esc` | Close image and return to upload screen |

---

## 🛠️ Architecture & Tech Stack

UnPlastic is built with a strict separation of concerns to maximize performance on the web:

1. **Frontend (UI & Rendering):** Pure HTML5, CSS3, and Vanilla JavaScript. Hardware-accelerated `<canvas>` for real-time viewport updates.
2. **Multithreading:** Heavy image processing is offloaded to a **Web Worker** to ensure the main UI thread never freezes.
3. **The Core Engine (Rust + WASM):** The actual pixel-math (Frequency Separation, Hashing, Tonal Curves) is written in Rust and compiled to WebAssembly. This allows for low-level memory management and near-native execution speeds.

> **Privacy First:** Because the entire WASM engine runs locally in the user's browser, images are **never** uploaded to any server.

---
## 📜 License & Usage

UnPlastic is a free web tool created for the community. 

* **Free to use:** You can use the live web app for any personal or commercial AI art projects. Completely free, no watermarks, no limits.
* **Proprietary Engine:** To keep the tool accessible and maintainable, the core WASM processing engine and UI are closed-source/freeware. Please use the tool via the official hosted page. 
* **Business/API:** If you are a studio looking for offline batch-processing, CLI integration, or API access, feel free to reach out to me directly!
