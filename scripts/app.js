document.addEventListener('DOMContentLoaded', function() {
  // Core Configuration
  const config = {
      maxImageSize: 2 * 1024 * 1024, // 2MB
      allowedImageTypes: ['image/jpeg', 'image/png']
  };

  // Dark Mode Initialization
  const darkModeToggle = document.getElementById('darkModeToggle');
  const icon = darkModeToggle?.querySelector('i');
  
  // Data Management
  let articles = JSON.parse(localStorage.getItem('articles')) || [];
  const votedArticles = JSON.parse(localStorage.getItem('voted')) || [];

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
          .then(() => console.log('Service Worker Registered'))
          .catch(err => console.log('Service Worker Error:', err));
  }

  // Dark Mode Functions
  function initializeDarkMode() {
      if (localStorage.getItem('darkMode') === 'light') {
          document.body.classList.add('light-mode');
          icon?.classList.replace('fa-moon', 'fa-sun');
      }
  }

  function toggleDarkMode() {
      document.body.classList.toggle('light-mode');
      localStorage.setItem('darkMode', 
          document.body.classList.contains('light-mode') ? 'light' : 'dark'
      );
      icon?.classList.toggle('fa-moon');
      icon?.classList.toggle('fa-sun');
  }

  // Article Management
  function createArticleCard(article) {
      const safeContent = DOMPurify.sanitize(article.content.substring(0, 100));
      
      return `
          <div class="article-card" data-id="${article.id}">
              ${article.image ? `<img src="${article.image}" class="article-image" alt="Take image">` : ''}
              ${article.xPostLink ? `<blockquote class="twitter-tweet"><a href="${DOMPurify.sanitize(article.xPostLink)}"></a></blockquote>` : ''}
              <div class="article-content">
                  <h3>${DOMPurify.sanitize(article.title)}</h3>
                  <p>${safeContent}...</p>
                  <div class="article-meta">
                      <span>${DOMPurify.sanitize(article.author)}</span>
                      <span>${new Date(article.date).toLocaleDateString()}</span>
                  </div>
                  <div class="hot-take-meter" data-article-id="${article.id}">
                      <div class="score-bar" style="width: ${article.hotTakeScore}%"></div>
                      <span class="hot-take-score">${article.hotTakeScore}%</span>
                  </div>
                  <button class="btn share-btn" onclick="shareArticle(${article.id})">📢 Share</button>
              </div>
          </div>
      `;
  }

  // Voting System
  function handleVote(articleId) {
      if (!votedArticles.includes(articleId)) {
          const article = articles.find(a => a.id === articleId);
          article.hotTakeScore = Math.min(article.hotTakeScore + 20, 100);
          votedArticles.push(articleId);
          localStorage.setItem('voted', JSON.stringify(votedArticles));
          saveArticles();
          loadArticles();
      }
  }

  // Sharing System
  window.shareArticle = function(articleId) {
      const article = articles.find(a => a.id === articleId);
      if (navigator.share) {
          navigator.share({
              title: article.title,
              text: article.content.substring(0, 100),
              url: window.location.href
          });
      } else {
          prompt("Copy this URL:", `${window.location.href}?take=${articleId}`);
      }
  };

  // Form Handling
  function handleFormSubmit(e) {
      e.preventDefault();
      
      if (!e.target.checkValidity()) {
          e.target.reportValidity();
          return;
      }

      const newArticle = {
          id: Date.now(),
          title: DOMPurify.sanitize(document.getElementById('takeTitle').value),
          author: DOMPurify.sanitize(document.getElementById('takeName').value),
          content: DOMPurify.sanitize(document.getElementById('takeContent').value),
          xPostLink: DOMPurify.sanitize(document.getElementById('xPostLink').value),
          image: localStorage.getItem('tempImage') || '',
          hotTakeScore: 0,
          date: new Date().toISOString(),
          category: 'user'
      };

      articles.unshift(newArticle);
      saveArticles();
      loadArticles();
      e.target.reset();
      localStorage.removeItem('tempImage');
      showToast('Take launched! 🚀');
      document.querySelector('.image-preview-container').innerHTML = '';
  }

  // Helper Functions
  function saveArticles() {
      localStorage.setItem('articles', JSON.stringify(articles));
  }

  function showToast(message) {
      const toast = document.getElementById('toast');
      toast.textContent = message;
      toast.classList.remove('toast-hidden');
      setTimeout(() => toast.classList.add('toast-hidden'), 3000);
  }

  // Initialization
  function initializeApp() {
      initializeDarkMode();
      
      // Event Listeners
      darkModeToggle?.addEventListener('click', toggleDarkMode);
      document.getElementById('searchInput')?.addEventListener('input', performSearch);
      document.getElementById('globalSearch')?.addEventListener('input', performSearch);
      document.querySelector('.take-form')?.addEventListener('submit', handleFormSubmit);
      document.getElementById('takeImage')?.addEventListener('change', handleImageUpload);
      document.getElementById('takeContent')?.addEventListener('input', updateCharCount);

      // Initial Load
      loadArticles();
      loadFeaturedThinker();
  }

  // Start the App
  initializeApp();
});

// Service Worker (sw.js - Create new file)
// Service Worker (sw.js - Create new file)