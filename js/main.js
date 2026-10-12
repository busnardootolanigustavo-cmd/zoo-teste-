/* ==========================================================================
   ZOO AMERICANA — COMPORTAMENTOS E INTERAÇÕES
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // 1. Menu Mobile
  const navToggle = document.querySelector('.nav-toggle');
  const navMenu = document.getElementById('menu-principal');

  if (navToggle && navMenu) {
    navToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', isOpen);
    });

    navMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // 2. Cálculo do Status de Abertura em Tempo Real
  const DIAS_NOMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const DIAS_FUNCIONAMENTO = [0, 3, 4, 5, 6]; // Domingo, Quarta, Quinta, Sexta, Sábado

  function atualizarStatusZoo() {
    const agora = new Date();
    const diaSemana = agora.getDay();
    const horaDecimal = agora.getHours() + agora.getMinutes() / 60;
    const abreHoje = DIAS_FUNCIONAMENTO.includes(diaSemana);

    const ticketEl = document.getElementById('ticket');
    const statusTitulo = document.getElementById('status-titulo');
    const statusSub = document.getElementById('status-sub');
    const hojeDia = document.getElementById('hoje-dia');

    if (!ticketEl || !statusTitulo || !statusSub) return;

    if (hojeDia) {
      hojeDia.textContent = DIAS_NOMES[diaSemana];
    }

    if (abreHoje && horaDecimal >= 8 && horaDecimal < 16) {
      ticketEl.dataset.estado = 'aberto';
      statusTitulo.textContent = 'Aberto Agora';
      statusSub.textContent = 'Portões abertos! Bilheteria em funcionamento até as 16h.';
    } else if (abreHoje && horaDecimal >= 16 && horaDecimal < 17) {
      ticketEl.dataset.estado = 'quase';
      statusTitulo.textContent = 'Bilheteria Fechada';
      statusSub.textContent = 'Entrada encerrada às 16h. Visitantes no parque até as 17h.';
    } else if (abreHoje && horaDecimal < 8) {
      ticketEl.dataset.estado = 'fechado';
      statusTitulo.textContent = 'Abre Hoje às 8h';
      statusSub.textContent = 'Parque em preparação técnica. Portões abrem às 8h00.';
    } else {
      ticketEl.dataset.estado = 'fechado';
      let diasAteAbrir = 1;
      while (!DIAS_FUNCIONAMENTO.includes((diaSemana + diasAteAbrir) % 7)) {
        diasAteAbrir++;
      }
      const proximoDia = (diaSemana + diasAteAbrir) % 7;
      const quando = diasAteAbrir === 1 ? 'amanhã' : DIAS_NOMES[proximoDia].toLowerCase();
      statusTitulo.textContent = 'Fechado Agora';
      statusSub.textContent = `Descanso da fauna e manutenção. Reabre ${quando} às 8h00.`;
    }

    // Destacar o dia atual na tabela de horários
    const linhaHoje = document.querySelector(`.schedule-table tr[data-dia="${diaSemana}"]`);
    if (linhaHoje) {
      document.querySelectorAll('.schedule-table tr').forEach(tr => tr.classList.remove('is-today'));
      linhaHoje.classList.add('is-today');
    }
  }

  atualizarStatusZoo();
  setInterval(atualizarStatusZoo, 60000); // recalcula a cada minuto

  // 3. Filtros de Animais
  const filterButtons = document.querySelectorAll('.filter-btn');
  const animalCards = document.querySelectorAll('.animal-card');

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });

      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');

      const filterValue = btn.dataset.filter;

      animalCards.forEach(card => {
        let matches = false;
        if (filterValue === 'todos') {
          matches = true;
        } else if (filterValue === 'ameacados') {
          const threat = card.dataset.threat;
          matches = threat === 'vu' || threat === 'en' || threat === 'cr';
        } else {
          matches = card.dataset.group === filterValue;
        }

        if (matches) {
          card.classList.remove('is-hidden');
        } else {
          card.classList.add('is-hidden');
        }
      });
    });
  });

  // 4. Modal / Lightbox para ver a foto real expandida com detalhes
  const lightbox = document.getElementById('animal-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxSci = document.getElementById('lightbox-sci');
  const lightboxDesc = document.getElementById('lightbox-desc');
  const lightboxBadge = document.getElementById('lightbox-badge');
  const lightboxSwatch = document.getElementById('lightbox-swatch');
  const lightboxClose = document.getElementById('lightbox-close');
  const lightboxOverlay = document.getElementById('lightbox-overlay');

  function openAnimalModal(card) {
    if (!lightbox) return;

    const img = card.querySelector('.animal-card__img');
    const name = card.querySelector('.animal-name');
    const sci = card.querySelector('.animal-sci');
    const desc = card.querySelector('.animal-desc');
    const badge = card.querySelector('.status-badge');
    const swatch = card.querySelector('.skin-ornament');

    if (img && lightboxImg) {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
    }
    if (name && lightboxTitle) lightboxTitle.textContent = name.textContent;
    if (sci && lightboxSci) lightboxSci.textContent = sci.textContent;
    if (desc && lightboxDesc) lightboxDesc.textContent = desc.textContent;
    if (badge && lightboxBadge) {
      lightboxBadge.textContent = badge.textContent;
      lightboxBadge.className = 'lightbox__badge ' + badge.className.replace('status-badge', '');
    }
    if (swatch && lightboxSwatch) {
      const swatchTex = swatch.style.getPropertyValue('--swatch-tex');
      lightboxSwatch.style.backgroundImage = swatchTex;
    }

    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeAnimalModal() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Abrir ao clicar na foto do card
  document.querySelectorAll('.animal-card__media').forEach(media => {
    media.addEventListener('click', () => {
      const card = media.closest('.animal-card');
      if (card) openAnimalModal(card);
    });
  });

  if (lightboxClose) lightboxClose.addEventListener('click', closeAnimalModal);
  if (lightboxOverlay) lightboxOverlay.addEventListener('click', closeAnimalModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) {
      closeAnimalModal();
    }
  });

  // 5. Ano Atual no Rodapé
  const yearEl = document.getElementById('current-year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

});
