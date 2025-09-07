/**
 * Audio Slide Player
 * - Handles multiple slide layouts and adds a universal heading if `concept` is present.
 * - Correctly renders line breaks in comparison slides.
 */
document.addEventListener('DOMContentLoaded', () => {
  // ---------- DOM ----------
  let audioPlayer           = document.getElementById('audio-player');
  const slideDisplay        = document.getElementById('slide-display');
  const slideImageContainer = document.getElementById('slide-image-container');
  const slideTextContainer  = document.getElementById('slide-text-container');
  const slideTextContent    = document.getElementById('slide-text-content') || slideTextContainer;
  const sourceLinkWrap      = document.getElementById('source-link-wrap');
  const zoomHintEl          = document.getElementById('zoom-hint');
  const tocList             = document.getElementById('toc-list');
  const quizOverlay         = document.getElementById('quiz-overlay');

  // ---------- STATE ----------
  let slidesData = [];
  let currentSlideIndex = -1;
  let hideControlsTimeout;
  let textAnimationTimeout;
  let presentationId = 'test2';

  // ---------- UTILS ----------
  const getId = () => presentationId;
  const getSlideType = (slide) => slide.layout || slide.type || 'classic_bullet_point';

  function parseTimestamp(ts) {
    if (typeof ts === 'number') return ts;
    if (!ts) return 0;
    const parts = String(ts).replace(':', '_').split('_');
    const minutes = parseInt(parts[0], 10) || 0;
    const seconds = parseInt(parts[1], 10) || 0;
    return (minutes * 60) + seconds;
  }

  const escapeHTML = (s) => String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function formatMarkdownText(text) {
    let t = escapeHTML(text);
    t = t.replace(/\n/g, '<br>');
    t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="bold-text">$1</strong>');
    t = t.replace(/(^|[\s(])\*(.+?)\*(?=[\s).,!?:;]|$)/g, '$1<em class="italic-text">$2</em>');
    return t;
  }

  // ---------- RENDER ----------
  function renderSlide(slideIndex) {
    if (slideIndex === -1 || !slidesData[slideIndex]) {
      slideImageContainer.innerHTML = '';
      slideTextContent.innerHTML = '<p style="align-self:center; text-align:center;">Presentation loading...</p>';
      return;
    }

    const slide = slidesData[slideIndex];
    const slideType = getSlideType(slide);
    const id = getId();
    
    const imageFilename = slide.image_filename || `${slide.index + 1}.png`;
    const imagePath = `images/${id}/${imageFilename}`;

    slideDisplay.className = `type-${slideType.replace(/_/g, '-')}`;

    const needsImage = ['classic_bullet_point', 'only_image'].includes(slideType);
    slideImageContainer.style.display = needsImage ? 'flex' : 'none';
    if (needsImage) {
        slideImageContainer.innerHTML = `<img src="${imagePath}" alt="${escapeHTML(slide.concept)}" onerror="this.style.display='none'; this.parentElement.innerHTML='<p>Image not found.</p>';">`;
    }

    // --- Universal Heading ---
    let headingHtml = '';
    // Don't show heading on title slide, as it has its own.
    if (slide.concept && slideType !== 'title') {
        headingHtml = `<h1 class="slide-heading">${escapeHTML(slide.concept)}</h1>`;
    }

    // --- Text Area (based on slide type) ---
    let contentHtml = '';
    switch (slideType) {
        case 'title':
            contentHtml = `<div class="title-container"><h1 class="title-main">${escapeHTML(slide.explanation)}</h1><p class="title-sub">${escapeHTML(slide.slide_content)}</p></div>`;
            break;
        case 'table_of_content':
            const tocItems = String(slide.slide_content || '').split('\n').map(line => `<p class="toc-list-item">${formatMarkdownText(line)}</p>`).join('');
            contentHtml = tocItems; // Heading is added universally
            break;
        case 'quote':
            contentHtml = `<div class="quote-container"><p class="quote-text">${formatMarkdownText(slide.explanation)}</p><p class="quote-source">${escapeHTML(slide.slide_content)}</p></div>`;
            break;
        case 'reflective_question':
            contentHtml = `<div class="reflective-container"><p class="reflective-text">${formatMarkdownText(slide.explanation)}</p></div>`;
            break;
        case 'a_vs_b':
            const parts = (slide.slide_content || '').split('---');
            const partA = (parts[0] || '').trim().split('\n');
            const partB = (parts[1] || '').trim().split('\n');
            const titleA = escapeHTML(partA.shift());
            const titleB = escapeHTML(partB.shift());
            // FIX: Join with <br> to respect line breaks
            const contentA = partA.map(line => formatMarkdownText(line)).join('<br>');
            const contentB = partB.map(line => formatMarkdownText(line)).join('<br>');
            contentHtml = `<div class="comparison-container"><div class="comparison-box"><h3>${titleA}</h3><p>${contentA}</p></div><div class="comparison-box"><h3>${titleB}</h3><p>${contentB}</p></div></div>`;
            break;
        case 'only_image':
            contentHtml = '';
            break;
        case 'only_text':
             contentHtml = `<div class="only-text-container"><p>${formatMarkdownText(slide.slide_content)}</p></div>`;
             break;
        case 'classic_bullet_point':
        default:
            const allLines = String(slide.slide_content || '').split('\n');
            const bulletLines = allLines.slice(1);
            const bulletsHtml = bulletLines.map(line => `<p class="list-item">${formatMarkdownText(line)}</p>`).join('');
            contentHtml = `<p class="explanation-callout">${formatMarkdownText(slide.explanation)}</p>${bulletsHtml}`;
            break;
    }
    slideTextContent.innerHTML = headingHtml + contentHtml;

    if (window.renderMathInElement) {
        renderMathInElement(slideTextContent, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}] });
    }
    requestAnimationFrame(fitTextBlock);
  }

  // --- All other functions (startTextAnimation, fitTextBlock, audio, navigation, etc.) remain the same as the previous corrected version ---
  function startTextAnimation() {
    clearTimeout(textAnimationTimeout);
    const slide = slidesData[currentSlideIndex];
    if (!slide) return;
    const slideType = getSlideType(slide);

    switch (slideType) {
        case 'classic_bullet_point':
            const explanationElement = slideTextContent.querySelector('.explanation-callout');
            const bulletElements = slideTextContent.querySelectorAll('.list-item');
            if (explanationElement) {
                textAnimationTimeout = setTimeout(() => {
                    explanationElement.classList.add('visible');
                    if (bulletElements.length > 0) {
                        textAnimationTimeout = setTimeout(() => animateListItems(0, bulletElements, 900), 1500);
                    }
                }, 200);
            }
            break;
        case 'table_of_content':
            const tocListItems = slideTextContent.querySelectorAll('.toc-list-item');
            animateListItems(0, tocListItems, 500);
            break;
        case 'a_vs_b':
            const boxes = slideTextContent.querySelectorAll('.comparison-box');
            if (boxes.length > 0) boxes[0].classList.add('visible');
            if (boxes.length > 1) {
                textAnimationTimeout = setTimeout(() => boxes[1].classList.add('visible'), 300);
            }
            break;
    }
  }

  function animateListItems(index, elements, delay) {
    if (index >= elements.length) return;
    elements[index].classList.add('visible');
    textAnimationTimeout = setTimeout(() => animateListItems(index + 1, elements, delay), delay);
  }

  function fitTextBlock() {
    if (!slideTextContainer || !slideTextContent) return;
    const slide = slidesData[currentSlideIndex];
    if (!slide) return;
    const slideType = getSlideType(slide);

    const shouldScale = ['quote', 'reflective_question', 'title', 'only_text'].includes(slideType);

    slideTextContent.style.transform = 'scale(1)';
    
    if (!shouldScale) return;

    const containerW = slideTextContainer.clientWidth;
    const containerH = slideTextContainer.clientHeight;
    const contentW = slideTextContent.scrollWidth;
    const contentH = slideTextContent.scrollHeight;
    if (containerW <= 0 || containerH <= 0 || contentW <= 0 || contentH <= 0) return;
    
    const scaleW = (containerW - 40) / contentW;
    const scaleH = (containerH - 40) / contentH;
    let scale = Math.min(scaleW, scaleH, 1);

    slideTextContent.style.transform = `scale(${scale})`;
  }

  const resizeObserver = new ResizeObserver(() => requestAnimationFrame(fitTextBlock));
  resizeObserver.observe(slideDisplay);
  resizeObserver.observe(slideTextContainer);

  function attachBasicAudioListeners(aEl) {
    aEl.addEventListener('timeupdate', () => updateSlide(aEl.currentTime));
    aEl.addEventListener('seeking', () => updateSlide(aEl.currentTime));
    aEl.addEventListener('play', resetHideControlsTimer);
    aEl.addEventListener('pause', () => { clearTimeout(hideControlsTimeout); showControls(); });
  }

  function replaceAudioElementWithClone() {
    const clone = audioPlayer.cloneNode(true);
    audioPlayer.parentNode.replaceChild(clone, audioPlayer);
    audioPlayer = document.getElementById('audio-player');
    attachBasicAudioListeners(audioPlayer);
  }

  function tryLocalFallback(baseName) {
    const a = audioPlayer;
    const exts = ['.mp3', '.m4a', '.wav', '.mp4'];
    let i = 0;
    const tryNext = () => {
      i++;
      if (i < exts.length) { a.src = `audio/${baseName}${exts[i]}`; a.load(); } 
      else { console.error(`No local audio found for '${baseName}'.`); }
    };
    a.addEventListener('error', tryNext);
    a.addEventListener('canplay', () => a.removeEventListener('error', tryNext), { once: true });
    a.src = `audio/${baseName}${exts[0]}`;
    a.load();
  }

  function setAudioSourceFromConfigOrLocal(mp3Url, id) {
    replaceAudioElementWithClone();
    if (mp3Url && typeof mp3Url === 'string' && mp3Url.trim() !== '') {
      const onError = () => { audioPlayer.removeEventListener('error', onError); tryLocalFallback(id); };
      audioPlayer.addEventListener('error', onError, { once: true });
      audioPlayer.src = mp3Url.trim();
      audioPlayer.load();
    } else {
      tryLocalFallback(id);
    }
  }

  function updateSlide(currentTime) {
    let slideToShowIndex = -1;
    for (let i = 0; i < slidesData.length; i++) {
      if (currentTime >= slidesData[i].timestamp) slideToShowIndex = i;
      else break;
    }

    if (slideToShowIndex !== currentSlideIndex) {
      const isInitialLoad = currentSlideIndex === -1;
      clearTimeout(textAnimationTimeout);
      const slide = slidesData[slideToShowIndex];
      
      if (slide && (slide.type === 'quiz' || slide.layout === 'quiz')) {
        audioPlayer.pause();
        displayQuiz(slide);
      } else {
        quizOverlay.style.display = 'none';
        renderSlide(slideToShowIndex);
        setTimeout(() => startTextAnimation(), isInitialLoad ? 50 : 400);
      }
      
      currentSlideIndex = slideToShowIndex;
      updateActiveTOCItem();
    }
  }

  function populateTOC() {
    tocList.innerHTML = '';
    slidesData.forEach((slide, index) => {
        const chapter = document.createElement('div');
        chapter.className = 'toc-item';
        chapter.textContent = slide.concept || `Slide ${index + 1}`;
        chapter.dataset.index = index;
        chapter.addEventListener('click', () => { audioPlayer.currentTime = slide.timestamp; });
        tocList.appendChild(chapter);
    });
  }

  function updateActiveTOCItem() {
    document.querySelectorAll('.toc-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.index, 10) === currentSlideIndex);
    });
  }

  function displayQuiz(slide) {
    const questionEl = document.getElementById('quiz-question');
    const optionsEl = document.getElementById('quiz-options');
    const feedbackEl = document.getElementById('quiz-feedback');
    questionEl.textContent = slide.question;
    optionsEl.innerHTML = '';
    feedbackEl.textContent = '';
    slide.options.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option.text;
        button.onclick = () => {
            if (option.isCorrect) {
                feedbackEl.textContent = 'Correct!';
                feedbackEl.style.color = '#68d391';
                setTimeout(() => { quizOverlay.style.display = 'none'; audioPlayer.play(); }, 1000);
            } else {
                feedbackEl.textContent = 'Incorrect. Please try again.';
                feedbackEl.style.color = '#fc8181';
            }
        };
        optionsEl.appendChild(button);
    });
    quizOverlay.style.display = 'flex';
  }

  function setZoomHintText() {
    if (!zoomHintEl) return;
    const isApple = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    const minus = isApple ? '⌘−' : 'Ctrl−';
    const reset = isApple ? '⌘0' : 'Ctrl+0';
    zoomHintEl.textContent = `Tipp: Browser-Zoom verkleinern (${minus}). Zurücksetzen: ${reset}.`;
  }

  function showControls() { audioPlayer.classList.remove('hidden'); }
  function hideControls() { audioPlayer.classList.add('hidden'); }
  function resetHideControlsTimer() {
    clearTimeout(hideControlsTimeout);
    showControls();
    hideControlsTimeout = setTimeout(hideControls, 2500);
  }

  slideDisplay.addEventListener('mousemove', resetHideControlsTimer);
  slideDisplay.addEventListener('mouseleave', () => { hideControlsTimeout = setTimeout(hideControls, 400); });

  function loadPresentation(id, rawData) {
    presentationId = id;
    currentSlideIndex = -1;
    quizOverlay.style.display = 'none';
    const { source, entries, mp3 } = rawData;
    if (sourceLinkWrap) {
      sourceLinkWrap.innerHTML = source ? `<a href="${source}" target="_blank" rel="noopener noreferrer">${source}</a>` : '–';
    }
    setAudioSourceFromConfigOrLocal(mp3, id);
    slidesData = (entries || []).map((item, index) => ({ ...item, index, timestamp: parseTimestamp(item.timestamp) })).sort((a, b) => a.timestamp - b.timestamp);
    populateTOC();
    audioPlayer.currentTime = 0;
    updateSlide(0);
    resetHideControlsTimer();
  }

  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'loadData') {
        const id = event.data.id || new URLSearchParams(location.search).get('Id') || 'layouts_test';
        loadPresentation(id, event.data.data);
    }
  });

  function initialize() {
    setZoomHintText();
    attachBasicAudioListeners(audioPlayer);
    if (window.self === window.top) {
      const id = new URLSearchParams(location.search).get('Id') || 'layouts_test';
      const slidesFile = `${id}.json`;
      fetch(`json/${slidesFile}`)
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        })
        .then(rawData => loadPresentation(id, rawData))
        .catch(error => {
          console.error("Error loading presentation data:", error);
          slideTextContent.innerHTML = `<p style="color:red;">Fehler: Konnte die Slides nicht laden (${escapeHTML(slidesFile)}).</p>`;
        });
    }
  }

  initialize();
});
