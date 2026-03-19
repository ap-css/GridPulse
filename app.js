/* ============================================
   GridPulse ⚡ — Application Logic
   Karnataka Power Outage Tracker
   ============================================ */

(function () {
  'use strict';

  // ---- State ----
  let allOutages = [];
  let filteredOutages = [];
  let currentFilter = 'all';
  let currentSearch = '';

  // ---- DOM Elements ----
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const cursorDot = $('#cursorDot');
  const cursorRing = $('#cursorRing');
  const themeToggle = $('#themeToggle');
  const searchInput = $('#searchInput');
  const filterTabs = $$('.filter-tab');
  const outageGrid = $('#outageGrid');
  const noResults = $('#noResults');
  const alertForm = $('#alertForm');
  const subscriptionSuccess = $('#subscriptionSuccess');
  const toast = $('#toast');
  const areaSuggestions = $('#areaSuggestions');
  const statCards = $$('.stat-card.interactive');

  // ---- Cursor Animation ----
  function initCursor() {
    // Don't init on touch devices
    if ('ontouchstart' in window) return;

    let mouseX = 0, mouseY = 0;
    let dotX = 0, dotY = 0;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    });

    // Hover detection
    document.addEventListener('mouseover', (e) => {
      const target = e.target;
      if (target.matches('button, a, input, select, .outage-card, .glass-card, .logo')) {
        cursorDot.classList.add('hovering');
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target;
      if (target.matches('button, a, input, select, .outage-card, .glass-card, .logo')) {
        cursorDot.classList.remove('hovering');
      }
    });

    function animateCursor() {
      // Smooth follow for dot
      dotX += (mouseX - dotX) * 0.15;
      dotY += (mouseY - dotY) * 0.15;
      cursorDot.style.left = dotX + 'px';
      cursorDot.style.top = dotY + 'px';

      requestAnimationFrame(animateCursor);
    }

    animateCursor();
  }

  // ---- Theme Toggle ----
  function initTheme() {
    const saved = localStorage.getItem('gridpulse-theme');
    if (saved) {
      document.documentElement.setAttribute('data-theme', saved);
      updateThemeIcon(saved);
    }

    themeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('gridpulse-theme', next);
      updateThemeIcon(next);
      showToast(next === 'dark' ? '🌙 Dark mode activated' : '☀️ Light mode activated', 'info');
    });
  }

  function updateThemeIcon(theme) {
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  // ---- Load Outage Data ----
  async function loadOutages() {
    try {
      const res = await fetch('data/outages.json');
      const data = await res.json();
      allOutages = data.outages;
      $('#lastUpdated').textContent = formatDateTime(data.lastUpdated);
      populateSuggestions();
      updateStats();
      applyFilters();
    } catch (err) {
      console.error('Failed to load outage data:', err);
      outageGrid.innerHTML = `
        <div class="glass-card" style="padding: 40px; text-align: center;">
          <p style="font-size: 1.2rem; color: var(--neon-red);">⚠️ Unable to load outage data</p>
          <p style="color: var(--text-muted); margin-top: 8px;">Make sure to serve this page from a local server (e.g., Live Server extension in VS Code)</p>
        </div>
      `;
    }
  }

  // ---- Update Stats ----
  function updateStats() {
    const total = allOutages.length;
    const active = allOutages.filter(o => o.status === 'active').length;
    const upcoming = allOutages.filter(o => o.status === 'upcoming').length;
    const completed = allOutages.filter(o => o.status === 'completed').length;

    animateNumber($('#statTotal'), total);
    animateNumber($('#statActive'), active);
    animateNumber($('#statUpcoming'), upcoming);
    animateNumber($('#statCompleted'), completed);
  }

  function animateNumber(el, target) {
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 20));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      el.textContent = current;
    }, 40);
  }

  // ---- Search & Filter ----
  function initSearch() {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      applyFilters();
    });

    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        setFilter(tab.dataset.filter);
      });
    });

    statCards.forEach(card => {
      card.addEventListener('click', () => {
        setFilter(card.dataset.filter);
        // Scroll to feed
        $('#outageSection').scrollIntoView({ behavior: 'smooth' });
      });
    });
  }

  function setFilter(filter) {
    currentFilter = filter;
    
    // Update tabs UI
    filterTabs.forEach(t => {
      t.classList.remove('active');
      if (t.dataset.filter === filter) t.classList.add('active');
    });

    applyFilters();
  }

  function populateSuggestions() {
    const areas = [...new Set(allOutages.map(o => o.area))].sort();
    areaSuggestions.innerHTML = areas.map(area => `<option value="${area}">`).join('');
  }

  function applyFilters() {
    filteredOutages = allOutages.filter(o => {
      const matchesSearch = !currentSearch ||
        o.area.toLowerCase().includes(currentSearch) ||
        o.locality.toLowerCase().includes(currentSearch) ||
        o.district.toLowerCase().includes(currentSearch) ||
        o.zone.toLowerCase().includes(currentSearch);

      const matchesFilter = currentFilter === 'all' ||
        o.status === currentFilter ||
        o.severity === currentFilter;

      return matchesSearch && matchesFilter;
    });

    renderOutages();
  }

  // ---- Render Outage Cards ----
  function renderOutages() {
    if (filteredOutages.length === 0) {
      outageGrid.innerHTML = '';
      noResults.classList.add('show');
      return;
    }

    noResults.classList.remove('show');

    // Group by date
    const grouped = {};
    filteredOutages.forEach(o => {
      if (!grouped[o.date]) grouped[o.date] = [];
      grouped[o.date].push(o);
    });

    let html = '';
    const dates = Object.keys(grouped).sort();

    dates.forEach(date => {
      const dateLabel = formatDateLabel(date);
      html += `
        <div class="date-group-header">
          <span class="date-group-label">${dateLabel}</span>
          <div class="date-group-line"></div>
        </div>
      `;

      grouped[date].forEach((o, i) => {
        html += createOutageCard(o, i);
      });
    });

    outageGrid.innerHTML = html;

    // Animate cards in
    requestAnimationFrame(() => {
      const cards = $$('.outage-card');
      cards.forEach((card, i) => {
        setTimeout(() => card.classList.add('visible'), i * 80);
      });
    });
  }

  function createOutageCard(o, index) {
    const statusIcon = {
      active: '<span class="status-dot"></span>',
      upcoming: '🟡',
      completed: '✅',
      emergency: '🚨'
    };

    const severityClass = o.severity === 'emergency' ? 'emergency' : o.status;

    return `
      <div class="outage-card glass-card" data-id="${o.id}">
        <div class="outage-card-header">
          <div class="outage-area">${o.area}</div>
          <span class="outage-status ${severityClass}">
            ${statusIcon[o.severity === 'emergency' ? 'emergency' : o.status] || ''}
            ${o.severity === 'emergency' ? 'Emergency' : capitalize(o.status)}
          </span>
        </div>
        <div class="outage-locality">📍 ${o.locality}</div>
        <div class="outage-details">
          <div class="outage-detail">
            <div class="outage-detail-icon">📅</div>
            <div class="outage-detail-text">
              <span class="outage-detail-label">Date</span>
              <span class="outage-detail-value">${formatDate(o.date)}</span>
            </div>
          </div>
          <div class="outage-detail">
            <div class="outage-detail-icon">🕐</div>
            <div class="outage-detail-text">
              <span class="outage-detail-label">Time</span>
              <span class="outage-detail-value">${o.startTime} – ${o.endTime}</span>
            </div>
          </div>
          <div class="outage-detail">
            <div class="outage-detail-icon">⏱️</div>
            <div class="outage-detail-text">
              <span class="outage-detail-label">Duration</span>
              <span class="outage-detail-value">${o.duration}</span>
            </div>
          </div>
          <div class="outage-detail">
            <div class="outage-detail-icon">🧭</div>
            <div class="outage-detail-text">
              <span class="outage-detail-label">Zone</span>
              <span class="outage-detail-value">${o.zone}</span>
            </div>
          </div>
        </div>
        <div class="outage-reason">
          <strong>Reason:</strong> ${o.reason}
        </div>
        <div class="outage-feeders">
          ${o.feeders.map(f => `<span class="feeder-tag">${f}</span>`).join('')}
        </div>
      </div>
    `;
  }

  // ---- Weather & Risk ----
  async function loadWeather() {
    try {
      // Bangalore coordinates: 12.97°N, 77.59°E
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=12.97&longitude=77.59&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,cloud_cover&timezone=Asia/Kolkata';
      const res = await fetch(url);
      const data = await res.json();

      const current = data.current;
      const temp = Math.round(current.temperature_2m);
      const humidity = current.relative_humidity_2m;
      const wind = Math.round(current.wind_speed_10m);
      const rain = current.precipitation;
      const cloud = current.cloud_cover;
      const weatherCode = current.weather_code;

      $('#weatherTemp').textContent = `${temp}°C`;
      $('#weatherDesc').textContent = getWeatherDescription(weatherCode);
      $('#weatherHumidity').textContent = `${humidity}%`;
      $('#weatherWind').textContent = `${wind} km/h`;
      $('#weatherRain').textContent = `${rain} mm`;
      $('#weatherCloud').textContent = `${cloud}%`;

      // Calculate risk
      calculateRisk(temp, humidity, wind, rain, weatherCode);
    } catch (err) {
      console.error('Weather fetch failed:', err);
      $('#weatherDesc').textContent = 'Unable to load weather data';
    }
  }

  function getWeatherDescription(code) {
    const descriptions = {
      0: 'Clear sky',
      1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Foggy', 48: 'Depositing rime fog',
      51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
      61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
      71: 'Slight snowfall', 73: 'Moderate snowfall', 75: 'Heavy snowfall',
      80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
      95: 'Thunderstorm', 96: 'Thunderstorm with slight hail', 99: 'Thunderstorm with heavy hail'
    };
    return descriptions[code] || 'Unknown';
  }

  function calculateRisk(temp, humidity, wind, rain, code) {
    let score = 0;
    let reasons = [];

    // Storm / thunderstorm — highest risk
    if (code >= 95) {
      score += 40;
      reasons.push('Thunderstorm activity detected');
    }

    // Heavy rain
    if (rain > 20) {
      score += 30;
      reasons.push('Heavy rainfall increases flood risk to substations');
    } else if (rain > 5) {
      score += 15;
      reasons.push('Moderate rainfall may affect exposed lines');
    }

    // High wind
    if (wind > 50) {
      score += 30;
      reasons.push('High wind speeds can damage overhead lines');
    } else if (wind > 30) {
      score += 15;
      reasons.push('Moderate winds may cause tree-fall on lines');
    }

    // Extreme heat
    if (temp > 40) {
      score += 25;
      reasons.push('Extreme heat causes transformer overload');
    } else if (temp > 38) {
      score += 10;
      reasons.push('High temperature increases grid stress');
    }

    // High humidity + heat (load stress)
    if (humidity > 85 && temp > 32) {
      score += 10;
      reasons.push('High humidity + heat increases cooling demand');
    }

    // Clamp score
    score = Math.min(100, score);

    let level, color, description;
    if (score >= 50) {
      level = 'HIGH';
      color = 'var(--neon-red)';
      description = reasons.length > 0 ? reasons[0] : 'Multiple risk factors detected. Unplanned outages likely.';
    } else if (score >= 20) {
      level = 'MEDIUM';
      color = 'var(--neon-yellow)';
      description = reasons.length > 0 ? reasons[0] : 'Some risk factors present. Stay prepared.';
    } else {
      level = 'LOW';
      color = 'var(--neon-green)';
      description = 'Weather conditions are favorable. Low risk of unplanned outages.';
    }

    const riskLevel = $('#riskLevel');
    const riskMeter = $('#riskMeter');
    const riskDesc = $('#riskDescription');

    riskLevel.textContent = level;
    riskLevel.className = 'risk-level ' + level.toLowerCase();
    riskMeter.style.setProperty('--risk-color', color);
    riskMeter.style.setProperty('--risk-percent', score + '%');
    riskDesc.textContent = description;
  }

  // ---- Alert Subscription ----
  function initAlerts() {
    alertForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const area = $('#alertArea').value;
      const telegram = $('#alertTelegram').value.trim();

      if (!area || !telegram) return;

      // Store subscription locally
      const subscriptions = JSON.parse(localStorage.getItem('gridpulse-subscriptions') || '[]');
      const existing = subscriptions.find(s => s.area === area && s.telegram === telegram);

      if (existing) {
        showToast(`⚠️ You're already subscribed to ${area}`, 'info');
        return;
      }

      subscriptions.push({
        area,
        telegram,
        subscribedAt: new Date().toISOString()
      });

      localStorage.setItem('gridpulse-subscriptions', JSON.stringify(subscriptions));

      subscriptionSuccess.classList.add('show');
      showToast(`🔔 Subscribed to ${area} outage alerts!`, 'success');

      // Reset form
      alertForm.reset();

      // Log for backend integration
      console.log('📢 New subscription:', { area, telegram });
      console.log('💡 To connect Telegram Bot: Create a bot with @BotFather, get the token, and send alerts via the Bot API.');
    });
  }

  // ---- Toast Notifications ----
  function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // ---- Utility Functions ----
  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  }

  function formatDateLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dateVal = d.getTime();
    if (dateVal === today.getTime()) return '📅 Today — ' + formatDate(dateStr);
    if (dateVal === tomorrow.getTime()) return '📅 Tomorrow — ' + formatDate(dateStr);
    return '📅 ' + formatDate(dateStr);
  }

  function formatDateTime(isoStr) {
    const d = new Date(isoStr);
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // ---- Intersection Observer for Card Animations ----
  function initScrollAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    // Observe stat cards
    $$('.stat-card').forEach(card => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      observer.observe(card);
    });

    // Re-observe when new outage cards are added
    const gridObserver = new MutationObserver(() => {
      $$('.outage-card:not(.observed)').forEach(card => {
        card.classList.add('observed');
        observer.observe(card);
      });
    });

    gridObserver.observe(outageGrid, { childList: true });
  }

  // Make stat cards visible when they come into view
  function initStatCardAnimations() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    $$('.stat-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(20px)';
      card.style.transition = `opacity 0.5s ease ${i * 0.1}s, transform 0.5s ease ${i * 0.1}s`;
      observer.observe(card);
    });
  }

  // ---- Navbar Scroll Effect ----
  function initNavbar() {
    window.addEventListener('scroll', () => {
      const navbar = $('#navbar');
      if (window.scrollY > 50) {
        navbar.style.borderBottomColor = 'rgba(0, 240, 255, 0.1)';
      } else {
        navbar.style.borderBottomColor = 'var(--glass-border)';
      }
    });
  }

  // ---- Initialize Everything ----
  function init() {
    initCursor();
    initTheme();
    initSearch();
    initAlerts();
    initNavbar();
    initStatCardAnimations();
    loadOutages();
    loadWeather();

    // Refresh weather every 15 minutes
    setInterval(loadWeather, 15 * 60 * 1000);
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
