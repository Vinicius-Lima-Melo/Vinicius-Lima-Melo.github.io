// Tudo aqui é melhoria: sem JavaScript a página continua completa e legível
// (as duas abas aparecem uma embaixo da outra).
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const announcer = document.getElementById('announcer');

  const announce = (message) => {
    announcer.textContent = '';
    // Esvaziar e reescrever faz o leitor de tela repetir a mesma frase.
    requestAnimationFrame(() => { announcer.textContent = message; });
  };

  // ------------------------------------------------------------- Tema

  const themeBtn = document.getElementById('theme-btn');
  const themeColor = { dark: '#0c0416', light: '#faf7ff' };

  const syncTheme = () => {
    const theme = root.dataset.theme === 'light' ? 'light' : 'dark';
    themeBtn.setAttribute('aria-label', theme === 'dark' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro');
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
      meta.setAttribute('content', themeColor[theme]);
    });
  };

  themeBtn.addEventListener('click', () => {
    const next = root.dataset.theme === 'light' ? 'dark' : 'light';
    root.dataset.theme = next;
    try { localStorage.setItem('vl-theme', next); } catch { /* aba anônima: só não lembra */ }
    syncTheme();
  });
  syncTheme();

  // ------------------------------------------------------------- Máquina de escrever

  const typeEl = document.getElementById('type-text');
  const words = ['sistemas web', 'apps multiplataforma', 'SaaS whitelabel', 'PWAs offline', 'painéis de gestão'];

  if (typeEl && !reduceMotion) {
    let word = 0;
    let chars = words[0].length;
    let deleting = true;

    const tick = () => {
      if (deleting) {
        chars -= 1;
        typeEl.textContent = words[word].slice(0, chars);
        if (chars === 0) {
          deleting = false;
          word = (word + 1) % words.length;
        }
        setTimeout(tick, chars === 0 ? 280 : 38);
      } else {
        const next = words[word];
        chars += 1;
        typeEl.textContent = next.slice(0, chars);
        if (chars === next.length) {
          deleting = true;
          setTimeout(tick, 2200);
        } else {
          setTimeout(tick, 72);
        }
      }
    };
    setTimeout(tick, 2600);
  }

  // ------------------------------------------------------------- Entrada ao rolar

  const revealables = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealables.forEach((el) => el.classList.add('is-in'));
  } else {
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -4% 0px', threshold: 0.05 });

    // Os blocos do primeiro quadro chegam em cascata, não todos de uma vez.
    revealables.forEach((el, index) => {
      el.style.transitionDelay = `${Math.min(index, 6) * 55}ms`;
      io.observe(el);
    });
  }

  // ------------------------------------------------------------- Holofote nos cartões

  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.card').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - rect.left}px`);
        card.style.setProperty('--my', `${event.clientY - rect.top}px`);
      });
    });
  }

  // ------------------------------------------------------------- Copiar e compartilhar

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  };

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const value = button.getAttribute('data-copy');
      if (await copyText(value)) {
        button.classList.add('is-done');
        announce('E-mail copiado.');
        setTimeout(() => button.classList.remove('is-done'), 2200);
      } else {
        window.location.href = `mailto:${value}`;
      }
    });
  });

  document.getElementById('share-btn').addEventListener('click', async () => {
    const data = {
      title: document.title,
      text: 'Vinícius Lima — sistemas web, apps e SaaS sob medida.',
      url: location.origin + location.pathname,
    };
    if (navigator.share) {
      try { await navigator.share(data); } catch { /* fechou a janela de compartilhar */ }
      return;
    }
    announce((await copyText(data.url)) ? 'Link da página copiado.' : 'Não deu para copiar o link.');
  });

  // ------------------------------------------------------------- Estrelas do Web Copilot

  const stars = document.getElementById('copilot-stars');
  if (stars && 'fetch' in window) {
    fetch('https://api.github.com/repos/Vinicius-Lima-Melo/web-copilot', { headers: { Accept: 'application/vnd.github+json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((repo) => {
        if (!repo || !repo.stargazers_count) return;
        const count = repo.stargazers_count;
        // No selo, só o número; o resto da frase é para o leitor de tela.
        const [num, label] = stars.querySelectorAll('span');
        num.textContent = String(count);
        label.textContent = count === 1 ? ' estrela no GitHub' : ' estrelas no GitHub';
        stars.hidden = false;
      })
      .catch(() => { /* sem rede ou limite da API: o selo só não aparece */ });
  }

  // ------------------------------------------------------------- Para quem abre o console

  console.log(
    '%c<VL /> %cOi, dev! Curtiu a página? Me chama: viniciuslimamelo.dev@gmail.com',
    'color:#c07bf4;font-weight:700;font-size:14px',
    'color:inherit;font-size:13px',
  );
})();
