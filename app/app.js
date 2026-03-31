document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const uploadButton = document.getElementById('upload-button');
    const imageCanvas = document.getElementById('image-canvas');
    const uploadPrompt = document.getElementById('upload-prompt');
    const ctx = imageCanvas.getContext('2d', { willReadFrequently: true });
    const downloadButton = document.getElementById('download-button');
    const compareButton = document.getElementById('compare-button');
    const closeButton = document.getElementById('close-button');
    const actionBar = document.getElementById('action-bar');
    const resetAllButton = document.getElementById('reset-all-button');
    const warningOverlay = document.getElementById('warning-overlay');
    const warningContinueBtn = document.getElementById('warning-continue');
    const warningCancelBtn = document.getElementById('warning-cancel');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const imageInfo = document.getElementById('image-info');
    const openAboutModal = document.getElementById('open-about-modal');
    const aboutOverlay = document.getElementById('about-overlay');
    const closeAboutBtn = document.getElementById('close-about-btn');


    const backCanvas = document.createElement('canvas');
    const backCtx = backCanvas.getContext('2d');
    let isImageLoaded = false;
    let lastProcessedData = null;
    let sourceImage = null;
    let originalImageData = null; // Кеш пикселей оригинала

    let isCurrentlyInDemo = false; // Флаг, показывающий, что сейчас активно демо-изображение
        // --- Инициализация защищенного Wasm-воркера ---
    const filterWorker = new Worker('worker.js', { type: 'module' });
    let isWorkerReady = false;
    let isWorkerBusy = false; // Флаг: занят ли сейчас воркер
    let nextParams = null;    // Хранит параметры, если юзер двигал ползунок, пока воркер был занят

    filterWorker.onmessage = (e) => {
        if (e.data.type === 'READY') {
            isWorkerReady = true;
        }
    };

    
    // --- Функции для работы с localStorage ---
    function saveSliderValues() {
        const values = {};
        for (const key in sliders) {
            if (sliders[key]) {
                values[key] = sliders[key].value;
            }
        }
        localStorage.setItem('unPlasticSliderValues', JSON.stringify(values));
    }

    function loadSliderValues() {
        const savedValues = localStorage.getItem('unPlasticSliderValues');
        if (savedValues) {
            const values = JSON.parse(savedValues);
            resetSliders(values); // Используем resetSliders для установки значений
            return Object.values(values).some(v => parseFloat(v) !== 0);
        }
        return false;
    }
    

    // --- Инициализация ползунков ---
    const sliders = {
        highlights: document.getElementById('highlights'), // Диапазон -100...100
        shadows: document.getElementById('shadows'),       // Диапазон -100...100
        unveil: document.getElementById('unveil'),
        'micro-texture': document.getElementById('micro-texture'),
        structure: document.getElementById('structure'),
        grit: document.getElementById('grit'),
    };

    // --- Логика загрузки файла ---
    uploadButton.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });






// --- Переменные для Zoom и Pan ---
let scale = 1;
let translateX = 0;
let translateY = 0;
let isPanning = false;
let isSpacePressed = false;
let startMouseX = 0;
let startMouseY = 0;

function applyConstraints() {
    const containerW = dropZone.clientWidth;
    const containerH = dropZone.clientHeight;
    
    // Текущий визуальный размер холста на экране
    const canvasW = imageCanvas.clientWidth * scale;
    const canvasH = imageCanvas.clientHeight * scale;

    if (scale <= 1) {
        // При масштабе <= 1 панорамирование не нужно, но сброс происходит в другом месте
    } else {
        const maxDX = Math.max(0, (canvasW - containerW) / 2);
        const maxDY = Math.max(0, (canvasH - containerH) / 2);
        translateX = Math.max(-maxDX, Math.min(maxDX, translateX));
        translateY = Math.max(-maxDY, Math.min(maxDY, translateY));
    }
}

function updateCanvasTransform() {
    applyConstraints(); // Ограничиваем панорамирование
    // Применяем зум и панорамирование
    imageCanvas.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

function resetTransform() {
    scale = 1;
    translateX = 0;
    translateY = 0;
    // Принудительно убираем любые транзиции, если они были в CSS
    imageCanvas.style.transition = 'none'; 
    updateCanvasTransform();
}

// --- Обработка колеса мыши (Zoom) ---
dropZone.addEventListener('wheel', (e) => {
    if (!isImageLoaded) return;
    e.preventDefault();

    const zoomSpeed = 0.0015;
    const delta = -e.deltaY;
    const factor = Math.pow(1.1, delta / 100); // Коэффициент изменения масштаба

    const rect = dropZone.getBoundingClientRect();
    
    // 1. Координаты мыши относительно центра контейнера
    // (так как у нас transform-origin: center)
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    const oldScale = scale;
    let newScale = scale * factor;

    // Ограничения масштаба
    newScale = Math.min(Math.max(0.1, newScale), 10);

    // 2. Вычисляем, насколько нужно сдвинуть картинку, чтобы точка под мышкой не уехала
    // Формула: НовоеСмещение = Мышь - (Мышь - СтароеСмещение) * (НовыйМасштаб / СтарыйМасштаб)
    if (newScale > 1) {
        const ratio = newScale / oldScale;
        translateX = mouseX - (mouseX - translateX) * ratio;
        translateY = mouseY - (mouseY - translateY) * ratio;
    } else {
        // Если отдаляем меньше 1, просто центрируем (ваше требование)
        translateX = 0;
        translateY = 0;
    }

    scale = newScale;
    updateCanvasTransform();
}, { passive: false });

// --- Перемещение (Drag / Pan) ---
dropZone.addEventListener('mousedown', (e) => {
    if (isSpacePressed && isImageLoaded && scale > 1) {
        isPanning = true;
        startMouseX = e.clientX - translateX;
        startMouseY = e.clientY - translateY;
        
        // Меняем ладонь на "сжатый кулак"
        document.body.classList.add('is-grabbing');
    }
});

window.addEventListener('mousemove', (e) => {
    if (isPanning && isSpacePressed && scale > 1) {
        translateX = e.clientX - startMouseX;
        translateY = e.clientY - startMouseY;
        updateCanvasTransform();
    }
});

window.addEventListener('mouseup', () => {
    isPanning = false;
    // Возвращаем "открытую ладонь", если пробел всё еще нажат
    document.body.classList.remove('is-grabbing');
});

// Дополнительно: сброс при выходе мыши из окна браузера
window.addEventListener('blur', () => {
    isSpacePressed = false;
    isPanning = false;
    document.body.classList.remove('space-hold', 'is-grabbing');
});

// --- Обработка клавиатуры (Пробел) ---
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        // Предотвращаем скролл страницы
        if (e.target === document.body || e.target === dropZone) e.preventDefault();
        
        if (!isSpacePressed) {
            isSpacePressed = true;
            // Показываем "открытую ладонь", если картинка загружена и масштаб позволяет двигать
            if (isImageLoaded && scale > 1) {
                document.body.classList.add('space-hold');
            }
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        isSpacePressed = false;
        isPanning = false;
        // Убираем все курсоры-руки
        document.body.classList.remove('space-hold');
        document.body.classList.remove('is-grabbing');
    }
});


// --- Глобальные горячие клавиши ---
window.addEventListener('keydown', (e) => {
    // Хоткеи работают только когда есть картинка и не активны инпуты
    if (!isImageLoaded || e.target.tagName === 'INPUT') return;

    // Предотвращаем срабатывание, если кнопка уже зажата (для 'c')
    if (e.repeat) return;

    switch (e.code) { // Используем e.code для независимости от раскладки
        case 'KeyS': // Клавиша S
            e.preventDefault(); // Предотвратить стандартное сохранение страницы (Ctrl+S)
            downloadButton.click();
            break;
        case 'KeyC': // Клавиша C
            e.preventDefault();
            showOriginal(); // Показываем оригинал при нажатии
            break;
        case 'KeyR': // Клавиша R
            e.preventDefault();
            resetAllButton.click();
            break;
        case 'Escape': // Клавиша Escape
            e.preventDefault();
            closeButton.click();
            break;
        case 'KeyF': // Клавиша F
            e.preventDefault();
            fullscreenButton.click();
            break;
    }
});

window.addEventListener('keyup', (e) => {
    // Проверяем, что это не ввод в текстовое поле
    if (!isImageLoaded || e.target.tagName === 'INPUT') return;

    if (e.code === 'KeyC') { // Используем e.code
        e.preventDefault();
        showProcessed(); // Возвращаем обработанное изображение при отпускании
    }
});


    // --- Логика модального окна ---
    let pendingImage = null; // Временно храним изображение, пока юзер решает

    warningContinueBtn.addEventListener('click', () => {
        if (pendingImage) {
            proceedWithImage(pendingImage.img, pendingImage.file);
            pendingImage = null;
        }
        warningOverlay.classList.add('hidden');
    });

    warningCancelBtn.addEventListener('click', () => {
        pendingImage = null;
        warningOverlay.classList.add('hidden');
        fileInput.value = ''; // Сбрасываем инпут, чтобы можно было выбрать тот же файл снова
    });


    function handleFiles(files) {
    const file = files[0];
    if (file && file.type.startsWith('image/')) {
        // Если пользователь загружает свой файл, считаем, что он ознакомился с демо
        if (isCurrentlyInDemo) {
            localStorage.setItem('unplastic_visited', 'true');
            isCurrentlyInDemo = false;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Проверяем размер изображения
                if (img.naturalWidth > 2048 || img.naturalHeight > 2048) {
                    pendingImage = { img, file };
                    warningOverlay.classList.remove('hidden');
                } else {
                    // Если изображение не большое, обрабатываем сразу
                    proceedWithImage(img, file);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

    function proceedWithImage(img, file, isDemo = false) {
        const imageInfo = document.getElementById('image-info');
        sourceImage = img; // Сохраняем оригинал
        const format = file.type.split('/')[1] || 'unknown';
        const fileName = file.name || 'image';
        imageInfo.textContent = `${img.naturalWidth} x ${img.naturalHeight} px, ${format.toUpperCase()}`;
        imageInfo.classList.remove('hidden');

        drawImageToCanvas(img);

        uploadPrompt.classList.add('hidden');
        dropZone.classList.add('has-image');
        actionBar.classList.remove('hidden');

        if (isDemo) {
            isCurrentlyInDemo = true; // Устанавливаем флаг, что мы в демо-режиме
            // Для демо-режима применяем конкретные настройки
            const demoSettings = {
                'micro-texture': 50, structure: 30, unveil: 30,
                grit: 10, highlights: 10, shadows: 20
            };
            resetSliders(demoSettings); // Устанавливаем значения
            waitForWorkerAndApplyFilters(); // Применяем фильтры после готовности воркера
        } else {
            // Если загружено не демо-изображение, помечаем, что демо-режим пройден
            if (isCurrentlyInDemo) { // Доп. проверка, если пользователь как-то обошел handleFiles
                localStorage.setItem('unplastic_visited', 'true');
                isCurrentlyInDemo = false;
            }
            // Для обычного изображения загружаем сохраненные значения
            const hadSavedValues = loadSliderValues();
            // и применяем их, если они были не нулевые
            if (hadSavedValues) {
                waitForWorkerAndApplyFilters();
            }
        }
    }

    closeButton.addEventListener('click', () => {
        // Скрываем все, что связано с изображением
        imageCanvas.classList.add('hidden');
        actionBar.classList.add('hidden');
        imageInfo.classList.add('hidden');
        
        // Показываем снова приглашение к загрузке
        uploadPrompt.classList.remove('hidden');
        dropZone.classList.remove('has-image');

        // Сбрасываем состояние
        sourceImage = null;
        isImageLoaded = false;
        // Если мы закрыли демо-изображение, помечаем, что оно просмотрено
        if (isCurrentlyInDemo) {
            localStorage.setItem('unplastic_visited', 'true');
            isCurrentlyInDemo = false;
        }

        fileInput.value = ''; // Позволяет загрузить тот же файл снова
        resetTransform();
    });
    
    function drawImageToCanvas(img) {    
        imageCanvas.width = img.naturalWidth;
        imageCanvas.height = img.naturalHeight;
        backCanvas.width = img.naturalWidth;
        backCanvas.height = img.naturalHeight;

        fitCanvasToContainer();

        imageCanvas.classList.remove('hidden');
        ctx.drawImage(img, 0, 0);
        backCtx.drawImage(img, 0, 0);

        // СОХРАНЯЕМ ОРИГИНАЛ ОДИН РАЗ ЗДЕСЬ
        originalImageData = backCtx.getImageData(0, 0, backCanvas.width, backCanvas.height);
        lastProcessedData = originalImageData;
        isImageLoaded = true;
        
        resetTransform(); 
    }

    function fitCanvasToContainer() {
        if (!isImageLoaded || !sourceImage) return;

        const container = dropZone;
        const imgRatio = sourceImage.naturalWidth / sourceImage.naturalHeight;
        const containerRatio = container.clientWidth / container.clientHeight;

        let cssWidth, cssHeight;

        if (imgRatio > containerRatio) {
            // Изображение шире контейнера
            cssWidth = container.clientWidth;
            cssHeight = container.clientWidth / imgRatio;
        } else {
            // Изображение выше контейнера или пропорции совпадают
            cssHeight = container.clientHeight;
            cssWidth = container.clientHeight * imgRatio;
        }
        imageCanvas.style.width = `${cssWidth}px`;
        imageCanvas.style.height = `${cssHeight}px`;
    }


// Функция-обертка для вызова воркера
function applyImageFiltersWorker(imageDataToSend, params) {
    return new Promise((resolve) => {
        if (!isWorkerReady) {
            resolve(imageDataToSend); 
            return;
        }

        // Ждем ответ от воркера
        filterWorker.onmessage = (e) => {
            resolve(new ImageData(e.data.pixels, imageDataToSend.width, imageDataToSend.height));
        };

        const obfParams = {
            p1: params.p1,
            p2: params.p2,
            p3: params.p3,
            p4: params.p4,
            p5: params.p5,
            p6: params.p6
        };

        // Отправляем данные с передачей владения буфером (очень быстро)
        filterWorker.postMessage({ imageData: imageDataToSend, params: obfParams }, [imageDataToSend.data.buffer]);
    });
}

// Функция-обертка, которая ждет готовности воркера перед применением фильтров
function waitForWorkerAndApplyFilters() {
    if (isWorkerReady) {
        applyFilters();
    } else {
        // Если воркер еще не готов, ждем сообщения 'READY'
        const onWorkerReady = (e) => {
            if (e.data.type === 'READY') {
                applyFilters();
                filterWorker.removeEventListener('message', onWorkerReady); // Убираем слушатель
            }
        };
        filterWorker.addEventListener('message', onWorkerReady);
    }
}

    // Главная функция применения фильтров
    async function applyFilters() {
        if (!isImageLoaded || !originalImageData) return;
        
        const params = {
            p1: parseInt(sliders.highlights.value),
            p2: parseInt(sliders.shadows.value),
            p3: parseInt(sliders.unveil.value) / 100,
            p4: parseInt(sliders['micro-texture'].value) / 100,
            p5: parseInt(sliders.structure.value) / 100,
            p6: parseInt(sliders.grit.value) / 100
        };
        
        const isActive = Object.values(params).some(v => v !== 0);

        // Если всё по нулям - возвращаем оригинал мгновенно
        if (!isActive) {
            lastProcessedData = originalImageData;
            ctx.putImageData(originalImageData, 0, 0);
            return;
        }

        // Если воркер сейчас считает прошлый кадр — просто сохраняем новые настройки
        if (isWorkerBusy) {
            nextParams = params;
            return;
        }

        isWorkerBusy = true; // Блокируем новые запросы

        // Запускаем цикл: пока есть "отложенные" параметры ползунков, обрабатываем их
        let currentParams = params;
        while (currentParams) {
            try {
                // КОПИРУЕМ оригинальные данные. Это работает в 10 раз быстрее, чем getImageData
                const dataCopy = new Uint8ClampedArray(originalImageData.data);
                const imageDataToSend = new ImageData(dataCopy, originalImageData.width, originalImageData.height);

                // Ждем завершения расчетов в Wasm
                const processedData = await applyImageFiltersWorker(imageDataToSend, currentParams);
                
                lastProcessedData = processedData;
                
                // Отрисовываем результат через requestAnimationFrame для максимальной плавности экрана
                requestAnimationFrame(() => {
                    ctx.putImageData(processedData, 0, 0);
                });
                
            } catch (error) { 
                console.error("Worker error:", error); 
            }

            // Проверяем, двигал ли юзер ползунок, пока мы считали
            currentParams = nextParams; 
            nextParams = null; // Очищаем очередь
        }

        isWorkerBusy = false; // Освобождаем воркер
    }


    const showOriginal = () => {
        if (!isImageLoaded) return;
        // Просто рисуем содержимое backCanvas (оригинал) поверх основного
        ctx.drawImage(backCanvas, 0, 0);
    };

    const showProcessed = () => {
        if (!isImageLoaded || !lastProcessedData) return;
        // Возвращаем сохраненный результат фильтров
        ctx.putImageData(lastProcessedData, 0, 0);
    };

    // События мыши
    compareButton.addEventListener('mousedown', showOriginal);
    compareButton.addEventListener('mouseup', showProcessed);
    compareButton.addEventListener('mouseleave', showProcessed); // Чтобы не «залипало»

    // События тачскрина (для мобилок)
    compareButton.addEventListener('touchstart', (e) => {
        e.preventDefault();
        showOriginal();
    });
    compareButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        showProcessed();
    });

    for (const key in sliders) {
        if (sliders[key]) {
            const slider = sliders[key];
            const valueInput = document.getElementById(`${slider.id}-value`);

            // 1. Обновление поля ввода при движении ползунка
            slider.addEventListener('input', () => {
                if (valueInput) {
                    valueInput.value = slider.value;
                }
                // Снимаем фокус с ползунка, чтобы хоткеи (R, C, S) работали
                // без необходимости кликать куда-либо еще.
                if (document.activeElement) document.activeElement.blur();
                debouncedApplyFilters();
                debouncedSaveSliderValues();
            });

            // 2. Обновление ползунка при ручном вводе
            valueInput.addEventListener('change', (e) => {
                const min = parseInt(slider.min, 10);
                const max = parseInt(slider.max, 10);
                let value = parseInt(e.target.value, 10);

                // Валидация: если не число, возвращаем 0. Если выходит за рамки, ставим крайнее значение.
                if (isNaN(value)) {
                    value = 0;
                } else if (value < min) {
                    value = min;
                } else if (value > max) {
                    value = max;
                }

                e.target.value = value; // Обновляем поле ввода отформатированным значением
                slider.value = value; // Обновляем ползунок
                debouncedApplyFilters();
                debouncedSaveSliderValues();
            });

            // 3. Блокируем случайное изменение значения колесиком мыши
            valueInput.addEventListener('wheel', (e) => {
                e.preventDefault();
            });

            // 4. Блокируем изменение стрелками, когда поле не в фокусе
            valueInput.addEventListener('keydown', (e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    e.preventDefault();
                }
            });
        }
    }


    // --- Логика для кнопок сброса ---
    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Отменяем переход по ссылке
            const sliderId = e.target.dataset.sliderId;
            const slider = sliders[sliderId];
            const valueInput = document.getElementById(`${sliderId}-value`);

            if (slider) {
                slider.value = 0; // Сбрасываем значение ползунка
                if (valueInput) {
                    valueInput.value = '0'; // Обновляем текстовое значение
                }
                if (document.activeElement) document.activeElement.blur();
                debouncedApplyFilters(); // Применяем изменения
                debouncedSaveSliderValues();
            }
        });
    });

    resetAllButton.addEventListener('click', () => {
        // Снимаем фокус с кнопки, чтобы хоткеи снова работали сразу.
        if (document.activeElement) document.activeElement.blur();
        resetSliders();
        debouncedApplyFilters();
        saveSliderValues(); // Сохраняем сброшенные значения без задержки
    });


    function resetSliders(values = null) {
        for (const key in sliders) {
            if (sliders[key]) {
                const newValue = values ? (values[key] || 0) : 0;
                sliders[key].value = newValue;
                const valueInput = document.getElementById(`${key}-value`);
                if (valueInput) valueInput.value = newValue;
            }
        }
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }
    
    const debouncedApplyFilters = applyFilters;
    const debouncedSaveSliderValues = debounce(saveSliderValues, 500);

   downloadButton.addEventListener('click', async () => {
    if (!isImageLoaded || !sourceImage) return;

    // 1. Визуальная индикация начала сохранения
    const originalText = downloadButton.textContent;
    downloadButton.textContent = 'Processing Full Res...';
    downloadButton.style.opacity = '0.7';
    downloadButton.disabled = true;

    try {
        // 2. Создаем временный холст РЕАЛЬНОГО размера изображения
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        
        const fullW = sourceImage.naturalWidth;
        const fullH = sourceImage.naturalHeight;
        
        exportCanvas.width = fullW;
        exportCanvas.height = fullH;
        
        // Рисуем оригинал без масштабирования
        exportCtx.drawImage(sourceImage, 0, 0);
        const fullImageData = exportCtx.getImageData(0, 0, fullW, fullH);

        // 3. Получаем текущие параметры ползунков
        const params = {
            p1: parseInt(sliders.highlights.value),
            p2: parseInt(sliders.shadows.value),
            p3: parseInt(sliders.unveil.value) / 100,
            p4: parseInt(sliders['micro-texture'].value) / 100,
            p5: parseInt(sliders.structure.value) / 100,
            p6: parseInt(sliders.grit.value) / 100
        };

        // 4. Прогоняем через тот же воркер, но на полных данных
        // Если фильтры не активны (все по 0), можно пропустить этот шаг
        const isActive = Object.values(params).some(v => v !== 0);
        let finalData;
        
        if (isActive) {
            finalData = await applyImageFiltersWorker(fullImageData, params);
        } else {
            finalData = fullImageData;
        }

        exportCtx.putImageData(finalData, 0, 0);

        // 5. Скачивание
        const link = document.createElement('a');
        link.download = 'UnPlastic.png';
        link.href = exportCanvas.toDataURL('image/png', 1.0);
        link.click();

    } catch (err) {
        console.error("Save error:", err);
        alert("Error during high-res processing");
    } finally {
        // 6. Возвращаем кнопку в исходное состояние
        downloadButton.textContent = originalText;
        downloadButton.style.opacity = '1';
        downloadButton.disabled = false;
    }
});

    // --- Логика полноэкранного режима ---
    function isFullscreen() {
        return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
    }

    function toggleFullscreen() {
        if (!isImageLoaded) return;

        if (!isFullscreen()) {
            // Входим в полноэкранный режим для всего приложения
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            // Выходим из полноэкранного режима
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    fullscreenButton.addEventListener('click', toggleFullscreen);

    // Обновляем текст на кнопке при изменении состояния
    document.addEventListener('fullscreenchange', () => {
        fullscreenButton.textContent = isFullscreen() ? 'Exit Fullscreen (F)' : 'Fullscreen (F)';
    });

    // --- Наблюдатель за изменением размера контейнера ---
    const resizeObserver = new ResizeObserver(() => {
        fitCanvasToContainer();
    });
    resizeObserver.observe(dropZone);

    // --- Инициализация при загрузке страницы ---
    function initializeApp() {
        const visitedFlag = 'unplastic_visited';
        if (!localStorage.getItem(visitedFlag)) {
            // Первый визит: загружаем демо-изображение
            const demoImage = new Image();
            demoImage.onload = () => {
                const mockFile = { type: 'image/png', name: 'example.png' };
                proceedWithImage(demoImage, mockFile, true);
            };
            demoImage.onerror = () => console.error("Could not load the demo image.");
            demoImage.src = './images/example.png';
        } else {
            // Повторный визит: просто загружаем сохраненные значения ползунков
            loadSliderValues();
        }
    }

    initializeApp();
    
    // --- Логика модального окна "About" ---
    openAboutModal.addEventListener('click', (e) => {
        e.preventDefault();
        aboutOverlay.classList.remove('hidden');
    });

    closeAboutBtn.addEventListener('click', () => {
        aboutOverlay.classList.add('hidden');
    });

    // Закрытие по клику на оверлей
    aboutOverlay.addEventListener('click', (e) => {
        if (e.target === aboutOverlay) {
            aboutOverlay.classList.add('hidden');
        }
    });

});